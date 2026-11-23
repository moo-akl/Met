import { and, eq, inArray, lte, sql } from "drizzle-orm";
import {
  communityEventsTable,
  db,
  notificationInboxTable,
  presenceTable,
  profilesTable,
  userAccountsTable,
  venueOwnerProfilesTable,
} from "@workspace/db";
import { mirrorAccountLifecycleToFirestore, mirrorProfileToFirestore } from "./firestoreMirror";
import { deleteUserData } from "./deleteUserData";
import { deleteVenueOwnerProfile } from "./deleteVenueOwnerProfile";
import { deleteVenueStorageFiles } from "./deleteVenueStorageFiles";
import { adminAuth } from "./firebaseAdmin";
import { sendGmailHtmlEmail } from "./gmail";
import { withProfilePrivacySessionLocks } from "./profilePrivacy";
import { logger } from "./logger";
import { sendPushWithStatus } from "./push";
import { MET_APP_STORE_URL, MET_GOOGLE_PLAY_URL } from "./venueOutreachEmail";

export const ACCOUNT_RECOVERY_WINDOW_DAYS = 30;
const RECOVERY_WINDOW_MS = ACCOUNT_RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const ACCOUNT_DELETION_REMINDER_LEAD_MS = 7 * 24 * 60 * 60 * 1000;
const ACCOUNT_CLEANUP_BATCH_SIZE = 10;
const FIRESTORE_SYNC_BATCH_SIZE = 25;
const ACCOUNT_REMINDER_BATCH_SIZE = 25;
const ACCOUNT_DELETION_REMINDER_TYPE = "account_deletion_reminder";

type AccountRow = typeof userAccountsTable.$inferSelect;
type ReminderRow = typeof notificationInboxTable.$inferSelect;

function accountDeletionReminderSourceKey(account: AccountRow): string {
  return `account-deletion-reminder:${account.accountId}:${account.deletionRequestedAt?.getTime() ?? 0}`;
}

const ACCOUNT_DELETION_REMINDER_COPY = {
  en: {
    title: "Met account removal reminder",
    body: (date: string) =>
      `Your Met account is scheduled for permanent removal on ${date}. Sign in to Met with the same account before then and restore it to keep your account.`,
  },
  es: {
    title: "Recordatorio de eliminación de la cuenta de Met",
    body: (date: string) =>
      `Tu cuenta de Met se eliminará permanentemente el ${date}. Inicia sesión en Met con la misma cuenta antes de esa fecha y restáurala para conservarla.`,
  },
  fr: {
    title: "Rappel de suppression du compte Met",
    body: (date: string) =>
      `La suppression définitive de votre compte Met est prévue le ${date}. Connectez-vous à Met avec le même compte avant cette date et restaurez-le pour le conserver.`,
  },
  nl: {
    title: "Herinnering voor verwijdering van je Met-account",
    body: (date: string) =>
      `Je Met-account wordt op ${date} definitief verwijderd. Log vóór die datum met hetzelfde account in bij Met en herstel het om je account te behouden.`,
  },
  pt: {
    title: "Lembrete de remoção da conta Met",
    body: (date: string) =>
      `Sua conta Met será removida permanentemente em ${date}. Entre no Met com a mesma conta antes dessa data e restaure-a para mantê-la.`,
  },
  ru: {
    title: "Напоминание об удалении аккаунта Met",
    body: (date: string) =>
      `Ваш аккаунт Met будет удалён ${date}. Войдите в Met с тем же аккаунтом до этой даты и восстановите его, чтобы сохранить аккаунт.`,
  },
  vi: {
    title: "Nhắc nhở xóa tài khoản Met",
    body: (date: string) =>
      `Tài khoản Met của bạn sẽ bị xóa vĩnh viễn vào ${date}. Hãy đăng nhập Met bằng cùng tài khoản trước ngày đó và khôi phục để giữ lại tài khoản.`,
  },
  zh: {
    title: "Met 账户删除提醒",
    body: (date: string) =>
      `你的 Met 账户将于 ${date} 永久删除。请在此日期前使用同一账户登录 Met 并恢复账户，以保留你的账户。`,
  },
  ar: {
    title: "تذكير بحذف حساب Met",
    body: (date: string) =>
      `من المقرر حذف حساب Met نهائيًا في ${date}. سجّل الدخول إلى Met بالحساب نفسه قبل ذلك التاريخ واستعده للاحتفاظ بحسابك.`,
  },
} as const;

