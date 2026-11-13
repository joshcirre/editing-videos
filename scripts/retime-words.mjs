#!/usr/bin/env node
// Moves a transcript's word times from the source clock onto the clock of a cut, and back.
// Needs Node 22 or later. Nothing to install; it only does arithmetic on JSON.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HELP = `Moves a transcript's word times onto the clock of a cut, so captions, titles and graphics
are timed from the video as it is now and not from the recording it was cut from.

  node retime-words.mjs --words words.source.json --cut cut.json --out words.cut.json [options]
  node retime-words.mjs --time <seconds> --via words.cut.json [--to-source]
  node retime-words.mjs --pack words.json [--gap 0.5] [--out phrases.txt]

Retime
  --words <file>   {"words":[{"text":"Hi","start":0.0,"end":0.36}, ...],"duration":848.4}
                   on the source clock. Always start from the source words, not a retimed file.
  --cut <file>     {"source":"clip.mp4","fps":30,"keep":[{"start":1.2,"end":14.866667}, ...]}
                   the ranges of the source that stay, in order, in source seconds.
  --out <file>     where the retimed transcript goes. Name it for its clock: words.cut.json,
                   or words.final.json when there are inserts or speed changes.
  --speed "start=<s>,end=<s>,rate=<n>"   a stretch of the source that plays n times faster
                   (repeatable). Its words are dropped and its time is divided by n.
  --insert "at=<s>,len=<s>[,name=<text>]"   added time such as a splash or a cold open
                   (repeatable). "at" is on the clock after the cut and the speed changes and
                   before any insert, so inserts don't move each other. Later words shift by len.
  --tolerance <s>  how far a word may reach past a range edge and still count as inside
                   (half a frame: the most that snapping a range to the frame grid moves it)
  --allow-clipped  write the file and exit 0 even when a cut runs through a word
  --clock <name>   the clock written into the file ("cut", or "final" with --insert or --speed)

  Keep ranges, speed ranges and inserts are snapped to whole frames of the cut's fps first, and
  every output time is worked out from the snapped ranges, so word times agree with the frames an
  editor cuts. A word wholly inside a kept range gets new times. A word wholly removed is dropped.
  A word a range edge runs through is kept with clamped times and "clipped": true; that exits 1,
  and nothing is written, unless --allow-clipped. Each kept word also carries "src", its start on
  the source clock. The file ends with "map": [{"out":0,"src":1.2,"len":13.666667}, ...], one
  entry per stretch of the output ("len" is on the output clock; a sped stretch has "rate", an
  insert has "src": null and "insert": its name).

  Prints one line: {"words_in","words_out","clipped":[source times],"duration_in",
  "duration_out","frames_out",...}. The clipped words are listed on stderr with both clocks.

One time
  --time <seconds> --via <retimed file>   a source time on the output clock
  --to-source                             an output time back on the source clock
  Exits 1 when that moment was cut out (or is inside an insert) and names the nearest one kept.

Packed view
  --pack <file>    prints one phrase a line, "[12.30–15.84] the words of the phrase", broken at
                   pauses of --gap seconds or more (0.5) and at sentence ends. A fraction of the
                   size of the JSON: read this, and open the JSON only where a cut or graphic lands.`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

const VALUE = ['words', 'cut', 'out', 'speed', 'insert', 'tolerance', 'clock', 'time', 'via', 'pack', 'gap'];
const FLAG = ['allow-clipped', 'to-source'];
const given = {};
for (let i = 0; i < args.length; i++) {
  const name = args[i].startsWith('--') ? args[i].slice(2) : null;
  if (FLAG.includes(name)) {
    given[name] = [true];
  } else if (VALUE.includes(name)) {
    if (args[i + 1] === undefined) fail(`--${name} needs a value. Run with --help to see it.`);
    (given[name] ??= []).push(args[++i]);
  } else {
    fail(`Unknown option ${args[i]}. Run with --help for the list.`);
  }
}
const one = (name) => given[name]?.at(-1);
const every = (name) => given[name] ?? [];

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const EPS = 1e-6;

function readJson(file, what) {
  if (!existsSync(file)) fail(`No ${what} at ${resolve(file)}.`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${file} isn't JSON: ${error.message}`);
  }
}

