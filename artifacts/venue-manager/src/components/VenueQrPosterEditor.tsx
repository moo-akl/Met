import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import QRCode from "react-qr-code";
import { ArrowDown, ArrowUp, Check, ImagePlus, RotateCcw, Save, Upload, X } from "lucide-react";
import "./VenueQrPosterEditor.css";

export type VenueQrPosterDesign = {
  heading: string;
  subheading: string;
  footer: string;
  fontFamily: "sans" | "serif";
  titleFontSize: number;
  bodyFontSize: number;
  textColor: string;
  accentColor: string;
  backgroundColor: string;
  qrForegroundColor: string;
  logoUrl: string | null;
  imageUrl: string | null;
  decorativeImages?: PosterDecorativeImage[];
  imagePositions?: Partial<Record<"logo" | "decoration", PosterImagePosition>>;
  textPositions?: Partial<Record<PosterLayerId, PosterLayerPosition>>;
  textContent?: Partial<Record<PosterLayerId, string>>;
  textBoxes?: PosterTextBox[];
};

export type PosterTextBox = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  width?: number;
};
type PosterLayerId = "brandMark" | "brandLabel" | "kicker" | "venueName" | "heading" | "subheading" | "scanNote" | "footer";
type PosterLayerPosition = { x: number; y: number; fontSize?: number; width?: number };
type PosterImagePosition = { x: number; y: number; width: number; height: number };
type PosterDecorativeImage = { id: string; url: string; position: PosterImagePosition };
type ImageLayerId = string;
type PosterImageResize = {
  id: ImageLayerId;
  pointerId: number;
  rect: DOMRect;
  startX: number;
  startY: number;
  renderWidth: number;
  renderHeight: number;
  position: PosterImagePosition;
};

export type VenueQrPosterEditorProps = {
  businessName: string;
  qrUrl: string;
  design: VenueQrPosterDesign;
  onSave: (next: VenueQrPosterDesign) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onDiscardImage: (url: string, keepalive?: boolean) => Promise<void>;
  onExport: (format: "jpg" | "png" | "pdf" | "print", posterElement: HTMLElement) => Promise<void>;
};

const presets: { name: string; values: Partial<VenueQrPosterDesign> }[] = [
  { name: "Garden", values: { fontFamily: "serif", textColor: "#183c2f", accentColor: "#26735a", backgroundColor: "#f8f7ef", qrForegroundColor: "#183c2f" } },
  { name: "Studio", values: { fontFamily: "sans", textColor: "#253b35", accentColor: "#b46b43", backgroundColor: "#f5eee3", qrForegroundColor: "#183c2f" } },
  { name: "After hours", values: { fontFamily: "sans", textColor: "#f5f2e8", accentColor: "#a9cfad", backgroundColor: "#1e3a31", qrForegroundColor: "#183c2f" } },
];

const cloneDesign = (design: VenueQrPosterDesign): VenueQrPosterDesign => ({
  ...design,
  decorativeImages: design.decorativeImages?.map((image) => ({ ...image, position: { ...image.position } })),
  imagePositions: design.imagePositions ? Object.fromEntries(
    Object.entries(design.imagePositions).map(([key, position]) => [key, position ? { ...position } : position]),
  ) as VenueQrPosterDesign["imagePositions"] : undefined,
});
const hexColor = /^#[0-9a-fA-F]{6}$/;
function rgbChannels(hex: string) {
  return hex.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16)).join(", ") ?? "38, 115, 90";
}
const defaultTextPositions: Record<PosterLayerId, PosterLayerPosition> = {
  brandMark: { x: 43, y: 7 },
  brandLabel: { x: 57.5, y: 7 },
  kicker: { x: 50, y: 19 },
  venueName: { x: 50, y: 27 },
  heading: { x: 50, y: 36 },
  subheading: { x: 50, y: 44 },
  scanNote: { x: 50, y: 91 },
  footer: { x: 50, y: 95 },
};
const defaultTextContent: Record<PosterLayerId, string> = {
  brandMark: "m", brandLabel: "MET COMMUNITY", kicker: "WELCOME TO", venueName: "",
  heading: "", subheading: "", scanNote: "Scan to check in with Met", footer: "",
};
const defaultImagePositions: Record<ImageLayerId, PosterImagePosition> = {
  logo: { x: 43, y: 7, width: 25, height: 6 },
  decoration: { x: 10.5, y: 74, width: 15, height: 18 },
};
const imageQuietZone = { left: 20, right: 80, top: 50, bottom: 90 };

function intersectsImageQuietZone(position: PosterImagePosition) {
  return position.x - position.width / 2 < imageQuietZone.right &&
    position.x + position.width / 2 > imageQuietZone.left &&
    position.y - position.height / 2 < imageQuietZone.bottom &&
    position.y + position.height / 2 > imageQuietZone.top;
}

function safeImagePosition(
  candidate: PosterImagePosition,
  fallback: PosterImagePosition,
): PosterImagePosition {
  const width = Math.max(5, Math.min(80, candidate.width));
  const height = Math.max(5, Math.min(80, candidate.height));
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const x = Math.max(halfWidth, Math.min(100 - halfWidth, candidate.x));
  const y = Math.max(halfHeight, Math.min(100 - halfHeight, candidate.y));
  const bounded = { x, y, width, height };
  if (!intersectsImageQuietZone(bounded)) return bounded;

  const alternatives = [
    { ...bounded, x: imageQuietZone.left - halfWidth },
    { ...bounded, x: imageQuietZone.right + halfWidth },
    { ...bounded, y: imageQuietZone.top - halfHeight },
    { ...bounded, y: imageQuietZone.bottom + halfHeight },
  ].filter((position) =>
    position.x >= halfWidth && position.x <= 100 - halfWidth &&
    position.y >= halfHeight && position.y <= 100 - halfHeight &&
    !intersectsImageQuietZone(position)
  );
  if (!alternatives.length) return fallback;
  return alternatives.reduce((closest, position) =>
    Math.hypot(position.x - x, position.y - y) < Math.hypot(closest.x - x, closest.y - y)
      ? position
      : closest
  );
}