const ACCOUNT_DELETION_REMINDER_PUSH_COPY = {
  en: {
    title: "Met reminder",
    body: "Sign in to Met with the same account to review an important reminder.",
  },
  es: {
    title: "Recordatorio de Met",
    body: "Inicia sesión en Met con la misma cuenta para consultar un recordatorio importante.",
  },
  fr: {
    title: "Rappel de Met",
    body: "Connectez-vous à Met avec le même compte pour consulter un rappel important.",
  },
  nl: {
    title: "Herinnering van Met",
    body: "Log met hetzelfde account in bij Met om een belangrijke herinnering te bekijken.",
  },
  pt: {
    title: "Lembrete do Met",
    body: "Entre no Met com a mesma conta para consultar um lembrete importante.",
  },
  ru: {
    title: "Напоминание от Met",
    body: "Войдите в Met с тем же аккаунтом, чтобы посмотреть важное напоминание.",
  },
  vi: {
    title: "Nhắc nhở từ Met",
    body: "Đăng nhập Met bằng cùng tài khoản để xem lời nhắc quan trọng.",
  },
  zh: {
    title: "Met 提醒",
    body: "请使用同一账户登录 Met，查看重要提醒。",
  },
  ar: {
    title: "تذكير من Met",
    body: "سجّل الدخول إلى Met بالحساب نفسه للاطلاع على تذكير مهم.",
  },
} as const;

const ACCOUNT_DELETION_REMINDER_OPEN_APP_LABEL = {
  en: "Open Met",
  es: "Abrir Met",
  fr: "Ouvrir Met",
  nl: "Met openen",
  pt: "Abrir o Met",
  ru: "Открыть Met",
  vi: "Mở Met",
  zh: "打开 Met",
  ar: "افتح Met",
} as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return char;
    }
  });
}

function accountDeletionReminderPushCopy(preferredLocale?: string) {
  const locale = preferredLocale?.split("-")[0]?.toLowerCase() ?? "en";
  return (
    ACCOUNT_DELETION_REMINDER_PUSH_COPY[
      locale as keyof typeof ACCOUNT_DELETION_REMINDER_PUSH_COPY
    ] ?? ACCOUNT_DELETION_REMINDER_PUSH_COPY.en
  );
}

