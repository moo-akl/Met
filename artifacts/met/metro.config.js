const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.cacheVersion = "v2";
module.exports = config;
