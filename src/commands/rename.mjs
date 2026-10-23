import { info, success, warn } from '../lib/ui.mjs';
import { renameProfile } from '../lib/profile.mjs';

export async function rename(oldName, newName) {
  if (!oldName || !newName) throw new Error('Usage: cpf rename <old-name> <new-name>');
  if (oldName !== newName) {
    warn(`Close running Claude sessions using "${oldName}" before renaming; they still use the old configuration path.`);
    if (process.platform === 'darwin') {
      warn('macOS may require signing in again after the configuration path changes.');
    }
  }
  if (renameProfile(oldName, newName)) success(`Renamed profile: ${oldName} → ${newName}`);
  else info(`"${oldName}" already has that name`);
}
