import { useEffect, useRef, useState, type ComponentType } from "react";

import { modules as discoveredModules } from "./.generated/mockup-components";

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

function _resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const fns = Object.values(mod).filter(
    (v) => typeof v === "function",
  ) as ComponentType[];
  return (
    (mod.default as ComponentType) ||
    (mod.Preview as ComponentType) ||
    (mod[name] as ComponentType) ||
    fns[fns.length - 1]
  );
}

async function downloadAsPng(
  element: HTMLElement,
  filename: string,
  scale: number = 3,
): Promise<void> {
  const { toPng } = await import(
    /* @vite-ignore */
    "https://esm.sh/html-to-image@1.11.13"
  ) as { toPng: (el: HTMLElement, opts: Record<string, unknown>) => Promise<string> };

  const dataUrl = await toPng(element, {
    pixelRatio: scale,
    cacheBust: true,
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function DownloadButton({ targetRef, filename }: { targetRef: React.RefObject<HTMLDivElement | null>; filename: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  async function handleDownload() {
    if (!targetRef.current) return;
    setStatus("loading");
    try {
      await downloadAsPng(targetRef.current, `${filename}.png`);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      console.error("Export failed", e);
      setStatus("idle");
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={status === "loading"}
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        background: status === "done" ? "#16a34a" : "#111827",
        color: "#fff",
        border: "none",
        borderRadius: "999px",
        padding: "10px 20px",
        fontSize: "13px",
        fontWeight: 600,
        fontFamily: "system-ui, sans-serif",
        cursor: status === "loading" ? "wait" : "pointer",
        boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
        opacity: status === "loading" ? 0.7 : 1,
        transition: "all 0.2s",
      }}
    >
      {status === "loading" ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Exporting…
        </>
      ) : status === "done" ? (
        <>✓ Saved!</>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PNG (3×)
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}

function PreviewRenderer({
  componentPath,
  modules,
}: {
  componentPath: string;
  modules: ModuleMap;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filename = componentPath.split("/").pop() ?? "ad-export";

  useEffect(() => {
    let cancelled = false;

    setComponent(null);
    setError(null);

    async function loadComponent(): Promise<void> {
      const key = `./components/mockups/${componentPath}.tsx`;
      const loader = modules[key];
      if (!loader) {
        setError(`No component found at ${componentPath}.tsx`);
        return;
      }

      try {
        const mod = await loader();
        if (cancelled) {
          return;
        }
        const name = componentPath.split("/").pop()!;
        const comp = _resolveComponent(mod, name);
        if (!comp) {
          setError(
            `No exported React component found in ${componentPath}.tsx\n\nMake sure the file has at least one exported function component.`,
          );
          return;
        }
        setComponent(() => comp);
      } catch (e) {
        if (cancelled) {
          return;
        }

        const message = e instanceof Error ? e.message : String(e);
        setError(`Failed to load preview.\n${message}`);
      }
    }

    void loadComponent();

    return () => {
      cancelled = true;
    };
  }, [componentPath, modules]);

  if (error) {
    return (
      <pre style={{ color: "red", padding: "2rem", fontFamily: "system-ui" }}>
        {error}
      </pre>
    );
  }

  if (!Component) return null;

  return (
    <>
      <div ref={containerRef} style={{ display: "inline-block" }}>
        <Component />
      </div>
      <DownloadButton targetRef={containerRef} filename={filename} />
    </>
  );
}

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function getPreviewExamplePath(): string {
  const basePath = getBasePath();
  return `${basePath}/preview/ComponentName`;
}

function Gallery() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Component Preview Server
        </h1>
        <p className="text-gray-500 mb-4">
          This server renders individual components for the workspace canvas.
        </p>
        <p className="text-sm text-gray-400">
          Access component previews at{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            {getPreviewExamplePath()}
          </code>
        </p>
      </div>
    </div>
  );
}

function getPreviewPath(): string | null {
  const basePath = getBasePath();
  const { pathname } = window.location;
  const local =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  const match = local.match(/^\/preview\/(.+)$/);
  return match ? match[1] : null;
}

function getScreenshotPath(): string | null {
  const basePath = getBasePath();
  const { pathname } = window.location;
  const local =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  const match = local.match(/^\/screenshot\/(.+)$/);
  return match ? match[1] : null;
}

// 390×844 is the design canvas size; 1242/390 = 3.1846… fills exactly 1242×2688
const SCALE = 1242 / 390;
const DESIGN_W = 390;
const DESIGN_H = 844;

/**
 * FrameRenderer — renders the component directly with no outer wrapper.
 * This is served inside an iframe so that 100vh = DESIGN_H (844px).
 */
function FrameRenderer({
  componentPath,
  modules,
}: {
  componentPath: string;
  modules: ModuleMap;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const key = `./components/mockups/${componentPath}.tsx`;
      const loader = modules[key];
      if (!loader) { setError(`No component at ${componentPath}.tsx`); return; }
      try {
        const mod = await loader();
        if (cancelled) return;
        const name = componentPath.split("/").pop()!;
        const comp = _resolveComponent(mod, name);
        if (!comp) { setError(`No exported component in ${componentPath}.tsx`); return; }
        setComponent(() => comp);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [componentPath, modules]);

  if (error) return <pre style={{ color: "red" }}>{error}</pre>;
  if (!Component) return null;
  return <Component />;
}

/**
 * ScreenshotRenderer — renders the component inside an iframe that has its own
 * 390×844 viewport (so min-h-screen = 844px), then scales the iframe up to
 * 1242×2688 using CSS transform.
 */
function ScreenshotRenderer({ componentPath }: { componentPath: string }) {
  const basePath = getBasePath();
  // Route through /preview/screenshot-frame/ so the proxy can reach it
  const src = `${basePath}/preview/screenshot-frame/${componentPath}`;

  return (
    <div style={{
      width: DESIGN_W * SCALE,
      height: DESIGN_H * SCALE,
      overflow: "hidden",
      position: "relative",
      margin: 0,
      padding: 0,
      background: "#fff",
    }}>
      <iframe
        src={src}
        width={DESIGN_W}
        height={DESIGN_H}
        scrolling="no"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          border: "none",
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
          display: "block",
        }}
      />
    </div>
  );
}

function App() {
  const previewPath = getPreviewPath();

  if (previewPath) {
    // /preview/screenshot/ads/ChatAd → scaled screenshot capture
    if (previewPath.startsWith("screenshot/")) {
      return <ScreenshotRenderer componentPath={previewPath.slice("screenshot/".length)} />;
    }
    // /preview/screenshot-frame/ads/ChatAd → bare component for iframe
    if (previewPath.startsWith("screenshot-frame/")) {
      return (
        <FrameRenderer
          componentPath={previewPath.slice("screenshot-frame/".length)}
          modules={discoveredModules}
        />
      );
    }
    return (
      <PreviewRenderer
        componentPath={previewPath}
        modules={discoveredModules}
      />
    );
  }

  const screenshotPath = getScreenshotPath();
  if (screenshotPath) {
    return <ScreenshotRenderer componentPath={screenshotPath} />;
  }

  return <Gallery />;
}

export default App;
