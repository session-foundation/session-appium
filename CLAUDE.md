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
- **Run tuning:** `PLAYWRIGHT_WORKERS_COUNT_IOS` (default 1), `PLAYWRIGHT_RETRIES_COUNT`
  (default 0), `PLAYWRIGHT_REPEAT_COUNT`.
- **Network target.** `NETWORK_TARGET=mainnet|testnet|devnet` is the **single switch for all three
  platforms**, and should be **set explicitly** — leaving it unset does *not* put everything on
  mainnet, it lets each platform fall back to its own default (see below). Running on devnet avoids
  full mainnet onion-routing latency, which
  dominates the slowest multi-device tests. For devnet, `DEVNET_SEED_URL` (the seed node's oxend RPC)
  is the **only** other value needed — a bare host, `host:port` or `http://host:port` all work, port
  defaulting to 1280. Local devnet setup (incl. OrbStack on the same Mac as the simulators):
  `docs/local-devnet.md`.

  Each client is told the network differently, and the harness translates `NETWORK_TARGET` into all
  three (`pinPlatformsToNetworkTarget` in `devnet.ts`, plus the capability builders):

  | Platform | How it learns the network |
  |---|---|
  | iOS | launch-arg env keys `serviceNetwork`/`devnet*`, consumed by `DeveloperSettingsViewModel+Testing.swift` |
  | Android | launch intent extras `sessionServiceNetwork`/`sessionDevnetSeedUrl`, consumed by `QaLaunchConfig` (QA builds only) |
  | Desktop | `LOCAL_DEVNET_SEED_URL`, which the harness sets — do **not** set it by hand alongside `NETWORK_TARGET` |

  Two things to know before touching this:

  - **`DEVNET_PUBKEY`/`DEVNET_IP`/`DEVNET_HTTP_PORT`/`DEVNET_OMQ_PORT` are gone.** iOS needs four
    devnet values, and they are now *discovered* by asking the seed node for `get_n_service_nodes`
    (`network_target.ts`) rather than configured. The devnet regenerates its keys on every rebuild,
    so a hand-copied pubkey silently rotted — and because only iOS uses it, that failed iOS alone
    while Android and Desktop kept working. Leftover values are warned about, not used.
  - **Desktop defaults to testnet, not mainnet**, whenever `NETWORK_TARGET` is unset: the harness
    always launches it with a `test-integration-*` `NODE_APP_INSTANCE`, which trips the app's own
    `useTestNet` flag. Android with no `NETWORK_TARGET` still takes its network from the APK build
    variant (`IS_AUTOMATIC_QA` / an AQA build). So a run that sets nothing has all three platforms on
    *different* networks — `resolveNetworkTarget` blocks it rather than letting it hang.

  Requesting devnet when the devnet is unusable aborts the whole run in `global-setup`, on every
  platform and project (`assertRequestedDevnetsReachable`).

- **Local SOGS / file server / Pro backend are discovered too** (`devnet_services.ts`, from
  `global-setup` on devnet runs), keyed off the devnet's advertised service-node IP — the address the
  app needs, since it reaches all three through the snodes. SOGS and the file server are optimisations:
  anything unreachable is reported and skipped, leaving the run on the remote community / production
  file server. The SOGS link is *verified* before use (one signed request — a wrong `SOGS_PUBKEY` comes
  back 401), so it cannot take per-test community rooms down with it. `FILE_SERVER_PUBKEY` has no such
  check — the key only matters inside the onion request — so it is never guessed: set it, or the
  production file server is used. `*_HOST`/`*_PORT` vars override each address.
- **The Pro backend is the exception**: with `TEST_PRO_BACKEND` set there is no fallback, because
  session-desktop throws inside `SwarmPolling.pollOnceForKey` when it can't reach a dev backend —
  killing every poll cycle, so messages send but never arrive, with a symptom nowhere near Pro. Set
  `TEST_PRO_BACKEND_ED_PK` (Ed25519, from `docker logs sesh-net-pro-backend`); the X25519 onion key is
  *derived* from it, never configured. Note `TEST_PRO_BACKEND` is a presence check — `0` enables it.

### iOS simulators

```sh
pnpm create-simulators 4        # clones a media-preloaded template sim ×N, writes UDIDs to .env
```

Locally `DEVICES_PER_TEST_COUNT` defaults to 4 and the largest specs need 4 devices
(`countOfDevicesNeeded: 4`), so **4 sims covers every iOS spec** at 1 worker. XCUITest
boots a sim by UDID automatically at session start — no manual boot.

Preparing the pool does two separable things — in `global-setup.ts` locally, and in the
`Prepare simulators` step (`scripts/prepare_ios.ts`) on CI:

1. **Builds the WebDriverAgent runner** (`ensureWdaBuilt`). `capabilities_ios` then passes
   `usePreinstalledWDA` + `prebuiltWDAPath`, so the driver installs the runner with `simctl` instead of
   running `xcodebuild` inside every session. Needs no booted device and costs ~31s once per job — it's
   one build for all devices, so it happens before the per-device work rather than inside it.
2. **Prepares the pool** (`workers × DEVICES_PER_TEST_COUNT` devices): boots each, installs the app, and
   starts one long-lived WDA per simulator, passing the ports on via `WDA_REUSE_PORTS`.

Without (2) the driver still boots on demand and launches WDA per session behind a process-wide lock
(~4.3s per device); without (1) it also *builds* WDA per session, which is the slow, flaky part.

With `appium:webDriverAgentUrl` pointing at a running WDA the driver's launch collapses to one
`/status` call, so both the install and the serialisation disappear (~8s saved on a 3-device test).
All of it is best-effort: anything that fails falls back to the driver doing it itself. Already-warm
simulators make the whole step a no-op, so back-to-back runs skip it.

> **Both steps run everywhere now, including CI**, and on CI they happen in a **`Prepare simulators`
> workflow step** (`scripts/prepare_ios.ts`) rather than inside `global-setup.ts`. The CI run is tiered —
> one `playwright test` invocation per device class — so leaving preparation in global setup repeated it
> once per pass; as its own step it happens once, its cost is visible in the job timing instead of being
> charged to the first pass, and the `xcodebuild` output stays out of the test results. The step exports
> `IOS_SIMULATORS_PREPARED`, which makes global setup skip to *discovering* the running WDAs.
>
> **This was 350s with WebDriverAgent on 1 of 12; it is now ~210s with 12 of 12.** Two changes did all of
> that: bounding the WDA port-binding window (10s, then 30s on a retry), and splitting preparation into two
> stages so a device waiting to launch WDA does not hold up the boots behind it.
>
> `prepareSimulatorPool` runs **boot + app install** at `IOS_BOOT_CONCURRENCY` (default **1**), handing each
> device to a second stage that launches WDA at `IOS_WDA_CONCURRENCY` (default **1**). The stages overlap —
> device N's launch runs while device N+1 boots — which is worth ~48s: at width 1 the wall clock (210.2s)
> comes in *below* the summed per-device work (257.8s).
>
> Measured on the runner, all 12 devices:
>
> | boot width | prepare | `wda-launch` total | `handoff-wait` total | `app-install` total |
> |---|---|---|---|---|
> | **1** | **210.2s** | **5.6s** | **0.3s** | 81.9s |
> | 2 | 226.3s | 147.5s | 867.8s | 133.1s |
> | 3 | 231.2s | 156.3s | 1429.8s | 195.7s |
>
> Width 1 despite boot-only measurements favouring 3 (128.4s serial against 58.8s at width 3): this width
> governs the app install too, which more than doubles across those widths, and above width 1 one
> `simctl launch` per run reliably goes pathological (130-150s) and everything queues behind it. The
> wall-clock gaps are inside the ~30s run-to-run noise, so width 1 is chosen for **robustness** rather than
> proven speed — its launch stage does an order of magnitude less work and never hit the pathological case.
>
> **Do not re-run these, they have all been tried and measured worse:**
>
> - **Gating the WDA launch inside the boot pipeline.** A device waiting for a launch slot still held a boot
>   slot, stalling the boots behind it: ~298s of queueing, worse wall clock. Read at the time as "narrow
>   launches are worse", which was the wrong conclusion — the coupling was the problem, hence the split.
> - **Alternating waves (boot a batch, then launch it exclusively).** 340.6s / 337.0s / 400.8s at widths
>   1/2/3 — up to 130s worse, because strict alternation gives up the overlap above and buys nothing.
> - **Dropping `--terminate-running-process`.** Neutral (358.6s vs 350.0s at the same width). Kept only
>   because the probe has already shown nothing is answering, and no device has ever needed the retry.
> - **Serialising launches to avoid contention (before the split).** Halved `wda-launch` but cost more in
>   queueing than it saved.
> - **Moving the app extraction to `$HOME` so `simctl install` could clone.** The runner has a single volume
>   (`/dev/disk3s5` for both workspace and `$HOME`), so nothing was ever crossing a filesystem. Harmless,
>   and the extraction stays there, but it changed nothing.
>
> **Still unexplained:** one `simctl launch` per run takes 95-150s instead of ~0.3s. It is **stochastic**,
> not caused by concurrency — it occurred in a run of twelve waves of one, where by construction nothing
> else was booting, installing or launching. General load does not predict it either (0.4s at load 731,
> 17.9s at load 147). Worth ~40s of average wall clock. Every mechanism anyone has proposed for it,
> including several of mine, has been disproved.
>
> Two traps for anyone tuning this further: `app-install` takes ~1s locally and ~5-22s on the runner, so
> **local timings do not transfer** — measure on CI. And the per-device log line is additive, so the stages
> sum to the total; an earlier version nested four stages inside `gate-wait` and misled everyone reading it.
>
> All of it is best-effort — anything that fails falls back to the driver doing it itself, and
> `prepare_ios.ts` deliberately exits 0 so it can never fail a job before a test has run. Already-warm
> simulators make the whole step close to a no-op, so back-to-back runs skip most of it.
>
> Note this bounds the *preparation*, not the load the tests then run against: a booted simulator holds
> ~230 processes for as long as it's up, and the run needs the whole pool booted regardless.

### Parallelism

Use `pnpm test-ios-parallel --tier standard` (6 simulators). Tiers live in
`run/constants/parallelism.ts`, which both the local runner and CI read — `--list-tiers` prints them.

`DEVICES_PER_TEST_COUNT` is one global per Playwright invocation, so a single run has to size *every*
worker's pool for the largest spec: at `D=4` a `@1-devices` spec occupies a worker holding four
simulators and using one. So parallelism is expressed as one invocation **per device class**, run in
sequence — which means the simulator draw is the largest pass, not the sum.

Measured 2026-07-30 (`--shard=1/4`, no `@pro`, 14-core Apple Silicon, on a build carrying the
SnodePool use-after-free fix — 9 configs, 39 min, zero crashes):

| specs | W=1 | W=2 | W=3 | W=4 |
|---|---|---|---|---|
| `@1-devices` | 271s | 133s (2.04×) | 105s (2.58×) | 90s (3.01×) |
| `@2-devices` | 549s | 295s (1.86×) | 226s (2.43×) | — |
| `@3-devices` | 427s | 227s (1.88×) | — | — |

`standard` totals 543s against 1247s all-serial (**2.30×**). `@4-devices` is unmeasured and gets no
parallelism below 8 simulators; nothing above W=4 is measured on any host.

> **This supersedes earlier "stay at 1 worker" guidance.** That note reported 6 simulators taking a
> 14-core Mac to a load average of ~500 with timeout failures unrelated to the app. Both 6-simulator
> configurations above now run clean, and `@3-devices` at W=2 was the only configuration in the matrix
> with zero test failures. Two things changed in between: the specs were hardened (several races
> fixed), and a libsession use-after-free was crashing the app ~1s after launch, which inflated
> baselines and produced failures that looked like host saturation. `global-setup.ts` still warns when
> `workers > 1`; that warning is now stale for tiered runs.
>
> The underlying constraint is real, though — each booted simulator is **~280 host processes**, and an
> over-subscribed host fails with timeouts indistinguishable from product bugs. Raise a tier only
> after measuring it on the hardware in question.

## Running tests

Scripts (see `package.json`); `--grep` filters on the auto-generated test name.

```sh
pnpm test-ios                    # all @ios specs   (_TESTING=1 … --grep '@ios')
pnpm test-android                # all @android specs
pnpm test-one '<title> @ios'     # one spec, constrained to a platform
pnpm test-one-logs '<title>'     # one spec with full device logs
pnpm test-no-retry '<grep>'      # retries disabled
pnpm test-high-risk-ios          # --grep '@ios @high-risk'

pnpm test-ios-parallel --tier standard   # tiered, 6 sims — fastest full-suite local run
pnpm test-ios-parallel --list-tiers      # tiers, their cost and their passes
```

`--tier` provisions throwaway simulators and runs one pass per device class; a `--grep` alongside it
narrows every pass rather than replacing the device-class filter. See **Parallelism** above.

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

CI (`.github/workflows/ios-regression.yml`) runs on a **self-hosted macOS** runner with `CI=1`, 12
simulators from `ci-simulators.json`, and `IOS_APP_PATH_PREFIX` pointing at a `Session.app` extracted
under `$HOME` (not the workspace — it must share an APFS volume with the simulators so `simctl install`
clones the bundle instead of copying it; the `Prepare simulators` step logs whether it does). Locally, simulators come from `.env` (`IOS_N_SIMULATOR`) instead.

The run step is **tiered** like the local runner: it shells out to `scripts/print_tier.ts ci` and
does one `npx playwright test` per device class, setting `DEVICES_PER_TEST_COUNT` and
`PLAYWRIGHT_WORKERS_COUNT_IOS` per pass, so the worker counts are not duplicated in YAML. Every pass
runs even if an earlier one fails (the step still exits non-zero), and Allure results accumulate
across invocations because the reporter does not clear `resultsDir` — so the report step still sees
one merged run. Every pass in the `ci` tier fills the 12-simulator pool — a pass boots only
`workers × devices`, so the run's peak draw is 12 regardless and holding one lower would idle
simulators without lowering the ceiling. Its worker counts above 4 are extrapolated, not measured on
the runner, so the first run on it is a measurement.

Device allocation is the **same code path** locally and on CI: `openiOSApp` (in
`open_app.ts`) always offsets each worker's device pool by its parallel index
(`DEVICES_PER_TEST_COUNT * TEST_PARALLEL_INDEX`) and rotates within that pool on retry. At a
single worker (the local default) this simply collapses to devices `0..N-1`; with more
workers it fans out (worker 0: devices 0–3, worker 1: 4–7, …), so N workers need
`N * DEVICES_PER_TEST_COUNT` simulators. To run multi-worker locally, use
`pnpm test-ios-parallel --tier standard` (`scripts/run_ios_parallel.ts`), which provisions exactly
the simulators the tier's largest pass needs and wires their UDIDs into the run. Keep this in mind
when editing `capabilities_ios.ts` / `open_app.ts`.

Note this pool is **per worker and uniform** — there is no way to give one worker 4 devices and
another 2 in the same invocation, which is why tiering is sequential passes rather than a mixed run.
Making it mixed would mean replacing the offset with a shared pool that specs check out from, which
introduces a deadlock (two workers holding 3 of 6 simulators, both wanting 4) that the current design
cannot hit.

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
