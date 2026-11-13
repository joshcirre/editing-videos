#!/usr/bin/env node
// Reads and writes a person's taste profile (editing.md), so every agent writes it the same way.
// Needs Node 22 or later. Nothing to install. See TASTE.md for what belongs in a profile.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const HELP = `Reads and writes a taste profile: a project's editing.md and the personal one.

  node taste.mjs show [--project <dir>]
  node taste.mjs add-rule    --project <dir> | --personal  --text "…" --from "their words"
                             [--key k] [--check "how to verify it"] [--date YYYY-MM-DD] [--replace]
  node taste.mjs add-measure --project <dir> | --personal  --text "…" --on "what it was measured on"
                             [--key k] [--date YYYY-MM-DD] [--replace]
  node taste.mjs promote     --project <dir> --key k --seen-in <other project dir> [--replace]

  show         prints both profiles, the merged view and where they disagree. Without --project
               it reads the current folder. Lines that share a [key] conflict: the project's wins.
  add-rule     appends one bullet to "## Rules". --from is the person's own note, quoted; a rule
               without it is refused. Makes the file, with its three headings, when it's missing.
  add-measure  appends one bullet to "## Measured": a number measured on their own finished videos.
  promote      copies a keyed rule from the project's profile to the personal one. Only when the
               same key is also in another project's profile (--seen-in), and only after the
               person said yes.

  --project <dir>   the folder that holds editing.md (the project or show root)
  --personal        the personal profile, <home>/.editing-videos/editing.md
  --key k           a short name such as pause.join; one line per key in a file
  --replace         change the line that already has this key instead of refusing
  --date            the day the person said it or it was measured (today)
  --home <dir>      use this folder as the home directory (for tests)

A line looks like this:
  - [pause.join] Keep about 0.3 s at each join — from: "don't make it breathless" (2026-11-10) — check: gaps at joins are 0.25–0.35 s
  - [shot.median] Median shot 6.2 s — on: four finished tutorials (2026-11-08)

Prints one line of JSON. Exits 1 with one line that names the fix when it can't do what was asked.`;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const SECTIONS = ['Measured', 'Rules', 'Look'];
const FLAGS = new Set(['personal', 'replace']);
const VALUES = new Set(['project', 'home', 'text', 'from', 'key', 'check', 'date', 'on', 'seen-in']);

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}
const [command, ...rest] = args;
const options = {};
for (let i = 0; i < rest.length; i += 1) {
  const name = rest[i].startsWith('--') ? rest[i].slice(2) : null;
  if (name && FLAGS.has(name)) options[name] = true;
  else if (name && VALUES.has(name)) {
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`--${name} needs a value after it.`);
    options[name] = value;
    i += 1;
  } else fail(`Unknown option ${rest[i]}. Run with --help for the list.`);
}

const home = resolve(options.home ?? homedir());
const personalPath = join(home, '.editing-videos', 'editing.md');
const projectPath = (dir) => join(resolve(dir), 'editing.md');
const oneLine = (text) => String(text).replace(/\s+/g, ' ').trim();

// One bullet: "- [key] text — from: "words" (date) — check: how" or "… — on: what (date)".
function parseBullet(raw, line) {
  let body = raw.replace(/^\s*[-*]\s+/, '');
  const item = { text: '', line };
  const key = body.match(/^\[([^\]\s]+)\]\s*/);
  if (key) {
    item.key = key[1];
    body = body.slice(key[0].length);
  }
  const parts = body.split(/\s+(?:—|–|--)\s+(?=(?:from|check|on):)/i);
  item.text = parts[0].trim();
  for (const part of parts.slice(1)) {
    const name = part.slice(0, part.indexOf(':')).toLowerCase();
    let value = part.slice(part.indexOf(':') + 1).trim();
    if (name !== 'check') {
      const date = value.match(/\s*\((\d{4}-\d{2}-\d{2})\)\s*$/);
      if (date) {
        item.date = date[1];
        value = value.slice(0, date.index).trim();
      }
    }
    if (name === 'from') value = value.replace(/^["“]/, '').replace(/["”]$/, '');
    item[name] = value;
  }
  return item;
}

