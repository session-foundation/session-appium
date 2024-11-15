let initialLocale: Locale | undefined;

/**
 * Logs an i18n message to the console.
 * @param message - The message to log.
 *
 */
export function i18nLog(message: string) {
  console.log(`i18n: ${message}`);
}

export type Locale = string;

/**
 * Returns the current locale.
 */
export function getLocale(): Locale {
  if (!initialLocale) {
    i18nLog(`getLocale: using initialLocale`);

    throw new Error('initialLocale is unset');
  }
  return initialLocale;
}

export function setInitialLocale(locale: Locale) {
  initialLocale = locale;
}
