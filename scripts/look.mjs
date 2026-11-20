#!/usr/bin/env node
// Lets an agent look at a video: contact sheets, sharp crops at a time, and the text on screen.
// Needs Node 22 or later and ffmpeg (with ffprobe); `text` also needs tesseract. Nothing to install.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const HELP = `Lets you look at a video: what's on screen when, read sharply, and searchable.

  node look.mjs sheet <video> [--from <s>] [--to <s>] [--count 12] [--cols 4] [--width 480] [--out sheet.png]
  node look.mjs crop  <video> --at <s> (--box x,y,w,h | --box-rel x,y,w,h) [--out crop.png]
  node look.mjs text  <video> [--from <s>] [--to <s>] [--every 1] [--box-rel x,y,w,h] [--find "<words>"]

  sheet   evenly spaced frames of a stretch on one image, in reading order, each with its time
          when this ffmpeg can draw text. Look at it to see what happens where: what's on the
          screen, where the shots change, which stretch to look at closer. A second sheet of a
          short stretch is how to zoom in on time.
  crop    one region of one frame at the file's own resolution, enlarged so small text reads
          (a terminal, code, a URL, a slide's fine print). The box is in the file's pixels, or
          in fractions of the frame (0..1) with --box-rel.
  text    the words on screen, read with tesseract every --every seconds, as stretches that show
          the same text. With --find, only where those words are on screen (case and punctuation
          ignored), with the stretch's whole text. --box-rel reads only that part of the frame.

Prints one line of JSON: the image and the time of each frame; or the crop's box; or for text the
engine, the stretches ({from, to, text}) and, with --find, the hits. Times are seconds in the
file. Exits 1 when it can't run (no ffmpeg, no tesseract for text, a time outside the file).

It can't judge: what a frame means, whether text is legible to a viewer at the size it plays
(look at a full frame for that), or a word tesseract misread (crop it and read it yourself). A
sheet samples: a cut or a slide that comes and goes between two of its frames isn't on it.`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const [mode, video, ...rest] = process.argv.slice(2);
if (!mode || mode === '--help' || mode === '-h' || rest.includes('--help')) {
  console.log(HELP);
  process.exit(0);
}
if (!['sheet', 'crop', 'text'].includes(mode)) fail(`Don't know "${mode}": it's sheet, crop or text. Run with --help.`);
if (!video || video.startsWith('--')) fail(`${mode} needs a video. Run with --help.`);
if (!existsSync(video)) fail(`${video} doesn't exist.`);
const VALUES = { sheet: ['from', 'to', 'count', 'cols', 'width', 'out'], crop: ['at', 'box', 'box-rel', 'out'], text: ['from', 'to', 'every', 'box-rel', 'find'] }[mode];
const options = {};
for (let i = 0; i < rest.length; i += 1) {
  const name = rest[i].replace(/^--/, '');
  if (!rest[i].startsWith('--')) fail(`Don't know what "${rest[i]}" is. Options start with --; run with --help.`);
  if (!VALUES.includes(name)) fail(`${mode} has no --${name}. Run with --help.`);
  if (rest[i + 1] === undefined) fail(`--${name} needs a value. Run with --help.`);
  options[name] = rest[(i += 1)];
}
const number = (name, fallback) => {
  if (options[name] === undefined) return fallback;
  const n = Number(options[name]);
  if (!Number.isFinite(n)) fail(`--${name} takes a number.`);
  return n;
};
const box = (name) => {
  if (options[name] === undefined) return null;
  const list = String(options[name]).split(',').map((p) => Number(p.trim()));
  if (list.length !== 4 || list.some((n) => !Number.isFinite(n) || n < 0)) fail(`--${name} takes four numbers with commas: x,y,w,h.`);
  if (name === 'box-rel' && (list[0] + list[2] > 1.0001 || list[1] + list[3] > 1.0001 || !list[2] || !list[3])) fail('--box-rel is in fractions of the frame: x+w and y+h at most 1, w and h above 0.');
  return list;
};

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.error?.code === 'ENOENT') return { missing: true };
  return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
};
const probe = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', video]);
if (probe.missing) fail('ffprobe (ffmpeg) is missing: install ffmpeg, or look at stills from another tool.');
if (!probe.ok) fail(`ffprobe couldn't read ${video}: ${probe.err}`);
const info = JSON.parse(probe.out);
const stream = info.streams?.[0];
if (!stream) fail(`${video} has no picture.`);
const { width: W, height: H } = stream;
const duration = Number(info.format?.duration) || 0;
const round = (t) => Math.round(t * 100) / 100;
const range = () => {
  const from = number('from', 0);
  const to = number('to', duration);
  if (!(from >= 0 && to > from && from < duration)) fail(`--from and --to must be a stretch inside the file (0 to ${round(duration)} s).`);
  return [from, Math.min(to, duration)];
};
// a box in the file's pixels, even sizes (what crop and the encoders want)
const pixels = (b, rel) => {
  const [x, y, w, h] = rel ? [b[0] * W, b[1] * H, b[2] * W, b[3] * H] : b;
  const even = (n) => Math.max(2, Math.floor(n / 2) * 2);
  const px = { x: Math.floor(x), y: Math.floor(y), w: even(Math.min(w, W - x)), h: even(Math.min(h, H - y)) };
  if (px.x >= W || px.y >= H || px.w < 2 || px.h < 2) fail(`The box is outside the ${W}×${H} frame.`);
  return px;
};
const frame = (at, filter, out) => {
  const r = run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', video, '-frames:v', '1', '-vf', filter, out]);
  if (r.missing) fail('ffmpeg is missing.');
  if (!r.ok || !existsSync(out)) fail(`ffmpeg couldn't take the frame at ${at} s: ${r.err}`);
};
const stamp = (t) => `${Math.floor(t / 60)}\\:${(t % 60).toFixed(1).padStart(4, '0')}`;

