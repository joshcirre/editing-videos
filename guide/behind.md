### Text behind a person

Covers when big text behind someone is worth it, the layers, getting and cleaning a cutout, how
much of the text the person should cover, when each layer starts and ends, and how to check it.
Everything here is a default that the person's profile or words override, except what's marked
`(hard rule)` in [text.md](text.md): see [rules.md](rules.md).

#### When it's worth it

- **One word or short phrase that is the beat**: a title, a name, the point of the stretch. It
  goes in the energetic parts (the opening, a turn, the close), not on every line and not in the
  calm middle ([pace.md](pace.md)). Used more than a few times in a video it stops being special.
- **It needs the right shot**: one person, a fixed or slowly moving camera, and space around
  their head. Two people, a fast move or a head that fills the frame give a matte that flickers
  or text nobody can read: use a plain title there.

#### The layers, bottom to top

1. The footage.
2. A shade or gradient, only if the background is too busy for the text to read.
3. The text.
4. The person's cutout: the same frames with everything but them transparent.

The sound plays once, from the footage. Mute the cutout, or the voice doubles.

#### Getting the cutout

- **Use what's already set up.** Any of these makes one: the editor's own background removal, a
  vision framework that comes with the system, a matting model that's installed, HyperFrames'
  `remove-background`, Remotion's video matting, JCSS's `jcss edit behind`, which makes and
  keeps the cutout itself ([../JCSS.md](../JCSS.md)). None of them is required.
- **When nothing is set up, don't fake it.** Put the text beside the person instead, never on a
  flat card over them, and say in your report what a matte would add.
- **Make it once and reuse it.** Save the result as a video with alpha (or a black-and-white
  mask) and lay that file in. Never run the model during a render: it's slow, and two runs can
  give two different edges.
- **Same frames, same size.** Make it from the exact stretch under it (same trim, crop, speed
  and frame rate), or the outline slides off the person. Make it at the delivery size: a 1080p
  cutout over 4K footage is a soft person on a sharp background.

#### Cleaning it

- **Drop small detached pieces.** Matting takes bright or skin-coloured things on the wall for
  part of the person, and they flicker in front of the text. Keep the largest piece and anything
  touching it; remove pieces under about 1% of the person's area (house), but not a raised hand.
- **Soften the edge a little.** Pull it in and blur it by about 1–2 px at 1080p, twice that at
  4K (house), to hide the fringe of old background. More, and the text shows through the hair.
- **Look at hair and hands while they move**, not on one still: a matte that's fine at rest
  can tear on a fast gesture. And it can't bring back what the person was hiding, so a strong
  blur of the background behind them leaves a halo.

#### Coverage

- **The person covers 30–55% of the text's box** (house): enough that it reads as behind
  them, with enough left to read. Under about 15% the text floats beside them; over about 65%
  it's eaten (house). These come from one published guide: treat them as a starting band.
- **Measure it across the whole time the text is up**, not at one frame: heads move, and a
  lean can take a word from half covered to gone.
- **When a stretch leaves the band, lay it out again**: move the text, resize it, shorten the
  words, or end it earlier. Don't move the text to follow the head.
- **The covered part should be the middle of a word or the gap between two**, so both ends
  still show. A short word hidden whole behind a head is a missing word.

#### Time

- **The cutout is there on every frame the text or its shade is visible**, the arriving and
  leaving frames included. That's a hard rule: see [text.md](text.md). A cutout that starts
  with the words lets the shade cross the face on its way in and then jump behind it.
- **The shade arrives first and leaves last.** It slides in about half a second before the
  first word (house), the words fade out before it goes, it slides out the way it came, and it's
  gone a frame before any cut. So the cutout file starts when the shade starts and ends when
  the shade is gone.
- **End it on a cut to a different framing.** Text held behind the person through a cut to a
  wider or tighter shot sits in a new place against them and looks like a mistake. A cut that
  keeps the same framing can carry it, with a cutout for both sides.

#### Type that survives being covered

- **Heavy, large and few**: a bold or black weight, letters about 15–30% of the frame's height,
  one to three words (house). Thin strokes vanish behind hair, and a long line can't lose a
  third of itself.
- **Contrast against the background, not the person.** The text sits on the wall behind them,
  so pick its colour against the wall. If the wall is busy, that's what the shade is for.

#### Check

- **Three stills of every one**: the middle of its arrival, its middle, the middle of its exit.
  In each, nothing crosses the face and the words read.
- **A strip of frames across any cut it touches** ([check.md](check.md)): the text and shade
  are gone before the cut, and the cutout doesn't run one frame into the next shot.
- **The coverage numbers** for the whole time it's up, and the cutout's first and last frame
  against the shade's.
- **Then every other one in the video.** A fix to one is a fix to all of that kind. Say which
  of these you looked at, and that a person should watch hair and hands in motion.

#### With the script

`scripts/cover.mjs` (paths are from this skill's folder; Node 22 and ffmpeg) measures coverage
from the cutout file. `--box` is the text's box in the cutout's own pixels; `--offset` is where
the cutout's first frame sits in the video, so every other time is a time in the video:

```sh
node scripts/cover.mjs --matte cutout.webm --box 960,300,1920,500 \
  --offset 12.0 --from 12.5 --to 15.2 --must-cover 12.0,15.9
```

It prints one line of JSON: min, median and max coverage, the time ranges outside `--band` and
`--limits`, where a detached piece of the matte sits over the text, and the first and last time
anyone is in the matte. It exits 1 when coverage leaves the limits for 0.2 s or more, or when
the cutout doesn't span `--must-cover` (the shade's time). `--mask` reads a black-and-white
mask, `--box-rel` takes fractions of the frame, `--words-boxes` several boxes with their own
times. It measures the box, not the letters, and can't judge edges: still look at the stills.
