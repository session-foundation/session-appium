import { getFallbackDictionary, getTranslationDictionary } from './translationDictionaries';
import { en } from '../locales';
import { LOCALE_DEFAULTS } from '../constants';
import { deSanitizeHtmlTags, sanitizeArgs } from '../component/Localizer';
import type { LocalizerDictionary } from '../Localizer';

type PluralKey = 'count';

type ArgString = `${string}{${string}}${string}`;
type RawString = ArgString | string;

type PluralString = `{${PluralKey}, plural, one [${RawString}] other [${RawString}]}`;

// type LocalizedString = string;

type GenericLocalizedDictionary = Record<string, RawString | PluralString>;

export type TokenString<Dict extends GenericLocalizedDictionary> = keyof Dict extends string
  ? keyof Dict
  : never;

// type GenericArgsRecord = Record<string, string | number>;

/** The dynamic arguments in a localized string */
type StringArgs<T extends string> =
  /** If a string follows the plural format use its plural variable name and recursively check for
   *  dynamic args inside all plural forms */
  T extends `{${infer PluralVar}, plural, one [${infer PluralOne}] other [${infer PluralOther}]}`
    ? PluralVar | StringArgs<PluralOne> | StringArgs<PluralOther>
    : /** If a string segment follows the variable form parse its variable name and recursively
       * check for more dynamic args */
      T extends `${string}{${infer Var}}${infer Rest}`
      ? Var | StringArgs<Rest>
      : never;

export type StringArgsRecord<T extends string> = Record<StringArgs<T>, string | number>;

// TODO: move this to a test file
//
// const stringArgsTestStrings = {
//   none: 'test',
//   one: 'test{count}',
//   two: 'test {count} second {another}',
//   three: 'test {count} second {another} third {third}',
//   four: 'test {count} second {another} third {third} fourth {fourth}',
//   five: 'test {count} second {another} third {third} fourth {fourth} fifth {fifth}',
//   twoConnected: 'test {count}{another}',
//   threeConnected: '{count}{another}{third}',
// } as const;
//
// const stringArgsTestResults = {
//   one: { count: 'count' },
//   two: { count: 'count', another: 'another' },
//   three: { count: 'count', another: 'another', third: 'third' },
//   four: { count: 'count', another: 'another', third: 'third', fourth: 'fourth' },
//   five: { count: 'count', another: 'another', third: 'third', fourth: 'fourth', fifth: 'fifth' },
//   twoConnected: { count: 'count', another: 'another' },
//   threeConnected: { count: 'count', another: 'another', third: 'third' },
// } as const;
//
// let st0: Record<StringArgs<typeof stringArgsTestStrings.none>, string>;
// const st1: Record<StringArgs<typeof stringArgsTestStrings.one>, string> = stringArgsTestResults.one;
// const st2: Record<StringArgs<typeof stringArgsTestStrings.two>, string> = stringArgsTestResults.two;
// const st3: Record<
//   StringArgs<typeof stringArgsTestStrings.three>,
//   string
// > = stringArgsTestResults.three;
// const st4: Record<
//   StringArgs<typeof stringArgsTestStrings.four>,
//   string
// > = stringArgsTestResults.four;
// const st5: Record<
//   StringArgs<typeof stringArgsTestStrings.five>,
//   string
// > = stringArgsTestResults.five;
// const st6: Record<
//   StringArgs<typeof stringArgsTestStrings.twoConnected>,
//   string
// > = stringArgsTestResults.twoConnected;
// const st7: Record<
//   StringArgs<typeof stringArgsTestStrings.threeConnected>,
//   string
// > = stringArgsTestResults.threeConnected;
//
// const results = [st0, st1, st2, st3, st4, st5, st6, st7];

// Above is testing stuff

function getPluralKey<R extends PluralKey>(string: PluralString): R {
  const match = /{(\w+), plural, one \[.+\] other \[.+\]}/g.exec(string);
  return match?.[1] as R;
}

function getStringForCardinalRule(
  localizedString: string,
  cardinalRule: Intl.LDMLPluralRule
): string | undefined {
  // TODO: investigate if this is the best way to handle regex like this
  const cardinalPluralRegex: Record<Intl.LDMLPluralRule, RegExp> = {
    zero: /zero \[(.*?)\]/g,
    one: /one \[(.*?)\]/g,
    two: /two \[(.*?)\]/g,
    few: /few \[(.*?)\]/g,
    many: /many \[(.*?)\]/g,
    other: /other \[(.*?)\]/g,
  };
  const regex = cardinalPluralRegex[cardinalRule];
  const match = regex.exec(localizedString);
  return match?.[1] ?? undefined;
}

const isPluralForm = (localizedString: string): localizedString is PluralString =>
  /{\w+, plural, one \[.+\] other \[.+\]}/g.test(localizedString);

/**
 * Checks if a string contains a dynamic variable.
 * @param localizedString - The string to check.
 * @returns `true` if the string contains a dynamic variable, otherwise `false`.
 */
const isStringWithArgs = (localizedString: string): localizedString is ArgString =>
  localizedString.includes('{');

/**
 * Logs an i18n message to the console.
 * @param message - The message to log.
 */
export function i18nLog(message: string | unknown) {
  console.log(`i18n: `, message);
}

