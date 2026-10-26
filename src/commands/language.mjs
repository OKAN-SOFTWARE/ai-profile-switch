import * as prompt from '../lib/prompt.mjs';
import { setLanguagePreference } from '../lib/config.mjs';
import { LANGUAGES } from '../lib/constants.mjs';
import { LANGUAGE_NAMES, detectLanguage, language as currentLanguage, savedLanguage, setLanguage, t } from '../lib/i18n.mjs';
import { color, info, success } from '../lib/ui.mjs';

const AUTO = 'auto';

function save(choice) {
  setLanguagePreference(choice === AUTO ? null : choice);
  const effective = choice === AUTO ? detectLanguage({ saved: null }) : choice;
  setLanguage(effective);
  success(choice === AUTO
    ? t('language.savedAuto', { name: LANGUAGE_NAMES[effective] })
    : t('language.saved', { name: LANGUAGE_NAMES[effective] }));
}

export async function language(args = []) {
  if (args.length > 1) throw new Error(t('language.usage'));
  const [choice] = args;
  if (choice !== undefined) {
    if (choice !== AUTO && !LANGUAGES.includes(choice)) throw new Error(t('language.usage'));
    save(choice);
    return;
  }
  const saved = savedLanguage();
  if (!process.stdin.isTTY) {
    const source = t(saved ? 'language.sourceSaved' : 'language.sourceAuto');
    info(`${t('language.current', { name: LANGUAGE_NAMES[currentLanguage()] })} ${color.dim(`(${source})`)}`);
    return;
  }
  const system = LANGUAGE_NAMES[detectLanguage({ saved: null })];
  const selected = await prompt.select(t('language.title'), [
    { label: t('language.auto'), value: AUTO, hint: color.dim(t('language.autoHint', { name: system })) },
    ...LANGUAGES.map(code => ({ label: LANGUAGE_NAMES[code], value: code })),
  ], { initial: saved ? LANGUAGES.indexOf(saved) + 1 : 0 });
  if (selected) save(selected);
}