function getDecorativeImages(design: VenueQrPosterDesign): PosterDecorativeImage[] {
  if (design.decorativeImages) return design.decorativeImages;
  if (!design.imageUrl) return [];
  return [{
    id: "legacy-decoration",
    url: design.imageUrl,
    position: design.imagePositions?.decoration ?? defaultImagePositions.decoration,
  }];
}

function getImagePosition(design: VenueQrPosterDesign, id: ImageLayerId) {
  if (id === "logo") return design.imagePositions?.logo ?? defaultImagePositions.logo;
  const decorativeId = id.startsWith("decoration:") ? id.slice("decoration:".length) : "";
  return getDecorativeImages(design).find((image) => image.id === decorativeId)?.position
    ?? defaultImagePositions.decoration;
}
function safeTextPosition(x: number, y: number) {
  const clampedX = Math.max(3, Math.min(97, x));
  let clampedY = Math.max(3, Math.min(97, y));
  if (clampedX >= 20 && clampedX <= 80 && clampedY >= 50 && clampedY <= 90) {
    clampedY = clampedY < 70 ? 49 : 91;
  }
  return { x: Math.round(clampedX * 10) / 10, y: Math.round(clampedY * 10) / 10 };
}

function contrastRatio(hex: string) {
  if (!hexColor.test(hex)) return 0;
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) ?? [0, 0, 0];
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return (1.05) / (luminance + 0.05);
}

