# CLAUDE.md — Session Appium

Operational guide for AI agents working in this repo. This is the **end-to-end UI
regression suite** for the Session mobile clients: it drives a built app through Appium,
with **Playwright as the test runner**. One codebase covers **iOS and Android**; specs are
tagged per platform and filtered with `--grep`.

This file covers **how to work here**. For building the apps this suite installs, check the
individual platform repos (`Session_iOS`, `Session_Android`) for platform-specific build
info.

## Project shape

- **Runner:** Playwright (`@playwright/test`), config in `playwright.config.ts`. Test dir
  is `run/test/specs` (~130 `*.spec.ts` files).
- **Automation:** Appium drivers consumed as **npm dependencies**, not via
  `appium driver install` — `appium-xcuitest-driver` (iOS) and
  `appium-uiautomator2-driver` (Android) are in `package.json`.
- **iOS runs the XCUITest driver _in-process_.** Specs instantiate
  `new XCUITestDriver(opts)` directly (`run/test/utils/permissions.ts`, via `openiOSApp`
  in `run/test/utils/open_app.ts`). There is **no separate Appium server** in the loop for
  iOS — do not tell users to run `pnpm start-server` for local iOS runs (that script, and
  the `localhost:4728` / `--port 8110` references, belong to a different/legacy path).
- **Not TypeScript-compiled ahead of time:** specs run through `ts-node`/Playwright's TS
  loader. `pnpm tsc` is typecheck-only (no emit).
- Node **24.12.0** + pnpm **10.28.1** are pinned (`package.json` `engines`,
  `.tool-versions`, `.nvmrc`, `.mise.toml`). There is a git submodule
  (`run/localizer/lib`) and git-lfs assets.

## Layout

| Path | What |
|---|---|
| `run/test/specs/` | The specs. One user-facing flow per file. |
| `run/test/locators/` | Element locators, grouped by feature (`conversation.ts`, `groups.ts`, …). |
| `run/test/utils/` | Harness: `open_app.ts`, `capabilities_ios.ts`, `capabilities_android.ts`, `create_account.ts`, `binaries.ts`, `devnet.ts`, etc. |
| `run/test/state_builder/` | Account/state seeding via `@session-foundation/qa-seeder`. |
| `run/types/` | `sessionIt.ts` (spec declaration + tag generation), `DeviceWrapper.ts` (the Appium driver wrapper all specs use). |
| `scripts/` | Simulator/emulator lifecycle (`create_ios_simulators.ts`, `cleanup_ios_simulators.ts`, `emulator_health.ts`) and CI helpers. |

## Setup (one-time)

```sh
nvm install && nvm use          # node 24.12.0 (or use mise)
git lfs install && git lfs pull
git submodule update --init --recursive
pnpm install --frozen-lockfile
cp .env.sample .env             # then edit — see below
```

### `.env`

Only a subset matters per platform (all read in `run/test/utils/binaries.ts` /
`capabilities_*.ts`):

- **iOS:** `IOS_APP_PATH_PREFIX` must point at a **simulator** `Session.app`
  (`*-iphonesimulator`, not a device build). `IOS_1_SIMULATOR … IOS_12_SIMULATOR` hold
  simulator UDIDs — **`pnpm create-simulators <n>` writes these for you.**
- **Android:** `ANDROID_APK`, `APPIUM_ADB_FULL_PATH`, `EMULATOR_FULL_PATH`,
  `ANDROID_SDK_ROOT`. Emulators must be **created and running** beforehand (Appium won't
  boot them); see `README.md`.
- **Run tuning:** `PLAYWRIGHT_WORKERS_COUNT` (default 1), `PLAYWRIGHT_RETRIES_COUNT`
  (default 0), `PLAYWRIGHT_REPEAT_COUNT`.
- **Network target.** iOS defaults to **mainnet** but supports **testnet/devnet** too — set
  `NETWORK_TARGET=mainnet|testnet|devnet` (same var the CI workflows/report use). `devnet` also
  needs `DEVNET_PUBKEY`, `DEVNET_IP`, `DEVNET_HTTP_PORT`, `DEVNET_OMQ_PORT` (see `.env.sample`) and
  a reachable devnet seed node; the app is pointed at it via launch-arg env keys
  (`serviceNetwork`/`devnet*`, consumed by `DeveloperSettingsViewModel+Testing.swift` in
  Session_iOS) and the seeder is pointed at the same seed URL (`getNetworkTarget` /
  `getIosDevnetSeedUrl`). Running on devnet avoids full mainnet onion-routing latency, which
  dominates the slowest multi-device tests. Android reaches devnet differently — it switches build
  variant (`IS_AUTOMATIC_QA` / an AQA build) rather than reading `NETWORK_TARGET` in the harness.

