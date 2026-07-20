// error-setup.js — must be the FIRST import in index.js so the handler
// is registered before expo-router/entry evaluates any app module.
//
// Any fatal JS error (including module-evaluation crashes) will be logged
// to the device console:
//   iOS  → Xcode: Window → Devices and Simulators → your device → Open Console, filter "Met crash"
//   Android → adb logcat | grep "Met crash"
(function () {
  try {
    var origHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler(function (error, isFatal) {
      if (isFatal) {
        try {
          var msg = (error && error.message) ? String(error.message) : String(error);
          var stack = (error && error.stack) ? String(error.stack).slice(0, 1200) : '';
          console.error('[Met crash] ' + msg);
          if (stack) console.error('[Met stack] ' + stack);
        } catch (_) {}
      }
      if (typeof origHandler === 'function') origHandler(error, isFatal);
    });
  } catch (_) {}
})();
