#!/usr/bin/env node
// Finds the silences in a recording, with the threshold taken from the recording's own level.
// Needs Node 22 or later and ffmpeg. Nothing to install.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const HELP = `Finds the silences in a recording, with the threshold taken from the recording's own level.

  node silences.mjs <media> [options]

  --from <s>       measure from this time (0)
  --to <s>         measure up to this time (the end)
  --min <s>        the shortest silence to report (0.3)
  --merge <s>      silences closer together than this become one (0.1): a click between two
                   halves of a pause doesn't split it
  --noise <dB>     use this threshold instead of the measured one, such as -38
  --json <file>    where the result goes (silences.json)
  --still          also say whether the PICTURE holds still during each silence: adds
                   "still" (true when the picture is frozen for 60% of it or more),
                   "still_share" (0 to 1) and "still_ranges" (the frozen parts, [start, end]).
                   A pause where the screen or the person is doing something isn't dead air.
  --words <file>   a transcript ({"words":[{"text","start","end"}]}) whose word edges get moved
                   onto the real pauses: an end that falls within --snap of where a silence
                   starts moves to it, a start within --snap of where a silence ends moves to
                   it. No edge moves across another word. Pauses down to 0.15 s are used.
  --out <file>     where the moved transcript goes (words.snapped.json); needs --words
  --snap <s>       how far a word edge may move (0.12)

The threshold is the gate level ffmpeg's loudness measurement reports for the file
(loudnorm's input_thresh), kept between -60 and -25 dB. When that can't be read, or the range
holds almost no sound (under -50 LUFS overall), it is -35 dB and the result says so. Measure
the whole file or a range with speech in it: the level comes from what is in the range. Times in the result are in the media's own seconds, also with --from.

The result file:
  {"threshold_db", "threshold_from": "measured|fallback|given", "measured": {input_i, input_tp,
   input_lra, input_thresh}, "from", "to", "silences": [{"start","end","dur"}],
   "leading": seconds of silence at the start of the range, "trailing": the same at its end}
One line of JSON on stdout sums it up. Set FFMPEG=/path/to/ffmpeg to choose one.`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}
const FLAGS = ['still'];
const VALUES = ['from', 'to', 'min', 'merge', 'noise', 'json', 'words', 'out', 'snap'];
const options = {};
let media;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg.startsWith('--')) {
    if (media) fail(`One media file at a time: got ${media} and ${arg}.`);
    media = arg;
    continue;
  }
  const name = arg.slice(2);
  if (FLAGS.includes(name)) options[name] = true;
  else if (VALUES.includes(name)) {
    if (args[i + 1] === undefined) fail(`--${name} needs a value. Run with --help for the options.`);
    options[name] = args[++i];
  } else fail(`Unknown option ${arg}. Run with --help for the options.`);
}
if (!media) fail('Usage: node silences.mjs <media> [--from 0] [--to 90] [--still] [--words words.json]\nRun with --help for the rest.');
if (!existsSync(media)) fail(`No media file at ${media}.`);

const number = (name, fallback, test, hint) => {
  if (options[name] === undefined) return fallback;
  const value = Number(options[name]);
  if (!Number.isFinite(value) || !test(value)) fail(`--${name} takes ${hint}.`);
  return value;
};
const from = number('from', 0, (v) => v >= 0, 'a time in seconds, 0 or later');
const toGiven = number('to', null, (v) => v > from, 'a time in seconds after --from');
const min = number('min', 0.3, (v) => v > 0, 'a length in seconds above 0, such as 0.3');
const mergeGap = number('merge', 0.1, (v) => v >= 0, 'a gap in seconds, 0 or more');
const snap = number('snap', 0.12, (v) => v >= 0, 'a distance in seconds, 0 or more');
const noise = number('noise', null, (v) => v < 0, 'a level in dB below 0, such as -38');
if (options.out && !options.words) fail('--out is where the moved transcript goes: give the transcript with --words.');

const SNAP_MIN = 0.15; // the shortest pause a word edge is moved onto
const QUIET = -50; // LUFS: a range quieter than this overall has no speech to take a level from
const STILL_SHARE = 0.6; // a silence counts as still when the picture is frozen for this much of it
const round = (value, places = 3) => Number(value.toFixed(places));

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
function run(parameters) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...parameters], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  if (result.error?.code === 'ENOENT') {
    fail(`ffmpeg wasn't found${process.env.FFMPEG ? ` at FFMPEG=${process.env.FFMPEG}` : ''}. Install ffmpeg, or set FFMPEG to the path of one that is installed.`);
  }
  if (result.error) fail(`ffmpeg couldn't run: ${result.error.message}`);
  return result;
}

