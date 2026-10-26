import { parseArgs } from 'node:util';
import { computeUpdatePlan, compareSemver } from '../lib/updater.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installedRuntimeDirectory, runSelfUpdate } from '../lib/self-update.mjs';
import { displayWidth, info, warn, error } from '../lib/ui.mjs';
import { t } from '../lib/i18n.mjs';

export async function update(args = []) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    check: { type: 'boolean', short: 'n' },
    self: { type: 'boolean' },
    'claude-code': { type: 'boolean' },
    yes: { type: 'boolean', short: 'y' },
  } });
  if (positionals.length) throw new Error('Usage: update [--check] [--self]');
  if (values['claude-code']) {
    info(t('update.claudeManaged'));
    info(t('update.seeSetup'));
    if (values.check) {
      warn(t('update.notChecked'));
      process.exitCode = 2;
    }
    if (!values.self) return;
  }
  let self;
  try {
    ({ self } = await computeUpdatePlan());
    const runtime = installedRuntimeDirectory();
    if (runtime) {
      self.installed = JSON.parse(readFileSync(join(runtime, 'package.json'), 'utf8')).version;
      self.hasUpdate = compareSemver(self.installed, self.latest) < 0;
    }
  } catch (err) {
    error(err.message);
    process.exitCode = 2;
    return;
  }
  const table = [[t('update.package'), t('update.installed'), t('update.latest')], [self.pkg, self.installed, self.latest]];
  const widths = [0, 1].map(column => Math.max(...table.map(row => displayWidth(row[column]))) + 3);
  for (const row of table) console.log(row.map((cell, column) => cell + ' '.repeat(Math.max(0, (widths[column] ?? 0) - displayWidth(cell)))).join('').trimEnd());
  if (!self.hasUpdate) info(t('update.upToDate'));
  else if (values.check) info(t('update.runToInstall'));
  else {
    const result = await runSelfUpdate({ force: true, computePlan: async () => ({ self }) });
    if (result.action === 'updated') info(t('update.updated', { version: result.version }));
    else if (result.reason === 'not-installed') info(t('update.notInstalled'));
    else if (result.reason === 'busy') { warn(t('update.busy')); process.exitCode = 2; }
    else if (result.action === 'failed') { error(t('update.failed', { error: result.error })); process.exitCode = 2; }
  }
  if (values.check && !values['claude-code']) process.exitCode = self.hasUpdate ? 1 : 0;
}