const isReplaceLocalizedStringsWithKeysEnabled = () => false;

export class LocalizedStringBuilder<
  Dict extends GenericLocalizedDictionary,
  T extends TokenString<Dict>,
> extends String {
  private readonly token: T;
  private args?: StringArgsRecord<Dict[T]>;
  private isStripped = false;
  private isEnglishForced = false;

  private readonly renderStringAsToken = isReplaceLocalizedStringsWithKeysEnabled();

  constructor(token: T) {
    super(token);
    this.token = token;
  }

  public toString<LocalizedString = Dict[T]>(): LocalizedString {
    try {
      if (this.renderStringAsToken) {
        return this.token as unknown as LocalizedString;
      }

      const rawString = this.getRawString();
      const str = isStringWithArgs(rawString) ? this.formatStringWithArgs(rawString) : rawString;

      if (this.isStripped) {
        return this.postProcessStrippedString(str) as LocalizedString;
      }

      return str as LocalizedString;
    } catch (error) {
      i18nLog(error);
      return this.token as unknown as LocalizedString;
    }
  }

  withArgs(args: StringArgsRecord<Dict[T]>): Omit<this, 'withArgs'> {
    this.args = args;
    return this;
  }

  forceEnglish(): Omit<this, 'forceEnglish'> {
    this.isEnglishForced = true;
    return this;
  }

  // @ts-expect-error -- for some reason the colours package is overriding the global String type
  strip(): Omit<this, 'strip'> {
    const sanitizedArgs = this.args ? sanitizeArgs(this.args, '\u200B') : undefined;
    if (sanitizedArgs) {
      this.args = sanitizedArgs as StringArgsRecord<Dict[T]>;
    }
    this.isStripped = true;

    return this;
  }

  private postProcessStrippedString(str: string): string {
    const strippedString = str.replaceAll(/<[^>]*>/g, '');
    return deSanitizeHtmlTags(strippedString, '\u200B');
  }

  private getRawString(): RawString | TokenString<Dict> {
    try {
      if (this.renderStringAsToken) {
        return this.token;
      }

      const dict: GenericLocalizedDictionary = this.isEnglishForced
        ? en
        : getTranslationDictionary();

      let localizedString = dict[this.token];

      if (!localizedString) {
        i18nLog(`Attempted to get translation for nonexistent key: '${this.token}'`);

        localizedString = (getFallbackDictionary() as GenericLocalizedDictionary)[this.token];

        if (!localizedString) {
          i18nLog(
            `Attempted to get translation for nonexistent key: '${this.token}' in fallback dictionary`
          );
          return this.token;
        }
      }

      return isPluralForm(localizedString)
        ? this.resolvePluralString(localizedString)
        : localizedString;
    } catch (error) {
      i18nLog(error);
      return this.token;
    }
  }

  private resolvePluralString(str: PluralString): string {
    const pluralKey = getPluralKey(str);

    // This should not be possible, but we need to handle it in case it does happen
    if (!pluralKey) {
      i18nLog(
        `Attempted to get nonexistent pluralKey for plural form string '${str}' for token '${this.token}'`
      );
      return this.token;
    }

    let num = this.args?.[pluralKey as keyof StringArgsRecord<Dict[T]>];

    if (num === undefined) {
      i18nLog(
        `Attempted to get plural count for missing argument '${pluralKey} for token '${this.token}'`
      );
      num = 0;
    }

    if (typeof num !== 'number') {
      i18nLog(
        `Attempted to get plural count for argument '${pluralKey}' which is not a number for token '${this.token}'`
      );
      num = parseInt(num, 10);
      if (Number.isNaN(num)) {
        i18nLog(
          `Attempted to get parsed plural count for argument '${pluralKey}' which is not a number for token '${this.token}'`
        );
        num = 0;
      }
    }

    const currentLocale = 'en';
    const cardinalRule = new Intl.PluralRules(currentLocale).select(num);

    const pluralString = getStringForCardinalRule(str, cardinalRule);

    if (!pluralString) {
      i18nLog(`Plural string not found for cardinal '${cardinalRule}': '${str}'`);
      return this.token;
    }

    return pluralString.replaceAll('#', `${num}`);
  }

  private formatStringWithArgs(str: ArgString): string {
    /** Find and replace the dynamic variables in a localized string and substitute the variables with the provided values */
    return str.replace(/\{(\w+)\}/g, (match, arg: string) => {
      const matchedArg = this.args
        ? this.args[arg as keyof StringArgsRecord<Dict[T]>]?.toString()
        : undefined;

      return matchedArg ?? LOCALE_DEFAULTS[arg as keyof typeof LOCALE_DEFAULTS] ?? match;
    });
  }
}

export function localize<T extends TokenString<LocalizerDictionary>>(token: T) {
  return new LocalizedStringBuilder<LocalizerDictionary, T>(token);
}

export function localizeFromOld<T extends TokenString<LocalizerDictionary>>(
  token: T,
  args: StringArgsRecord<LocalizerDictionary[T]>
) {
  return new LocalizedStringBuilder<LocalizerDictionary, T>(token).withArgs(args);
}

export function englishStripped<T extends TokenString<LocalizerDictionary>>(token: T) {
  return localize(token).strip().forceEnglish();
}
