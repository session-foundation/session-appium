type CommunityConfig = {
  link: string;
  name: string;
  roomName?: string;
};

export const communities: Record<string, CommunityConfig> = {
  testCommunity: {
    link: 'https://chat.lokinet.dev/testing-all-the-things?public_key=1d7e7f92b1ed3643855c98ecac02fc7274033a3467653f047d6e433540c03f17',
    name: 'Testing All The Things!',
    roomName: 'testing-all-the-things',
  },
  lokinetUpdates: {
    link: 'https://open.getsession.org/lokinet-updates?public_key=a03c383cf63c3c4efe67acc52112a6dd734b3a946b9545f488aaa93da7991238',
    name: 'Lokinet Updates',
  },
  sessionNetworkUpdates: {
    link: 'https://open.getsession.org/oxen-updates?public_key=a03c383cf63c3c4efe67acc52112a6dd734b3a946b9545f488aaa93da7991238',
    name: 'Session Network Updates',
  },
};
