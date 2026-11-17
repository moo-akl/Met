# iOS build 357: isolate startup diagnostics from the router

Build 356's device report confirms 45 registered native modules, including
Calendar, Linking and SplashScreen. It then reports React's maximum update
depth error, with repeated font-loading stage entries milliseconds apart.

## Cause and repair

The diagnostic root subscribed to the startup tracker and rendered Router as
its child. Each layout mount reported the font-loading stage, which emitted a
new tracker snapshot even when unchanged. That rerendered the diagnostic root.
The installed Router reconstructs route nodes in `useStore`; its qualified
component cache uses route-object identity. Reentering Router can therefore
remount the layout and repeat the cycle before fonts finish loading.

The repair moves the subscription into a sibling diagnostic overlay. Tracker
updates no longer rerender the router's parent. Repeating the current stage
also preserves the snapshot and does not notify subscribers. The initial
JavaScript-entry stage and actual transitions still enter report history.
The overlay remains mounted as a component when ready and returns null, so
closing it does not alter the router's position or unmount the running app.

Only the iOS build number advances, to 357. Existing font loading, fallback,
permissions (including the build-356 repair), native dependencies, signing,
app identity, Android version and user-data behavior are unchanged.

## Verification

The new mounted React regression harness reproduced the maximum-update-depth
exception before the repair, with production compiler transforms both enabled
and disabled. It runs the real diagnostic root and installed route-tree builder,
with a router model matching the installed per-route WeakMap identity pattern;
it is not a complete native Router or iPhone test.

After repair the harness verifies a single layout mount, no router rerenders
from changed diagnostic snapshots, visible timeout/error reports, redaction,
successful overlay dismissal without unmounting the app, first-error retention,
and timer cleanup. A tracker regression verifies repeated phases preserve
snapshot identity while real transitions remain visible. Both startup suites
now run in the existing iOS pre-build check.

The combined local checks passed 93 Node tests, with one macOS-only test skipped,
plus six Python archive-validation methods invoked by the integrity suite.
Shared-library and mobile TypeScript checks passed. The production iOS export
bundled 3,504 modules and emitted a Hermes bundle.

Local checks and a JavaScript export cannot prove iPhone launch success.
The resulting build-357 binary still needs a physical-device cold-start and
upgrade check. No native build or submission is performed by this source repair.
