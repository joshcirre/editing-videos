#!/usr/bin/env node
// A mechanical first pass over a transcript: proposes cuts (stutters, retakes, false starts,
// fillers, silences, long words) with context and a confidence. It never decides.
// Needs Node 22 or later. Nothing to install; works from word timings alone.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HELP = `Proposes cuts from word timings: stutters, retakes, false starts, fillers, silences, long words.
It proposes and never decides: read each candidate in context (guide/first-pass.md).

  node cut-candidates.mjs --words words.json [--out candidates.json] [options]
  node cut-candidates.mjs --words words.json --apply decisions.json [--candidates candidates.json]
                          [--out cut.json] [--source clip.mp4] [--fps 30]

  --words <file>         transcript: {"words":[{"text","start","end"}, ...],"duration":seconds}
  --out <file>           where to write (candidates.json; with --apply, cut.json)

What it looks for (each number is a starting point: set it for this speaker)
  --stutter-gap <s>      stutter: the same word, or the same 2-4 words, said twice in a row
                         with less than this between them (0.5)
  --phrase-gap <s>       a phrase ends at a gap longer than this, or at . ? ! (0.85)
  --retake-window <s>    retake: compare a phrase with the ones that start within this long
                         after it ends (75)
  --retake-sim <0-1>     retake: share of content words two phrases have in common (0.34);
                         two phrases with the same first two content words need 0.1 less
  --stop-words <file>    words to ignore when comparing phrases, in place of the built-in
                         English list (one a line, or separated by spaces or commas)
  --false-start <s>      false start: a phrase shorter than this (6) that ends without . ? !
                         and is followed by a phrase starting with the same 1-2 words; also
                         the end of a phrase said again after a pause ("the queue / the queue")
  --fillers <a,b,c>      more filler sounds, added to um, uh, er, ah, hmm
  --filler-air <s>       a filler is proposed only with this much silence on both sides (0.12);
                         one that runs into a word is listed with confidence 0: it stays
  --gap <s>              silence: a gap between words at least this long (0.8)
  --breath-sentence <s>  pause kept where a silence follows the end of a sentence (0.3)
  --breath-inside <s>    pause kept where a silence is inside a sentence (0.2)
  --breath-after <0-1>   share of the kept pause left after the outgoing word (0.6); the
                         rest stays before the incoming word
  --lead <s>             kept before the incoming word after any other removal (0.05), as far
                         as the gap allows
  --long-word <s>        long word: lasts longer than this (0.6) and over 0.12 s a letter.
                         A stumble or a transcriber's smear may sit inside. Listen; no cut proposed
  --budget <0-1>         say so when everything proposed removes more than this share (0.2):
                         the thresholds are then wrong for this speaker. Nothing is dropped

