export function sleepFor(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
    console.log(`Sleeping for ${ms} milliseconds`);
  });
}
