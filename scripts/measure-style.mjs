#!/usr/bin/env node
// Measures how a finished video is edited (shots, opening, loudness, pauses, joins, music level)
// so the numbers can go into a taste profile. See guide/study.md.
// Needs Node 22 or later and ffmpeg + ffprobe on the PATH. Nothing to install.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const HELP = `Measures how a finished video is edited, as numbers for a taste profile (editing.md).

  node measure-style.mjs <video> [--words words.json] [--out style.json] [options]
  node measure-style.mjs --compare <yours.json> <reference.json>
  node measure-style.mjs --to-profile <style.json> [more.json ...] [--on "what they are"]

  <video>            a finished video. Measured from the picture and sound alone:
                       shots     cuts, shot length (median, 10th and 90th percentile, longest),
                                 cuts a minute in the first 30 s and after, how even the rhythm is
                       opening   when the first sound and the first cut come
                       loudness  integrated LUFS, true peak, loudness range
  --words <file>     word timings of this video: {"words":[{"text","start","end"}]}, in seconds.
                     Adds: pauses between words, the silence kept either side of each cut (the
                     join style), the level in the pauses against the voice (the music bed), and
                     how many pauses carry a picture cut.
  --out <file>       where to write every value and how it was measured (style.json in the
                     current folder)
  --from <s> --to <s>  measure only this stretch
  --sheet <dir>      also write contact sheets, one frame every 2 s, to look at what can't be
                     measured: caption look, text placement, B-roll, colour
  --sheet-step <s>   seconds between sheet frames (2)

  Cut detection, for when it finds too many or too few (look at a sheet to decide):
  --cut-score <n>    the lowest scene score that can be a cut (0.04). A jump cut on one framing
                     scores 0.04-0.3; a change of shot 0.3-1.
  --cut-ratio <n>    how many times above the frames on its quieter side a cut must stand (4)
  --cut-window <s>   the neighbours are the frames this close on each side (0.17)
  --speech-db <dB>   the level that counts as sound, in dBFS (30 dB under the loud parts)

  --compare          prints "yours vs. reference" for the numbers that matter. Exits 1 when one
                     is outside its tolerance, so it works as a check before you show an edit.
  --to-profile       prints "## Measured" lines for an editing.md: the median across the given
                     videos, the range, and how many videos. --on names them ("four tutorials");
                     --date sets the day (today).

Prints one line of JSON. Readable lines (--compare, --to-profile) go to stderr and are also in
the JSON as "lines". Numbers measured on one person's videos are theirs, not anyone's defaults.`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const VALUES = new Set(['words', 'out', 'from', 'to', 'sheet', 'sheet-step', 'cut-score', 'cut-ratio', 'cut-window', 'speech-db', 'on', 'date']);
const FLAGS = new Set(['compare', 'to-profile']);
const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}
const options = {};
const files = [];
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (!arg.startsWith('--')) files.push(arg);
  else if (FLAGS.has(arg.slice(2))) options[arg.slice(2)] = true;
  else if (VALUES.has(arg.slice(2))) {
    const value = args[i + 1];
    if (value === undefined || (value.startsWith('--') && Number.isNaN(Number(value)))) fail(`${arg} needs a value after it.`);
    options[arg.slice(2)] = value;
    i += 1;
  } else fail(`Unknown option ${arg}. Run with --help for the list.`);
}
const number = (name, fallback, test = (n) => n >= 0) => {
  if (options[name] === undefined) return fallback;
  const n = Number(options[name]);
  if (!Number.isFinite(n) || !test(n)) fail(`--${name} takes a number, such as ${fallback ?? 10}. Got "${options[name]}".`);
  return n;
};

// ---------- small maths ----------
const round = (n, places = 2) => (n === null || n === undefined || !Number.isFinite(n) ? null : Number(n.toFixed(places)));
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * p;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
};
const median = (values) => percentile(values, 0.5);
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const db = (power) => (power > 0 ? 10 * Math.log10(power) : -120);
const clock = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;

const readJson = (file, what) => {
  if (!existsSync(file)) fail(`No ${what} at ${file}.`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${file} isn't JSON: ${error.message}`);
  }
};