// What the file is: its length, and whether it has sound and a picture.
const probe = run(['-i', media]).stderr;
const length = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(probe);
if (!length && !/Stream #/.test(probe)) fail(`ffmpeg can't read ${media}: it isn't a media file it knows.`);
const duration = length ? Number(length[1]) * 3600 + Number(length[2]) * 60 + Number(length[3]) : null;
if (!/Stream #.*Audio:/.test(probe)) {
  fail(`${media} has no sound, so there is no silence to find. Give the file that carries the audio.`);
}
const hasPicture = /Stream #.*Video:(?!.*attached pic)/.test(probe);
if (options.still && !hasPicture) fail(`--still needs a picture and ${media} has only sound. Run it without --still.`);
if (duration !== null && from >= duration) fail(`--from ${from} is past the end of the file (${round(duration)} s).`);
const to = toGiven === null ? duration : duration === null ? toGiven : Math.min(toGiven, duration);
if (to === null) fail(`The length of ${media} can't be read. Give the range with --to <seconds>.`);
const span = to - from;
const range = ['-ss', String(from), '-t', String(span), '-i', media];

// 1. Measure the recording.
let measured = null;
{
  const result = run([...range, '-map', '0:a:0', '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const block = /\{[^{}]*"input_thresh"[^{}]*\}/.exec(result.stderr);
  if (block) {
    try {
      const data = JSON.parse(block[0]);
      measured = Object.fromEntries(
        ['input_i', 'input_tp', 'input_lra', 'input_thresh'].map((key) => {
          const value = Number(data[key]);
          return [key, Number.isFinite(value) ? value : null];
        }),
      );
    } catch {
      measured = null;
    }
  } else if (result.status !== 0) {
    fail(`ffmpeg couldn't read the sound of ${media}: ${result.stderr.trim().split('\n').pop()}`);
  }
}
let threshold;
let thresholdFrom;
let note = null;
if (noise !== null) {
  threshold = noise;
  thresholdFrom = 'given';
} else if (measured && measured.input_i !== null && measured.input_i < QUIET) {
  // Nothing at speaking level in the range: its own gate would sit on the noise floor.
  threshold = -35;
  thresholdFrom = 'fallback';
  note = `the range holds almost no sound (${measured.input_i} LUFS), so -35 dB is used: measure a range with speech in it`;
} else if (measured && measured.input_thresh !== null && measured.input_i !== null) {
  threshold = Math.min(-25, Math.max(-60, measured.input_thresh));
  thresholdFrom = 'measured';
  if (threshold !== measured.input_thresh) note = `measured ${measured.input_thresh} dB, kept within -60 to -25`;
} else {
  threshold = -35;
  thresholdFrom = 'fallback';
  note = 'the level could not be measured (the range may be all silence): -35 dB used';
}
threshold = round(threshold, 2);

// 2. Find the silences. With --words, shorter pauses are found too, for the word edges only.
const detectMin = options.words ? Math.min(min, SNAP_MIN) : min;
const found = [];
{
  const result = run([...range, '-map', '0:a:0', '-vn', '-af', `silencedetect=noise=${threshold}dB:d=${detectMin}`, '-f', 'null', '-']);
  if (result.status !== 0) fail(`ffmpeg couldn't look for silence in ${media}: ${result.stderr.trim().split('\n').pop()}`);
  let open = null;
  for (const match of result.stderr.matchAll(/silence_(start|end): (-?[\d.]+(?:e[-+]?\d+)?)/g)) {
    const at = Math.min(to, Math.max(from, from + Number(match[2])));
    if (match[1] === 'start') open = at;
    else if (open !== null) {
      found.push({ start: open, end: at });
      open = null;
    }
  }
  if (open !== null) found.push({ start: open, end: to }); // still silent where the range ends
}
const fine = found.filter((silence) => silence.end - silence.start >= detectMin - 0.001);
const silences = [];
for (const silence of fine.filter((one) => one.end - one.start >= min - 0.001)) {
  const last = silences.at(-1);
  if (last && silence.start - last.end < mergeGap) last.end = silence.end;
  else silences.push({ ...silence });
}

// 3. Is the picture still during each one?
if (options.still && silences.length) {
  const result = run([...range, '-map', '0:v:0', '-an', '-vf', `freezedetect=n=-50dB:d=${min}`, '-f', 'null', '-']);
  if (result.status !== 0) fail(`ffmpeg couldn't read the picture of ${media}: ${result.stderr.trim().split('\n').pop()}`);
  const frozen = [];
  let open = null;
  for (const match of result.stderr.matchAll(/freeze_(start|end): (-?[\d.]+(?:e[-+]?\d+)?)/g)) {
    const at = Math.min(to, Math.max(from, from + Number(match[2])));
    if (match[1] === 'start') open = at;
    else if (open !== null) {
      frozen.push([open, at]);
      open = null;
    }
  }
  if (open !== null) frozen.push([open, to]);
  for (const silence of silences) {
    let covered = 0;
    silence.still_ranges = [];
    for (const [start, end] of frozen) {
      const piece = [Math.max(start, silence.start), Math.min(end, silence.end)];
      if (piece[1] <= piece[0]) continue;
      covered += piece[1] - piece[0];
      const last = silence.still_ranges.at(-1);
      if (last && piece[0] - last[1] < 0.05) last[1] = round(piece[1]);
      else silence.still_ranges.push(piece.map((time) => round(time)));
    }
    const share = Math.min(1, covered / (silence.end - silence.start));
    silence.still_share = round(share, 2);
    silence.still = share >= STILL_SHARE;
  }
}

const EDGE = 0.05; // a silence this close to the start or end of the range touches it
const leading = silences.length && silences[0].start - from <= EDGE ? silences[0].end - silences[0].start : 0;
const trailing = silences.length && to - silences.at(-1).end <= EDGE ? silences.at(-1).end - silences.at(-1).start : 0;

const output = {
  source: media,
  threshold_db: threshold,
  threshold_from: thresholdFrom,
  ...(note ? { note } : {}),
  measured,
  from: round(from),
  to: round(to),
  silences: silences.map((silence) => ({
    start: round(silence.start),
    end: round(silence.end),
    dur: round(silence.end - silence.start),
    ...(options.still ? { still: silence.still, still_share: silence.still_share, still_ranges: silence.still_ranges } : {}),
  })),
  leading: round(leading),
  trailing: round(trailing),
};
const jsonFile = resolve(options.json ?? 'silences.json');
mkdirSync(dirname(jsonFile), { recursive: true });
writeFileSync(jsonFile, `${JSON.stringify(output, null, 1)}\n`);

// 4. Move word edges onto the real pauses.
let snapped = null;
if (options.words) {
  if (!existsSync(options.words)) fail(`No transcript at ${options.words}.`);
  let transcript;
  try {
    transcript = JSON.parse(readFileSync(options.words, 'utf8'));
  } catch (error) {
    fail(`${options.words} isn't JSON: ${error.message}`);
  }
  const words = transcript?.words;
  if (!Array.isArray(words) || words.some((word) => !(word?.start >= 0) || !(word?.end >= word.start))) {
    fail(`${options.words} must be {"words":[{"text","start","end"}, ...]} with times in seconds.`);
  }
  if (words.some((word, i) => i > 0 && word.start < words[i - 1].start)) {
    fail(`${options.words} has words out of order. Sort them by start time first.`);
  }
  const next = words.map((word) => ({ ...word }));
  const nearest = (time, key) => {
    let best = null;
    for (const silence of fine) {
      const distance = Math.abs(silence[key] - time);
      if (distance <= snap && (best === null || distance < Math.abs(best - time))) best = silence[key];
    }
    return best;
  };
  // Starts first, then ends, so a pair of words that touch can part around the pause between
  // them. Twice, because a move that was blocked can fit once its neighbour has moved.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < next.length; i++) {
      if (next[i].start !== words[i].start) continue;
      const target = nearest(words[i].start, 'end');
      if (target === null || target === next[i].start) continue;
      if (target >= next[i].end || (i > 0 && target < next[i - 1].end)) continue;
      next[i].start = round(target);
    }
    for (let i = 0; i < next.length; i++) {
      if (next[i].end !== words[i].end) continue;
      const target = nearest(words[i].end, 'start');
      if (target === null || target === next[i].end) continue;
      if (target <= next[i].start || (i + 1 < next.length && target > next[i + 1].start)) continue;
      next[i].end = round(target);
    }
  }
  const shifts = [];
  let inRange = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i].end >= from && words[i].start <= to) inRange += 2;
    for (const key of ['start', 'end']) {
      if (next[i][key] !== words[i][key]) shifts.push(Math.abs(next[i][key] - words[i][key]));
    }
  }
  shifts.sort((a, b) => a - b);
  const middle = shifts.length >> 1;
  const median = !shifts.length ? 0 : shifts.length % 2 ? shifts[middle] : (shifts[middle - 1] + shifts[middle]) / 2;
  const outFile = resolve(options.out ?? 'words.snapped.json');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify({ ...transcript, words: next })}\n`);
  snapped = { edges_moved: shifts.length, edges_in_range: inRange, median_shift_ms: Math.round(median * 1000), words: outFile };
  console.error(`Moved ${shifts.length} of ${inRange} word edges in the range onto pauses, median ${snapped.median_shift_ms} ms. Wrote ${outFile}.`);
}

const silent = silences.reduce((sum, silence) => sum + silence.end - silence.start, 0);
console.error(
  `Threshold ${threshold} dB (${thresholdFrom}${note ? `: ${note}` : ''}). ${silences.length} silences of ${min} s or more, ` +
    `${round(silent, 1)} s of ${round(span, 1)} s. Wrote ${jsonFile}.`,
);
console.log(
  JSON.stringify({
    threshold_db: threshold,
    threshold_from: thresholdFrom,
    count: silences.length,
    silent_s: round(silent, 2),
    share: round(span > 0 ? silent / span : 0, 3),
    leading: round(leading),
    trailing: round(trailing),
    ...(options.still ? { still: silences.filter((silence) => silence.still).length } : {}),
    ...(snapped ?? {}),
    file: jsonFile,
  }),
);
