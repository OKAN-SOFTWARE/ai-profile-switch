import { mkdirSync } from 'node:fs';
import { PROFILES_DIR } from '../lib/constants.mjs';
import { installAllShells } from '../lib/shell.mjs';
import { success, info } from '../lib/ui.mjs';
import { t } from '../lib/i18n.mjs';

export async function installShell() {
  mkdirSync(PROFILES_DIR, { recursive: true });
  const { newlyInstalled, alreadyInstalled } = installAllShells();
  const shells = [...newlyInstalled, ...alreadyInstalled];
  success(t('install.done'));
  if (shells.length) success(t('install.shells', { shells: shells.join(', ') }));
  info(t('install.next'));
}
