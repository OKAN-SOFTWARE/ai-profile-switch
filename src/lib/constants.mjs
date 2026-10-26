import { homedir } from 'node:os';
import { join } from 'node:path';

export const HOME = homedir();
export const IS_WINDOWS = process.platform === 'win32';
export const PROFILES_DIR = join(HOME, '.claude-profiles');
export const SHARED_DIR = join(PROFILES_DIR, '_shared');
export const META_FILE = join(PROFILES_DIR, 'meta.json');

export const DEFAULT_CLAUDE_DIR = join(HOME, '.claude');

export const PROFILE_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const PROFILE_NAME_MAX_LENGTH = 30;
export const RESERVED_NAMES = ['_shared', 'default'];

// Files/dirs that are shared across profiles (symlinked)
export const SHARED_FILES = ['settings.json'];
export const SHARED_DIRS = ['commands'];

// Files/dirs that are profile-specific (copied independently)
export const PROFILE_FILES = [
  '.claude.json', '.credentials.json', 'settings.local.json', 'history.jsonl', 'CLAUDE.md',
  'keybindings.json', 'pre-launch.sh', 'pre-launch.fish', 'pre-launch.ps1',
];
export const PROFILE_DIRS = [
  'plugins', 'projects', 'plans', 'skills', 'agents', 'rules', 'hooks',
  'file-history', 'output-styles', 'agent-memory', 'workflows', 'themes', 'tasks',
];

// Profile entries a user may opt into sharing with `cpf share add`.
// Account data (.claude.json, history, projects, plugins) always stays per profile.
export const SHAREABLE_ENTRIES = [
  'CLAUDE.md', 'keybindings.json', 'skills', 'agents', 'rules', 'hooks',
  'output-styles', 'workflows', 'themes',
];
export const SHAREABLE_FILES = ['CLAUDE.md', 'keybindings.json'];
// Skills are linked one by one so each account keeps its own synced skills.
export const ACCOUNT_SKILL_ENTRIES = ['synced'];

export const SELF_PKG = 'ai-profile-switch';
