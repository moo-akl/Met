---
name: iOS startup SIGABRT causes
description: Distinguishes the React Native TurboModule crash from Expo Updates ErrorRecovery failures.
---

# iOS Startup SIGABRT Causes

## React Native TurboModule crash

When the same app code crashes only after a different iOS build, suspect an updated Xcode image if the crash points to a void async TurboModule method.

**Why:** Xcode 26 build images exposed a React Native bug where void async TurboModule methods rethrow `NSException` as an uncatchable C++ exception on a background queue.

**Fix:** `artifacts/met/plugins/with-ios-turbomodule-patch.js` applies the `RCTTurboModule.mm` change with `withDangerousMod` during prebuild. Do not restore `pnpm.patchedDependencies`; its `patch_hash` path suffix breaks Android Prefab.

## Expo Updates ErrorRecovery is a separate failure

Do not assume that the user's working baseline excluded `expo-updates`. The user identifies build 330 as the last working build; its GitHub manifest and lockfile include Expo Updates.

**Why:** Comparing the actual working baseline contradicted the earlier dependency-removal explanation. Expo Updates can abort while recovering from an earlier JavaScript or bundle-load failure, hiding the original exception; its presence alone is not a demonstrated regression.

**How to apply:** Match the archive, source revision, effective worker dependencies, and original startup exception before recommending a package change. Do not remove or reintroduce Updates just because its recovery code appears in the terminating stack.

## Working baseline and toolchain claims

Build 330 is the historical pre-regression comparison, not a permanent release
baseline: the user subsequently confirmed the app works again after the
Calendar-initialization and diagnostic-render-loop repairs. Use the latest
user-confirmed working release for future regression comparisons. Do not
attribute build 330's immediate successor's failure to an Xcode version change
without checking the selected compiler in both actual run logs.

**Why:** The user explicitly says the app worked through build 330. The working baseline and first failing successor runs selected the same Xcode version; the build profile's image name was not proof of the actual selected toolchain.

**How to apply:** Compare executed inputs, not configuration labels, and keep source compilation, native launch, and submission failures separate. A generic GraphQL error while waiting for submission does not prove Apple rejected the binary.

## Diagnostic checklist for silent iOS crash
1. Does the crash point to a TurboModule exception? → Check the Xcode-image issue above.
2. Does it end in Expo Updates `ErrorRecovery.crash()`? → Find the original JavaScript or bundle-loading error; the recovery stack is not its cause.
3. New native package added without EAS rebuild? → `[RN Firebase new native module crash]`.
4. Duplicate build number uploaded? → `[TestFlight duplicate build number crash]`.
5. App Check enforcement enabled? → `[App Check enforcement blocks Firestore]`.

## Match evidence to the tested binary

Verify the crash report's embedded build number before using its stack to explain
a newer failure. A logo-only hang without process termination may not create a
new crash report at all; do not treat an older ErrorRecovery abort as its cause.

**Why:** A report uploaded during a newer build's permanent-logo investigation
still described an older binary with a different failure path.

**How to apply:** Match the report version, tested build and build-run commit.
When no matching report exists and live device logs are unavailable, use an
explicitly identified diagnostic build rather than another unverified root-cause
claim. Native failures before JavaScript starts cannot be caught by JS handlers.

## Diagnostic reports under React Compiler

Derive diagnostic text from the subscribed React snapshot, not an opaque read of
a mutable singleton during render.

**Why:** Production React Compiler cached a report formatter with constant
arguments on its first render. A shared report continued to say “JavaScript
entry reached / starting” even though later screen state could show a failure.
The report alone therefore did not locate the launch failure.

**How to apply:** Verify diagnostic updates with compiler-enabled rerenders,
not only uncompiled server-rendered snapshots. If an affected binary is already
installed, request the visible stage/error in a screenshot before requiring
another diagnostic build.

## Native lookup errors do not prove missing compiled code

For a `Cannot find native module` startup error, distinguish package discovery,
compiled code, generated provider references, and runtime module access.

