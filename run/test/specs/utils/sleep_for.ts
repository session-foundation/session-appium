export function sleepFor(ms: number, logIt: boolean = false) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
    if (logIt || ms > 3000) {
      console.log(`Sleeping for ${ms} milliseconds`);
    }
  });
}
