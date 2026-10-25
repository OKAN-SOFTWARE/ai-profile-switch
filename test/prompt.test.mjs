import './helpers/home.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const choices = ['work', 'personal', 'omlx', 'work2'];
const promptURL = new URL('../src/lib/prompt.mjs', import.meta.url).href;
const shellURL = new URL('../src/commands/shell.mjs', import.meta.url).href;

// Isolate terminal detection and HOME while exercising public prompts with real
// stream chunks. No fixture invokes Claude or touches the user's profile data.
function runPicker({ keys = ['\x1b[B', '\r'], stdinTTY = true, stdoutTTY = false, outputTTY = true,
  noColor = false, term = 'xterm-256color', shell = false, initial = 0,
  raw = false, flowing = false, confirm = false, defaultOutput = false, sequence = false } = {}) {
  const env = { ...process.env, TERM: term };
  delete env.FORCE_COLOR;
  if (noColor) env.NO_COLOR = '1';
  else delete env.NO_COLOR;
  if (shell) {
    const home = mkdtempSync(join(process.env.TMPDIR, 'picker-home-'));
    const profiles = join(home, '.claude-profiles');
    for (const name of choices) mkdirSync(join(profiles, name), { recursive: true });
    writeFileSync(join(profiles, 'meta.json'), JSON.stringify({
      version: 1, activeProfile: 'work', shareSettings: true, profiles: choices,
    }));
    env.HOME = home;
    env.USERPROFILE = home;
  }
  const select = `mod.select('Select a profile:', ${JSON.stringify(choices)}, { ${defaultOutput ? '' : 'output: process.stderr,'} initial: ${initial} })`;
  const exercise = sequence ? `
    async function menu(promise, chunks) {
      await feed(chunks);
      const value = await promise;
      assert.equal(input.isRaw, ${raw});
      assert.equal(input.readableFlowing, ${flowing});
      assert.equal(input.listenerCount('keypress'), 1);
      assert.ok(input.listeners('data').includes(existingData));
      return value;
    }
    assert.equal(await menu(${select}, ['\\x1b[B\\r']), 'personal');
    assert.deepEqual(input.listeners('data'), listeners);
    assert.equal(await menu(${select}, ['\\x1b[A\\r']), 'work2');
    assert.deepEqual(input.listeners('data'), listeners);
    const name = mod.text('Profile name');
    await feed(['second-account\\r']);
    assert.equal(await name, 'second-account');
    const afterText = input.listeners('data');
    assert.equal(await menu(${select}, ['\\x1b[B\\x1b[B\\r']), 'omlx');
    assert.deepEqual(input.listeners('data'), afterText);
    assert.equal(await menu(mod.confirm('Continue?', false), ['y\\r']), true);
    assert.deepEqual(input.listeners('data'), afterText);
    const count = mod.number('Count', 1);
    await feed(['3\\r']);
    assert.equal(await count, 3);
    assert.ok(input.listeners('data').includes(existingData));
    process.stdout.write('sequence-complete\\n');
  ` : `
    const result = ${shell ? "mod.shell(['pick', '--print'])" : confirm ? "mod.confirm('Continue?', false)" : select};
    await feed(${JSON.stringify(keys)});
    const value = await result;
    assert.deepEqual(input.listeners('data'), listeners, 'prompt must remove only its own data listener');
    assert.deepEqual(input.listeners('keypress'), keyListeners, 'prompt must not leave a keypress listener on stdin');
    assert.equal(input.isRaw, ${raw}, 'original raw mode must be restored');
    assert.equal(input.readableFlowing, ${flowing}, 'original input flow must be restored');
    assert.equal(input.readableEncoding, encoding, 'prompt must preserve input encoding');
    assert.deepEqual(rawModes, ${stdinTTY && !raw ? '[true, false]' : '[]'});
    ${shell ? '' : "process.stdout.write(JSON.stringify({ value }) + '\\n');"}
  `;
  const script = `
    import assert from 'node:assert/strict';
    import { PassThrough } from 'node:stream';
    const input = new PassThrough();
    const rawModes = [];
    input.isTTY = ${stdinTTY};
    input.isRaw = ${raw};
    input.setRawMode = value => { rawModes.push(value); input.isRaw = value; };
    const existingData = () => {};
    input.on('data', existingData);
    input.on('keypress', () => {});
    input.${flowing ? 'resume' : 'pause'}();
    Object.defineProperty(process, 'stdin', { value: input });
    Object.defineProperty(process.stdout, 'isTTY', { value: ${stdoutTTY} });
    Object.defineProperty(process.stderr, 'isTTY', { value: ${outputTTY} });
    const listeners = input.listeners('data');
    const keyListeners = input.listeners('keypress');
    const encoding = input.readableEncoding;
    async function feed(chunks) {
      for (const chunk of chunks) {
        input.write(chunk);
        await new Promise(setImmediate);
      }
    }
    const mod = await import(${JSON.stringify(shell ? shellURL : promptURL)});
    ${exercise}
    input.destroy();
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function assertRedraw(output) {
  assert.ok(output.includes('\x1b[4A'), 'arrow navigation must return to the four existing choices');
  assert.ok(output.includes('\x1b[2K'), 'redraw must erase previous choice lines');
  assert.ok(output.includes('\x1b[5A'), 'Enter must return to the prompt heading');
  assert.ok(output.includes('\x1b[0J'), 'Enter must erase remaining menu rows');
}

describe('profile picker terminal output', () => {
  it('redraws terminal stderr when stdout is captured', () => {
    const result = runPicker();
    assert.deepEqual(JSON.parse(result.stdout), { value: 'personal' });
    assertRedraw(result.stderr);
  });

  it('keeps cursor control enabled with NO_COLOR', () => {
    const result = runPicker({ stdoutTTY: true, noColor: true });
    assertRedraw(result.stderr);
    assert.doesNotMatch(result.stderr, /\x1b\[[0-9;]*m/, 'NO_COLOR must suppress color sequences');
  });

  it('redraws the default stdout output with NO_COLOR', () => {
    const result = runPicker({ stdoutTTY: true, noColor: true, defaultOutput: true });
    assertRedraw(result.stdout);
    assert.doesNotMatch(result.stdout, /\x1b\[[0-9;]*m/);
    assert.ok(result.stdout.endsWith('{"value":"personal"}\n'));
    assert.equal(result.stderr, '');
  });

  it('keeps shell pick --print stdout limited to the selected profile', () => {
    const result = runPicker({ shell: true });
    assert.equal(result.stdout, 'personal\n');
    assertRedraw(result.stderr);
  });

  it('does not emit terminal commands for TERM=dumb', () => {
    const result = runPicker({ term: 'dumb' });
    assert.deepEqual(JSON.parse(result.stdout), { value: 'personal' });
    assert.doesNotMatch(result.stderr, /\x1b\[/);
  });

  it('does not emit terminal commands when the menu output is piped', () => {
    const result = runPicker({ outputTTY: false });
    assert.deepEqual(JSON.parse(result.stdout), { value: 'personal' });
    assert.doesNotMatch(result.stderr, /\x1b\[/);
  });

  it('selects the initial choice without rendering for noninteractive input', () => {
    const result = runPicker({ stdinTTY: false, initial: 2, keys: [] });
    assert.deepEqual(JSON.parse(result.stdout), { value: 'omlx' });
    assert.equal(result.stderr, '');
  });

  it('returns null on Ctrl-C and restores raw mode and listeners', () => {
    const result = runPicker({ keys: ['\x1b[B', '\x03'] });
    assert.deepEqual(JSON.parse(result.stdout), { value: null });
  });
});

describe('prompt keyboard chunks and cleanup', () => {
  it('handles multiple arrows and Enter in one input chunk', () => {
    const result = runPicker({ keys: ['\x1b[B\x1b[B\r'] });
    assert.deepEqual(JSON.parse(result.stdout), { value: 'omlx' });
  });

  it('handles arrow escape sequences split between input chunks', () => {
    const result = runPicker({ keys: ['\x1b', '[', 'B', '\x1b[', 'B', '\r'] });
    assert.deepEqual(JSON.parse(result.stdout), { value: 'omlx' });
  });

  it('handles y and Enter in one confirmation chunk', () => {
    const result = runPicker({ confirm: true, keys: ['y\r'] });
    assert.ok(result.stdout.endsWith('{"value":true}\n'));
  });

  it('preserves an existing raw and flowing input mode', () => {
    const result = runPicker({ raw: true, flowing: true, keys: ['\x1b[B\r'] });
    assert.deepEqual(JSON.parse(result.stdout), { value: 'personal' });
  });

  it('supports repeated menus, text, confirmation and number prompts', () => {
    const result = runPicker({ sequence: true, stdoutTTY: true, noColor: true });
    assert.ok(result.stdout.endsWith('sequence-complete\n'));
  });
});
