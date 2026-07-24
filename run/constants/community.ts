import dotenv from 'dotenv';

dotenv.config({ quiet: true });

type CommunityConfig = {
  link: string;
  name: string;
  roomName?: string;
};

// The community specs join `communities.testCommunity`; the multi-community tests
// (user_actions_pin_unpin, recovery_banner) join the first N entries of `communities` via
// joinCommunities(N) (N up to 6).
//
// By default these are the remote communities below (so CI is unchanged). Setting COMMUNITY_LINK in
// .env opts into a local SOGS (the Sesh-Net-Docker `sogs` container) instead: the whole set is then
// replaced with local-only rooms so no test reaches out to a remote community. Mirrors the
// NETWORK_TARGET/DEVNET_* opt-in precedent (see utils/capabilities_ios.ts).

// Number of local community rooms the local SOGS creates/seeds — keep in sync with ROOM_COUNT in
// Sesh-Net-Docker/sogs/entrypoint.sh. The primary room plus `local-devnet-community-2 .. -N`.
const LOCAL_COMMUNITY_COUNT = 6;

// Builds the local community set from COMMUNITY_LINK. The primary room comes from
// COMMUNITY_LINK/COMMUNITY_NAME/COMMUNITY_ROOM; the extra rooms reuse the same host + public_key
// (all rooms live on the one SOGS) with the fixed `local-devnet-community-<i>` tokens/names the
// container creates.
function buildLocalCommunities(link: string): Record<string, CommunityConfig> {
  const url = new URL(link);
  const base = `${url.protocol}//${url.host}`;
  const search = url.search; // ?public_key=<sogs x25519 pubkey>

  const result: Record<string, CommunityConfig> = {
    testCommunity: {
      link,
      name: process.env.COMMUNITY_NAME ?? 'Local Devnet Community',
      roomName: process.env.COMMUNITY_ROOM ?? 'local-devnet-community',
    },
  };

  for (let i = 2; i <= LOCAL_COMMUNITY_COUNT; i++) {
    const room = `local-devnet-community-${i}`;
    result[`localCommunity${i}`] = {
      link: `${base}/${room}${search}`,
      name: `Local Devnet Community ${i}`,
      roomName: room,
    };
  }

  return result;
}

const REMOTE_COMMUNITIES: Record<string, CommunityConfig> = {
  testCommunity: {
    link: 'https://test-chat.session.codes/testing-all-the-things?public_key=1d7e7f92b1ed3643855c98ecac02fc7274033a3467653f047d6e433540c03f17',
    name: 'Testing All The Things!',
    roomName: 'testing-all-the-things',
  },
  testOmg: {
    link: 'https://test-chat.session.codes/omg?public_key=1d7e7f92b1ed3643855c98ecac02fc7274033a3467653f047d6e433540c03f17',
    name: 'omg',
  },
  lokinetUpdates: {
    link: 'https://open.getsession.org/lokinet-updates?public_key=a03c383cf63c3c4efe67acc52112a6dd734b3a946b9545f488aaa93da7991238',
    name: 'Lokinet Updates',
  },
  sessionNetworkUpdates: {
    link: 'https://open.getsession.org/oxen-updates?public_key=a03c383cf63c3c4efe67acc52112a6dd734b3a946b9545f488aaa93da7991238',
    name: 'Session Network Updates',
  },
  session: {
    link: 'https://open.getsession.org/session?public_key=a03c383cf63c3c4efe67acc52112a6dd734b3a946b9545f488aaa93da7991238',
    name: 'Session',
  },
  sessionDev: {
    link: 'https://open.getsession.org/session-dev?public_key=a03c383cf63c3c4efe67acc52112a6dd734b3a946b9545f488aaa93da7991238',
    name: 'Session Developers Chat',
  },
};

export const communities: Record<string, CommunityConfig> = process.env.COMMUNITY_LINK
  ? buildLocalCommunities(process.env.COMMUNITY_LINK)
  : REMOTE_COMMUNITIES;
