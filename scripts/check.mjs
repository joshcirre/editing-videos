#!/usr/bin/env node
// Checks a rendered video for the mistakes a program can find: stray frames at cuts, black gaps,
// frozen stretches, loudness off target, a final that differs from its approved draft, layers
// that start or end a few frames off a cut. Exits 1 when a check fails.
// Needs Node 22 or later and ffmpeg (with ffprobe). Nothing to install.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHECKS = ['cuts', 'stray', 'strips', 'frozen', 'black', 'sound', 'match', 'layers'];
const LIMITS =
  'Cannot judge: whether a join SOUNDS right, whether text is readable, whether B-roll matches ' +
  'the words. Look at the strips and listen to the joins, or say that a person should.';

const HELP = `Checks a rendered video for the mistakes a program can find. Exits 1 when a check fails.

  node check.mjs <video> [checks...] [options]

Checks (none named: cuts, stray, frozen, black and sound, plus strips, match and layers when
their option is given):
  cuts     lists the picture cuts: single frames that change a lot between frames that don't
  stray    FAILS on two cuts within --stray frames of each other: a stray frame left at a cut
  strips   writes one picture per cut to --out: the frames from 5 before to 5 after, in a row,
           with a red bar on the first frame after the cut. For you to look at; never fails
  frozen   WARNS on stretches of --frozen seconds or more where the picture doesn't change
  black    FAILS on black of --black seconds or more; WARNS when the first frame is black
  sound    FAILS when loudness is more than --tol LU from --lufs, the true peak is over --peak,
           or there is no sound; WARNS on silence of --silence seconds or more in the middle
           and on holes where the sound drops to digital zero
  match    with --against: FAILS when the two files' frame counts differ; WARNS where the
           picture differs (PSNR at 480x270 more than --drop dB under the median) and where
           the sound's level differs
  layers   with --ranges: FAILS on a layer that starts or ends 1 to --near frames from a cut
           (it belongs on the cut or clear of it); lists layers that cross a cut

Options:
  --from <s> --to <s>   scan only this stretch (seconds)
  --fps <n>             frames a second, when the file's own value is wrong
  --cut-score <n>       a cut's change from the frame before scores above this (0.045, a
                        fixed-camera talking head). The score is on the scale of ffmpeg's
                        scene score: 0 is no change, a cut to a different picture is near 1
  --quiet-score <n>     the frames beside it change less than this (0.03), or half as much as it
  --busy <n>            a spike isn't a cut when this many frames within half a second of it
                        score half as much or more: that's movement, not a cut (3; 0 = off)
  --stray <frames>      two cuts this close are a stray frame (8)
  --out <dir>           where strips go
  --at <s,s,...>        strips at these times instead of at the cuts
  --max <n>             at most this many strips (40); the rest are counted as skipped
  --span <frames>       frames each side of the cut in a strip (5)
  --tile <px>           width of each frame in a strip (320)
  --frozen <s>          shortest frozen stretch to report (3)
  --black <s>           shortest black gap to fail on (0.5)
  --lufs <n>            loudness target (-14)      --tol <LU>  how far off is allowed (1)
  --peak <dBTP>         true-peak ceiling (-1)
  --silence <s>         shortest silence in the middle to report (2)
  --against <video>     the approved draft to compare with (match)
  --drop <dB>           how far under the median PSNR counts as different (10)
  --ranges <file.json>  layers: [{"name": "shade", "start": 12.3, "end": 15.1}, ...] in seconds
  --near <frames>       how close to a cut a layer's edge may not be (8)
  --json <file>         write the full report here

Prints one line of JSON on stdout ({"ok", "failed", "warned", "cuts", ...}) and what it found,
with times as mm:ss.ff and frame numbers, on stderr. Exit code 1 when a check failed or the
check couldn't run; 0 otherwise. Times assume a constant frame rate. Thresholds for cuts suit a
fixed camera: a soft jump cut can score under them, and a screen that scrolls, a hand that moves
right after a cut or the first frame of a fade can look like a cut. Look at the strip before
believing a stray frame, and don't take "no stray frames" as "every cut is clean".
${LIMITS}`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// ---- arguments ----------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(HELP);
  process.exit(args.length === 0 ? 1 : 0);
}
const NUMBERS = {
  from: 0, to: null, fps: null, 'cut-score': 0.045, 'quiet-score': 0.03, busy: 3, stray: 8,
  max: 40, span: 5, tile: 320, frozen: 3, black: 0.5, lufs: -14, tol: 1, peak: -1, silence: 2,
  drop: 10, near: 8,
};
const TEXTS = ['out', 'at', 'against', 'ranges', 'json'];
const opt = { ...NUMBERS };
const positional = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg.startsWith('--')) {
    positional.push(arg);
    continue;
  }
  const name = arg.slice(2);
  const value = args[++i];
  if (!(name in NUMBERS) && !TEXTS.includes(name)) fail(`Unknown option ${arg}. Run with --help for the list.`);
  if (value === undefined) fail(`${arg} needs a value. Run with --help for what it takes.`);
  if (name in NUMBERS) {
    if (value.trim() === '' || !Number.isFinite(Number(value))) fail(`${arg} takes a number, not "${value}".`);
    opt[name] = Number(value);
  } else opt[name] = value;
}
const [videoArg, ...named] = positional;
if (!videoArg) fail('Usage: node check.mjs <video> [checks...] [options]\nRun with --help for the rest.');
if (CHECKS.includes(videoArg) && !existsSync(videoArg)) fail(`The video comes first, then the checks: node check.mjs <video> ${videoArg}`);
if (!existsSync(videoArg)) fail(`No video at ${videoArg}.`);
for (const name of named) if (!CHECKS.includes(name)) fail(`Unknown check "${name}". Checks: ${CHECKS.join(', ')}.`);
const video = resolve(videoArg);

