import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";

const PASSCODE_KEY_LENGTH = 32;
const PASSCODE_SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};
const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

export type EventInviteLinkFields = {
  inviteTokenHash: string;
  inviteTokenEncrypted: string;
  invitePasscodeSalt: string | null;
  invitePasscodeHash: string | null;
};

function getEncryptionKey(): Buffer {
  const sessionSecret = process.env["SESSION_SECRET"];
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required to protect event invitation links.");
  }
  return createHash("sha256").update(sessionSecret).digest();
}

export function isValidEventInviteToken(token: string): boolean {
  return INVITE_TOKEN_PATTERN.test(token);
}

export function hashEventInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function encryptEventInviteToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptEventInviteToken(value: string): string {
  const [encodedIv, encodedTag, encodedCiphertext, extra] = value.split(".");
  if (!encodedIv || !encodedTag || !encodedCiphertext || extra) {
    throw new Error("Stored event invitation link is invalid.");
  }
  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Stored event invitation link is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const token = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  if (!isValidEventInviteToken(token)) {
    throw new Error("Stored event invitation link is invalid.");
  }
  return token;
}

function hashPasscode(passcode: string, salt: Buffer): Buffer {
  return scryptSync(passcode, salt, PASSCODE_KEY_LENGTH, PASSCODE_SCRYPT_OPTIONS);
}

export function createEventInviteLinkFields(
  passcode?: string | null,
): EventInviteLinkFields {
  const token = randomBytes(32).toString("base64url");
  const normalizedPasscode = passcode?.trim() || null;
  if (
    normalizedPasscode &&
    (normalizedPasscode.length < 6 || normalizedPasscode.length > 64)
  ) {
    throw new Error("Passcodes must be between 6 and 64 characters.");
  }
  const passcodeSalt = normalizedPasscode ? randomBytes(16) : null;
  return {
    inviteTokenHash: hashEventInviteToken(token),
    inviteTokenEncrypted: encryptEventInviteToken(token),
    invitePasscodeSalt: passcodeSalt?.toString("hex") ?? null,
    invitePasscodeHash: passcodeSalt && normalizedPasscode
      ? hashPasscode(normalizedPasscode, passcodeSalt).toString("hex")
      : null,
  };
}

export function createEventInvitePasscodeFields(
  passcode: string,
): Pick<EventInviteLinkFields, "invitePasscodeSalt" | "invitePasscodeHash"> {
  const normalizedPasscode = passcode.trim();
  if (normalizedPasscode.length < 6 || normalizedPasscode.length > 64) {
    throw new Error("Passcodes must be between 6 and 64 characters.");
  }
  const salt = randomBytes(16);
  return {
    invitePasscodeSalt: salt.toString("hex"),
    invitePasscodeHash: hashPasscode(normalizedPasscode, salt).toString("hex"),
  };
}

export function verifyEventInvitePasscode(
  suppliedPasscode: string | undefined,
  saltHex: string | null,
  hashHex: string | null,
): boolean {
  if (!hashHex) return true;
  if (!saltHex || !suppliedPasscode || suppliedPasscode.length > 64) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== PASSCODE_KEY_LENGTH) return false;
  const actual = hashPasscode(suppliedPasscode.trim(), Buffer.from(saltHex, "hex"));
  return timingSafeEqual(expected, actual);
}

export function buildEventInviteUrl(token: string): string {
  const baseUrl = (process.env["APP_BASE_URL"] ?? "https://met-app.org").replace(
    /\/+$/,
    "",
  );
  return `${baseUrl}/event-invite/${encodeURIComponent(token)}`;
}
