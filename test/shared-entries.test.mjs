import './helpers/home.mjs';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { HOME, IS_WINDOWS, META_FILE, SHARED_DIR } from '../src/lib/constants.mjs';
import { createProfile, profileDir } from '../src/lib/profile.mjs';
import { readMeta, setActiveProfile } from '../src/lib/config.mjs';
import { shareEntry, syncShared, unshareEntry } from '../src/lib/shared.mjs';
import { add } from '../src/commands/add.mjs';

function write(path, data) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, data);
}

const isLink = path => lstatSync(path).isSymbolicLink();
const real = path => realpathSync(path);

beforeEach(() => {
  for (const name of readdirSync(HOME)) rmSync(join(HOME, name), { recursive: true, force: true });
  createProfile('work');
  createProfile('side');
  setActiveProfile('work');
});

describe('shared profile entries', () => {
  it('keeps the default sharing unchanged until an entry is added', () => {
    assert.equal(readMeta().shared, undefined);
    assert.deepEqual(syncShared(), []);
    assert.equal(isLink(join(profileDir('side'), 'agents')), false);
  });

  it('seeds a shared file from the active profile and links every profile', () => {
    write(join(profileDir('work'), 'CLAUDE.md'), '# rules');
    shareEntry('CLAUDE.md');
    assert.equal(readFileSync(join(SHARED_DIR, 'CLAUDE.md'), 'utf8'), '# rules');
    for (const name of ['work', 'side']) {
      const path = join(profileDir(name), 'CLAUDE.md');
      if (!IS_WINDOWS) assert.ok(isLink(path), name);
      assert.equal(readFileSync(path, 'utf8'), '# rules');
    }
    assert.deepEqual(readMeta().shared, ['CLAUDE.md']);
  });

  it('keeps a differing profile file and reports it as a conflict', () => {
    write(join(profileDir('work'), 'CLAUDE.md'), '# shared');
    write(join(profileDir('side'), 'CLAUDE.md'), '# side only');
    const results = shareEntry('CLAUDE.md');
    assert.deepEqual(results.find(result => result.name === 'side').conflicts, ['CLAUDE.md']);
    assert.equal(readFileSync(join(profileDir('side'), 'CLAUDE.md'), 'utf8'), '# side only');
    assert.equal(isLink(join(profileDir('side'), 'CLAUDE.md')), false);
  });

  it('replaces empty profile directories with links to the shared directory', () => {
    write(join(profileDir('work'), 'agents', 'reviewer.md'), 'review');
    shareEntry('agents');
    assert.ok(isLink(join(profileDir('side'), 'agents')));
    assert.equal(readFileSync(join(profileDir('side'), 'agents', 'reviewer.md'), 'utf8'), 'review');
  });

  it('links skills one by one and leaves account synced skills alone', () => {
    write(join(profileDir('work'), 'skills', 'plan', 'SKILL.md'), 'plan');
    write(join(profileDir('work'), 'skills', 'synced', 'acct', 'SKILL.md'), 'work account');
    write(join(profileDir('side'), 'skills', 'synced', 'acct', 'SKILL.md'), 'side account');
    shareEntry('skills');
    assert.deepEqual(readdirSync(join(SHARED_DIR, 'skills')), ['plan']);
    for (const name of ['work', 'side']) {
      const skills = join(profileDir(name), 'skills');
      assert.equal(isLink(skills), false);
      assert.ok(isLink(join(skills, 'plan')), name);
      assert.equal(isLink(join(skills, 'synced')), false);
    }
    assert.equal(readFileSync(join(profileDir('side'), 'skills', 'synced', 'acct', 'SKILL.md'), 'utf8'), 'side account');
  });

  it('picks up new shared skills and drops links to removed ones on sync', () => {
    shareEntry('skills');
    write(join(SHARED_DIR, 'skills', 'review', 'SKILL.md'), 'review');
    syncShared();
    assert.ok(isLink(join(profileDir('side'), 'skills', 'review')));
    rmSync(join(SHARED_DIR, 'skills', 'review'), { recursive: true });
    const [work] = syncShared(['work']);
    assert.deepEqual(work.unlinked, ['skills/review']);
    assert.equal(existsSync(join(profileDir('work'), 'skills', 'review')), false);
  });

  it('keeps a skill already linked to the same source as the shared copy', { skip: IS_WINDOWS }, () => {
    const source = join(HOME, 'agents-skills', 'deslop');
    write(join(source, 'SKILL.md'), 'deslop');
    symlinkSync(source, join(profileDir('work'), 'skills', 'deslop'), 'dir');
    symlinkSync(source, join(profileDir('side'), 'skills', 'deslop'), 'dir');
    const results = shareEntry('skills');
    assert.ok(results.every(result => result.conflicts.length === 0));
    assert.equal(real(join(profileDir('side'), 'skills', 'deslop')), real(source));
    assert.equal(real(join(SHARED_DIR, 'skills', 'deslop')), real(source));
  });

  it('links shared entries into a newly added profile', async () => {
    write(join(profileDir('work'), 'CLAUDE.md'), '# rules');
    shareEntry('CLAUDE.md');
    await add('fresh');
    assert.equal(readFileSync(join(profileDir('fresh'), 'CLAUDE.md'), 'utf8'), '# rules');
  });

  it('leaves a copy in every profile when sharing stops', () => {
    write(join(profileDir('work'), 'CLAUDE.md'), '# rules');
    write(join(profileDir('work'), 'skills', 'plan', 'SKILL.md'), 'plan');
    shareEntry('CLAUDE.md');
    shareEntry('skills');
    unshareEntry('CLAUDE.md');
    unshareEntry('skills');
    for (const name of ['work', 'side']) {
      assert.equal(isLink(join(profileDir(name), 'CLAUDE.md')), false);
      assert.equal(readFileSync(join(profileDir(name), 'CLAUDE.md'), 'utf8'), '# rules');
      assert.equal(isLink(join(profileDir(name), 'skills', 'plan')), false);
      assert.equal(readFileSync(join(profileDir(name), 'skills', 'plan', 'SKILL.md'), 'utf8'), 'plan');
    }
    assert.deepEqual(readMeta().shared, []);
    assert.ok(existsSync(join(SHARED_DIR, 'CLAUDE.md')));
  });

  it('rejects account data, duplicates, and invalid metadata', () => {
    assert.throws(() => shareEntry('.claude.json'), /cannot be shared/);
    assert.throws(() => shareEntry('projects'), /cannot be shared/);
    shareEntry('rules');
    assert.throws(() => shareEntry('rules'), /already shared/);
    assert.throws(() => unshareEntry('hooks'), /not shared/);
    const meta = JSON.parse(readFileSync(META_FILE, 'utf8'));
    writeFileSync(META_FILE, JSON.stringify({ ...meta, shared: ['history.jsonl'] }));
    assert.throws(() => readMeta(), /Invalid profile metadata/);
  });
});
