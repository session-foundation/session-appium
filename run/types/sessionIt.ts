// import { clearBufferOfTest, printBufferAndClear } from "../test/specs/utils/logger";
import { SupportedPlatformsType } from "../test/specs/utils/open_app";

// async function itWithBufferHandling(testNameWithoutPlatform: string, platform: SupportedPlatformsType, testToRun: () => Promise<void>) {
//   try {
//     await testToRun();
//     clearBufferOfTest(testNameWithoutPlatform);
//   } catch (e) {
//     printBufferAndClear(testNameWithoutPlatform)
//     throw e;
//   }
// }

export function androidIt(title: string, test: (platform: SupportedPlatformsType) => Promise<void>) {
  const testName = `${title} android`;
  return it(testName, async () => {
    console.info(`\n\n==========> Running "${testName}"\n\n`);
    await test("android");
  });
}

export function iosIt(title: string, test: (platform: SupportedPlatformsType) => Promise<void>) {
  const testName = `${title} ios`;

  return it(testName, async () => {
    console.info(`\n\n==========> Running "${testName}"\n\n`);
    await test("ios");
  });
}
