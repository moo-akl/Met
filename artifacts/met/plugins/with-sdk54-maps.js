// SDK 54's supported react-native-maps version predates its own config plugin.
// Preserve the existing plugin options while using Expo's supported native mods.
const { AndroidConfig, IOSConfig } = require("expo/config-plugins");

module.exports = function withSdk54Maps(config, options = {}) {
  const apiKey = options.androidGoogleMapsApiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("[with-sdk54-maps] androidGoogleMapsApiKey is required.");
  }
  config.android = {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: { ...config.android?.config?.googleMaps, apiKey },
    },
  };
  config = AndroidConfig.GoogleMapsApiKey.withGoogleMapsApiKey(config);
  return IOSConfig.Maps.withMaps(config);
};