// ---------- compare ----------
if (options.compare) {
  if (files.length !== 2) fail('--compare takes two files: your edit\'s style.json, then the reference\'s.');
  const [yours, reference] = files.map((file) => readJson(file, 'style.json'));
  for (const [i, style] of [yours, reference].entries()) if (!style.shots) fail(`${files[i]} isn't a style.json written by this script.`);
  // [label, path, unit, tolerance, relative?]. Tolerances are this script's own starting points.
  const rows = [
    ['Median shot', (s) => s.shots?.median_s, 's', 0.2, true],
    ['Cuts a minute', (s) => s.shots?.cuts_per_min?.all, '', 0.2, true],
    ['Median pause between words', (s) => s.pauses?.median_s, 's', 0.05],
    ['Pauses over 0.5 s, share', (s) => s.pauses?.share_over_half_s, '', 0.05],
    ['Kept after the outgoing word at a join', (s) => s.joins?.after_outgoing_median_s, 's', 0.05],
    ['Kept before the incoming word at a join', (s) => s.joins?.before_incoming_median_s, 's', 0.05],
    ['Loudness', (s) => s.loudness?.integrated_lufs, 'LUFS', 1],
    ['True peak', (s) => s.loudness?.true_peak_dbtp, 'dBTP', 1],
    ['Level in pauses under the voice', (s) => s.bed?.db_under_voice, 'dB', 3],
  ];
  const lines = [];
  const differences = [];
  const missing = [];
  for (const [label, get, unit, tolerance, relative] of rows) {
    const a = get(yours);
    const b = get(reference);
    if (typeof a !== 'number' || typeof b !== 'number') {
      missing.push(label);
      continue;
    }
    const off = relative ? Math.abs(a - b) > tolerance * Math.abs(b) : Math.abs(a - b) > tolerance;
    const u = unit ? ` ${unit}` : '';
    const delta = round(a - b);
    lines.push(`${off ? 'DIFFERS' : 'close  '}  ${label}: yours ${a}${u} vs. reference ${b}${u} (${delta > 0 ? '+' : ''}${delta}${u}; within ${relative ? `${tolerance * 100}%` : `${tolerance}${u}`} counts as close)`);
    if (off) differences.push({ what: label, yours: a, reference: b, delta });
  }
  if (yours.shots?.metronomic && !reference.shots?.metronomic) {
    lines.push(`DIFFERS  Rhythm: your shots are all about the same length (variation ${yours.shots.variation}); the reference's vary (${reference.shots.variation})`);
    differences.push({ what: 'Rhythm', yours: yours.shots.variation, reference: reference.shots.variation });
  }
  if (missing.length) lines.push(`not compared (missing in one file; measure both with --words): ${missing.join('; ')}`);
  lines.push('Not compared at all: caption look, text placement, B-roll framing, colour. Put stills of both at the same seconds side by side.');
  console.error(lines.join('\n'));
  console.log(JSON.stringify({ ok: differences.length === 0, differences, not_compared: missing, lines }));
  process.exit(differences.length ? 1 : 0);
}

