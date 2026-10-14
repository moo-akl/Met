import { describe, expect, it } from "vitest";
import { createPosterPdf } from "../lib/posterExport";

describe("createPosterPdf", () => {
  it("embeds the supplied JPG as a single full-page A4 poster", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0x00, 0x7f, 0xff, 0xd9]);
    const pdf = createPosterPdf(jpeg, 2580, 3648);
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(pdf);
    });
    const bytes = new Uint8Array(arrayBuffer);
    const source = new TextDecoder("latin1").decode(bytes);

    expect(pdf.type).toBe("application/pdf");
    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect(source).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(source).toContain("/Width 2580 /Height 3648");
    expect(source).toContain(`/Length ${jpeg.byteLength} >>\nstream\n`);
    expect(source).toContain("/Poster Do");

    const startXref = Number(source.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
    expect(source.slice(startXref)).toMatch(/^xref\n0 6\n/);
    const xrefEntries = source.slice(startXref).split("\n").slice(3, 8);
    xrefEntries.forEach((entry, index) => {
      const objectOffset = Number(entry.slice(0, 10));
      expect(source.slice(objectOffset).startsWith(`${index + 1} 0 obj\n`)).toBe(true);
    });
  });
});