Turning decisions into a keep list
  --apply <file>         {"accept":[0, 4, 7]}: indexes of the candidates to cut
  --accept-all           accept every candidate that proposes a cut (prints a warning: this is
                         the pass deciding, which it shouldn't)
  --candidates <file>    the candidates file the indexes refer to (edit its start and end by
                         hand if you placed a cut by the sound); without it they are found again
  --source <file>        the clip's name, written into cut.json
  --fps <n>              frame grid the keep list snaps to (30): use the video's
A boundary that would land inside a word is moved to the nearest gap and reported.

Every candidate's text shows about 6 words either side, with [the part to remove] in brackets.
Word times are estimates: place each accepted cut by the sound before you render.
It can't see a retake said in other words, a wrong fact, or a pause while the picture is busy.
Prints one line of JSON: counts per kind, seconds proposed, share of the duration, file written.`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// ---------- options ----------
const DEFAULTS = {
  'stutter-gap': 0.5, 'phrase-gap': 0.85, 'retake-window': 75, 'retake-sim': 0.34,
  'false-start': 6, 'filler-air': 0.12, gap: 0.8, 'breath-sentence': 0.3, 'breath-inside': 0.2,
  'breath-after': 0.6, lead: 0.05, 'long-word': 0.6, budget: 0.2, fps: 30,
};
const TEXT_OPTIONS = ['words', 'out', 'stop-words', 'fillers', 'apply', 'candidates', 'source'];
const FLAGS = ['accept-all'];

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}
const opt = { ...DEFAULTS };
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!arg.startsWith('--')) fail(`Don't know what to do with "${arg}". Options start with --; run with --help.`);
  const name = arg.slice(2);
  if (FLAGS.includes(name)) {
    opt[name] = true;
    continue;
  }
  if (!(name in DEFAULTS) && !TEXT_OPTIONS.includes(name)) fail(`Unknown option ${arg}. Run with --help for the list.`);
  const value = argv[++i];
  if (value === undefined || value.startsWith('--')) fail(`${arg} needs a value. Run with --help.`);
  if (name in DEFAULTS) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) fail(`${arg} takes a number of 0 or more, such as ${DEFAULTS[name]}; got "${value}".`);
    opt[name] = number;
  } else {
    opt[name] = value;
  }
}
for (const name of ['retake-sim', 'breath-after', 'budget']) {
  if (opt[name] > 1) fail(`--${name} is a share from 0 to 1, such as ${DEFAULTS[name]}; got ${opt[name]}.`);
}
if (!(opt.fps > 0)) fail('--fps takes a number above 0, such as 30.');
if (!opt.words) fail('Usage: node cut-candidates.mjs --words words.json [--out candidates.json]\nRun with --help for the rest.');
if (opt['accept-all'] && opt.apply) fail('Use --apply <decisions.json> or --accept-all, not both.');

const readJson = (file, what) => {
  if (!existsSync(file)) fail(`No ${what} at ${file}.`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${file} isn't JSON: ${error.message}`);
  }
};

// ---------- transcript ----------
const transcript = readJson(opt.words, 'transcript');
const rawWords = Array.isArray(transcript) ? transcript : transcript?.words;
if (!Array.isArray(rawWords) || rawWords.length === 0) {
  fail(`${opt.words} has no words. It must look like {"words":[{"text":"Hi","start":0.0,"end":0.3}],"duration":12.5}.`);
}
const words = rawWords.map((word, i) => {
  const start = Number(word?.start);
  const end = Number(word?.end);
  if (typeof word?.text !== 'string' || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    fail(`Word ${i} in ${opt.words} needs "text", "start" and "end" (seconds, end after start); got ${JSON.stringify(word)}.`);
  }
  return { text: word.text.trim(), start, end };
});
for (let i = 1; i < words.length; i++) {
  if (words[i].start < words[i - 1].start) fail(`Words in ${opt.words} are out of order at word ${i} ("${words[i].text}" at ${words[i].start} s). Sort them by start.`);
}
const lastEnd = words.reduce((max, word) => Math.max(max, word.end), 0);
const duration = Number(transcript?.duration) > 0 ? Math.max(Number(transcript.duration), lastEnd) : lastEnd;

