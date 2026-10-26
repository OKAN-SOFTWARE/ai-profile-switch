import './helpers/home.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { META_FILE, PROFILES_DIR } from '../src/lib/constants.mjs';
import { readMeta } from '../src/lib/config.mjs';
import { detectLanguage, relativeTime, setLanguage, systemLanguage, t } from '../src/lib/i18n.mjs';
import en from '../src/locales/en.mjs';
import ko from '../src/locales/ko.mjs';

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

describe('messages', () => {
  it('has the same keys in English and Korean', () => {
    assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
  });

  it('uses the same placeholders in both languages', () => {
    for (const key of Object.keys(en)) assert.deepEqual(placeholders(ko[key]), placeholders(en[key]), key);
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    setLanguage('en');
    assert.equal(t('use.switched', { profile: 'work' }), 'Switched to profile: work');
    assert.equal(t('use.switched'), 'Switched to profile: {profile}');
    setLanguage('ko');
    assert.equal(t('use.switched', { profile: 'work' }), 'work 계정으로 바꿨어요');
    assert.throws(() => t('no.such.key'), /Missing message/);
  });

  it('formats relative times in the screen language', () => {
    const now = Date.UTC(2026, 0, 10);
    setLanguage('en');
    assert.equal(relativeTime(now - 12 * 60000, now), '12 minutes ago');
    assert.equal(relativeTime(now - 86400000, now), 'yesterday');
    assert.equal(relativeTime(now - 10000, now), 'just now');
    setLanguage('ko');
    assert.equal(relativeTime(now - 12 * 60000, now), '12분 전');
    assert.equal(relativeTime(now - 3 * 86400000, now), '3일 전');
    setLanguage('en');
  });
});

describe('language detection', () => {
  it('prefers the saved choice, then the environment variable, then the terminal, then the system', () => {
    assert.equal(detectLanguage({ saved: 'ko', env: { AI_PROFILE_SWITCH_LANG: 'en', LANG: 'en_US.UTF-8' } }), 'ko');
    assert.equal(detectLanguage({ saved: null, env: { AI_PROFILE_SWITCH_LANG: 'ko', LANG: 'en_US.UTF-8' } }), 'ko');
    assert.equal(detectLanguage({ saved: null, env: { LANG: 'ko_KR.UTF-8' }, intlLocale: 'en-US' }), 'ko');
    assert.equal(detectLanguage({ saved: null, env: {}, intlLocale: 'ko-KR' }), 'ko');
    assert.equal(detectLanguage({ saved: null, env: {}, intlLocale: 'fr-FR' }), 'en');
  });

  it('reads LC_ALL before LC_MESSAGES before LANG', () => {
    assert.equal(systemLanguage({ LC_ALL: 'ko_KR.UTF-8', LANG: 'en_US.UTF-8' }), 'ko');
    assert.equal(systemLanguage({ LC_MESSAGES: 'en_US.UTF-8', LANG: 'ko_KR.UTF-8' }), 'en');
    assert.equal(systemLanguage({ LANG: 'ko_KR.UTF-8' }), 'ko');
  });

  it('treats a set C locale as English instead of asking the system', () => {
    assert.equal(systemLanguage({ LANG: 'C' }, 'ko-KR'), 'en');
    assert.equal(systemLanguage({}, 'ko-KR'), 'ko');
  });

  it('ignores an unknown environment value', () => {
    assert.equal(detectLanguage({ saved: null, env: { AI_PROFILE_SWITCH_LANG: 'xx', LANG: 'ko_KR.UTF-8' } }), 'ko');
  });
});

describe('cpf language', () => {
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

  it('saves the choice, uses it over the environment, and clears it with auto', () => {
    mkdirSync(join(PROFILES_DIR, 'work'), { recursive: true });
    writeFileSync(META_FILE, JSON.stringify({ version: 1, activeProfile: 'work', shareSettings: true, profiles: ['work'] }));
    const saved = run('language', 'ko');
    assert.equal(saved.status, 0, saved.stderr);
    assert.match(saved.stdout, /화면 언어를 바꿨어요: 한국어/);
    assert.equal(readMeta().language, 'ko');
    assert.match(run('--help').stdout, /한 컴퓨터에서 여러 Claude Code 계정/);
    const auto = run('language', 'auto');
    assert.equal(auto.status, 0, auto.stderr);
    assert.equal(Object.hasOwn(JSON.parse(readFileSync(META_FILE, 'utf8')), 'language'), false);
    assert.match(run('--help').stdout, /Use several Claude Code accounts/);
  });

  it('rejects an unknown language without changing metadata', () => {
    const before = readFileSync(META_FILE, 'utf8');
    const result = run('language', 'fr');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: cpf language/);
    assert.equal(readFileSync(META_FILE, 'utf8'), before);
  });

  it('prints the current language without a terminal', () => {
    const result = run('language');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Language: English \(automatic\)/);
  });

  it('refuses metadata with an unknown saved language', () => {
    writeFileSync(META_FILE, JSON.stringify({ version: 1, activeProfile: null, shareSettings: true, profiles: [], language: 'fr' }));
    assert.throws(() => readMeta(), /Invalid profile metadata/);
    writeFileSync(META_FILE, JSON.stringify({ version: 1, activeProfile: null, shareSettings: true, profiles: [] }));
  });
});

describe('plain terminals', () => {
  it('falls back to ASCII symbols on a legacy Windows console', () => {
    const url = new URL('../src/lib/ui.mjs', import.meta.url).href;
    const script = `Object.defineProperty(process, 'platform', { value: 'win32' });
      const { sym, meter, stripAnsi } = await import(${JSON.stringify(url)});
      process.stdout.write(JSON.stringify([sym.railTop, sym.rail, sym.railEnd, sym.step, sym.stepDone, stripAnsi(meter(50, 4))]));`;
    const env = { ...process.env };
    delete env.WT_SESSION;
    delete env.TERM_PROGRAM;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ['+', '|', '`', '*', 'o', '##--  50%']);
  });
});
