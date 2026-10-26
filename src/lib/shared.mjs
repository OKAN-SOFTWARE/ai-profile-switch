// Opt-in sharing of profile entries (CLAUDE.md, skills, agents, …) through ~/.claude-profiles/_shared.
// Each profile gets a link to the shared copy; a profile file that differs is never replaced.
import { mkdirSync, readdirSync, readlinkSync, rmSync, writeFileSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  SHARED_DIR, SHAREABLE_ENTRIES, SHAREABLE_FILES, ACCOUNT_SKILL_ENTRIES,
} from './constants.mjs';
import { readMeta, getActiveProfile, getSharedEntries, setSharedEntries } from './config.mjs';
import { t } from './i18n.mjs';
import {
  pathExists, createLink, copyEntry, identicalEntries, emptyEntry, linkTarget, canonicalPath,
  profileDir, listProfiles,
} from './profile.mjs';

function pointsTo(link, target) {
  return lstatSync(link).isSymbolicLink() && canonicalPath(linkTarget(link)) === canonicalPath(target);
}

// 'ok' already linked, 'linked' newly linked (or would be, in a dry run), 'conflict' own content kept.
function placeLink(link, relativeTarget, sharedPath, isDir, dryRun) {
  if (!pathExists(link)) {
    if (!dryRun) createLink(relativeTarget, link, isDir);
    return 'linked';
  }
  if (pointsTo(link, sharedPath)) return 'ok';
  if (!identicalEntries(link, sharedPath) && !emptyEntry(link)) return 'conflict';
  if (!dryRun) {
    rmSync(link, { recursive: true, force: true });
    createLink(relativeTarget, link, isDir);
  }
  return 'linked';
}

function sharedSkillNames() {
  const dir = join(SHARED_DIR, 'skills');
  if (!pathExists(dir)) return [];
  return readdirSync(dir).filter(name => !name.startsWith('.') && !ACCOUNT_SKILL_ENTRIES.includes(name)).sort();
}

function linksIntoSharedSkills(path) {
  return lstatSync(path).isSymbolicLink()
    && canonicalPath(dirname(resolve(dirname(path), readlinkSync(path)))) === canonicalPath(join(SHARED_DIR, 'skills'));
}

function syncSkills(name, result, dryRun) {
  const skills = join(profileDir(name), 'skills');
  if (pathExists(skills) && (lstatSync(skills).isSymbolicLink() || !lstatSync(skills).isDirectory())) {
    result.conflicts.push('skills');
    return;
  }
  if (!dryRun) mkdirSync(skills, { recursive: true });
  const names = sharedSkillNames();
  for (const skill of names) {
    const state = placeLink(join(skills, skill), join('..', '..', '_shared', 'skills', skill),
      join(SHARED_DIR, 'skills', skill), true, dryRun);
    if (state === 'linked') result.linked.push(`skills/${skill}`);
    else if (state === 'conflict') result.conflicts.push(`skills/${skill}`);
  }
  if (!pathExists(skills)) return;
  // A skill removed from _shared leaves a dangling link behind.
  for (const skill of readdirSync(skills)) {
    const path = join(skills, skill);
    if (names.includes(skill) || !linksIntoSharedSkills(path)) continue;
    if (!dryRun) rmSync(path, { force: true });
    result.unlinked.push(`skills/${skill}`);
  }
}

export function syncProfile(name, entries = getSharedEntries(), { dryRun = false } = {}) {
  const result = { name, linked: [], unlinked: [], conflicts: [], missing: [] };
  for (const entry of entries) {
    const sharedPath = join(SHARED_DIR, entry);
    if (!pathExists(sharedPath)) {
      result.missing.push(entry);
      continue;
    }
    if (entry === 'skills') {
      syncSkills(name, result, dryRun);
      continue;
    }
    const state = placeLink(join(profileDir(name), entry), join('..', '_shared', entry),
      sharedPath, !SHAREABLE_FILES.includes(entry), dryRun);
    if (state === 'linked') result.linked.push(entry);
    else if (state === 'conflict') result.conflicts.push(entry);
  }
  return result;
}

export function syncShared(names = listProfiles(), options) {
  const meta = readMeta();
  if (!meta.shareSettings || !meta.shared?.length) return [];
  return names.map(name => syncProfile(name, meta.shared, options));
}

function validateEntry(entry) {
  if (!SHAREABLE_ENTRIES.includes(entry)) {
    throw new Error(t('share.cannot', { entry, list: SHAREABLE_ENTRIES.join(', ') }));
  }
}

function seedShared(entry, from) {
  const sharedPath = join(SHARED_DIR, entry);
  const source = from ? join(profileDir(from), entry) : null;
  const hasSource = source && pathExists(source) && !emptyEntry(source);
  if (entry === 'skills') {
    mkdirSync(sharedPath, { recursive: true });
    if (!hasSource) return;
    for (const skill of readdirSync(source)) {
      if (skill.startsWith('.') || ACCOUNT_SKILL_ENTRIES.includes(skill)) continue;
      copyEntry(join(source, skill), join(sharedPath, skill));
    }
  } else if (hasSource) {
    copyEntry(source, sharedPath);
  } else if (SHAREABLE_FILES.includes(entry)) {
    writeFileSync(sharedPath, '');
  } else {
    mkdirSync(sharedPath, { recursive: true });
  }
}

export function shareEntry(entry, from = getActiveProfile()) {
  validateEntry(entry);
  const meta = readMeta();
  if (!meta.shareSettings) throw new Error(t('share.needsSettings'));
  const entries = meta.shared ?? [];
  if (entries.includes(entry)) throw new Error(t('share.already', { entry }));
  mkdirSync(SHARED_DIR, { recursive: true });
  if (!pathExists(join(SHARED_DIR, entry))) seedShared(entry, from);
  setSharedEntries([...entries, entry]);
  return syncShared();
}

// Each profile keeps a copy of the shared content, so nothing disappears.
export function unshareEntry(entry) {
  validateEntry(entry);
  const entries = getSharedEntries();
  if (!entries.includes(entry)) throw new Error(t('share.notShared', { entry }));
  const sharedPath = join(SHARED_DIR, entry);
  for (const name of listProfiles()) {
    if (entry === 'skills') {
      const skills = join(profileDir(name), 'skills');
      if (!pathExists(skills) || lstatSync(skills).isSymbolicLink()) continue;
      for (const skill of readdirSync(skills)) {
        const path = join(skills, skill);
        if (!linksIntoSharedSkills(path)) continue;
        rmSync(path, { force: true });
        if (pathExists(join(sharedPath, skill))) copyEntry(join(sharedPath, skill), path);
      }
      continue;
    }
    const link = join(profileDir(name), entry);
    if (!pathExists(link) || !pointsTo(link, sharedPath)) continue;
    rmSync(link, { force: true });
    if (pathExists(sharedPath)) copyEntry(sharedPath, link);
  }
  setSharedEntries(entries.filter(item => item !== entry));
}
