#!/usr/bin/env node
// Draws a web page as video frames: one PNG per frame, transparent where the page is.
// Needs Node 22 or later and Chrome (or Chromium, or Edge). Nothing to install.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HELP = `Draws a web page as video frames: one PNG per frame, transparent where the page is.

  node page-frames.mjs <page.html> <out-dir> --duration <seconds> [options]

  --duration <s>   how long the graphic runs (required)
  --fps <n>        frames a second (30): use the video's
  --size <WxH>     frame size (1920x1080): use the video's
  --at <s,s,...>   only the frames at these times, as stills to check before a full render
  --opaque         keep the page's background instead of a transparent one
  --no-sandbox     pass --no-sandbox to Chrome (some containers need it)

The page starts at time 0 when it loads. Its clock is run by this script (scripts/page-clock.js),
so CSS animations and transitions, element.animate(), timers, requestAnimationFrame, Date and
Math.random all land on the exact frame. A page that defines window.renderAt(seconds) is also
called with each frame's time. Values go to the page in its query: 'card.html?name=Dana%20Lee'.

Frames are 00000.png, 00001.png, ... by frame number (with --at too, so a still is the frame
the full render makes). Chrome is found on its own; set CHROME=/path/to/chrome to choose one.`;

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
  fail(`Usage: node page-frames.mjs <page.html> <out-dir> --duration <seconds> [--fps 30] [--size 1920x1080] [--at 0.5,2]\nRun with --help for the rest.`);
}
const [file, query] = page.split('?');
if (!existsSync(file)) fail(`No page at ${file}.`);

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
await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
if (!rest.includes('--opaque')) await cdp('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(new URL('./page-clock.js', import.meta.url), 'utf8') });
await cdp('Page.navigate', { url: pathToFileURL(resolve(file)).href + (query ? `?${query}` : '') });
for (let tries = 0; tries < 400 && !(await run('!!window.__clock && document.readyState === "complete"')); tries++) {
  await new Promise((later) => setTimeout(later, 25));
}
await run('window.__clock.ready()');

const total = Math.round(duration * fps);
const at = option('at');
const wanted = at ? new Set(String(at).split(',').map((seconds) => Math.min(total - 1, Math.max(0, Math.round(Number(seconds) * fps))))) : null;
const last = wanted ? Math.max(...wanted) : total - 1;
mkdirSync(out, { recursive: true });
const began = performance.now();
let written = 0;
// Every frame up to the last one is stepped through, drawn or not, so a still made with --at
// is the same picture as that frame of the full render.
for (let frame = 0; frame <= last; frame++) {
  const seconds = frame / fps;
  await run(`(async () => { window.__clock.seek(${seconds * 1000}); if (typeof window.renderAt === 'function') await window.renderAt(${seconds}); })()`);
  if (wanted && !wanted.has(frame)) continue;
  // Not optimizeForSpeed: some Chrome versions flatten partly transparent pixels with it.
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', optimizeForSpeed: false });
  writeFileSync(join(out, `${String(frame).padStart(5, '0')}.png`), Buffer.from(data, 'base64'));
  written++;
}

console.log(JSON.stringify({ frames: written, of: total, fps, size: `${width}x${height}`, dir: resolve(out), seconds_taken: Number(((performance.now() - began) / 1000).toFixed(1)), page_errors: pageErrors.length }));
socket.close();
if (pageErrors.length) {
  fail(`The frames were written, but the page reported ${pageErrors.length} error(s), so they may be wrong:\n${[...new Set(pageErrors)].slice(0, 5).join('\n')}`);
}
process.exit(0);
