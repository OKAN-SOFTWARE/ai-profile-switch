import { success, warn } from '../lib/ui.mjs';
import { confirm } from '../lib/prompt.mjs';
import { assertRegisteredProfile, removeProfile } from '../lib/profile.mjs';
import { getActiveProfile } from '../lib/config.mjs';

export async function remove(name) {
  if (!name) throw new Error('Usage: cpf remove <name>');

  assertRegisteredProfile(name);

  const active = getActiveProfile();
  if (name === active) {
    warn(`"${name}" is the currently active profile`);
  }

  const yes = await confirm(`Delete profile "${name}"? This cannot be undone`, false);
  if (!yes) {
    console.log('  Cancelled.');
    return;
  }

  removeProfile(name);
  success(`Removed profile: ${name}`);

  if (name === active) {
    const newActive = getActiveProfile();
    if (newActive) {
      success(`Active profile switched to: ${newActive}`);
    } else {
      warn('No profiles remaining. Run cpf to add a profile, or npx claude-account-switch@latest init to set up again.');
    }
  }
}
