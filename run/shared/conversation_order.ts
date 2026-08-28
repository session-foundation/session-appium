// Cross-platform: shared by the mobile (Appium) and desktop (Electron) suites.
// The reader of the list is platform-specific (`getConversationOrder` in each suite); only the
// expectation is shared.

import { verify } from './verify';

// Asserts pinned conversations float to the top keeping their relative order, followed by the
// unpinned ones in their original order. Pass an empty `pinnedNames` to assert the order is fully
// restored (e.g. after unpinning).
//
// 🔴 The expectation is built by partitioning `beforeOrder`, so pinning a PREFIX of it expects
// `beforeOrder` back unchanged — and the assertion cannot fail, whether or not anything was pinned.
// Seeded contacts arrive in positional order and the list renders in that order, so
// `contactNames.slice(0, n)` is exactly that case. Choose a set that is not a prefix.
//
// This is positional evidence only: it never checks the pin marker, so a caller that needs "the
// client honoured the pin" must assert that separately. Names absent from `beforeOrder` are silently
// ignored, and two conversations sharing a display name cannot be told apart.
export function assertPinOrder(
  beforeOrder: string[],
  pinnedNames: string[],
  afterOrder: string[]
): void {
  const pinnedSet = new Set(pinnedNames);
  const pinnedExpected: string[] = [];
  const unpinnedExpected: string[] = [];
  for (const name of beforeOrder) {
    if (pinnedSet.has(name)) {
      pinnedExpected.push(name);
    } else {
      unpinnedExpected.push(name);
    }
  }
  const expected = [...pinnedExpected, ...unpinnedExpected];

  verify(afterOrder, 'Conversation order is not correct').toEqual(expected);
}
