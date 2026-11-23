import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  notificationInboxTable,
  profilesTable,
  userAccountsTable,
} from "@workspace/db";

const pushMock = vi.hoisted(() => ({
  send: vi.fn(),
}));
const authMock = vi.hoisted(() => ({
  getUser: vi.fn(),
}));
const gmailMock = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("./push", () => ({
  sendPushWithStatus: pushMock.send,
}));

vi.mock("./firebaseAdmin", () => ({
  adminAuth: () => ({ getUser: authMock.getUser }),
}));

vi.mock("./gmail", () => ({
  sendGmailHtmlEmail: gmailMock.send,
}));

vi.mock("./firestoreMirror", () => ({
  mirrorAccountLifecycleToFirestore: vi.fn().mockResolvedValue({ ok: true }),
  mirrorProfileToFirestore: vi.fn().mockResolvedValue({ ok: true }),
}));

import {
  restoreAccount,
  runAccountDeletionReminderSweep,
  startAccountDeletion,
} from "./accountDeletion";

const hasDatabase = Boolean(process.env["DATABASE_URL"]);
const prefix = `itest-account-deletion-reminder-${process.pid}-${Date.now()}`;
const uid = `${prefix}-uid`;
const accountId = `${prefix}-account`;
const requestedAt = new Date("2026-01-01T12:00:00.000Z");
const REMINDER_EMAIL_LOCALES = [
  { locale: "en", signInPhrase: "Sign in to Met" },
  { locale: "es", signInPhrase: "Inicia sesión en Met" },
  { locale: "fr", signInPhrase: "Connectez-vous à Met" },
  { locale: "nl", signInPhrase: "Log vóór die datum" },
  { locale: "pt", signInPhrase: "Entre no Met" },
  { locale: "ru", signInPhrase: "Войдите в Met" },
  { locale: "vi", signInPhrase: "đăng nhập Met" },
  { locale: "zh", signInPhrase: "使用同一账户登录 Met" },
  { locale: "ar", signInPhrase: "سجّل الدخول إلى Met" },
] as const;

async function cleanup() {
  await db
    .delete(notificationInboxTable)
    .where(eq(notificationInboxTable.uid, uid));
  await db
    .delete(userAccountsTable)
    .where(eq(userAccountsTable.accountId, accountId));
  await db.delete(profilesTable).where(eq(profilesTable.uid, uid));
}

async function seedAccount(
  pushToken: string | null = null,
  preferredLocale?: string,
) {
  await db.insert(profilesTable).values({
    uid,
    displayName: "Reminder test",
    pushToken,
    preferredLocale,
  });
  await db.insert(userAccountsTable).values({
    accountId,
    firebaseUid: uid,
    status: "active",
  });
}

