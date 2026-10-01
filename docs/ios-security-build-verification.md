# iOS security-pin verification — 2026-10-01

## Result

The requested dependency-installation, Expo discovery/prebuild, and Metro
bundling checks **passed on a macOS native EAS worker** with the portable
security overrides retained.

The overall device build **failed afterward during Xcode signing**. No signed
IPA was produced, no device installation was tested, and nothing was submitted
to TestFlight or published.

## Reproduction and evidence

- Repository: `moo-akl/Met`.
- Isolated branch: `verify/ios-security-pins-20261001`.
- Verified commit: `11c6707e19e92cf132bffde72f433e17fb72927a`.
- Existing workflow: `.github/workflows/ios-build.yml`.
- Dispatch inputs: `profile=preview:device`, `submit=false`.
- Run: https://github.com/moo-akl/Met/actions/runs/36817186365
- Worker: GitHub macOS runner executing `eas build --local --platform ios`.

Selected safe log evidence (UTC):

| Time | Check | Evidence |
| --- | --- | --- |
| 04:53:47 | Initial frozen workspace installation | `pnpm install --frozen-lockfile`; lockfile up to date, resolution skipped |
| 04:55:28 | EAS pre-install hook | Removed native-binary exclusions; kept portable security overrides |
| 04:55:28 | Root Expo dependency injection | Added `expo@~54.0.34` to root development dependencies |
| 04:56:08 | EAS frozen installation after regeneration | Lockfile up to date, resolution skipped |
| 04:56:43 | Expo prebuild | Finished prebuild |
| 05:01:58 | Library and mobile TypeScript gates | Typecheck passed |
| 05:01:58 | Root Expo discovery | Expo already at workspace root `.bin` |
| 05:02:49 | Metro iOS bundling | Bundled `artifacts/met/index.js`, 3,132 modules, 37,191 ms |

Local `test:metro-assets` passed all nine checks, including regenerated
dependency-graph checks for both Darwin architectures. This does not claim that
native builds ran on both Darwin architectures.

The exact GitHub commit also passed a separate temporary-snapshot preflight:
`pnpm run typecheck:libs` and
`pnpm --filter @workspace/met run typecheck`.

## Branch preparation

The verification branch starts from GitHub's release branch rather than pushing
the diverged local history. It retains the security overrides and corrected
pre-install hook. Its lockfile was regenerated against GitHub's actual
manifests, and missing generated API declarations referenced by the existing
type-check gate were restored without replacing existing remote declarations.

The release branch and release version/build metadata were left unchanged.
Frozen installation, portable security pins, and the type-check gate were not
disabled.

## Separate release blockers

The saved Ad Hoc provisioning profile lacks Push Notifications and Associated
Domains capabilities and their entitlements. Repairing signing requires the
appropriate Apple/Expo credential process; removing app capabilities is not an
acceptable workaround. A successful signed-device archive remains unverified.

The failed EAS local-build output also contained an encoded credential-bearing
job payload. Do not share or reproduce raw failure logs. Review access to the
logs and rotate exposed signing credentials with the owner's approval; prevent
similar payloads from reaching future workflow logs.