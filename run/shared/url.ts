// Cross-platform: shared by the mobile (Appium) and desktop (Electron) suites.

export async function assertUrlIsReachable(url: string): Promise<void> {
  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(`Expected status 200 but got ${response.status} for URL: ${url}`);
  }
}
