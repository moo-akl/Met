---
name: Firebase CLI v1+v2 mixed functions crash
description: firebase-tools 14.3.0 crashes when deploying to a project that has both extension (v1) functions and v2 functions. Workaround via Node.js --require monkey-patch.
---

## The bug

`firebase deploy --only functions:X` crashes with:
```
TypeError: Cannot read properties of undefined (reading 'runtime')
```

Root cause: `cloudfunctionsv2.js` `endpointFromFunction()` (line ~345) reads `gcfFunction.buildConfig.runtime` without guarding against `buildConfig` being undefined. Extension-managed functions (v1-style) returned by the v2 list API don't have `buildConfig`.

**Why:** Firebase-tools 14.3.0 has a known bug when projects have Firebase Extensions (which register as v1 functions) alongside v2 Cloud Functions.

## Workaround

Create `/tmp/firebase-patch.js`:
```js
const Module = require('module');
const originalLoad = Module.prototype.load;
Module.prototype.load = function(filename) {
  originalLoad.call(this, filename);
  if (filename.endsWith('/gcp/cloudfunctionsv2.js')) {
    const orig = this.exports.endpointFromFunction;
    if (typeof orig === 'function') {
      this.exports.endpointFromFunction = function(gcfFunction) {
        if (!gcfFunction || !gcfFunction.buildConfig) return null;
        return orig(gcfFunction);
      };
    }
  }
  if (filename.endsWith('/gcp/cloudfunctions.js')) {
    const orig = this.exports.endpointFromFunction;
    if (typeof orig === 'function') {
      this.exports.endpointFromFunction = function(gcfFunction) {
        if (!gcfFunction) return null;
        return orig(gcfFunction);
      };
    }
  }
};
```

Then deploy:
```bash
FBJS="/nix/store/3fpqrq7ngq6ssmaa36hi4lkssyarf9al-firebase-tools-14.3.0/lib/node_modules/firebase-tools/lib/bin/firebase.js"
node --require /tmp/firebase-patch.js "$FBJS" deploy --only functions:sendChatMessageNotification --project metapp-b4642
```

**How to apply:** Any time `firebase deploy` crashes with the `runtime` TypeError on this project. The Nix store path for firebase-tools is hardcoded above — verify with `which firebase` if the Nix hash changes.
