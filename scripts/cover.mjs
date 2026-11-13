#!/usr/bin/env node
// Measures how much of a text box a person's cutout covers, frame by frame, for text behind a person.
// Needs Node 22 or later and ffmpeg (with ffprobe). Nothing to install.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const HELP = `Measures how much of a text box a person's cutout covers, frame by frame.

  node cover.mjs --matte <cutout video> --box x,y,w,h [options]

  --matte <file>        the person's cutout: a video with alpha (VP9 WebM, ProRes 4444), or with
                        --mask a black-and-white video where white is the person
  --mask                the matte is a black-and-white mask, not a video with alpha
  --box x,y,w,h         the text's box, in pixels of the matte's own frame
  --box-rel x,y,w,h     the same as fractions of the frame (0..1), for any size
  --words-boxes <file>  several boxes with their own times, as JSON:
                        [{"name": "FAST", "box": [x,y,w,h], "from": 1.2, "to": 3.4}, ...]
                        ("boxRel" instead of "box" for fractions; "from"/"to" are optional)
  --from <s> --to <s>   when the text is visible (default: the whole matte)
  --offset <s>          where the matte's first frame sits in the video (0). With it, every time
                        you pass and every time in the result is a time in the video.
  --must-cover <s,e>    when the text OR its shade is visible, lead-in and lead-out included.
                        Fails if the matte doesn't have the person on every frame of that range.
  --band <lo,hi>        the coverage that reads best (0.30,0.55)
  --limits <lo,hi>      the hard edges: under lo the text floats, over hi it's eaten (0.15,0.65)
  --min-run <s>         ignore a stretch outside the band or limits shorter than this (0.2)
  --fps <n>             the matte's frame rate, when the file's own is wrong
  --measure-width <px>  measure on a copy this wide (960): smaller is faster

Prints one line of JSON: for each box the min, median and max coverage, the time ranges outside
the band and outside the limits, and the ranges where a detached piece of the matte (not joined
to the person) sits over the text. Also the first and last time the matte has anyone in it.
Exits 1 when coverage leaves the limits, when a box is up at a time the matte has no person, or
when --must-cover fails.

It can't judge: whether the words still read (it measures the box, not the letters), the matte's
edges (hair, hands, fringe), or whether the cutout was made from the same frames as the footage.
Look at stills for those.`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(HELP);
  process.exit(0);
}
const FLAGS = ['mask'];
const VALUES = ['matte', 'box', 'box-rel', 'words-boxes', 'from', 'to', 'offset', 'must-cover', 'band', 'limits', 'min-run', 'fps', 'measure-width'];
const options = {};
for (let i = 0; i < args.length; i += 1) {
  const name = args[i].replace(/^--/, '');
  if (!args[i].startsWith('--')) fail(`Don't know what "${args[i]}" is. Options start with --; run with --help.`);
  if (FLAGS.includes(name)) options[name] = true;
  else if (VALUES.includes(name)) {
    if (args[i + 1] === undefined) fail(`--${name} needs a value. Run with --help.`);
    options[name] = args[(i += 1)];
  } else fail(`Unknown option --${name}. Run with --help.`);
}
const numbers = (name, count, example) => {
  if (options[name] === undefined) return null;
  const list = String(options[name]).split(',').map((part) => Number(part.trim()));
  if (list.length !== count || list.some((n) => !Number.isFinite(n))) fail(`--${name} takes ${count} numbers with commas, such as ${example}.`);
  return list;
};
const number = (name, fallback) => {
  if (options[name] === undefined) return fallback;
  const n = Number(options[name]);
  if (!Number.isFinite(n)) fail(`--${name} takes a number.`);
  return n;
};
const pair = (name, fallback) => {
  const [lo, hi] = numbers(name, 2, fallback.join(',')) ?? fallback;
  if (!(lo >= 0 && hi <= 1 && lo < hi)) fail(`--${name} takes two shares from 0 to 1, low then high, such as ${fallback.join(',')}.`);
  return [lo, hi];
};

