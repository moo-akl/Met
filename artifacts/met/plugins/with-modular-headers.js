const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Surgical Podfile patches for `@react-native-firebase/*` (v24+) on
 * Expo SDK 54+ with `use_frameworks! :linkage => :static`.
 *
 * History of this plugin:
 *   v1 — added `$RNFirebaseAsStaticFramework = true` + `use_modular_headers!`
 *        + `DEFINES_MODULE = YES` to fix the original "must be imported
 *        from module 'RNFBApp.RNFBAppModule' before required" chain.
 *   v2 (this) — REMOVED `use_modular_headers!` and `DEFINES_MODULE = YES`.
 *        Those two together turned every `<React/RCTBridgeModule.h>` import
 *        in RNFB's `.m` files into a *module* import, which only crosses
 *        types/protocols across the framework boundary — NOT preprocessor
 *        macros. As a result, `RCT_EXTERN`, `RCT_EXPORT_METHOD`, and
 *        `RCT_CONCAT` (defined as macros in RCTBridgeModule.h) became
 *        unknown identifiers at compile time, producing:
 *           - "unknown type name 'RCT_EXTERN'"
 *           - "duplicate declaration of method 'RCT_CONCAT'"
 *           - "expected method body" / "expected ':'"
 *        on Xcode 26 + RNFB 24 + Expo SDK 54.
 *
 * Two minimal injections remain:
 *
 *   1. `$RNFirebaseAsStaticFramework = true` at the top of the Podfile.
 *      This is the official react-native-firebase recommendation when
 *      `use_frameworks! :linkage => :static` is in effect — it tells every
 *      RNFB pod to opt into static framework packaging with its own
 *      module map (instead of forcing it globally).
 *
 *   2. Inside the existing `post_install` block, set
 *      `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` on
 *      every pod target. This suppresses the
 *      `-Wnon-modular-include-in-framework-module` warning-as-error that
 *      otherwise fires when RNFB's framework module headers `#import`
 *      React-Core's textual headers. Without this, the build fails with
 *      "include of non-modular header inside framework module".
 *
 *      We deliberately do NOT add `DEFINES_MODULE = YES` — forcing every
 *      pod (including React-Core) to emit a module map is what flipped
 *      RNFB's React-Core imports into modular ones, stripping the macros.
 */
const STATIC_FRAMEWORK_FLAG = "$RNFirebaseAsStaticFramework = true";

