import { CrowdinLocale } from './constants';
import { pluralsDictionary, simpleDictionary } from './locales';

type SimpleDictionary = typeof simpleDictionary;
type PluralDictionary = typeof pluralsDictionary;

export type SimpleLocalizerTokens = keyof SimpleDictionary;
export type PluralLocalizerTokens = keyof PluralDictionary;

export type MergedLocalizerTokens = PluralLocalizerTokens | SimpleLocalizerTokens;

export function isSimpleToken(token: string): token is SimpleLocalizerTokens {
  return token in simpleDictionary;
}

export function isPluralToken(token: string): token is PluralLocalizerTokens {
  return token in pluralsDictionary;
}

type DynamicArgStr = 'number' | 'string';

type ArgsTypeStrToTypes<T extends DynamicArgStr> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : never;

// those are still a string of the type "string" | "number" and not the typescript types themselves
type ArgsFromTokenStr<T extends PluralLocalizerTokens | SimpleLocalizerTokens> =
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

type ArgsFromToken<T extends MergedLocalizerTokens> = MappedToTsTypes<ArgsFromTokenStr<T>>;

type MappedToTsTypes<T extends Record<string, DynamicArgStr>> = {
  [K in keyof T]: ArgsTypeStrToTypes<T[K]>;
};

/**
 * Sanitizes the args to be used in the i18n function
 * @param args The args to sanitize
 * @param identifier The identifier to use for the args. Use this if you want to de-sanitize the args later.
 * @returns The sanitized args
 */
function sanitizeArgs(
  args: Record<string, number | string>,
  identifier?: string
): Record<string, number | string> {
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
      console.log(error);
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
  // Normalize whitespace around <br> tags: 
  // " <br/><br/>" and "<br/>" both become a single space
  let strippedString = str.replace(/\s*(<br\s*\/?>[\s]*)+/gi, ' ');
  // Then, remove all other HTML tags
  strippedString = strippedString.replace(/<[^>]*>/g, '');

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
      console.log(error.message);
      return this.token;
    }
  }

  private resolvePluralString(): string {
    const pluralKey = 'count';

    let num: number | string | undefined = this.args?.[pluralKey as keyof ArgsFromToken<T>];

    if (num === undefined) {
      console.log(
        `Attempted to get plural count for missing argument '${pluralKey} for token '${this.token}'`
      );
      num = 0;
    }

    if (typeof num !== 'number') {
      console.log(
        `Attempted to get plural count for argument '${pluralKey}' which is not a number for token '${this.token}'`
      );
      num = parseInt(num, 10);
      if (Number.isNaN(num)) {
        console.log(
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
      console.log(
        `Plural string not found for cardinal '${cardinalRule}': '${this.token}' Falling back to 'other' cardinal`
      );

      pluralString = getStringForRule({
        cardinalRule: 'other',
        crowdinLocale: localeToTarget,
        dictionary: pluralsDictionary,
        token: this.token,
      });

      if (!pluralString) {
        console.log(`Plural string not found for fallback cardinal 'other': '${this.token}'`);

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
  return new LocalizedStringBuilder<T>(token, 'en');
}
