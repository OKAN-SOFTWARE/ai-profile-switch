import './helpers/home.mjs';
import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs, {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync,
  readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { HOME, IS_WINDOWS, META_FILE, PROFILES_DIR, SHARED_DIR } from '../src/lib/constants.mjs';
import {
  assertRegisteredProfile, createProfile, profileDir, removeProfile, renameProfile,
} from '../src/lib/profile.mjs';
import { readMeta, setActiveProfile } from '../src/lib/config.mjs';
import { remove } from '../src/commands/remove.mjs';

function snapshot(path) {
  let entry;
  try { entry = lstatSync(path); } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  if (entry.isSymbolicLink()) return { link: readlinkSync(path) };
  const mode = entry.mode & 0o777;
  if (entry.isFile()) return { mode, bytes: readFileSync(path).toString('hex') };
  return { mode, entries: Object.fromEntries(readdirSync(path).sort().map(name => [name, snapshot(join(path, name))])) };
}

function write(path, data, mode = 0o600) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, data, { mode });
}

beforeEach(() => {
  for (const name of readdirSync(HOME)) rmSync(join(HOME, name), { recursive: true, force: true });
});

describe('profile deletion boundaries', () => {
  it('rejects traversal, reserved names, and unregistered directories before confirmation', async () => {
    createProfile('work');
    setActiveProfile('work');
    write(join(HOME, 'unrelated', 'keep.txt'), 'outside profile root');
    write(join(PROFILES_DIR, 'orphan', 'keep.txt'), 'unregistered profile data');
    const before = snapshot(HOME);
    for (const name of ['../unrelated', '..', '.', '_shared', 'default', 'orphan']) {
      assert.throws(() => removeProfile(name));
      await assert.rejects(remove(name));
      assert.deepEqual(snapshot(HOME), before, name);
    }
  });

  it('rejects a registered profile root that is a symbolic link', () => {
    createProfile('work');
    rmSync(profileDir('work'), { recursive: true });
    const outside = join(HOME, 'outside');
    write(join(outside, 'keep.txt'), 'keep the target');
    symlinkSync(outside, profileDir('work'), IS_WINDOWS ? 'junction' : 'dir');
    const before = snapshot(HOME);
    assert.throws(() => removeProfile('work'), /symbolic link/);
    assert.throws(() => renameProfile('work', 'renamed'), /symbolic link/);
    assert.deepEqual(snapshot(HOME), before);
  });

  it('rejects missing or non-directory registered profiles without changing metadata', () => {
    createProfile('work');
    rmSync(profileDir('work'), { recursive: true });
    const meta = readFileSync(META_FILE);
    assert.throws(() => assertRegisteredProfile('work'), /missing/);
    writeFileSync(profileDir('work'), 'unexpected file');
    assert.throws(() => removeProfile('work'), /directory/);
    assert.deepEqual(readFileSync(META_FILE), meta);
    assert.equal(readFileSync(profileDir('work'), 'utf8'), 'unexpected file');
  });

  it('removes a registered profile while retaining shared files and updating the active profile', () => {
    createProfile('work');
    createProfile('personal');
    setActiveProfile('work');
    write(join(SHARED_DIR, 'settings.json'), '{"keep":true}');
    const shared = snapshot(SHARED_DIR);
    removeProfile('work');
    assert.equal(existsSync(profileDir('work')), false);
    assert.deepEqual(readMeta().profiles, ['personal']);
    assert.equal(readMeta().activeProfile, 'personal');
    assert.deepEqual(snapshot(SHARED_DIR), shared);
  });
});

