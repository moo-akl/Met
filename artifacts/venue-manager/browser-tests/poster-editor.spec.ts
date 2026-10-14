import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";

async function setInputValue(input: import("@playwright/test").Locator, value: string) {
  await input.evaluate((element, nextValue) => {
    const field = element as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(field, nextValue);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function expectImagePixel(page: import("@playwright/test").Page, imageDataUrl: string, xRatio: number, yRatio: number) {
  const pixel = await page.evaluate(async ({ dataUrl, x, y }) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable.");
    context.drawImage(image, 0, 0);
    return [...context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data];
  }, { dataUrl: imageDataUrl, x: xRatio, y: yRatio });

  // JPEG output is lossy; still require it to match the selected blue layer, not the red one.
  expect(pixel[0]).toBeLessThan(90);
  expect(pixel[1]).toBeLessThan(125);
  expect(pixel[2]).toBeGreaterThan(180);
}

async function expectImageColor(
  page: import("@playwright/test").Page,
  imageDataUrl: string,
  xRatio: number,
  color: "red" | "blue",
) {
  const pixel = await page.evaluate(async ({ dataUrl, x }) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable.");
    context.drawImage(image, 0, 0);
    return [...context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * 0.25), 1, 1).data];
  }, { dataUrl: imageDataUrl, x: xRatio });

  if (color === "red") {
    expect(pixel[0]).toBeGreaterThan(150);
    expect(pixel[1]).toBeLessThan(120);
    expect(pixel[2]).toBeLessThan(140);
  } else {
    expect(pixel[0]).toBeLessThan(120);
    expect(pixel[1]).toBeLessThan(140);
    expect(pixel[2]).toBeGreaterThan(150);
  }
}

function asDataUrl(bytes: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type);
  const chunk = Buffer.alloc(data.byteLength + 12);
  chunk.writeUInt32BE(data.byteLength, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.byteLength + 8);
  return chunk;
}

function solidPng(hexColor: string) {
  const channels = hexColor.match(/[0-9a-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16));
  if (!channels || channels.length !== 3) throw new Error(`Invalid test image color: ${hexColor}`);
  const width = 100;
  const height = 100;
  const rowLength = 1 + width * 4;
  const pixels = Buffer.alloc(height * rowLength);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      pixels[pixelOffset] = channels[0]!;
      pixels[pixelOffset + 1] = channels[1]!;
      pixels[pixelOffset + 2] = channels[2]!;
      pixels[pixelOffset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function serveHostedPosterImages(
  page: import("@playwright/test").Page,
  options: { holdResponses?: boolean; fail?: boolean } = {},
) {
  let requestedCount = 0;
  let resolveRequestsStarted!: () => void;
  let releaseResponses!: () => void;
  const imageRequestsStarted = new Promise<void>((resolve) => { resolveRequestsStarted = resolve; });
  const responseGate = new Promise<void>((resolve) => { releaseResponses = resolve; });
  await page.route("**/api/storage/objects/uploads/poster-*.png", async (route) => {
    requestedCount += 1;
    if (requestedCount >= 2) resolveRequestsStarted();
    if (options.holdResponses) await responseGate;
    if (options.fail) {
      await route.fulfill({ status: 503, contentType: "text/plain", body: "Image unavailable" });
      return;
    }
    const isRed = route.request().url().endsWith("poster-red.png");
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: solidPng(isRed ? "ee3344" : "2244ee"),
    });
  });
  return { imageRequestsStarted, releaseResponses };
}

function embeddedPdfJpeg(pdf: Buffer) {
  const pdfText = pdf.toString("latin1");
  const imageObject = pdfText.indexOf("/Subtype /Image");
  if (imageObject < 0) throw new Error("Poster PDF does not contain its raster image.");
  const streamStart = pdfText.indexOf("stream\n", imageObject) + "stream\n".length;
  const streamEnd = pdfText.indexOf("\nendstream", streamStart);
  if (streamStart < "stream\n".length || streamEnd < 0) throw new Error("Poster PDF image stream is missing.");
  return pdf.subarray(streamStart, streamEnd);
}

