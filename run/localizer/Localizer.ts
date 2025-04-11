/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { CrowdinLocale } from './constants';
import { pluralsDictionary, simpleDictionary } from './locales';

type SimpleDictionary = typeof simpleDictionary;
type PluralDictionary = typeof pluralsDictionary;

export type SimpleLocalizerTokens = keyof SimpleDictionary;
type PluralLocalizerTokens = keyof PluralDictionary;

export type MergedLocalizerTokens = SimpleLocalizerTokens | PluralLocalizerTokens;

let localeInUse: CrowdinLocale = 'en';

type Logger = (message: string) => void;
let logger: Logger | undefined;

/**
 * Simpler than lodash. Duplicated to avoid having to import lodash in the file.
 * Because we share it with QA, but also to have a self contained localized tool that we can copy/paste
 */
function isEmptyObject(obj: unknown) {
  if (!obj) {
    return true;
  }
  if (typeof obj !== 'object') {
    return false;
  }
  return Object.keys(obj).length === 0;
}

function isRunningInMocha(): boolean {
  return false;
}

export function setLogger(cb: Logger) {
  if (logger && !isRunningInMocha()) {
    console.debug('logger already initialized. overriding it');
  }
  logger = cb;
}

export function setLocaleInUse(crowdinLocale: CrowdinLocale) {
  localeInUse = crowdinLocale;
}

function log(message: Parameters<Logger>[0]) {
  if (!logger) {
    console.log('logger is not set');
    return;
  }
  logger(message);
}

export function isSimpleToken(token: string): token is SimpleLocalizerTokens {
  return token in simpleDictionary;
}

export function isPluralToken(token: string): token is PluralLocalizerTokens {
  return token in pluralsDictionary;
}

/**
 * This type extracts from a dictionary, the keys that have a property 'args' set (i.e. not undefined or never).
 */
type TokenWithArgs<Dict> = {
  [Key in keyof Dict]: Dict[Key] extends { args: undefined } | { args: never } ? never : Key;
}[keyof Dict];

type MergedTokenWithArgs = TokenWithArgs<SimpleDictionary> | TokenWithArgs<PluralDictionary>;

export function isTokenWithArgs(token: string): token is MergedTokenWithArgs {
  return (
    (isSimpleToken(token) && !isEmptyObject(simpleDictionary[token]?.args)) ||
    (isPluralToken(token) && !isEmptyObject(pluralsDictionary[token]?.args))
  );
}

type DynamicArgStr = 'string' | 'number';

export type LocalizerDictionary = SimpleDictionary;

type ArgsTypeStrToTypes<T extends DynamicArgStr> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : never;

// those are still a string of the type "string" | "number" and not the typescript types themselves
type ArgsFromTokenStr<T extends SimpleLocalizerTokens | PluralLocalizerTokens> =
  T extends SimpleLocalizerTokens
    ? SimpleDictionary[T] extends { args: infer A }
      ? A extends Record<string, any>
        ? A
        : never
      : never
    : T extends PluralLocalizerTokens
      ? PluralDictionary[T] extends { args: infer A }
        ? A extends Record<string, any>
          ? A
          : never
        : never
      : never;

export type ArgsFromToken<T extends MergedLocalizerTokens> = MappedToTsTypes<ArgsFromTokenStr<T>>;

/** The arguments for retrieving a localized message */
export type GetMessageArgs<T extends MergedLocalizerTokens> = T extends MergedLocalizerTokens
  ? T extends MergedTokenWithArgs
    ? [T, ArgsFromToken<T>]
    : [T]
  : never;

type MappedToTsTypes<T extends Record<string, DynamicArgStr>> = {
  [K in keyof T]: ArgsTypeStrToTypes<T[K]>;
};

/**
 * Sanitizes the args to be used in the i18n function
 * @param args The args to sanitize
 * @param identifier The identifier to use for the args. Use this if you want to de-sanitize the args later.
 * @returns The sanitized args
 */
