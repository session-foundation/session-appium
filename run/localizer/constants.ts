export enum LOCALE_DEFAULTS {
  app_name = 'Session',
  session_download_url = 'https://getsession.org/download',
  gif = 'GIF',
  oxen_foundation = 'Oxen Foundation',
  network_name = 'Session Network',
  token_name_long = 'Session Token',
  staking_reward_pool = 'Staking Reward Pool',
  token_name_short = 'SESH',
  usd_name_short = 'USD',
  app_pro = 'Session Pro',
}

export const rtlLocales = ['ar', 'fa', 'he', 'ps', 'ur'];

export const crowdinLocales = [
  'en',
] as const;

export type CrowdinLocale = (typeof crowdinLocales)[number];

export function isCrowdinLocale(locale: string): locale is CrowdinLocale {
  return crowdinLocales.includes(locale as CrowdinLocale);
}