// ---------- to-profile ----------
if (options['to-profile']) {
  if (!files.length) fail('--to-profile takes one or more style.json files.');
  const styles = files.map((file) => {
    const style = readJson(file, 'style.json');
    if (!style.shots) fail(`${file} isn't a style.json written by this script.`);
    return style;
  });
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('--date takes a day as YYYY-MM-DD, such as 2026-11-10.');
  const names = options.on ?? styles.map((style) => basename(style.video)).join(', ');
  // The median across videos, with the range when there is more than one video.
  const across = (get, unit = ' s', places = 2) => {
    const values = styles.map(get).filter((value) => typeof value === 'number');
    if (!values.length) return null;
    const u = unit;
    const mid = round(median(values), places);
    const range = values.length > 1 ? ` (range ${round(Math.min(...values), places)}–${round(Math.max(...values), places)}${u})` : '';
    return { text: `${mid}${u}${range}`, n: values.length, value: mid };
  };
  const lines = [];
  const add = (key, text, n) => {
    lines.push(`- [${key}] ${text} (measured on ${n} video${n === 1 ? '' : 's'}) — on: ${names} (${date})`);
  };
  const shot = across((s) => s.shots.median_s);
  const p10 = across((s) => s.shots.p10_s);
  const p90 = across((s) => s.shots.p90_s);
  const longest = across((s) => s.shots.longest_s, ' s', 1);
  if (shot) add('shot.median', `Median shot ${shot.text}; one in ten under ${p10.text}, one in ten over ${p90.text}; longest hold ${longest.text}`, shot.n);
  const early = across((s) => s.shots.cuts_per_min.first_30s, '', 1);
  const later = across((s) => s.shots.cuts_per_min.rest, '', 1);
  if (early && later) add('shot.rate', `${early.text} cuts a minute in the first 30 s, ${later.text} after`, Math.min(early.n, later.n));
  const firstCut = across((s) => s.opening?.first_cut_s);
  const firstSound = across((s) => s.opening?.first_sound_s);
  if (firstCut && firstSound) add('hook.start', `First sound at ${firstSound.text}; first cut at ${firstCut.text}`, Math.min(firstCut.n, firstSound.n));
  const pause = across((s) => s.pauses?.median_s);
  if (pause) {
    const p90pause = across((s) => s.pauses?.p90_s);
    const share = across((s) => (s.pauses ? s.pauses.share_over_half_s * 100 : null), '%', 0);
    add('pause.inside', `Pauses between words: median ${pause.text}, one in ten over ${p90pause.text}; ${share.text} of them over 0.5 s`, pause.n);
    const rate = across((s) => s.pauses?.words_per_second_speaking, '', 1);
    add('pace.words', `${rate.text} words a second while speaking`, rate.n);
  }
  const after = across((s) => s.joins?.after_outgoing_median_s);
  const before = across((s) => s.joins?.before_incoming_median_s);
  if (after && before) add('pause.join', `At a join: ${after.text} kept after the outgoing word, ${before.text} before the incoming one`, Math.min(after.n, before.n));
  const carried = across((s) => (typeof s.picture_change_at_pauses?.share === 'number' ? s.picture_change_at_pauses.share * 100 : null), '%', 0);
  if (carried) add('cut.picture', `${carried.text} of pauses of 0.25 s or more carry a picture cut`, carried.n);
  const bed = across((s) => (s.bed?.kind === 'bed' ? s.bed.db_under_voice : null), ' dB', 0);
  const noBed = styles.filter((s) => s.bed?.kind === 'none').length;
  if (bed) add('music.under', `Pauses sit ${bed.text} under the voice (music and room tone together, best effort)`, bed.n);
  else if (noBed) add('music.under', 'No music under the voice: the pauses are at room-tone level', noBed);
  const lufs = across((s) => s.loudness?.integrated_lufs, ' LUFS', 1);
  const peak = across((s) => s.loudness?.true_peak_dbtp, ' dBTP', 1);
  if (lufs && peak) add('sound.loudness', `Loudness ${lufs.text}, true peak ${peak.text}`, Math.min(lufs.n, peak.n));
  const text = ['## Measured', '', ...lines].join('\n');
  console.error(text);
  if (options.out) writeFileSync(resolve(options.out), `${text}\n`);
  console.log(JSON.stringify({ ok: true, videos: styles.length, date, lines, out: options.out ? resolve(options.out) : null }));
  process.exit(0);
}

// ---------- measure ----------
if (files.length !== 1) fail('Usage: node measure-style.mjs <video> [--words words.json] [--out style.json] [--from s --to s] [--sheet dir]\nRun with --help for the rest.');
const video = resolve(files[0]);
if (!existsSync(video)) fail(`No video at ${video}.`);

const run = (tool, toolArgs, { binary = false } = {}) => {
  const result = spawnSync(tool, toolArgs, { encoding: binary ? 'buffer' : 'utf8', maxBuffer: 4 * 1024 ** 3, windowsHide: true });
  if (result.error?.code === 'ENOENT') fail(`${tool} wasn't found. Install ffmpeg (it brings ffprobe) and make sure it's on the PATH.`);
  if (result.error) fail(`${tool} couldn't run: ${result.error.message}`);
  return result;
};

