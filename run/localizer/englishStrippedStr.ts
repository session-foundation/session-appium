import { LocalizedStringBuilder, MergedLocalizerTokens } from "./lib";

export function englishStrippedStr<T extends MergedLocalizerTokens>(token: T) {
  const builder = new LocalizedStringBuilder<T>(token).stripIt().forceEnglish();
  return builder;
}
