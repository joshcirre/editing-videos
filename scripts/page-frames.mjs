#!/usr/bin/env node
// Draws a web page as video frames: one PNG per frame, transparent where the page is.
// Needs Node 22 or later and Chrome (or Chromium, or Edge). Nothing to install.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HELP = `Draws a web page as video frames: one PNG per frame, transparent where the page is.

  node page-frames.mjs <page.html or http(s) URL> <out-dir> --duration <seconds> [options]

  --duration <s>   how long the graphic runs (required)
  --fps <n>        frames a second (30): use the video's
  --size <WxH>     frame size (1920x1080): use the video's
  --at <s,s,...>   only the frames at these times, as stills to check before a full render
  --from <s>       only the frames from this time on (to draw one stretch again)
  --to <s>         only the frames before this time
  --scale <n>      pixels per CSS pixel (1): 2 draws a 1920x1080 page as 3840x2160 frames
  --opaque         keep the page's background instead of a transparent one
  --jpeg <1-100>   JPEG frames at this quality instead of PNG (opaque; for a filmed screen)
  --steps <file>   what happens on the page and when, as JSON: [{"at": 1.5, "click": "#run"}, ...]
                   Each step has "at" (seconds) and one of:
                     "scroll": 640           the page's scroll position; between two scroll
                                             steps it glides from one to the other
                     "move": "#row" or [x, y]   the pointer goes there (hover states are real)
                     "click": "#run" or [x, y]  a real click
                     "run": "document.body.classList.add('dim')"   any JavaScript
  --no-sandbox     pass --no-sandbox to Chrome (some containers need it)

The page starts at time 0 when it loads. Its clock is run by this script (scripts/page-clock.js),
so CSS animations and transitions, element.animate(), timers, requestAnimationFrame, Date and
Math.random all land on the exact frame. A page that defines window.renderAt(seconds) is also
called with each frame's time. Values go to the page in its query: 'card.html?name=Dana%20Lee'.

