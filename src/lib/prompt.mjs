import { createInterface, emitKeypressEvents } from 'node:readline';
import { PassThrough } from 'node:stream';
import { color, cursorControl, sym } from './ui.mjs';

function rl() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

function readKeys(onKey) {
  const input = process.stdin;
  const wasRaw = Boolean(input.isRaw);
  const wasFlowing = input.readableFlowing === true;
  // Keep readline's decoder off stdin so it cannot consume later text prompts.
  const keys = new PassThrough();
  emitKeypressEvents(keys);
  keys.on('keypress', onKey);
  const onData = chunk => keys.write(chunk);
  input.on('data', onData);
  if (!wasRaw) input.setRawMode(true);
  input.resume();

  return () => {
    input.removeListener('data', onData);
    keys.removeListener('keypress', onKey);
    keys.destroy();
    if (!wasRaw) input.setRawMode(false);
    if (wasFlowing) input.resume();
    else input.pause();
  };
}

export async function text(message, defaultVal) {
  const suffix = defaultVal !== undefined ? color.dim(` (${defaultVal})`) : '';
  const r = rl();
  const cursor = cursorControl();
  return new Promise((resolve) => {
    r.question(`${color.cyan('?')} ${message}${suffix}\n  ${color.dim(sym.arrow)} `, (answer) => {
      r.close();
      const result = answer.trim() || defaultVal || '';
      // Replace 2-line prompt with single completed line: ✓ message … answer
      if (cursor.enabled) {
        process.stdout.write(`${cursor.up(2)}\r${cursor.clearLine}${color.green(sym.check)} ${message} ${color.dim(sym.dots)} ${color.cyan(result)}\n${cursor.clearDown}`);
      }
      resolve(result);
    });
  });
}

export async function number(message, defaultVal) {
  const val = await text(message, defaultVal?.toString());
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1) return defaultVal ?? 1;
  return n;
}

export async function confirm(message, defaultVal = true) {
  if (!process.stdin.isTTY) {
    return defaultVal;
  }

  return new Promise((resolve) => {
    let selected = defaultVal;
    const cursor = cursorControl();

    const render = (final = false) => {
      const prefix = final ? color.green(sym.check) : color.cyan('?');
      const sep = final ? color.dim(` ${sym.dots} `) : color.dim(` ${sym.arrow} `);
      const no  = !selected ? color.cyan('No')  : color.dim('No');
      const yes =  selected ? color.cyan('Yes') : color.dim('Yes');
      process.stdout.write(`\r${cursor.clearLine}${prefix} ${message}${sep}${no} ${color.dim('/')} ${yes}`);
    };

    render();

    const stop = readKeys((character, key) => {
      if (key.name === 'left' || key.name === 'right' || key.name === 'tab') {
        selected = !selected;
        render();
      } else if (character === 'y' || character === 'Y') {
        selected = true;
        render();
      } else if (character === 'n' || character === 'N') {
        selected = false;
        render();
      } else if (key.name === 'return' || key.name === 'enter') {
        stop();
        render(true);
        process.stdout.write('\n');
        resolve(selected);
      } else if (key.ctrl && key.name === 'c') {
        stop();
        process.stdout.write('\n');
        process.exit(0);
      }
    });
  });
}

export async function select(message, choices, { output = process.stdout, initial = 0 } = {}) {
  return new Promise((resolve) => {
    let selected = Math.max(0, Math.min(initial, choices.length - 1));
    let rendered = false;
    const cursor = cursorControl(output);

    const render = () => {
      if (rendered) {
        output.write(cursor.up(choices.length));
      }
      choices.forEach((choice, i) => {
        const label = typeof choice === 'string' ? choice : choice.label;
        const prefix = i === selected ? color.cyan(`  ${sym.cursor} `) : '    ';
        output.write(`${cursor.clearLine}${prefix}${label}\n`);
      });
      rendered = true;
    };

    if (!process.stdin.isTTY) {
      // Non-interactive: pick first choice without rendering menu
      resolve(typeof choices[selected] === 'string' ? choices[selected] : choices[selected].value);
      return;
    }

    output.write(`${color.cyan('?')} ${message}\n`);
    render();

    const stop = readKeys((character, key) => {
      if (key.name === 'up') {
        selected = (selected - 1 + choices.length) % choices.length;
        render();
      } else if (key.name === 'down') {
        selected = (selected + 1) % choices.length;
        render();
      } else if (key.name === 'return' || key.name === 'enter') {
        stop();
        const choice = choices[selected];
        const value = typeof choice === 'string' ? choice : choice.value;
        if (cursor.enabled) {
          output.write(`${cursor.up(choices.length + 1)}\r${cursor.clearLine}${color.green(sym.check)} ${message} ${color.dim(sym.dots)} ${color.cyan(value)}\n${cursor.clearDown}`);
        }
        resolve(value);
      } else if (key.ctrl && key.name === 'c') {
        stop();
        output.write('\n');
        resolve(null);
      }
    });
  });
}