**Why:** A matching iOS archive contained ExpoLinking's native class and a
generated provider reference to its metadata, while its device report still
said the module could not be found. Merely adding the existing dependency again
would not explain that evidence. Expo's optional native lookups can hide earlier
initialization failures behind a later required-module error.

**How to apply:** Verify the installed binary's build number and inspect its
native module/provider evidence before claiming autolinking omitted a package.
Capture module-installation warnings and runtime availability when the compiled
module exists; do not call the first missing-module message the underlying cause.

A live `global.expo.modules` object proves only that the core runtime exists,
not that the application's modules provider registered its modules. When several
unrelated modules are unavailable, inspect the shared registration path rather
than adding each missing package separately.

**Why:** Device diagnostics showed an available Expo runtime while both Linking
and SplashScreen were inaccessible, without a captured loader warning.

**How to apply:** Keep dependency validation, autolinking/provider checks and
JavaScript release exports separate from device verification. Passing those
checks can support a repair candidate, but cannot establish that native module
registration now succeeds on the iPhone.

## Interpret the native inventory correctly

In this SDK's iOS implementation, enumerating `global.expo.modules` reads the
AppContext's registered module names, not just modules previously imported by
JavaScript. A small inventory combined with failed fixed-name lookups is evidence
of an incomplete registry exposed to that runtime.

**Why:** The user's device report showed some Expo modules available while
Linking and SplashScreen were absent. The native host-object implementation
enumerates the registry directly; lazy module-object creation does not explain
the missing names. Source dependency determinism safeguards did not restore access.

**How to apply:** Investigate the matching binary's provider selection,
registration and AppContext identity. Do not conclude that all Expo registration
failed, that missing names merely have not been imported, or that generated
provider source alone proves registration into the active runtime.

## A partial registry can mean an initializer interrupted registration

When the registered names exactly match the beginning of the provider's module
order, inspect the **next** module's initialization before changing providers.
Expo runs module-create callbacks before inserting that module into the registry;
an Objective-C fatal error there can prevent all later modules from registering.

**Why:** Device evidence stopped immediately before Calendar, while Linking and
SplashScreen were both generated and present in the binary. This SDK's Calendar
initialization checks both Calendar and Reminders permission status even when
the app never requests Reminders access. Suppressing the Reminders usage strings
therefore causes a fatal path during startup, not merely a disabled feature.

**How to apply:** Check installed native initializer behavior and the actual
archive's usage descriptions. A missing downstream module does not necessarily
need a provider patch or a dependency reinstall. Distinguish required privacy
declarations from requesting, granting or using a permission.

## Keep startup diagnostics out of the router's render ancestry

Subscribe to startup progress in a sibling overlay, not in the component that
renders Router. Repeated reports of an unchanged stage must not emit a new
snapshot.

**Why:** After native registration recovered, the device reported a maximum
update depth error with rapid repeated font-loading stages. Updating the
diagnostic parent could reenter Router's route reconstruction, remount the
layout, and trigger its reporting effect again. A mounted React harness
reproduced the exception; server-rendered diagnostic tests had missed it.

**How to apply:** For changes to startup instrumentation, exercise mounted
effects and external-store subscriptions with production compiler transforms.
Verify real diagnostic updates do not rerender Router or remount the layout,
and dismissing the overlay preserves the running app.

## Preserve the confirmed recovery in future releases

The user confirmed the app was working again after both repairs and explicitly
asked that future builds not repeat these issues. Preserve both independent
safeguards: validate Calendar and Reminders privacy descriptions in the final
archive, and run mounted diagnostic-render regressions with production compiler
transforms. Passing dependency checks, TypeScript, or a JavaScript export alone
is not a substitute for either safeguard or for a real-device launch check.

**Why:** The user asked to retain the causes and prevent recurrence. The missing
native modules and later React loop were separate startup blockers, so fixing
only one does not establish reliable startup.

**How to apply:** Do not remove, bypass, or weaken these release checks to make a
build pass. Compare native initialization changes against a working release,
preserve unchanged startup behavior, and distinguish automated prevention from
device verification; do not promise that every future build is bug-free.
