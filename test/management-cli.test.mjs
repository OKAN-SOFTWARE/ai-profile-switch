import './helpers/home.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, lstatSync, readlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const indexURL = new URL('../src/index.mjs', import.meta.url).href;

function fixture() {
  const directory = mkdtempSync(join(process.env.TMPDIR, 'manager-'));
  const profiles = join(directory, '.claude-profiles');
  mkdirSync(join(profiles, 'work'), { recursive: true });
  writeFileSync(join(profiles, 'work', 'history.jsonl'), 'keep history\n');
  const meta = join(profiles, 'meta.json');
  writeFileSync(meta, JSON.stringify({ version: 1, activeProfile: 'work', shareSettings: true, profiles: ['work'] }));
  return { directory, profiles, meta, env: { ...process.env, HOME: directory, USERPROFILE: directory, SHELL: '/bin/zsh' } };
}

function run(args, context) {
  const result = spawnSync(process.execPath, [cli, ...args], { env: context.env, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  return result;
}

function snapshot(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return { link: readlinkSync(path) };
  if (stat.isFile()) return readFileSync(path).toString('base64');
  return Object.fromEntries(readdirSync(path).sort().map(name => [name, snapshot(join(path, name))]));
}

describe('command help and validation', () => {
  for (const args of [
    ['init', '--help'], ['add', 'new', '--help'], ['remove', 'work', '--help'],
    ['rename', 'work', 'new', '--help'], ['use', 'other', '--help'],
    ['install-shell', '--help'], ['migrate', '--help'], ['update', '--help'],
    ['manage', 'add', 'new', '--help'], ['manage', 'rename', 'work', 'new', '-h'],
  ]) {
    it(args.join(' ') + ' shows help without writing', () => {
      const context = fixture();
      const before = snapshot(context.directory);
      const result = run(args, context);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Usage:/);
      assert.deepEqual(snapshot(context.directory), before);
    });
  }

  for (const args of [
    ['init', 'extra'], ['install-shell', '--bad'], ['list', 'extra'],
    ['add', 'new', 'extra'], ['use', 'work', '--bad-option'],
    ['remove', 'work', 'extra'], ['rename', 'work', 'new', 'extra'],
    ['manage', 'add', 'new', 'extra'], ['manage', '--list', 'extra'],
    ['manage', '--unknown'], ['constructor'],
  ]) {
    it(args.join(' ') + ' is rejected before writing', () => {
      const context = fixture();
      const before = snapshot(context.directory);
      const result = run(args, context);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.deepEqual(snapshot(context.directory), before);
    });
  }
});

describe('cpf management commands', () => {
  it('adds, renames, switches, and lists through the manager', () => {
    const context = fixture();
    assert.equal(run(['manage', 'add', 'work2'], context).status, 0);
    assert.equal(run(['manage', 'work2'], context).status, 0);
    assert.equal(run(['manage', 'rename', 'work2', 'personal'], context).status, 0);
    const meta = JSON.parse(readFileSync(context.meta));
    assert.equal(meta.activeProfile, 'personal');
    assert.deepEqual(meta.profiles, ['work', 'personal']);
    assert.ok(!existsSync(join(context.profiles, 'work2')));
    const listed = run(['manage', '--list'], context);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /Active: personal/);
  });

  it('keeps one-word command names available as existing profiles', () => {
    const context = fixture();
    for (const name of ['add', 'remove', 'rename', 'list']) {
      assert.equal(run(['add', name], context).status, 0);
      assert.equal(run(['manage', name], context).status, 0);
      assert.equal(JSON.parse(readFileSync(context.meta)).activeProfile, name);
    }
  });

  it('does not open a menu or delete anything with noninteractive stdin', () => {
    const context = fixture();
    const before = snapshot(context.directory);
    const menu = run(['manage'], context);
    assert.equal(menu.status, 0, menu.stderr);
    assert.match(menu.stdout, /Usage:/);
    const removal = run(['manage', 'remove', 'work'], context);
    assert.equal(removal.status, 0, removal.stderr);
    assert.match(removal.stdout, /Cancelled/);
    assert.deepEqual(snapshot(context.directory), before);
  });

  it('recovers from invalid input and completes add, rename, switch and confirmed deletion in one menu session', async () => {
    const context = fixture();
    const replies = [
      ['? Manage profiles', '\x1b[B\x1b[B\r'],
      ['New profile name (empty to cancel):', 'Work\n'],
      ['? Manage profiles', '\x1b[B\x1b[B\r'],
      ['New profile name (empty to cancel):', 'work\n'],
      ['? Manage profiles', '\x1b[B\x1b[B\r'],
      ['New profile name (empty to cancel):', '\n'],
      ['? Manage profiles', '\x1b[B\x1b[B\r'],
      ['New profile name (empty to cancel):', 'work2\n'],
      ['? Manage profiles', '\x1b[B\x1b[B\x1b[B\r'],
      ['? Choose a profile:', '\x1b[B\r'],
      ['New name (empty to cancel):', 'personal\n'],
      ['Rename "work2" to "personal"?', 'y\r'],
      ['? Manage profiles', '\r'],
      ['? Choose a profile:', '\x1b[B\r'],
      ['? Manage profiles', '\x1b[B\x1b[B\x1b[B\x1b[B\r'],
      ['? Choose a profile:', '\r'],
      ['Delete profile "personal"?', '\r'],
      ['? Manage profiles', '\x1b[B\x1b[B\x1b[B\x1b[B\r'],
      ['? Choose a profile:', '\r'],
      ['Delete profile "personal"?', 'y\r'],
      ['? Manage profiles', '\x1b[A\r'],
    ];
    const script = "Object.defineProperty(process.stdin,'isTTY',{value:true}); process.stdin.setRawMode=()=>{}; const {run}=await import(" + JSON.stringify(indexURL) + "); await run(['manage']); console.log('MANAGEMENT_DONE');";
    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env: context.env });
      let stdout = '', stderr = '', offset = 0, step = 0;
      const timer = setTimeout(() => { child.kill(); reject(new Error('Menu timed out at ' + step + ': ' + stdout + stderr)); }, 10000);
      child.stdout.on('data', chunk => {
        stdout += chunk;
        if (stdout.includes('MANAGEMENT_DONE')) child.stdin.end();
        if (step < replies.length && stdout.slice(offset).includes(replies[step][0])) {
          const reply = replies[step++][1];
          offset = stdout.length;
          child.stdin.write(reply);
        }
      });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', err => { clearTimeout(timer); reject(err); });
      child.on('close', status => { clearTimeout(timer); resolve({ status, stdout, stderr, step }); });
    });
    assert.equal(output.status, 0, output.stdout + output.stderr);
    assert.equal(output.step, replies.length, output.stdout);
    assert.match(output.stdout, /MANAGEMENT_DONE/);
    assert.match(output.stderr, /Only lowercase letters/);
    assert.match(output.stderr, /Profile "work" already exists/);
    assert.match(output.stdout, /Cancelled/);
    assert.match(output.stdout, /Renamed profile: work2/);
    assert.match(output.stdout, /Removed profile: personal/);
    assert.deepEqual(JSON.parse(readFileSync(context.meta)).profiles, ['work']);
    assert.equal(JSON.parse(readFileSync(context.meta)).activeProfile, 'work');
    assert.equal(readFileSync(join(context.profiles, 'work', 'history.jsonl'), 'utf8'), 'keep history\n');
  });
});