const POST_INSTALL_INJECTION = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end

    # === RNFB v24 React-macro restoration ===
    # When use_frameworks! :linkage => :static is on (required by Firebase iOS SDK),
    # React-Core ships as a static framework with a module map. RNFB's headers
    # transitively load <React/RCTBridgeModule.h> through <RNFBApp/RNFBSharedUtils.h>,
    # which is itself a modular import. Modules export DECLARATIONS (types,
    # protocols, functions) but NOT preprocessor macros. So the macros defined
    # in RCTDefines.h (RCT_EXTERN, RCT_CONCAT, RCT_CONCAT2, RCT_EXTERN_C_BEGIN/END)
    # are invisible at the RNFB .m file's translation-unit scope. When
    # RCT_EXPORT_MODULE() / RCT_EXPORT_METHOD() expand inside the .m file,
    # the expansion contains RCT_EXTERN and RCT_CONCAT — and Clang reports
    # "unknown type name 'RCT_EXTERN'" / "duplicate declaration of method
    # 'RCT_CONCAT'" because those symbols never made it across the module boundary.
    #
    # Fix: prepend the macro definitions to each RNFB pod's auto-generated
    # prefix.pch file. CocoaPods force-includes that pch on every .m/.mm
    # compile in the pod, so the macros become visible at .m scope BEFORE
    # any modular React import runs. The defines are copied verbatim from
    # React-Core's RCTDefines.h to stay byte-identical with what RCTBridgeModule.h's
    # macros expect.
    rnfb_macro_marker = "// RNFB-react-macro-prelude-v2"
    rnfb_macro_prelude = <<~PCH
      #{rnfb_macro_marker}
      #ifdef __OBJC__
      #ifndef RCT_EXTERN
      #if defined(__cplusplus)
      #define RCT_EXTERN extern "C" __attribute__((visibility("default")))
      #define RCT_EXTERN_C_BEGIN extern "C" {
      #define RCT_EXTERN_C_END }
      #else
      #define RCT_EXTERN extern __attribute__((visibility("default")))
      #define RCT_EXTERN_C_BEGIN
      #define RCT_EXTERN_C_END
      #endif
      #endif
      #ifndef RCT_CONCAT
      #define RCT_CONCAT2(A, B) A##B
      #define RCT_CONCAT(A, B) RCT_CONCAT2(A, B)
      #endif
      #ifndef RCT_DEBUG
      #ifdef DEBUG
      #define RCT_DEBUG 1
      #else
      #define RCT_DEBUG 0
      #endif
      #endif
      #ifndef RCT_DEV
      #ifdef DEBUG
      #define RCT_DEV 1
      #else
      #define RCT_DEV 0
      #endif
      #endif
      #ifndef RCT_DYNAMIC
      #if __has_attribute(objc_dynamic)
      #define RCT_DYNAMIC __attribute__((objc_dynamic))
      #else
      #define RCT_DYNAMIC
      #endif
      #endif
      #ifndef RCT_NSASSERT
      #define RCT_NSASSERT RCT_DEBUG
      #endif
      #ifndef RCT_IF_DEV
      #if RCT_DEV
      #define RCT_IF_DEV(...) __VA_ARGS__
      #else
      #define RCT_IF_DEV(...)
      #endif
      #endif
      #ifndef RCT_NOT_IMPLEMENTED
      #define RCT_NOT_IMPLEMENTED(method)                                                                     \\
        _Pragma("clang diagnostic push") _Pragma("clang diagnostic ignored \\"-Wmissing-method-return-type\\"") \\
            _Pragma("clang diagnostic ignored \\"-Wunused-parameter\\"")                                        \\
                RCT_EXTERN NSException *_RCTNotImplementedException(SEL, Class);                              \\
        method NS_UNAVAILABLE                                                                                 \\
        {                                                                                                     \\
          @throw _RCTNotImplementedException(_cmd, [self class]);                                             \\
        }                                                                                                     \\
        _Pragma("clang diagnostic pop")
      #endif
      #endif
    PCH
    installer.pods_project.targets.each do |target|
      next unless target.name.start_with?("RNFB")
      pch_path = File.join(
        installer.sandbox.root,
        "Target Support Files",
        target.name,
        "#{target.name}-prefix.pch"
      )
      next unless File.exist?(pch_path)
      contents = File.read(pch_path)
      next if contents.include?(rnfb_macro_marker)
      File.write(pch_path, rnfb_macro_prelude + contents)
      Pod::UI.message "[with-modular-headers] Patched #{target.name}-prefix.pch with React macro prelude"
    end
`;

const POST_INSTALL_MARKER = "RNFB-react-macro-prelude-v2";

const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );

      let contents = await fs.promises.readFile(podfilePath, "utf8");
      let changed = false;

      // 1. Set `$RNFirebaseAsStaticFramework = true` at the very top of the
      //    Podfile (before any `target` block). Without this, RNFB pods
      //    aren't packaged as static frameworks with module maps, and
      //    downstream pods (RNFBFirestore, RNFBAppCheck) can't find
      //    RNFBApp's exported symbols.
      if (!contents.includes(STATIC_FRAMEWORK_FLAG)) {
        contents = `${STATIC_FRAMEWORK_FLAG}\n${contents}`;
        changed = true;
      }

      // 2. Inject the warning-suppression build setting inside the existing
      //    `post_install do |installer| ... end` block, right after
      //    `react_native_post_install(...)`. This is needed because RNFB
      //    framework modules `#import` React-Core's non-modular headers,
      //    which otherwise trips `-Wnon-modular-include-in-framework-module`.
      if (!contents.includes(POST_INSTALL_MARKER)) {
        const updated = contents.replace(
          /(react_native_post_install\([\s\S]*?\)[ \t]*\n)/,
          `$1${POST_INSTALL_INJECTION}`,
        );
        if (updated === contents) {
          throw new Error(
            "with-modular-headers: could not find `react_native_post_install(...)` call in Podfile to inject build setting after.",
          );
        }
        contents = updated;
        changed = true;
      }

      if (changed) {
        await fs.promises.writeFile(podfilePath, contents);
      }
      return config;
    },
  ]);
};

module.exports = withModularHeaders;