const probe = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,avg_frame_rate,r_frame_rate', '-of', 'json', video]);
if (probe.status !== 0) fail(`ffprobe can't read ${video}: ${String(probe.stderr).trim().split('\n').pop()}`);
const info = JSON.parse(probe.stdout);
const picture = info.streams?.find((stream) => stream.codec_type === 'video');
const hasSound = info.streams?.some((stream) => stream.codec_type === 'audio');
if (!picture) fail(`${video} has no picture to measure.`);
const duration = Number(info.format?.duration);
if (!(duration > 0)) fail(`ffprobe gave no duration for ${video}.`);
const rate = (text) => {
  const [a, b] = String(text ?? '').split('/').map(Number);
  return b > 0 ? a / b : a;
};
const fps = rate(picture.avg_frame_rate) || rate(picture.r_frame_rate) || 30;
const frame = 1 / fps;

const from = number('from', 0);
const to = Math.min(number('to', duration), duration);
if (!(to > from)) fail(`--to (${to}) must be after --from (${from}); the video is ${round(duration)} s long.`);
const span = to - from;
const cutScore = number('cut-score', 0.04, (n) => n > 0 && n <= 1);
const cutRatio = number('cut-ratio', 4, (n) => n >= 1);
const cutWindow = number('cut-window', 0.17, (n) => n > 0);
const sheetStep = number('sheet-step', 2, (n) => n > 0);
const seek = ['-hide_banner', '-nostats', '-ss', String(from), '-t', String(span), '-i', video];

let words = null;
if (options.words) {
  const transcript = readJson(resolve(options.words), 'words file');
  if (!Array.isArray(transcript.words) || transcript.words.some((word) => !(word?.end >= word?.start))) {
    fail(`${options.words} must look like {"words":[{"text":"Hi","start":0.0,"end":0.3}, ...]} with times in seconds.`);
  }
  words = transcript.words.filter((word) => word.start >= from && word.end <= to).sort((a, b) => a.start - b.start);
  if (words.length < 2) fail(`${options.words} has ${words.length} words between ${from} s and ${to} s. Is it the transcript of this video?`);
}

// ----- shots: scene score of every frame, then one-frame spikes with quiet neighbours -----
const scene = run('ffmpeg', [...seek, '-an', '-vf', "scale=320:-2,select='gte(scene,0)',metadata=print:file=-", '-f', 'null', '-']);
if (scene.status !== 0) fail(`ffmpeg couldn't read the picture: ${String(scene.stderr).trim().split('\n').pop()}`);
const scores = [...scene.stdout.matchAll(/pts_time:([\d.]+)\s*\r?\n\s*lavfi\.scene_score=([\d.]+)/g)].map((match) => ({ t: from + Number(match[1]), score: Number(match[2]) }));
if (scores.length < 3) fail('ffmpeg gave no scene scores for this stretch. Try a longer --from/--to range.');
const cuts = [];
for (let i = 2; i < scores.length - 1; i += 1) {
  const { t, score } = scores[i];
  if (score < cutScore) continue;
  let before = 0;
  let after = 0;
  for (let j = i - 1; j >= 0 && t - scores[j].t <= cutWindow; j -= 1) before = Math.max(before, scores[j].score);
  for (let j = i + 1; j < scores.length && scores[j].t - t <= cutWindow; j += 1) after = Math.max(after, scores[j].score);
  // Quiet on one side, and clearly above the other: a cut into (or out of) a moving shot still
  // counts, a run of equal jumps (a low frame rate screen recording, a scroll) doesn't.
  if (score >= cutRatio * Math.min(before, after) && score >= 1.5 * Math.max(before, after)) cuts.push({ t: round(t, 3), score: round(score, 3) });
}
const edges = [from, ...cuts.map((cut) => cut.t), to];
const allShots = edges.slice(1).map((end, i) => end - edges[i]);
// A shot cut off by --from or --to isn't its real length: leave it out when there are others.
const dropFirst = from > frame && allShots.length > 2;
const dropLast = to < duration - frame && allShots.length > 2;
const shots = allShots.slice(dropFirst ? 1 : 0, dropLast ? -1 : undefined);
const shotMean = mean(shots);
const variation = shots.length > 1 ? Math.sqrt(mean(shots.map((s) => (s - shotMean) ** 2))) / shotMean : null;
const cutsBetween = (a, b) => cuts.filter((cut) => cut.t >= a && cut.t < b).length;
const perMinute = (a, b) => (b - a >= 5 ? round((cutsBetween(a, b) / (b - a)) * 60, 1) : null);
const earlyEnd = Math.min(30, to);
const shotsOut = {
  cuts: cuts.length,
  count: allShots.length,
  median_s: round(median(shots)),
  p10_s: round(percentile(shots, 0.1)),
  p90_s: round(percentile(shots, 0.9)),
  shortest_s: round(Math.min(...shots)),
  longest_s: round(Math.max(...shots)),
  cuts_per_min: {
    all: round((cuts.length / span) * 60, 1),
    first_30s: from < 30 ? perMinute(from, earlyEnd) : null,
    rest: to > 30 ? perMinute(Math.max(from, 30), to) : null,
  },
  variation: round(variation),
  metronomic: variation !== null && shots.length >= 4 && variation < 0.1,
  cut_times: cuts,
  how: `Scene score of every frame at 320 px wide (ffmpeg select=scene). A cut is one frame scoring ${cutScore} or more, at least ${cutRatio}x the frames within ${cutWindow} s on its quieter side and 1.5x those on the other. Shot lengths are the times between cuts${dropFirst || dropLast ? '; the shots cut off by --from/--to are left out of the lengths' : ''}. variation = standard deviation / mean of shot length; under 0.1 with 4+ shots is metronomic.`,
};

