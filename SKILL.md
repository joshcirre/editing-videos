---
name: editing-videos
description: "Edits any video the way a good editor would: works out what kind of video it is and its point first, then sets pacing, cuts, retakes, B-roll, captions, titles, motion graphics and sound from the content. Use when asked to edit, cut, tighten, caption, add B-roll or animated graphics to, finish a cut someone already made, or review the edit of a recording (talks, podcasts, interviews, tutorials, screen demos, shorts, any length), and when asked to use JCSS or its `jcss` CLI on a video."
license: MIT
---

# Editing videos

Taste for editing, written down so an agent can follow it with any editor: Final Cut Pro,
Premiere, Resolve, CapCut, ffmpeg, HyperFrames, Remotion or JCSS. A good edit makes the video's
point as clearly as possible, for the people who will watch it, where they will watch it. It
isn't a house style: work out what kind of video this is before you cut anything
([guide/read.md](guide/read.md)).

## The order of work

For a full edit, always read [guide/rules.md](guide/rules.md) and [guide/read.md](guide/read.md)
first, then each file in the table when you reach its step. For a small, specific request, read
the rules and only the file it touches.
Throughout, use only services already set up ([guide/read.md](guide/read.md), "Work with
what's set up").

1. Read the person's profile and the notes they gave before ([TASTE.md](TASTE.md)): their own taste
   beats this guide's defaults. Then read the whole transcript, the brief and any notes. If there's
   no transcript, make one with word timings first, with what's already here (the editor's own, or
   a local Whisper). Use an online transcription service only if it's already set up; if nothing
   can transcribe, say so and ask for a transcript. Write your read of the video and ask the person
   what you need to know. When you can't ask, go with your best read and say what you assumed.
2. Retakes and mistakes. A detector may propose them; you decide.
3. Cuts between phrases.
4. The shape: the opening, chapters, the ending.
5. B-roll and graphics.
6. Captions and titles.
7. Sound.
8. Check it before you say it's done.
9. Turn the person's notes into rules.

## Read it when

| When you are… | Read |
|---|---|
| about to change anything: the rules no style overrides | [guide/rules.md](guide/rules.md) |
| starting a full edit, or working out what the video is | [guide/read.md](guide/read.md) |
| setting pauses, how often the picture changes, caption size | [guide/pace.md](guide/pace.md) |
| choosing the opening, a cold open, chapters or the ending | [guide/shape.md](guide/shape.md) |
| making or reading a transcript, or timing anything from words | [guide/transcript.md](guide/transcript.md) |
| finding where a recording is really silent, and which pauses are dead air | [guide/silence.md](guide/silence.md) |
| using a detector or an automatic pass to propose cuts | [guide/first-pass.md](guide/first-pass.md) |
| cutting: retakes, fillers, joins, jump cuts, cameras, zooms | [guide/cut.md](guide/cut.md) |
| adding B-roll, screens, highlights or other visuals | [guide/broll.md](guide/broll.md) |
| adding captions, titles, overlays or shades under text | [guide/text.md](guide/text.md) |
| putting text behind a person | [guide/behind.md](guide/behind.md) |
| setting levels, sound effects, fades or music | [guide/sound.md](guide/sound.md) |
| about to say it's done, or comparing a final with its approved draft | [guide/check.md](guide/check.md) |
| writing the note that goes with an edit or a revision | [guide/handover.md](guide/handover.md) |
| given a note, or editing for someone who has given notes before | [guide/notes.md](guide/notes.md) |
| asked to match their past edits or a channel they admire | [guide/study.md](guide/study.md) |
| reading or saving the person's own taste | [TASTE.md](TASTE.md) |
| finishing a cut the person made themselves | [FINISHING.md](FINISHING.md) |
| making a graphic that moves and the editor can't draw | [MOTION.md](MOTION.md) |
| asked to use JCSS or its `jcss` CLI | [JCSS.md](JCSS.md) |

## Scripts

In `scripts/`, each with `--help`. They need Node 22 or later and install nothing; all but
`taste.mjs` and `retime-words.mjs` need ffmpeg, and `page-frames.mjs` needs Chrome. Each prints
one line of JSON, and the checks exit 1 when they find a problem. When one can't run here, do
its job by hand from the guide file and say so. Numbers in the guide are tagged by where they
come from; [guide/rules.md](guide/rules.md) has the key.

| Script | Does | Guide |
|---|---|---|
| `silences.mjs` | finds silence with a threshold taken from the file; snaps word edges to it | [silence.md](guide/silence.md) |
| `cut-candidates.mjs` | proposes stutters, retakes, false starts, fillers and pauses; never decides | [first-pass.md](guide/first-pass.md) |
| `retime-words.mjs` | moves word times onto the clock of a cut, and back | [transcript.md](guide/transcript.md) |
| `cover.mjs` | measures how much of a text box the person covers | [behind.md](guide/behind.md) |
| `check.mjs` | scans a render: stray frames, black, frozen, loudness, draft against final | [check.md](guide/check.md) |
| `measure-style.mjs` | measures a finished video's shots, pauses, joins and loudness | [study.md](guide/study.md) |
| `taste.mjs` | reads and writes the profile | [TASTE.md](TASTE.md) |
| `page-frames.mjs` | draws a web page to frames on an exact clock | [MOTION.md](MOTION.md) |

## Finishing a cut the person made

When the video arrives already cut by the person and the job is to finish it (sharper screens,
graphics, text, music, a cold open), their cut is final: skip steps 2 and 3 and read
[FINISHING.md](FINISHING.md). It covers keeping their timeline exact, finding their cuts in the
picture, filming a screen again, text behind a person, and going from a draft to full size.

## Motion graphics

When the edit needs a graphic that moves and the editor can't draw it (an animated title or
lower third, a chart that builds, a diagram, a counter), read [MOTION.md](MOTION.md) and write
it as a web page. When a framework is wanted, HyperFrames comes before Remotion, and neither is
installed unasked. `scripts/page-frames.mjs` draws the page to transparent frames, on the exact
frame, and films a real page (an app, a site) with scripted scrolls and clicks, as B-roll
sharper than an enlarged recording. It needs Node 22 or later and Chrome, and installs nothing.

## With JCSS

[JCSS](https://jcss.tv) is a studio for recording and streaming that also edits videos made
anywhere, through its `jcss` CLI and MCP server. When the person asks for JCSS, read
[JCSS.md](JCSS.md) before running anything: it says where `jcss` is, how to open a video as an
edit, how to add and change its layers (text, a layer behind the person, page clips, speed),
and how to check it and hand it over.
