export enum LOCALE_DEFAULTS {
  app_name = 'Session',
  session_download_url = 'https://getsession.org/download',
  gif = 'GIF',
  oxen_foundation = 'Oxen Foundation',
}

export const rtlLocales = ['ar', 'fa', 'he', 'ps', 'ur'];

export const crowdinLocales = ['en'] as const;

export type CrowdinLocale = (typeof crowdinLocales)[number];

export function isCrowdinLocale(locale: string): locale is CrowdinLocale {
  return crowdinLocales.includes(locale as CrowdinLocale);
}