function accountDeletionReminderEmail(
  purgeAfter: Date,
  preferredLocale?: string,
) {
  const locale = preferredLocale?.split("-")[0]?.toLowerCase() ?? "en";
  const copy = accountDeletionReminderCopy(purgeAfter, locale);
  const openAppLabel =
    ACCOUNT_DELETION_REMINDER_OPEN_APP_LABEL[
      locale as keyof typeof ACCOUNT_DELETION_REMINDER_OPEN_APP_LABEL
    ] ?? ACCOUNT_DELETION_REMINDER_OPEN_APP_LABEL.en;
  const subject = copy.title;
  const text = [
    copy.title,
    "",
    copy.body,
    "",
    `${openAppLabel}: met://`,
    `App Store: ${MET_APP_STORE_URL}`,
    `Google Play: ${MET_GOOGLE_PLAY_URL}`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#f1f2ed;color:#172c28;font-family:Arial,sans-serif;">
    <main style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border-radius:8px;">
      <h1 style="margin:0 0 20px;font-size:22px;">${escapeHtml(copy.title)}</h1>
      <p style="font-size:16px;line-height:1.65;">${escapeHtml(copy.body)}</p>
      <p style="margin:24px 0;">
        <a href="met://" style="display:inline-block;padding:12px 20px;background:#11765e;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">${escapeHtml(openAppLabel)}</a>
      </p>
      <p style="font-size:13px;line-height:1.7;color:#59645f;">
        <a href="${MET_APP_STORE_URL}">App Store</a> ·
        <a href="${MET_GOOGLE_PLAY_URL}">Google Play</a>
      </p>
    </main>
  </body>
</html>`;
  return { subject, html, text };
}

function accountDeletionReminderCopy(purgeAfter: Date, preferredLocale?: string) {
  const locale = preferredLocale?.split("-")[0]?.toLowerCase() ?? "en";
  const copy =
    ACCOUNT_DELETION_REMINDER_COPY[
      locale as keyof typeof ACCOUNT_DELETION_REMINDER_COPY
    ] ?? ACCOUNT_DELETION_REMINDER_COPY.en;
  const dateLocale =
    locale in ACCOUNT_DELETION_REMINDER_COPY ? locale : "en";
  const purgeDate = new Intl.DateTimeFormat(dateLocale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(purgeAfter);
  return {
    title: copy.title,
    body: copy.body(purgeDate),
  };
}

export function serializeAccountLifecycle(account: AccountRow, now = new Date()) {
  const remainingDays =
    account.status === "pending_deletion" && account.purgeAfter
      ? Math.max(
          0,
          Math.ceil((account.purgeAfter.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        )
      : ACCOUNT_RECOVERY_WINDOW_DAYS;

  return {
    accountId: account.accountId,
    status: account.status,
    deletionRequestedAt: account.deletionRequestedAt?.toISOString() ?? null,
    purgeAfter: account.purgeAfter?.toISOString() ?? null,
    firestoreSyncPending: account.firestoreSyncPending,
    recoveryWindowDays: remainingDays,
  };
}

export async function getUserAccountById(accountId: string): Promise<AccountRow | null> {
  const [account] = await db
    .select()
    .from(userAccountsTable)
    .where(eq(userAccountsTable.accountId, accountId))
    .limit(1);
  return account ?? null;
}

export async function startAccountDeletion(
  uid: string,
  accountId: string,
  deleteVenueProfile: boolean,
  now = new Date(),
): Promise<AccountRow> {
  const purgeAfter = new Date(now.getTime() + RECOVERY_WINDOW_MS);

  return withProfilePrivacySessionLocks([uid], async (sessionDb) => {
    const account = await sessionDb.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`met-account-lifecycle:${accountId}`}, 0))`,
      );
      const [current] = await tx
        .select()
        .from(userAccountsTable)
        .where(eq(userAccountsTable.accountId, accountId))
        .limit(1);
      if (!current || current.firebaseUid !== uid || current.status !== "active") {
        throw new Error("Account is not available for deletion.");
      }

      const [profile] = await tx
        .select({
          isVisible: profilesTable.isVisible,
          preferredLocale: profilesTable.preferredLocale,
        })
        .from(profilesTable)
        .where(eq(profilesTable.uid, uid))
        .limit(1);
      const [updated] = await tx
        .update(userAccountsTable)
        .set({
          status: "pending_deletion",
          deletionRequestedAt: now,
          purgeAfter,
          deleteVenueProfile,
          wasProfileVisible: profile?.isVisible ?? false,
          firestoreSyncPending: true,
          purgeAttempts: 0,
          lastPurgeAttemptAt: null,
          purgeError: null,
          updatedAt: now,
        })
        .where(eq(userAccountsTable.accountId, accountId))
        .returning();
      if (!updated) throw new Error("Account deletion could not be scheduled.");
      const reminder = accountDeletionReminderCopy(
        purgeAfter,
        profile?.preferredLocale ?? undefined,
      );
      await tx
        .insert(notificationInboxTable)
        .values({
          uid,
          ...reminder,
          data: {
            type: ACCOUNT_DELETION_REMINDER_TYPE,
            deliveryStatus: "scheduled",
          },
          sourceKey: accountDeletionReminderSourceKey(updated),
          createdAt: new Date(
            purgeAfter.getTime() - ACCOUNT_DELETION_REMINDER_LEAD_MS,
          ),
        })
        .onConflictDoNothing({
          target: [notificationInboxTable.uid, notificationInboxTable.sourceKey],
        });
      await tx
        .update(profilesTable)
        .set({ isVisible: false, updatedAt: now })
        .where(eq(profilesTable.uid, uid));
      await tx
        .update(communityEventsTable)
        .set({ isHidden: true, hiddenByAccountDeletion: true, updatedAt: now })
        .where(
          and(
            eq(communityEventsTable.ownerUid, uid),
            eq(communityEventsTable.isHidden, false),
          ),
        );
      await tx.delete(presenceTable).where(eq(presenceTable.uid, uid));
      return updated;
    });

    const firestore = await mirrorAccountLifecycleToFirestore(
      uid,
      "pending_deletion",
      purgeAfter.toISOString(),
    );
    const syncPending = !firestore.ok;
    const [syncedAccount] = await sessionDb
      .update(userAccountsTable)
      .set({ firestoreSyncPending: syncPending, updatedAt: new Date() })
      .where(eq(userAccountsTable.accountId, accountId))
      .returning();
    if (syncPending) {
      logger.error(
        { uid, accountId, firestore: firestore.ok },
        "Account deletion started but privacy mirrors need retry",
      );
    }
    return syncedAccount ?? account;
  });
}