const want = new Set(named);
if (named.length === 0) {
  for (const name of ['cuts', 'stray', 'frozen', 'black', 'sound']) want.add(name);
  if (opt.out) want.add('strips');
  if (opt.against) want.add('match');
  if (opt.ranges) want.add('layers');
}
if (want.has('strips') && !opt.out) fail('strips needs --out <dir>: the folder the pictures go in.');
if (want.has('match') && !opt.against) fail('match needs --against <approved.mp4>: the draft to compare with.');
if (want.has('match') && !existsSync(opt.against)) fail(`No video at ${opt.against} (--against).`);
if (want.has('layers') && !opt.ranges) fail('layers needs --ranges <file.json>: [{"name": "shade", "start": 12.3, "end": 15.1}, ...].');
if (opt.from < 0 || (opt.to !== null && opt.to <= opt.from)) fail('--from and --to are seconds in the video, with --to after --from.');
for (const name of ['cut-score', 'quiet-score', 'frozen', 'black', 'tol', 'silence', 'drop', 'tile']) {
  if (!(opt[name] > 0)) fail(`--${name} takes a number above 0.`);
}
for (const name of ['busy', 'stray', 'max', 'span', 'near']) {
  if (!(opt[name] >= 0) || !Number.isInteger(opt[name])) fail(`--${name} takes a whole number, 0 or more.`);
}
if (opt.fps !== null && !(opt.fps > 0)) fail('--fps takes a number above 0, such as 30.');

let layers = [];
if (want.has('layers')) {
  if (!existsSync(opt.ranges)) fail(`No ranges file at ${opt.ranges}.`);
  try {
    layers = JSON.parse(readFileSync(opt.ranges, 'utf8'));
  } catch (error) {
    fail(`${opt.ranges} isn't JSON: ${error.message}`);
  }
  if (!Array.isArray(layers) || layers.some((l) => !(l?.start >= 0) || !(l?.end > l.start))) {
    fail(`${opt.ranges} must be a list like [{"name": "shade", "start": 12.3, "end": 15.1}], seconds in the video, end after start.`);
  }
}
let atTimes = null;
if (opt.at !== undefined) {
  atTimes = opt.at.split(',').map(Number);
  if (atTimes.length === 0 || atTimes.some((t) => !(t >= 0))) fail('--at takes times in seconds, such as 12.5,48.');
}

// ---- ffmpeg -------------------------------------------------------------------------------
for (const tool of ['ffmpeg', 'ffprobe']) {
  if (spawnSync(tool, ['-version'], { stdio: 'ignore' }).error) {
    fail(`${tool} wasn't found. Install ffmpeg (ffprobe comes with it) and make sure both are on your PATH.`);
  }
}

function probe(file) {
  const run = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  let info;
  try {
    info = JSON.parse(run.stdout);
  } catch {
    info = null;
  }
  if (run.status !== 0 || !info?.streams) fail(`ffprobe couldn't read ${file}: ${(run.stderr || '').trim().split('\n')[0] || 'not a media file'}`);
  const v = info.streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const rate = (text) => {
    const [n, d] = String(text || '').split('/').map(Number);
    return n > 0 && d > 0 ? n / d : null;
  };
  return {
    video: v,
    audio: a,
    // The average is off by a little when timestamps are; the nominal rate is right unless it's a timebase.
    fps: v ? (rate(v.r_frame_rate) <= 240 && Math.abs(rate(v.r_frame_rate) / (rate(v.avg_frame_rate) || rate(v.r_frame_rate)) - 1) < 0.05 ? rate(v.r_frame_rate) : rate(v.avg_frame_rate) || rate(v.r_frame_rate)) : null,
    duration: Number(info.format?.duration) || Number(v?.duration) || 0,
    frames: v && Number(v.nb_frames) > 0 ? Number(v.nb_frames) : null,
  };
}

