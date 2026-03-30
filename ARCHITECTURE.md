# Architecture

For local setup and running tests, see README.md.

## Repository Structure

```
.github/workflows/       # CI workflows (see Workflows section below)
run/
  test/
    specs/               # Test files (*.spec.ts)
    locators/            # UI element locators (LocatorsInterface subclasses + index)
    utils/               # Helpers: device open, account creation, screenshots, etc.
    state_builder/       # Pre-built multi-device test states via qa-seeder
    media/               # Test media files (images, videos, GIFs)
  types/
    DeviceWrapper.ts     # Central device abstraction (test interaction goes here)
    sessionIt.ts         # Test wrapper functions (bothPlatformsIt, androidIt, iosIt)
    testing.ts           # Shared types (User, StrategyExtractionObj, AccessibilityId)
  constants/             # Community config, test file paths
  localizer/             # Generated string lookup cache (see External Dependencies)
  screenshots/
    android/             # Baseline screenshots for visual regression
    ios/
scripts/                 # Device setup scripts
```

## Key Abstractions

### DeviceWrapper (`run/types/DeviceWrapper.ts`)

The tests interact with devices overwhelmingly through `DeviceWrapper`. It wraps the Appium/WebdriverIO client with higher-level methods (element interaction, scrolling, assertions, screenshot capture, etc.).

**Platform gating.** `device.onIOS()` and `device.onAndroid()` return a stub that no-ops all calls on the wrong platform. This lets test code call platform-specific APIs without wrapping every call in an `if` block.

**Self-healing locators.** When a locator fails to find an element, the tests can attempt a fuzzy match against all selectors. If healing succeeds, the test continues and is annotated in the Allure report. The annotation makes it easy to spot brittle locators before they cause hard failures — a healed test is a signal to update the locator, not a silent pass.

### LocatorsInterface / StrategyExtractionObj (`run/test/locators/index.ts`)

UI element selectors use one of two forms:

- **`StrategyExtractionObj` (SEO)** — a plain `{ strategy, selector, text? }` object. Used inline for one-off locators where the selector is the same on both platforms.
- **`LocatorsInterface` (LI)** — an abstract class with a `build(): StrategyExtractionObj` method. Subclass one per UI element when the selector differs by platform or the locator is reused across tests. Platform branching lives inside `build()`, keeping call sites clean.

Rule of thumb: one-off usage → inline SEO. Platform-specific or reused → LI subclass.

`DeviceWrapper`'s private `resolveLocator()` method accepts either form transparently, so call sites don't need to know which they're passing.

### State Builder (`run/test/state_builder/index.ts`)

Pre-builds complex test states (contacts, group chats) using `@session-foundation/qa-seeder` before the app is opened. This avoids spending the first minutes of every multi-device test manually establishing relationships through the UI.

Exported functions follow the pattern `open_Alice1_Bob1_friends()`, `open_Alice1_Bob1_Charlie1_friends_group()`, etc. Each returns `{ devices, prebuilt }` where `prebuilt` contains typed `User` objects (`{ userName, accountID, recoveryPhrase }`).

The `User` type is local. The seeder's `StateUser` type (`sessionId`, `seedPhrase`) is mapped at this boundary and never leaks into test code.

### Test Wrappers (`run/types/sessionIt.ts`)

Tests use `bothPlatformsIt()`, `androidIt()`, `iosIt()`, or `bothPlatformsItSeparate()` instead of Playwright's `test()`. Each takes:

```typescript
{
  title: string;
  risk: 'low' | 'medium' | 'high';
  countOfDevicesNeeded: 1 | 2 | 3 | 4;
  testCb: (platform, testInfo) => Promise<void>;
  shouldSkip?: boolean;
  isPro?: boolean;
  allureSuites?: { parent: string; suite: string };
  allureDescription?: string;
  allureLinks?: {
    all?: string[] | string;
    android?: string[] | string;
    ios?: string[] | string;
  };
}
```

The wrapper generates test names with grep tags automatically: `@android`/`@ios`, `@low-risk`/`@medium-risk`/`@high-risk`, `@1-devices` through `@4-devices`, `@pro`. These tags are how CI filters test runs by platform, risk level, or device count.

## Test Execution Flow

1. `global-setup.ts` validates that the environment is sane (correct platform env var, reachable network target).
2. Playwright assigns tests to workers. Workers run fully parallel; device allocation is tracked via `run/test/utils/device_registry.ts` to prevent conflicts.
3. The test callback calls a state builder function or `openApp*` directly. Appium connects to the emulator/simulator, installs the app, and restores accounts from recovery phrases.
4. Test steps run against `DeviceWrapper` instances.
5. On failure, `run/test/utils/failure_artifacts.ts` captures screenshots and device logs and attaches them via Playwright's `testInfo.attach()` — these appear in the standard Playwright report regardless of whether Allure is enabled.
6. A `finally` block unregisters devices from the registry regardless of outcome.
7. If `ALLURE_ENABLED=true`, additional Allure metadata (suites, risk, healed locator annotations) is written to the report.