export function sanitizeArgs(
  args: Record<string, string | number>,
  identifier?: string
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [
      key,
      typeof value === 'string' ? sanitizeHtmlTags(value, identifier) : value,
    ])
  );
}

function getStringForRule({
  dictionary,
  token,
  crowdinLocale,
  cardinalRule,
}: {
  dictionary: PluralDictionary;
  token: PluralLocalizerTokens;
  crowdinLocale: CrowdinLocale;
  cardinalRule: Intl.LDMLPluralRule;
}) {
  const dictForLocale = dictionary[token][crowdinLocale];
  return cardinalRule in dictForLocale ? ((dictForLocale as any)[cardinalRule] as string) : token;
}

/**
 * Replaces all html tag identifiers with their escaped equivalents
 * @param str The string to sanitize
 * @param identifier The identifier to use for the args. Use this if you want to de-sanitize the args later.
 * @returns The sanitized string
 */
function sanitizeHtmlTags(str: string, identifier: string = ''): string {
  if (identifier && /[a-zA-Z0-9></\\\-\s]+/g.test(identifier)) {
    throw new Error('Identifier is not valid');
  }

  return str
    .replace(/&/g, `${identifier}&amp;${identifier}`)
    .replace(/</g, `${identifier}&lt;${identifier}`)
    .replace(/>/g, `${identifier}&gt;${identifier}`);
}

/**
 * Replaces all sanitized html tags with their real equivalents
 * @param str The string to de-sanitize
 * @param identifier The identifier used when the args were sanitized
 * @returns The de-sanitized string
 */
function deSanitizeHtmlTags(str: string, identifier: string): string {
  if (!identifier || /[a-zA-Z0-9></\\\-\s]+/g.test(identifier)) {
    throw new Error('Identifier is not valid');
  }

  return str
    .replace(new RegExp(`${identifier}&amp;${identifier}`, 'g'), '&')
    .replace(new RegExp(`${identifier}&lt;${identifier}`, 'g'), '<')
    .replace(new RegExp(`${identifier}&gt;${identifier}`, 'g'), '>');
}

class LocalizedStringBuilder<T extends MergedLocalizerTokens> extends String {
  private readonly token: T;
  private args?: ArgsFromToken<T>;
  private isStripped = false;
  private isEnglishForced = false;
  private crowdinLocale: CrowdinLocale;

  private readonly renderStringAsToken: boolean;

  constructor(token: T, crowdinLocale: CrowdinLocale, renderStringAsToken?: boolean) {
    super(token);
    this.token = token;
    this.crowdinLocale = crowdinLocale;
    this.renderStringAsToken = renderStringAsToken || false;
  }

  public toString(): string {
    try {
      if (this.renderStringAsToken) {
        return this.token;
      }

      const rawString = this.getRawString();
      const str = this.formatStringWithArgs(rawString);

      if (this.isStripped) {
        return this.postProcessStrippedString(str);
      }

      return str;
    } catch (error: any) {
      log(error);
      return this.token;
    }
  }

  withArgs(args: ArgsFromToken<T>): Omit<this, 'withArgs'> {
    this.args = args;
    return this;
  }

  forceEnglish(): Omit<this, 'forceEnglish'> {
    this.isEnglishForced = true;
    return this;
  }

  stripIt(): Omit<this, 'stripIt'> {
    const sanitizedArgs = this.args ? sanitizeArgs(this.args, '\u200B') : undefined;
    if (sanitizedArgs) {
      this.args = sanitizedArgs as ArgsFromToken<T>;
    }
    this.isStripped = true;

    return this;
  }

  private postProcessStrippedString(str: string): string {
    const strippedString = str.replaceAll(/<[^>]*>/g, '');
    return deSanitizeHtmlTags(strippedString, '\u200B');
  }

