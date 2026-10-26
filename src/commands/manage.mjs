import * as prompt from '../lib/prompt.mjs';
import { readMeta } from '../lib/config.mjs';
import { color, error, intro, warn } from '../lib/ui.mjs';
import { accountInfo } from '../lib/account.mjs';
import { LANGUAGE_NAMES, language as currentLanguage, t } from '../lib/i18n.mjs';
import { add } from './add.mjs';
import { list } from './list.mjs';
import { use } from './use.mjs';
import { remove } from './remove.mjs';
import { rename } from './rename.mjs';
import { share } from './share.mjs';
import { language } from './language.mjs';

function help() {
  console.log(t('manage.help'));
}

export async function manage(args = []) {
  if (args.some(arg => ['--help', '-h'].includes(arg))) {
    help();
    return;
  }
  if (args.length === 1 && args[0] === '--list') return list();
  if (args[0] === 'share') return share(args.slice(1));
  if (args[0] === 'language') return language(args.slice(1));
  if (args.length === 1 && !args[0].startsWith('-')) return use(args[0]);
  if (args.length > 0) {
    const [command, ...names] = args;
    const operations = { add: [1, add], remove: [1, remove], rename: [2, rename] };
    const operation = Object.hasOwn(operations, command) ? operations[command] : undefined;
    if (!operation || names.length !== operation[0] || names.some(name => name.startsWith('-'))) {
      throw new Error(t('manage.invalid'));
    }
    return operation[1](...names);
  }
  if (!process.stdin.isTTY) {
    help();
    return;
  }

  const start = readMeta().activeProfile;
  const email = start ? accountInfo(start).email : null;
  intro('ai-profile-switch', start ? t('menu.current', { name: [start, email].filter(Boolean).join(' · ') }) : '');
  while (true) {
    const meta = readMeta();
    const item = (value, hint) => ({ label: t(`menu.${value}`), value, hint: hint && color.dim(hint) });
    const actions = meta.profiles.length ? [
      item('use'), item('list'), item('add'), item('rename'), item('remove', t('menu.removeHint')),
      item('share'), item('language', LANGUAGE_NAMES[currentLanguage()]), item('exit'),
    ] : [item('add'), item('language', LANGUAGE_NAMES[currentLanguage()]), item('exit')];
    const action = await prompt.select(t('menu.question'), actions);
    if (!action || action === 'exit') return;
    try {
      if (action === 'list') {
        await list();
      } else if (action === 'share') {
        await share();
      } else if (action === 'language') {
        await language();
      } else if (action === 'add') {
        const name = await prompt.text(t('menu.addName'));
        if (name) await add(name);
      } else {
        const name = await prompt.select(t('menu.choose'), meta.profiles.map(profile => ({
          label: profile === meta.activeProfile ? `${profile} ${t('menu.active')}` : profile,
          value: profile,
        })), { initial: meta.profiles.indexOf(meta.activeProfile) });
        if (!name) return;
        if (action === 'use') await use(name);
        else if (action === 'remove') await remove(name);
        else {
          warn(t('menu.renameWarn'));
          const newName = await prompt.text(t('menu.newName'));
          if (newName && await prompt.confirm(t('menu.renameConfirm', { old: name, new: newName }), false)) {
            await rename(name, newName);
          }
        }
      }
    } catch (err) {
      error(err.message, err.hints);
    }
  }
}