export async function restoreAccount(
  uid: string,
  accountId: string,
  now = new Date(),
): Promise<{ account: AccountRow; syncPending: boolean }> {
  const current = await getUserAccountById(accountId);
  if (!current || current.firebaseUid !== uid) {
    throw new Error("Account not found.");
  }
  if (current.status === "active") {
    return { account: current, syncPending: current.firestoreSyncPending };
  }
  if (
    current.status !== "pending_deletion" ||
    !current.purgeAfter ||
    current.purgeAfter <= now
  ) {
    throw new Error("The account recovery window has ended.");
  }

  const restored = await withProfilePrivacySessionLocks([uid], async (sessionDb) =>
    sessionDb.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`met-account-lifecycle:${accountId}`}, 0))`,
      );
      const [locked] = await tx
        .select()
        .from(userAccountsTable)
        .where(eq(userAccountsTable.accountId, accountId))
        .limit(1);
      if (
        !locked ||
        locked.firebaseUid !== uid ||
        locked.status !== "pending_deletion" ||
        !locked.purgeAfter ||
        locked.purgeAfter <= now
      ) {
        throw new Error("The account recovery window has ended.");
      }
      const [account] = await tx
        .update(userAccountsTable)
        .set({
          status: "active",
          deletionRequestedAt: null,
          purgeAfter: null,
          deleteVenueProfile: false,
          firestoreSyncPending: true,
          purgeError: null,
          updatedAt: now,
        })
        .where(eq(userAccountsTable.accountId, accountId))
        .returning();
      await tx
        .delete(notificationInboxTable)
        .where(
          and(
            eq(notificationInboxTable.uid, uid),
            eq(
              notificationInboxTable.sourceKey,
              accountDeletionReminderSourceKey(locked),
            ),
          ),
        );
      await tx
        .update(profilesTable)
        .set({
          isVisible: locked.wasProfileVisible,
          updatedAt: now,
        })
        .where(eq(profilesTable.uid, uid));
      await tx
        .update(communityEventsTable)
        .set({
          isHidden: false,
          hiddenByAccountDeletion: false,
          updatedAt: now,
        })
        .where(
          and(
            eq(communityEventsTable.ownerUid, uid),
            eq(communityEventsTable.hiddenByAccountDeletion, true),
          ),
        );
      if (!account) throw new Error("Account could not be restored.");
      return account;
    }),
  );

  const [profile] = await db
    .select({
      isVisible: profilesTable.isVisible,
      displayName: profilesTable.displayName,
      photoUrl: profilesTable.photoUrl,
    })
    .from(profilesTable)
    .where(eq(profilesTable.uid, uid))
    .limit(1);
  const profileMirror = await mirrorProfileToFirestore({
    uid,
    isVisible: profile?.isVisible ?? false,
    socialEligible: Boolean(profile?.displayName.trim() && profile?.photoUrl?.trim()),
    clearPresence: true,
  });
  const lifecycleMirror = await mirrorAccountLifecycleToFirestore(uid, "active", null);
  const syncPending = !profileMirror.ok || !lifecycleMirror.ok;
  const [account] = await db
    .update(userAccountsTable)
    .set({ firestoreSyncPending: syncPending, updatedAt: new Date() })
    .where(eq(userAccountsTable.accountId, accountId))
    .returning();
  if (syncPending) {
    logger.warn(
      { uid, accountId, profileMirror: profileMirror.ok, lifecycleMirror: lifecycleMirror.ok },
      "Restored account privacy mirrors need retry",
    );
  }
  return { account: account ?? restored, syncPending };
}

async function sendDueAccountDeletionReminder(
  reminder: ReminderRow,
  now: Date,
): Promise<void> {
  const sourceKey = reminder.sourceKey;
  if (!sourceKey) return;

  await withProfilePrivacySessionLocks(
    [reminder.uid],
    async (sessionDb) => {
      const delivery = await sessionDb.transaction(async (tx) => {
        const [accountBeforeLock] = await tx
          .select()
          .from(userAccountsTable)
          .where(eq(userAccountsTable.firebaseUid, reminder.uid))
          .limit(1);
        if (!accountBeforeLock) {
          await tx
            .delete(notificationInboxTable)
            .where(eq(notificationInboxTable.id, reminder.id));
          return null;
        }

        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${`met-account-lifecycle:${accountBeforeLock.accountId}`}, 0))`,
        );
        const [account] = await tx
          .select()
          .from(userAccountsTable)
          .where(eq(userAccountsTable.accountId, accountBeforeLock.accountId))
          .limit(1);
        const [currentReminder] = await tx
          .select()
          .from(notificationInboxTable)
          .where(
            and(
              eq(notificationInboxTable.id, reminder.id),
              eq(notificationInboxTable.uid, reminder.uid),
              eq(notificationInboxTable.sourceKey, sourceKey),
              sql`${notificationInboxTable.data}->>'deliveryStatus' = 'scheduled'`,
              lte(notificationInboxTable.createdAt, now),
            ),
          )
          .limit(1);
        if (!currentReminder) return null;

        if (
          !account ||
          account.firebaseUid !== reminder.uid ||
          account.status !== "pending_deletion" ||
          !account.purgeAfter ||
          account.purgeAfter <= now ||
          currentReminder.sourceKey !== accountDeletionReminderSourceKey(account)
        ) {
          await tx
            .delete(notificationInboxTable)
            .where(eq(notificationInboxTable.id, currentReminder.id));
          return null;
        }

        const [profile] = await tx
          .select({
            pushToken: profilesTable.pushToken,
            preferredLocale: profilesTable.preferredLocale,
          })
          .from(profilesTable)
          .where(eq(profilesTable.uid, reminder.uid))
          .limit(1);

        await tx
          .update(notificationInboxTable)
          .set({
            data: {
              ...currentReminder.data,
              deliveryStatus: "claimed",
            },
          })
          .where(eq(notificationInboxTable.id, currentReminder.id));
        const pushCopy = accountDeletionReminderPushCopy(
          profile?.preferredLocale ?? undefined,
        );
        return {
          notificationId: currentReminder.id,
          data: currentReminder.data,
          token: profile?.pushToken ?? null,
          preferredLocale: profile?.preferredLocale ?? undefined,
          purgeAfter: account.purgeAfter,
          payload: {
            ...pushCopy,
            data: { type: ACCOUNT_DELETION_REMINDER_TYPE },
          },
        };
      });
      if (!delivery) return;

      // Keep the profile lock through delivery so recovery cannot race the
      // send. The committed claim prevents duplicate notices if interrupted.
      let pushSent = false;
      if (delivery.token) {
        try {
          const pushResult = await sendPushWithStatus(
            delivery.token,
            delivery.payload,
            { persistInInbox: false },
          );
          pushSent = pushResult.sent;
        } catch (err) {
          logger.warn(
            { err, notificationId: delivery.notificationId },
            "Account deletion reminder push failed",
          );
        }
      }

      let emailSent = false;
      if (!pushSent) {
        try {
          const firebaseUser = await adminAuth().getUser(reminder.uid);
          if (firebaseUser.emailVerified && firebaseUser.email) {
            const email = accountDeletionReminderEmail(
              delivery.purgeAfter,
              delivery.preferredLocale,
            );
            await sendGmailHtmlEmail({
              to: firebaseUser.email,
              ...email,
            });
            emailSent = true;
          }
        } catch (err) {
          logger.warn(
            { err, notificationId: delivery.notificationId },
            "Account deletion reminder email could not be sent",
          );
        }
      }

      await sessionDb
        .update(notificationInboxTable)
        .set({
          data: {
            ...delivery.data,
            deliveryStatus: pushSent || emailSent ? "sent" : "attempted",
            deliveryChannel: pushSent ? "push" : emailSent ? "email" : "none",
          },
        })
        .where(eq(notificationInboxTable.id, delivery.notificationId));
    },
  );
}