describe('profile rename', () => {
  it('preserves account files, modes, shared links, order, and the active profile', () => {
    createProfile('work');
    createProfile('personal');
    setActiveProfile('work');
    write(join(profileDir('work'), '.credentials.json'), '{"fixture":"account"}');
    write(join(profileDir('work'), 'projects', 'example', 'session.jsonl'), '{"fixture":"session"}\n');
    write(join(profileDir('work'), 'custom.txt'), Buffer.from([0, 1, 2, 255]));
    write(join(profileDir('work'), 'pre-launch.sh'), '#!/bin/sh\nexit 0\n', 0o750);
    if (!IS_WINDOWS) chmodSync(profileDir('work'), 0o750);
    const profile = snapshot(profileDir('work'));
    const shared = snapshot(SHARED_DIR);
    assert.equal(renameProfile('work', 'work2'), true);
    assert.equal(existsSync(profileDir('work')), false);
    assert.deepEqual(snapshot(profileDir('work2')), profile);
    assert.deepEqual(snapshot(SHARED_DIR), shared);
    assert.deepEqual(readMeta().profiles, ['work2', 'personal']);
    assert.equal(readMeta().activeProfile, 'work2');
    assert.equal(realpathSync(join(profileDir('work2'), 'commands')), realpathSync(join(SHARED_DIR, 'commands')));
  });

  it('keeps the current account active when renaming a different profile', () => {
    createProfile('work', false);
    createProfile('personal', false);
    setActiveProfile('work');
    renameProfile('personal', 'personal2');
    assert.deepEqual(readMeta().profiles, ['work', 'personal2']);
    assert.equal(readMeta().activeProfile, 'work');
  });

  it('treats an unchanged name as a no-op', () => {
    createProfile('work');
    const before = snapshot(PROFILES_DIR);
    assert.equal(renameProfile('work', 'work'), false);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('rejects invalid names, unregistered sources, and existing destinations without overwriting', () => {
    createProfile('work');
    createProfile('personal');
    write(join(PROFILES_DIR, 'orphan', 'keep.txt'), 'unregistered destination');
    const before = snapshot(PROFILES_DIR);
    for (const [oldName, newName] of [
      ['../outside', 'new'], ['_shared', 'new'], ['orphan', 'new'],
      ['work', '../outside'], ['work', '_shared'], ['work', 'personal'], ['work', 'orphan'],
    ]) {
      assert.throws(() => renameProfile(oldName, newName));
      assert.deepEqual(snapshot(PROFILES_DIR), before, `${oldName} -> ${newName}`);
    }
  });

  it('rejects a dangling destination symlink', { skip: IS_WINDOWS }, () => {
    createProfile('work');
    symlinkSync(join(HOME, 'missing-target'), profileDir('work2'));
    const before = snapshot(PROFILES_DIR);
    assert.throws(() => renameProfile('work', 'work2'), /already exists/);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('restores the original directory and metadata when metadata publication fails', () => {
    createProfile('work');
    setActiveProfile('work');
    write(join(profileDir('work'), '.credentials.json'), '{"keep":"account"}');
    const before = snapshot(PROFILES_DIR);
    const rename = fs.renameSync;
    mock.method(fs, 'renameSync', (from, to) => {
      if (to === META_FILE) throw new Error('fixture metadata publication denied');
      return rename(from, to);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => renameProfile('work', 'work2'), /metadata publication denied/);
    } finally {
      mock.restoreAll();
      syncBuiltinESMExports();
    }
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('reports the retained data path if the filesystem also blocks rollback', () => {
    createProfile('work');
    write(join(profileDir('work'), '.credentials.json'), '{"keep":"account"}');
    const originalMeta = readFileSync(META_FILE);
    const rename = fs.renameSync;
    mock.method(fs, 'renameSync', (from, to) => {
      if (to === META_FILE || to === profileDir('work')) throw new Error('fixture filesystem denied');
      return rename(from, to);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => renameProfile('work', 'work2'), err => {
        assert.match(err.message, /rollback failed/);
        assert.ok(err.message.includes(profileDir('work2')));
        return true;
      });
    } finally {
      mock.restoreAll();
      syncBuiltinESMExports();
    }
    assert.deepEqual(readFileSync(META_FILE), originalMeta);
    assert.equal(readFileSync(join(profileDir('work2'), '.credentials.json'), 'utf8'), '{"keep":"account"}');
  });
});
