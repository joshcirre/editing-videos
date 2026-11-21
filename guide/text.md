### Text and captions

Covers captions, titles, graphics, shades and dims under text, and text behind a person.
Everything here is a default that the person's profile or words override, except what's marked
`(hard rule)`: see [rules.md](rules.md).

- **Captions** are exactly what was said (with names spelled right), timed to the words (hard rule),
  one group on screen at a time, split where a phrase ends. Size the groups by the pace
  ([pace.md](pace.md)); subtitles are at most 42 characters a line, two lines (common), and at
  least 0.7 s on screen (house). Lines in a group are about even, break after punctuation, never
  end on a small word (`the`, `of`), and never split an amount (`$5 million`, `40 percent`).
- **Highlight the words that matter**, at most one a caption group, two on one of five words or
  more (house): numbers first (prices, percentages, years, counts), then names, then the word the
  line turns on (`never`, `free`, `broke`), then the topic the first time it comes up. Never a
  filler, and not every group needs one. A name said again rarely does. Rules find numbers and
  names; choosing which line's point to stress is the editor's call.
- **Never cover** a mouth, a face that's talking, or what the viewer needs to read on a screen
  (hard rule). Make them readable over anything: a box or a strong shadow, checked against what's
  behind. Over footage that is the point (a montage, a demo), text goes to a side or a corner so the
  picture still shows, and the shots can keep changing under it while it holds.
- **Titles** stay long enough to read twice (about 1 s plus 0.3 s a word (common), at least
  2 s; a number that is the point, about 3 s (house)). A person's name goes up when they first
  matter, not in the first second. One title at a time, one style throughout.
- **Every name, number and count on screen has a source** (hard rule): what was said, or a file you
  can point to. A figure you worked out yourself (videos counted in a folder, a list added up) is a
  guess until the person confirms it: say how you got it and ask.
- **A graphic is never empty** and shows what the words don't: the evidence, the relationship,
  the example. It doesn't just repeat the caption.
- **Nothing that changes the light of the frame pops on or off.** A shade or gradient under
  text arrives before the first word and leaves after the last, moving both times: it slides
  out as smoothly as it slid in, and is gone a frame before any cut, never with the cut. It
  doesn't stay after its words (hard rule). A dim of the whole frame starts and ends only on a cut.
- **Check timing against cuts** with `jcss edit check <edit>` (`jcss_edit_check` on MCP).
  It reports short slivers and longer visual-layer crossings, the seconds on each side, and
  video source/rect/fit layout changes. A title meant for one shot should end, faded, before
  the cut, not cover a newly split picture. Review the offered `jcss edit run` retime/restyle
  array (or pass it as `commands` to `jcss_edit_layers`), then check again. Scene-local pieces
  and audio aren't long-crossing warnings. An intentional across-cut title may stay.
- **Text behind a person** needs their cutout on every frame the text or its shade is visible, the
  arriving and leaving frames included (hard rule). A cutout that starts late lets the shade cross
  their face and then jump behind it. [behind.md](behind.md) has the whole method.
- **A fix to one overlay is a fix to all of that kind.** When a note changes how one title or
  shade arrives, change every one and look at each.
- **Fill a box on one line:** `edit text --fit` (`words.fit: true`) ignores `size` and finds the largest ink that fits both dimensions, including padding. It follows box resizing. `edit restyle <edit> <layer> --no-fit` restores the saved size.
- **Flank a head:** `jcss edit text <edit> "LIKE|THIS" --flank --from 2 --to 5 --shadow` creates two fitted words in one group behind the person. Without times it uses the whole edit; `--group` names the group, otherwise it derives a unique name. Exactly two words are required (`LIKE THIS` also works). MCP: `jcss_edit_text {id, from, to, words:{text:"LIKE|THIS", shadow:{}}, flank:true}`. It makes/tops up the behind matte and unions the head over up to 12 samples, through the video's camera/framing. The answer includes the head box, each rect, drawn size and mean matte alpha over the word's drawn ink box (including shadow extents), not the mostly empty layer rect. At 0% it warns "not behind the head — inner edge doesn't reach it"; above 25% it warns "letters likely lost behind the head"; otherwise "inner edge tucked behind the head". These are baked normalized rects: rerun placement after changing the shot or timing. The `scripts/cover.mjs` 30–55% band is for text behind a person, not flank text beside a head. Inspect the whole span for lost letters; sparse ink-box sampling is not a glyph-level occlusion guarantee. No video, failed matting or no detected person is an error; the edit is not changed.
- **Soft shadow without a box:** `--shadow` adds 40% black with blur 10 and zero offset at 1080; `--shadow-blur <px>` or `--shadow-color <color>` implies it. MCP uses `words.shadow: {color, blur, dx, dy}`; `{}` takes the defaults. Restyle changes only passed fields; `--no-shadow` (`set.words.shadow: null`) removes it.
- **Fit the ink, not the nominal font size.** In JCSS, `edit text` and `restyle` report the size
  actually drawn, wrapping and the ink box in canvas pixels. `--pad 0` aligns left/right ink
  flush with the layer's rect; without `--pad`, only a shade adds horizontal padding (a
  quarter of the drawn size, capped at a sixth of the box width). `--pad <px>` uses the same
  1080-reference pixels as `--size`. Use `edit restyle <edit> <layer> --pad <px>` or
  `restyle`'s `set.words.pad` to change it. Run `edit check` for text that shrinks or wraps a
  single word, then look at a still. A multiword wrap can be intentional; do not assume a
  requested size was the size drawn.
