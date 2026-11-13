### The transcript and its clocks

Covers making and reading a transcript, keeping its times true after every cut, and fixing names.
Everything here is a default that the person's profile or words override, except what's marked
`(hard rule)`: see [rules.md](rules.md).

#### Make it first, read it packed

- **Make a transcript with a time for every word before anything else**, with what's set up: the
  editor's own, or a speech-to-text tool already on this computer ([read.md](read.md)). Phrase
  times alone aren't enough: a caption, a title and a cut all land on a word.
- **Word times are estimates, not cut points.** They find the place; the sound decides the frame
  ([cut.md](cut.md)).
- **Read it packed by phrase, not as raw JSON.** One line per phrase, `[12.30–15.84] the words of
  the phrase`, broken where the speaker pauses 0.5 s or more (house) and at sentence ends. That
  is about a seventh of the size of the word list (measured) on one 14-minute tutorial, so you
  can read a whole long video and keep it in mind. Go to word level only where something lands:
  the words on each side of a cut, and the word a graphic or caption arrives on.

#### One clock per stage

A time means nothing without the clock it was read on. There are three:

- **Source clock**: the recording as it was shot. Cut decisions are made here.
- **Cut clock**: the video after the cut. Everything after the first removed stretch is earlier.
- **Final clock**: after added time (a cold open, a closing card) and speed changes: the file
  people watch.

Rules that keep them apart:

- **Every file says its clock in its name**: `words.source.json`, `words.cut.json`,
  `words.final.json`. Do the same for anything else that holds times: markers, captions, a
  list of graphics.
- **Never read a time on one clock and use it on another** (hard rule). A graphic timed from the source
  words lands late by everything cut before it: right at the start, seconds off by the middle.
  Convert through the map of what was kept, or read the time from the words on the right clock.
- **Every step that changes time writes the words again on its own clock**: a cut, a speed
  change and an insert each move every later word. Retime from the source words each time, with
  the whole list of changes, so rounding doesn't pile up and one map leads back to the recording.
- **Work out the new times from the frames that are cut, not from the times you asked for.** An
  editor moves each range edge to a whole frame (up to half a frame, 0.017 s at 30 fps). Snap the
  ranges first and add up their lengths in frames; then the words agree with the picture.
- **A video that arrives already cut is on its own clock.** Transcribe that file and call the
  result `words.cut.json`; you never need the recording's times.
- **A range edge that runs through a word means the cut is wrong**, not the transcript: move the
  edge into the silence beside the word ([cut.md](cut.md)), then retime again.

#### The order that stays in sync

1. Cut, on the source clock.
2. Retime the words onto the cut clock; with inserts and speed changes, onto the final clock.
3. Captions, titles and graphics, timed from the retimed words ([text.md](text.md)).
4. Music and sound, placed against the final picture ([sound.md](sound.md)).

- **When the cut changes later, retime again and make again everything timed from words.** Don't
  nudge captions or graphics by hand: a hand fix is right for the one you looked at and wrong for
  the next. Keep each graphic's time as "on this word" (the word and its source time) so it can be
  placed again from the new file.
- **Check the arithmetic**: the retimed length times the frame rate is the render's frame count.
  If it isn't, something moved time that the words don't know about.

#### Names and jargon

A transcriber spells what it hears. Product names, people's names and terms of the trade come
out as ordinary words ("cloud" for "Claude"), and a caption shows that to everyone.

- **Before captions, list what's likely wrong**: words the tool marked as unsure (low confidence,
  when it gives one), every proper noun, and every term from the brief, the title or the screen
  that should appear and doesn't.
- **Build a corrections list and show it to the person**: `"cloud" → "Claude"` with the times it
  applies. The same sound can be right in one place and wrong in another, so correct by place,
  not by search and replace. They know how their own names are spelled.
- **Fix the spelling without changing the times.** Change the text of the word and nothing else.
  When two words become one, keep the first start and the last end. Correct the source words,
  then retime, so the fix survives the next cut; keep the list for the next video.

#### Check

Transcribe the finished file again and compare its words around each join with the retimed
words: a missing or doubled word, or a word more than about 0.3 s (house) from where you expected
it, means a join or an offset is wrong. Its limit: a transcriber guesses a whole word from most
of one and its times are estimates, so it finds wrong words and drift; only listening finds a
clipped sound ([check.md](check.md)).

#### With the script

Paths are from this skill's folder. `scripts/retime-words.mjs` needs Node 22 and nothing else.

```
node scripts/retime-words.mjs --pack words.source.json
node scripts/retime-words.mjs --words words.source.json --cut cut.json --out words.cut.json
node scripts/retime-words.mjs --words words.source.json --cut cut.json --out words.final.json \
  --speed "start=100,end=150.6,rate=4" --insert "at=0,len=3,name=cold open"
node scripts/retime-words.mjs --time 83.4 --via words.final.json
node scripts/retime-words.mjs --time 71.2 --via words.final.json --to-source
```

- `--pack` prints the phrase view, of a retimed file too.
- The retime snaps `cut.json`'s ranges to its `fps`, moves each kept word, drops removed and
  sped-up words, and writes the map back to the source into the file. Each word keeps `src`,
  its source start. `--insert`'s `at` is on the clock before any insert.
- It exits 1 and writes nothing when a range edge runs through a word, and lists each one with
  both clocks. A word that reaches under half a frame past an edge is not counted. It can't tell
  a clipped word from a word whose time is off: listen to decide.
- `--time` converts one time between the source clock and the file's clock. It exits 1 for a
  moment that was cut out, or one inside an insert, and names the nearest moment kept.