function parseProfile(path) {
  if (!existsSync(path)) return null;
  const profile = { path, measured: [], rules: [], look: [] };
  let section = null;
  let current = null;
  readFileSync(path, 'utf8').split(/\r?\n/).forEach((text, index) => {
    const heading = text.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const name = SECTIONS.find((known) => known.toLowerCase() === heading[1].toLowerCase());
      section = name ? name.toLowerCase() : null;
      current = null;
    } else if (section && /^[-*]\s+\S/.test(text)) {
      current = { raw: text, line: index + 1 };
      profile[section].push(current);
    } else if (current && /^\s+\S/.test(text)) current.raw += ` ${text.trim()}`; // a wrapped bullet
    else current = null;
  });
  for (const name of ['measured', 'rules', 'look']) {
    profile[name] = profile[name].map(({ raw, line }) => parseBullet(raw, line));
  }
  return profile;
}

// What a profile line is missing to be trusted: see TASTE.md, "What may be written".
function problemsIn(profile) {
  if (!profile) return [];
  const found = [];
  const add = (item, problem) => found.push({ path: profile.path, line: item.line, problem });
  for (const rule of profile.rules) {
    if (!rule.from) add(rule, 'A rule with no "— from:": whose words is it? Ask, or remove it.');
    else if (!rule.date) add(rule, 'A rule with no date after its note.');
  }
  for (const measure of profile.measured) {
    if (!measure.on) add(measure, 'A measurement with no "— on:": what was it measured on?');
    else if (!measure.date) add(measure, 'A measurement with no date.');
  }
  for (const name of ['measured', 'rules', 'look']) {
    const seen = new Set();
    for (const item of profile[name]) {
      if (item.key && seen.has(item.key)) add(item, `[${item.key}] is in this file twice; the later line is used.`);
      if (item.key) seen.add(item.key);
    }
  }
  return found;
}

function merge(project, personal) {
  const merged = { measured: [], rules: [], look: [] };
  const conflicts = [];
  for (const name of ['measured', 'rules', 'look']) {
    const mine = new Map((project?.[name] ?? []).filter((item) => item.key).map((item) => [item.key, item]));
    for (const item of personal?.[name] ?? []) {
      const winner = item.key ? mine.get(item.key) : undefined;
      if (!winner) merged[name].push({ ...item, source: 'personal' });
      else if (oneLine(winner.text) !== oneLine(item.text)) {
        conflicts.push({ section: name, key: item.key, project: winner.text, personal: item.text, wins: 'project' });
      }
    }
    for (const item of project?.[name] ?? []) {
      if (!item.key || mine.get(item.key) === item) merged[name].push({ ...item, source: 'project' });
    }
  }
  return { merged, conflicts };
}

function target() {
  if (options.personal && options.project) fail('Pass --project <dir> or --personal, not both.');
  if (options.personal) return personalPath;
  if (!options.project) fail('Say which profile: pass --project <dir> or --personal.');
  const dir = resolve(options.project);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`No folder at ${dir}. --project takes the project's folder.`);
  return projectPath(dir);
}

function dateOption() {
  const now = new Date();
  const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  const date = options.date ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) fail('--date takes a day as YYYY-MM-DD, such as 2026-11-10.');
  return date;
}

function keyOption() {
  if (options.key !== undefined && !/^[a-z0-9][a-z0-9._-]*$/i.test(options.key)) {
    fail('--key takes a short name of letters, digits, dots and dashes, such as pause.join.');
  }
  return options.key;
}

// Adds one bullet at the end of a section, making the file or the heading when missing.
function addBullet(path, section, bullet, key, replace) {
  const made = !existsSync(path);
  if (made) mkdirSync(dirname(path), { recursive: true });
  const before = made ? `# Editing profile\n\n${SECTIONS.map((name) => `## ${name}\n`).join('\n')}` : readFileSync(path, 'utf8');
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  const lines = before.split(/\r?\n/);
  const isHeading = (text, name) => new RegExp(`^##\\s+${name}\\s*$`, 'i').test(text);
  let start = lines.findIndex((text) => isHeading(text, section));
  if (start < 0) {
    while (lines.length && lines.at(-1).trim() === '') lines.pop();
    lines.push('', `## ${section}`, '');
    start = lines.length - 2;
  }
  let end = lines.findIndex((text, index) => index > start && /^##?\s/.test(text));
  if (end < 0) end = lines.length;
  let replaced = false;
  if (key) {
    const at = lines.findIndex((text, index) => index > start && index < end && text.match(/^[-*]\s+\[([^\]\s]+)\]/)?.[1] === key);
    if (at >= 0) {
      if (!replace) fail(`${path} already has [${key}] under ${section}. Pass --replace to change it, or use another --key.`);
      let stop = at + 1;
      while (stop < end && /^\s+\S/.test(lines[stop])) stop += 1; // the bullet's wrapped lines
      lines.splice(at, stop - at, bullet);
      replaced = true;
    }
  }
  if (!replaced) {
    let last = end;
    while (last > start + 1 && lines[last - 1].trim() === '') last -= 1;
    const tail = last === end && end < lines.length ? [bullet, ''] : [bullet];
    lines.splice(last, 0, ...(last === start + 1 ? ['', ...tail] : tail));
  }
  let text = lines.join(eol);
  if (!text.endsWith(eol)) text += eol;
  writeFileSync(path, text);
  return { made, replaced };
}