function readWords(file) {
  const data = readJson(file, 'transcript');
  const ok = (word) => typeof word?.text === 'string' && Number.isFinite(word.start) && Number.isFinite(word.end) && word.end >= word.start;
  if (!Array.isArray(data?.words) || !data.words.every(ok)) {
    fail(`${file} must be {"words":[{"text":"Hi","start":0.0,"end":0.36}, ...],"duration":848.4} with times in seconds.`);
  }
  return data;
}

// "at=12.5,len=3,name=cold open" -> { at: '12.5', len: '3', name: 'cold open' }
function pairs(text, option, example) {
  const result = {};
  for (const part of String(text).split(',')) {
    const at = part.indexOf('=');
    if (at < 1) fail(`--${option} takes ${example}; got "${text}".`);
    result[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return result;
}

if (one('pack') !== undefined) pack();
else if (one('time') !== undefined) convert();
else retime();

function pack() {
  const data = readWords(one('pack'));
  const gap = Number(one('gap') ?? 0.5);
  if (!(gap > 0)) fail('--gap takes a pause length in seconds above 0, such as 0.5.');
  const phrases = [];
  let current = null;
  for (const word of data.words) {
    if (current && (word.start - current.end >= gap - EPS || current.closed)) {
      phrases.push(current);
      current = null;
    }
    current ??= { start: word.start, end: word.end, text: [], closed: false };
    current.text.push(word.text.trim());
    current.end = word.end;
    current.closed = /[.!?]["')\]]?$/.test(word.text.trim());
  }
  if (current) phrases.push(current);
  const lines = phrases.map((phrase) => `[${phrase.start.toFixed(2)}–${phrase.end.toFixed(2)}] ${phrase.text.join(' ')}`);
  const out = one('out');
  if (out) {
    writeFileSync(out, `${lines.join('\n')}\n`);
    console.log(JSON.stringify({ out: resolve(out), phrases: phrases.length, words: data.words.length, clock: data.clock ?? null }));
  } else {
    console.log(lines.join('\n'));
  }
}

function convert() {
  const time = Number(one('time'));
  const via = one('via');
  if (!Number.isFinite(time) || time < 0) fail('--time takes a time in seconds, such as 83.4.');
  if (!via) fail('--time needs --via <a file this script wrote>, such as --via words.cut.json.');
  const data = readJson(via, 'retimed transcript');
  const map = data?.map;
  if (!Array.isArray(map) || !map.length || !(data.fps > 0)) {
    fail(`${via} has no "map": it isn't a file this script wrote. Make one with --words, --cut and --out.`);
  }
  const clock = data.clock ?? 'cut';
  const toSource = Boolean(one('to-source'));
  const total = map.at(-1).out + map.at(-1).len;
  const real = map.filter((piece) => piece.src !== null);
  const srcEnd = (piece) => piece.src + piece.len * (piece.rate ?? 1);
  const answer = (fields) => {
    console.log(JSON.stringify({ time, from: toSource ? clock : 'source', to: toSource ? 'source' : clock, ...fields }));
    process.exit(fields.result === null ? 1 : 0);
  };
  if (toSource) {
    if (time > total + EPS) fail(`${time} s is past the end of ${via} (${round6(total)} s).`);
    // The very end belongs to the last stretch; every other time to the stretch that starts at or before it.
    const piece = map.findLast((p) => time >= p.out - EPS && time < p.out + p.len - EPS) ?? map.at(-1);
    if (piece.src === null) {
      const next = map[map.indexOf(piece) + 1];
      console.error(`${time} s is inside the insert "${piece.insert}" (${piece.out}–${round6(piece.out + piece.len)} s): there is no source time for it.`);
      answer({ result: null, insert: piece.insert, nearest: next?.src ?? null });
    }
    const result = round6(piece.src + (time - piece.out) * (piece.rate ?? 1));
    answer({ result, frame: Math.floor(time * data.fps + 1e-4), ...(piece.rate ? { rate: piece.rate } : {}) });
  }
  const last = real.at(-1);
  const piece = real.find((p) => time >= p.src - EPS && time < srcEnd(p) - EPS)
    ?? (Math.abs(time - srcEnd(last)) <= EPS ? last : null);
  if (!piece) {
    const next = real.find((p) => p.src > time);
    const before = real.findLast((p) => srcEnd(p) <= time + EPS);
    const nearest = next ? next.out : round6(before.out + before.len);
    console.error(`${time} s of the source was cut out. The nearest moment that stayed is at ${nearest} s on the ${clock} clock.`);
    answer({ result: null, removed: true, nearest });
  }
  const result = round6(piece.out + (time - piece.src) / (piece.rate ?? 1));
  answer({ result, frame: Math.floor(result * data.fps + 1e-4), ...(piece.rate ? { rate: piece.rate } : {}) });
}

function retime() {
  const wordsFile = one('words');
  const cutFile = one('cut');
  const out = one('out');
  if (!wordsFile || !cutFile || !out) {
    fail('Usage: node retime-words.mjs --words words.source.json --cut cut.json --out words.cut.json\nRun with --help for the rest.');
  }
  const data = readWords(wordsFile);
  if (data.clock && data.clock !== 'source') {
    fail(`${wordsFile} is on the ${data.clock} clock. Retime from the source words (words.source.json), with every cut, speed change and insert in one run.`);
  }
  const cut = readJson(cutFile, 'keep list');
  const fps = Number(cut?.fps);
  const okRange = (range) => Number.isFinite(range?.start) && Number.isFinite(range?.end);
  if (!(fps > 0) || !Array.isArray(cut.keep) || !cut.keep.length || !cut.keep.every(okRange)) {
    fail(`${cutFile} must be {"source":"clip.mp4","fps":30,"keep":[{"start":1.2,"end":14.866667}, ...]} in source seconds.`);
  }
  const frame = (seconds) => Math.round(seconds * fps);
  const seconds = (frames) => round6(frames / fps);
  const tolerance = one('tolerance') === undefined ? 0.5 / fps : Number(one('tolerance'));
  if (!(tolerance >= 0)) fail('--tolerance takes seconds, 0 or more, such as 0.02.');

  const durationIn = Number.isFinite(data.duration) ? data.duration : (data.words.at(-1)?.end ?? 0);

  // 1. Keep ranges on the frame grid.
  const keeps = cut.keep.map((range, i) => {
    const s = frame(range.start);
    const e = frame(range.end);
    if (range.start < 0 || e <= s) fail(`${cutFile}: keep range ${i + 1} (${range.start}–${range.end}) is empty or backwards once snapped to ${fps} fps.`);
    return { s, e, note: range.note };
  });
  keeps.forEach((range, i) => {
    if (i && range.s < keeps[i - 1].e) {
      fail(`${cutFile}: keep range ${i + 1} starts at ${seconds(range.s)} s, before range ${i} ends (${seconds(keeps[i - 1].e)} s). Ranges go in order and don't overlap.`);
    }
  });
  if (durationIn > 0 && keeps.at(-1).e > frame(durationIn) + 1) {
    fail(`${cutFile}: the last keep range ends at ${seconds(keeps.at(-1).e)} s but ${wordsFile} is ${durationIn} s long. Is this the keep list for this recording?`);
  }

  // 2. Speed ranges on the frame grid.
  const speeds = every('speed').map((text) => {
    const { start, end, rate } = pairs(text, 'speed', '"start=<source s>,end=<source s>,rate=<n>"');
    const s = frame(Number(start));
    const e = frame(Number(end));
    if (!(Number(start) >= 0) || !(e > s) || !(Number(rate) > 0)) {
      fail(`--speed takes "start=<source s>,end=<source s>,rate=<n>" with end after start and rate above 0; got "${text}".`);
    }
    return { s, e, rate: Number(rate) };
  }).sort((a, b) => a.s - b.s);
  speeds.forEach((speed, i) => {
    if (i && speed.s < speeds[i - 1].e) fail(`Two --speed ranges overlap at ${seconds(speed.s)} s. Give each stretch of the source one rate.`);
  });

  // 3. Split each keep range where a speed range starts or ends. Lengths are whole frames.
  let pieces = [];
  for (const keep of keeps) {
    const edges = [keep.s, keep.e];
    for (const speed of speeds) for (const edge of [speed.s, speed.e]) if (edge > keep.s && edge < keep.e) edges.push(edge);
    edges.sort((a, b) => a - b);
    for (let i = 0; i + 1 < edges.length; i++) {
      const [s, e] = [edges[i], edges[i + 1]];
      if (e === s) continue;
      const speed = speeds.find((sp) => s >= sp.s && e <= sp.e);
      const len = speed ? Math.max(1, Math.round((e - s) / speed.rate)) : e - s;
      pieces.push({ s, e, len, sped: Boolean(speed) });
    }
  }
  for (const speed of speeds) {
    if (!pieces.some((piece) => piece.sped && piece.s >= speed.s && piece.e <= speed.e)) {
      fail(`--speed ${seconds(speed.s)}–${seconds(speed.e)} s is not inside any keep range: that stretch is already cut out.`);
    }
  }

  // 4. Inserts, placed on the clock after the cut and the speed changes.
  const beforeInserts = pieces.reduce((sum, piece) => sum + piece.len, 0);
  const inserts = every('insert').map((text, i) => {
    const { at, len, name } = pairs(text, 'insert', '"at=<output s>,len=<s>[,name=<text>]"');
    const where = frame(Number(at));
    const length = frame(Number(len));
    if (!(Number(at) >= 0) || !(length > 0)) fail(`--insert takes "at=<output s>,len=<s>[,name=<text>]" with len above 0; got "${text}".`);
    if (where > beforeInserts) fail(`--insert at=${at} is past the end of the cut (${seconds(beforeInserts)} s). "at" is on the clock after the cut and before any insert.`);
    return { where, len: length, name: name || `insert ${i + 1}`, order: i };
  }).sort((a, b) => a.where - b.where || a.order - b.order);

  const timeline = [];
  let pre = 0; // frames on the clock before inserts
  let queue = [...inserts];
  const place = () => {
    while (queue.length && queue[0].where === pre) {
      const insert = queue.shift();
      timeline.push({ insert: insert.name, len: insert.len });
    }
  };
  for (const piece of pieces) {
    let rest = { ...piece };
    place();
    while (queue.length && queue[0].where < pre + rest.len) {
      if (rest.sped) fail(`--insert at=${seconds(queue[0].where)} lands inside a sped-up stretch. Put it at one of the stretch's ends.`);
      const head = queue[0].where - pre;
      timeline.push({ s: rest.s, e: rest.s + head, len: head, sped: false });
      rest = { s: rest.s + head, e: rest.e, len: rest.len - head, sped: false };
      pre += head;
      place();
    }
    timeline.push(rest);
    pre += rest.len;
  }
  place();

  let outFrame = 0;
  for (const piece of timeline) {
    piece.out = outFrame;
    outFrame += piece.len;
  }
  const framesOut = outFrame;

  // 5. Runs: stretches where source and output both run on unbroken at normal speed.
  const runs = [];
  for (const piece of timeline) {
    if (piece.insert || piece.sped) continue;
    const last = runs.at(-1);
    if (last && last.e === piece.s && last.out + (last.e - last.s) === piece.out) last.e = piece.e;
    else runs.push({ s: piece.s, e: piece.e, out: piece.out });
  }
  const spedRanges = timeline.filter((piece) => piece.sped).map((piece) => [piece.s / fps, piece.e / fps]);

  // 6. Words.
  const words = [];
  const clipped = [];
  let dropped = 0;
  let droppedSped = 0;
  for (const word of data.words) {
    let best = null;
    let bestOverlap = -1;
    for (const run of runs) {
      const [s, e] = [run.s / fps, run.e / fps];
      const overlap = Math.min(word.end, e) - Math.max(word.start, s);
      if (overlap > bestOverlap) [best, bestOverlap] = [run, overlap];
    }
    const [s, e] = best ? [best.s / fps, best.e / fps] : [0, 0];
    const inside = best && word.start >= s - tolerance - EPS && word.end <= e + tolerance + EPS;
    const point = word.end === word.start;
    if (!best || (!inside && bestOverlap <= tolerance + EPS) || (point && !inside) || (inside && !point && bestOverlap <= 0)) {
      dropped++;
      if (spedRanges.some(([a, b]) => word.start >= a - tolerance - EPS && word.end <= b + tolerance + EPS)) droppedSped++;
      continue;
    }
    const start = Math.max(word.start, s);
    const end = Math.max(start, Math.min(word.end, e));
    const offset = best.out / fps - s;
    const moved = { ...word, start: round6(start + offset), end: round6(end + offset), src: round6(start) };
    if (!inside) {
      moved.clipped = true;
      const edges = [];
      if (word.start < s - tolerance - EPS) edges.push(round6(s));
      if (word.end > e + tolerance + EPS) edges.push(round6(e));
      clipped.push({ text: word.text, source: [word.start, word.end], edges, out: [moved.start, moved.end] });
    }
    words.push(moved);
  }

  const map = timeline.map((piece) => {
    if (piece.insert) return { out: seconds(piece.out), src: null, len: seconds(piece.len), insert: piece.insert };
    const entry = { out: seconds(piece.out), src: seconds(piece.s), len: seconds(piece.len) };
    if (piece.sped) entry.rate = round6((piece.e - piece.s) / piece.len);
    return entry;
  });

  const clock = one('clock') ?? (inserts.length || speeds.length ? 'final' : 'cut');
  const durationOut = seconds(framesOut);
  const failed = clipped.length > 0 && !one('allow-clipped');
  if (!failed) {
    const file = {
      clock,
      source: cut.source ?? null,
      fps,
      duration: durationOut,
      frames: framesOut,
      words,
      map,
    };
    writeFileSync(out, `${JSON.stringify(file)}\n`);
  }
  if (clipped.length) {
    console.error(`${clipped.length} word${clipped.length === 1 ? '' : 's'} cut through (a cut never lands inside a word):`);
    for (const item of clipped) {
      console.error(`  "${item.text}" ${item.source[0]}–${item.source[1]} s on the source clock is crossed by a range edge at ${item.edges.join(' and ')} s; ${item.out[0]}–${item.out[1]} s on the ${clock} clock.`);
    }
    console.error(failed
      ? `Nothing was written. Move each edge into the silence beside the word in ${cutFile} and run this again, or pass --allow-clipped.`
      : 'Written anyway (--allow-clipped). Listen to each of these joins.');
    console.error('Word times are estimates: this can\'t tell a clipped word from a word whose time is a little off. Listen to decide.');
  }
  console.log(JSON.stringify({
    out: failed ? null : resolve(out),
    clock,
    words_in: data.words.length,
    words_out: words.length,
    dropped,
    dropped_sped: droppedSped,
    clipped: clipped.map((item) => item.source[0]),
    duration_in: durationIn,
    duration_out: durationOut,
    frames_out: framesOut,
    fps,
  }));
  process.exit(failed ? 1 : 0);
}
