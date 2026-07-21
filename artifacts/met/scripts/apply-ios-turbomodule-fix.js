#!/usr/bin/env node
/**
 * Directly edits RCTTurboModule.mm to fix the iOS 26 SIGABRT.
 *
 * patch-package is unreliable in CI because its diff parser is strict.
 * This script edits the file directly after pnpm install, ensuring the
 * fix is always applied regardless of how node_modules was created.
 *
 * The fix: replace the throw in performVoidMethodInvocation's catch block
 * with RCTLogError, preventing NSException -> C++ exception -> SIGABRT
 * on the turbomodulemanager.queue when Hermes tries to create a JS error
 * object on iOS 26's changed memory layout.
 */

const fs = require("node:fs");
const path = require("node:path");

const TARGET_FILE =
  "node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm";

function main() {
  const cwd = process.cwd();
  const filePath = path.join(cwd, TARGET_FILE);

  if (!fs.existsSync(filePath)) {
    console.log("[turbomodule-fix] RCTTurboModule.mm not found — skipping (not an iOS build)");
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");

  const oldBlock = `    } @catch (NSException *exception) {
      throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);
    } @finally {`;

  const newBlock = `    } @catch (NSException *exception) {
      // PATCH: Do NOT rethrow NSExceptions from void async methods.
      // Void methods return nothing to JS, so rethrowing here causes an
      // uncatchable C++ exception on background queues -> SIGABRT on iOS 26.
      // See: https://github.com/facebook/react-native/issues/54859
      // See: https://github.com/reactwg/react-native-new-architecture/discussions/276
      RCTLogError(@"[TurboModule] Exception in void method %s::%s - %@",
                  moduleName, methodNameStr.c_str(), exception);
    } @finally {`;

  if (!content.includes(oldBlock)) {
    if (content.includes(newBlock)) {
      console.log("[turbomodule-fix] Patch already applied — skipping");
      return;
    }
    console.error("[turbomodule-fix] ERROR: Could not find target code block in RCTTurboModule.mm");
    process.exit(1);
  }

  // Replace only the first occurrence (the one in performVoidMethodInvocation,
  // not the one in the sync method)
  const idx = content.indexOf(oldBlock);
  content = content.slice(0, idx) + newBlock + content.slice(idx + oldBlock.length);

  fs.writeFileSync(filePath, content);
  console.log("[turbomodule-fix] Applied iOS 26 TurboModule fix to RCTTurboModule.mm");
}

main();
