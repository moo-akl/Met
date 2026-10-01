"use strict";

const { spawnSync } = require("node:child_process");
const { TextDecoder } = require("node:util");

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const MAX_SUBPROCESS_BUFFER = 4 * 1024 * 1024;
const SUBPROCESS_TIMEOUT_MS = 5_000;
const GENERIC_ERROR = "Unable to parse provisioning profile.";

// Python 3 is expected to be installed locally and on GitHub's macos-15 runner.
const PYTHON_PARSER = String.raw`
import base64
import datetime
import json
import math
import plistlib
import sys

def normalize(value):
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    if isinstance(value, datetime.datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=datetime.timezone.utc)
        value = value.astimezone(datetime.timezone.utc)
        return value.isoformat(timespec="auto").replace("+00:00", "Z")
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise ValueError()
        return {key: normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if value is None or isinstance(value, (bool, str, int)):
        return value
    if isinstance(value, float) and math.isfinite(value):
        return value
    raise ValueError()

try:
    parsed = plistlib.loads(sys.stdin.buffer.read())
    if not isinstance(parsed, dict):
        raise ValueError()
    sys.stdout.write(json.dumps(normalize(parsed), ensure_ascii=True, allow_nan=False, separators=(",", ":")))
except Exception:
    sys.exit(1)
`;

function parseProvisioningPlist(xmlBytes, { spawn = spawnSync, maxBuffer } = {}) {
  try {
    if (typeof spawn !== "function") throw new Error();

    let processMaxBuffer = MAX_SUBPROCESS_BUFFER;
    if (maxBuffer !== undefined) {
      if (!Number.isSafeInteger(maxBuffer) || maxBuffer < 1) throw new Error();
      processMaxBuffer = Math.min(maxBuffer, MAX_SUBPROCESS_BUFFER);
    }

    if (!Buffer.isBuffer(xmlBytes) && !(xmlBytes instanceof Uint8Array)) {
      throw new Error();
    }
    const inputBytes = Buffer.from(xmlBytes);
    if (inputBytes.length === 0 || inputBytes.length > MAX_INPUT_BYTES) throw new Error();
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(inputBytes);

    const result = spawn("python3", ["-I", "-c", PYTHON_PARSER], {
      input: xml,
      encoding: "utf8",
      timeout: SUBPROCESS_TIMEOUT_MS,
      maxBuffer: processMaxBuffer,
      windowsHide: true,
    });

    if (!result || result.error || result.status !== 0 || result.signal) throw new Error();
    const stdout = result.stdout;
    const stderr = result.stderr ?? "";
    if (typeof stdout !== "string" && !Buffer.isBuffer(stdout)) throw new Error();
    if (
      (typeof stderr !== "string" && !Buffer.isBuffer(stderr)) ||
      (Buffer.isBuffer(stderr) ? stderr.length : Buffer.byteLength(stderr, "utf8")) > processMaxBuffer
    ) {
      throw new Error();
    }
    const outputBytes = Buffer.isBuffer(stdout)
      ? stdout.length
      : Buffer.byteLength(stdout, "utf8");
    if (outputBytes === 0 || outputBytes > Math.min(MAX_OUTPUT_BYTES, processMaxBuffer)) {
      throw new Error();
    }

    const parsed = JSON.parse(Buffer.isBuffer(stdout) ? stdout.toString("utf8") : stdout);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(GENERIC_ERROR);
  }
}

module.exports = { parseProvisioningPlist };