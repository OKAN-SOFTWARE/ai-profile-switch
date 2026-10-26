import { color, info, success, warn } from '../lib/ui.mjs';
import { checkRename, renameProfile } from '../lib/profile.mjs';
import { t } from '../lib/i18n.mjs';

// warned: the caller already asked to close sessions, so do not say it twice.
export async function rename(oldName, newName, { warned = false } = {}) {
  if (!oldName || !newName) throw new Error('Usage: cpf rename <old-name> <new-name>');
  checkRename(oldName, newName);
  if (oldName === newName) {
    info(t('rename.same', { name: oldName }));
    return;
  }
  if (!warned) warn(t('rename.closeSessions', { name: oldName }));
  renameProfile(oldName, newName);
  success(t('rename.done', { old: oldName, new: color.bold(newName) }));
  const kept = process.platform === 'darwin' ? `${t('rename.kept')} ${t('rename.macSignIn')}` : t('rename.kept');
  console.log(`    ${color.dim(kept)}`);
  console.log(`    ${t('rename.next', { command: color.cyan('claude'), name: color.bold(newName) })}`);
}
