import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VenueQrPosterEditor,
  type VenueQrPosterDesign,
} from "../components/VenueQrPosterEditor";

const initialDesign: VenueQrPosterDesign = {
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

function getPosterImageOrder(poster: HTMLElement) {
  return [...poster.querySelectorAll(".vqp-image-layer img")].map((image) => image.getAttribute("src"));
}

afterEach(() => cleanup());

describe("poster decorative image order", () => {
  it("reorders layers, saves that order, and reopens and exports the same stack", async () => {
    const firstUrl = "/api/storage/objects/uploads/first.png";
    const secondUrl = "/api/storage/objects/uploads/second.png";
    const onUploadImage = vi.fn()
      .mockResolvedValueOnce(firstUrl)
      .mockResolvedValueOnce(secondUrl);
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onExport = vi.fn().mockResolvedValue(undefined);
    const props = {
      businessName: "Cedar House",
      qrUrl: "https://example.test/check-in/cedar",
      onSave,
      onUploadImage,
      onDiscardImage: vi.fn().mockResolvedValue(undefined),
      onExport,
    };
    const editor = render(<VenueQrPosterEditor {...props} design={initialDesign} />);

    for (let index = 0; index < 2; index += 1) {
      fireEvent.change(screen.getByLabelText("Upload decorative image"), {
        target: { files: [new File([`image-${index}`], `decoration-${index}.png`, { type: "image/png" })] },
      });
      await waitFor(() => expect(screen.getByAltText(`Decorative image ${index + 1} preview`)).toHaveAttribute(
        "src", index === 0 ? firstUrl : secondUrl,
      ));
    }

    fireEvent.click(screen.getByRole("button", { name: "Bring decorative image 1 forward" }));
    await waitFor(() => {
      expect(getPosterImageOrder(screen.getByLabelText("Poster preview for Cedar House"))).toEqual([secondUrl, firstUrl]);
    });
    fireEvent.click(screen.getByRole("button", { name: /save design/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());

    const savedDesign = onSave.mock.calls[0]![0] as VenueQrPosterDesign;
    expect(savedDesign.decorativeImages?.map((image) => image.url)).toEqual([secondUrl, firstUrl]);

    editor.unmount();
    const reopenedEditor = render(<VenueQrPosterEditor {...props} design={savedDesign} />);
    const preview = screen.getByLabelText("Poster preview for Cedar House");
    expect(getPosterImageOrder(preview)).toEqual([secondUrl, firstUrl]);

    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }));
    await waitFor(() => expect(onExport).toHaveBeenCalledOnce());
    const exportedPoster = onExport.mock.calls[0]![1] as HTMLElement;
    expect(getPosterImageOrder(exportedPoster)).toEqual([secondUrl, firstUrl]);

    reopenedEditor.unmount();
  });
});