const norm = (text) => text.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}']+/gu, '').replace(/^'+|'+$/g, '');
const endsSentence = (text) => /[.?!…]["'”’)\]]*$/.test(text);
const round = (n) => Math.round(n * 1000) / 1000;
const N = words.map((word) => norm(word.text));
const gapAfter = (i) => (i + 1 < words.length ? Math.max(0, words[i + 1].start - words[i].end) : Math.max(0, duration - words[i].end));
const gapBefore = (i) => (i > 0 ? Math.max(0, words[i].start - words[i - 1].end) : Math.max(0, words[0].start));

const STOP = new Set((opt['stop-words']
  ? (existsSync(opt['stop-words']) ? readFileSync(opt['stop-words'], 'utf8') : fail(`No stop-word file at ${opt['stop-words']}.`))
  : `a an the and or but so if then than that this these those there here it its it's is are was were be been being
     am do does did done have has had having i i'm i've i'll i'd you you're you've you'll your we we're we've we'll
     our us they they're their them he she his her him me my of to in on at by for from with into onto over under
     up down out off about as not no yes can can't could will would won't should shall may might must just very
     really also too what which who whom when where why how all any some each both more most other such only own
     same again once now well okay ok right like kind sort going gonna get got go let let's don't doesn't didn't
     isn't aren't wasn't that's there's here's what's one because while want need know see say said thing things`)
  .split(/[\s,]+/).map(norm).filter(Boolean));
const FILLERS = new Set(['um', 'uh', 'er', 'ah', 'hmm', 'umm', 'uhh', 'erm', 'mm', 'uhm',
  ...(opt.fillers ? opt.fillers.split(',').map(norm).filter(Boolean) : [])]);
// Words people double on purpose: a repeat is more likely emphasis than a stutter.
const EMPHATIC = new Set(['very', 'really', 'no', 'never', 'so', 'big', 'long', 'many', 'much', 'way', 'far',
  'yes', 'yeah', 'okay', 'ok', 'bye', 'go', 'wait', 'again', 'more', 'super', 'too', 'now', 'ha', 'that', 'had']);

// Context: about 6 words either side, the part to remove in brackets.
const CONTEXT = 6;
const context = (from, to) => {
  const before = words.slice(Math.max(0, from - CONTEXT), from).map((w) => w.text).join(' ');
  const inside = from <= to ? words.slice(from, to + 1).map((w) => w.text).join(' ') : '';
  const after = words.slice(to + 1, to + 1 + CONTEXT).map((w) => w.text).join(' ');
  return [from - CONTEXT > 0 ? '…' : '', before, `[${inside}]`, after, to + 1 + CONTEXT < words.length ? '…' : '']
    .filter(Boolean).join(' ');
};
// A removal of words from..to ends a little before the next word, as far as the gap allows.
const removalEnd = (to) => (to + 1 < words.length
  ? Math.max(words[to].end, words[to + 1].start - Math.min(opt.lead, gapAfter(to) / 2))
  : duration);
const quote = (from, to) => words.slice(from, to + 1).map((w) => w.text).join(' ');

// ---------- detectors ----------
function findCandidates() {
  const found = [];
  const add = (c) => found.push({ ...c, start: round(c.start), end: round(c.end), confidence: Math.round(c.confidence * 100) / 100 });

  // Phrases: what's said in one breath.
  const phrases = [];
  let from = 0;
  for (let i = 0; i < words.length; i++) {
    if (i === words.length - 1 || endsSentence(words[i].text) || gapAfter(i) > opt['phrase-gap']) {
      const content = [];
      for (let k = from; k <= i; k++) if (N[k] && !STOP.has(N[k]) && !FILLERS.has(N[k])) content.push(N[k]);
      phrases.push({ from, to: i, start: words[from].start, end: words[i].end, content, set: new Set(content), closed: endsSentence(words[i].text) });
      from = i + 1;
    }
  }

  // Stutters and restarts: the same 1-4 words twice in a row.
  const inRepeat = new Set();
  for (let i = 0; i < words.length; i++) {
    for (let n = 4; n >= 1; n--) {
      if (i + 2 * n > words.length) continue;
      let same = true;
      for (let k = 0; k < n && same; k++) same = Boolean(N[i + k]) && N[i + k] === N[i + n + k];
      if (!same) continue;
      // "5 .5" is one number, and a repeat with a pause or a full stop inside it is two phrases.
      if (/^[.,]\p{N}/u.test(words[i + n].text) || /^[.,]\p{N}/u.test(words[i].text)) continue;
      let whole = true;
      for (let k = i; k < i + 2 * n - 1 && whole; k++) {
        if (k === i + n - 1) continue;
        whole = gapAfter(k) <= opt['phrase-gap'] && !endsSentence(words[k].text);
      }
      if (!whole) continue;
      if (FILLERS.has(N[i]) && n === 1) break; // "um um": the filler pass has it
      const gap = gapAfter(i + n - 1);
      const closed = endsSentence(words[i + n - 1].text);
      if (n > 1 && closed) continue; // a whole sentence said twice is the retake pass's job
      const said = quote(i, i + n - 1);
      const base = { start: words[i].start, end: removalEnd(i + n - 1), text: context(i, i + n - 1), keep: quote(i + n, i + 2 * n - 1) };
      if (gap < opt['stutter-gap']) {
        const emphatic = n === 1 && EMPHATIC.has(N[i]);
        const number = n === 1 && /^\p{N}+$/u.test(N[i]);
        add({ kind: 'stutter', ...base,
          confidence: emphatic ? 0.25 : number ? 0.3 : closed ? 0.4 : n > 1 ? 0.75 : 0.8,
          why: emphatic ? `"${said}" twice in a row, ${gap.toFixed(2)} s apart, but it's a word people double on purpose: emphasis looks the same as a stutter here. Listen`
            : number ? `"${said}" twice in a row: could be a number read out ("two two"), not a stutter. Listen`
            : `"${said}" said twice in a row, ${gap.toFixed(2)} s apart. Emphasis and lists look the same: check it isn't meant` });
      } else if (!closed) {
        add({ kind: 'false-start', ...base,
          confidence: n > 1 ? 0.65 : STOP.has(N[i]) ? 0.45 : 0.4,
          why: `"${said}" said again after a ${gap.toFixed(2)} s pause: looks like a restart. Keep the words only the first try has; join only if the delivery matches on both sides` });
      } else continue;
      for (let k = i; k < i + n; k++) inRepeat.add(k);
      i += n - 1;
      break;
    }
  }

  // False starts: a short phrase left open, and the next one begins the same way.
  const falseStart = new Set();
  for (let p = 0; p + 1 < phrases.length; p++) {
    const a = phrases[p];
    const b = phrases[p + 1];
    const length = a.end - a.start;
    if (a.closed || length >= opt['false-start'] || inRepeat.has(a.to)) continue;
    const aLen = a.to - a.from + 1;
    const bLen = b.to - b.from + 1;
    let same = 0;
    while (same < 2 && same < aLen && same < bLen && N[a.from + same] && N[a.from + same] === N[b.from + same]) same++;
    if (same === 0) continue;
    // Just "so" or "and" at the start of both is how people talk, not a restart.
    const weak = same === 1 && STOP.has(N[a.from]) && aLen > 1;
    falseStart.add(p);
    add({ kind: 'false-start', start: a.start, end: removalEnd(a.to), text: context(a.from, a.to), keep: quote(b.from, b.to),
      confidence: same === 2 ? 0.7 : weak ? 0.25 : 0.45,
      why: `A ${length.toFixed(1)} s phrase that stops without ending, then the next one starts with the same ${same === 2 ? 'two words' : 'word'} ("${quote(a.from, a.from + same - 1)}")${weak ? ', a common opening word: weak sign' : ''}. Check the first try has nothing the second lacks` });
  }

  // Retakes: two phrases a short while apart that share most of their content words.
  for (let p = 0; p < phrases.length; p++) {
    if (falseStart.has(p)) continue;
    const a = phrases[p];
    if (a.set.size < 2) continue;
    let best = null;
    let takes = 0;
    for (let q = p + 1; q < phrases.length && phrases[q].start - a.end <= opt['retake-window']; q++) {
      const b = phrases[q];
      if (b.set.size < 2) continue;
      let shared = 0;
      for (const word of a.set) if (b.set.has(word)) shared++;
      if (shared < 2) continue;
      const sim = shared / (a.set.size + b.set.size - shared);
      const opening = a.content[0] === b.content[0] && a.content[1] === b.content[1];
      if (sim >= opt['retake-sim'] || (opening && sim >= Math.max(0, opt['retake-sim'] - 0.1))) {
        takes++;
        if (!best || sim >= best.sim) best = { q, sim, opening, shared };
      }
    }
    if (!best) continue;
    const b = phrases[best.q];
    const apart = b.start - a.end;
    const next = best.q === p + 1;
    const confidence = Math.min(0.9, 0.25 + best.sim * 0.5 + (next ? 0.15 : 0) + (best.opening ? 0.1 : 0) + (a.closed ? 0 : 0.1) - (apart > 20 ? 0.15 : 0));
    add({ kind: 'retake', start: a.start, end: removalEnd(a.to), text: context(a.from, a.to), keep: quote(b.from, b.to), confidence,
      why: `Shares ${best.shared} of its content words (${Math.round(best.sim * 100)}%) with a phrase ${apart.toFixed(1)} s later${best.opening ? ', same opening' : ''}${takes > 1 ? `; ${takes} later phrases match` : ''}. Proposes dropping the earlier one, but the last take is not automatically the best, and saying a thing twice can be meant (a list, a refrain, a recap). Read both` });
  }

  // Fillers: only where there's air on both sides.
  for (let i = 0; i < words.length; i++) {
    if (!FILLERS.has(N[i])) continue;
    const before = i === 0 ? Infinity : gapBefore(i);
    const after = i === words.length - 1 ? Infinity : gapAfter(i);
    const base = { kind: 'filler', start: words[i].start, text: context(i, i) };
    if (after < opt['filler-air']) add({ ...base, end: words[i].end, keep: words[i].text, confidence: 0, cut: false, why: 'runs into the next word: stays' });
    else if (before < opt['filler-air']) add({ ...base, end: words[i].end, keep: words[i].text, confidence: 0, cut: false, why: 'runs on from the word before: stays' });
    else {
      add({ ...base, end: removalEnd(i), keep: '', confidence: 0.85,
        why: `"${words[i].text}" with ${Number.isFinite(before) ? before.toFixed(2) : 'open'} s of silence before and ${Number.isFinite(after) ? after.toFixed(2) : 'open'} s after. Check the line reads naturally without it, and that this person wants fillers out at all` });
    }
  }

  // Silences: trim to a kept breath, more of it after the outgoing word.
  const silence = (start, end, breath, sentence, where, from, to) => {
    const length = end - start;
    if (length < opt.gap || length <= breath) return;
    const cutStart = where === 'head' ? 0 : start + breath * opt['breath-after'];
    const cutEnd = where === 'tail' ? duration : end - breath * (where === 'head' ? 1 : 1 - opt['breath-after']);
    if (cutEnd - cutStart <= 0) return;
    const long = length >= 3;
    const stretch = length >= 10;
    add({ kind: 'silence', start: cutStart, end: cutEnd, text: context(from, to),
      keep: `${breath.toFixed(2)} s pause${where ? '' : ` (${(breath * opt['breath-after']).toFixed(2)} after, ${(breath * (1 - opt['breath-after'])).toFixed(2)} before)`}`,
      confidence: stretch ? 0.15 : where ? 0.3 : long ? 0.35 : 0.55,
      why: `${length.toFixed(2)} s without words ${where === 'head' ? 'before the first word' : where === 'tail' ? 'after the last word' : sentence ? 'after the end of a sentence' : 'inside a sentence'}. ${stretch ? 'That is a stretch without speech, not a pause: expect a screen, B-roll or music there. Look at the picture; cut only waiting'
        : long || where ? 'This long, something is probably happening in the picture, or the pause is meant: look before cutting' : 'Silent sound is not dead air if the picture is doing something, or the pause sets up a line: look'}` });
  };
  if (words[0].start >= opt.gap) silence(0, words[0].start, opt['breath-sentence'], true, 'head', 0, -1);
  for (let i = 0; i + 1 < words.length; i++) {
    const sentence = endsSentence(words[i].text);
    silence(words[i].end, words[i + 1].start, sentence ? opt['breath-sentence'] : opt['breath-inside'], sentence, '', i + 1, i);
  }
  const tail = duration - lastEnd;
  if (tail >= opt.gap) silence(lastEnd, duration, opt['breath-sentence'], true, 'tail', words.length, words.length - 1);

  // Long words: something may hide inside. Nothing to cut until someone listens.
  for (let i = 0; i < words.length; i++) {
    const length = words[i].end - words[i].start;
    const letters = [...N[i]].reduce((sum, ch) => sum + (/\p{N}/u.test(ch) ? 4 : 1), 0) || 1;
    if (length <= opt['long-word'] || length / letters <= 0.12 || FILLERS.has(N[i])) continue;
    add({ kind: 'long-word', start: words[i].start, end: words[i].end, text: context(i, i), keep: words[i].text, cut: false,
      confidence: Math.min(0.6, 0.15 + (length / letters - 0.12)),
      why: `"${words[i].text}" lasts ${length.toFixed(2)} s. A stumble or a second take may sit inside it, or the transcriber stretched it over a pause. ${gapBefore(i) >= 3 || gapAfter(i) >= 3 ? 'It stands next to a long silence, so the transcriber may have invented it over music or noise. ' : ''}Listen; no cut proposed` });
  }

  const order = ['false-start', 'retake', 'stutter', 'filler', 'silence', 'long-word'];
  found.sort((x, y) => x.start - y.start || order.indexOf(x.kind) - order.indexOf(y.kind));
  return found.map((c, index) => ({ index, cut: true, ...c }));
}

// Seconds covered by a list of ranges, counting overlaps once.
const merge = (ranges) => {
  const sorted = ranges.filter((r) => r.end > r.start).map((r) => ({ ...r })).sort((a, b) => a.start - b.start);
  const out = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
      last.kinds = [...new Set([...last.kinds, ...range.kinds])];
    } else out.push({ start: range.start, end: range.end, kinds: [...range.kinds] });
  }
  return out;
};
const proposes = (c) => c.cut !== false && c.confidence > 0 && c.kind !== 'long-word' && c.end > c.start;
const seconds = (list) => merge(list.map((c) => ({ start: c.start, end: c.end, kinds: [c.kind] }))).reduce((sum, r) => sum + r.end - r.start, 0);

