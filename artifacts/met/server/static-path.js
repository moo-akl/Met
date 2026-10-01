const path = require("path");

function isPathWithin(rootPath, candidatePath) {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relativePath = path.relative(root, candidate);

  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function resolveStaticPath(staticRoot, requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  if (decodedPath.includes("\0")) {
    throw new URIError("NUL byte in request path");
  }

  const root = path.resolve(staticRoot);
  const rootedRequestPath = decodedPath.startsWith("/")
    ? decodedPath
    : `/${decodedPath}`;
  const candidatePath = path.resolve(root, `.${rootedRequestPath}`);

  return isPathWithin(root, candidatePath) ? candidatePath : null;
}

module.exports = {
  isPathWithin,
  resolveStaticPath,
};