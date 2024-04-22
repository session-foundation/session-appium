import { forEach } from "lodash";

// {test1: ["line1", "line2", ], test2: ["line1"]}
const buffer: Record<string, Array<string>> = {};

export function pushToBuffer(testName: string, strToPush: string) {
  if (!buffer[testName]) {
    buffer[testName] = [];
  }
  buffer[testName].push(strToPush);
}

export function clearBufferOfTest(testName: string) {
  delete buffer[testName];
}

export function printBufferAndClear(testName: string) {
  if (buffer[testName]) {
    forEach(buffer[testName], (line) => console.log(line));
  }

  clearBufferOfTest(testName);
}