  private localeToTarget(): CrowdinLocale {
    return this.isEnglishForced ? 'en' : this.crowdinLocale;
  }

  private getRawString(): string {
    try {
      if (this.renderStringAsToken) {
        return this.token;
      }

      if (isSimpleToken(this.token)) {
        return simpleDictionary[this.token][this.localeToTarget()];
      }

      if (!isPluralToken(this.token)) {
        throw new Error('invalid token provided');
      }

      return this.resolvePluralString();
    } catch (error: any) {
      log(error.message);
      return this.token;
    }
  }

  private resolvePluralString(): string {
    const pluralKey = 'count';

    let num: number | string | undefined = this.args?.[pluralKey as keyof ArgsFromToken<T>];

    if (num === undefined) {
      log(
        `Attempted to get plural count for missing argument '${pluralKey} for token '${this.token}'`
      );
      num = 0;
    }

    if (typeof num !== 'number') {
      log(
        `Attempted to get plural count for argument '${pluralKey}' which is not a number for token '${this.token}'`
      );
      num = parseInt(num, 10);
      if (Number.isNaN(num)) {
        log(
          `Attempted to get parsed plural count for argument '${pluralKey}' which is not a number for token '${this.token}'`
        );
        num = 0;
      }
    }

    const localeToTarget = this.localeToTarget();
    const cardinalRule = new Intl.PluralRules(localeToTarget).select(num);

    if (!isPluralToken(this.token)) {
      throw new Error('resolvePluralString can only be called with a plural string');
    }

    let pluralString = getStringForRule({
      cardinalRule,
      crowdinLocale: localeToTarget,
      dictionary: pluralsDictionary,
      token: this.token,
    });

    if (!pluralString) {
      log(
        `Plural string not found for cardinal '${cardinalRule}': '${this.token}' Falling back to 'other' cardinal`
      );

      pluralString = getStringForRule({
        cardinalRule: 'other',
        crowdinLocale: localeToTarget,
        dictionary: pluralsDictionary,
        token: this.token,
      });

      if (!pluralString) {
        log(`Plural string not found for fallback cardinal 'other': '${this.token}'`);

        return this.token;
      }
    }

    return pluralString.replaceAll('#', `${num}`);
  }

  private formatStringWithArgs(str: string): string {
    /** Find and replace the dynamic variables in a localized string and substitute the variables with the provided values */
    return str.replace(/\{(\w+)\}/g, (match, arg: string) => {
      const matchedArg = this.args
        ? this.args[arg as keyof ArgsFromToken<T>]?.toString()
        : undefined;

      return matchedArg ?? match;
    });
  }
}

export function localize<T extends MergedLocalizerTokens>(token: T) {
  return new LocalizedStringBuilder<T>(token, localeInUse);
}

export function localizeFromOld<T extends MergedLocalizerTokens>(token: T, args: ArgsFromToken<T>) {
  return localize(token).withArgs(args);
}

type LocalizerHtmlTag = 'span' | 'div';
/** Basic props for all calls of the Localizer component */
type LocalizerComponentBaseProps<T extends MergedLocalizerTokens> = {
  token: T;
  asTag?: LocalizerHtmlTag;
  className?: string;
};

/** The props for the localization component */
export type LocalizerComponentProps<T extends MergedLocalizerTokens> =
  T extends MergedLocalizerTokens
    ? ArgsFromToken<T> extends never
      ? LocalizerComponentBaseProps<T> & { args?: undefined }
      : ArgsFromToken<T> extends Record<string, never>
        ? LocalizerComponentBaseProps<T> & { args?: undefined }
        : LocalizerComponentBaseProps<T> & { args: ArgsFromToken<T> }
    : never;

export type LocalizerComponentPropsObject = LocalizerComponentProps<MergedLocalizerTokens>;

export function englishStripped<T extends MergedLocalizerTokens>(token: T) {
  return localize(token).stripIt().forceEnglish();
}