export function VenueQrPosterEditor({
  businessName,
  qrUrl,
  design,
  onSave,
  onUploadImage,
  onDiscardImage,
  onExport,
}: VenueQrPosterEditorProps) {
  const [draft, setDraft] = useState(() => cloneDesign(design));
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"jpg" | "png" | "pdf" | "print" | null>(null);
  const [uploading, setUploading] = useState<"logoUrl" | "decoration" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedLayer, setSelectedLayer] = useState("heading");
  const [editingLayer, setEditingLayer] = useState<string | null>(null);
  const posterRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; rect: DOMRect } | null>(null);
  const resizeRef = useRef<{ id: string; pointerId: number; rect: DOMRect; startX: number; startY: number; fontSize: number; width: number; x: number; y: number } | null>(null);
  const imageResizeRef = useRef<PosterImageResize | null>(null);
  const layerRefs = useRef(new Map<string, HTMLElement>());
  const editorRefs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    if (!editingLayer) return;
    const frame = requestAnimationFrame(() => editorRefs.current.get(editingLayer)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editingLayer]);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadedImageUrlsRef = useRef(new Set<string>());
  const mountedRef = useRef(false);
  const savingRef = useRef(false);
  const unmountedDuringSaveRef = useRef(false);
  const discardImageRef = useRef(onDiscardImage);
  discardImageRef.current = onDiscardImage;

  function discardImages(urls: string[], keepalive = false) {
    for (const url of urls) {
      void discardImageRef.current(url, keepalive).catch(() => undefined);
    }
  }

  function discardTrackedImages(keepalive = false) {
    const urls = [...uploadedImageUrlsRef.current];
    uploadedImageUrlsRef.current.clear();
    discardImages(urls, keepalive);
  }

  useEffect(() => {
    const handleExit = () => {
      mountedRef.current = false;
      if (savingRef.current) {
        unmountedDuringSaveRef.current = true;
        return;
      }
      discardTrackedImages(true);
    };
    const handlePageShow = () => {
      mountedRef.current = true;
    };
    mountedRef.current = true;
    const handlePageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) handleExit();
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      handleExit();
    };
  }, []);

  useEffect(() => {
    setDraft(cloneDesign(design));
  }, [
    design.heading, design.subheading, design.footer, design.fontFamily,
    design.titleFontSize, design.bodyFontSize, design.textColor, design.accentColor,
    design.backgroundColor, design.qrForegroundColor, design.logoUrl, design.imageUrl,
    design.decorativeImages, design.imagePositions, design.textPositions, design.textContent, design.textBoxes,
  ]);

  function update<K extends keyof VenueQrPosterDesign>(key: K, value: VenueQrPosterDesign[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  function addTextBox() {
    const id = crypto.randomUUID().replaceAll("-", "");
    const box: PosterTextBox = { id, text: "Your message", x: 50, y: 47, fontSize: 18, color: draft.textColor, align: "center" };
    setDraft((current) => ({ ...current, textBoxes: [...(current.textBoxes ?? []), box] }));
    setSelectedLayer(`custom:${id}`);
    setMessage("");
  }

  function layerText(id: string) {
    if (id.startsWith("custom:")) return draft.textBoxes?.find((box) => `custom:${box.id}` === id)?.text ?? "";
    const key = id as PosterLayerId;
    return draft.textContent?.[key] ?? (key === "venueName" ? businessName : key === "heading" ? draft.heading : key === "subheading" ? draft.subheading : key === "footer" ? draft.footer : defaultTextContent[key]);
  }

  function setLayerText(id: string, text: string) {
    if (id.startsWith("custom:")) {
      const boxId = id.slice(7);
      setDraft((current) => ({ ...current, textBoxes: (current.textBoxes ?? []).map((box) => box.id === boxId ? { ...box, text: text.slice(0, 140) } : box) }));
    } else if (id === "heading" || id === "subheading" || id === "footer") {
      update(id, text.slice(0, id === "heading" ? 70 : id === "subheading" ? 120 : 100));
    } else {
      const key = id as PosterLayerId;
      const maxLength = key === "brandMark" ? 4 : key === "brandLabel" ? 48 : key === "venueName" ? 80 : key === "kicker" ? 80 : 100;
      setDraft((current) => ({ ...current, textContent: { ...current.textContent, [key]: text.slice(0, maxLength) } }));
    }
  }

  function moveLayer(id: string, x: number, y: number) {
    if (id.startsWith("custom:")) {
      const boxId = id.slice(7);
      setDraft((current) => ({ ...current, textBoxes: (current.textBoxes ?? []).map((box) => box.id === boxId ? { ...box, x, y } : box) }));
      return;
    }
    const key = id as PosterLayerId;
    setDraft((current) => ({ ...current, textPositions: { ...current.textPositions, [key]: { ...current.textPositions?.[key], x, y } } }));
  }

  function resizeLayer(id: string, fontSize: number, width: number) {
    if (id.startsWith("custom:")) {
      const boxId = id.slice(7);
      setDraft((current) => ({ ...current, textBoxes: (current.textBoxes ?? []).map((box) => box.id === boxId ? { ...box, fontSize, width } : box) }));
      return;
    }
    const key = id as PosterLayerId;
    setDraft((current) => ({
      ...current,
      textPositions: {
        ...current.textPositions,
        [key]: {
          ...current.textPositions?.[key],
          x: current.textPositions?.[key]?.x ?? defaultTextPositions[key].x,
          y: current.textPositions?.[key]?.y ?? defaultTextPositions[key].y,
          fontSize,
          width,
        },
      },
    }));
  }

  function setImagePosition(id: ImageLayerId, candidate: PosterImagePosition) {
    const current = getImagePosition(draft, id);
    const position = safeImagePosition(candidate, current);
    if (id === "logo") {
      setDraft((design) => ({ ...design, imagePositions: { ...design.imagePositions, logo: position } }));
      return;
    }
    const decorativeId = id.slice("decoration:".length);
    setDraft((design) => ({
      ...design,
      imageUrl: null,
      decorativeImages: getDecorativeImages(design).map((image) =>
        image.id === decorativeId ? { ...image, position } : image
      ),
    }));
  }

  function startLayerResize(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    const poster = posterRef.current;
    const layer = layerRefs.current.get(id);
    if (!poster || !layer) return;
    const posterRect = poster.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    resizeRef.current = {
      id, pointerId: event.pointerId, rect: posterRect, startX: event.clientX, startY: event.clientY,
      fontSize: Number.parseFloat(window.getComputedStyle(layer).fontSize) || 16,
      width: Math.max(8, Math.min(90, layerRect.width / posterRect.width * 100)),
      x: Number.parseFloat(layer.style.left) || 50,
      y: Number.parseFloat(layer.style.top) || 50,
    };
    poster.setPointerCapture(event.pointerId);
  }

  function startLayerDrag(event: ReactPointerEvent, id: string) {
    if (editingLayer === id) return;
    const poster = posterRef.current;
    if (!poster) return;
    setSelectedLayer(id);
    dragRef.current = { id, pointerId: event.pointerId, rect: poster.getBoundingClientRect() };
    poster.setPointerCapture(event.pointerId);
  }

  function startImageResize(event: ReactPointerEvent<HTMLButtonElement>, id: ImageLayerId) {
    event.preventDefault();
    event.stopPropagation();
    const poster = posterRef.current;
    const layer = layerRefs.current.get(`image:${id}`);
    if (!poster || !layer) return;
    imageResizeRef.current = {
      id,
      pointerId: event.pointerId,
      rect: poster.getBoundingClientRect(),
      startX: event.clientX,
      startY: event.clientY,
      renderWidth: layer.getBoundingClientRect().width,
      renderHeight: layer.getBoundingClientRect().height,
      position: getImagePosition(draft, id),
    };
    poster.setPointerCapture(event.pointerId);
  }

  function dragLayer(event: ReactPointerEvent) {
    const imageResize = imageResizeRef.current;
    if (imageResize && imageResize.pointerId === event.pointerId && imageResize.rect.width && imageResize.rect.height) {
      const scale = 1 + Math.max(
        (event.clientX - imageResize.startX) / imageResize.renderWidth,
        (event.clientY - imageResize.startY) / imageResize.renderHeight,
      );
      const factor = Math.max(0.2, Math.min(4, scale));
      const position = safeImagePosition({
        ...imageResize.position,
        width: imageResize.position.width * factor,
        height: imageResize.position.height * factor,
      }, imageResize.position);
      setImagePosition(imageResize.id, position);
      return;
    }
    const resize = resizeRef.current;
    if (resize && resize.pointerId === event.pointerId && resize.rect.width) {
      const dx = event.clientX - resize.startX;
      const dy = event.clientY - resize.startY;
      const scale = (dx + dy) * 0.16;
      const fontSize = Math.round(Math.max(8, Math.min(96, resize.fontSize + scale)));
      const width = Math.round(Math.max(8, Math.min(90, resize.width + dx / resize.rect.width * 100)));
      const halfWidth = width / 2;
      const halfHeight = fontSize * 1.3 / resize.rect.height * 50 + 1;
      const intersectsQr = resize.x + halfWidth >= 20 && resize.x - halfWidth <= 80 &&
        resize.y + halfHeight >= 50 && resize.y - halfHeight <= 90;
      if (!intersectsQr) resizeLayer(resize.id, fontSize, width);
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !drag.rect.width || !drag.rect.height) return;
    const x = ((event.clientX - drag.rect.left) / drag.rect.width) * 100;
    const y = ((event.clientY - drag.rect.top) / drag.rect.height) * 100;
    if (drag.id.startsWith("image:")) {
      const id = drag.id.slice(6);
      const position = getImagePosition(draft, id);
      setImagePosition(id, { ...position, x, y });
      return;
    }
    const point = safeTextPosition(x, y);
    moveLayer(drag.id, point.x, point.y);
  }

  function stopLayerDrag(event: ReactPointerEvent) {
    if (imageResizeRef.current?.pointerId === event.pointerId) imageResizeRef.current = null;
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function renderTextLayer(id: string, text: string, className: string, fontSize: number, color: string, align: "left" | "center" | "right" = "center") {
    const position = id.startsWith("custom:")
      ? draft.textBoxes?.find((box) => `custom:${box.id}` === id)
      : (draft.textPositions?.[id as keyof typeof defaultTextPositions] ?? defaultTextPositions[id as keyof typeof defaultTextPositions]);
    if (!position) return null;
    const selected = selectedLayer === id;
    const resolvedFontSize = position.fontSize ?? fontSize;
    return (
      <div
        key={id}
        className={`vqp-text-layer ${selected ? "is-selected" : ""} ${className}`}
        ref={(node) => {
          if (node) layerRefs.current.set(id, node);
          else layerRefs.current.delete(id);
        }}
        style={{ left: `${position.x}%`, top: `${position.y}%`, fontSize: resolvedFontSize, color, textAlign: align, width: position.width ? `${position.width}%` : undefined }}
        onPointerDown={(event) => startLayerDrag(event, id)}
        onClick={() => setSelectedLayer(id)}
        onDoubleClick={() => { if (id !== "venueName") setEditingLayer(id); }}
        tabIndex={0}
        onKeyDown={(event) => {
          if (editingLayer === id) return;
          if (event.key === "Enter") { event.preventDefault(); setEditingLayer(id); return; }
          const delta = event.shiftKey ? 5 : 1;
          const change = event.key === "ArrowLeft" ? [-delta, 0] : event.key === "ArrowRight" ? [delta, 0]
            : event.key === "ArrowUp" ? [0, -delta] : event.key === "ArrowDown" ? [0, delta] : null;
          if (!change) return;
          event.preventDefault();
          const point = safeTextPosition(position.x + change[0], position.y + change[1]);
          moveLayer(id, point.x, point.y);
        }}
        role="group"
        aria-label={`${text || id} poster text; drag to move, double-click to edit, drag corner to resize`}
      >
        <span
          ref={(node) => {
            if (node) editorRefs.current.set(id, node);
            else editorRefs.current.delete(id);
          }}
          contentEditable={editingLayer === id}
          suppressContentEditableWarning
          onBlur={(event) => { if (editingLayer === id) setLayerText(id, event.currentTarget.innerText); setEditingLayer(null); }}
          onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.blur(); setEditingLayer(null); } }}
        >{text}</span>
        {selected && editingLayer !== id && <button type="button" className="vqp-resize-handle" aria-label={`Resize ${text || "text"} layer`} title="Drag to resize" onPointerDown={(event) => startLayerResize(event, id)} />}
      </div>
    );
  }

  function renderImageLayer(id: ImageLayerId, url: string, label: string) {
    const layerId = `image:${id}`;
    const position = getImagePosition(draft, id);
    const selected = selectedLayer === layerId;
    return (
      <div
        key={layerId}
        ref={(node) => {
          if (node) layerRefs.current.set(layerId, node);
          else layerRefs.current.delete(layerId);
        }}
        className={`vqp-image-layer ${selected ? "is-selected" : ""}`}
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          width: `${position.width}%`,
          height: `${position.height}%`,
        }}
        onPointerDown={(event) => startLayerDrag(event, layerId)}
        onClick={() => setSelectedLayer(layerId)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          const delta = event.shiftKey ? 5 : 1;
          const next = { ...position };
          if (event.key === "ArrowLeft") next.x -= delta;
          if (event.key === "ArrowRight") next.x += delta;
          if (event.key === "ArrowUp") next.y -= delta;
          if (event.key === "ArrowDown") next.y += delta;
          setImagePosition(id, next);
        }}
        tabIndex={0}
        role="group"
        aria-label={`${label} poster image; drag to move or use arrow keys`}
      >
        <img src={url} alt="" draggable={false} />
        {selected && <button
          type="button"
          className="vqp-image-resize-handle"
          aria-label={`Resize ${label.toLowerCase()}`}
          title="Drag to resize"
          onPointerDown={(event) => startImageResize(event, id)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const delta = event.shiftKey ? 5 : 1;
            const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
            setImagePosition(id, {
              ...position,
              width: position.width + direction * delta,
              height: position.height + direction * delta,
            });
          }}
        />}
      </div>
    );
  }

  function validate() {
    if (!draft.heading.trim()) return "Add a heading before saving or exporting.";
    if (draft.heading.length > 70 || draft.subheading.length > 120 || draft.footer.length > 100) {
      return "Shorten the poster wording to fit: heading 70, subheading 120, footer 100 characters.";
    }
    const positions = [...Object.values(draft.textPositions ?? {}), ...(draft.textBoxes ?? [])];
    if (positions.some((position) => position.x >= 20 && position.x <= 80 && position.y >= 50 && position.y <= 90)) {
      return "Move text outside the reserved QR area before saving or exporting.";
    }
    if (
      Object.values(draft.imagePositions ?? {}).some((position) => position && intersectsImageQuietZone(position)) ||
      getDecorativeImages(draft).some((image) =>
        intersectsImageQuietZone(image.position) ||
        image.position.x - image.position.width / 2 < 0 ||
        image.position.x + image.position.width / 2 > 100 ||
        image.position.y - image.position.height / 2 < 0 ||
        image.position.y + image.position.height / 2 > 100
      )
    ) {
      return "Move images outside the reserved QR area before saving or exporting.";
    }
    if (getDecorativeImages(draft).length > 12) return "A poster can contain up to 12 decorative images.";
    if ((draft.textBoxes?.length ?? 0) > 16) return "A poster can contain up to 16 custom text layers.";
    if (![draft.textColor, draft.accentColor, draft.backgroundColor, draft.qrForegroundColor].every((color) => hexColor.test(color))) {
      return "Choose a valid six-digit hex color for each color field.";
    }
    if (contrastRatio(draft.qrForegroundColor) < 4.5) {
      return "Choose a darker QR color for reliable scanning. The QR sits on a white quiet zone.";
    }
    return "";
  }

  async function save() {
    const issue = validate();
    if (issue) { setError(issue); setMessage(""); return; }
    setSaving(true);
    savingRef.current = true;
    setError("");
    setMessage("");
    try {
      await onSave(cloneDesign(draft));
      const savedUrls = new Set([
        draft.logoUrl,
        ...getDecorativeImages(draft).map((image) => image.url),
      ].filter((url): url is string => Boolean(url)));
      const uploadedUrls = [...uploadedImageUrlsRef.current];
      uploadedImageUrlsRef.current.clear();
      discardImages(uploadedUrls.filter((url) => !savedUrls.has(url)));
      setMessage("Poster design saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this poster. Try again.");
    } finally {
      savingRef.current = false;
      if (unmountedDuringSaveRef.current) {
        unmountedDuringSaveRef.current = false;
        discardTrackedImages(true);
      }
      setSaving(false);
    }
  }

  async function exportPoster(format: "jpg" | "png" | "pdf" | "print") {
    const issue = validate();
    if (issue) { setError(issue); setMessage(""); return; }
    const poster = posterRef.current;
    if (!poster) return;
    setExporting(format);
    setError("");
    setMessage("");
    poster.classList.add("vqp-exporting");
    try {
      await onExport(format, poster);
      setMessage(format === "print" ? "Print dialog opened." : `${format.toUpperCase()} export is ready.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not export as ${format.toUpperCase()}. Please try again.`);
    } finally {
      poster.classList.remove("vqp-exporting");
      setExporting(null);
    }
  }

  async function uploadImage(file: File, field: "logoUrl" | "decoration") {
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file in PNG, JPEG, WebP, or GIF format.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Choose an image smaller than 8 MB.");
      return;
    }
    setUploading(field);
    setError("");
    setMessage("");
    try {
      const url = await onUploadImage(file);
      if (!mountedRef.current) {
        discardImages([url], true);
        return;
      }
      uploadedImageUrlsRef.current.add(url);
      if (field === "logoUrl") {
        update("logoUrl", url);
        setSelectedLayer("image:logo");
        setMessage("Logo added to the preview.");
      } else {
        const decorativeImages = getDecorativeImages(draft);
        if (decorativeImages.length >= 12) {
          uploadedImageUrlsRef.current.delete(url);
          discardImages([url]);
          setError("A poster can contain up to 12 decorative images.");
          return;
        }
        const id = crypto.randomUUID().replaceAll("-", "");
        const positions = [
          { x: 89.5, y: 74, width: 15, height: 18 },
          { x: 10.5, y: 36, width: 15, height: 18 },
          { x: 89.5, y: 36, width: 15, height: 18 },
          { x: 10.5, y: 18, width: 15, height: 12 },
          { x: 89.5, y: 18, width: 15, height: 12 },
          { x: 10.5, y: 48, width: 15, height: 8 },
          { x: 89.5, y: 48, width: 15, height: 8 },
          { x: 10.5, y: 62, width: 15, height: 12 },
          { x: 89.5, y: 62, width: 15, height: 12 },
          { x: 10.5, y: 86, width: 15, height: 8 },
          { x: 89.5, y: 86, width: 15, height: 8 },
          { x: 50, y: 12, width: 15, height: 8 },
        ];
        setDraft((current) => ({
          ...current,
          imageUrl: null,
          decorativeImages: [
            ...getDecorativeImages(current),
            { id, url, position: positions[decorativeImages.length] ?? positions[0]! },
          ],
        }));
        setSelectedLayer(`image:decoration:${id}`);
        setMessage("Decorative image added to the preview.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  const fontStack = draft.fontFamily === "serif"
    ? '"Playfair Display", Georgia, serif'
    : '"DM Sans", "Segoe UI", sans-serif';
  const selectedBox = draft.textBoxes?.find((box) => `custom:${box.id}` === selectedLayer);
  const selectedImageId = selectedLayer.startsWith("image:") ? selectedLayer.slice(6) : null;
  const selectedImage = selectedImageId === "logo" && draft.logoUrl
    ? "logo"
    : selectedImageId?.startsWith("decoration:") &&
        getDecorativeImages(draft).some((image) => `decoration:${image.id}` === selectedImageId)
      ? selectedImageId
      : null;
  const decorativeImages = getDecorativeImages(draft);

  function removeDecorativeImage(id: string) {
    const removed = decorativeImages.find((image) => image.id === id);
    setDraft((current) => ({
      ...current,
      imageUrl: null,
      decorativeImages: getDecorativeImages(current).filter((image) => image.id !== id),
    }));
    if (removed) {
      uploadedImageUrlsRef.current.delete(removed.url);
      discardImages([removed.url]);
    }
    if (selectedLayer === `image:decoration:${id}`) setSelectedLayer("heading");
  }

  function reorderDecorativeImage(id: string, direction: "front" | "back") {
    setDraft((current) => {
      const images = [...getDecorativeImages(current)];
      const index = images.findIndex((image) => image.id === id);
      const nextIndex = direction === "front"
        ? Math.min(images.length - 1, index + 1)
        : Math.max(0, index - 1);
      if (index < 0 || nextIndex === index) return current;
      [images[index], images[nextIndex]] = [images[nextIndex]!, images[index]!];
      return { ...current, imageUrl: null, decorativeImages: images };
    });
  }

  function updateSelectedBox(partial: Partial<PosterTextBox>) {
    if (!selectedBox) return;
    setDraft((current) => ({
      ...current,
      textBoxes: (current.textBoxes ?? []).map((box) => box.id === selectedBox.id ? { ...box, ...partial } : box),
    }));
  }

  function deleteSelectedBox() {
    if (!selectedBox) return;
    setDraft((current) => ({ ...current, textBoxes: (current.textBoxes ?? []).filter((box) => box.id !== selectedBox.id) }));
    setSelectedLayer("heading");
  }

  function reorderSelectedBox(direction: "front" | "back") {
    if (!selectedBox) return;
    setDraft((current) => {
      const boxes = [...(current.textBoxes ?? [])];
      const index = boxes.findIndex((box) => box.id === selectedBox.id);
      const nextIndex = direction === "front" ? Math.min(boxes.length - 1, index + 1) : Math.max(0, index - 1);
      if (index < 0 || nextIndex === index) return current;
      [boxes[index], boxes[nextIndex]] = [boxes[nextIndex], boxes[index]];
      return { ...current, textBoxes: boxes };
    });
  }

  return (
    <section className="vqp-editor" aria-label={`Check-in poster editor for ${businessName}`}>
      <header className="vqp-header">
        <div>
          <p className="vqp-eyebrow">VENUE CHECK-IN</p>
          <h2>Make it yours</h2>
          <p className="vqp-intro">A little sign guests can spot, scan, and feel welcome by.</p>
        </div>
        <span className="vqp-save-note"><span aria-hidden="true" /> Your QR stays the same</span>
      </header>

      <div className="vqp-layout">
        <form className="vqp-controls" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <section className="vqp-control-section">
            <div className="vqp-section-title"><span>01</span><h3>Words</h3></div>
            <label className="vqp-field">
              <span>Headline</span>
              <input aria-label="Poster headline" maxLength={70} value={draft.heading} onChange={(event) => update("heading", event.target.value)} />
              <small>{draft.heading.length}/70</small>
            </label>
            <label className="vqp-field">
              <span>Supporting line</span>
              <textarea aria-label="Poster supporting line" rows={2} maxLength={120} value={draft.subheading} onChange={(event) => update("subheading", event.target.value)} />
              <small>{draft.subheading.length}/120</small>
            </label>
            <label className="vqp-field">
              <span>Footer note</span>
              <input aria-label="Poster footer note" maxLength={100} value={draft.footer} onChange={(event) => update("footer", event.target.value)} />
              <small>{draft.footer.length}/100</small>
            </label>
          </section>

          <section className="vqp-control-section">
            <div className="vqp-section-title"><span>02</span><h3>Text layers</h3></div>
            <p className="vqp-help">Drag text on the poster. Double-click to edit in place. Text stays clear of the QR.</p>
            <div className="vqp-layer-list" role="group" aria-label="Poster text layers">
              {([
                ["brandMark", layerText("brandMark")],
                ["brandLabel", layerText("brandLabel")],
                ["kicker", layerText("kicker")],
                ["venueName", layerText("venueName")],
                ["heading", "Headline"],
                ["subheading", "Supporting line"],
                ["scanNote", layerText("scanNote")],
                ["footer", "Footer"],
                ...(draft.textBoxes ?? []).map((box) => [`custom:${box.id}`, box.text] as [string, string]),
              ] as [string, string][]).map(([id, label]) => (
                <button key={id} type="button" className={selectedLayer === id ? "is-active" : ""} onClick={() => setSelectedLayer(id)}>
                  <span>{label || "Text box"}</span><span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <div className="vqp-layer-actions">
              <button className="vqp-reset" type="button" disabled={(draft.textBoxes?.length ?? 0) >= 16} onClick={addTextBox}>+ Add text</button>
              {selectedBox && <>
                <button className="vqp-reset" type="button" aria-label="Move text layer backward" onClick={() => reorderSelectedBox("back")}>Send back</button>
                <button className="vqp-reset" type="button" aria-label="Move text layer forward" onClick={() => reorderSelectedBox("front")}>Bring forward</button>
                <button className="vqp-reset" type="button" onClick={deleteSelectedBox}>Remove</button>
              </>}
            </div>
            {!selectedBox && <label className="vqp-field vqp-layer-copy-field"><span>Edit selected text</span><textarea rows={2} maxLength={selectedLayer === "brandMark" ? 4 : 180} value={layerText(selectedLayer)} onChange={(event) => setLayerText(selectedLayer, event.target.value)} /></label>}
            {selectedBox && <div className="vqp-custom-layer-controls">
              <label className="vqp-field"><span>Text</span><textarea rows={2} maxLength={140} value={selectedBox.text} onChange={(event) => updateSelectedBox({ text: event.target.value })} /></label>
              <div className="vqp-size-row">
                <label className="vqp-field"><span>Size</span><div className="vqp-range-line"><input type="range" min="10" max="72" value={selectedBox.fontSize} onChange={(event) => updateSelectedBox({ fontSize: Number(event.target.value) })} /><output>{selectedBox.fontSize}px</output></div></label>
                <label className="vqp-color-field"><span>Color</span><input type="color" value={selectedBox.color} onChange={(event) => updateSelectedBox({ color: event.target.value })} /></label>
              </div>
              <div className="vqp-segment" role="group" aria-label="Text alignment">
                {(["left", "center", "right"] as const).map((align) => <button key={align} type="button" aria-pressed={selectedBox.align === align} className={selectedBox.align === align ? "selected" : ""} onClick={() => updateSelectedBox({ align })}>{align}</button>)}
              </div>
            </div>}
          </section>

          <section className="vqp-control-section">
            <div className="vqp-section-title"><span>03</span><h3>Type & color</h3></div>
            <div className="vqp-field">
              <span>Typeface</span>
              <div className="vqp-segment" role="group" aria-label="Poster typeface">
                <button type="button" aria-pressed={draft.fontFamily === "sans"} className={draft.fontFamily === "sans" ? "selected" : ""} onClick={() => update("fontFamily", "sans")}>Sans</button>
                <button type="button" aria-pressed={draft.fontFamily === "serif"} className={draft.fontFamily === "serif" ? "selected" : ""} onClick={() => update("fontFamily", "serif")}>Serif</button>
              </div>
            </div>
            <div className="vqp-size-row">
              <label className="vqp-field"><span>Headline size</span><div className="vqp-range-line"><input aria-label="Headline font size" type="range" min="20" max="48" value={draft.titleFontSize} onChange={(event) => update("titleFontSize", Number(event.target.value))} /><output>{draft.titleFontSize}px</output></div></label>
              <label className="vqp-field"><span>Body size</span><div className="vqp-range-line"><input aria-label="Body font size" type="range" min="11" max="24" value={draft.bodyFontSize} onChange={(event) => update("bodyFontSize", Number(event.target.value))} /><output>{draft.bodyFontSize}px</output></div></label>
            </div>
            <div className="vqp-colors">
              {([
                ["textColor", "Text"],
                ["accentColor", "Accent"],
                ["backgroundColor", "Paper"],
                ["qrForegroundColor", "QR ink"],
              ] as const).map(([key, label]) => (
                <label className="vqp-color-field" key={key}>
                  <span>{label}</span>
                  <input type="color" aria-label={`${label} color`} value={hexColor.test(draft[key]) ? draft[key] : "#183c2f"} onChange={(event) => update(key, event.target.value)} />
                </label>
              ))}
            </div>
            <div className="vqp-presets" role="group" aria-label="Color and type presets">
              {presets.map((preset) => <button key={preset.name} type="button" onClick={() => { setDraft((current) => ({ ...current, ...preset.values })); setMessage(""); setError(""); }}>{preset.name}</button>)}
            </div>
          </section>

          <section className="vqp-control-section">
            <div className="vqp-section-title"><span>04</span><h3>Images</h3><small>Optional</small></div>
            <p className="vqp-help">Select an image, then drag it or its corner handle. Images stay clear of the QR quiet zone.</p>
            <div className="vqp-image-fields">
              <div className="vqp-upload">
                <div className="vqp-upload-preview">
                  {draft.logoUrl ? <img src={draft.logoUrl} alt="Venue logo preview" /> : <ImagePlus aria-hidden="true" size={19} />}
                </div>
                <div className="vqp-upload-copy"><strong>Venue logo</strong><small>{draft.logoUrl ? "Ready for your poster" : "PNG, JPEG, WebP · up to 8 MB"}</small></div>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden aria-label="Upload venue logo" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, "logoUrl"); event.currentTarget.value = ""; }} />
                {draft.logoUrl && <button className="vqp-icon-button" type="button" aria-label="Remove venue logo" onClick={() => { update("logoUrl", null); setSelectedLayer("heading"); }}><X size={16} /></button>}
                <button className="vqp-upload-button" type="button" disabled={uploading !== null} onClick={() => logoInputRef.current?.click()}>{uploading === "logoUrl" ? "Uploading…" : draft.logoUrl ? "Replace" : <><Upload size={14} /> Add</>}</button>
              </div>
              <div className="vqp-upload">
                <div className="vqp-upload-preview"><ImagePlus aria-hidden="true" size={19} /></div>
                <div className="vqp-upload-copy"><strong>Decorative images</strong><small>{decorativeImages.length} of 12 · add each image as its own layer</small></div>
                <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden aria-label="Upload decorative image" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file, "decoration"); event.currentTarget.value = ""; }} />
                <button className="vqp-upload-button" type="button" disabled={uploading !== null || decorativeImages.length >= 12} onClick={() => imageInputRef.current?.click()}>{uploading === "decoration" ? "Uploading…" : <><Upload size={14} /> Add image</>}</button>
              </div>
              {decorativeImages.map((image, index) => {
                const id = `decoration:${image.id}`;
                return <div className="vqp-upload vqp-decorative-upload" key={image.id}>
                  <div className="vqp-upload-preview"><img src={image.url} alt={`Decorative image ${index + 1} preview`} /></div>
                  <div className="vqp-upload-copy"><strong>Decorative image {index + 1}</strong><small>Saved as its own movable layer</small></div>
                  <button type="button" className={`vqp-image-layer-select ${selectedLayer === `image:${id}` ? "is-active" : ""}`} onClick={() => setSelectedLayer(`image:${id}`)}>Select</button>
                  <div className="vqp-image-order-controls" role="group" aria-label={`Decorative image ${index + 1} layer order`}>
                    <button
                      className="vqp-order-button"
                      type="button"
                      aria-label={`Send decorative image ${index + 1} backward`}
                      title="Send backward"
                      disabled={index === 0}
                      onClick={() => reorderDecorativeImage(image.id, "back")}
                    ><ArrowDown size={14} aria-hidden="true" /></button>
                    <button
                      className="vqp-order-button"
                      type="button"
                      aria-label={`Bring decorative image ${index + 1} forward`}
                      title="Bring forward"
                      disabled={index === decorativeImages.length - 1}
                      onClick={() => reorderDecorativeImage(image.id, "front")}
                    ><ArrowUp size={14} aria-hidden="true" /></button>
                  </div>
                  <button className="vqp-icon-button" type="button" aria-label={`Remove decorative image ${index + 1}`} onClick={() => removeDecorativeImage(image.id)}><X size={16} /></button>
                </div>;
              })}
            </div>
            <div className="vqp-image-layer-list" role="group" aria-label="Poster image layers">
              {draft.logoUrl && <button type="button" className={selectedLayer === "image:logo" ? "is-active" : ""} onClick={() => setSelectedLayer("image:logo")}>Select logo</button>}
            </div>
            {selectedImage && <p className="vqp-image-selection-help" role="status">
              {selectedImage === "logo" ? "Logo" : "Decorative image"} selected · Arrow keys move; Shift + arrow moves farther. Select its corner handle to resize.
            </p>}
          </section>

          <div className="vqp-form-actions">
            <button className="vqp-reset" type="button" onClick={() => { discardTrackedImages(); setDraft(cloneDesign(design)); setError(""); setMessage("Edits reset to the last saved design."); }}><RotateCcw size={15} />Reset</button>
            <button className="vqp-save" type="submit" disabled={saving || uploading !== null}>{saving ? "Saving…" : <><Save size={15} />Save design</>}</button>
          </div>
          {error && <p className="vqp-feedback is-error" role="alert">{error}</p>}
          {message && <p className="vqp-feedback" role="status" aria-live="polite"><Check size={15} />{message}</p>}
        </form>

        <aside className="vqp-preview-column">
          <div className="vqp-preview-head"><div><p className="vqp-eyebrow">LIVE PREVIEW</p><h3>On the door, at the desk</h3></div><span>A4 portrait</span></div>
          <article
            ref={posterRef}
            className="vqp-poster"
            aria-label={`Poster preview for ${businessName}`}
            style={{
              backgroundColor: draft.backgroundColor,
              color: draft.textColor,
              fontFamily: fontStack,
              "--vqp-accent": draft.accentColor,
              "--vqp-accent-rgb": rgbChannels(draft.accentColor),
            } as CSSProperties}
            onPointerMove={dragLayer}
            onPointerUp={stopLayerDrag}
            onPointerCancel={stopLayerDrag}
          >
            <div className="vqp-poster-frame" aria-hidden="true" />
            {draft.logoUrl ? renderImageLayer("logo", draft.logoUrl, "Venue logo") : renderTextLayer("brandMark", layerText("brandMark"), "vqp-met-mark", 16, "#eff7e8")}
            {renderTextLayer("brandLabel", layerText("brandLabel"), "vqp-brand-label", 8, draft.accentColor)}
            {decorativeImages.map((image, index) =>
              renderImageLayer(`decoration:${image.id}`, image.url, `Decorative image ${index + 1}`)
            )}
            {renderTextLayer("kicker", layerText("kicker"), "vqp-kicker", 8, draft.accentColor)}
            {renderTextLayer("venueName", layerText("venueName"), "vqp-venue-name", draft.titleFontSize, draft.textColor)}
            {renderTextLayer("heading", layerText("heading"), "vqp-poster-heading", draft.bodyFontSize, draft.accentColor)}
            {renderTextLayer("subheading", layerText("subheading"), "vqp-poster-subheading", draft.bodyFontSize, draft.textColor)}
            {(draft.textBoxes ?? []).map((box) => renderTextLayer(`custom:${box.id}`, box.text, "vqp-custom-poster-text", box.fontSize, box.color, box.align))}
            <div className="vqp-qr-wrap" aria-label={`Check-in QR code for ${businessName}`}>
              <QRCode value={qrUrl} size={190} level="H" bgColor="#ffffff" fgColor={draft.qrForegroundColor} />
            </div>
            {renderTextLayer("scanNote", layerText("scanNote"), "vqp-scan-note", 10, draft.accentColor)}
            {renderTextLayer("footer", layerText("footer"), "vqp-poster-footer", 9, draft.textColor)}
          </article>
          <p className="vqp-qr-assurance">QR link is unchanged · High error correction · Clear scan margin</p>
          <div className="vqp-export-actions">
            <button type="button" onClick={() => void exportPoster("print")} disabled={exporting !== null}>{exporting === "print" ? "Preparing…" : "Print"}</button>
            <button type="button" onClick={() => void exportPoster("jpg")} disabled={exporting !== null}>{exporting === "jpg" ? "Preparing…" : "Save JPG"}</button>
            <button type="button" onClick={() => void exportPoster("png")} disabled={exporting !== null}>{exporting === "png" ? "Preparing…" : "Export PNG"}</button>
            <button type="button" onClick={() => void exportPoster("pdf")} disabled={exporting !== null}>{exporting === "pdf" ? "Preparing…" : "Export PDF"}</button>
          </div>
          {exporting && <p className="vqp-export-status" role="status" aria-live="polite">Preparing your {exporting.toUpperCase()}…</p>}
        </aside>
      </div>
    </section>
  );
}

export default VenueQrPosterEditor;
