import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  venues: [{ placeId: "real-venue", businessName: "Real Café", name: "Real Café" }],
  select: vi.fn(),
  fail: false,
  writes: [] as string[],
}));
vi.mock("@workspace/db", async (original) => ({
  ...await original<typeof import("@workspace/db")>(),
  db: { select: mocks.select },
}));
vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../lib/firebaseAdmin", () => {
  function collection(path: string): unknown {
    return {
      doc: (id: string) => ({
        path: `${path}/${id}`,
        collection: (name: string) => collection(`${path}/${id}/${name}`),
        delete: async () => { mocks.writes.push(`${path}/${id}`); mocks.records.delete(`${path}/${id}`); },
      }),
      get: async () => {
        if (mocks.fail) throw new Error("Storage unavailable");
        return {
          docs: [...mocks.records.entries()]
            .filter(([key]) => key.startsWith(`${path}/`))
            .map(([key, data]) => ({ id: key.split("/").pop(), data: () => data })),
        };
      },
    };
  }
  return {
    adminAuth: () => ({
      verifyIdToken: async (token: string) => {
        if (!["account-a", "account-b"].includes(token)) throw new Error("Invalid token");
        return { uid: token };
      },
    }),
    adminDb: () => ({
      collection,
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
        get: async (ref: { path: string }) => ({
          exists: mocks.records.has(ref.path), data: () => mocks.records.get(ref.path),
        }),
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          mocks.writes.push(ref.path);
          mocks.records.set(ref.path, data);
        },
      }),
    }),
  };
});

import router from "./savedPlaces";
const makeApp = () => {
  const app = express().use(express.json()).use("/api", router);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
};
const auth = (uid = "account-a") => ({ Authorization: `Bearer ${uid}` });
const base = "/api/saved-places";

beforeEach(() => {
  mocks.records.clear();
  mocks.writes.length = 0;
  mocks.venues = [{ placeId: "real-venue", businessName: "Real Café", name: "Real Café" }];
  mocks.fail = false;
  mocks.select.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: async () => mocks.venues,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.venues).then(resolve),
      }),
    }),
  }));
});

describe("authenticated saved places", () => {
  it("rejects missing or invalid authentication on every operation", async () => {
    const app = makeApp();
    for (const method of ["get", "put", "delete"] as const) {
      const url = method === "get" ? base : `${base}/real-venue`;
      expect((await request(app)[method](url)).status).toBe(401);
      expect((await request(app)[method](url).set({ ...auth("invalid"), "X-Met-Uid": "account-a" })).status).toBe(401);
    }
    expect(mocks.writes).toHaveLength(0);
  });

  it("persists real IDs across navigation/recreated requests and repeated saves", async () => {
    const first = await request(makeApp()).put(`${base}/real-venue`).set(auth()).send({ uid: "account-b", placeName: "Spoofed" });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ placeId: "real-venue", placeName: "Real Café", available: true });
    const again = await request(makeApp()).put(`${base}/real-venue`).set(auth());
    expect(again.body.savedAt).toBe(first.body.savedAt);
    const list = await request(makeApp()).get(base).set(auth());
    expect(list.body).toEqual([first.body]);
    expect(list.headers["cache-control"]).toBe("private, no-store");
    // The only persistent writes are bookmarks, never QR proofs or check-ins.
    expect(mocks.writes.every((p) => p === "savedPlaces/account-a/venues/real-venue")).toBe(true);
  });

  it("isolates reads and deletes per authenticated user, ignoring supplied UIDs", async () => {
    const app = makeApp();
    await request(app).put(`${base}/real-venue`).set(auth());
    expect((await request(app).get(`${base}?uid=account-a`).set(auth("account-b"))).body).toEqual([]);
    await request(app).delete(`${base}/real-venue`).set(auth("account-b")).send({ uid: "account-a" });
    expect((await request(app).get(base).set(auth())).body).toHaveLength(1);
    await request(app).put(`${base}/real-venue`).set(auth("account-b"));
    expect((await request(app).get(base).set(auth("account-b"))).body).toHaveLength(1);
    await request(app).delete(`${base}/real-venue`).set(auth());
    expect((await request(app).get(base).set(auth())).body).toEqual([]);
    expect((await request(app).get(base).set(auth("account-b"))).body).toHaveLength(1);
    expect((await request(app).delete(`${base}/real-venue`).set(auth())).status).toBe(204);
  });

  it("rejects unknown/unapproved venues and malformed IDs", async () => {
    const app = makeApp();
    mocks.venues = [];
    expect((await request(app).put(`${base}/made-up`).set(auth())).status).toBe(404);
    for (const id of ["bad%20id", "nested%2Fpath", ".".repeat(257)]) {
      expect((await request(app).put(`${base}/${id}`).set(auth())).status).toBe(400);
      expect((await request(app).delete(`${base}/${id}`).set(auth())).status).toBe(400);
    }
    expect(mocks.writes).toHaveLength(0);
  });

  it("retains unavailable bookmarks for removal and uses current public venue names", async () => {
    const app = makeApp();
    await request(app).put(`${base}/real-venue`).set(auth());
    mocks.venues[0]!.businessName = "Renamed Café";
    expect((await request(app).get(base).set(auth())).body[0].placeName).toBe("Renamed Café");
    mocks.venues = [];
    const list = await request(app).get(base).set(auth());
    expect(list.body[0]).toMatchObject({ available: false, placeName: "Real Café" });
    expect((await request(app).delete(`${base}/real-venue`).set(auth())).status).toBe(204);
  });

  it("reports storage failure rather than returning an empty list", async () => {
    mocks.fail = true;
    expect((await request(makeApp()).get(base).set(auth())).status).toBe(500);
  });
});
