import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { color, success, warn } from '../lib/ui.mjs';
import * as prompt from '../lib/prompt.mjs';
import { readMeta } from '../lib/config.mjs';
import { migrateDir, profileExists, validateProfileName } from '../lib/profile.mjs';
import { t } from '../lib/i18n.mjs';
import { existingClaudeSources } from './init.mjs';

export async function migrate(profileName, argv = []) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { from: { type: 'string' } },
    allowPositionals: true,
  });
  const meta = readMeta();
  if (meta.profiles.length === 0) {
    throw new Error(t('migrate.noProfiles'));
  }
  if (positionals.length > 1) throw new Error('Usage: ai-profile-switch migrate [profile] --from <path>');
  let target = positionals[0] || (profileName && !profileName.startsWith('-') ? profileName : undefined);
  if (!target) target = await prompt.select(t('migrate.target'), meta.profiles);
  if (!target) return;
  const error = validateProfileName(target);
  if (error) throw new Error(error);
  if (!profileExists(target) || !meta.profiles.includes(target)) {
    throw new Error(t('profile.notFound', { name: target }));
  }

  let source = values.from;
  if (source !== undefined && !source.trim()) throw new Error(t('migrate.emptySource'));
  if (!source) {
    const choices = existingClaudeSources().map(path => ({ label: path, value: path }));
    choices.push({ label: t('migrate.customPath'), value: '__custom__' });
    source = await prompt.select(t('migrate.which'), choices);
    if (!source) return;
    if (source === '__custom__') source = await prompt.text(t('migrate.enterPath'), '');
    if (!source.trim()) throw new Error(t('migrate.emptySource'));
  }
  source = resolve(source);
  console.log();
  console.log(`  ${color.dim(t('migrate.source'))} ${color.cyan(source)}`);
  console.log(`  ${color.dim(t('migrate.profile'))} ${color.cyan(target)}`);
  console.log(`  ${t('migrate.conflictNote')}`);
  warn(t('migrate.closeSessions'));
  const confirmed = await prompt.confirm(t('migrate.confirm', { name: target }), true);
  if (!confirmed) {
    console.log(`  ${t('common.cancelled')}`);
    return;
  }
  const { backupPath } = migrateDir(source, target, meta.shareSettings !== false);
  success(t('migrate.copied', { source, name: target }));
  if (backupPath) warn(t('migrate.backup', { path: backupPath }));
  warn(t('migrate.preserved'));
  console.log(`  ${t('migrate.signIn')}`);
  console.log();
}
