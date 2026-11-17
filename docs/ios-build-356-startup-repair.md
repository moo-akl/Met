# iOS build 356: repair Calendar initialization

## Finding

The build-355 on-device report enumerates exactly these native modules:
`ExpoAppleAuthentication`, `ExpoApplication`, `ExpoAsset`, `ExpoBlurView`,
`ExpoFetchModule`, `ExpoModulesCoreJSLogger`, and `ExpoVideoView`.
It cannot access Linking or SplashScreen when loading Router.

The matching build-355 run is
https://github.com/moo-akl/Met/actions/runs/44012925536,
from commit `c36815c69868df0cd2e9c97fe7bbd8d06cc5af46`.
Its retained provider report confirms Linking and SplashScreen were generated
for the expected `Pods-Met` target. Its IPA identifies itself as build 355,
bundle `app.met.founders`, executable `Met`. Both module class names are
also present in the executable. Presence alone does not prove registration.

The native source explains the exact registry cutoff:

1. The resolved provider order begins with Expo Fetch, Apple Authentication,
   Application, Asset, AV's VideoView, and Blur. Together with the core logger,
   these are exactly the seven names in the device report.
2. Calendar is the next module. Camera, Linking, and SplashScreen follow it.
3. Expo Modules Core's `ModuleHolder` runs a module's `OnCreate` before
   `ModuleRegistry.register(holder:)` inserts it into the registry.
4. `expo-calendar` 15.0.8's `CalendarModule.OnCreate` calls
   `initializePermittedEntities()`. That checks **both** Calendar and Reminders
   permission status, without waiting for the user to use the calendar feature.
5. Both native requesters call `EXFatal` when their required usage description
   is absent. iOS 17+ uses the `FullAccess` descriptions; older supported iOS
   versions use the legacy descriptions.
6. The committed Calendar plugin option `remindersPermission: false` deletes
   **both** Reminders descriptions. The actual build-355 IPA confirms both
   Calendar descriptions are present and both Reminders descriptions are absent.

This is a concrete startup configuration defect matching the observed partial
registration. It does not establish that the original build-331 crash had the
same cause; Calendar was introduced later.

## Baseline comparison

The original working build-330 IPA was downloaded from
https://github.com/moo-akl/Met/actions/runs/42985031278 and its embedded build
number verified. Its executable also contains the Linking and SplashScreen
class names. It predates the Calendar dependency and has no Calendar or Reminders
usage descriptions. Therefore the absence of those keys was harmless in that
baseline, but not after introducing this Calendar version.

Build 330 used Xcode 26.3 and build 355 used 26.0.1. That difference is not needed
to explain the demonstrated missing-description defect and is not changed here.

## Smallest repair

- Increment only the iOS build number to 356.
- Replace Calendar's `remindersPermission: false` with an explicit description.
  The existing plugin then emits both required Reminders keys.
- Keep all app features, current native dependencies, provider wiring, signing,
  bundle identity, Android version, and startup diagnostics unchanged.
- Do not patch Expo's provider or skip Calendar registration.

A usage description is not a permission grant or a permission request.
The app continues to request only Calendar access when the user chooses to add
an event. No Reminders access request or new reminders feature is added.

## Regression protection

The existing build-integrity suite now evaluates the installed Calendar config
plugin and checks all four resulting Calendar/Reminders usage descriptions.
This test was run against unchanged build-355 configuration first and failed
specifically on the missing Reminders description. A second test proves that
the old `false` option deletes even manually supplied Info.plist values.

The existing workflow also validates the final device IPA's app identity,
build number and all four descriptions before the normal IPA upload and
TestFlight-submission steps. It fails closed on missing descriptions, mismatched
metadata or unreadable/ambiguous application metadata. It reads no profiles,
keys or signing material. Simulator output is not an IPA and is excluded.

## Verification boundary

Completed on the outgoing source:

- 88 passing Node build/provider/signing-safety/startup/configuration checks;
  one macOS-only synthetic-profile check was skipped on Linux.
- Six Python archive-validation test methods, including binary/XML metadata,
  missing/blank keys, the old missing-Reminders shape, wrong identity/build,
  malformed metadata and ambiguous app archives.
- The archive validator rejected the **actual build-355 IPA** for its missing
  Reminders usage description, with its own build identity supplied.
- All four Calendar/Reminders descriptions, Camera and Microphone descriptions
  are present in the full introspected iOS configuration for build 356.
  Introspection evaluated config mods without generating a native project.
- Shared-library and mobile TypeScript checks passed.
- Five existing calendar behavior tests passed, covering event creation,
  update/deduplication, Android calendar selection, no writable calendar and
  permission denial.
- Production iOS JavaScript/Hermes export completed: 3,504 modules and one
  emitted Hermes bundle. This is a bundle check, not an iPhone launch.
- Package manifests, committed lockfile and native dependencies are unchanged;
  the prior build-355 frozen-install evidence remains applicable.

Source/configuration and archive-fixture checks can establish that the
demonstrated defect is corrected. They cannot guarantee the compiled app has
no later startup exception.

No native build, signing change, TestFlight submission or device test is
performed while preparing this source repair. Accept runtime recovery only
after the exact build-356 binary exposes Calendar, Linking and SplashScreen,
loads Router and reaches a usable screen, including repeated cold starts and
an upgrade retaining existing app data.
