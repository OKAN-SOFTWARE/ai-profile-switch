import { success, warn } from '../lib/ui.mjs';
import { confirm } from '../lib/prompt.mjs';
import { assertRegisteredProfile, removeProfile } from '../lib/profile.mjs';
import { getActiveProfile } from '../lib/config.mjs';
import { t } from '../lib/i18n.mjs';

export async function remove(name) {
  if (!name) throw new Error('Usage: cpf remove <name>');

  assertRegisteredProfile(name);

  const active = getActiveProfile();
  if (name === active) {
    warn(t('remove.activeWarn', { name }));
  }

  const yes = await confirm(t('remove.confirm', { name }), false);
  if (!yes) {
    console.log(`  ${t('common.cancelled')}`);
    return;
  }

  removeProfile(name);
  success(t('remove.done', { name }));

  if (name === active) {
    const newActive = getActiveProfile();
    if (newActive) {
      success(t('remove.newActive', { name: newActive }));
    } else {
      warn(`${t('remove.none')} ${t('hint.add')} cpf add work · ${t('hint.setup')} npx ai-profile-switch@latest init`);
    }
  }
}
