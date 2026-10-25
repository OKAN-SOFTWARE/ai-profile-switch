import { success, info } from '../lib/ui.mjs';
import { assertRegisteredProfile } from '../lib/profile.mjs';
import { setActiveProfile, getActiveProfile } from '../lib/config.mjs';

export async function use(name) {
  assertRegisteredProfile(name);
  const current = getActiveProfile();
  if (current === name) {
    info(`"${name}" is already the active profile`);
    return;
  }
  setActiveProfile(name);
  success(`Switched to profile: ${name}`);
}