if (!options.matte) fail('Say which cutout: pass --matte <file>.');
if (!existsSync(options.matte)) fail(`No matte at ${options.matte}.`);
const band = pair('band', [0.3, 0.55]);
const limits = pair('limits', [0.15, 0.65]);
if (limits[0] > band[0] || limits[1] < band[1]) fail(`--limits ${limits.join(',')} must sit outside --band ${band.join(',')}.`);
const offset = number('offset', 0);
const minRun = number('min-run', 0.2);
const measureWidth = number('measure-width', 960);
if (!(measureWidth >= 16)) fail('--measure-width takes a width in pixels of 16 or more, such as 960.');
const mustCover = numbers('must-cover', 2, '12.4,15.9');
if (mustCover && !(mustCover[1] > mustCover[0])) fail('--must-cover takes start,end in seconds with the end after the start.');

const run = (command, list) => spawnSync(command, list, { encoding: 'utf8', maxBuffer: 1 << 26 });
for (const tool of ['ffmpeg', 'ffprobe']) {
  if (run(tool, ['-version']).error) fail(`${tool} isn't installed or isn't on the PATH. Install ffmpeg (it brings ffprobe) and run this again.`);
}

const probe = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,avg_frame_rate,pix_fmt:stream_tags', '-of', 'json', options.matte]);
let stream;
try {
  stream = JSON.parse(probe.stdout).streams[0];
} catch {
  stream = null;
}
if (!stream?.width) fail(`${options.matte} has no picture ffprobe can read. --matte takes a video file.`);
const { width, height } = stream;
const rate = (text) => {
  const [a, b] = String(text ?? '').split('/').map(Number);
  return a > 0 ? a / (b || 1) : 0;
};
const fps = number('fps', rate(stream.avg_frame_rate) || rate(stream.r_frame_rate));
if (!(fps > 0)) fail(`Can't read a frame rate from ${options.matte}. Pass --fps <n>.`);

