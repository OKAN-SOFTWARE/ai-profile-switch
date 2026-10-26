import { spawn } from 'node:child_process';
import { accountInfo } from '../lib/account.mjs';
import { t } from '../lib/i18n.mjs';
import { assertRegisteredProfile, profileDir } from '../lib/profile.mjs';
import { color, info, success, userError, warn } from '../lib/ui.mjs';
import { accountSummary, resolveClaudeBinary } from './shell.mjs';

function runAuthLogin(bin, name) {
  const cmd = bin.endsWith('.js') ? process.execPath : bin;
  const args = bin.endsWith('.js') ? [bin, 'auth', 'login'] : ['auth', 'login'];
  return new Promise(resolve => {
    const child = spawn(cmd, args, {
      stdio: 'inherit', shell: false,
      env: { ...process.env, CLAUDE_CONFIG_DIR: profileDir(name) },
    });
    child.once('error', () => resolve(1));
    child.once('close', code => resolve(code ?? 1));
  });
}

// Signs one profile in again with Claude Code's own login; other profiles keep theirs.
// explained: the menu already showed the current sign-in and what will happen.
export async function login(name, { explained = false } = {}) {
  if (!name) throw new Error(t('login.usage'));
  assertRegisteredProfile(name);
  const bin = resolveClaudeBinary();
  if (!bin) throw userError(t('launch.notFound'), [{ label: t('launch.install'), text: 'https://code.claude.com/docs/en/setup' }]);
  const before = accountSummary(accountInfo(name));
  if (!explained) {
    console.log(`  ${color.dim(t('login.current'))} ${before || color.dim(t('account.notSignedIn'))}`);
    warn(t('login.closeSessions', { name }));
  }
  console.log(`  ${color.dim(t('login.opening'))}`);
  const code = await runAuthLogin(bin, name);
  if (code !== 0) throw new Error(t('login.failed', { code }));
  const after = accountSummary(accountInfo(name));
  if (!after) warn(t('login.notSaved', { name }));
  else if (after === before) info(t('login.same', { name, account: after }));
  else {
    success(t('login.done', { name, account: color.bold(after) }));
    console.log(`    ${color.dim(t('login.usageLater'))}`);
  }
}