test("restores a venue's saved poster after reload and isolates it from other venues", async ({ page }) => {
  await page.goto("/browser-tests/poster-editor.html");

  await page.getByLabel("Poster headline").fill("Find your people");
  await page.getByLabel("Poster supporting line").fill("Scan in and say hello");
  await page.getByLabel("Poster footer note").fill("Your next good conversation starts here.");
  await page.getByRole("button", { name: "Sans", exact: true }).click();
  await setInputValue(page.getByLabel("Headline font size"), "42");
  await setInputValue(page.getByLabel("Body font size"), "19");
  await setInputValue(page.getByLabel("Text color"), "#123456");
  await setInputValue(page.getByLabel("Accent color"), "#8a2345");
  await setInputValue(page.getByLabel("Paper color"), "#f1e2d3");
  await setInputValue(page.getByLabel("QR ink color"), "#101010");
  await page.getByLabel("Upload venue logo").setInputFiles({
    name: "venue-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("browser-test-logo"),
  });
  await page.getByLabel("Upload decorative image").setInputFiles({
    name: "poster-artwork.png",
    mimeType: "image/png",
    buffer: Buffer.from("browser-test-artwork"),
  });

  await page.getByRole("button", { name: "Save design" }).click();
  await expect(page.getByText("Poster design saved.", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Poster headline")).toHaveValue("Find your people");
  await expect(page.getByLabel("Poster supporting line")).toHaveValue("Scan in and say hello");
  await expect(page.getByLabel("Poster footer note")).toHaveValue("Your next good conversation starts here.");
  await expect(page.getByRole("button", { name: "Sans", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Headline font size")).toHaveValue("42");
  await expect(page.getByLabel("Body font size")).toHaveValue("19");
  await expect(page.getByLabel("Text color")).toHaveValue("#123456");
  await expect(page.getByLabel("Accent color")).toHaveValue("#8a2345");
  await expect(page.getByLabel("Paper color")).toHaveValue("#f1e2d3");
  await expect(page.getByLabel("QR ink color")).toHaveValue("#101010");

  const restoredPoster = page.getByRole("article", { name: "Poster preview for Cedar House" });
  await expect(restoredPoster).toContainText("Find your people");
  await expect(restoredPoster).toContainText("Scan in and say hello");
  await expect(restoredPoster).toContainText("Your next good conversation starts here.");
  await expect(restoredPoster).toHaveCSS("background-color", "rgb(241, 226, 211)");
  await expect(restoredPoster).toHaveCSS("color", "rgb(18, 52, 86)");
  await expect(restoredPoster).toHaveCSS("font-family", /DM Sans/);
  await expect(restoredPoster.locator(".vqp-poster-heading")).toHaveCSS("font-size", "19px");
  await expect(restoredPoster.locator(".vqp-venue-name")).toHaveCSS("font-size", "42px");
  await expect(restoredPoster.getByRole("group", { name: "Venue logo poster image; drag to move or use arrow keys" }).locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml,/);
  await expect(restoredPoster.getByRole("group", { name: /Decorative image 1 poster image/ }).locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml,/);

  await page.getByLabel("Choose venue").selectOption("harbor-studio");
  await expect(page.getByLabel("Poster headline")).toHaveValue("Welcome to");
  await expect(page.getByLabel("Poster supporting line")).toHaveValue("Check in at Cedar House");
  await expect(page.getByLabel("Poster footer note")).toHaveValue("Meet your community, one check-in at a time.");
  await expect(page.getByRole("button", { name: "Serif", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Headline font size")).toHaveValue("36");
  await expect(page.getByLabel("Body font size")).toHaveValue("16");
  await expect(page.getByLabel("Text color")).toHaveValue("#183c2f");
  await expect(page.getByLabel("Accent color")).toHaveValue("#26735a");
  await expect(page.getByLabel("Paper color")).toHaveValue("#f8f7ef");
  await expect(page.getByLabel("QR ink color")).toHaveValue("#111111");
  await expect(page.locator(".vqp-image-layer")).toHaveCount(0);
});

test("exports overlapping hosted venue images in JPG, PNG, PDF, and print rendering", async ({ page }) => {
  const hostedImages = await serveHostedPosterImages(page, { holdResponses: true });
  await page.goto("/browser-tests/poster-editor.html?layers=hosted", { waitUntil: "domcontentloaded" });
  await hostedImages.imageRequestsStarted;
  await page.getByRole("button", { name: "Bring decorative image 1 forward" }).click();

  const poster = page.getByRole("article", { name: "Poster preview for Cedar House" });
  const orderedImageUrls = await poster.locator(".vqp-image-layer img").evaluateAll((images) =>
    images.map((image) => (image as HTMLImageElement).getAttribute("src") ?? ""),
  );
  expect(orderedImageUrls).toHaveLength(2);
  expect(orderedImageUrls[0]).toContain("/api/storage/objects/uploads/poster-red.png");
  expect(orderedImageUrls[1]).toContain("/api/storage/objects/uploads/poster-blue.png");

  for (const format of ["jpg", "png", "pdf"] as const) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: format === "jpg" ? "Save JPG" : `Export ${format.toUpperCase()}` }).click();
    if (format === "jpg") {
      await expect(page.locator(".vqp-export-status")).toContainText("Preparing your JPG");
      hostedImages.releaseResponses();
    }
    const download = await downloadPromise;
    const path = await download.path();
    if (!path) throw new Error(`${format.toUpperCase()} export was not downloaded.`);
    const bytes = await readFile(path);
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    const imageBytes = format === "pdf" ? embeddedPdfJpeg(bytes) : bytes;
    const exportedImage = asDataUrl(imageBytes, mimeType);
    await expectImageColor(page, exportedImage, 0.07, "red");
    await expectImageColor(page, exportedImage, 0.37, "blue");
    await expectImagePixel(page, exportedImage, 0.22, 0.25);
  }

  await page.evaluate(() => {
    window.print = () => window.dispatchEvent(new Event("beforeprint"));
  });
  await page.getByRole("button", { name: "Print" }).click();
  await expect(poster).toHaveClass(/vqp-poster/);
  await page.emulateMedia({ media: "print" });
  const printImage = await poster.screenshot();
  const printedImage = asDataUrl(printImage, "image/png");
  await expectImageColor(page, printedImage, 0.07, "red");
  await expectImageColor(page, printedImage, 0.37, "blue");
  await expectImagePixel(page, printedImage, 0.22, 0.25);
});

test("surfaces hosted image failures and does not download a partial poster", async ({ page }) => {
  await serveHostedPosterImages(page, { fail: true });
  await page.goto("/browser-tests/poster-editor.html?layers=hosted");
  const downloadPromise = page.waitForEvent("download", { timeout: 1_000 }).catch(() => null);

  await page.getByRole("button", { name: "Save JPG" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not load poster image");
  expect(await downloadPromise).toBeNull();
});

test("lets managers move and resize poster images, saves the layout, and keeps it per venue", async ({ page }) => {
  await page.goto("/browser-tests/poster-editor.html");
  await page.getByLabel("Upload venue logo").setInputFiles({
    name: "venue-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("browser-test-logo"),
  });
  await page.getByLabel("Upload decorative image").setInputFiles({
    name: "poster-artwork.png",
    mimeType: "image/png",
    buffer: Buffer.from("browser-test-artwork"),
  });

  const poster = page.getByRole("article", { name: "Poster preview for Cedar House" });
  const decoration = poster.getByRole("group", { name: /Decorative image 1 poster image/ });
  const originalDecorationPosition = await decoration.evaluate((element) => ({
    left: (element as HTMLElement).style.left,
    top: (element as HTMLElement).style.top,
  }));
  await decoration.focus();
  await page.keyboard.press("ArrowLeft");
  const movedDecorationLeft = await decoration.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
  expect(movedDecorationLeft).toBe(Number.parseFloat(originalDecorationPosition.left) - 1);

  await page.getByRole("button", { name: "Select logo" }).click();
  const logo = poster.getByRole("group", { name: "Venue logo poster image; drag to move or use arrow keys" });
  const initialPosition = await logo.evaluate((element) => {
    const layer = element as HTMLElement;
    return { left: Number.parseFloat(layer.style.left), top: Number.parseFloat(layer.style.top) };
  });
  await poster.scrollIntoViewIfNeeded();
  const logoBounds = await logo.boundingBox();
  if (!logoBounds) throw new Error("Logo layer is missing its poster bounds.");
  await page.mouse.move(logoBounds.x + logoBounds.width / 2, logoBounds.y + logoBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(logoBounds.x + logoBounds.width / 2 + 18, logoBounds.y + logoBounds.height / 2 + 18);
  await page.mouse.up();
  const movedPosition = await logo.evaluate((element) => {
    const layer = element as HTMLElement;
    return { left: Number.parseFloat(layer.style.left), top: Number.parseFloat(layer.style.top) };
  });
  expect(movedPosition.left).toBeGreaterThan(initialPosition.left);
  expect(movedPosition.top).toBeGreaterThan(initialPosition.top);

  const initialWidth = await logo.evaluate((element) => Number.parseFloat((element as HTMLElement).style.width));
  const resizeHandle = logo.getByRole("button", { name: "Resize venue logo" });
  const handleBounds = await resizeHandle.boundingBox();
  if (!handleBounds) throw new Error("Logo resize handle is missing.");
  await page.mouse.move(handleBounds.x + handleBounds.width / 2, handleBounds.y + handleBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBounds.x + handleBounds.width / 2 + 12, handleBounds.y + handleBounds.height / 2 + 12);
  await page.mouse.up();
  const resizedWidth = await logo.evaluate((element) => Number.parseFloat((element as HTMLElement).style.width));
  expect(resizedWidth).toBeGreaterThan(initialWidth);

  await page.getByRole("button", { name: "Save design" }).click();
  await expect(page.getByText("Poster design saved.", { exact: true })).toBeVisible();
  await page.reload();

  const restoredLogo = page.getByRole("article", { name: "Poster preview for Cedar House" })
    .getByRole("group", { name: "Venue logo poster image; drag to move or use arrow keys" });
  await expect(restoredLogo).toHaveAttribute("style", new RegExp(`left: ${movedPosition.left}%`));
  await expect(restoredLogo).toHaveAttribute("style", new RegExp(`width: ${resizedWidth}%`));
  const restoredDecoration = page.getByRole("article", { name: "Poster preview for Cedar House" })
    .getByRole("group", { name: /Decorative image 1 poster image/ });
  await expect.poll(() => restoredDecoration.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left)))
    .toBe(movedDecorationLeft);

  await page.getByLabel("Choose venue").selectOption("harbor-studio");
  await expect(page.locator(".vqp-image-layer")).toHaveCount(0);
});
