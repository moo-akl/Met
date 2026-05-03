import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "@/lib/api/client";
import { isLegacyUserId } from "@/lib/auth";

const REPORTS_KEY = "met:reports:v1";

export type ReportReason =
  | "inappropriate"
  | "harassment"
  | "spam"
  | "underage"
  | "other";

export type Report = {
  id: string;
  encounterId: string;
  reason: ReportReason;
  reportedAt: number;
  revealMessage?: string;
};

async function loadReports(): Promise<Report[]> {
  const raw = await AsyncStorage.getItem(REPORTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveReports(reports: Report[]): Promise<void> {
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

/**
 * Persist a content / abuse report.
 *
 * Two-phase: (1) write a local copy so the user gets instant
 * confirmation even on an offline device; (2) best-effort POST to the
 * api-server which stores the report in Firestore where the moderation
 * team can action it within 24h. The server step is required by App
 * Store Review Guideline 1.2 — local-only reports were the cause of
 * the "no mechanism to act on reports" rejection note.
 */
export async function submitReport(input: {
  encounterId: string;
  reportedUid?: string | null;
  reporterUid?: string | null;
  reason: ReportReason;
  revealMessage?: string;
}): Promise<Report> {
  const report: Report = {
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    encounterId: input.encounterId,
    reason: input.reason,
    reportedAt: Date.now(),
    revealMessage: input.revealMessage,
  };
  const all = await loadReports();
  all.push(report);
  await saveReports(all);

  // Server mirror — gated on having a real Firebase uid for the
  // reporter so the api-server's `requireUid` middleware accepts the
  // call. Failures are swallowed: the local copy is the source of
  // truth for the user-facing "thanks for reporting" confirmation.
  if (input.reporterUid && !isLegacyUserId(input.reporterUid)) {
    try {
      await api.submitReport(
        { uid: input.reporterUid },
        {
          encounterId: input.encounterId,
          reportedUid: input.reportedUid ?? null,
          reason: input.reason,
          revealMessage: input.revealMessage ?? null,
        },
      );
    } catch (err) {
      console.warn("[reports] failed to mirror report to server", err);
    }
  }

  return report;
}

export async function hasReported(encounterId: string): Promise<boolean> {
  const all = await loadReports();
  return all.some((r) => r.encounterId === encounterId);
}

export async function clearReports(): Promise<void> {
  await AsyncStorage.removeItem(REPORTS_KEY);
}
