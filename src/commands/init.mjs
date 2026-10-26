import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { color, intro, outro, success, sym, warn } from '../lib/ui.mjs';
import * as prompt from '../lib/prompt.mjs';
import { readMeta, writeMeta } from '../lib/config.mjs';
import { createProfile, profileExists, validateProfileName, migrateDir, migrationSource } from '../lib/profile.mjs';
import { HOME, DEFAULT_CLAUDE_DIR, IS_WINDOWS } from '../lib/constants.mjs';
import { installAllShells } from '../lib/shell.mjs';
import { t } from '../lib/i18n.mjs';

export function existingClaudeSources() {
  const candidates = [
    process.env.CLAUDE_CONFIG_DIR,
    DEFAULT_CLAUDE_DIR,
    join(HOME, '.claude-work'),
    join(HOME, '.claude-personal'),
  ].filter(Boolean);
  return [...new Set(candidates.map(path => resolve(path)))].filter(path => {
    const source = migrationSource(path);
    return existsSync(source.directory) || existsSync(source.userConfig);
  });
}

export async function init() {
  const current = readMeta();
  if (current.profiles.length > 0) {
    warn(t('init.already'));
    console.log(`  ${color.dim(t('init.profiles'))} ${current.profiles.join(', ')}`);
    console.log(`  ${color.dim(t('init.active'))} ${current.activeProfile || t('common.none')}`);
    console.log(`  ${color.dim(t('init.addHint'))} ${color.cyan('cpf add <name>')}`);
    console.log(`  ${color.dim(t('init.repairHint'))} ${color.cyan('npx ai-profile-switch@latest install-shell')}`);
    return;
  }

  intro(t('init.title'));
  console.log(`${color.dim(sym.rail)}  ${color.dim(t('init.tagline'))}`);
  console.log(`${color.dim(sym.rail)}  ${color.dim(t('init.closeSessions'))}`);
  console.log(color.dim(sym.rail));
  const names = await askProfileNames();
  const activeProfile = names.length === 1
    ? names[0]
    : await prompt.select(t('init.activeQuestion'), names);
  if (!activeProfile) return;
  const shareSettings = await prompt.confirm(t('init.shareQuestion'), true);
  const sources = existingClaudeSources();
  let migration;
  if (sources.length > 0) {
    const source = await prompt.select(t('init.copyQuestion'), [
      ...sources.map(path => ({ label: path, value: path })),
      { label: t('init.skip'), value: '__skip__' },
    ]);
    if (!source) return;
    if (source !== '__skip__') {
      const target = names.length === 1 ? names[0] : await prompt.select(t('migrate.target'), names);
      if (!target) return;
      migration = { source, target };
    }
  }
  for (const name of names) {
    if (profileExists(name)) throw new Error(t('init.dirExists', { name }));
  }
  outro('');
  if (migration) {
    const { backupPath } = migrateDir(migration.source, migration.target, shareSettings);
    success(t('migrate.copied', { source: migration.source, name: migration.target }));
    if (backupPath) warn(t('migrate.backup', { path: backupPath }));
  }
  for (const name of names) {
    if (migration?.target !== name) createProfile(name, shareSettings);
    success(t('init.ready', { name }));
  }
  writeMeta({ ...readMeta(), activeProfile, shareSettings });
  const { newlyInstalled, alreadyInstalled } = installAllShells();
  const shells = [...newlyInstalled, ...alreadyInstalled];
  if (shells.length > 0) success(t('init.shells', { shells: shells.join(', ') }));
  success(t('init.activeDone', { name: activeProfile }));
  console.log();
  console.log(`  ${t('init.openTerminal', { command: color.cyan('claude') })}`);
  if (names.length > 1) {
    const other = names.find(name => name !== activeProfile);
    const command = IS_WINDOWS ? `cpf ${other}; claude` : `cpf ${other} && claude`;
    console.log(`  ${t('init.otherProfile')} ${color.cyan(command)}`);
  }
  if (migration) warn(t('migrate.preserved'));
  console.log();
}

// One prompt takes every name, such as "work, personal".
async function askProfileNames() {
  while (true) {
    const names = (await prompt.text(t('init.names'), 'work, personal'))
      .split(',').map(name => name.trim()).filter(Boolean);
    const problem = profileNamesProblem(names);
    if (!problem) return names;
    console.log(`  ${color.red(problem)}`);
  }
}

function profileNamesProblem(names) {
  if (!names.length) return validateProfileName('');
  for (const [index, name] of names.entries()) {
    const error = validateProfileName(name);
    if (error) return `${name}: ${error}`;
    if (names.indexOf(name) !== index) return t('init.duplicate', { name });
    if (profileExists(name)) return t('init.used', { name });
  }
  return null;
}