### iOS simulators

```sh
pnpm create-simulators 4        # clones a media-preloaded template sim ×N, writes UDIDs to .env
```

Locally `DEVICES_PER_TEST_COUNT` defaults to 4 and the largest specs need 4 devices
(`countOfDevicesNeeded: 4`), so **4 sims covers every iOS spec** at 1 worker. XCUITest
boots a sim by UDID automatically at session start — no manual boot.

## Running tests

Scripts (see `package.json`); `--grep` filters on the auto-generated test name.

```sh
pnpm test-ios                    # all @ios specs   (_TESTING=1 … --grep '@ios')
pnpm test-android                # all @android specs
pnpm test-one '<title> @ios'     # one spec, constrained to a platform
pnpm test-one-logs '<title>'     # one spec with full device logs
pnpm test-no-retry '<grep>'      # retries disabled
pnpm test-high-risk-ios          # --grep '@ios @high-risk'
```

### How tags work

Specs are declared with `bothPlatformsIt` / `iosIt` / `androidIt` (`run/types/sessionIt.ts`),
**not** by hand-writing tags in the title. The runner builds the test name as:

```
<title> @<platform> @<risk>-risk @<countOfDevicesNeeded>-devices [@pro]
```

So `--grep '@ios'`, `@high-risk`, `@2-devices`, `@pro` all work as filters. When adding a
spec, set `title`, `risk`, `countOfDevicesNeeded`, `allureSuites`, and a `testCb` — follow
an existing spec (e.g. `run/test/specs/app_disguise_icons.spec.ts`).

## Conventions

- Specs are thin: `test.step(...)` blocks driving locator objects through the
  `DeviceWrapper` API (`device.clickOnElementAll(new SomeLocator(device))`, etc.). Put
  element selectors in `run/test/locators/`, reusable flows in `run/test/utils/`.
- Prefer the shared account/contact/group helpers (`create_account.ts`, `create_contact.ts`,
  `create_group.ts`) and `state_builder` seeding over re-implementing onboarding per spec.
- `runOnlyOnIOS` / `runOnlyOnAndroid` (`run/test/utils/run_on.ts`) gate
  platform-specific steps inside a shared spec.
- Lint/format: `pnpm lint` (prettier + eslint). `pnpm tsc` for typecheck.
- Allure reporting is **CI-only** (`playwright.config.ts` enables it when `CI === '1'` and
  `ALLURE_ENABLED !== 'false'`); locally the default reporter is used.

## CI vs local

CI (`.github/workflows/ios-regression.yml`) runs on a **self-hosted macOS** runner with
`CI=1`, `PLAYWRIGHT_WORKERS_COUNT=3`, `DEVICES_PER_TEST_COUNT=4` (→ 12 simulators from
`ci-simulators.json`), and `IOS_APP_PATH_PREFIX` pointing at an extracted `Session.app`.
Locally, simulators come from `.env` (`IOS_N_SIMULATOR`) instead of `ci-simulators.json`,
and device allocation is simpler (no per-worker device-pool offsetting). Keep this split in
mind when editing `capabilities_ios.ts` / `open_app.ts`.

## Gotchas

- **Simulator-only app + instrumentation.** The `.app` must be a simulator build. The iOS
  app's launch-arg instrumentation (the `appium:processArguments.env` keys —
  `animationsEnabled`, `debugDisappearingMessageDurations`, `communityPollLimit`,
  `sessionPro`, `customFirstInstallDateTime`) is consumed by
  `DeveloperSettingsViewModel.processUnitTestEnvVariablesIfNeeded` in Session_iOS, which is
  compiled under `#if targetEnvironment(simulator)` — it does **not** exist on device
  builds.
- **Missing `.env` values fail hard at import.** No `IOS_APP_PATH_PREFIX` →
  `capabilities_ios.ts` throws; no `IOS_N_SIMULATOR` locally → error telling you to run
  `pnpm create-simulators`.
- **iOS device/OS version drift.** `capabilities_ios.ts` declares `iPhone 16e` / `26.1`,
  while `scripts/create_ios_simulators.ts` creates `iPhone 17` / `iOS-26-2`. Because a
  specific `appium:udid` is supplied, XCUITest targets by UDID and these strings are
  effectively cosmetic — just keep a current 26.x runtime installed. (Worth reconciling.)
- **`README.md` is partly stale** — it describes copying the `.app` out of a hashed
  DerivedData folder to the Desktop and an `App store-iphonesimulator` path; in practice
  point `IOS_APP_PATH_PREFIX` straight at a `Debug-iphonesimulator/Session.app`. Prefer this
  file for local iOS setup.

## Git / contribution flow

Leave git operations (commits, pushes, PRs) to the maintainer unless explicitly asked.
