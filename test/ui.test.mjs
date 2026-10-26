import './helpers/home.mjs';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('color helpers', async () => {
  const { color, hasColor } = await import('../src/lib/ui.mjs');

  it('hasColor is a boolean', () => {
    assert.equal(typeof hasColor, 'boolean');
  });

  it('color functions return the input text (may include ANSI)', () => {
    for (const fn of Object.values(color)) {
      const result = fn('hello');
      assert.ok(result.includes('hello'));
    }
  });

  it('all color keys are present', () => {
    const expected = ['bold', 'dim', 'green', 'yellow', 'blue', 'cyan', 'red'];
    for (const key of expected) {
      assert.equal(typeof color[key], 'function', `color.${key} should be a function`);
    }
  });

  it('nested color calls do not corrupt output', () => {
    const result = color.bold(color.cyan('nested'));
    assert.ok(result.includes('nested'));
  });

  it('handles empty string', () => {
    assert.equal(typeof color.bold(''), 'string');
  });

  it('handles special characters in input', () => {
    const result = color.red('hello "world" <>&');
    assert.ok(result.includes('hello "world" <>&'));
  });
});

describe('rail layout and meter', async () => {
  const { meter, displayWidth, sym, stripAnsi } = await import('../src/lib/ui.mjs');

  it('always prints the percentage next to the bar', () => {
    for (const value of [0, 28, 50, 80, 100]) {
      const text = stripAnsi(meter(value));
      assert.ok(text.endsWith(`${String(value).padStart(3)}%`), text);
      assert.equal([...text.split(' ')[0]].length, 10);
    }
  });

  it('fills the bar in proportion to the value', () => {
    const text = stripAnsi(meter(30));
    assert.equal(text.split(sym.barOn).length - 1, 3);
  });

  it('counts Hangul as two columns and ignores color codes', () => {
    assert.equal(displayWidth('work'), 4);
    assert.equal(displayWidth('계정'), 4);
    assert.equal(displayWidth('\x1b[1m계정\x1b[0m a'), 6);
  });
});

function captureOutput(stream, fn) {
  const write = mock.method(stream, 'write', () => true);
  try {
    fn();
    return write.mock.calls.map(call => call.arguments[0]).join('');
  } finally {
    write.mock.restore();
  }
}

describe('output functions', async () => {
  const { success, warn, error, info } = await import('../src/lib/ui.mjs');

  it('success writes its message to stdout', () => {
    const output = captureOutput(process.stdout, () => success('test message'));
    assert.ok(output.endsWith(' test message\n'));
  });

  it('warn writes its message to stdout', () => {
    const output = captureOutput(process.stdout, () => warn('test warning'));
    assert.ok(output.endsWith(' test warning\n'));
  });

  it('error writes its message to stderr', () => {
    const output = captureOutput(process.stderr, () => error('test error'));
    assert.ok(output.endsWith(' test error\n'));
  });

  it('info writes its message to stdout', () => {
    const output = captureOutput(process.stdout, () => info('test info'));
    assert.ok(output.endsWith(' test info\n'));
  });

  it('handles empty messages on both streams', () => {
    for (const [fn, stream] of [[success, process.stdout], [warn, process.stdout], [error, process.stderr], [info, process.stdout]]) {
      assert.ok(captureOutput(stream, () => fn('')).endsWith(' \n'));
    }
  });

  it('error prints next-step hints under the message', () => {
    const output = captureOutput(process.stderr, () => error('missing', [
      { label: 'Profiles:', text: 'work, personal' },
      { label: 'To create it:', command: 'cpf add side' },
    ]));
    assert.match(output, /missing\n {4}Profiles: work, personal\n {4}To create it: cpf add side\n$/);
  });

  it('preserves special characters in its output', () => {
    const message = 'path: C:\\Users\\test & "quotes"';
    assert.ok(captureOutput(process.stdout, () => success(message)).endsWith(message + '\n'));
  });
});
