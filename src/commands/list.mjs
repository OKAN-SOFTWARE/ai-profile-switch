import { color, info } from '../lib/ui.mjs';
import { listProfiles, profileDir } from '../lib/profile.mjs';
import { getActiveProfile } from '../lib/config.mjs';
import { HOME } from '../lib/constants.mjs';
import { accountInfo } from '../lib/account.mjs';
import { t } from '../lib/i18n.mjs';

export async function list() {
  const profiles = listProfiles();

  if (profiles.length === 0) {
    info(`${t('profiles.none')} ${t('hint.add')} cpf add work · ${t('hint.setup')} npx ai-profile-switch@latest init`);
    return;
  }

  const active = getActiveProfile();
  const width = Math.max(...profiles.map(name => name.length));

  console.log();
  console.log(`  ${color.bold(t('list.title'))}`);
  console.log();
  for (const name of profiles) {
    const isActive = name === active;
    const marker = isActive ? color.green(' * ') : '   ';
    const label = isActive ? color.bold(name.padEnd(width)) : name.padEnd(width);
    const { email, plan } = accountInfo(name);
    const account = [email, plan].filter(Boolean).join(' · ');
    const dir = profileDir(name);
    const shown = dir.startsWith(HOME) ? `~${dir.slice(HOME.length)}` : dir;
    console.log(`  ${marker}${label}  ${account ? `${account}  ` : ''}${color.dim(shown)}`);
  }
  console.log();
  console.log(`  ${t('list.active', { name: color.green(active || t('common.none')) })}`);
  console.log();
}
