import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const EVENT_CHECKIN_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

function getEncryptionKey(): Buffer {
  const sessionSecret = process.env["SESSION_SECRET"];
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required to protect event check-in codes.");
  }
  return createHash("sha256").update(sessionSecret).digest();
}

export function isValidEventCheckinToken(token: string): boolean {
  return EVENT_CHECKIN_TOKEN_PATTERN.test(token);
}

export function hashEventCheckinToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptEventCheckinToken(value: string): string {
  const [encodedIv, encodedTag, encodedCiphertext, extra] = value.split(".");
  if (!encodedIv || !encodedTag || !encodedCiphertext || extra) {
    throw new Error("Stored event check-in code is invalid.");
  }
  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Stored event check-in code is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const token = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  if (!isValidEventCheckinToken(token)) {
    throw new Error("Stored event check-in code is invalid.");
  }
  return token;
}

export function createEventCheckinLinkFields() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    checkinTokenHash: hashEventCheckinToken(token),
    checkinTokenEncrypted: encryptToken(token),
  };
}

export function buildEventCheckinUrl(token: string): string {
  const baseUrl = (process.env["APP_BASE_URL"] ?? "https://met-app.org").replace(
    /\/+$/,
    "",
  );
  return `${baseUrl}/event-check-in/${encodeURIComponent(token)}`;
}