// Runs a tool, hands stdout to onLine line by line (or onChunk raw), and returns stderr.
function run(tool, toolArgs, { onLine, onChunk } = {}) {
  return new Promise((done) => {
    const child = spawn(tool, toolArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let rest = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      if (onChunk) return onChunk(chunk);
      if (!onLine) return;
      const lines = (rest + chunk.toString('utf8')).split(/\r?\n/);
      rest = lines.pop();
      for (const line of lines) onLine(line);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 4_000_000) stderr = stderr.slice(-2_000_000);
    });
    child.on('error', (error) => done({ code: 1, stderr: String(error.message) }));
    child.on('close', (code) => {
      if (rest && onLine) onLine(rest);
      done({ code, stderr });
    });
  });
}
const lastLine = (text) => text.trim().split(/\r?\n/).filter(Boolean).pop() || 'no message';

const info = probe(video);
const fps = opt.fps ?? info.fps;
const needsPicture = ['cuts', 'stray', 'strips', 'frozen', 'black', 'match', 'layers'].some((c) => want.has(c));
if (needsPicture && !info.video) fail(`${videoArg} has no picture. Only "sound" can check it.`);
if (needsPicture && !(fps > 0)) fail(`Couldn't read the frame rate of ${videoArg}. Pass it: --fps 30.`);
const from = opt.from;
const to = Math.min(opt.to ?? info.duration, info.duration || Infinity);
if (info.duration && from >= info.duration) fail(`--from ${from} is past the end of the video (${info.duration.toFixed(2)} s).`);
const seek = [...(from > 0 ? ['-ss', String(from)] : []), ...(opt.to !== null ? ['-t', String(to - from)] : [])];

const frameOf = (t) => Math.round(t * fps + 1e-6);
function stamp(t) {
  const rate = fps > 0 ? fps : 100; // sound only: hundredths
  const n = Math.round(t * rate + 1e-6);
  const second = Math.floor(n / rate + 1e-9);
  const ff = n - Math.ceil(second * rate - 1e-9);
  const two = (x) => String(x).padStart(2, '0');
  return `${two(Math.floor(second / 60))}:${two(second % 60)}.${two(ff)}`;
}
const at = (t) => (fps > 0 ? `${stamp(t)} (frame ${frameOf(t)})` : stamp(t));
const round = (x, places = 3) => (Number.isFinite(x) ? Number(x.toFixed(places)) : x);

const report = {
  video,
  fps: round(fps ?? 0, 4),
  duration: round(info.duration),
  from: round(from),
  to: round(to),
  checks: {},
  failed: [],
  warned: [],
  cannot_judge: LIMITS,
};
const lines = [];
const say = (text) => lines.push(text);
const SHOWN = 20;
function list(items, format) {
  for (const item of items.slice(0, SHOWN)) say(`    ${format(item)}`);
  if (items.length > SHOWN) say(`    ... and ${items.length - SHOWN} more${opt.json ? ` (all in ${opt.json})` : ' (pass --json <file> for all)'}`);
}
const verdict = (name, level) => {
  const bucket = level === 'FAIL' ? report.failed : report.warned;
  if (!bucket.includes(name)) bucket.push(name);
};

