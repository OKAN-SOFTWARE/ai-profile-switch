# claude-account-switch

[![npm version](https://img.shields.io/npm/v/claude-account-switch)](https://www.npmjs.com/package/claude-account-switch)
[![license](https://img.shields.io/npm/l/claude-account-switch)](./LICENSE)

Profile switching for [Claude Code](https://code.claude.com/docs/en/iam#log-in-with-multiple-accounts) using `CLAUDE_CONFIG_DIR`. No runtime dependencies.

[한국어](./README.ko.md) · [Full guide](https://ftery0.github.io/claude-account-switch/guide/)

This README describes the repository source. The new `cpf` management menu and profile renaming require this source or a release containing them; `@latest` installs the currently published npm package. See [existing users](#existing-users) to refresh the shell commands from this checkout.

## Start

Use Node.js 18.19+ (18.x) or 20.10+ and your existing Claude Code installation. If Claude Code is missing, follow its [official installation guide](https://code.claude.com/docs/en/setup).

```bash
npx claude-account-switch@latest init
```

Choose profile names (for example, `work` and `personal`), optionally copy one existing configuration, then open a new terminal. `init` is first-time setup; running it again only shows your existing setup.

## Two commands for everyday use

Run `cpf` and `claude` at your **terminal's shell prompt** (`%` or `$`). If you are inside Claude's chat, enter `/exit` there first and wait for the terminal prompt.

1. At the terminal, run `cpf` to open the list, switch, add, rename, remove, or exit menu.
2. Choose with ↑/↓ and Enter. When finished, select Exit to return to the terminal without launching Claude.
3. At the terminal, run `claude`, choose a profile, and sign in if Claude asks.

For a direct action, use:

| Command | What it does |
| --- | --- |
| `cpf work` | Make `work` active |
| `cpf --list` | Show profiles and the active one |
| `cpf add work2` | Create a profile named `work2` |
| `cpf rename wrok2 work2` | Rename `wrok2` to `work2` |
| `cpf remove work2` | Delete `work2` after confirmation |
| `cpf --help` | Show the command guide |

Replace the example names with yours. A single name always selects that profile, even `cpf add`, `cpf rename`, `cpf remove`, or `cpf list`; use `cpf --list` to list profiles.

With multiple profiles, interactive `claude` launches show a picker, starting on the active profile. In scripts, `claude` uses the active profile without a picker. Claude arguments, including `--help` and `--version`, pass through. Switching affects future launches; already running Claude sessions keep their profile and account.

## Add another account

1. At the terminal, create the profile:

   ```bash
   cpf add work2
   ```

2. Start Claude from the terminal:

   ```bash
   claude
   ```

3. Select `work2` in the picker, then sign in to the intended account when Claude asks.

Creating a profile does not switch to it or sign in for you. The `cpf` menu can also add a profile without memorizing the command.

## Bring in your existing default account

To run the original Claude CLI without importing a profile, use `command claude` at a Bash/zsh terminal prompt to bypass the wrapper. It uses Claude's normal configuration; if you have set `CLAUDE_CONFIG_DIR` separately, that path applies.

Your normal `~/.claude` configuration is not automatically imported or logged in when you create a profile. First-time `init` lets you select that source and the destination profile. If profiles already exist, rerunning `init` only shows a summary; use an explicit migration instead.

1. Enter `/exit` in every Claude session using the source or destination, then return to the terminal.
2. Choose a destination with `cpf --list`. If you need a new profile, create it with `cpf add work`.
3. From this repository's root in the terminal, copy into that profile and confirm the prompt:

   ```bash
   node bin/cli.mjs migrate work --from ~/.claude
   ```

4. At the terminal, run `claude`, select `work`, and sign in if requested. Replace `work` with your chosen profile name.

The original `~/.claude` and `~/.claude.json` are preserved. If existing destination data is replaced, its previous copy is also retained at the backup path printed after success. Conflicting data or detected destination changes stop migration. macOS Keychain credentials are not copied, so importing configuration does not guarantee an authenticated session. See [migration details](https://ftery0.github.io/claude-account-switch/guide/commands#import-an-existing-configuration).

## Fix a profile name

Close every Claude session using the profile before renaming it. For example, to correct `wrok2`:

```bash
cpf rename wrok2 work2
```

Renaming preserves the profile's history, settings, list position, and active selection. It stops if `work2` already exists. The configuration path changes, so macOS may ask you to sign in again. Start a new Claude session after renaming.

## Existing users

To use changes from this source checkout, run this **from the repository root**, then open a new terminal:

```bash
node bin/cli.mjs install-shell
```

For the published npm version, use this to install, repair, or refresh the shell commands and local runtime, then open a new terminal:

```bash
npx claude-account-switch@latest install-shell
```

`install-shell` does not add profiles or sign in. Existing shells need the refresh before their `cpf` function can use the new management commands. Users of 1.x also run `install-shell` once to enable the local runtime. The older `claude-pick` command remains available for selecting an active profile without launching Claude.

The shell uses `~/.claude-profiles/_runtime`, so a global installation and the temporary npx cache are not needed for daily use. Node.js, npm, and Claude Code must remain available.

Interactive Claude launches check for this tool's updates once daily in the background. A verified compatible package becomes active on the next launch. Active sessions keep their existing files; account data, harness hooks, and shell profiles are not rewritten. Offline or failed downloads keep the installed version. Noninteractive launches do not update.

Set `CLAUDE_SWITCH_DISABLE_AUTO_UPDATE=1` to disable automatic updates. For an immediate update to the published version, run `npx claude-account-switch@latest update`; add `--check` to check without installing. Global npm installations are independent; the shell runtime updates itself. Previous runtime versions are retained to protect active sessions.

## Full CLI reference

These commands run the source checkout from the repository root. For a released version, replace `node bin/cli.mjs` with `npx claude-account-switch@latest`, or `claude-account-switch` if globally installed.

| Command | Purpose |
| --- | --- |
| `node bin/cli.mjs manage` | Open the same menu as `cpf` |
| `node bin/cli.mjs manage --list` | List profiles through the management interface |
| `node bin/cli.mjs init` | First setup or existing setup summary |
| `node bin/cli.mjs add work2` | Create a profile |
| `node bin/cli.mjs rename wrok2 work2` | Rename a profile |
| `node bin/cli.mjs remove work2` | Delete a profile after confirmation |
| `node bin/cli.mjs list` | Show profiles and active selection |
| `node bin/cli.mjs use work` | Change the active profile |
| `node bin/cli.mjs migrate work --from ~/.claude` | Copy existing configuration safely |
| `node bin/cli.mjs install-shell` | Install, repair, or refresh the local runtime and shell commands |
| `node bin/cli.mjs update --check` | Check for a published update without installing |
| `node bin/cli.mjs update` | Update the local runtime |
| `node bin/cli.mjs mcp list` | Read legacy MCP names and migration guidance |
| `node bin/cli.mjs rename --help` | Show help for a command without changing files |

Migration preserves the source and stops on conflicting data. Skills, agents, rules, hooks, and `CLAUDE.md` stay with the selected profile. macOS Keychain credentials are not copied; Claude may require login in the new profile. See [migration and compatibility](https://ftery0.github.io/claude-account-switch/guide/commands).

Version 2 removes the separate MCP editor and Claude installer. Use official `claude mcp` and Claude's [update mechanism](https://code.claude.com/docs/en/setup#update-manually). Existing legacy MCP files remain unchanged. Automatic updates affect only this tool, never Claude Code.

Platform guides: [macOS](docs/setup-macos.md) · [Linux](docs/setup-linux.md) · [Windows](docs/setup-windows.md)

[MIT](./LICENSE)
