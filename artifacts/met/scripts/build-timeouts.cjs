// Cold, minified single-worker bundles can take more than five minutes.
// Keep ordinary network downloads shorter, and budget for both platforms
// because the publishing builder compiles iOS and Android sequentially.
const NETWORK_DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const BUNDLE_BUILD_TIMEOUT_MS = 15 * 60_000;
const ALL_PLATFORMS_TIMEOUT_MS =
  2 * BUNDLE_BUILD_TIMEOUT_MS + NETWORK_DOWNLOAD_TIMEOUT_MS + 60_000;

module.exports = {
  NETWORK_DOWNLOAD_TIMEOUT_MS,
  BUNDLE_BUILD_TIMEOUT_MS,
  ALL_PLATFORMS_TIMEOUT_MS,
};
