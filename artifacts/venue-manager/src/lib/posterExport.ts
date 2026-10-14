function bytesFromText(text: string) {
  return new TextEncoder().encode(text);
}

function combineBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

async function waitForPosterImages(poster: HTMLElement) {
  const images = [...poster.querySelectorAll<HTMLImageElement>("img")];
  await Promise.all(images.map(async (image, index) => {
    const source = image.currentSrc || image.src || "unknown image";
    let timeoutId: number | undefined;
    try {
      await Promise.race([
        image.decode(),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error(`Timed out while loading poster image ${index + 1} (${source}).`)),
            15_000,
          );
        }),
      ]);
      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        throw new Error(`The image has no usable dimensions.`);
      }
    } catch {
      throw new Error(`Could not load poster image ${index + 1} (${source}). Check the image and try again.`);
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  }));
}

export function createPosterPdf(jpeg: Uint8Array, imageWidth: number, imageHeight: number) {
  const header = combineBytes(
    bytesFromText("%PDF-1.4\n%"),
    new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]),
    bytesFromText("\n"),
  );
  const content = bytesFromText("q\n595.28 0 0 841.89 0 0 cm\n/Poster Do\nQ\n");
  const objects = [
    bytesFromText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    bytesFromText("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    bytesFromText("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Poster 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"),
    combineBytes(
      bytesFromText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`),
      jpeg,
      bytesFromText("\nendstream\nendobj\n"),
    ),
    combineBytes(
      bytesFromText(`5 0 obj\n<< /Length ${content.byteLength} >>\nstream\n`),
      content,
      bytesFromText("endstream\nendobj\n"),
    ),
  ];

  let byteOffset = header.byteLength;
  const objectOffsets: number[] = [];
  for (const object of objects) {
    objectOffsets.push(byteOffset);
    byteOffset += object.byteLength;
  }
  const crossReferenceOffset = byteOffset;
  const crossReference = bytesFromText(
    `xref\n0 6\n0000000000 65535 f \n${objectOffsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`,
  );
  const trailer = bytesFromText(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`,
  );

  return new Blob([header, ...objects, crossReference, trailer], { type: "application/pdf" });
}

export async function createPosterExportBlob(
  poster: HTMLElement,
  format: "jpg" | "png" | "pdf",
) {
  await document.fonts?.ready;
  await waitForPosterImages(poster);
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(poster, {
    backgroundColor: getComputedStyle(poster).backgroundColor,
    logging: false,
    scale: 4,
    useCORS: true,
  });

  if (format === "jpg" || format === "png") {
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    return new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error(`Could not render the poster ${format.toUpperCase()}.`)),
      mimeType,
      0.96,
    ));
  }

  const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Could not render the poster PDF.")),
    "image/jpeg",
    0.96,
  ));
  return createPosterPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
