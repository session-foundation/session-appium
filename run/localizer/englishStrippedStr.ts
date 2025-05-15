import { localize, type MergedLocalizerTokens } from './Localizer';

export function englishStrippedStr<T extends MergedLocalizerTokens>(token: T) {
  return localize(token).stripIt().forceEnglish();
}
