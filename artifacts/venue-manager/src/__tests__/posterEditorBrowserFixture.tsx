import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  VenueQrPosterEditor,
  type VenueQrPosterDesign,
} from "../components/VenueQrPosterEditor";
import { createPosterExportBlob, downloadBlob } from "../lib/posterExport";

const storageKey = "venue-manager-poster-browser-fixture";
const artworkDataUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#26735a"/></svg>',
)}`;
const redHostedArtworkUrl = "/api/storage/objects/uploads/poster-red.png";
const blueHostedArtworkUrl = "/api/storage/objects/uploads/poster-blue.png";

const defaultDesign: VenueQrPosterDesign = {
  heading: "Welcome to",
  subheading: "Check in at Cedar House",
  footer: "Meet your community, one check-in at a time.",
  fontFamily: "serif",
  titleFontSize: 36,
  bodyFontSize: 16,
  textColor: "#183c2f",
  accentColor: "#26735a",
  backgroundColor: "#f8f7ef",
  qrForegroundColor: "#111111",
  logoUrl: null,
  imageUrl: null,
};

const overlappingDesign: VenueQrPosterDesign = {
  ...defaultDesign,
  decorativeImages: [
    {
      id: "blue-decoration",
      url: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#2244ee"/></svg>')}`,
      position: { x: 29, y: 25, width: 24, height: 14 },
    },
    {
      id: "red-decoration",
      url: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ee3344"/></svg>')}`,
      position: { x: 14, y: 25, width: 24, height: 14 },
    },
  ],
};

const hostedOverlappingDesign: VenueQrPosterDesign = {
  ...overlappingDesign,
  decorativeImages: [
    { ...overlappingDesign.decorativeImages![0]!, url: blueHostedArtworkUrl },
    { ...overlappingDesign.decorativeImages![1]!, url: redHostedArtworkUrl },
  ],
};

function loadSavedDesigns(): Record<string, VenueQrPosterDesign> {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, VenueQrPosterDesign>;
  } catch {
    return {};
  }
}

function PosterEditorBrowserFixture() {
  const [venueId, setVenueId] = useState("cedar-house");
  const [savedDesigns, setSavedDesigns] = useState(loadSavedDesigns);
  const params = new URLSearchParams(location.search);
  const design = savedDesigns[venueId] ?? (
    params.get("layers") === "hosted" ? hostedOverlappingDesign :
      params.has("layers") ? overlappingDesign : defaultDesign
  );
  const businessName = venueId === "cedar-house" ? "Cedar House" : "Harbor Studio";

  return (
    <main>
      <label>
        Venue
        <select aria-label="Choose venue" value={venueId} onChange={(event) => setVenueId(event.target.value)}>
          <option value="cedar-house">Cedar House</option>
          <option value="harbor-studio">Harbor Studio</option>
        </select>
      </label>
      <VenueQrPosterEditor
        businessName={businessName}
        qrUrl={`https://example.test/check-in/${venueId}`}
        design={design}
        onSave={async (nextDesign) => {
          const next = { ...savedDesigns, [venueId]: nextDesign };
          localStorage.setItem(storageKey, JSON.stringify(next));
          setSavedDesigns(next);
        }}
        onUploadImage={async () => artworkDataUrl}
        onDiscardImage={async () => undefined}
        onExport={async (format, poster) => {
          if (format === "print") {
            window.print();
            return;
          }
          const blob = await createPosterExportBlob(poster, format);
          downloadBlob(blob, `poster-check-in.${format}`);
        }}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<PosterEditorBrowserFixture />);