// ---- the picture: one pass for scene scores, frozen stretches and black -----------------------
let cuts = [];
if (['cuts', 'stray', 'frozen', 'black', 'layers'].some((c) => want.has(c)) || (want.has('strips') && !atTimes)) {
  // ffmpeg hands over each frame small and grey; the change from one frame to the next is
  // measured here. ffmpeg's own scene score can't be used for this: it is the smaller of a
  // frame's change and how much that change differs from the frame before's, so the second of
  // two cuts in a row (the far side of a single stray frame) scores near zero.
  const W = 240;
  const H = 136;
  const SIZE = W * H;
  // One score per frame scanned: the mean change from the frame before, doubled, which puts a
  // lone cut at about the number ffmpeg's scene score gives it (measured on the test videos).
  const scores = [0];
  let previous = null;
  let frame = Buffer.alloc(SIZE);
  let filled = 0;
  let firstFrameBlack = false;
  const filters = [
    'scale=480:-2',
    `freezedetect=n=-60dB:d=${opt.frozen}`,
    `blackdetect=d=${opt.black}:pix_th=0.10`,
    `scale=${W}:${H}:flags=area`,
    'format=gray',
  ].join(',');
  const result = await run('ffmpeg', ['-hide_banner', '-nostats', '-v', 'info', ...seek, '-i', video, '-an', '-vf', filters, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], {
    onChunk(chunk) {
      let offset = 0;
      while (offset < chunk.length) {
        const take = Math.min(SIZE - filled, chunk.length - offset);
        chunk.copy(frame, filled, offset, offset + take);
        filled += take;
        offset += take;
        if (filled < SIZE) break;
        if (previous) {
          let sum = 0;
          for (let i = 0; i < SIZE; i++) {
            const d = frame[i] - previous[i];
            sum += d < 0 ? -d : d;
          }
          scores.push(Math.min(1, (2 * sum) / (SIZE * 255)));
        } else {
          let dark = 0;
          for (let i = 0; i < SIZE; i++) if (frame[i] <= 38) dark++;
          firstFrameBlack = from === 0 && dark >= SIZE * 0.98;
        }
        [previous, frame] = [frame, previous ?? Buffer.alloc(SIZE)];
        filled = 0;
      }
    },
  });
  if (result.code !== 0 || !previous) fail(`ffmpeg couldn't scan ${videoArg}: ${lastLine(result.stderr)}`);
  const times = scores.map((_, i) => from + i / fps);
  const scanEnd = from + scores.length / fps;
  const frozen = [];
  const black = [];
  let freezeStart = null;
  for (const line of result.stderr.split(/\r?\n/)) {
    let m;
    if ((m = /black_start:(\S+) black_end:(\S+)/.exec(line))) black.push({ start: Number(m[1]) + from, end: Number(m[2]) + from });
    else if ((m = /freezedetect\.freeze_start: (\S+)/.exec(line))) freezeStart = Number(m[1]) + from;
    else if ((m = /freezedetect\.freeze_end: (\S+)/.exec(line)) && freezeStart !== null) {
      frozen.push({ start: freezeStart, end: Number(m[1]) + from });
      freezeStart = null;
    }
  }
  if (freezeStart !== null) frozen.push({ start: freezeStart, end: scanEnd });

  // A cut is one frame that changes more than --cut-score while the frames beside it change
  // little: less than --quiet-score, or less than half as much as it. Two such frames side by
  // side are two cuts one frame apart (a single stray frame). Longer runs are movement, a
  // dissolve or a flash, not a cut.
  const low = (n, i) => n < 0 || n >= scores.length || scores[n] < Math.max(opt['quiet-score'], scores[i] / 2);
  const high = (i) => i < scores.length && scores[i] > opt['cut-score'];
  const half = Math.max(1, Math.round(fps / 2));
  let rejected = 0;
  for (let i = 1; i < scores.length; i++) {
    if (!high(i) || !low(i - 1, i)) continue;
    let end = null;
    if (low(i + 1, i)) end = i;
    else if (high(i + 1) && low(i + 2, i + 1)) end = i + 1;
    if (end === null) continue;
    for (let j = i; j <= end; j++) {
      let busy = 0;
      for (let k = Math.max(0, j - half); k <= Math.min(scores.length - 1, j + half); k++) {
        if ((k < i || k > end) && scores[k] >= scores[j] / 2) busy++;
      }
      if (opt.busy > 0 && busy >= opt.busy) rejected++;
      else cuts.push({ time: round(times[j], 4), frame: frameOf(times[j]), score: round(scores[j], 4) });
    }
    i = end;
  }

  if (want.has('cuts') || want.has('stray') || want.has('layers') || want.has('strips')) {
    report.checks.cuts = {
      count: cuts.length,
      frames_scanned: scores.length,
      cut_score: opt['cut-score'],
      quiet_score: opt['quiet-score'],
      spikes_in_movement_ignored: rejected,
      cuts,
    };
    say(`cuts    ${cuts.length} in ${scores.length} frames (change > ${opt['cut-score']}, neighbours < ${opt['quiet-score']}${rejected ? `; ${rejected} spikes inside movement ignored` : ''})`);
    if (want.has('cuts')) list(cuts, (c) => `${at(c.time)}  score ${c.score}`);
  }

  if (want.has('stray')) {
    const pairs = [];
    for (let i = 1; i < cuts.length; i++) {
      const gap = cuts[i].frame - cuts[i - 1].frame;
      if (gap <= opt.stray) pairs.push({ first: cuts[i - 1], second: cuts[i], frames_apart: gap });
    }
    report.checks.stray = { within_frames: opt.stray, count: pairs.length, pairs };
    if (pairs.length) {
      verdict('stray', 'FAIL');
      say(`stray   FAIL  ${pairs.length} pair${pairs.length > 1 ? 's' : ''} of cuts within ${opt.stray} frames: a stray frame left at a cut, or movement read as cuts`);
      list(pairs, (p) => `${at(p.first.time)} and ${at(p.second.time)}: ${p.frames_apart} frame${p.frames_apart > 1 ? 's' : ''} apart`);
    } else say(`stray   ok    no two cuts within ${opt.stray} frames`);
  }

  if (want.has('frozen')) {
    const found = frozen.map((f) => ({ start: round(f.start), end: round(f.end), seconds: round(f.end - f.start, 2) }));
    report.checks.frozen = { at_least_seconds: opt.frozen, count: found.length, stretches: found };
    if (found.length) {
      verdict('frozen', 'WARN');
      say(`frozen  WARN  ${found.length} stretch${found.length > 1 ? 'es' : ''} of ${opt.frozen} s or more with no change (right for a held slide, wrong for a person)`);
      list(found, (f) => `${at(f.start)} to ${at(f.end)}: ${f.seconds} s`);
    } else say(`frozen  ok    nothing still for ${opt.frozen} s or more`);
  }

  if (want.has('black')) {
    const gaps = black.filter((b) => b.end - b.start >= opt.black - 0.5 / fps).map((b) => ({ start: round(b.start), end: round(b.end), seconds: round(b.end - b.start, 2) }));
    report.checks.black = { at_least_seconds: opt.black, count: gaps.length, first_frame_black: firstFrameBlack, gaps };
    if (gaps.length) {
      verdict('black', 'FAIL');
      say(`black   FAIL  ${gaps.length} black gap${gaps.length > 1 ? 's' : ''} of ${opt.black} s or more`);
      list(gaps, (b) => `${at(b.start)} to ${at(b.end)}: ${b.seconds} s`);
    } else say(`black   ok    no black of ${opt.black} s or more`);
    if (firstFrameBlack) {
      verdict('black', 'WARN');
      say('black   WARN  the first frame is black: players that show the first frame as the poster show nothing');
    }
  }
}