export async function runAccountDeletionReminderSweep(
  now = new Date(),
): Promise<void> {
  const dueReminders = await db
    .select()
    .from(notificationInboxTable)
    .where(
      and(
        sql`${notificationInboxTable.data}->>'type' = ${ACCOUNT_DELETION_REMINDER_TYPE}`,
        sql`${notificationInboxTable.data}->>'deliveryStatus' = 'scheduled'`,
        lte(notificationInboxTable.createdAt, now),
      ),
    )
    .orderBy(notificationInboxTable.createdAt, notificationInboxTable.id)
    .limit(ACCOUNT_REMINDER_BATCH_SIZE);

  for (const reminder of dueReminders) {
    try {
      await sendDueAccountDeletionReminder(reminder, now);
    } catch (err) {
      logger.error(
        { err, notificationId: reminder.id, uid: reminder.uid },
        "Account deletion reminder could not be processed",
      );
    }
  }
}

async function retryPendingFirestoreMirrors(now: Date): Promise<void> {
  const accounts = await db
    .select()
    .from(userAccountsTable)
    .where(eq(userAccountsTable.firestoreSyncPending, true))
    .limit(FIRESTORE_SYNC_BATCH_SIZE);

  for (const account of accounts) {
    if (!account.firebaseUid || account.status === "purged") continue;
    const purgeAfter = account.purgeAfter?.toISOString() ?? null;
    const lifecycle = await mirrorAccountLifecycleToFirestore(
      account.firebaseUid,
      account.status === "purge_failed" ? "purge_failed" : account.status,
      purgeAfter,
    );
    let profileOk = true;
    if (lifecycle.ok && account.status === "active") {
      const [profile] = await db
        .select({
          isVisible: profilesTable.isVisible,
          displayName: profilesTable.displayName,
          photoUrl: profilesTable.photoUrl,
        })
        .from(profilesTable)
        .where(eq(profilesTable.uid, account.firebaseUid))
        .limit(1);
      const mirror = await mirrorProfileToFirestore({
        uid: account.firebaseUid,
        isVisible: profile?.isVisible ?? false,
        socialEligible: Boolean(profile?.displayName.trim() && profile?.photoUrl?.trim()),
        clearPresence: true,
      });
      profileOk = mirror.ok;
    }
    if (lifecycle.ok && profileOk) {
      await db
        .update(userAccountsTable)
        .set({ firestoreSyncPending: false, updatedAt: now })
        .where(eq(userAccountsTable.accountId, account.accountId));
    }
  }
}

