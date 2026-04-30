import AsyncStorage from "@react-native-async-storage/async-storage";

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

export async function submitReport(input: {
  encounterId: string;
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
  return report;
}

export async function hasReported(encounterId: string): Promise<boolean> {
  const all = await loadReports();
  return all.some((r) => r.encounterId === encounterId);
}

export async function clearReports(): Promise<void> {
  await AsyncStorage.removeItem(REPORTS_KEY);
}
