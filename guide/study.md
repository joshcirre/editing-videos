### Studying how videos are edited

Covers measuring a person's finished videos, or a channel they admire, and turning what you find
into the numbers of their profile. Everything here is a default that the person's profile or
words override, except what's marked `(hard rule)`: see [rules.md](rules.md).

Measure, don't eyeball: "it feels tight" can't be checked next week, "0.33 s kept after the last
word" can. Copy how the videos are edited and nothing else: see [notes.md](notes.md).

#### When to study

- **They want a video to feel like others**: their own past edits, or a channel they admire.
- **There's no profile and they have finished videos.** Measuring beats asking: people know what
  they like when they see it, and rarely know their own pause length.

**Pick 3–6 (house) finished videos of the same kind.** A tutorial and a short are cut by
different rules, so a median across both describes neither. One video is one day's choices;
three show a habit. Say which videos you used.

#### What to measure, and what each number changes

| Measure | The default it replaces | In |
|---|---|---|
| Silence after the outgoing word and before the incoming one | the pause at a join | [cut.md](cut.md) |
| Pauses between words: median, longest tenth | how far silence is tightened | [silence.md](silence.md) |
| Shot length: median, shortest tenth, longest hold | how often the picture changes | [pace.md](pace.md) |
| Cuts a minute, first 30 s against the rest | how much faster the opening is | [shape.md](shape.md) |
| When the first word and the first cut come | how the video starts | [shape.md](shape.md) |
| Share of pauses that carry a picture cut | a join hidden or shown | [broll.md](broll.md) |
| Loudness, true peak, loudness range | the mix target | [sound.md](sound.md) |
| Level in the pauses against the voice | music under the voice, or none | [sound.md](sound.md) |
| Words a second while speaking | none: it scales how a pause reads | [pace.md](pace.md) |

- **Measure the two sides of a join apart.** People leave the breath after a sentence and start
  the next one almost on the word: 0.33 s after and 0.08 s before (measured) is a different
  edit from 0.2 s each side, at the same total.
- **Take the median and the range, not the mean.** One 40 s screen demo moves a mean.
- **Shot lengths that barely vary are a finding.** A spread under a tenth (house) of the mean
  is cutting on a clock, not on the content.
- **Word timings end early.** A transcript often stops a word before its sound does, so a
  pause can read about 0.15 s (measured) longer than it sounds. Check three (house) against the
  sound.
- **The picture shows hard cuts only.** A dissolve, or a join in the sound under a screen that
  doesn't change, is counted by looking and listening.

`(measured)` here means measured on one creator's own cut of one tutorial.

#### What can only be looked at

Make a sheet of stills, one every 2 s (house), for each video. Write what you see in words, with the
video and the time, and offer the lines for `## Look` of the profile once they confirm them:

- **Captions**: there or not, font, size against the frame, words at a time, where they sit.
- **Text**: on a plate, over the screen or behind the speaker; one piece at a time or several.
- **B-roll and screens**: how often, how long, full frame or beside the speaker, how it's framed.
- **The speaker's size**: how much the framing changes across a cut, and how often.
- **Colour**, the first frame, the last frame, and any transition that isn't a hard cut.

Listen to the first 30 s and three joins (house) too: music or none, and which effects land on
cuts.

#### The best study: their cut beside the raw recording

A finished video shows what stayed; their cut next to the recording shows what they threw
away, and that is most of their taste. Use a timeline file if there is one (Descript, Premiere,
Final Cut XML); otherwise the cut video and the recording, with a transcript of each.

1. **Map each kept piece back** to its place in the recording: start, end, in order.
2. **Name everything between the pieces**: a failed take, a restart, a reset ("okay"), a
   tangent or dead air. Count each kind, and add up its time.
3. **Compare pauses inside kept pieces** with the same pauses in the recording. If they match,
   this person removes takes and leaves the air alone; tightening silences would undo that.
4. **Split the pause at every join** into after-outgoing and before-incoming.
5. **Look at the shortest pieces.** If almost none are under 5 s (measured), they don't stitch
   a sentence from fragments, and neither do you.

#### Write it down, then prove it

- **Each finding is one line with its number** under `## Measured` in the profile
  ([../TASTE.md](../TASTE.md)): the value, what it was measured on, the date. "Joins keep 0.33 s
  after the word and 0.08 s before; 17 joins in one tutorial."
- **Ask about what looks deliberate but unclear**, one question each: "Every screen section opens
  with two seconds of silence. On purpose?" A habit they didn't choose isn't a rule.
- **Numbers measured on one person are theirs**, never a default for someone else.
- **Then edit a test stretch**, a minute or two (house), and measure it the same way before
  you show it. Joins within 0.05 s, shot median within a fifth, loudness within 1 LU (all
  house) count as matching. Put stills of yours beside theirs. The person shouldn't be the one
  to spot the difference.

#### With the script

`scripts/measure-style.mjs` (Node 22 or later, ffmpeg; paths are from this skill's folder)
measures a finished video. It doesn't do the cut-beside-recording study.

```sh
node scripts/measure-style.mjs video.mp4 --words words.json --out style.json --sheet sheets/
node scripts/measure-style.mjs --to-profile a.json b.json c.json --on "three tutorials"
node scripts/measure-style.mjs --compare mine.json theirs.json
```

Without `--words` it measures shots, the opening and loudness; pauses, joins and the music
level need word times ([transcript.md](transcript.md)). `style.json` says how each value was
measured and what it can't measure. `--to-profile` prints the `## Measured` lines; `--compare`
exits 1 when yours is off theirs. Check its cuts on a sheet first: a page that jumps in one
frame reads as a cut, and `--cut-score` moves the line.
