import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, referralCodesTable, referralRedemptionsTable } from "@workspace/db";
import {
  RegisterReferralCodeBody,
  RedeemReferralCodeBody,
  GetReferralStatsResponse,
} from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";
import { grantPlusEntitlementForReferral } from "../lib/revenueCat";

const router: IRouter = Router();

const CODE_RE = /^[A-Z2-9]{6}$/;
const REQUIRED_INVITES = 3;

router.post("/referrals/register", requireUid, async (req, res) => {
  const uid = req.uid!;
  const body = RegisterReferralCodeBody.parse(req.body);
  const code = body.code.trim().toUpperCase();

  if (!CODE_RE.test(code)) {
    res.status(400).json({ message: "Invalid code format" });
    return;
  }

  await db
    .insert(referralCodesTable)
    .values({ uid, code })
    .onConflictDoNothing({ target: referralCodesTable.uid });

  const [existing] = await db
    .select({ code: referralCodesTable.code })
    .from(referralCodesTable)
    .where(eq(referralCodesTable.uid, uid))
    .limit(1);

  const returnedCode = existing?.code ?? code;
  req.log.info(
    { sentCode: code, returnedCode, preserved: returnedCode !== code },
    "referral register",
  );
  res.json({ code: returnedCode });
});

router.post("/referrals/redeem", requireUid, async (req, res) => {
  const redeemerUid = req.uid!;
  const body = RedeemReferralCodeBody.parse(req.body);
  const code = body.code.trim().toUpperCase();

  if (!CODE_RE.test(code)) {
    res.json({ result: "invalid_format" });
    return;
  }

  const [owner] = await db
    .select()
    .from(referralCodesTable)
    .where(eq(referralCodesTable.code, code))
    .limit(1);

  if (!owner) {
    res.json({ result: "code_not_found" });
    return;
  }

  if (owner.uid === redeemerUid) {
    res.json({ result: "self_referral" });
    return;
  }

  try {
    await db.insert(referralRedemptionsTable).values({ redeemerUid, code });
  } catch (err: unknown) {
    // Drizzle wraps the pg error: check the message or the nested cause.
    const pgCode =
      err instanceof Error &&
      typeof (err as unknown as { cause?: { code?: string } }).cause?.code === "string"
        ? (err as unknown as { cause: { code: string } }).cause.code
        : null;
    const isUniqueViolation =
      pgCode === "23505" ||
      (err instanceof Error && err.message.includes("duplicate key"));
    if (isUniqueViolation) {
      res.json({ result: "already_used" });
      return;
    }
    throw err;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(referralRedemptionsTable)
    .where(eq(referralRedemptionsTable.code, code));

  if (count >= REQUIRED_INVITES && !owner.rewardGrantedAt) {
    try {
      const { expiresAt } = await grantPlusEntitlementForReferral(owner.uid);
      await db
        .update(referralCodesTable)
        .set({ rewardGrantedAt: new Date(), rewardExpiresAt: expiresAt })
        .where(eq(referralCodesTable.uid, owner.uid));
      req.log.info({ ownerUid: owner.uid, count }, "Referral reward granted");
    } catch (err) {
      req.log.error({ err, ownerUid: owner.uid }, "Failed to grant referral reward");
    }
  }

  res.json({ result: "accepted" });
});

router.get("/referrals/stats", requireUid, async (req, res) => {
  const uid = req.uid!;

  // Prevent HTTP caching so clients always see the current code.
  res.setHeader("Cache-Control", "no-store");

  const [row] = await db
    .select()
    .from(referralCodesTable)
    .where(eq(referralCodesTable.uid, uid))
    .limit(1);

  if (!row) {
    res.json(
      GetReferralStatsResponse.parse({
        code: null,
        count: 0,
        rewardActive: false,
        rewardExpiresAt: null,
      }),
    );
    return;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(referralRedemptionsTable)
    .where(eq(referralRedemptionsTable.code, row.code));

  const now = new Date();
  const rewardActive = !!(row.rewardExpiresAt && row.rewardExpiresAt > now);

  res.json(
    GetReferralStatsResponse.parse({
      code: row.code,
      count,
      rewardActive,
      rewardExpiresAt: row.rewardExpiresAt ? row.rewardExpiresAt.getTime() : null,
    }),
  );
});

export default router;
