import { color, info, success, warn } from '../lib/ui.mjs';
import { SHAREABLE_ENTRIES, SHARED_FILES, SHARED_DIRS } from '../lib/constants.mjs';
import { readMeta } from '../lib/config.mjs';
import { shareEntry, syncShared, unshareEntry } from '../lib/shared.mjs';

export function reportConflicts(results) {
  for (const { name, conflicts, missing } of results) {
    for (const entry of conflicts) {
      warn(`${name}: kept its own ${entry} because it differs from the shared copy. Move or delete it, then run cpf share sync.`);
    }
    for (const entry of missing) warn(`${name}: shared ${entry} is missing from _shared.`);
  }
}

function status() {
  const meta = readMeta();
  const shared = meta.shared ?? [];
  console.log();
  console.log(`  ${color.bold('Shared by every profile:')} ${[...SHARED_FILES, ...SHARED_DIRS, ...shared].join(', ')}`);
  console.log(`  ${color.dim(`Can also share: ${SHAREABLE_ENTRIES.filter(entry => !shared.includes(entry)).join(', ') || 'nothing left'}`)}`);
  console.log();
  for (const result of syncShared(meta.profiles, { dryRun: true })) {
    const problems = [
      ...result.conflicts.map(entry => color.yellow(`own ${entry}`)),
      ...result.linked.map(entry => `${entry} not linked yet`),
      ...result.missing.map(entry => color.red(`${entry} missing`)),
    ];
    console.log(`  ${result.name.padEnd(12)} ${problems.length ? problems.join(', ') : color.green('in sync')}`);
  }
  if (!shared.length) info('Nothing extra is shared yet. Example: cpf share add CLAUDE.md');
  console.log();
}

export async function share(args = []) {
  const [command, entry, ...rest] = args;
  if (rest.length || (['add', 'remove'].includes(command) ? !entry : entry !== undefined)) {
    throw new Error('Usage: cpf share [list | add <entry> | remove <entry> | sync]');
  }
  if (!command || command === 'list') return status();
  if (command === 'sync') {
    const results = syncShared();
    reportConflicts(results);
    success(`Linked ${results.reduce((count, result) => count + result.linked.length, 0)} entries.`);
    return;
  }
  if (command === 'add') {
    const results = shareEntry(entry);
    reportConflicts(results);
    success(`Sharing ${entry} through ~/.claude-profiles/_shared/${entry}`);
    return;
  }
  if (command === 'remove') {
    unshareEntry(entry);
    success(`Stopped sharing ${entry}. Each profile kept its own copy.`);
    return;
  }
  throw new Error('Usage: cpf share [list | add <entry> | remove <entry> | sync]');
}