// VP8 and VP9 keep their alpha in a side channel that ffmpeg's own decoders drop without a word:
// only libvpx reads it, and only when it's named before -i.
const tags = Object.fromEntries(Object.entries(stream.tags ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
const vpx = { vp9: 'libvpx-vp9', vp8: 'libvpx' }[stream.codec_name];
const hasAlpha = vpx ? tags.alpha_mode === '1' : /^(yuva|gbrap|rgba|bgra|argb|abgr|ya\d|ayuv)/.test(stream.pix_fmt ?? '');
let decoder = [];
if (!options.mask) {
  if (!hasAlpha) {
    fail(`${options.matte} has no alpha (${stream.codec_name}, ${stream.pix_fmt}${extname(options.matte) ? '' : ', no extension'}). Pass --mask if it's a black-and-white mask, or export the cutout with alpha (VP9 WebM, ProRes 4444).`);
  }
  if (vpx) {
    if (!new RegExp(`\\s${vpx}\\s`).test(run('ffmpeg', ['-hide_banner', '-decoders']).stdout)) {
      fail(`This ffmpeg has no ${vpx} decoder, so it can't read the alpha in ${stream.codec_name}. Use an ffmpeg built with libvpx, or convert the cutout to ProRes 4444 or a mask.`);
    }
    decoder = ['-c:v', vpx];
  }
}

const boxError = (label, box, relative) => {
  if (!Array.isArray(box) || box.length !== 4 || box.some((n) => !Number.isFinite(n))) return `${label} needs four numbers: x, y, width, height.`;
  const [x, y, w, h] = box;
  if (!(w > 0 && h > 0)) return `${label} has no size: width and height must be above 0.`;
  if (relative) {
    return x < 0 || y < 0 || x + w > 1.000001 || y + h > 1.000001 ? `${label} ${box.join(',')} goes outside the frame. Fractions run from 0 to 1, and x+w and y+h can't pass 1.` : null;
  }
  return x < 0 || y < 0 || x + w > width || y + h > height
    ? `${label} ${box.join(',')} goes outside the matte's ${width}x${height} frame. The box is in the matte's own pixels: scale it to that size, or use --box-rel with fractions (0..1).`
    : null;
};
const boxes = [];
const addBox = (label, name, box, relative, from, to) => {
  const error = boxError(label, box, relative);
  if (error) fail(error);
  const [x, y, w, h] = relative ? [box[0] * width, box[1] * height, box[2] * width, box[3] * height] : box;
  if (from !== undefined && to !== undefined && !(to > from)) fail(`${label}: "to" must be after "from".`);
  boxes.push({ name, x, y, w, h, from, to });
};
const from = options.from === undefined ? undefined : number('from');
const to = options.to === undefined ? undefined : number('to');
if (options.box) addBox('--box', 'box', numbers('box', 4, '1200,300,1440,520'), false, from, to);
if (options['box-rel']) addBox('--box-rel', 'box', numbers('box-rel', 4, '0.3,0.15,0.4,0.25'), true, from, to);
if (options['words-boxes']) {
  const path = options['words-boxes'];
  if (!existsSync(path)) fail(`No boxes file at ${path}.`);
  let list;
  try {
    list = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path} isn't JSON: ${error.message}`);
  }
  list = Array.isArray(list) ? list : list?.boxes;
  if (!Array.isArray(list) || list.length === 0) fail(`${path} must be a list like [{"name": "FAST", "box": [x,y,w,h], "from": 1.2, "to": 3.4}].`);
  list.forEach((item, i) => {
    const label = `${path} entry ${i + 1}${item?.name ? ` ("${item.name}")` : ''}`;
    if (!item || (!item.box && !item.boxRel)) fail(`${label} needs "box": [x,y,w,h] in pixels or "boxRel" in fractions.`);
    addBox(label, item.name ?? `box ${i + 1}`, item.box ?? item.boxRel, !item.box, item.from ?? from, item.to ?? to);
  });
}
if (boxes.length === 0 && !mustCover) fail('Say where the text is: pass --box x,y,w,h (pixels of the matte), --box-rel (fractions) or --words-boxes <file>.');

// Measure on a small copy: the mean over a box barely changes, and 4K decodes are slow enough.
const mw = Math.min(width, Math.round(measureWidth));
const mh = Math.max(1, Math.round((height * mw) / width));
const sx = mw / width;
const sy = mh / height;
for (const box of boxes) {
  box.x0 = Math.min(mw - 1, Math.floor(box.x * sx));
  box.y0 = Math.min(mh - 1, Math.floor(box.y * sy));
  box.x1 = Math.max(box.x0 + 1, Math.min(mw, Math.ceil((box.x + box.w) * sx)));
  box.y1 = Math.max(box.y0 + 1, Math.min(mh, Math.ceil((box.y + box.h) * sy)));
  box.rows = [];
}
const filter = options.mask ? `scale=${mw}:${mh}:flags=area,format=gbrp,extractplanes=g` : `alphaextract,scale=${mw}:${mh}:flags=area`;
const size = mw * mh;
const round = (n, places = 3) => Number(n.toFixed(places));
const time = (frame) => offset + frame / fps;
const shown = (box, t) => (box.from === undefined || t >= box.from - 1e-6) && (box.to === undefined || t < box.to - 1e-6);

// A piece of the matte that isn't joined to the person (a bright thing on the wall the matting
// took for them) sits in front of the text and flickers. Find pieces other than the largest.
const SPECK = Math.max(4, Math.round(size * 0.0001));
const labels = new Int32Array(size);
const stack = new Int32Array(size);
function pieces(frame) {
  labels.fill(0);
  const found = [];
  for (let start = 0; start < size; start += 1) {
    if (frame[start] < 128 || labels[start]) continue;
    const id = found.length + 1;
    const piece = { area: 0, x0: mw, y0: mh, x1: 0, y1: 0 };
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    while (top) {
      const p = stack[--top];
      const x = p % mw;
      const y = (p - x) / mw;
      piece.area += 1;
      if (x < piece.x0) piece.x0 = x;
      if (x > piece.x1) piece.x1 = x;
      if (y < piece.y0) piece.y0 = y;
      if (y > piece.y1) piece.y1 = y;
      if (x > 0 && frame[p - 1] >= 128 && !labels[p - 1]) (labels[p - 1] = id), (stack[top++] = p - 1);
      if (x < mw - 1 && frame[p + 1] >= 128 && !labels[p + 1]) (labels[p + 1] = id), (stack[top++] = p + 1);
      if (y > 0 && frame[p - mw] >= 128 && !labels[p - mw]) (labels[p - mw] = id), (stack[top++] = p - mw);
      if (y < mh - 1 && frame[p + mw] >= 128 && !labels[p + mw]) (labels[p + mw] = id), (stack[top++] = p + mw);
    }
    found.push(piece);
  }
  const largest = found.reduce((best, piece) => (piece.area > (best?.area ?? 0) ? piece : best), null);
  return found.filter((piece) => piece !== largest && piece.area >= SPECK);
}

const content = []; // share of the whole frame the matte fills, per frame
let detachedFrames = 0;
function measure(frame, index) {
  let total = 0;
  for (let p = 0; p < size; p += 1) total += frame[p];
  content.push(total / (size * 255));
  const t = time(index);
  const live = boxes.filter((box) => shown(box, t));
  if (live.length === 0) return;
  const loose = pieces(frame);
  if (loose.length) detachedFrames += 1;
  for (const box of live) {
    let sum = 0;
    for (let y = box.y0; y < box.y1; y += 1) {
      const row = y * mw;
      for (let x = box.x0; x < box.x1; x += 1) sum += frame[row + x];
    }
    const over = loose.some((piece) => piece.x0 < box.x1 && piece.x1 >= box.x0 && piece.y0 < box.y1 && piece.y1 >= box.y0);
    box.rows.push({ index, cover: sum / ((box.x1 - box.x0) * (box.y1 - box.y0) * 255), over });
  }
}

const child = spawn('ffmpeg', ['-v', 'error', ...decoder, '-i', options.matte, '-an', '-vf', filter, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
let errors = '';
child.stderr.on('data', (chunk) => (errors += chunk));
const frame = Buffer.alloc(size);
let filled = 0;
let count = 0;
child.stdout.on('data', (chunk) => {
  let at = 0;
  while (at < chunk.length) {
    const take = Math.min(size - filled, chunk.length - at);
    chunk.copy(frame, filled, at, at + take);
    filled += take;
    at += take;
    if (filled === size) {
      measure(frame, count);
      count += 1;
      filled = 0;
    }
  }
});
child.on('error', (error) => fail(`Couldn't run ffmpeg: ${error.message}`));
child.on('close', (code) => {
  if (code !== 0 || count === 0) fail(`ffmpeg couldn't read ${options.matte}: ${errors.trim().split('\n').pop() || `exit ${code}`}`);
  report();
});

// Runs of frames where test() holds, as time ranges; a run shorter than minRun is dropped.
function ranges(rows, test, shortest = minRun) {
  const out = [];
  let open = null;
  const close = () => {
    if (open && (open.last - open.first + 1) / fps >= shortest - 1e-6) {
      out.push({ from: round(time(open.first)), to: round(time(open.last + 1)), ...open.extra });
    }
    open = null;
  };
  for (const row of rows) {
    if (test(row)) {
      if (open && row.index === open.last + 1) open.last = row.index;
      else {
        close();
        open = { first: row.index, last: row.index, extra: {} };
      }
      if (row.cover !== undefined) {
        open.extra.min = round(Math.min(open.extra.min ?? 1, row.cover));
        open.extra.max = round(Math.max(open.extra.max ?? 0, row.cover));
      }
    } else close();
  }
  close();
  return out;
}

function report() {
  const problems = [];
  const start = offset;
  const end = time(count);
  const EMPTY = 0.001; // under a thousandth of the frame: nobody is in it
  const frames = content.map((share, index) => ({ index, share }));
  const present = frames.filter((row) => row.share >= EMPTY);
  if (!options.mask && content.every((share) => share > 0.99)) {
    fail(`${options.matte} is solid on every frame: its alpha isn't being read, or it isn't a cutout. Check it with a player that shows transparency.`);
  }
  if (present.length === 0) fail(`${options.matte} has nobody in it on any frame${options.mask ? ' (in a mask, white is the person)' : ''}.`);
  const empty = ranges(frames, (row) => row.share < EMPTY, 0);
  const sorted = (list) => [...list].sort((a, b) => a - b);
  const median = (list) => {
    const s = sorted(list);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };

  let cover = null;
  if (mustCover) {
    const [a, b] = mustCover;
    const missing = [];
    if (a < start - 1e-6) missing.push({ from: round(a), to: round(Math.min(b, start)), why: 'before the matte starts' });
    if (b > end + 1e-6) missing.push({ from: round(Math.max(a, end)), to: round(b), why: 'after the matte ends' });
    for (const gap of empty) {
      if (gap.from < b - 1e-6 && gap.to > a + 1e-6) missing.push({ from: Math.max(gap.from, round(a)), to: Math.min(gap.to, round(b)), why: 'nobody in the matte' });
    }
    cover = { from: round(a), to: round(b), ok: missing.length === 0, missing };
    for (const gap of missing) {
      problems.push(`--must-cover: no cutout from ${gap.from} s to ${gap.to} s (${gap.why}). The text or its shade would cross the person there: make the cutout span ${round(a)}-${round(b)} s.`);
    }
  }

  const results = boxes.map((box) => {
    const a = box.from ?? start;
    const b = box.to ?? end;
    const result = { name: box.name, box: [box.x, box.y, box.w, box.h].map((n) => round(n, 1)), from: round(a), to: round(b), frames: box.rows.length };
    if (a < start - 1e-6 || b > end + 1e-6) {
      problems.push(`${box.name}: the text is up ${round(a)}-${round(b)} s but the matte runs ${round(start)}-${round(end)} s. Make the cutout cover the text's whole time (or pass --offset if the matte starts later in the video).`);
    }
    const gone = ranges(box.rows.map((row) => ({ index: row.index, share: content[row.index] })), (row) => row.share < EMPTY, 0);
    for (const gap of gone) problems.push(`${box.name}: nobody in the matte from ${gap.from} s to ${gap.to} s while the text is up.`);
    if (box.rows.length === 0) return { ...result, measured: false };
    const covers = box.rows.map((row) => row.cover);
    const outsideLimits = ranges(box.rows, (row) => row.cover < limits[0] || row.cover > limits[1]);
    const outsideBand = ranges(box.rows, (row) => row.cover < band[0] || row.cover > band[1]);
    const detachedOverText = ranges(box.rows, (row) => row.over, 0).map(({ from: f, to: t }) => ({ from: f, to: t }));
    for (const range of outsideLimits) {
      const what = range.max < limits[0] ? 'the text floats in front of nothing' : range.min > limits[1] ? 'the text is eaten' : 'it swings past both edges';
      problems.push(`${box.name}: coverage ${range.min}-${range.max} from ${range.from} s to ${range.to} s is outside ${limits.join('-')} (${what}). Move, resize or shorten the text.`);
    }
    return {
      ...result,
      min: round(Math.min(...covers)),
      median: round(median(covers)),
      max: round(Math.max(...covers)),
      inBand: outsideBand.length === 0,
      outsideBand,
      outsideLimits,
      detachedOverText,
    };
  });

  const result = {
    ok: problems.length === 0,
    matte: resolve(options.matte),
    kind: options.mask ? 'mask' : `alpha (${stream.codec_name}${decoder.length ? `, read with ${decoder[1]}` : ''})`,
    size: [width, height],
    fps: round(fps),
    frames: count,
    runs: { from: round(start), to: round(end) },
    person: {
      first: round(time(present[0].index)),
      last: round(time(present.at(-1).index)),
      firstFrame: present[0].index,
      lastFrame: present.at(-1).index,
      emptyRanges: empty,
      shareOfFrame: round(median(present.map((row) => row.share))),
    },
    ...(cover ? { mustCover: cover } : {}),
    band,
    limits,
    boxes: results,
    detachedFrames,
    problems,
    cannotJudge: 'Whether the words still read (this measures the box, not the letters), the edges of the matte, and whether it was made from the same frames as the footage. Look at stills.',
  };
  for (const problem of problems) console.error(problem);
  process.stdout.write(`${JSON.stringify(result)}\n`, () => process.exit(problems.length ? 1 : 0));
}