Frames are 00000.png, 00001.png, ... by frame number (with --at, --from and --to too, so a
still is the frame the full render makes). Chrome is found on its own; set CHROME=/path/to/chrome to choose one.`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}
const [page, out, ...rest] = args;
const option = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i < 0 ? fallback : rest[i + 1];
};
const fps = Number(option('fps', 30));
const duration = Number(option('duration'));
const [width, height] = String(option('size', '1920x1080')).split('x').map(Number);
if (!page || !out || !(duration > 0) || !(fps > 0) || !(width > 0) || !(height > 0)) {
  fail(`Usage: node page-frames.mjs <page.html or URL> <out-dir> --duration <seconds> [--fps 30] [--size 1920x1080] [--at 0.5,2]\nRun with --help for the rest.`);
}
const remote = /^https?:\/\//.test(page);
const [file, query] = page.split('?');
if (!remote && !existsSync(file)) fail(`No page at ${file}.`);
const scale = Number(option('scale', 1));
const jpeg = option('jpeg') === undefined ? null : Number(option('jpeg'));
if (!(scale > 0)) fail('--scale takes a number above 0, such as 2.');
if (jpeg !== null && !(jpeg >= 1 && jpeg <= 100)) fail('--jpeg takes a quality from 1 to 100, such as 92.');
const stepsFile = option('steps');
let steps = [];
if (stepsFile) {
  if (!existsSync(stepsFile)) fail(`No steps file at ${stepsFile}.`);
  try {
    steps = JSON.parse(readFileSync(stepsFile, 'utf8'));
  } catch (error) {
    fail(`${stepsFile} isn't JSON: ${error.message}`);
  }
  const kinds = ['scroll', 'move', 'click', 'run'];
  if (!Array.isArray(steps) || steps.some((step) => !(step?.at >= 0) || kinds.filter((kind) => kind in step).length !== 1)) {
    fail(`${stepsFile} must be a list of steps, each with "at" (seconds) and one of ${kinds.map((kind) => `"${kind}"`).join(', ')}.`);
  }
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const home = homedir();
  const newest = (dir, rest) => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).sort().reverse().flatMap((entry) => rest.map((tail) => join(dir, entry, tail)));
  };
  const places = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
  }[process.platform] ?? [];
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    const found = spawnSync('which', [name], { encoding: 'utf8' });
    if (found.status === 0) places.push(found.stdout.trim());
  }
  // Browsers that Playwright, Puppeteer or agent-browser already downloaded.
  places.push(
    ...newest(join(home, '.cache/ms-playwright'), ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']),
    ...newest(join(home, 'Library/Caches/ms-playwright'), ['chrome-mac/Chromium.app/Contents/MacOS/Chromium']),
    ...newest(join(home, '.cache/puppeteer/chrome'), ['chrome-linux64/chrome', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']),
    ...newest(join(home, '.agent-browser/browsers'), ['chrome']),
  );
  return places.find((place) => existsSync(place));
}

const chrome = findChrome();
if (!chrome || !existsSync(chrome)) {
  fail(`Chrome wasn't found${process.env.CHROME ? ` at CHROME=${process.env.CHROME}` : ''}. Install Chrome or Chromium, or set CHROME to the path of one that is installed.`);
}

const profile = mkdtempSync(join(tmpdir(), 'page-frames-'));
const browser = spawn(chrome, [
  '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--force-color-profile=srgb',
  '--disable-lcd-text',
  '--font-render-hinting=none',
  '--enable-unsafe-swiftshader', // WebGL without a graphics card
  // Draw on the page's own thread, a whole frame at a time, so a capture is the frame asked for.
  '--disable-threaded-animation',
  '--disable-threaded-scrolling',
  '--disable-checker-imaging',
  '--disable-image-animation-resync',
  '--run-all-compositor-stages-before-draw',
  '--disable-new-content-rendering-timeout',
  ...(rest.includes('--no-sandbox') ? ['--no-sandbox'] : []),
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const close = () => {
  browser.kill();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
};
process.on('exit', close);

const endpoint = await new Promise((found) => {
  let log = '';
  const stopped = () => fail(`Chrome (${chrome}) didn't start:\n${log.trim().split('\n').slice(-5).join('\n')}\nIn a container, try again with --no-sandbox.`);
  browser.once('exit', stopped);
  browser.stderr.on('data', (data) => {
    log += data;
    const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
    if (!match) return;
    browser.off('exit', stopped);
    found(match[1]);
  });
});
browser.once('exit', () => fail(`Chrome stopped before the frames were done. Run it again; if it stops at the same frame, the page is what crashes it.`));

const socket = new WebSocket(endpoint);
await new Promise((opened) => (socket.onopen = opened));
let lastId = 0;
const waiting = new Map();
const pageErrors = [];
const asked = new Map(); // request -> its URL, to name a file that didn't load
socket.onmessage = (message) => {
  const data = JSON.parse(message.data);
  if (data.id) {
    const { done, failed } = waiting.get(data.id);
    waiting.delete(data.id);
    if (data.error) failed(new Error(data.error.message));
    else done(data.result);
  } else if (data.method === 'Runtime.exceptionThrown') {
    pageErrors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
  } else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
    pageErrors.push(data.params.args.map((arg) => arg.description ?? arg.value).join(' '));
  } else if (data.method === 'Network.requestWillBeSent') {
    asked.set(data.params.requestId, data.params.request.url);
  } else if (data.method === 'Network.loadingFailed' && !data.params.canceled) {
    pageErrors.push(`${asked.get(data.params.requestId) ?? 'a file the page asked for'} didn't load (${data.params.errorText})`);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((done, failed) => {
    waiting.set(++lastId, { done, failed });
    socket.send(JSON.stringify({ id: lastId, method, params, sessionId }));
  });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const cdp = (method, params) => send(method, params, sessionId);
const run = async (expression) => {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Network.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
if (!rest.includes('--opaque') && jpeg === null) await cdp('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(new URL('./page-clock.js', import.meta.url), 'utf8') });
await cdp('Page.navigate', { url: remote ? page : pathToFileURL(resolve(file)).href + (query ? `?${query}` : '') });
for (let tries = 0; tries < 400 && !(await run('!!window.__clock && document.readyState === "complete"')); tries++) {
  await new Promise((later) => setTimeout(later, 25));
}
await run('window.__clock.ready()');

const total = Math.round(duration * fps);
const at = option('at');
const wanted = at ? new Set(String(at).split(',').map((seconds) => Math.min(total - 1, Math.max(0, Math.round(Number(seconds) * fps))))) : null;
const first = Math.max(0, Math.round(Number(option('from', 0)) * fps));
const end = Math.min(total, Math.round(Number(option('to', duration)) * fps));
if (!(first < end)) fail('--from must be before --to, and both inside --duration.');
const last = wanted ? Math.max(...wanted) : end - 1;

// --steps: each step on its frame; the scroll position glides between scroll steps.
const frameOf = (step) => Math.round(step.at * fps);
const scrolls = steps.filter((step) => 'scroll' in step).sort((a, b) => a.at - b.at);
const glide = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const scrollAt = (frame) => {
  if (!scrolls.length || frame < frameOf(scrolls[0])) return null;
  let i = 0;
  while (i + 1 < scrolls.length && frameOf(scrolls[i + 1]) <= frame) i++;
  const a = scrolls[i], b = scrolls[i + 1];
  if (!b) return a.scroll;
  return a.scroll + (b.scroll - a.scroll) * glide((frame - frameOf(a)) / (frameOf(b) - frameOf(a)));
};
const point = async (target) => {
  if (Array.isArray(target)) return target;
  const found = await run(`(() => { const el = document.querySelector(${JSON.stringify(target)}); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (!found) fail(`--steps: nothing on the page matches ${target} when its step runs.`);
  return found;
};
const mouse = (type, [x, y], more = {}) => cdp('Input.dispatchMouseEvent', { type, x, y, ...more });
const act = async (frame) => {
  const y = scrollAt(frame);
  if (y !== null) await run(`window.scrollTo(0, ${y})`);
  for (const step of steps) {
    if (frameOf(step) !== frame) continue;
    if ('run' in step) await run(`(async () => { ${step.run} })()`);
    if ('move' in step) await mouse('mouseMoved', await point(step.move));
    if ('click' in step) {
      const where = await point(step.click);
      await mouse('mouseMoved', where);
      await mouse('mousePressed', where, { button: 'left', buttons: 1, clickCount: 1 });
      await mouse('mouseReleased', where, { button: 'left', clickCount: 1 });
    }
  }
};
mkdirSync(out, { recursive: true });
const began = performance.now();
let written = 0;
// Every frame up to the last one is stepped through, drawn or not, so a still made with --at
// is the same picture as that frame of the full render.
for (let frame = 0; frame <= last; frame++) {
  const seconds = frame / fps;
  await run(`(async () => { window.__clock.seek(${seconds * 1000}); if (typeof window.renderAt === 'function') await window.renderAt(${seconds}); })()`);
  if (steps.length) await act(frame);
  if (wanted ? !wanted.has(frame) : frame < first) continue;
  // Not optimizeForSpeed: some Chrome versions flatten partly transparent pixels with it.
  const { data } = await cdp('Page.captureScreenshot', jpeg === null ? { format: 'png', optimizeForSpeed: false } : { format: 'jpeg', quality: jpeg, optimizeForSpeed: false });
  writeFileSync(join(out, `${String(frame).padStart(5, '0')}.${jpeg === null ? 'png' : 'jpg'}`), Buffer.from(data, 'base64'));
  written++;
}

console.log(JSON.stringify({ frames: written, of: total, fps, size: `${Math.round(width * scale)}x${Math.round(height * scale)}`, dir: resolve(out), seconds_taken: Number(((performance.now() - began) / 1000).toFixed(1)), page_errors: pageErrors.length }));
socket.close();
if (pageErrors.length) {
  fail(`The frames were written, but the page reported ${pageErrors.length} error(s), so they may be wrong:\n${[...new Set(pageErrors)].slice(0, 5).join('\n')}`);
}
process.exit(0);
