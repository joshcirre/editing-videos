### Check before you hand it over

Covers what to look at, listen to and measure before you say an edit is done.
Everything here is a default that the person's profile or words override, except what's marked
`(hard rule)`: see [rules.md](rules.md).

Check the rendered file, not the timeline. The timeline is what you meant; the file is what the
viewer gets, and stray frames, black gaps and clipped words only exist in the file.

#### Look

- Look at the frames on both sides of every cut, and the first seconds frame by frame.
- **Look at frames in a row across a cut, not single stills.** Five before to five after
  (house), side by side, shows a stray frame, a flash and a layer that outlives its shot. One
  still from each side shows none of them.
- Scan the render for two picture changes within a few frames of each other and look at each
  one: that's a stray frame left at a cut. Within 8 frames (house) is worth a look.
- A still can't show a picture that has stopped moving. Scan the render for frozen stretches
  (`ffmpeg -i out.mp4 -vf freezedetect=n=-60dB:d=0.5 -an -f null -` lists each one's start and
  length; half a second catches short freezes, and the script warns from 3 s) and look at any
  that should be moving. A held slide is right; a held person isn't.
- Scan for black: a gap of half a second or more (house) is a hole in the timeline
  (`-vf blackdetect=d=0.5`). Look at the first frame too. Many players show it as the poster.
- Look at stills across the arrival and the exit of every overlay, not only its middle. That's
  where the mistakes are. An overlay that starts or ends a few frames off a cut is a mistake:
  put it on the cut, or clear of it.
- Check captions against the words and B-roll against what's being said at that moment.

#### Listen

- Listen across every join and to the last word. If you can't hear, say so: a person should
  (hard rule). A tool that said it worked, a render that finished or a clean level scan doesn't
  prove a join sounds right.
- **A transcript is not proof a word sounds whole.** Transcribing the render again and comparing
  the words at each join finds a missing or doubled word, so it's worth doing. It doesn't find
  a clipped one: speech-to-text guesses a word with its first or last sound cut off and spells
  it correctly.
- Measure the loudness of what you'll deliver: the exported file, the whole of it. For video
  platforms that's −14 LUFS and a true peak under −1 dBTP (standard): YouTube's playback level,
  measured the EBU R128 way. Encoding moves the peak, so a mix that was right can be over.
- Scan the sound for silence in the middle (2 s or more (house)) and for places where it drops
  to nothing at all: that's a join with no room tone under it.

#### Draft, then full size

- When a render takes minutes, render the few seconds a change touches and look at those
  before rendering the whole.
- Work in a small draft (1080p (house), light copies of the footage) and send a short preview of
  each change. Render full size only once the draft is approved. For the full size, make screens,
  graphics and cutouts again at that size instead of enlarging the draft's; then compare the
  final with the approved draft, frame by frame at the draft's size, and look at every
  place they differ. The frame count and the sound should be the same.

#### Trust a check only after it has failed

- **Try each check on something known to trip it.** A scan that has never found anything may
  not be able to. Before you believe "no stray frames", put three wrong frames into ten
  seconds of the video and see the scan find them; same for black, loudness and the rest.
  This guide's own scan missed a single stray frame until it was tried on one.
- **A clean scan is not a clean edit.** A scan says where to look. It can't say a cut is good,
  and it misses what its thresholds weren't set for: a soft jump cut, a moving camera.

#### Say what you found

- Reread your read: does the edit make the point, for those viewers, there?
- Write each finding as one line, `time · where · problem → exact change`, most serious first:
  `01:12.07 · join after "the queue" · one frame of the next take → trim 1 frame off the end`.
  The exact change is what makes it a finding and not a feeling.
- **Never give the edit a score.** "8 out of 10" finds nothing to fix. A list of what's wrong
  and where does.
- Say what you changed, your read and what you assumed, how each claim was established
  (measured, looked at, or not checked), and what a person should check by eye or ear
  (hard rule). [handover.md](handover.md) has the format.

#### With the script

Paths are from this skill's folder. `scripts/check.mjs` needs Node 22 or later and ffmpeg, and
runs the scans above on a rendered file. With no check named it runs `cuts`, `stray`, `frozen`,
`black` and `sound`; the other three run when you give their option.

```
node scripts/check.mjs out.mp4                          # the five that need nothing else
node scripts/check.mjs out.mp4 --out strips/            # and a strip of frames per cut
node scripts/check.mjs out.mp4 --from 60 --to 90        # one stretch, in seconds
node scripts/check.mjs final.mp4 match --against draft.mp4
node scripts/check.mjs out.mp4 layers --ranges layers.json
```

| Check | Fails on | Warns on |
|---|---|---|
| `cuts` | nothing: it lists the cuts, with frame numbers | |
| `stray` | two cuts within 8 frames (`--stray`) | |
| `strips` | nothing: it writes the pictures for you to look at | |
| `frozen` | | no change for 3 s or more (`--frozen`) |
| `black` | black for 0.5 s or more (`--black`) | a black first frame |
| `sound` | more than 1 LU from −14 LUFS; peak over −1 dBTP; no sound | silence of 2 s; holes |
| `match` | frame counts differ | where the picture or the sound's level differs |
| `layers` | a layer edge 1 to 8 frames from a cut (`--near`) | |

The thresholds are the script's (house) defaults; −14 LUFS and −1 dBTP are (standard).

- A cut is one frame that changes a lot between frames that don't: a score over 0.045 with
  neighbours under 0.03 (measured), on one creator's fixed-camera tutorial and its finished
  edit. Change them with `--cut-score` and `--quiet-score` for other footage.
- `strips` writes frames −5 to +5 around each cut in one row, a red bar on the first frame
  after the cut, at most 40 (`--max`), and says how many it skipped. `--at 12.5,48` makes them
  at times you choose, such as each overlay's start and end. Open them. Nothing else here looks.
- `layers` takes `[{"name": "shade", "start": 12.3, "end": 15.1}, …]`, seconds in the video,
  and also lists layers that cross a cut, which is right for some and wrong for others.
- `match` compares pictures at 480×270 and lists stretches more than 10 dB (house) under the
  usual likeness as places to look. For the sound it says same, or where the levels differ.
- It prints one line of JSON (`ok`, `failed`, `warned`, counts), the findings with times on
  stderr, and exits 1 when a check failed. `--json report.json` keeps every finding.

Its limits, honestly:

- **It can't judge** whether a join sounds right, whether text is readable, or whether B-roll
  matches the words. Those are still yours, or a person's.
- **`stray` has false alarms.** On the finished edit it was measured on, all three places it
  failed were meant: a hand moving right after a cut, a reveal, a number changing. A screen
  that scrolls does it too. Look at the strip; if it's meant, say so in the hand-over.
- **It misses soft cuts.** A jump cut between two takes at the same framing can score under
  the threshold, so "no stray frames" doesn't mean every cut was seen.
- **A stretch isn't the file.** With `--from` and `--to` the loudness is that stretch's.