async function claimExpiredAccount(accountId: string, now: Date): Promise<AccountRow | null> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`met-account-lifecycle:${accountId}`}, 0))`,
    );
    const [account] = await tx
      .select()
      .from(userAccountsTable)
      .where(eq(userAccountsTable.accountId, accountId))
      .limit(1);
    if (
      !account ||
      !account.firebaseUid ||
      account.firestoreSyncPending ||
      !account.purgeAfter ||
      account.purgeAfter > now ||
      !["pending_deletion", "purge_failed"].includes(account.status)
    ) {
      return null;
    }
    const [claimed] = await tx
      .update(userAccountsTable)
      .set({
        status: "purging",
        purgeAttempts: account.purgeAttempts + 1,
        lastPurgeAttemptAt: now,
        purgeError: null,
        updatedAt: now,
      })
      .where(eq(userAccountsTable.accountId, accountId))
      .returning();
    return claimed ?? null;
  });
}

async function purgeAccount(account: AccountRow, now: Date): Promise<void> {
  const uid = account.firebaseUid;
  if (!uid) throw new Error("Account has no Firebase identity to purge.");

  const lifecycle = await mirrorAccountLifecycleToFirestore(uid, "purging", null);
  if (!lifecycle.ok) {
    throw new Error("Could not apply the final access block in Firestore.");
  }

  if (account.deleteVenueProfile) {
    const [ownerProfile] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);
    if (ownerProfile) {
      await db.transaction(async (tx) => {
        const venueFileUrls = await deleteVenueOwnerProfile(tx, ownerProfile);
        await deleteVenueStorageFiles(
          venueFileUrls,
          { uid },
          { requireComplete: true },
        );
      });
    }
  }

  await deleteUserData(uid, {
    accountId: account.accountId,
    strictCleanup: true,
  });
  await db
    .update(userAccountsTable)
    .set({
      firebaseUid: null,
      status: "purged",
      deletionRequestedAt: null,
      purgeAfter: null,
      deleteVenueProfile: false,
      wasProfileVisible: false,
      firestoreSyncPending: false,
      purgeError: null,
      purgedAt: now,
      updatedAt: now,
    })
    .where(eq(userAccountsTable.accountId, account.accountId));
  logger.info(
    { accountId: account.accountId, deletedVenueProfile: account.deleteVenueProfile },
    "Account recovery window expired and account data was purged",
  );
}

export async function runAccountDeletionSweep(now = new Date()): Promise<void> {
  await runAccountDeletionReminderSweep(now);
  await retryPendingFirestoreMirrors(now);
  const due = await db
    .select({ accountId: userAccountsTable.accountId })
    .from(userAccountsTable)
    .where(
      and(
        inArray(userAccountsTable.status, ["pending_deletion", "purge_failed"]),
        lte(userAccountsTable.purgeAfter, now),
        eq(userAccountsTable.firestoreSyncPending, false),
      ),
    )
    .limit(ACCOUNT_CLEANUP_BATCH_SIZE);

  for (const row of due) {
    const account = await claimExpiredAccount(row.accountId, now);
    if (!account) continue;
    try {
      await purgeAccount(account, now);
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      await db
        .update(userAccountsTable)
        .set({
          status: "purge_failed",
          firestoreSyncPending: message.includes("Firestore"),
          purgeError: message.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(userAccountsTable.accountId, account.accountId));
      logger.error(
        { accountId: account.accountId, uid: account.firebaseUid, err },
        "Account purge failed and will be retried",
      );
    }
  }
}