describe.skipIf(!hasDatabase)("account deletion reminders", () => {
  beforeEach(async () => {
    await cleanup();
    pushMock.send.mockReset().mockResolvedValue({ sent: true });
    authMock.getUser.mockReset().mockResolvedValue({
      email: null,
      emailVerified: false,
    });
    gmailMock.send.mockReset().mockResolvedValue({
      rfcMessageId: null,
      gmailThreadId: null,
    });
  });

  afterAll(cleanup);

  it("schedules a hidden inbox reminder and recovery removes it before it is due", async () => {
    await seedAccount();
    await startAccountDeletion(uid, accountId, false, requestedAt);

    const [reminder] = await db
      .select()
      .from(notificationInboxTable)
      .where(eq(notificationInboxTable.uid, uid));
    expect(reminder?.createdAt.toISOString()).toBe("2026-01-24T12:00:00.000Z");
    expect(reminder?.data).toMatchObject({
      type: "account_deletion_reminder",
      deliveryStatus: "scheduled",
    });
    expect(reminder?.title).toContain("removal reminder");
    expect(reminder?.body).toContain("January 31, 2026");
    expect(`${reminder?.title} ${reminder?.body} ${JSON.stringify(reminder?.data)}`)
      .not.toContain(uid);
    expect(`${reminder?.title} ${reminder?.body} ${JSON.stringify(reminder?.data)}`)
      .not.toContain(accountId);

    await db
      .update(notificationInboxTable)
      .set({
        data: {
          type: "account_deletion_reminder",
          deliveryStatus: "claimed",
        },
      })
      .where(eq(notificationInboxTable.id, reminder!.id));
    await restoreAccount(uid, accountId, new Date("2026-01-10T12:00:00.000Z"));
    const remaining = await db
      .select()
      .from(notificationInboxTable)
      .where(eq(notificationInboxTable.uid, uid));
    expect(remaining).toHaveLength(0);
    expect(pushMock.send).not.toHaveBeenCalled();
  });

  it("sends one reminder with the purge date and safe recovery path across sweep retries", async () => {
    await seedAccount("ExponentPushToken[account-deletion-test]");
    await startAccountDeletion(uid, accountId, false, requestedAt);
    const reminderTime = new Date("2026-01-25T12:00:00.000Z");

    await runAccountDeletionReminderSweep(reminderTime);
    await runAccountDeletionReminderSweep(reminderTime);

    expect(pushMock.send).toHaveBeenCalledTimes(1);
    const [token, payload, options] = pushMock.send.mock.calls[0] as [
      string,
      { title: string; body: string; data: Record<string, string> },
      { persistInInbox: boolean },
    ];
    expect(token).toBe("ExponentPushToken[account-deletion-test]");
    expect(payload.body).toContain("Sign in to Met with the same account");
    expect(payload.body).not.toContain("January 31, 2026");
    expect(payload.body).not.toContain("permanent removal");
    expect(payload.data).toEqual({ type: "account_deletion_reminder" });
    expect(options).toEqual({ persistInInbox: false });
    expect(JSON.stringify(payload)).not.toContain(uid);
    expect(JSON.stringify(payload)).not.toContain(accountId);
    expect(authMock.getUser).not.toHaveBeenCalled();
    expect(gmailMock.send).not.toHaveBeenCalled();

    const [reminder] = await db
      .select()
      .from(notificationInboxTable)
      .where(eq(notificationInboxTable.uid, uid));
    expect(reminder).toBeDefined();
    expect(reminder?.body).toContain("January 31, 2026");
    expect(reminder?.data.deliveryStatus).toBe("sent");
    await restoreAccount(uid, accountId, reminderTime);
    expect(
      await db
        .select()
        .from(notificationInboxTable)
        .where(eq(notificationInboxTable.uid, uid)),
    ).toHaveLength(0);
  });

  it.each([
    ["no push token", null, { sent: false }],
    ["failed push", "ExponentPushToken[account-deletion-test]", { sent: false }],
  ])("emails a verified member when push is unavailable or fails (%s)", async (
    _scenario,
    pushToken,
    pushResult,
  ) => {
    await seedAccount(pushToken);
    await startAccountDeletion(uid, accountId, false, requestedAt);
    authMock.getUser.mockResolvedValue({
      email: "verified-member@example.test",
      emailVerified: true,
    });
    pushMock.send.mockResolvedValue(pushResult);
    const reminderTime = new Date("2026-01-25T12:00:00.000Z");

    await runAccountDeletionReminderSweep(reminderTime);
    await runAccountDeletionReminderSweep(reminderTime);

    if (pushToken) expect(pushMock.send).toHaveBeenCalledTimes(1);
    else expect(pushMock.send).not.toHaveBeenCalled();
    expect(authMock.getUser).toHaveBeenCalledTimes(1);
    expect(authMock.getUser).toHaveBeenCalledWith(uid);
    expect(gmailMock.send).toHaveBeenCalledTimes(1);
    expect(gmailMock.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "verified-member@example.test",
      subject: expect.stringContaining("reminder"),
      text: expect.stringContaining("January 31, 2026"),
    }));
    const email = gmailMock.send.mock.calls[0]![0] as {
      html: string;
      text: string;
    };
    expect(email.html).toContain("January 31, 2026");
    expect(email.html).toContain('href="met://"');
    expect(email.text).toContain("met://");
    expect(email.text).toContain("Sign in to Met with the same account");
    expect(`${email.html}\n${email.text}`).not.toContain(uid);
    expect(`${email.html}\n${email.text}`).not.toContain(accountId);

    const [reminder] = await db
      .select()
      .from(notificationInboxTable)
      .where(eq(notificationInboxTable.uid, uid));
    expect(reminder?.data).toMatchObject({
      deliveryStatus: "sent",
      deliveryChannel: "email",
    });
  });

  it("never emails an unverified address and does not retry the reminder", async () => {
    await seedAccount();
    await startAccountDeletion(uid, accountId, false, requestedAt);
    authMock.getUser.mockResolvedValue({
      email: "unverified-member@example.test",
      emailVerified: false,
    });
    const reminderTime = new Date("2026-01-25T12:00:00.000Z");

    await runAccountDeletionReminderSweep(reminderTime);
    await runAccountDeletionReminderSweep(reminderTime);

    expect(authMock.getUser).toHaveBeenCalledTimes(1);
    expect(gmailMock.send).not.toHaveBeenCalled();
    const [reminder] = await db
      .select()
      .from(notificationInboxTable)
      .where(eq(notificationInboxTable.uid, uid));
    expect(reminder?.data).toMatchObject({
      deliveryStatus: "attempted",
      deliveryChannel: "none",
    });
  });

  it("does not retry an email after an uncertain Gmail send result", async () => {
    await seedAccount();
    await startAccountDeletion(uid, accountId, false, requestedAt);
    authMock.getUser.mockResolvedValue({
      email: "verified-member@example.test",
      emailVerified: true,
    });
    gmailMock.send.mockRejectedValue(new Error("Gmail response lost"));
    const reminderTime = new Date("2026-01-25T12:00:00.000Z");

    await runAccountDeletionReminderSweep(reminderTime);
    await runAccountDeletionReminderSweep(reminderTime);

    expect(gmailMock.send).toHaveBeenCalledTimes(1);
    const [reminder] = await db
      .select()
      .from(notificationInboxTable)
      .where(eq(notificationInboxTable.uid, uid));
    expect(reminder?.data).toMatchObject({
      deliveryStatus: "attempted",
      deliveryChannel: "none",
    });
  });

  it.each(REMINDER_EMAIL_LOCALES)(
    "includes the purge date and recovery path in the $locale email",
    async ({ locale, signInPhrase }) => {
      await seedAccount(null, locale);
      await startAccountDeletion(uid, accountId, false, requestedAt);
      authMock.getUser.mockResolvedValue({
        email: "verified-member@example.test",
        emailVerified: true,
      });

      await runAccountDeletionReminderSweep(new Date("2026-01-25T12:00:00.000Z"));

      expect(gmailMock.send).toHaveBeenCalledTimes(1);
      const email = gmailMock.send.mock.calls[0]![0] as {
        subject: string;
        html: string;
        text: string;
      };
      const purgeDate = new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date("2026-01-31T12:00:00.000Z"));

      expect(email.subject).toContain("Met");
      expect(email.html).toContain(purgeDate);
      expect(email.text).toContain(purgeDate);
      expect(email.html).toContain(signInPhrase);
      expect(email.text).toContain(signInPhrase);
      expect(email.html).toContain('href="met://"');
      expect(email.text).toContain("met://");
      expect(email.html).toContain("apps.apple.com");
      expect(email.html).toContain("play.google.com");
      expect(`${email.html}\n${email.text}`).not.toContain(uid);
      expect(`${email.html}\n${email.text}`).not.toContain(accountId);
    },
  );

  it("escapes an unsupported locale before placing it in email markup", async () => {
    const unsupportedLocale = 'en"><img src=x onerror=alert(1)>';
    await seedAccount(null, unsupportedLocale);
    await startAccountDeletion(uid, accountId, false, requestedAt);
    authMock.getUser.mockResolvedValue({
      email: "verified-member@example.test",
      emailVerified: true,
    });

    await runAccountDeletionReminderSweep(new Date("2026-01-25T12:00:00.000Z"));

    const email = gmailMock.send.mock.calls[0]![0] as { html: string; text: string };
    expect(email.html).toContain(
      'lang="en&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"',
    );
    expect(email.html).not.toContain("<img src=x");
    expect(email.text).toContain("Sign in to Met with the same account");
  });
});