// ---- strips -------------------------------------------------------------------------------
if (want.has('strips')) {
  const outDir = resolve(opt.out);
  mkdirSync(outDir, { recursive: true });
  const points = atTimes ? atTimes.map((t) => ({ time: t, frame: frameOf(t) })) : cuts;
  const chosen = points.slice(0, opt.max);
  const files = [];
  const problems = [];
  for (const point of chosen) {
    const first = Math.max(0, point.frame - opt.span);
    const count = point.frame - first + opt.span + 1;
    const mark = point.frame - first;
    const file = join(outDir, `cut-${String(point.frame).padStart(6, '0')}.jpg`);
    // Seek to the middle of the frame before, so rounding can't land one frame late.
    const start = Math.max(0, (first - 0.5) / fps);
    const filters = [
      `scale=${opt.tile}:-2`,
      `drawbox=x=0:y=0:w=iw:h=6:color=red:t=fill:enable='eq(n,${mark})'`,
      `tile=${count}x1`,
    ].join(',');
    const result = await run('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-y', '-ss', start.toFixed(6), '-i', video, '-an', '-frames:v', '1', '-vf', filters, '-q:v', '3', '-update', '1', file]);
    if (result.code === 0 && existsSync(file)) files.push({ time: point.time, frame: point.frame, first_frame: first, frames: count, file });
    else problems.push(`${at(point.time)}: ${lastLine(result.stderr)}`);
  }
  const skipped = points.length - chosen.length;
  report.checks.strips = { dir: outDir, written: files.length, skipped, frames_each_side: opt.span, files };
  say(`strips  ${files.length} written to ${outDir}${skipped ? `; ${skipped} skipped (over --max ${opt.max}: raise it, or use --from/--to)` : ''}`);
  say(`        each is frames -${opt.span} to +${opt.span}, the red bar on the first frame after the cut. Open them and look.`);
  for (const problem of problems) say(`    couldn't write the strip at ${problem}`);
}