// ---------- apply: decisions -> keep list ----------
if (opt.apply || opt['accept-all']) {
  let candidates;
  if (opt.candidates) {
    candidates = readJson(opt.candidates, 'candidates file')?.candidates;
    if (!Array.isArray(candidates)) fail(`${opt.candidates} has no "candidates" list. Make it with: node cut-candidates.mjs --words ${opt.words} --out ${opt.candidates}`);
  } else candidates = findCandidates();

  let accept;
  if (opt['accept-all']) {
    accept = candidates.map((c, i) => i).filter((i) => proposes(candidates[i]));
    console.error(`Warning: --accept-all cuts all ${accept.length} proposals unread. The pass can't tell emphasis from a stutter or a busy picture from dead air: read them before you render.`);
  } else {
    accept = readJson(opt.apply, 'decisions file')?.accept;
    if (!Array.isArray(accept) || accept.some((i) => !Number.isInteger(i))) fail(`${opt.apply} must look like {"accept":[0, 4, 7]}: the indexes of the candidates to cut.`);
    for (const i of accept) {
      const c = candidates[i];
      if (!c) fail(`Decision ${i} has no candidate: there are ${candidates.length} (0 to ${candidates.length - 1}). Check --candidates points at the file you read.`);
      if (!(Number(c.end) > Number(c.start)) || c.cut === false || c.kind === 'long-word') {
        fail(`Candidate ${i} (${c.kind}, "${c.why}") proposes no cut, so it can't be accepted. To cut there, set its start, end and "cut": true in the candidates file yourself.`);
      }
    }
  }

  const fps = opt.fps;
  const tolerance = 0.5 / fps + 1e-6;
  const snap = (t) => Math.round(t * fps) / fps;
  const insideWord = (t) => words.find((w) => t > w.start + tolerance && t < w.end - tolerance);
  const moved = [];
  // A cut never lands inside a word: go to the nearer edge of the word, then on to a real gap.
  const place = (t, label) => {
    let at = Math.min(Math.max(snap(t), 0), snap(duration));
    for (let tries = 0; tries < 50; tries++) {
      const word = insideWord(at);
      if (!word) break;
      const toStart = Math.abs(at - word.start) <= Math.abs(word.end - at);
      at = snap(toStart ? word.start : word.end);
      if (insideWord(at) === word) at = toStart ? Math.floor(word.start * fps) / fps : Math.ceil(word.end * fps) / fps;
    }
    if (insideWord(at)) fail(`Couldn't place the ${label} near ${t.toFixed(3)} s outside a word: the words there overlap. Fix their times in ${opt.words}.`);
    if (Math.abs(at - snap(t)) > 1e-9) moved.push({ boundary: label, from: round(t), to: round(at), word: insideWord(snap(t))?.text ?? '' });
    return at;
  };

  const removals = merge(accept.map((i) => ({ start: Number(candidates[i].start), end: Number(candidates[i].end), kinds: [candidates[i].kind] })))
    .map((r) => ({ start: place(r.start, 'cut out'), end: place(r.end, 'cut in'), kinds: r.kinds }))
    .filter((r) => r.end > r.start);
  const keep = [];
  let cursor = 0;
  let note = '';
  const total = snap(duration) > duration + 1e-9 ? Math.floor(duration * fps) / fps : snap(duration);
  for (const removal of merge(removals)) {
    if (removal.start - cursor > 1e-9) keep.push({ start: cursor, end: removal.start, ...(note && { note }) });
    cursor = Math.max(cursor, removal.end);
    note = `after a cut: ${removal.kinds.join(' + ')}`;
  }
  if (total - cursor > 1e-9) keep.push({ start: cursor, end: total, ...(note && { note }) });
  const grid = (t) => Math.round(t * 1e6) / 1e6;
  const out = resolve(opt.out ?? 'cut.json');
  const kept = keep.reduce((sum, r) => sum + r.end - r.start, 0);
  writeFileSync(out, `${JSON.stringify({ source: opt.source ?? '', fps, keep: keep.map((r) => ({ ...r, start: grid(r.start), end: grid(r.end) })) }, null, 2)}\n`);
  for (const m of moved) console.error(`Moved a ${m.boundary} from ${m.from} s to ${m.to} s: it was inside "${m.word}".`);
  const short = keep.filter((r) => r.end - r.start < 1).length;
  if (short) console.error(`${short} kept piece${short > 1 ? 's are' : ' is'} under 1 s: a piece that short reads as a glitch. Look at those joins.`);
  console.log(JSON.stringify({
    applied: accept.length, pieces: keep.length, secondsRemoved: round(total - kept), share: round((total - kept) / (total || 1)),
    secondsKept: round(kept), moved, piecesUnder1s: short, overBudget: (total - kept) / (total || 1) > opt.budget, file: out,
  }));
  process.exit(0);
}

