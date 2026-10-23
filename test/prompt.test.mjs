import './helpers/home.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const choices = ['work', 'personal', 'omlx', 'work2'];
const promptURL = new URL('../src/lib/prompt.mjs', import.meta.url).href;
const shellURL = new URL('../src/commands/shell.mjs', import.meta.url).href;

// A subprocess isolates import-time terminal detection. Only the stream capability
// flags and keyboard source are synthetic; the public prompt and shell code run as is.
function runPicker({ keys = ['\x1b[B', '\r'], stdinTTY = true, stdoutTTY = false, outputTTY = true,
  noColor = false, term = 'xterm-256color', shell = false, initial = 0 } = {}) {
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
  const script = `
    import assert from 'node:assert/strict';
    import { EventEmitter } from 'node:events';
    const input = new EventEmitter();
    const rawModes = [];
    let paused = true;
    input.isTTY = ${stdinTTY};
    input.setRawMode = value => { rawModes.push(value); input.isRaw = value; };
    input.resume = () => { paused = false; };
    input.pause = () => { paused = true; };
    input.setEncoding = () => {};
    input.on('data', () => {});
    Object.defineProperty(process, 'stdin', { value: input });
    Object.defineProperty(process.stdout, 'isTTY', { value: ${stdoutTTY} });
    Object.defineProperty(process.stderr, 'isTTY', { value: ${outputTTY} });
    const listeners = input.listenerCount('data');
    const mod = await import(${JSON.stringify(shell ? shellURL : promptURL)});
    const result = ${shell
      ? "mod.shell(['pick', '--print'])"
      : `mod.select('Select a profile:', ${JSON.stringify(choices)}, { output: process.stderr, initial: ${initial} })`};
    for (const key of ${JSON.stringify(keys)}) input.emit('data', key);
    const value = await result;
    assert.equal(input.listenerCount('data'), listeners, 'prompt must remove only its own data listener');
    assert.equal(paused, true, 'input must be paused after selection');
    assert.deepEqual(rawModes, ${stdinTTY ? '[true, false]' : '[]'}, 'raw mode must be disabled after selection');
    ${shell ? '' : "process.stdout.write(JSON.stringify({ value }) + '\\n');"}
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