// ---- sound --------------------------------------------------------------------------------
if (want.has('sound')) {
  const check = { target_lufs: opt.lufs, tolerance_lu: opt.tol, peak_ceiling_dbtp: opt.peak };
  report.checks.sound = check;
  if (!info.audio) {
    verdict('sound', 'FAIL');
    check.error = 'no audio stream';
    say('sound   FAIL  the file has no sound');
  } else {
    const first = await run('ffmpeg', ['-hide_banner', '-nostats', ...seek, '-i', video, '-vn', '-af', `ebur128=peak=true:framelog=verbose,silencedetect=n=-50dB:d=${opt.silence}`, '-f', 'null', '-']);
    const summary = first.stderr.slice(first.stderr.lastIndexOf('Summary:'));
    const lufs = Number(/I:\s+(-?[\d.]+|-?inf)\s+LUFS/.exec(summary)?.[1]);
    const peak = Number(/Peak:\s+(-?[\d.]+|-?inf)\s+dBFS/.exec(summary)?.[1]);
    if (first.code !== 0 || !first.stderr.includes('Summary:') || Number.isNaN(lufs)) fail(`ffmpeg couldn't measure the sound of ${videoArg}: ${lastLine(first.stderr)}`);
    const partial = from > 0 || opt.to !== null;
    const span = (text, floor) => {
      const found = [];
      let start = null;
      for (const line of text.split(/\r?\n/)) {
        let m;
        if ((m = /silence_start:\s*(-?[\d.]+)/.exec(line))) start = Math.max(0, Number(m[1])) + from;
        else if ((m = /silence_end:\s*(-?[\d.]+)/.exec(line)) && start !== null) {
          found.push({ start, end: Number(m[1]) + from });
          start = null;
        }
      }
      if (start !== null) found.push({ start, end: to });
      // "In the middle" leaves out silence that touches the start or the end of the scan.
      return found
        .filter((s) => s.start > from + 0.05 && s.end < to - 0.05 && s.end - s.start >= floor)
        .map((s) => ({ start: round(s.start), end: round(s.end), seconds: round(s.end - s.start, 3) }));
    };
    const silences = span(first.stderr, opt.silence);
    const second = await run('ffmpeg', ['-hide_banner', '-nostats', ...seek, '-i', video, '-vn', '-af', 'silencedetect=n=-80dB:d=0.02', '-f', 'null', '-']);
    // A hole is shorter than a reported silence; longer ones are already in the list above.
    const holes = span(second.stderr, 0.02).filter((h) => !silences.some((s) => h.start >= s.start - 0.01 && h.end <= s.end + 0.01));
    Object.assign(check, { lufs, true_peak_dbtp: peak, measured_on: partial ? 'the scanned stretch only' : 'the whole file', silences, holes });

    const off = Math.abs(lufs - opt.lufs) > opt.tol + 1e-9;
    const over = peak > opt.peak + 1e-9;
    const note = partial ? ' (this stretch only: measure the whole file before you deliver)' : '';
    if (!Number.isFinite(lufs)) {
      verdict('sound', 'FAIL');
      say('sound   FAIL  the sound is silent from start to end');
    } else if (off || over) {
      verdict('sound', 'FAIL');
      if (off) say(`sound   FAIL  ${lufs} LUFS; the target is ${opt.lufs} LUFS within ${opt.tol} LU${note}`);
      if (over) say(`sound   FAIL  true peak ${peak} dBTP is over the ceiling of ${opt.peak} dBTP${note}`);
      if (!off) say(`sound         loudness ${lufs} LUFS is on target`);
      if (!over) say(`sound         true peak ${peak} dBTP is under the ceiling`);
    } else say(`sound   ok    ${lufs} LUFS, true peak ${peak} dBTP (target ${opt.lufs} LUFS within ${opt.tol} LU, ceiling ${opt.peak} dBTP)${note}`);
    if (silences.length) {
      verdict('sound', 'WARN');
      say(`sound   WARN  ${silences.length} silence${silences.length > 1 ? 's' : ''} of ${opt.silence} s or more in the middle (under -50 dB)`);
      list(silences, (s) => `${at(s.start)} to ${at(s.end)}: ${s.seconds} s`);
    }
    if (holes.length) {
      verdict('sound', 'WARN');
      say(`sound   WARN  ${holes.length} hole${holes.length > 1 ? 's' : ''} where the sound drops to digital zero (under -80 dB): a join with no room tone under it`);
      list(holes, (h) => `${at(h.start)} to ${at(h.end)}: ${Math.round(h.seconds * 1000)} ms`);
    }
  }
}

