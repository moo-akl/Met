import { Router } from "express";

const router = Router();

const MAX_ENTRIES = 300;
const logs: Array<{
  ts: number;
  step: string;
  build?: string;
  data?: unknown;
}> = [];

router.post("/debug/startup", (req, res) => {
  const { step, build, data } = (req.body ?? {}) as {
    step?: unknown;
    build?: unknown;
    data?: unknown;
  };
  const entry = {
    ts: Date.now(),
    step: String(step ?? "?"),
    build: build != null ? String(build) : undefined,
    data,
  };
  logs.push(entry);
  if (logs.length > MAX_ENTRIES) logs.splice(0, logs.length - MAX_ENTRIES);
  res.json({ ok: true });
});

router.get("/debug/startup", (_req, res) => {
  const rows = [...logs]
    .reverse()
    .map((l) => {
      const time = new Date(l.ts).toISOString().replace("T", " ").slice(0, 23);
      const step = l.step;
      const color =
        step.startsWith("CRASH") || step.startsWith("error")
          ? "color:#f66"
          : step.includes("done") || step.includes("mounted")
            ? "color:#6f6"
            : "color:#eee";
      return `<tr><td style="color:#888">${time}</td><td style="color:#fa0">${l.build ?? "-"}</td><td style="${color}">${step}</td><td style="color:#aaa;font-size:11px">${l.data ? JSON.stringify(l.data).slice(0, 300) : ""}</td></tr>`;
    })
    .join("\n");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Met Startup Logs</title>
  <meta http-equiv="refresh" content="4">
  <style>
    body { font-family: monospace; background: #0d0d0d; color: #eee; padding: 20px; margin: 0; }
    h1 { color: #4af; margin-bottom: 4px; }
    p { color: #888; margin: 0 0 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a1a1a; padding: 8px; text-align: left; color: #aaa; font-size: 12px; border-bottom: 2px solid #333; }
    td { padding: 5px 8px; border-bottom: 1px solid #1a1a1a; font-size: 13px; white-space: nowrap; }
    tr:hover td { background: #161616; }
    .clear { display: inline-block; margin-left: 16px; font-size: 13px; color: #888; cursor: pointer; text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Met Startup Logs
    <a class="clear" href="#" onclick="fetch('/api/debug/startup',{method:'DELETE'}).then(()=>location.reload());return false">clear</a>
  </h1>
  <p>${logs.length} entries &nbsp;|&nbsp; newest first &nbsp;|&nbsp; auto-refreshes every 4 s</p>
  <table>
    <thead><tr><th>Time (UTC)</th><th>Build</th><th>Step</th><th>Data</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="color:#666;padding:20px">No logs yet — launch the app on device</td></tr>'}</tbody>
  </table>
</body>
</html>`);
});

router.delete("/debug/startup", (_req, res) => {
  logs.splice(0, logs.length);
  res.json({ ok: true, cleared: true });
});

export default router;
