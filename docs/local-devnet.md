# Running the iOS suite against a local devnet

By default the iOS suite runs against **mainnet**, where message/config propagation is onion-routed
over the real network — this dominates the wall-clock of the slowest multi-device tests. Pointing
the suite at a **local devnet** (the [Sesh-Net-Docker](https://github.com/Bilb/sesh-net-docker)
stack: ~12 oxend service nodes + storage servers) removes most of that latency.

This guide covers running that devnet **on the same Mac as the simulators** using
[OrbStack](https://orbstack.dev/). The harness support is already in place
(`NETWORK_TARGET=devnet` + `DEVNET_*`, see [Environment](#environment)); the work is operational.

> **Scope.** Most of this guide — the devnet itself, `LISTEN_IP`, OrbStack, the local file server
> and SOGS — is **platform-agnostic**; only the harness wiring (`NETWORK_TARGET`/`DEVNET_*` →
> `capabilities_ios.ts`) and the `pnpm test-ios*` run commands are iOS-specific. Android reaches a
> devnet **differently** (it switches to an AQA build variant rather than reading `NETWORK_TARGET`
> in the harness — see `CLAUDE.md`), so the run steps here don't apply to Android as written.

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

Pick whichever fits; both leave CI untouched (CI just uses a different value — see [CI](#ci)).

- **OrbStack VM IP (simplest, local-only) — recommended.** OrbStack runs a single shared Linux VM
  that is up whenever OrbStack is running (you do **not** need the devnet compose for it to exist),
  and macOS sits on the same subnet as that VM — so its `eth0` IP is reachable from macOS (and
  therefore the simulators). Read it with a throwaway container:

  ```bash
  LISTEN_IP=$(docker run --rm --network host alpine \
    ip -4 -o addr show eth0 | awk '{sub(/\/.*/,"",$4); print $4}')
  echo "$LISTEN_IP"   # e.g. 192.168.139.2
  ```

  This value is stable across restarts for a given OrbStack install (it's the VM's fixed address),
  so it's a discover-once value you can paste into `.env`. It differs per machine/OrbStack version,
  which is why you read it rather than hardcode it. Keep the compose's `network_mode: host`; the
  snodes bind to and advertise this IP, and macOS reaches it directly. (Verified: a host-network
  service bound to this IP responds to `curl`/`ping` from macOS.)

- **Tailscale IP (best local/CI parity).** Give the devnet its own tailnet identity (run
  `tailscaled` in the container: `network_mode: host` + `cap_add: [NET_ADMIN]` + `/dev/net/tun`,
  which OrbStack supports) and use its `100.x` address. Then local and CI are identical, and it's
  reachable from other machines **on the same tailnet** too — at the cost of more moving parts.
  (Tailscale _node sharing_ won't work: the sharee sees a different IP for the machine than your
  `LISTEN_IP`, so the advertised registry IP won't match for them. Same-tailnet membership is what
  keeps the address identical for everyone.)

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

## 3. Capture the `DEVNET_*` values

The seed is **one node** that the app and the seeder reach on **different ports**, so three ports
come from its row (example values are the `oxend@1280` row):

| `.env` var         | From column          | Used by                     | Example         |
| ------------------ | -------------------- | --------------------------- | --------------- |
| `DEVNET_PUBKEY`    | `Pubkey`             | app                         | `a9713f93…a036` |
| `DEVNET_IP`        | `IP` (= `LISTEN_IP`) | both                        | `192.168.139.2` |
| `DEVNET_RPC_PORT`  | `IP:RPC`             | seeder (oxend `/json_rpc`)  | `1280`          |
| `DEVNET_HTTP_PORT` | `Storage HTTPS`      | app (`devnetHttpPort`)      | `1300`          |
| `DEVNET_OMQ_PORT`  | `Storage OMQ`        | app (`devnetOmqPort`, QUIC) | `1305`          |

> **Why three ports:** the seeder calls `get_service_nodes` on the node's **oxend RPC**
> (`DEVNET_RPC_PORT`), while the app connects to the node's **storage server** over QUIC/HTTPS
> (`DEVNET_OMQ_PORT` / `DEVNET_HTTP_PORT`). The `QNET`/`P2P`/`ZMQ` columns aren't used.

> **Stable pubkey:** the compose mounts no volume for the data dir, so a fresh `--build`/recreate
> regenerates the seed keys and `DEVNET_PUBKEY` drifts (it's stable across `restart` of the _same_
> container). For a paste-once config, add a volume for the cached-devnet data dir; otherwise
> re-read the pubkey after each recreate. (The `Pubkey` column is the node's `service_node_pubkey`,
> which is the ed25519 key on current oxen — if the app can't connect to the seed, re-check this.)

## 4. Environment

Add to `.env` (see `.env.sample`):

```bash
NETWORK_TARGET=devnet
DEVNET_PUBKEY=<Pubkey column>
DEVNET_IP=<LISTEN_IP>
DEVNET_RPC_PORT=1280     # IP:RPC       (seeder)
DEVNET_HTTP_PORT=1300    # Storage HTTPS (app)
DEVNET_OMQ_PORT=1305     # Storage OMQ   (app)
```

`NETWORK_TARGET` drives both the app (`capabilities_ios.ts` injects `serviceNetwork`/`devnet*` into
the app's launch-arg env) and the seeder (`getNetworkTarget` targets
`http://$DEVNET_IP:$DEVNET_RPC_PORT`). If any `DEVNET_*` value is missing/invalid, the run fails
fast with a message naming what's wrong.

## 4b. (Optional) local file server

The file server comes up **with the devnet** — the `docker compose up --build` from step 2 also
starts a `sesh-net-fileserver` container (self-contained: postgres + nginx + uwsgi) published on
`:8000`, with a deterministic key so its pubkeys are stable. Pointing the app at it speeds the
media tests (attachments, avatars).

Grab its **X25519** pubkey from the logs — LibSession-Util consumes the custom file-server pubkey
directly as an x25519 key (`x25519_pubkey::from_hex`, no ed25519 conversion), so pass the X25519 one:

```bash
docker compose logs fileserver | grep -i pubkey
#   File server Ed25519 pubkey: 23bc…
#   which is X25519 pubkey:     51bd…       <- use this one
```

Then add to `.env`:

```bash
FILE_SERVER_URL=http://<DEVNET_IP>:8000     # reached by the exit snode, so use the devnet IP
FILE_SERVER_PUBKEY=<X25519 pubkey>          # omit to use the app's default file-server pubkey
```

Notes:

- The app reaches the file server via an **onion request through the devnet snodes**, so
  `FILE_SERVER_URL` must be reachable **from the snodes** (i.e. the OrbStack VM) — the devnet
  `DEVNET_IP:8000` satisfies that (and macOS too).
- Leave `FILE_SERVER_URL` unset to keep using the production file server.
- **Troubleshooting** — if the file server logs `Failed to decrypt onion request (tried 1 pubkeys)`
  (media uploads fail): the request is reaching the server but the client encrypted to a key the
  server can't match. Check, in order: (1) the value is the **X25519** pubkey (LibSession-Util uses
  it directly as the x25519 key — the ed25519 will not work), not the ed25519; (2) the app actually
  picked it up — Developer Settings ▸ File Server in the sim should show your `customFileServerPubkey`;
  (3) a clean app state (uninstall/recreate sims) so a previously-cached custom file server isn't
  stale. Note: the app's own `FileServer.edPublicKey`/`x25519PublicKey` Swift helpers treat this
  field as ed25519, which conflicts with libsession consuming it as x25519 — a Session_iOS
  inconsistency worth raising if the two paths ever both matter.

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

Then add to `.env` — use the **devnet host** (reachable from the snodes), the fixed room and pubkey:

```bash
COMMUNITY_LINK=http://<DEVNET_IP>:8080/local-devnet-community?public_key=aa7c2b3bcd6433e52d6616356fcdba68668e8b506d84a3c7a1a196d63235a613
COMMUNITY_NAME=Local Devnet Community
COMMUNITY_ROOM=local-devnet-community
```

Notes:

- The app reaches the SOGS via an **onion request through the devnet snodes**, so `COMMUNITY_LINK`'s
  host must be reachable **from the snodes** (the OrbStack VM) — `DEVNET_IP:8080` satisfies that (and
  macOS too). The `public_key` in the link is the SOGS' X25519 server pubkey and is what pins the
  community, independent of host.
- Leave `COMMUNITY_LINK` unset to keep using the remote `test-chat.session.codes` community (the CI
  default — CI is unchanged).
- Setting `COMMUNITY_LINK` switches the **whole** community set to local-only rooms: the harness
  derives the extra `local-devnet-community-2..6` rooms from your link's host + `public_key`
  automatically, so the multi-community tests (`user_actions_pin_unpin`, `recovery_banner`) don't
  reach out to any remote community. The room count is fixed at 6 (`LOCAL_COMMUNITY_COUNT` in
  `run/constants/community.ts`, matching `ROOM_COUNT` in the SOGS `entrypoint.sh`).

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
   curl -s http://$DEVNET_IP:1280/json_rpc -d '{"method":"get_service_nodes"}'
   ```
2. In the printed node table, the advertised IP column is `$DEVNET_IP` — **not** a `127.x`/`172.x`
   address (if it is, `LISTEN_IP` was wrong and the client won't be able to reach the snodes).
3. (Optional) the same `curl` from a booted simulator — but #1 passing is normally sufficient since
   simulators share the Mac's routes.

## CI

Nothing in CI changes when you set this up locally. `ios-regression.yml` exposes a `NETWORK_TARGET`
input (`devnet`/`testnet`/`mainnet`) and reads the devnet connection details from repo-level Actions
variables (`DEVNET_PUBKEY`, `DEVNET_IP`, `DEVNET_HTTP_PORT`, `DEVNET_OMQ_PORT`). The macOS runner
reaches a **Linux-hosted** devnet over the network (Tailscale/LAN) — the only per-environment
difference is the IP value, which is already env-driven.

## Notes & gotchas

- **One devnet per host** — `network_mode: host` means only one can run at a time on a machine.
- **Self-signed HTTPS storage** (the readiness probe uses `curl --insecure`). Fine for Session's
  x25519-keyed snode connections; worth a one-time confirmation the iOS client accepts it on devnet.
- **The file server and the community/SOGS are both optional** — see
  [4b](#4b-optional-local-file-server) and [4c](#4c-optional-local-community--sogs). They come up
  with the devnet either way; you only route the app at them by setting `FILE_SERVER_URL`
  (+ `FILE_SERVER_PUBKEY`) / `COMMUNITY_LINK` (+ `COMMUNITY_NAME`/`COMMUNITY_ROOM`). Leave those
  unset to use the production file server / remote community.
- **Ignore `docker-compose.yml.wip`** at the Sesh-Net-Docker root — it's a separate, half-finished
  Postgres+fileserver stack. Use the **parent `docker-compose.yml`** at the repo root (step 2),
  which `include`s the `sesh-net/`, `file-server/` and `sogs/` composes; run an individual one from
  its own subdirectory if you want just that piece.
