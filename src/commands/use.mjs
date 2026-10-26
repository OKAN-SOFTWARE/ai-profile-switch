import { color, success, info } from '../lib/ui.mjs';
import { assertRegisteredProfile } from '../lib/profile.mjs';
import { setActiveProfile, getActiveProfile } from '../lib/config.mjs';
import { t } from '../lib/i18n.mjs';

export async function use(name) {
  assertRegisteredProfile(name);
  const current = getActiveProfile();
  if (current === name) {
    info(t('use.already', { profile: name }));
    return;
  }
  setActiveProfile(name);
  success(t('use.switched', { profile: name }));
  console.log(`    ${color.dim(t('use.note'))}`);
}
