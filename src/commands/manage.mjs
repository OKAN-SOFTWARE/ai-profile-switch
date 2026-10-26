import * as prompt from '../lib/prompt.mjs';
import { readMeta } from '../lib/config.mjs';
import { error, warn } from '../lib/ui.mjs';
import { add } from './add.mjs';
import { list } from './list.mjs';
import { use } from './use.mjs';
import { remove } from './remove.mjs';
import { rename } from './rename.mjs';
import { share } from './share.mjs';

function help() {
  console.log(`Usage:
  cpf                         Open the profile management menu
  cpf <name>                  Switch to an existing profile
  cpf --list                  List profiles and the active one
  cpf add <name>              Create a profile
  cpf rename <old> <new>       Rename a profile, keeping its data
  cpf remove <name>           Delete a profile after confirmation
  cpf share                   Show what every profile shares
  cpf share add <entry>       Share CLAUDE.md, skills, agents, … across profiles
  cpf share remove <entry>    Stop sharing; each profile keeps a copy
  cpf --help                  Show this help

Enter these commands in your terminal, outside the Claude Code chat. Use /exit to leave the chat.
Run claude to choose a profile and launch Claude Code.
Before renaming, close sessions using that profile; macOS may require sign-in again.
Without shell setup, use: npx ai-profile-switch@latest manage [arguments]`);
}

export async function manage(args = []) {
  if (args.some(arg => ['--help', '-h'].includes(arg))) {
    help();
    return;
  }
  if (args.length === 1 && args[0] === '--list') return list();
  if (args[0] === 'share') return share(args.slice(1));
  if (args.length === 1 && !args[0].startsWith('-')) return use(args[0]);
  if (args.length > 0) {
    const [command, ...names] = args;
    const operations = { add: [1, add], remove: [1, remove], rename: [2, rename] };
    const operation = Object.hasOwn(operations, command) ? operations[command] : undefined;
    if (!operation || names.length !== operation[0] || names.some(name => name.startsWith('-'))) {
      throw new Error('Invalid arguments. Run cpf --help for usage.');
    }
    return operation[1](...names);
  }
  if (!process.stdin.isTTY) {
    help();
    return;
  }

  while (true) {
    const meta = readMeta();
    const actions = meta.profiles.length ? [
      { label: 'Switch profile', value: 'use' },
      { label: 'List profiles', value: 'list' },
      { label: 'Add profile', value: 'add' },
      { label: 'Rename profile', value: 'rename' },
      { label: 'Delete profile', value: 'remove' },
      { label: 'Show shared items', value: 'share' },
      { label: 'Exit', value: 'exit' },
    ] : [
      { label: 'Add profile', value: 'add' },
      { label: 'Exit', value: 'exit' },
    ];
    const action = await prompt.select(`Manage profiles (active: ${meta.activeProfile || 'none'})`, actions);
    if (!action || action === 'exit') return;
    try {
      if (action === 'list') {
        await list();
      } else if (action === 'share') {
        await share();
      } else if (action === 'add') {
        const name = await prompt.text('New profile name (empty to cancel):');
        if (name) await add(name);
      } else {
        const name = await prompt.select('Choose a profile:', meta.profiles.map(profile => ({
          label: profile === meta.activeProfile ? `${profile} (active)` : profile,
          value: profile,
        })), { initial: meta.profiles.indexOf(meta.activeProfile) });
        if (!name) return;
        if (action === 'use') await use(name);
        else if (action === 'remove') await remove(name);
        else {
          warn('Close running sessions for this profile before continuing. macOS may require sign-in again.');
          const newName = await prompt.text('New name (empty to cancel):');
          if (newName && await prompt.confirm(`Rename "${name}" to "${newName}"?`, false)) {
            await rename(name, newName);
          }
        }
      }
    } catch (err) {
      error(err.message);
    }
  }
}