if (mode === 'sheet') {
  const [from, to] = range();
  const count = Math.max(1, Math.round(number('count', 12)));
  const cols = Math.max(1, Math.min(count, Math.round(number('cols', 4))));
  const rows = Math.ceil(count / cols);
  const width = Math.max(64, Math.round(number('width', 480)));
  const out = resolve(options.out ?? 'sheet.png');
  const dir = mkdtempSync(join(tmpdir(), 'look-'));
  // the middle of each equal slice, so the first and last aren't the stretch's edges
  const times = Array.from({ length: count }, (_, i) => round(from + ((i + 0.5) * (to - from)) / count));
  const label = (t) => `,drawtext=text='${stamp(t)}':x=6:y=6:fontsize=${Math.max(12, Math.round(width / 22))}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`;
  let labelled = true;
  times.forEach((t, i) => {
    const file = join(dir, `${String(i).padStart(4, '0')}.png`);
    const scale = `scale=${width}:-2`;
    if (labelled && run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', scale + label(t), file]).ok && existsSync(file)) return;
    labelled = false; // this ffmpeg has no drawtext (or no font): the times are in the JSON
    frame(t, scale, file);
  });
  // an unfilled last row stays black
  const tile = run('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', join(dir, '%04d.png'), '-vf', `tile=${cols}x${rows}:padding=4:margin=4`, '-frames:v', '1', out]);
  rmSync(dir, { recursive: true, force: true });
  if (!tile.ok || !existsSync(out)) fail(`ffmpeg couldn't make the sheet: ${tile.err}`);
  console.log(JSON.stringify({ sheet: out, cols, rows, labelled, frames: times.map((at, i) => ({ tile: i + 1, at })) }));
} else if (mode === 'crop') {
  if (options.at === undefined) fail('crop needs --at <seconds>.');
  const at = number('at', 0);
  if (!(at >= 0 && at < duration)) fail(`--at must be inside the file (0 to ${round(duration)} s).`);
  const b = box('box-rel') ?? box('box');
  if (!b) fail('crop needs --box x,y,w,h (pixels) or --box-rel x,y,w,h (fractions).');
  const px = pixels(b, options['box-rel'] !== undefined);
  // enlarged until it's about 1600 wide, at most 4×: text a few pixels tall reads
  const scale = Math.min(4, Math.max(1, Math.floor(1600 / px.w)));
  const out = resolve(options.out ?? 'crop.png');
  frame(at, `crop=${px.w}:${px.h}:${px.x}:${px.y}${scale > 1 ? `,scale=iw*${scale}:ih*${scale}:flags=lanczos` : ''}`, out);
  console.log(JSON.stringify({ image: out, at, box: px, frame: { width: W, height: H }, enlarged: scale }));
} else {
  const version = run('tesseract', ['--version']);
  if (version.missing) {
    fail('tesseract is missing, so the text on screen can\'t be read here. Make a sheet of the stretch and crop what you need to read, and read it yourself (or ask the person to install tesseract).');
  }
  const engine = `tesseract ${(version.out + version.err).match(/tesseract v?([\d.]+)/i)?.[1] ?? ''}`.trim();
  const [from, to] = range();
  const every = Math.max(0.1, number('every', 1));
  const b = box('box-rel');
  const px = b ? pixels(b, true) : { x: 0, y: 0, w: W, h: H };
  // tesseract reads best with letters 20 px or more tall: small frames are enlarged
  const scale = Math.min(3, Math.max(1, Math.ceil(1600 / px.w)));
  const dir = mkdtempSync(join(tmpdir(), 'look-'));
  const filter = [`fps=1/${every}`, b ? `crop=${px.w}:${px.h}:${px.x}:${px.y}` : null, scale > 1 ? `scale=iw*${scale}:ih*${scale}:flags=lanczos` : null, 'format=gray'].filter(Boolean).join(',');
  const r = run('ffmpeg', ['-v', 'error', '-y', '-ss', String(from), '-to', String(to), '-i', video, '-vf', filter, join(dir, '%06d.png')]);
  if (!r.ok) {
    rmSync(dir, { recursive: true, force: true });
    fail(`ffmpeg couldn't take the frames: ${r.err}`);
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1));
  // two reads of the same screen differ by a misread word or two: still the same text
  const same = (a, b2) => {
    const [x, y] = [words(a), words(b2)];
    if (!x.size && !y.size) return true;
    const both = [...x].filter((w) => y.has(w)).length;
    return both / (x.size + y.size - both) >= 0.8;
  };
  const runs = [];
  files.forEach((f, i) => {
    const read = run('tesseract', [join(dir, f), 'stdout', '--psm', '3']);
    // drop lines of stray marks: a line keeps when it has a word of two letters or more
    const text = (read.out ?? '').split('\n').map((l) => l.trim()).filter((l) => /\p{L}{2}|\p{N}{2}/u.test(l)).join('\n');
    const at = round(from + i * every);
    const last = runs.at(-1);
    if (last && same(last.text, text)) {
      last.to = round(Math.min(to, at + every));
      if (text.length > last.text.length) last.text = text; // the fullest read of it
    } else runs.push({ from: at, to: round(Math.min(to, at + every)), text });
  });
  rmSync(dir, { recursive: true, force: true });
  const shown = runs.filter((s) => s.text);
  const result = { engine, every, frames: files.length, box: b ? px : null, stretches: shown };
  if (options.find !== undefined) {
    const q = norm(options.find);
    if (!q) fail('--find needs words.');
    result.find = options.find;
    result.hits = shown.filter((s) => ` ${norm(s.text)} `.includes(` ${q} `)).map((s) => ({ from: s.from, to: s.to, text: s.text }));
    delete result.stretches;
  }
  console.log(JSON.stringify(result));
}