// ---- match --------------------------------------------------------------------------------
if (want.has('match')) {
  const other = resolve(opt.against);
  const otherInfo = probe(other);
  if (!otherInfo.video) fail(`${opt.against} has no picture to compare with.`);
  const count = (file, known) => {
    if (known.frames) return known.frames;
    const counted = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    return Number(counted.stdout.trim().split(/[\r\n,]/)[0]) || null;
  };
  const frames = count(video, info);
  const otherFrames = count(other, otherInfo);
  const check = { against: other, frames, against_frames: otherFrames, frames_equal: frames === otherFrames };
  report.checks.match = check;
  if (frames !== otherFrames) {
    verdict('match', 'FAIL');
    say(`match   FAIL  frame counts differ: ${frames} here, ${otherFrames} in ${opt.against} (${frames - otherFrames > 0 ? '+' : ''}${frames - otherFrames})`);
  } else say(`match   ok    both have ${frames} frames`);
  if (Math.abs(otherInfo.fps - fps) > 0.01) say(`match         frame rates differ: ${round(fps, 3)} here, ${round(otherInfo.fps, 3)} there`);

  const psnr = [];
  const graph = '[0:v]scale=480:270,setsar=1[a];[1:v]scale=480:270,setsar=1[b];[a][b]psnr=stats_file=-';
  const compared = await run('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', ...seek, '-i', video, ...seek, '-i', other, '-an', '-filter_complex', graph, '-f', 'null', '-'], {
    onLine(line) {
      const m = /^n:(\d+).*psnr_avg:(\S+)/.exec(line);
      if (m) psnr.push(m[2] === 'inf' ? 100 : Number(m[2]));
    },
  });
  if (compared.code !== 0 || psnr.length === 0) fail(`ffmpeg couldn't compare the pictures: ${lastLine(compared.stderr)}`);
  const sorted = [...psnr].sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)];
  const dips = [];
  const startFrame = frameOf(from);
  for (let i = 0; i < psnr.length; i++) {
    if (psnr[i] >= median - opt.drop) continue;
    const last = dips[dips.length - 1];
    if (last && i - last.lastIndex <= Math.max(2, Math.round(fps / 2))) {
      last.lastIndex = i;
      last.lowest = Math.min(last.lowest, psnr[i]);
    } else dips.push({ firstIndex: i, lastIndex: i, lowest: psnr[i] });
  }
  check.frames_compared = psnr.length;
  check.median_psnr_db = round(median, 2);
  check.identical_pictures = sorted[0] >= 100;
  check.dips = dips.map((d) => ({
    start: round((startFrame + d.firstIndex) / fps),
    end: round((startFrame + d.lastIndex + 1) / fps),
    frames: d.lastIndex - d.firstIndex + 1,
    lowest_psnr_db: round(d.lowest, 2),
  }));
  if (check.dips.length) {
    verdict('match', 'WARN');
    say(`match   WARN  ${check.dips.length} place${check.dips.length > 1 ? 's' : ''} where the picture differs (more than ${opt.drop} dB under the median of ${check.median_psnr_db} dB). Look at each:`);
    list(check.dips, (d) => `${at(d.start)} to ${at(d.end)}: ${d.frames} frame${d.frames > 1 ? 's' : ''}, down to ${d.lowest_psnr_db} dB`);
  } else say(`match   ok    picture: ${psnr.length} frames compared, median ${median >= 100 ? 'identical' : `${check.median_psnr_db} dB`}, nothing more than ${opt.drop} dB under it`);

  // The sound: identical bytes at 8 kHz mono say "same". When they differ, compare levels in
  // quarter-second blocks to say where.
  const BLOCK = 2000;
  const listen = async (file) => {
    const hash = createHash('md5');
    const levels = [];
    let sum = 0;
    let n = 0;
    let samples = 0;
    let odd = null;
    const result = await run('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', ...seek, '-i', file, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], {
      onChunk(chunk) {
        hash.update(chunk);
        const data = odd ? Buffer.concat([odd, chunk]) : chunk;
        const even = data.length - (data.length % 2);
        for (let i = 0; i < even; i += 2) {
          const s = data.readInt16LE(i) / 32768;
          sum += s * s;
          samples++;
          if (++n === BLOCK) {
            levels.push(10 * Math.log10(sum / n + 1e-12));
            sum = 0;
            n = 0;
          }
        }
        odd = even < data.length ? data.subarray(even) : null;
      },
    });
    if (n > 0) levels.push(10 * Math.log10(sum / n + 1e-12));
    return { md5: samples ? hash.digest('hex') : null, levels, samples, error: result.code !== 0 ? lastLine(result.stderr) : null };
  };
  if (!info.audio || !otherInfo.audio) {
    check.audio = !info.audio && !otherInfo.audio ? 'neither has sound' : 'only one has sound';
    if (info.audio || otherInfo.audio) verdict('match', 'WARN');
    say(`match   ${info.audio || otherInfo.audio ? 'WARN ' : 'ok   '} sound: ${check.audio}`);
  } else {
    const mine = await listen(video);
    const theirs = await listen(other);
    const differing = [];
    for (let i = 0; i < Math.min(mine.levels.length, theirs.levels.length); i++) {
      const loud = Math.max(mine.levels[i], theirs.levels[i]) > -60;
      if (!loud || Math.abs(mine.levels[i] - theirs.levels[i]) <= 3) continue;
      const last = differing[differing.length - 1];
      if (last && i - last.lastIndex <= 2) last.lastIndex = i;
      else differing.push({ firstIndex: i, lastIndex: i });
    }
    const seconds = (blocks) => from + (blocks * BLOCK) / 8000;
    check.audio_md5 = mine.md5;
    check.against_audio_md5 = theirs.md5;
    check.audio_seconds = round(mine.samples / 8000);
    check.against_audio_seconds = round(theirs.samples / 8000);
    check.audio_level_differs = differing.map((d) => ({ start: round(seconds(d.firstIndex)), end: round(seconds(d.lastIndex + 1)) }));
    const lengthOff = Math.abs(mine.samples - theirs.samples) / 8000;
    if (mine.md5 === theirs.md5) {
      check.audio = 'same';
      say('match   ok    sound: the same (identical at 8 kHz mono)');
    } else if (differing.length === 0 && lengthOff <= 1.5 / fps) {
      check.audio = 'different bytes, same levels';
      say('match   ok    sound: not identical, but the levels agree within 3 dB all the way (a new encode does this; a changed mix at the same level would too)');
    } else {
      check.audio = 'different';
      verdict('match', 'WARN');
      say(`match   WARN  sound: different${lengthOff > 1.5 / fps ? ` (${check.audio_seconds} s here, ${check.against_audio_seconds} s there)` : ''}${differing.length ? '. Levels differ by more than 3 dB at:' : ''}`);
      list(check.audio_level_differs, (d) => `${at(d.start)} to ${at(d.end)}`);
    }
  }
}

