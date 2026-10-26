import { color, success, userError } from '../lib/ui.mjs';
import { createProfile, validateProfileName, profileExists } from '../lib/profile.mjs';
import { readMeta } from '../lib/config.mjs';
import { syncShared } from '../lib/shared.mjs';
import { t } from '../lib/i18n.mjs';
import { reportConflicts } from './share.mjs';

// "My Work" → "my-work", offered when a typed name is not allowed.
function suggestName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function add(name) {
  const err = validateProfileName(name);
  if (err) {
    const suggestion = name ? suggestName(name) : '';
    throw userError(err, suggestion && suggestion !== name && !validateProfileName(suggestion)
      ? [{ label: t('hint.try'), command: `cpf add ${suggestion}` }] : []);
  }
  const meta = readMeta();
  if (profileExists(name) || meta.profiles.includes(name)) {
    throw new Error(t('profile.exists', { name }));
  }
  createProfile(name, meta.shareSettings !== false);
  reportConflicts(syncShared([name]));
  success(t('add.created', { name }));
  console.log();
  console.log(`    ${color.dim(t('add.next'))}`);
  console.log(`    1. ${t('add.step1', { command: color.cyan('claude') })}`);
  console.log(`    2. ${t('add.step2', { name: color.bold(name) })}`);
  console.log(`    3. ${t('add.step3')}`);
}
