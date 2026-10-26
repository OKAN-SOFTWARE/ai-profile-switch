// Reads what Claude Code saved in a profile, for display only. Nothing is written,
// and any field with an unexpected shape is left out instead of failing.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILES_DIR } from './constants.mjs';

const PLANS = { claude_max: 'Max', claude_pro: 'Pro', claude_team: 'Team', claude_enterprise: 'Enterprise' };

function readConfig(dir) {
  try {
    const config = JSON.parse(readFileSync(join(dir, '.claude.json'), 'utf8'));
    return config && typeof config === 'object' ? config : {};
  } catch {
    return {};
  }
}

function percent(window) {
  const value = window?.utilization;
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;
}

// Claude Code keeps usage in an undocumented cache; it may change or disappear.
function usage(cached, account) {
  if (!cached || typeof cached !== 'object') return null;
  if (typeof cached.accountUuid === 'string' && typeof account.accountUuid === 'string'
    && cached.accountUuid !== account.accountUuid) return null;
  const fiveHour = percent(cached.utilization?.five_hour);
  const weekly = percent(cached.utilization?.seven_day);
  if (fiveHour === null && weekly === null) return null;
  const savedAt = Number.isFinite(cached.fetchedAtMs) ? cached.fetchedAtMs : null;
  return { fiveHour, weekly, savedAt };
}

export function accountInfo(name) {
  const dir = join(PROFILES_DIR, name);
  const config = readConfig(dir);
  const account = config.oauthAccount && typeof config.oauthAccount === 'object' ? config.oauthAccount : {};
  let lastUsed = null;
  try { lastUsed = statSync(join(dir, 'history.jsonl')).mtimeMs; } catch { /* never used */ }
  return {
    email: typeof account.emailAddress === 'string' && account.emailAddress ? account.emailAddress : null,
    plan: Object.hasOwn(PLANS, account.organizationType) ? PLANS[account.organizationType] : null,
    usage: usage(config.cachedUsageUtilization, account),
    lastUsed,
  };
}
