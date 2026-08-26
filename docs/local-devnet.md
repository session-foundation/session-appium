# Running the iOS suite against a local devnet

By default the iOS suite runs against **mainnet**, where message/config propagation is onion-routed
over the real network — this dominates the wall-clock of the slowest multi-device tests. Pointing
the suite at a **local devnet** (the [Sesh-Net-Docker](https://github.com/Bilb/sesh-net-docker)
stack: ~12 oxend service nodes + storage servers) removes most of that latency.

This guide covers running that devnet **on the same Mac as the simulators** using
[OrbStack](https://orbstack.dev/). The harness support is already in place
(`NETWORK_TARGET=devnet` + `DEVNET_SEED_URL`, see [4. Environment](#4-environment)); the work is
operational.

> **Scope.** Most of this guide — the devnet itself, `LISTEN_IP`, OrbStack, the local file server
> and SOGS — is **platform-agnostic**, and `NETWORK_TARGET`/`DEVNET_SEED_URL` now drive all three
> platforms. Only the `pnpm test-ios*` run commands in [5. Run](#5-run) are iOS-specific; Android
> additionally needs a QA/AQA APK (see [4. Environment](#4-environment)).

> If you only need CI, you don't need any of this locally — CI reaches a Linux-hosted devnet over
> the network via repo Actions variables. See [CI](#ci).

## The one rule that makes or breaks it

Each snode binds to `LISTEN_IP` **and advertises that exact IP in the service-node registry**
(`--service-node-public-ip=$LISTEN_IP`). The client (the simulator) fetches the registry from the
seed and then connects to whatever IP it finds there. So:

> **`LISTEN_IP` must be an address that is (1) bindable inside the Linux VM and (2) reachable from
> macOS at the _identical_ address.**

Plain port-forwarding can't satisfy this — the registry still hands the client the VM-internal IP,
so the address wouldn't match. This is exactly why Docker Desktop doesn't work here and OrbStack
does: OrbStack routes macOS ↔ VM/container IPs transparently, so the VM has a macOS-reachable IP you
can bind to. (iOS simulators use the Mac's network stack, so anything the Mac can reach, the
simulator can reach too — no NAT dance like Android emulators.)

## Prerequisites

- OrbStack installed and running.
- Sesh-Net-Docker cloned with submodules

## 1. Choose `LISTEN_IP`

**Use the OrbStack VM's IP.** OrbStack runs a single shared Linux VM that is up whenever OrbStack is
running (you do **not** need the devnet compose for it to exist), and macOS sits on the same subnet as
that VM — so its `eth0` IP is reachable from macOS, and therefore from the simulators. Read it with a
throwaway container:

```bash
LISTEN_IP=$(docker run --rm --network host alpine \
  ip -4 -o addr show eth0 | awk '{sub(/\/.*/,"",$4); print $4}')
echo "$LISTEN_IP"   # e.g. 192.168.139.2
```

This value is stable across restarts for a given OrbStack install (it's the VM's fixed address), so
it's a discover-once value you can paste into `.env`. It differs per machine/OrbStack version, which is
why you read it rather than hardcode it. Keep the compose's `network_mode: host`; the snodes bind to
and advertise this IP, and macOS reaches it directly. (Verified: a host-network service bound to this
IP responds to `curl`/`ping` from macOS.)

The devnet is a **local-network** thing by design: whatever address you pick is the one the snodes
advertise in their registry, so every client — simulators, the harness, CI — has to be able to reach
that exact address. A devnet is therefore usable from the machine it runs on and from the LAN it sits
on, and nowhere else. CI just runs its own, with its own `LISTEN_IP` (see [CI](#ci)).

## 2. Start the devnet

From the Sesh-Net-Docker **repo root** (the parent compose starts the devnet **and** the file
server — see [4b](#4b-optional-local-file-server)):

```bash
LISTEN_IP=<chosen-ip> docker compose up --build     # add -d to detach
docker compose logs -f                              # wait for "You can send a command over RPC like"
```

(Devnet only? `cd sesh-net && LISTEN_IP=<chosen-ip> docker compose up --build`.)

It prints a node table (`Name, SN, Pubkey, IP:RPC, P2P, ZMQ, QNET, Storage OMQ, Storage HTTPS`) —
the source for the values below. Pick any `SN: Yes` row as the seed; the `oxend@1280` row is the
conventional choice (it matches the devnet's own readiness probe and Android's `:1280`).

## 3. Capture the seed node's RPC address

One value, from any `SN: Yes` row of the printed node table — the host and port in its **`IP:RPC`**
column (the `oxend@1280` row is the conventional choice):

```bash
DEVNET_SEED_URL=http://<LISTEN_IP>:<RPC-PORT>   # e.g. http://192.168.139.2:1280
```

That's the seed node's **oxend RPC** endpoint. Everything else the clients need — the node's ed25519
pubkey and both storage ports — is read back from it by `get_n_service_nodes`, so the `Pubkey`,
`Storage HTTPS` and `Storage OMQ` columns no longer need copying anywhere.

A bare host, `host:port` or a full `http://host:port` are all accepted (a trailing path is ignored,
and the port defaults to `1280`), so pasting straight out of the node table works.

> **Why this replaced the old five variables.** The compose mounts no volume for the data dir, so a
> fresh `--build`/recreate regenerates the seed keys. A hand-copied pubkey therefore rotted silently —
> it stayed a valid 64-char hex string, so every check still passed — and because **only iOS** uses
> that pubkey (Android and Desktop discover snodes from the seed URL themselves), it broke iOS alone
> while the other two kept working. The same applied to the storage ports, which nothing verified.
> Discovering them removes both failure modes rather than documenting them.
>
> If `DEVNET_PUBKEY`, `DEVNET_IP`, `DEVNET_RPC_PORT`, `DEVNET_HTTP_PORT` or `DEVNET_OMQ_PORT` are
> still in your `.env`, the run prints what each one _would_ have been versus what the devnet actually
> reports, then ignores them. You can delete them.

## 4. Environment

Add to `.env` (see `.env.sample`):

```bash
NETWORK_TARGET=devnet
DEVNET_SEED_URL=http://<IP>:1280
```

`NETWORK_TARGET` is the single switch, and the harness translates it into whatever each client
actually reads at launch:

- **iOS** — launch arguments. Simulator builds only (the instrumentation is compiled under
  `#if targetEnvironment(simulator)`).
- **Android** — the `sessionServiceNetwork`/`sessionDevnetSeedUrl` launch intent extras, which **only
  QA and AQA builds honour**: `QaLaunchConfig` is gated behind the `ALLOW_QA_LAUNCH_CONFIG` build flag
  and R8 strips it from release builds. A release APK ignores both extras silently and stays on
  whatever its build variant targets, so `NETWORK_TARGET` cannot move it — `android-regression.yml`
  fails a devnet run whose APK lacks that support rather than letting the app and the seeder diverge.
- **Desktop** — `LOCAL_DEVNET_SEED_URL`, which the harness sets for you. Do not also set it by hand.

Before any client starts, `global-setup` verifies the devnet is genuinely usable: the seed's RPC must
answer `get_n_service_nodes` with registered nodes, and the storage ports it advertises must accept
connections. If devnet was requested and any of that fails, the **whole run stops** — on every
platform and every project — instead of hanging until the 480s test timeout.

The services in 4b, 4c and 4d are then discovered off the same devnet IP, so they need no addresses of
their own. The first two are **optimisations**: whatever is unreachable is reported and skipped, and the
run continues on the remote community / production file server. The Pro backend (4d) is not — see
there.

## 4b. (Optional) local file server

The file server comes up **with the devnet** — the `docker compose up --build` from step 2 also
starts a `sesh-net-fileserver` container (self-contained: postgres + nginx + uwsgi) published on
`:8000`, with a deterministic key so its pubkeys are stable. Pointing the app at it speeds the
media tests (attachments, avatars).

Grab its **X25519** pubkey from the logs — LibSession-Util consumes the custom file-server pubkey
directly as an x25519 key (`x25519_pubkey::from_hex`, no ed25519 conversion), so pass the X25519 one:

```bash
docker compose logs fileserver | grep -i pubkey
#   File server Ed25519 pubkey: 23bc…       <- use this one
```

Then add these two, and only these two, to `.env`:

```bash
FILE_SERVER_URL=http://192.168.1.114:8000
FILE_SERVER_ED_PUBKEY=<Ed25519 pubkey>
```

**Use the Ed25519 key**, which is what the harness passes and what Android and Desktop already write
into a download url's `p=` fragment. `FILE_SERVER_PUBKEY` (the X25519 form) is gone — no code reads
it.

> **This needs libsession ≥ 1.9.0, which is not released yet.** Up to and including **1.8.0** —
> what every client currently pins — libSession used the configured pubkey _raw_ as the X25519 onion
> key rather than deriving it, so handing it the Ed form encrypts to the wrong key. The file server
> answers `400` and logs:
>
> ```
> WARNING Failed to decrypt onion request (tried 1 pubkeys)
> ```
>
> which surfaces in the app as **"Failed to update profile"** on upload, and as an avatar stuck on
> the generated placeholder on download. libsession-util `39c05a8f` ("treat the file server pubkey
> as Ed25519, as the other clients do") fixes it; `2aea9edf` in the same range is also needed if your
> file server is on a **non-default port**, since generated download urls dropped it.
>
> Until that releases, iOS needs a **locally built libsession** — see the `libsession-local` skill.
> Desktop is unaffected in practice.

On a devnet run the address is also discovered — the harness probes `:8000` on the devnet's
advertised IP and sets `FILE_SERVER_URL` itself (`run/test/utils/devnet_services.ts`) — but Desktop
only routes at a local file server when **both** variables are set, so state the URL anyway.
`FILE_SERVER_HOST`/`FILE_SERVER_PORT` override the discovered address if the file server is not on
the devnet's host.

Notes:

- **The pubkey is the one thing that cannot be discovered.** It encrypts the _inside_ of the onion
  request, so nothing on this side of the snodes can tell a right key from a wrong one — a wrong one
  surfaces as an upload failing partway through a run. Rather than guess it, discovery reports the
  server it found and leaves the suite on the production file server until you set the key.
- The app reaches the file server via an **onion request through the devnet snodes**, so
  `FILE_SERVER_URL` must be reachable **from the snodes** (i.e. the OrbStack VM) — the devnet
  `LISTEN_IP:8000` satisfies that (and macOS too), which is why the advertised devnet IP is what
  discovery uses rather than the address you reach it on.
- Leave `FILE_SERVER_ED_PUBKEY` unset to keep using the production file server.
- **Troubleshooting** — if the file server logs `Failed to decrypt onion request (tried 1 pubkeys)`
  (media uploads fail): the request is reaching the server but the client encrypted to a key the
  server can't match. Check, in order: (1) the value is the **Ed25519** pubkey, not the X25519 one —
  both are 64 hex characters, so the wrong one passes every format check and breaks downloads on the
  OTHER client, far from the mistake; (2) the app actually picked it up — Developer Settings ▸ File
  Server in the sim should show it; (3) a clean app state (uninstall/recreate sims) so a
  previously-cached custom file server isn't stale.

## 4c. (Optional) local community / SOGS

The community specs (`Join community test` and ~10 others) join a Session community and wait for a
message to be present. By default they use the remote `test-chat.session.codes`. The Sesh-Net-Docker
stack also ships a local **SOGS** (`sogs` container, published on `:8080`, self-contained
sqlite + uwsgi) so that traffic stays on the devnet. Like the file server it comes up with the
parent compose (step 2), with a **deterministic key** so its pubkey / community link is stable, and
on first boot it creates the `local-devnet-community` room (plus `local-devnet-community-2..6` for
the multi-community tests) and **seeds each with one message** (a fresh room is empty, and the join
check waits for any message).

Grab the room link from the container logs (the pubkey is fixed by the baked key):

```bash
docker compose logs sogs | grep -A1 'server pubkey'
#   SOGS X25519 server pubkey : aa7c…a613
#   Community link (web view) : http://localhost:8080/local-devnet-community?public_key=aa7c…a613
```

**On a devnet run there is normally nothing to add to `.env`.** The harness builds `COMMUNITY_LINK`
itself from the devnet's advertised IP, `:8080` and the stack's baked pubkey, and lists the server's
rooms to fill in `COMMUNITY_NAME`/`COMMUNITY_ROOM` (`run/test/utils/devnet_services.ts`). Set
`COMMUNITY_LINK` by hand only to point somewhere else; it is then left alone.

Notes:

- **The link is verified before it is used.** Discovery makes one signed request to the server, which
  only succeeds if the `public_key` it is about to publish really is that server's — SOGS signatures
  are computed over the server's key, so a wrong one comes back `401`. If it does, discovery says so
  and publishes nothing, leaving the run on the remote community. That matters because a link that is
  merely _reachable_ would take per-test rooms down with it (see below) and hand the community specs
  a local server they cannot authenticate to.
- If your SOGS is not the local stack's — a different deployment, CI's — set `SOGS_PUBKEY` to its
  X25519 server pubkey, and `SOGS_HOST`/`SOGS_PORT` if it does not share the devnet's address.
- The app reaches the SOGS via an **onion request through the devnet snodes**, so `COMMUNITY_LINK`'s
  host must be reachable **from the snodes** (the OrbStack VM) — `LISTEN_IP:8080` satisfies that (and
  macOS too), which is why discovery keys off the advertised devnet IP. The `public_key` in the link
  is the SOGS' X25519 server pubkey and is what pins the community, independent of host.
- On a non-devnet run nothing is discovered, so leaving `COMMUNITY_LINK` unset keeps using the remote
  `test-chat.session.codes` community.
- Setting `COMMUNITY_LINK` switches the **whole** community set to local-only rooms: the harness
  derives the extra `local-devnet-community-2..6` rooms from your link's host + `public_key`
  automatically, so the multi-community tests (`user_actions_pin_unpin`, `recovery_banner`) don't
  reach out to any remote community. The room count is fixed at 6 (`LOCAL_COMMUNITY_COUNT` in
  `run/constants/community.ts`, matching `ROOM_COUNT` in the SOGS `entrypoint.sh`).

### Per-test rooms

With `COMMUNITY_LINK` set, the six rooms above stop being what the tests actually use: each community
test creates rooms of its own and deletes them afterwards. Two runs against the same SOGS — CI and a
laptop, or two CI jobs — therefore can't join, post, pin or ban in the same place, and a test is free
to leave its rooms in whatever state it likes.

A test opts in by declaring how many it needs:

```ts
iosIt({
  title: 'Join community test',
  communityRooms: 1, // becomes communities.testCommunity
  ...
});
```

`communities` resolves per test, so `communityRooms: 2` gives `testCommunity` and `community2`.
Reading `communities` **without** declaring `communityRooms` throws rather than falling back to a
shared room — a silent fallback is how tests start interfering again, and the failure would surface
somewhere unrelated to the cause.

Mechanics worth knowing:

- **Everything goes through SOGS' own HTTP API** — `POST /rooms`, `DELETE /room/<token>`, and
  `GET /rooms` — so nothing here needs shell or Docker access to the machine running SOGS. That is what
  lets CI use it: the runner is a different host from the devnet.
- **Requests are signed as `SOGS_ADMIN_SEED`**, which must be a global admin (locally it is, by
  default). SOGS requires _blinded_ ids, so the signing is not plain Ed25519 over the account key — see
  `run/test/utils/sogs_auth.ts`, which mirrors what the clients do.
- **Availability is decided once, at startup.** `global-setup.ts` lists rooms; if that fails — SOGS
  unreachable, the account not a global admin, a server too old to have the endpoints — the run **falls
  back to the shared rooms with a loud warning** rather than failing, since that configuration still
  tests everything, just without isolating concurrent runs. Listing is the check because it exercises
  everything creating a room needs, while changing nothing. The answer is cached in the environment, so
  per-test lookups stay cheap and every caller agrees.
- **A new room is seeded with one message.** SOGS creates rooms empty, and `joinCommunity` waits for a
  message body, so a client joining an empty room _hangs_ rather than failing. The message is a real
  protobuf `Content`, signed by a throwaway per-room identity rather than the admin's — SOGS takes a
  user's display name from the messages they post, so seeding as the admin would rename it in every
  room. See `run/test/utils/sogs_seed_message.ts`.
- **Tokens are `qa-<runId>-w<worker>-<n>`.** `QA_RUN_ID` is stamped once per run in `global-setup.ts`,
  so concurrent runs can't pick the same token and delete each other's rooms. The `qa-` prefix marks a
  room disposable, and since SOGS has no notion of a temporary room that rule lives in the harness —
  every delete path asserts it, so the six static rooms are safe from a bug pointing a delete at them.
- **Rooms are released in `sessionIt`'s `finally`**, so a failing test still cleans up. Anything missed
  (a timeout or an interrupt skips that block) is collected by the `gc` sweep `global-setup.ts` runs at
  the start of the next run, which only removes `qa-` rooms older than its TTL — comfortably longer
  than any single test, so it can't delete a room out from under a concurrent run.
- **The link is rebuilt from `COMMUNITY_LINK`'s origin**, since the server's own idea of its address is
  `localhost` and unreachable from a simulator.

> **Server version:** `POST /rooms` and `DELETE /room/<token>` are additions to session-pysogs — a SOGS
> without them fails the startup check and the run falls back to the shared rooms, naming the reason.

## 4d. (Optional) local Pro backend

The stack also brings up a **Pro backend** (`pro-backend` + `pro-backend-db` containers, published on
`:8090`) with its `/dev/*` routes enabled, so it will mint Pro subscriptions for any caller — which is
what `pro.session.codes` refuses to do and why Pro tests could not run against it.

Unlike 4b and 4c this is **not an optimisation**. There is no fallback: with `TEST_PRO_BACKEND` set,
session-desktop throws inside `SwarmPolling.pollOnceForKey` when it cannot reach a dev backend, which
kills every poll cycle — messages send but are never received, and the symptom is a test timing out
nowhere near anything Pro-related. The harness warns loudly rather than letting you discover that.

Its address is discovered off the devnet IP. Its **signing key is not discoverable** — no route exposes
it, and it is generated per instance into the container's data volume rather than baked deterministic
like the SOGS and file-server keys — so read it from the startup banner:

```bash
docker compose logs pro-backend | grep -i 'signing pubkey'
#   Ed25519 signing pubkey : cf1079a5…
```

Then add to `.env`:

```bash
TEST_PRO_BACKEND=1
TEST_PRO_BACKEND_ED_PK=<Ed25519 signing pubkey>
```

Notes:

- **Only the Ed25519 key.** The banner also prints an X25519 onion pubkey, but that is the same keypair
  in its other representation — the client derives it (`crypto_sign_ed25519_pk_to_curve25519`). Setting
  it separately would only create a way for the pair to disagree.
- `TEST_PRO_BACKEND` is a presence check, not a boolean: **any** non-empty value enables it, `0`
  included. Leave it unset (or empty) to use the production backend.
- `PRO_BACKEND_HOST`/`PRO_BACKEND_PORT` override the discovered address.

## 5. Run

```bash
pnpm test-ios-parallel --network devnet --grep '@ios @high-risk'   # flag overrides .env
# or, with NETWORK_TARGET=devnet in .env:
pnpm test-ios --grep '@ios @high-risk'
```

## Validation checklist

After `docker compose up`, confirm before trusting a run:

1. From macOS the seed responds:
   ```bash
   curl -s $DEVNET_SEED_URL/json_rpc -d '{"method":"get_n_service_nodes"}'
   ```
2. In the printed node table, the advertised IP column is your `LISTEN_IP` — **not** a `127.x`/`172.x`
   address (if it is, `LISTEN_IP` was wrong and the clients won't be able to reach the snodes).
   The harness checks this for you: discovery only accepts a node whose advertised storage ports it can
   actually connect to.
3. (Optional) the same `curl` from a booted simulator — but #1 passing is normally sufficient since
   simulators share the Mac's routes.

## CI

Nothing in CI changes when you set this up locally. `ios-regression.yml`,
`cross-platform-regression.yml` and `android-regression.yml` all expose a `NETWORK_TARGET` input and
read a single repo-level Actions **variable**, `DEVNET_SEED_URL`, so the only per-environment
difference is that URL. (The Android workflow additionally uses the input to pick the APK variant —
AQA for devnet, plain QA for mainnet.)

The local SOGS and file server are discovered on CI too, from the devnet CI is pointed at. Its keys
and ports need not match a local stack's, and the two behave differently when they don't: a wrong
`SOGS_PUBKEY` is **detected** (the signed check fails, so the run stays on the remote community),
while a wrong `FILE_SERVER_ED_PUBKEY` cannot be, which is why that one is never assumed. To use either
on CI, set the matching repo variable — `SOGS_PUBKEY`, `FILE_SERVER_ED_PUBKEY`, and
`SOGS_HOST`/`SOGS_PORT` or `FILE_SERVER_HOST`/`FILE_SERVER_PORT` if they are not on the devnet's own
host.

> **The runner needs a network path to the seed node's oxend RPC port** — not just to its storage
> ports. oxend binds that RPC to a **single** address, the one chosen as `LISTEN_IP`, whereas the
> storage ports bind all interfaces. A client off that network therefore finds the storage ports open
> and the RPC closed, which fails confusingly. So the runner and the devnet have to be on the same
> local network, which is the arrangement this is built around.

## Notes & gotchas

- **One devnet per host** — `network_mode: host` means only one can run at a time on a machine.
- **Self-signed HTTPS storage** (the readiness probe uses `curl --insecure`). Fine for Session's
  x25519-keyed snode connections; worth a one-time confirmation the iOS client accepts it on devnet.
- **The file server and the community/SOGS are both optional** — see
  [4b](#4b-optional-local-file-server) and [4c](#4c-optional-local-community--sogs). They come up
  with the devnet either way; you only route the app at them by setting `FILE_SERVER_URL`
  (+ `FILE_SERVER_ED_PUBKEY`) / `COMMUNITY_LINK` (+ `COMMUNITY_NAME`/`COMMUNITY_ROOM`). Leave those
  unset to use the production file server / remote community.
- **Ignore `docker-compose.yml.wip`** at the Sesh-Net-Docker root — it's a separate, half-finished
  Postgres+fileserver stack. Use the **parent `docker-compose.yml`** at the repo root (step 2),
  which `include`s the `sesh-net/`, `file-server/` and `sogs/` composes; run an individual one from
  its own subdirectory if you want just that piece.