// ---------- propose ----------
const candidates = findCandidates();
const counts = {};
for (const kind of ['stutter', 'retake', 'false-start', 'filler', 'silence', 'long-word']) counts[kind] = candidates.filter((c) => c.kind === kind).length;
const proposed = candidates.filter(proposes);
const removed = seconds(proposed);
const share = removed / (duration || 1);
const spoken = words.reduce((sum, w) => sum + w.end - w.start, 0);
const byKind = {};
for (const kind of Object.keys(counts)) byKind[kind] = round(seconds(proposed.filter((c) => c.kind === kind)));
const overBudget = share > opt.budget;
const summary = {
  counts, proposals: proposed.length, noCutProposed: candidates.length - proposed.length,
  secondsProposed: round(removed), share: round(share), secondsByKind: byKind, duration: round(duration), secondsOfWords: round(spoken),
  budget: opt.budget, overBudget,
  ...(overBudget && { warning: `Everything proposed removes ${(share * 100).toFixed(1)}% of the video, over the ${(opt.budget * 100).toFixed(0)}% budget: the thresholds are probably wrong for this speaker or this kind of video. Nothing was dropped; raise --gap or the kept breaths, or accept fewer.` }),
  cannotSee: 'a retake said in other words, a wrong fact, a pause that sets up a line, a pause while the picture is busy',
};
const out = resolve(opt.out ?? 'candidates.json');
const options = Object.fromEntries(Object.keys(DEFAULTS).map((name) => [name, opt[name]]));
writeFileSync(out, `${JSON.stringify({ summary, options, candidates }, null, 2)}\n`);
if (overBudget) console.error(summary.warning);
console.log(JSON.stringify({ ...counts, proposals: proposed.length, secondsProposed: round(removed), share: round(share), overBudget, file: out }));
