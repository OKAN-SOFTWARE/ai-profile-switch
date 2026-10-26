import { info, success, warn } from '../lib/ui.mjs';
import { renameProfile } from '../lib/profile.mjs';
import { t } from '../lib/i18n.mjs';

export async function rename(oldName, newName) {
  if (!oldName || !newName) throw new Error('Usage: cpf rename <old-name> <new-name>');
  if (oldName !== newName) {
    warn(t('rename.closeSessions', { name: oldName }));
    if (process.platform === 'darwin') warn(t('rename.macSignIn'));
  }
  if (renameProfile(oldName, newName)) success(t('rename.done', { old: oldName, new: newName }));
  else info(t('rename.same', { name: oldName }));
}
