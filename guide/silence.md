### Find the silence

Covers measuring where a recording is silent, which pauses are dead air, and which are safe to
cut at. Everything here is a default that the person's profile or words override, except what's
marked `(hard rule)`: see [rules.md](rules.md).

This file is only about finding pauses. How much of one to keep is taste: see [pace.md](pace.md)
and the person's profile ([../TASTE.md](../TASTE.md)).

- **Silence is measured, not guessed.** A transcript shows gaps between words, not silence: a
  breath, a laugh, a keyboard or a held "s" can fill a gap, and a word can run on into one.
  Measure the level of the sound itself before you call any stretch silent.
- **Take the threshold from the recording.** A fixed level such as −30 or −35 dB finds silence
  everywhere in a quiet recording and none in a noisy one. Measure this file's loudness first
  and set the threshold from it: about 10 dB under its overall speaking level, which is the gate
  a loudness measurement (EBU R128) already reports, kept between −60 and −25 dB (house). Use
  −35 dB (common) only when the file can't be measured, and say that you did.
- **Measure where there's speech, one source at a time.** A stretch with no talking gives a
  threshold down at its own noise floor, and then nothing in it counts as silent. A different
  microphone or room is a different recording with its own threshold.
- **A pause in the sound is only dead air if the picture is idle too.** While nobody talks, the
  screen may be loading the result, the person may be typing, pointing, reacting or holding
  something up. Check the picture across every pause you mean to remove: it's dead air when the
  picture holds still for most of it, about 60% or more (house). A long quiet stretch is rarely
  one thing: find the still parts inside it and treat the rest as action
  ([pace.md](pace.md): the screen sets it).

#### Word times and real pauses

- **Words from a transcriber touch each other and end early.** Most give every word an end equal
  to the next word's start, also across a real pause, and put a word's end 40–100 ms (common)
  before its last sound dies. A cut placed on those times clips a consonant or lands inside the
  pause's first breath. Place cuts by the sound: [cut.md](cut.md) has the hard rule.
- **Snap word edges to the real pauses first.** Where a word's end sits within about 0.12 s
  (house) of where a measured silence starts, the silence start is the true end of the word;
  where a word's start sits that close to where a silence ends, the silence end is its true
  start. Never move an edge across another word. Then cut from the snapped times.
- **Which pauses are safe to cut at:**

  | The measured pause | Cut there? |
  |---|---|
  | 0.4 s or more (common) | Clean: both words are whole and there's room for a breath. |
  | 0.15–0.4 s (common) | Look at the waveform and listen to the join before you keep it. |
  | Under 0.15 s (common) | Not a cut point. The words run together; cut at the next pause. |


#### The ends of a file, and the gaps you make

- **Leading and trailing silence is its own case.** Most recordings start before the person
  speaks and stop after they finish. Find the first and last sound, trim to them, and keep a
  short lead-in so the first word isn't clipped: about 0.1–0.2 s (house). A silence that begins
  more than 0.5 s (common) into the file isn't leading silence; something came before it.
- **Put room tone under any gap you create.** Removing or shortening a pause, or laying a gap
  between two pieces, leaves digital silence, which sounds like a fault. Run the recording's own
  quiet under it: a stretch of measured silence of 0.4 s or more (common) is where room tone
  comes from ([sound.md](sound.md)).

#### With the script

Paths are from this skill's folder. `scripts/silences.mjs` needs Node 22 or later and ffmpeg.

```
node scripts/silences.mjs talk.mp4 --still --words words.json --out words.snapped.json
```

It measures the file, takes the threshold from it (`--noise <dB>` sets your own), and writes
`silences.json`: the threshold and how it was chosen, the measured loudness, each silence of
`--min 0.3` s or more with `start`, `end` and `dur`, and `leading` and `trailing` seconds.
`--still` adds `still`, `still_share` and `still_ranges` (the frozen parts) to each silence.
`--words` writes the transcript again with its edges moved onto real pauses down to 0.15 s, and
reports how many moved and the median shift. `--from` and `--to` limit all of it to one stretch.
Give it the file that carries the sound: a picture-only proxy has nothing to measure.