// ---- layers -------------------------------------------------------------------------------
if (want.has('layers')) {
  const off = [];
  const crossing = [];
  const inScan = (t) => t >= from - 1e-6 && t <= to + 1e-6;
  let outside = 0;
  layers.forEach((layer, index) => {
    const name = layer.name ?? `layer ${index + 1}`;
    for (const edge of ['start', 'end']) {
      if (!inScan(layer[edge])) {
        outside++;
        continue;
      }
      const frame = frameOf(layer[edge]);
      let nearest = null;
      for (const cut of cuts) if (nearest === null || Math.abs(cut.frame - frame) < Math.abs(nearest.frame - frame)) nearest = cut;
      const distance = nearest ? frame - nearest.frame : null;
      if (nearest && Math.abs(distance) >= 1 && Math.abs(distance) <= opt.near) {
        off.push({ name, edge, time: round(layer[edge]), frame, cut_time: nearest.time, cut_frame: nearest.frame, frames_off: distance });
      }
    }
    const first = frameOf(layer.start);
    const last = frameOf(layer.end);
    const inside = cuts.filter((cut) => cut.frame > first + opt.near && cut.frame < last - opt.near);
    if (inside.length) crossing.push({ name, start: round(layer.start), end: round(layer.end), cuts: inside.map((cut) => ({ time: cut.time, frame: cut.frame })) });
  });
  report.checks.layers = { layers: layers.length, near_frames: opt.near, off_the_cut: off, crossing_a_cut: crossing, edges_outside_scan: outside };
  if (off.length) {
    verdict('layers', 'FAIL');
    say(`layers  FAIL  ${off.length} layer edge${off.length > 1 ? 's' : ''} 1 to ${opt.near} frames off a cut: move each onto the cut or clear of it`);
    list(off, (o) => `"${o.name}" ${o.edge}s at ${at(o.time)}, ${Math.abs(o.frames_off)} frame${Math.abs(o.frames_off) > 1 ? 's' : ''} ${o.frames_off > 0 ? 'after' : 'before'} the cut at ${at(o.cut_time)}`);
  } else say(`layers  ok    ${layers.length} layer${layers.length === 1 ? '' : 's'}: every edge is on a cut or more than ${opt.near} frames from one`);
  if (crossing.length) {
    say(`layers        ${crossing.length} cross a cut (right for a layer that belongs to the whole section, wrong for one that belongs to a shot):`);
    list(crossing, (c) => `"${c.name}" ${stamp(c.start)} to ${stamp(c.end)} crosses ${c.cuts.map((cut) => at(cut.time)).join(', ')}`);
  }
  if (outside) say(`layers        ${outside} edge${outside > 1 ? 's' : ''} outside the scanned stretch weren't checked`);
}

// ---- the result ---------------------------------------------------------------------------
report.ok = report.failed.length === 0;
const head = `${videoArg}: ${fps > 0 ? `${round(fps, 3)} fps, ` : ''}${round(info.duration, 2)} s, scanned ${stamp(from)} to ${stamp(to)}`;
console.error([head, ...lines].join('\n'));
console.error(report.ok ? (report.warned.length ? `Nothing failed; look at the warnings (${report.warned.join(', ')}).` : 'Nothing failed.') : `FAILED: ${report.failed.join(', ')}.`);
console.error(LIMITS);
if (opt.json) writeFileSync(opt.json, JSON.stringify(report, null, 2));

const c = report.checks;
const line = { ok: report.ok, failed: report.failed, warned: report.warned };
if (c.cuts) line.cuts = c.cuts.count;
if (c.stray) line.stray = c.stray.count;
if (c.strips) Object.assign(line, { strips: c.strips.written, strips_skipped: c.strips.skipped, strips_dir: c.strips.dir });
if (c.frozen) line.frozen = c.frozen.count;
if (c.black) Object.assign(line, { black: c.black.count, first_frame_black: c.black.first_frame_black });
if (c.sound && !c.sound.error) Object.assign(line, { lufs: c.sound.lufs, true_peak: c.sound.true_peak_dbtp, silences: c.sound.silences.length, holes: c.sound.holes.length });
if (c.match) Object.assign(line, { frames: c.match.frames, against_frames: c.match.against_frames, picture_dips: c.match.dips.length, audio: c.match.audio });
if (c.layers) Object.assign(line, { layers_off_cut: c.layers.off_the_cut.length, layers_crossing: c.layers.crossing_a_cut.length });
if (opt.json) line.report = resolve(opt.json);
console.log(JSON.stringify(line));
process.exit(report.ok ? 0 : 1);
