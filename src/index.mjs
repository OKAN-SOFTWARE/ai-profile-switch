import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { error, color } from './lib/ui.mjs';

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

const COMMANDS = {
  init: () => import('./commands/init.mjs').then(m => m.init()),
  add: args => import('./commands/add.mjs').then(m => m.add(args[0])),
  remove: args => import('./commands/remove.mjs').then(m => m.remove(args[0])),
  rename: args => import('./commands/rename.mjs').then(m => m.rename(...args)),
  list: () => import('./commands/list.mjs').then(m => m.list()),
  use: args => import('./commands/use.mjs').then(m => m.use(args[0])),
  manage: args => import('./commands/manage.mjs').then(m => m.manage(args)),
  'install-shell': () => import('./commands/install-shell.mjs').then(m => m.installShell()),
  migrate: args => import('./commands/migrate.mjs').then(m => m.migrate(undefined, args)),
  share: args => import('./commands/share.mjs').then(m => m.share(args)),
  mcp: args => import('./commands/mcp/index.mjs').then(m => m.mcp(args)),
  update: args => import('./commands/update.mjs').then(m => m.update(args)),
  shell: args => import('./commands/shell.mjs').then(m => m.shell(args)),
};

const USAGE = {
  init: 'init',
  add: 'add <name>',
  remove: 'remove <name>',
  rename: 'rename <old-name> <new-name>',
  list: 'list',
  use: 'use <name>',
  manage: 'manage [profile | add <name> | rename <old-name> <new-name> | remove <name> | --list]',
  'install-shell': 'install-shell',
  migrate: 'migrate [profile] [--from <path>]',
  share: 'share [list | add <entry> | remove <entry> | sync]',
  mcp: 'mcp [list]',
  update: 'update [--check] [--self] [--claude-code] [--yes]',
  shell: 'shell <launch|use|pick|refresh>',
};
const POSITIONAL_COUNTS = { init: 0, add: 1, remove: 1, rename: 2, list: 0, use: 1, 'install-shell': 0 };

function showHelp(command) {
  if (command) {
    console.log(`Usage: npx claude-account-switch@latest ${USAGE[command]}`);
    if (command === 'rename') console.log('Close running sessions for this profile first. Its history and settings are kept; macOS may require sign-in again.');
    if (command === 'remove') console.log('Deletes a registered profile after confirmation. This cannot be undone.');
    if (command === 'add') console.log('Creates a profile. Run claude, choose it, and sign in to the intended account.');
    if (command === 'use') console.log('Changes the active profile for future launches; existing sessions keep their profile.');
    return;
  }
  console.log(`
  ${color.bold('claude-account-switch')} — Profile switching for Claude Code

  Everyday commands (in your terminal, after shell setup):
    claude                 Select a profile and launch Claude Code
    cpf                    Open the profile management menu
    cpf work               Switch to an existing profile
    cpf --help             Show short management commands

  Usage: npx claude-account-switch@latest <command> [options]

  Commands:
    init                   First setup; show existing setup on repeated runs
    add <name>             Create a profile
    remove <name>          Remove a profile after confirmation
    rename <old> <new>      Rename a profile, keeping its data
    list                   List profiles
    use <name>             Change the active profile
    manage                 Open the same menu as cpf
    install-shell          Install or repair shell integration
    migrate [name]         Import existing settings (--from <path>)
    update [--check]        Update this tool; --check only checks
    share [add|remove]     Share CLAUDE.md, skills, agents, … across profiles
    mcp [list]             Show legacy MCP migration guidance

  Run any command with --help for its usage.
`);
}

export async function run(argv) {
  const [command, ...args] = argv;
  if (!command || ['help', '--help', '-h'].includes(command)) {
    if (command === 'help' && args.length === 1 && Object.hasOwn(COMMANDS, args[0])) showHelp(args[0]);
    else showHelp();
    return;
  }
  if (['--version', '-v'].includes(command)) {
    console.log(pkg.version);
    return;
  }
  if (!Object.hasOwn(COMMANDS, command)) {
    error(`Unknown command: ${command}`);
    showHelp();
    process.exitCode = 1;
    return;
  }
  try {
    // Claude's forwarded arguments must reach it unchanged.
    const wantsHelp = command === 'shell'
      ? ['--help', '-h'].includes(args[0])
      : command !== 'manage' && args.some(arg => ['--help', '-h'].includes(arg));
    if (wantsHelp) {
      showHelp(command);
      return;
    }
    if (Object.hasOwn(POSITIONAL_COUNTS, command)
      && (args.length !== POSITIONAL_COUNTS[command] || args.some(arg => arg.startsWith('-')))) {
      throw new Error(`Usage: npx claude-account-switch@latest ${USAGE[command]}`);
    }
    await COMMANDS[command](args);
  } catch (err) {
    error(err.message);
    process.exitCode = 1;
  }
}