## External Dependencies

### `@session-foundation/qa-seeder`

A package that handles pre-test state: creates users with recovery phrases, provisions groups and communities, and links devices over the network. It is a required dependency for the state builder functions. If the package becomes unavailable or its API drifts out of sync, those functions will fail — but tests that call `openApp*` utilities directly (without the state builder) will continue to work.

### Visual regression baselines

Screenshot comparison uses SSIM via `looks-same`. Baselines live in `run/screenshots/{android,ios}/`. On mismatch, diffs are saved to `test-results/diffs/` and attached to the Allure report with a visual comparison UI.

`UPDATE_BASELINES=true` auto-saves a baseline when none exists. It only runs when the baseline file is missing — it will not overwrite an existing one. To update a baseline after an intentional UI change, delete the old file first, then run with `UPDATE_BASELINES=true`.

Tests require specific device resolutions (Pixel 6 for Android, iPhone 17 for iOS) to produce consistent screenshots. Using different device models will cause baseline mismatches.

### Localizer (`run/localizer/`)

A generated cache of UI strings extracted from the app. Used in tests that assert specific copy. If the app's strings change, the latest strings need to be pulled from the [shared repo](https://github.com/session-foundation/session-localization):

```bash
git submodule update --init --recursive --remote
```

## CI

The automated regression tests currently run on [self-hosted runners](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners).

This document assumes that the Node.js/Android/iOS environment outlined in README.md has been set up successfully.

### Workflows

| Workflow                 | Trigger                         | Purpose                                                 |
| ------------------------ | ------------------------------- | ------------------------------------------------------- |
| `android-regression.yml` | Manual dispatch                 | Full Android test suite on the self-hosted Linux runner |
| `ios-regression.yml`     | Manual dispatch                 | Full iOS test suite on the self-hosted macOS runner     |
| `pull.yml`               | Pull request                    | PR validation                                           |
| `deploy-gh-pages.yml`    | After Android/iOS completion    | Publishes Allure report to GitHub Pages                 |
| `allure-rollback.yml`    | Manual dispatch                 | Rolls back the last published report                    |
| `prune-attachments.yml`  | Manual dispatch/weekly cron job | Prunes LFS attachment history to keep footprint low     |

### Android

The Android tests run on a self-hosted Linux machine. The workflow currently identifies this machine by the following runner tags: `[self-hosted, linux, X64, qa-android]`

4 emulators are booted from a stable (low CPU usage) snapshot.

The scripts that create and start these devices incl. snapshot management are contained in `scripts/ci.sh`.

#### Network

The CI tests are configured to run against a local devnet which is not exposed to the public internet. The self-hosted runner must be on the same network as the devnet to function.

### iOS

The iOS tests run on a self-hosted macOS machine. The workflow currently identifies this machine by the following runner tags: `[self-hosted, macOS]`

12 simulators are booted which are pre-loaded with various media files.

To set up these devices, run `CI=1 pnpm create-simulators 12` and commit the resulting `ci-simulators.json` to the repository.

### Allure

When run on CI, the tests generate and publish test reports to [GitHub Pages](https://session-foundation.github.io/session-appium/) by default.

The corresponding deployment workflow runs automatically after Android/iOS workflow completion.

To keep the repository lean, attachments are stored in LFS with their URLs patched to point to GitHub's own CDN.

The deployment preserves history across runs but it is expected that the `prune-attachments.yml` script is ran periodically to keep the LFS footprint low.

The last test report can be rolled back on demand with the `allure-rollback.yml` script.

### Secrets

To run community admin tests, the 13-word recovery phrase of a Community Admin has been saved under the `SOGS_ADMIN_SEED` secret variable.

## Maintenance Notes

**Locators break when app UI changes.** Update the relevant `LocatorsInterface` subclass in `run/test/locators/`. Check the Allure report for self-healed tests first — healing surfaces brittle locators before they become full failures.

**Baseline screenshots need updating when intentional UI changes ship.** Delete the affected baseline files in `run/screenshots/`, then run the affected tests with `UPDATE_BASELINES=true` against the correct device (Pixel 6 / iPhone 17) to regenerate them, then commit the new images via LFS.

**iOS simulators need reprovisioning if the macOS runner is rebuilt.** Rerun `CI=1 pnpm create-simulators 12` and commit the new `ci-simulators.json`.

**Android emulator snapshots** are managed by `scripts/ci.sh`. Refer to that script if the Linux runner needs rebuilding.

**LFS footprint** grows with each CI run. Run `prune-attachments.yml` periodically.

**Dependabot** is configured in `.github/dependabot.yml`.

**pnpm patches** live in `patches/` and are applied automatically on install. If either patched dependency is upgraded, the patch may fail to apply or become redundant — check `pnpm install` output after upgrades:

- `appium-uiautomator2-driver` — expands the device port range to `[8200, 8999]` to support parallel device sessions
- `allure-playwright` — purely cosmetic, renames stdout/stderr labels in the Allure report
