const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { isPathWithin, resolveStaticPath } = require("../static-path");

test("allows files beneath the static root", () => {
  const root = path.join(os.tmpdir(), "met-static-build");

  assert.equal(
    resolveStaticPath(root, "/android/manifest.json"),
    path.join(root, "android", "manifest.json"),
  );
});

test("blocks traversal using literal and percent-encoded dot segments", () => {
  const root = path.join(os.tmpdir(), "met-static-build");

  assert.equal(resolveStaticPath(root, "/../../etc/passwd"), null);
  assert.equal(
    resolveStaticPath(root, "/%2e%2e/%2e%2e/etc/passwd"),
    null,
  );
  assert.equal(
    resolveStaticPath(root, "/%2e%2e/met-static-build-sibling/secret"),
    null,
  );
});

test("rejects malformed encodings and NUL bytes", () => {
  const root = path.join(os.tmpdir(), "met-static-build");

  assert.throws(() => resolveStaticPath(root, "/%E0%A4%A"), URIError);
  assert.throws(() => resolveStaticPath(root, "/%00secret"), URIError);
});

test("uses path boundaries rather than vulnerable string-prefix checks", () => {
  const root = path.join(os.tmpdir(), "static-build");
  const sibling = path.join(os.tmpdir(), "static-build-secret");

  assert.equal(isPathWithin(root, sibling), false);
  assert.equal(isPathWithin(root, path.join(root, "index.html")), true);
});

test("rejects symlinks that resolve outside the static root", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "met-static-test-"));
  const staticRoot = path.join(tempRoot, "static-build");
  const outsideRoot = path.join(tempRoot, "outside");
  const outsideFile = path.join(outsideRoot, "secret.txt");
  const symlinkPath = path.join(staticRoot, "leak.txt");

  try {
    fs.mkdirSync(staticRoot);
    fs.mkdirSync(outsideRoot);
    fs.writeFileSync(outsideFile, "not served");
    fs.symlinkSync(outsideFile, symlinkPath);

    assert.equal(
      isPathWithin(fs.realpathSync(staticRoot), fs.realpathSync(symlinkPath)),
      false,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});