const ruleBullet = (rule) => {
  const key = rule.key ? `[${rule.key}] ` : '';
  const check = rule.check ? ` — check: ${oneLine(rule.check)}` : '';
  return `- ${key}${oneLine(rule.text)} — from: "${oneLine(rule.from).replace(/^["“]|["”]$/g, '')}" (${rule.date})${check}`;
};

const print = (result) => console.log(JSON.stringify(result));

if (command === 'show') {
  const dir = resolve(options.project ?? '.');
  if (options.project && !existsSync(dir)) fail(`No folder at ${dir}. --project takes the project's folder.`);
  const project = parseProfile(projectPath(dir));
  const personal = parseProfile(personalPath);
  const { merged, conflicts } = merge(project, personal);
  print({ project, personal, merged, conflicts, problems: [...problemsIn(project), ...problemsIn(personal)] });
} else if (command === 'add-rule') {
  const path = target();
  if (!options.text || !oneLine(options.text)) fail('Say the rule: pass --text "…".');
  if (!options.from || !oneLine(options.from)) fail("A rule needs the person's own words: pass --from.");
  const rule = { key: keyOption(), text: options.text, from: options.from, date: dateOption(), check: options.check };
  const bullet = ruleBullet(rule);
  const { made, replaced } = addBullet(path, 'Rules', bullet, rule.key, options.replace);
  print({ added: 'rule', path, created: made, replaced, line: bullet });
} else if (command === 'add-measure') {
  const path = target();
  if (!options.text || !oneLine(options.text)) fail('Say what was measured, with its number: pass --text "…".');
  if (!options.on || !oneLine(options.on)) fail('A measurement needs what it was measured on: pass --on.');
  const key = keyOption();
  const bullet = `- ${key ? `[${key}] ` : ''}${oneLine(options.text)} — on: ${oneLine(options.on)} (${dateOption()})`;
  const { made, replaced } = addBullet(path, 'Measured', bullet, key, options.replace);
  print({ added: 'measure', path, created: made, replaced, line: bullet });
} else if (command === 'promote') {
  const twoProjects = 'A rule becomes personal only after the person confirmed it in two different projects.';
  if (!options.project) fail('Say which project has the rule: pass --project <dir>.');
  const key = keyOption();
  if (!key) fail('Say which rule: pass --key k. Only a rule with a [key] can be promoted.');
  const from = projectPath(options.project);
  const rule = parseProfile(from)?.rules.findLast((item) => item.key === key);
  if (!rule) fail(`No rule [${key}] in ${from}. Run "taste.mjs show --project ${options.project}" to see its keys.`);
  if (!rule.from) fail(`[${key}] in ${from} has no "— from:". A rule needs the person's own words before it moves.`);
  if (!options['seen-in']) fail(`${twoProjects} Pass --seen-in <other project dir> whose editing.md also has [${key}].`);
  const other = projectPath(options['seen-in']);
  if (resolve(other) === resolve(from)) fail(`${twoProjects} --seen-in is the same project as --project.`);
  if (resolve(other) === resolve(personalPath)) fail(`${twoProjects} --seen-in is the personal profile, not a project.`);
  const seen = parseProfile(other)?.rules.findLast((item) => item.key === key);
  if (!seen) fail(`${twoProjects} ${other} has no rule [${key}], so this one stays in the project.`);
  const bullet = ruleBullet(rule);
  const { made, replaced } = addBullet(personalPath, 'Rules', bullet, key, options.replace);
  print({
    promoted: key,
    path: personalPath,
    created: made,
    replaced,
    line: bullet,
    seenIn: [from, other],
    sameText: oneLine(seen.text) === oneLine(rule.text),
    ...(oneLine(seen.text) === oneLine(rule.text) ? {} : { otherText: seen.text }),
  });
} else fail(`Unknown command ${command}. Use show, add-rule, add-measure or promote; --help has the rest.`);
