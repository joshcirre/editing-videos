### The hand-over note

Covers the note that goes with every edit: what was measured, what was looked at, what nobody
checked. Everything here is a default that the person's profile or words override, except what's
marked `(hard rule)`: see [rules.md](rules.md).

A render that finished, a tool that said it worked and a clean scan are not proof. The person can
only decide what to trust when they know how each claim was established. Every edit goes out
with what you changed, your read and what you assumed, how each claim was established, and what
a person should check by eye or ear ([check.md](check.md) marks this as a hard rule). Write it
in this order, each part one to five lines (house), so it gets read. Leave a part out only when
it has nothing in it, except **Not checked**, which is always there.

- **The file**: path, length, size, frame rate and loudness, all measured on the file you
  deliver, not on the timeline or an earlier render.
- **My read**: the one paragraph from [read.md](read.md), then what you assumed because you
  couldn't ask.
- **What changed**: in the person's terms. Quote the words that went or moved, never segment
  numbers. Give totals for automatic passes: seconds and percent removed, how many candidates
  accepted of how many. Anything changed *from* their recording (a rebuilt screen, added time,
  a line moved) gets its own line, because it's the part they didn't film.
- **Profile**: which of their rules or measured numbers changed the plan, and which guide
  defaults you used for lack of one ([../TASTE.md](../TASTE.md)).
- **Measured**: what a program counted, with the number: frame count against the one you worked
  out, loudness, the frozen-stretch and stray-frame scans, draft against final, coverage.
- **Looked at**: the stills or strips you opened, and where: "strips across all 31 cuts",
  "entry, middle and exit of all 6 titles". A sheet you made and didn't open isn't looked at.
- **Not checked**: said plainly. First, anything that needs ears or playback when you can't
  hear or watch: "I measured the sound; I did not hear it." Then give the 3 to 6 (house) exact
  times most worth their attention, most risky first, each with what to listen or look for.
- **Warnings left standing**: every check that warned, and the reason you left it. A warning
  can stand when you have a reason; it can't go unsaid.
- **Still open**: questions for them, and what you skipped for lack of a tool or service, with
  what setting it up would add ([read.md](read.md), "Work with what's set up").

#### Say how, not how sure

- **"Verified"** says nothing. Say how: "counted", "looked at stills of", "compared frame by
  frame".
- **"Should be fine" and "looks good"** are guesses dressed as checks. Say what you looked at,
  or move it to Not checked.
- **Never "all checks passed"** without listing the checks. A list lets them see the one you
  didn't run.
- **Never a score out of 10.** It hides which part is weak.
- **A measurement proves what it measures.** A matching frame count doesn't prove the right
  frames were picked; a loudness number doesn't prove a join sounds right.

#### A revision round

Send only what changed since the last hand-over. Quote each note it answers, with the change
made for it and whether the note became a rule or was a one-off ([notes.md](notes.md)). Measure
the new file again, and say which of the earlier checks you ran again and which you didn't.

When the person only asked for a small change, the note is two or three lines (house): the
change, how you checked it, what you didn't.

#### An example

A made-up 9-minute tutorial edit. Every name and number is an example, not a target. Times are
in the delivered file.

```
File: out/queues-draft-1080p.mp4 · 9:04.0 · 1920×1080 · 30 fps · 412 MB · −14.2 LUFS,
  peak −1.3 dBTP, measured on this file. It's the draft; nothing is rendered full size yet.
My read: A screen tutorial for developers new to queues, watched on a laptop. The point is the
  retry demo at 6:10; the words and the screen carry it. Assumed, not asked: it's for YouTube,
  wide, and the sponsor mention stays.
What changed: 14:12 → 9:04 (5:08 out, 36%).
  - Failed takes: 23 of 31 candidates removed, 3:07. The 8 I kept are in candidates.json.
  - Pauses over 1.2 s shortened to 0.4 s: 64 places, 1:11 (8% of the recording).
  - Cut whole: "let me restart the server real quick" through "okay, we're back", 0:50.
  Changed from your recording:
  - "This is the part people get wrong" moved from 7:40 to open the video.
  - The dashboard at 4:31–4:52 is rebuilt from the real page; the recording is blurred there.
Profile: Your rule "never cut my laugh" kept 2 of the 8. Your measured 0.4 s join replaced the
  guide's 0.3 s. You have no rule for titles, so the 6 titles use the guide's defaults.
Measured: 16,320 frames, the count I worked out. Stray frames at cuts: 0. Frozen stretches: 1,
  at 4:31, the rebuilt screen, meant. Titles over your face: 0 frames.
Looked at: strips across all 90 joins; entry, middle and exit of all 6 titles; the first 3 s
  frame by frame.
Not checked: I measured the sound; I did not hear it. Nobody has watched it play. Most risky
  first:
  - 0:00–0:12: the moved line into your real opening. Does your voice match across it?
  - 6:08: the tightest join, 0.2 s, just before the demo. Does a word sound clipped?
  - 4:29 and 4:53: into and out of the rebuilt screen. Does the room sound hold?
  - 2:41: a join inside a sentence. The level scan is clean; the rhythm isn't measured.
Warnings left standing: the music is 2 dB over its target at 8:50. Left: it's the outro, with
  no voice under it.
Still open: Is the sponsor mention at 1:15 still current? No stock-footage service is set up,
  so 3:20–3:40 stays on your face; one would put pictures there.
```
