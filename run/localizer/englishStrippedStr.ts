import { LocalizedStringBuilder, type MergedLocalizerTokens } from './Localizer';

export function englishStrippedStr<T extends MergedLocalizerTokens>(token: T) {
  const builder = new LocalizedStringBuilder<T>(token, 'en').stripIt().forceEnglish();
  return builder;
}
