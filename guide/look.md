### Look at the picture

Covers seeing what's on screen: contact sheets, reading small text, and finding when words are
shown rather than said. Everything here is a default that the person's profile or words
override, except what's marked `(hard rule)`: see [rules.md](rules.md).

- **The transcript is half the video.** It has what was said, not what was shown: the command
  typed but never read out, the slide's heading, the product on the table, who is in the shot.
  For a screen demo, a tutorial or slides, the screen often carries the point
  ([read.md](read.md): what carries it). Look before you cut a stretch where nobody talks, and
  before you put B-roll or a title over a screen someone needs to read.
- **Skim with a sheet, then zoom in on time.** A contact sheet of a dozen frames shows a whole
  stretch at once: where the shots and screens change, which part is worth a closer look. For
  that part, make a sheet of just it; a few sheets get you to the second without watching
  everything. A sheet samples: anything shorter than the gap between its frames can be missing.
- **Read small text from a crop, never from a sheet.** A terminal, code, a URL or a slide's fine
  print is a few pixels tall on a sheet, and a guess at it ends up wrong in a title or a caption.
  Crop that region of one frame at the file's own resolution, enlarged, and read it there.
- **Search what's on screen like the transcript.** When you need the moment a command, a name or
  a heading is shown ("cut to where the error appears"), read the screen's text over the stretch
  and search it. Text read off frames has misreadings, like a transcript: crop the hit and read
  it yourself before you quote it.
- **Keep the footage local** (hard rule, from [read.md](read.md)): read the picture with what's on
  this computer. Don't send frames to an outside service to describe or read them.

#### With the script

Paths are from this skill's folder. `scripts/look.mjs` needs Node 22 or later and ffmpeg; `text`
also needs tesseract, and when it's missing, do the same with sheets and crops by eye.

```
node scripts/look.mjs sheet talk.mp4 --from 120 --to 300 --count 12 --out sheet.png
node scripts/look.mjs crop talk.mp4 --at 184.5 --box-rel 0.05,0.6,0.5,0.3 --out crop.png
node scripts/look.mjs text talk.mp4 --every 1 --find "npm install"
```

`sheet` writes one image of evenly spaced frames, each stamped with its time when ffmpeg can draw
text, and prints the time of each tile. `crop` cuts a box (`--box` in pixels, `--box-rel` in
fractions of the frame) out of one frame, enlarged up to 4×. `text` reads the screen every
`--every` seconds and prints the stretches that show the same text; `--find` keeps only the
stretches with those words, and `--box-rel` reads only part of the frame (a terminal in the
corner, a lower third), which also finds text too small to read in the whole frame. Times are
seconds in the file: the source clock for a recording ([transcript.md](transcript.md)).