// ----- sound: 10 ms levels from mono 16 kHz PCM -----
const WINDOW = 0.01;
let levels = null; // mean square per 10 ms window
if (hasSound) {
  const pcm = run('ffmpeg', [...seek, '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { binary: true });
  if (pcm.status !== 0 || !pcm.stdout?.length) fail(`ffmpeg couldn't read the sound: ${String(pcm.stderr).trim().split('\n').pop()}`);
  const samples = new Int16Array(pcm.stdout.buffer, pcm.stdout.byteOffset, Math.floor(pcm.stdout.length / 2));
  const per = 160;
  levels = new Float64Array(Math.floor(samples.length / per));
  for (let w = 0; w < levels.length; w += 1) {
    let sum = 0;
    for (let i = w * per; i < (w + 1) * per; i += 1) sum += (samples[i] / 32768) ** 2;
    levels[w] = sum / per;
  }
}
// Mean power between two times (seconds in the video), or null when the stretch is empty.
const power = (a, b) => {
  const start = Math.max(0, Math.round((a - from) / WINDOW));
  const end = Math.min(levels.length, Math.round((b - from) / WINDOW));
  if (end <= start) return null;
  let sum = 0;
  for (let i = start; i < end; i += 1) sum += levels[i];
  return sum / (end - start);
};
let speechDb = null;
let floorDb = null;
if (levels) {
  const sorted = Float64Array.from(levels).sort();
  const loud = db(sorted[Math.floor(sorted.length * 0.95)]);
  floorDb = db(sorted[Math.floor(sorted.length * 0.05)]);
  speechDb = options['speech-db'] === undefined ? loud - 30 : number('speech-db', -50, () => true);
}
const speechPower = speechDb === null ? null : 10 ** (speechDb / 10);
// The first time the level stays above the threshold for 30 ms, searching from a time.
const firstSoundAfter = (t, limit) => {
  const end = Math.min(levels.length - 2, Math.round((limit - from) / WINDOW));
  for (let i = Math.max(0, Math.round((t - from) / WINDOW)); i < end; i += 1) {
    if (levels[i] >= speechPower && levels[i + 1] >= speechPower && levels[i + 2] >= speechPower) return from + i * WINDOW;
  }
  return null;
};
const lastSoundBefore = (t, limit) => {
  const start = Math.max(2, Math.round((limit - from) / WINDOW));
  for (let i = Math.min(levels.length - 1, Math.round((t - from) / WINDOW) - 1); i >= start; i -= 1) {
    if (levels[i] >= speechPower && levels[i - 1] >= speechPower && levels[i - 2] >= speechPower) return from + (i + 1) * WINDOW;
  }
  return null;
};

const opening = {
  first_sound_s: levels && from < frame ? round(firstSoundAfter(from, to)) : null,
  first_cut_s: from < frame && cuts.length ? cuts[0].t : null,
  how: from < frame
    ? `first_sound_s: the first time the level stays at ${round(speechDb, 1)} dBFS or more for 30 ms (voice, music or anything as loud). first_cut_s: the first detected cut.`
    : 'Not measured: the range does not start at 0.',
};

let loudness = null;
if (hasSound) {
  const ebu = run('ffmpeg', [...seek, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = String(ebu.stderr).split('Summary:').pop();
  const pick = (pattern) => {
    const match = summary.match(pattern);
    return match ? Number(match[1]) : null;
  };
  loudness = {
    integrated_lufs: pick(/I:\s*(-?[\d.]+) LUFS/),
    true_peak_dbtp: pick(/Peak:\s*(-?[\d.]+) dBFS/),
    lra_lu: pick(/LRA:\s*(-?[\d.]+) LU/),
    how: 'ffmpeg ebur128=peak=true over the range (EBU R128): integrated loudness, true peak, loudness range.',
  };
}

// ----- with words: pauses, joins, the bed, picture change at pauses -----
let pauses = null;
let joins = null;
let bed = null;
let pictureAtPauses = null;
if (words) {
  const PAUSE = 0.15; // shorter gaps are how the transcriber splits words, not pauses
  const gaps = words.slice(1).map((word, i) => ({ start: words[i].end, end: word.start, length: Math.max(0, word.start - words[i].end), before: words[i].text, after: word.text }));
  const real = gaps.filter((gap) => gap.length >= PAUSE);
  const lengths = real.map((gap) => gap.length);
  const longest = real.reduce((a, b) => (b.length > (a?.length ?? 0) ? b : a), null);
  const silent = real.filter((gap) => gap.length >= 0.25).reduce((sum, gap) => sum + gap.length, 0);
  const speaking = words.at(-1).end - words[0].start - silent;
  pauses = {
    count: real.length,
    median_s: round(median(lengths)),
    p90_s: round(percentile(lengths, 0.9)),
    share_over_half_s: real.length ? round(real.filter((gap) => gap.length > 0.5).length / real.length) : null,
    longest_s: longest ? round(longest.length) : null,
    longest_at_s: longest ? round(longest.start) : null,
    words_per_second_speaking: round(words.length / speaking),
    how: `Gaps between one word's end and the next word's start, from the words file; a pause is a gap of ${PAUSE} s or more (${real.length} of ${gaps.length} gaps). Words a second = words / (time from first to last word minus pauses of 0.25 s or more). Only as exact as the word timings: check a few against the sound.`,
  };

  // Joins: a cut that falls in a pause. The pause is split at the cut.
  const tolerance = frame;
  const list = [];
  let underSpeech = 0;
  for (const cut of cuts) {
    const gap = gaps.find((g) => g.start - tolerance <= cut.t && cut.t <= g.end + tolerance && g.length >= PAUSE);
    if (!gap) {
      underSpeech += 1;
      continue;
    }
    const join = { cut_s: cut.t, after_outgoing_s: round(Math.max(0, cut.t - gap.start)), before_incoming_s: round(Math.max(0, gap.end - cut.t)), outgoing: gap.before, incoming: gap.after };
    if (levels) {
      const lastSound = lastSoundBefore(cut.t, cut.t - 2);
      const nextSound = firstSoundAfter(cut.t, cut.t + 2);
      join.by_sound = { after_outgoing_s: lastSound === null ? null : round(cut.t - lastSound), before_incoming_s: nextSound === null ? null : round(nextSound - cut.t) };
    }
    list.push(join);
  }
  const bySound = (key) => round(median(list.map((join) => join.by_sound?.[key]).filter((value) => typeof value === 'number')));
  joins = {
    count: list.length,
    cuts_under_speech: underSpeech,
    after_outgoing_median_s: round(median(list.map((join) => join.after_outgoing_s))),
    before_incoming_median_s: round(median(list.map((join) => join.before_incoming_s))),
    by_sound: levels ? { after_outgoing_median_s: bySound('after_outgoing_s'), before_incoming_median_s: bySound('before_incoming_s') } : null,
    list,
    how: `A join is a detected cut inside a pause of ${PAUSE} s or more. after_outgoing = cut time minus the end of the last word before it; before_incoming = start of the next word minus the cut time. by_sound measures the same two from the sound itself (last and first 30 ms at ${round(speechDb, 1)} dBFS or more within 2 s of the cut); trust it over the words when there is no music, ignore it when there is. cuts_under_speech are picture changes while the voice carries on (B-roll, a screen, a punch-in). Joins made in the sound only, with no picture change, are not seen.`,
  };

  // Bed: the level in the pauses against the level during words.
  if (levels) {
    // The quietest 0.1 s of each pause: word timings often end early, so a pause's edges hold
    // the tail of a word, and a breath sits in the middle of many.
    const quietest = (gap) => {
      const start = Math.max(0, Math.round((gap.start - from) / WINDOW));
      const end = Math.min(levels.length, Math.round((gap.end - from) / WINDOW));
      let best = null;
      for (let i = start; i + 10 <= end; i += 1) {
        let sum = 0;
        for (let j = i; j < i + 10; j += 1) sum += levels[j];
        if (best === null || sum / 10 < best) best = sum / 10;
      }
      return best;
    };
    const quiet = gaps.filter((gap) => gap.length >= 0.4).map(quietest).filter((value) => value !== null);
    let voiceSum = 0;
    let voiceTime = 0;
    for (const word of words) {
      const p = power(word.start, word.end);
      if (p !== null) {
        voiceSum += p * (word.end - word.start);
        voiceTime += word.end - word.start;
      }
    }
    const NO_BED = 30; // dB under the voice: quieter than this is taken as room tone
    const voiceDb = voiceTime ? db(voiceSum / voiceTime) : null;
    const gapDb = quiet.length ? median(quiet.map(db)) : null;
    const under = voiceDb !== null && gapDb !== null ? voiceDb - gapDb : null;
    const spread = quiet.length > 1 ? percentile(quiet.map(db), 0.9) - percentile(quiet.map(db), 0.1) : null;
    bed = {
      voice_db: round(voiceDb, 1),
      pause_db: round(gapDb, 1),
      db_under_voice: round(under, 1),
      floor_db: round(floorDb, 1),
      pauses_used: quiet.length,
      kind: under === null ? 'unknown' : under >= NO_BED ? 'none' : 'bed',
      says: under === null
        ? 'No pause of 0.4 s or more to measure in.'
        : under >= NO_BED
          ? `The pauses are ${round(under, 0)} dB under the voice: room tone, no music bed.`
          : `Something sits about ${round(under, 0)} dB under the voice in the pauses: a music bed, or room tone and breaths that loud.`,
      confidence: quiet.length < 5 ? 'low: fewer than 5 pauses to measure in' : under >= NO_BED ? 'medium: a very quiet bed would read the same; listen to one pause' : spread > 12 ? `low: the pauses differ by ${round(spread, 0)} dB from one to another (music that swells, breaths, or sound effects)` : 'medium: music and room tone cannot be told apart by level; listen to one pause to know which it is',
      how: 'RMS level (mono, 10 ms windows) of the quietest 0.1 s inside each pause of 0.4 s or more, median across pauses, against the RMS level during words. 30 dB or more under the voice is taken as no bed (this script\'s own line). floor_db is the level the quietest 5% of the whole range sits at.',
    };
  }

  const near = 3 * frame;
  const wide = gaps.filter((gap) => gap.length >= 0.25);
  const carried = wide.filter((gap) => cuts.some((cut) => cut.t >= gap.start - near && cut.t <= gap.end + near)).length;
  pictureAtPauses = {
    pauses: wide.length,
    with_cut: carried,
    share: wide.length ? round(carried / wide.length) : null,
    how: 'Of the pauses of 0.25 s or more, the share with a detected cut inside them or within 3 frames. Low on a cut made by removing takes means most pauses are natural ones, or joins hidden under a screen or B-roll.',
  };
}

// ----- contact sheets -----
let sheet = null;
if (options.sheet) {
  const dir = resolve(options.sheet);
  mkdirSync(dir, { recursive: true });
  const columns = 6;
  const rows = 8;
  const pattern = join(dir, 'sheet-%03d.jpg');
  // The first frame at or after each step, so the printed time is the frame's own.
  const tiles = `select='gte(t,${sheetStep}*selected_n)',scale=320:-2`;
  const stamp = `,drawtext=text='%{pts\\:hms\\:${from}}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6`;
  const make = (filter) => run('ffmpeg', ['-y', ...seek, '-an', '-vf', `${filter},tile=${columns}x${rows}`, '-fps_mode', 'passthrough', '-q:v', '4', pattern]);
  let stamped = true;
  let made = make(tiles + stamp);
  if (made.status !== 0) {
    stamped = false; // this ffmpeg has no drawtext (or no font): sheets without the time printed
    made = make(tiles);
  }
  if (made.status !== 0) fail(`ffmpeg couldn't write contact sheets to ${dir}: ${String(made.stderr).trim().split('\n').pop()}`);
  const made_files = readdirSync(dir).filter((name) => /^sheet-\d{3}\.jpg$/.test(name)).sort().slice(0, Math.ceil(Math.ceil(span / sheetStep) / (columns * rows)));
  sheet = {
    dir,
    files: made_files.map((name, i) => ({ file: join(dir, name), first_frame_s: round(from + i * columns * rows * sheetStep) })),
    step_s: sheetStep,
    columns,
    rows,
    time_printed: stamped,
    read: `Left to right, top to bottom, one frame every ${sheetStep} s: the frame in row r, column c (from 0) is at first_frame_s + (r x ${columns} + c) x ${sheetStep}.`,
  };
}

const style = {
  video,
  measured: new Date().toISOString().slice(0, 10),
  range: { from_s: round(from), to_s: round(to), seconds: round(span), whole_video: from < frame && to > duration - frame },
  fps: round(fps, 3),
  size: `${picture.width}x${picture.height}`,
  shots: shotsOut,
  opening,
  loudness,
  pauses,
  joins,
  bed,
  picture_change_at_pauses: pictureAtPauses,
  sheet,
  look_at: [
    'Caption look: font, size, colour, how many words at a time, where they sit, how they come in',
    'Text placement: on a plate, behind the speaker, over the screen; how big; one piece at a time or several',
    'B-roll and screens: how often, how long each stays, full frame or beside the speaker, how it is framed',
    'Punch-ins: how the speaker\'s size changes across a cut, and how far',
    'Colour and grade; what the first and the last frame are',
    'Transitions that are not hard cuts (dissolves, wipes, slides)',
  ],
  cannot_measure: [
    'Dissolves and other soft transitions: only hard cuts are detected',
    'A cut from a page that jumps in one frame (a scroll step, a click that swaps the screen): both score the same, so check screen-recording cuts on a sheet',
    'Joins made in the sound only, under a screen or B-roll that does not change',
    'What was removed to make this video: that needs the raw recording or a timeline file',
    'Music apart from room tone and breaths: the level in the pauses is all of them together',
    'Sound effects and whether they land on cuts: listen, or read a spectrogram',
    'Why a cut is where it is',
    ...(words ? [] : ['Pauses, joins, the music level and picture change at pauses: pass --words to measure them']),
    ...(hasSound ? [] : ['Anything about sound: this file has none']),
  ],
};
const out = resolve(options.out ?? 'style.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(style, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  out,
  seconds: style.range.seconds,
  cuts: shotsOut.cuts,
  shot_median_s: shotsOut.median_s,
  shot_p10_s: shotsOut.p10_s,
  shot_p90_s: shotsOut.p90_s,
  longest_s: shotsOut.longest_s,
  cuts_per_min: shotsOut.cuts_per_min,
  metronomic: shotsOut.metronomic,
  first_sound_s: opening.first_sound_s,
  first_cut_s: opening.first_cut_s,
  lufs: loudness?.integrated_lufs ?? null,
  true_peak_dbtp: loudness?.true_peak_dbtp ?? null,
  pause_median_s: pauses?.median_s ?? null,
  join_after_s: joins?.after_outgoing_median_s ?? null,
  join_before_s: joins?.before_incoming_median_s ?? null,
  joins: joins?.count ?? null,
  bed_db_under_voice: bed?.db_under_voice ?? null,
  bed: bed?.kind ?? null,
  sheets: sheet?.files.length ?? 0,
}));
