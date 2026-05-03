# GitHub Actions iOS Build (Free Path)

`ios-build.yml` builds the Met iOS app on a free GitHub-hosted macOS runner using `eas build --local`. **Zero EAS cloud credits used** — only your GitHub Actions minutes.

## Free tier budget

GitHub Free / Pro accounts get **2 000 Actions minutes/month**. macOS minutes are billed at **10x**, so you effectively have **~200 macOS minutes/month**. Each iOS build takes ~12–18 minutes, so you get **~10–14 free builds per month**. Beyond that, GitHub charges $0.08/macOS-minute (≈ $1.20–1.50/build).

## One-time setup

### 1. Push this repo to GitHub

Create a private repo on GitHub (`https://github.com/new`) and push:

```bash
git remote add github git@github.com:<your-username>/<repo>.git
git push github main
```

### 2. Add the required secrets

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|---|---|
| `EXPO_TOKEN` | Same value already stored in Replit Secrets. Or generate a new one at https://expo.dev/accounts/moakl/settings/access-tokens |
| `EXPO_ASC_KEY_ID` | `78GT7G5P5A` |
| `EXPO_ASC_ISSUER_ID` | `ace2baad-b6ed-4999-90c5-7f8cf8feb768` |
| `EXPO_APPLE_TEAM_ID` | `AWHU9BTQQX` |
| `EXPO_ASC_API_KEY_BASE64` | base64 of the `.p8` file. Generate with: `base64 -i artifacts/met/.secrets/AuthKey_78GT7G5P5A.p8 \| pbcopy` (Mac) or `base64 -w 0 artifacts/met/.secrets/AuthKey_78GT7G5P5A.p8` (Linux) and paste the resulting string. |

> The `.p8` file itself is **never** committed to git (it's gitignored). The base64 secret is decoded back into a temp file inside the runner.

### 3. (Optional) Verify the secrets list

After adding, you should see exactly **5 secrets** in Actions settings.

## Triggering a build

### Manual (recommended)

1. Go to your GitHub repo → **Actions** tab → **Build iOS .ipa (free macOS runner)** → **Run workflow**.
2. Pick the build profile (`preview:device`, `preview`, `production`, or `development`).
3. Click **Run workflow**. Build takes 12–18 minutes.
4. When green, download the `.ipa` from the run's **Artifacts** section.

### Automatic (tag push)

```bash
git tag ios-build-1
git push github ios-build-1
```

Any tag matching `ios-build-*` triggers a build.

## What the workflow does

1. Checks out the repo on a `macos-15` runner.
2. Selects Xcode 16.x (GitHub's macOS-15 image ships Xcode 16; the build's deployment target is iOS 15.1, so this is fine).
3. Installs pnpm 10.26.1 + Node 20 + EAS CLI 18.9.1 + CocoaPods.
4. Decodes your ASC API key from the base64 secret into the standard `artifacts/met/.secrets/` path.
5. Runs `eas build --platform ios --profile <selected> --local --output met-ios.ipa --non-interactive`.
6. Uploads `met-ios.ipa` as a downloadable artifact (kept 30 days).

The `--local` flag tells EAS to do everything on the GitHub runner instead of EAS Cloud — credentials still come from your EAS account (so no manual provisioning profile / certificate handling), but compilation happens on the free runner.

## Installing the .ipa on a device

The `preview:device` profile produces an Ad Hoc `.ipa`. Three install options:

1. **Apple Configurator 2** (Mac): drag the `.ipa` onto your connected iPhone.
2. **Xcode**: Window → Devices and Simulators → drag `.ipa` onto installed apps.
3. **Diawi / Installonair**: upload the `.ipa`, get an HTTPS install link, open on the iPhone (must be a registered Ad Hoc device — UDID `00008101-000408E13440001E` is already provisioned).

For TestFlight upload, use the `production` profile and run `eas submit -p ios --path met-ios.ipa --non-interactive` after downloading.

## Troubleshooting

- **`eas build` fails authenticating** → `EXPO_TOKEN` is missing or expired. Regenerate at https://expo.dev/accounts/moakl/settings/access-tokens.
- **CocoaPods install errors** → the `gem install cocoapods` step in the workflow handles missing pod binary; if it still fails, the GitHub macOS image was updated and Ruby is incompatible. Pin to `macos-14` instead of `macos-15` in the workflow.
- **`No matching profiles found`** → EAS credentials drift. Run `eas credentials --platform ios` locally and re-sync, then retry.
- **Out of macOS minutes** → wait until the 1st of next month, or fall back to EAS Cloud pay-as-you-go.
