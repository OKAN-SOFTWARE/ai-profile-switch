// Chooses the screen language and looks up messages. English fills any gap.
import { LANGUAGES, LANGUAGE_ENV, META_FILE } from './constants.mjs';
import { readJsonFile } from './json-fs.mjs';
import en from '../locales/en.mjs';
import ko from '../locales/ko.mjs';

const MESSAGES = { en, ko };
export const LANGUAGE_NAMES = { en: 'English', ko: '한국어' };

function languageCode(value) {
  const code = String(value ?? '').trim().split(/[-_.@]/)[0].toLowerCase();
  return code || null;
}

// Terminal locale first (LC_ALL → LC_MESSAGES → LANG), then the OS locale.
// A set but unknown locale such as C means English rather than a fallthrough.
export function systemLanguage(env = process.env, intlLocale) {
  const code = languageCode(env.LC_ALL || env.LC_MESSAGES || env.LANG)
    ?? languageCode(intlLocale ?? Intl.DateTimeFormat().resolvedOptions().locale);
  return LANGUAGES.includes(code) ? code : 'en';
}

export function savedLanguage() {
  try {
    const { language } = readJsonFile(META_FILE, {}) ?? {};
    return LANGUAGES.includes(language) ? language : null;
  } catch {
    return null;
  }
}

export function detectLanguage({ saved = savedLanguage(), env = process.env, intlLocale } = {}) {
  if (saved) return saved;
  const forced = languageCode(env[LANGUAGE_ENV]);
  if (LANGUAGES.includes(forced)) return forced;
  return systemLanguage(env, intlLocale);
}

let current;

export function language() {
  current ??= detectLanguage();
  return current;
}

export function setLanguage(code) {
  current = code;
}

export function t(key, vars = {}) {
  const message = MESSAGES[language()][key] ?? en[key];
  if (message === undefined) throw new Error(`Missing message: ${key}`);
  return message.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : match));
}

const TIME_UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];

export function relativeTime(ms, now = Date.now()) {
  const seconds = Math.round((ms - now) / 1000);
  const format = new Intl.RelativeTimeFormat(language(), { numeric: 'auto' });
  for (const [unit, size] of TIME_UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return t('time.justNow');
}
