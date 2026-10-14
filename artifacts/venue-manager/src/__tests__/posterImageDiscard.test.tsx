import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VenueQrPosterEditor,
  type VenueQrPosterDesign,
} from "../components/VenueQrPosterEditor";

const uploadedUrl = "/api/storage/objects/uploads/f02fd82c-6379-4d86-bf4f-5821fe7bb2a2";

const design: VenueQrPosterDesign = {
  heading: "Welcome to",
  subheading: "Check in at Cedar House",
  footer: "Meet your community.",
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

function mountEditor(
  onDiscardImage = vi.fn().mockResolvedValue(undefined),
  onSave = vi.fn().mockResolvedValue(undefined),
  onUploadImage = vi.fn().mockResolvedValue(uploadedUrl),
) {
  const view = render(
    <VenueQrPosterEditor
      businessName="Cedar House"
      qrUrl="https://example.test/check-in/cedar"
      design={design}
      onSave={onSave}
      onUploadImage={onUploadImage}
      onDiscardImage={onDiscardImage}
      onExport={vi.fn().mockResolvedValue(undefined)}
    />,
  );
  return { ...view, onDiscardImage, onSave };
}

async function uploadLogo() {
  fireEvent.change(screen.getByLabelText("Upload venue logo"), {
    target: { files: [new File(["image"], "logo.png", { type: "image/png" })] },
  });
  await waitFor(() => expect(screen.getByAltText("Venue logo preview")).toHaveAttribute("src", uploadedUrl));
}

afterEach(() => cleanup());

describe("poster editor uploaded images", () => {
  it("discards newly uploaded images when edits are reset", async () => {
    const { onDiscardImage } = mountEditor();
    await uploadLogo();

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    await waitFor(() => expect(onDiscardImage).toHaveBeenCalledWith(uploadedUrl, false));
    expect(screen.queryByAltText("Venue logo preview")).not.toBeInTheDocument();
  });

  it("discards newly uploaded images when the editor closes", async () => {
    const { onDiscardImage, unmount } = mountEditor();
    await uploadLogo();

    unmount();

    expect(onDiscardImage).toHaveBeenCalledWith(uploadedUrl, true);
  });

  it("requests cleanup during a full page reload", async () => {
    const { onDiscardImage } = mountEditor();
    await uploadLogo();

    window.dispatchEvent(new Event("pagehide"));

    expect(onDiscardImage).toHaveBeenCalledWith(uploadedUrl, true);
  });

  it("keeps uploaded images used by a successful save", async () => {
    const { onDiscardImage, onSave, unmount } = mountEditor();
    await uploadLogo();
    fireEvent.click(screen.getByRole("button", { name: /save design/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: uploadedUrl })));
    expect(onDiscardImage).not.toHaveBeenCalled();

    unmount();
    expect(onDiscardImage).not.toHaveBeenCalled();
  });

  it("keeps decorative uploads independent and saves each layer's edited position", async () => {
    const secondUrl = "/api/storage/objects/uploads/8d98600c-d554-4601-a4b8-8919a307ff01";
    const onUploadImage = vi.fn()
      .mockResolvedValueOnce(uploadedUrl)
      .mockResolvedValueOnce(secondUrl);
    const { onDiscardImage, onSave } = mountEditor(vi.fn().mockResolvedValue(undefined), undefined, onUploadImage);

    for (let index = 0; index < 2; index += 1) {
      fireEvent.change(screen.getByLabelText("Upload decorative image"), {
        target: { files: [new File([`image-${index}`], `decoration-${index}.png`, { type: "image/png" })] },
      });
      await waitFor(() => expect(screen.getByAltText(`Decorative image ${index + 1} preview`)).toHaveAttribute(
        "src", index === 0 ? uploadedUrl : secondUrl,
      ));
    }

    fireEvent.click(screen.getAllByRole("button", { name: "Select" })[1]!);
    const secondLayer = screen.getByRole("group", { name: "Decorative image 2 poster image; drag to move or use arrow keys" });
    fireEvent.keyDown(secondLayer, { key: "ArrowRight" });
    fireEvent.keyDown(secondLayer, { key: "ArrowUp" });
    fireEvent.click(screen.getByRole("button", { name: "Resize decorative image 2" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Resize decorative image 2" }), { key: "ArrowRight" });

    fireEvent.click(screen.getByRole("button", { name: "Remove decorative image 1" }));
    await waitFor(() => expect(onDiscardImage).toHaveBeenCalledWith(uploadedUrl, false));
    fireEvent.click(screen.getByRole("button", { name: /save design/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      imageUrl: null,
      decorativeImages: [expect.objectContaining({
        url: secondUrl,
        position: expect.objectContaining({ x: 11.5, y: 35, width: 16, height: 19 }),
      })],
    })));
  });
});
