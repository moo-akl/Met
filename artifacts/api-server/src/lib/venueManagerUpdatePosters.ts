import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

type PosterDocument = InstanceType<typeof PDFDocument>;

export type VenuePosterInput = {
  placeName: string;
  qrUrl: string;
};

type PosterStyle = "garden" | "midnight";

const regularFontPath =
  process.env["VENUE_POSTER_FONT_PATH"] ??
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const boldFontPath =
  process.env["VENUE_POSTER_BOLD_FONT_PATH"] ??
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

function registerFonts(doc: PosterDocument): { regular: string; bold: string } {
  if (existsSync(regularFontPath) && existsSync(boldFontPath)) {
    doc.registerFont("VenuePosterRegular", regularFontPath);
    doc.registerFont("VenuePosterBold", boldFontPath);
    return { regular: "VenuePosterRegular", bold: "VenuePosterBold" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

function drawQr(
  doc: PosterDocument,
  qrUrl: string,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const { modules } = QRCode.create(qrUrl, { errorCorrectionLevel: "H" });
  const quietZone = 4;
  const scale = size / (modules.size + quietZone * 2);
  const origin = x + quietZone * scale;
  const top = y + quietZone * scale;

  doc.save();
  doc.rect(x, y, size, size).fill("#ffffff");
  doc.fillColor(color);
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.data[row * modules.size + column] === 0) continue;
      doc.rect(
        origin + column * scale,
        top + row * scale,
        scale + 0.15,
        scale + 0.15,
      ).fill();
    }
  }
  doc.restore();
}

function drawVenueName(
  doc: PosterDocument,
  placeName: string,
  y: number,
  font: string,
  color: string,
): void {
  const maxLineLength = Math.max(...placeName.split(/\s+/).map((word) => word.length), 1);
  const fontSize = Math.max(22, Math.min(38, 1100 / maxLineLength));
  doc.font(font).fontSize(fontSize).fillColor(color);
  doc.text(placeName, 52, y, {
    width: 491,
    align: "center",
    lineGap: 4,
    ellipsis: true,
  });
}

function drawGardenPoster(
  doc: PosterDocument,
  venue: VenuePosterInput,
  fonts: { regular: string; bold: string },
): void {
  const width = 595.28;
  const height = 841.89;
  const green = "#285c46";

  doc.rect(0, 0, width, height).fill("#fffefa");
  doc.roundedRect(32, 32, width - 64, height - 64, 26)
    .lineWidth(1.25)
    .stroke("#dce8dd");

  doc.circle(width / 2, 85, 20).fill(green);
  doc.font(fonts.bold).fontSize(25).fillColor("#ffffff")
    .text("m", width / 2 - 11, 69, { width: 22, align: "center" });
  doc.font(fonts.bold).fontSize(10).fillColor(green)
    .text("MET COMMUNITY", 0, 116, { width, align: "center", characterSpacing: 2 });
  doc.font(fonts.bold).fontSize(12).fillColor("#668273")
    .text("WELCOME TO", 0, 174, { width, align: "center", characterSpacing: 2.4 });

  drawVenueName(doc, venue.placeName, 207, fonts.bold, "#183d31");
  doc.font(fonts.regular).fontSize(15).fillColor("#526c5e")
    .text(`Check in at ${venue.placeName}`, 56, 280, { width: width - 112, align: "center" });

  const qrSize = 306;
  const qrX = (width - qrSize) / 2;
  const qrY = 334;
  doc.roundedRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 18)
    .fill("#ffffff")
    .lineWidth(1)
    .stroke("#e2e9e2");
  drawQr(doc, venue.qrUrl, qrX, qrY, qrSize, "#111111");

  doc.font(fonts.bold).fontSize(17).fillColor("#285c46")
    .text("Save your name forever and connect.", 44, 683, { width: width - 88, align: "center" });
  doc.font(fonts.regular).fontSize(13).fillColor("#668273")
    .text("Scan to check in with Met", 44, 713, { width: width - 88, align: "center" });
  doc.moveTo(116, 766).lineTo(width - 116, 766).lineWidth(1).stroke("#dce8dd");
  doc.font(fonts.regular).fontSize(11).fillColor("#71877b")
    .text("Meet your community, one check-in at a time.", 44, 785, { width: width - 88, align: "center" });
}

function drawMidnightPoster(
  doc: PosterDocument,
  venue: VenuePosterInput,
  fonts: { regular: string; bold: string },
): void {
  const width = 595.28;
  const height = 841.89;
  const gold = "#d9be70";
  const green = "#8fb9a4";

  doc.rect(0, 0, width, height).fill("#0f0f13");
  doc.roundedRect(32, 32, width - 64, height - 64, 26)
    .lineWidth(1.2)
    .stroke("#34333a");

  doc.save();
  doc.strokeColor("#25252b").lineWidth(0.5);
  for (let x = 72; x < width - 40; x += 30) {
    doc.moveTo(x, 66).lineTo(x, height - 66).stroke();
  }
  for (let y = 66; y < height - 66; y += 30) {
    doc.moveTo(48, y).lineTo(width - 48, y).stroke();
  }
  doc.restore();

  doc.font(fonts.bold).fontSize(12).fillColor(gold)
    .text("CHECK IN", 0, 116, { width, align: "center", characterSpacing: 3 });
  drawVenueName(doc, venue.placeName, 160, fonts.bold, "#f5f1e5");
  doc.font(fonts.regular).fontSize(14).fillColor("#b8b4aa")
    .text("Save your name forever and connect.", 46, 251, { width: width - 92, align: "center" });

  const qrSize = 306;
  const qrX = (width - qrSize) / 2;
  const qrY = 302;
  doc.roundedRect(qrX - 17, qrY - 17, qrSize + 34, qrSize + 34, 18)
    .fill("#ffffff")
    .lineWidth(1.5)
    .stroke(gold);
  drawQr(doc, venue.qrUrl, qrX, qrY, qrSize, "#111111");

  doc.circle(width / 2 - 17, 682, 17).fill(green);
  doc.font(fonts.bold).fontSize(22).fillColor("#111111")
    .text("m", width / 2 - 25, 668, { width: 16, align: "center" });
  doc.font(fonts.bold).fontSize(23).fillColor("#f5f1e5")
    .text("met", width / 2 + 7, 668, { width: 55 });
  doc.moveTo(100, 728).lineTo(width - 100, 728).lineWidth(1).stroke("#34333a");
  doc.font(fonts.regular).fontSize(11).fillColor("#b8b4aa")
    .text("SCAN TO CHECK IN      ·      DISCOVER MORE", 44, 754, {
      width: width - 88,
      align: "center",
      characterSpacing: 1,
    });
}

export async function createVenueManagerUpdatePosterPack(
  venues: VenuePosterInput[],
): Promise<Buffer> {
  if (venues.length === 0) throw new Error("At least one active venue is required for a poster pack.");

  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    autoFirstPage: false,
    info: { Title: "Met Check In QR posters" },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const fonts = registerFonts(doc);

  for (const venue of venues) {
    if (!venue.placeName.trim() || !/^https?:\/\//i.test(venue.qrUrl)) {
      throw new Error("A venue name and valid check-in QR URL are required.");
    }
    doc.addPage({ size: "A4", margin: 0 });
    drawGardenPoster(doc, venue, fonts);
    doc.addPage({ size: "A4", margin: 0 });
    drawMidnightPoster(doc, venue, fonts);
  }

  doc.end();
  return output;
}
