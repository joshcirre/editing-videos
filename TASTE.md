# The taste profile

The guide is the general opinion that suits most people. A person's own taste is kept in a
profile, a small file called `editing.md`, and it beats every default in the guide. The
project's is `editing.md` at the project root: how this show or channel is edited. The personal
one is `~/.editing-videos/editing.md`: what this person wants in every video.

When two sources disagree, the first one wins: the person's words now, then the project's
`editing.md`, then the personal one, then the guide's defaults. The hard rules in
[guide/rules.md](guide/rules.md) sit above all four. In a JCSS show the project file is the
show's `editing.md`; JCSS also keeps learned cut habits in `taste.json`, which it reads itself.

## The file

Three sections, one fact per bullet. A leading `[key]` is optional and names what the line
sets, so a project line can replace the personal line with the same key.

```markdown
# Editing profile

## Measured

- [shot.median] Median shot 6.4 s; screens run 9–14 s — on: four finished tutorials (2026-11-08)
- [pause.join] 0.31 s of silence kept at a join, median — on: four finished tutorials (2026-11-08)
- [music.under] Music sits 21 dB under the voice — on: "Queues in ten minutes" (2026-11-08)

## Rules

- [pause.join] Keep about 0.3 s at each join — from: "it sounds breathless, let me breathe between
  sentences" (2026-11-10) — check: no join in the cut has under 0.25 s of silence
- [cut.pieces] No piece shorter than 4 s outside the opening — from: "those quick cuts look like
  a robot did it" (2026-11-10) — check: list the kept ranges; none under 4 s after 0:30
- Never put a small label above a headline — from: "drop the little tag over the title, every
  time" (2026-11-12) — check: each title frame has one headline and nothing above it

## Look

- [caption.style] Captions in Inter Semibold, white, 4 words at a time, lower third — from: "yes,
  keep these captions" (2026-11-10)
- [text.behind] Big words go behind the speaker, on the real background, not on a plate — from:
  "keep my actual room, put the text behind me" (2026-11-12)
- [colour.accent] Accent colour #F2613F — from: "use the logo red" (2026-11-10)
```

- **A `## Measured` line carries** the value, what it was measured on after `— on:`, and the
  date. It says what their videos do; a rule about the same thing beats it, because they said it.
- **A `## Rules` line carries** the rule, the person's note quoted after `— from:`, the date,
  and after `— check:` how to verify it on the finished edit. A rule you can't check is a wish.
- **A `## Look` line carries** a font, a colour, or how text and layers are styled, with the
  words that confirmed it.

## What may be written

Only two kinds of line go into a profile, because the file is trusted without re-asking:

- **Something the person said or confirmed**, with their words quoted. Silence isn't a yes.
- **A number measured on their own finished videos**, the way [guide/study.md](guide/study.md)
  describes, with what it was measured on.

Never an inference from one edit, never a default that happened to be used, never a guess
about their brand from a logo or a website: a wrong line is repeated in every video after it.
When you aren't sure they meant it for next time, ask ([guide/notes.md](guide/notes.md)).

## When it's read

- **Read both files at the start of every edit**, before you apply any default from the guide.
  In your read of the video, name the profile lines that changed the plan: "pauses stay at
  0.3 s, your rule from 10 November; the guide would keep 0.4".
- **With no profile, use the guide's defaults** and say which mattered most for this video,
  usually the pause length, the caption size and the music level, so they can be corrected.
- **Offer once, at the end, to save what the person confirmed** in this edit. Save only those
  lines, to the project's file. If they say no, don't ask again for this video.
- **A profile never skips a question the content can't settle.** It changes the recommended
  answer, and you say where that answer came from.

## From project to personal

A rule starts in the project where it was said. When the same rule has been confirmed in two
different projects (house), offer once to make it personal, and copy it only on a yes.

## When they disagree

- **A profile line against a hard rule**: say which line and which rule, follow the hard rule,
  and ask. "Fade the last word out" in a profile doesn't make a clipped ending right.
- **A project line against a personal line**: the project wins. Mention it once in your read,
  so a stale line gets noticed.
- **A person's note against their own profile**: the note wins for this video. Then ask
  whether the profile should change or this was a one-off ([guide/notes.md](guide/notes.md)).

## Starting a profile

- **Ask at most three questions** (house), the ones that matter most for their kind of video,
  one per message, each with the guide's default as the recommended answer. For a tutorial:
  the pause at a join, the caption size, music under the voice or none. Write down only what
  they answer; a skipped question stays a default.
- **Measure 3–6 (house) of their finished videos** ([guide/study.md](guide/study.md)) and write
  the numbers under `## Measured`. Ask about anything that looks deliberate but unclear.

## With the script

`scripts/taste.mjs` (Node 22 or later, nothing to install; paths are from this skill's folder)
writes these lines the same way every time and prints one line of JSON; `--help` lists the
rest (`add-measure`, `--personal`). Without it, edit the files by hand as above.

```sh
node scripts/taste.mjs show --project .
node scripts/taste.mjs add-rule --project . --key pause.join --text "Keep 0.3 s at each join" \
  --from "it sounds breathless" --check "no join has under 0.25 s of silence"
node scripts/taste.mjs promote --project . --key pause.join --seen-in ../other-show
```
