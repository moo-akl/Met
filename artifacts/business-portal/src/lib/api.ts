import { auth } from "./firebase";

async function getToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => apiFetch<T>(url),
  post: <T>(url: string, data?: unknown) =>
    apiFetch<T>(url, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(url: string, data?: unknown) =>
    apiFetch<T>(url, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(url: string) => apiFetch<T>(url, { method: "DELETE" }),
};

export type BusinessProfile = {
  businessId: string;
  ownerId: string;
  placeId: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  mediaUrls: string[];
  salesAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  events?: BusinessEvent[];
};

export type BusinessEvent = {
  eventId: number;
  businessId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  createdAt: string;
};

export type BusinessReview = {
  reviewId: number;
  businessId: string;
  reviewerId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type LeaderboardEntry = {
  rank: number;
  uid: string;
  displayName: string;
  photoUrl: string | null;
  checkinCount: number;
};

export type AdminBusiness = BusinessProfile & { ownerDisplayName: string | null };

export type AdminGroup = {
  salesAgentId: string | null;
  businesses: AdminBusiness[];
};
