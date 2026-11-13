# Finishing a cut someone else made

The person cut the video themselves (in Descript, Premiere, Final Cut, anywhere) and wants it
finished: screens made sharp, graphics, text, music, a cold open. The rules are in the guide
([guide/read.md](guide/read.md) first); this file is how to do it without breaking their cut.
It was written from finishing a 14-minute talking-head tutorial with screen recordings, and the
numbers in it are starting points from that video, not laws.

Use whatever is set up to build the picture, and install nothing unasked. Nothing here needs a
particular tool. When there is a choice, take the first that fits: the editor's own timeline
and titles; ffmpeg with web pages drawn by `scripts/page-frames.mjs`; HyperFrames, when it is
set up or the person agrees to set it up, for a whole composed pass with many graphics and a
live preview; Remotion only when the project already uses it or the person asks for it
([MOTION.md](MOTION.md), "Which tool", has the reasons). The commands need ffmpeg, and
section 3 needs Node 22 or later and Chrome (see [MOTION.md](MOTION.md)).

## 1. Their cut is the timeline

- Ask which stretches they left whole on purpose, and what they want added by name. Those are
  the only places time may change.
- Keep one table for the whole job: each piece of their cut, its first frame in their file and
  its first frame in yours. Every later step reads frame numbers from that table. A frame number
  typed by hand after a place where time changes is wrong the next time that place moves.
- Add time (a card, a cold open) only at one of their cuts: split the table there and move
  everything after it.
- After every render, prove the cut is untouched:
  - the frame count is the one the table gives
    (`ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 out.mp4`);
  - their voice lines up. Take two seconds (house) of sound from their cut and the same two
    seconds from yours (by the table), before and after every place time changed, and find the
    shift where they match best. It must be 0 ms. A render can be the right length and still be a
    frame off after an insert.

## 2. Find their cuts in the picture

Cut times from a timeline file, a transcript or your own earlier version are close, not exact.
Read them from the picture:

```sh
ffmpeg -v error -i cut.mp4 -vf "scale=480:-2,select='gte(scene,0)',metadata=print:file=scene.txt" -an -f null -
```

`scene.txt` has a score for every frame. A cut is one frame that scores high (above about
0.045 for a person talking to a fixed camera) with quiet frames on both sides (below about
0.03) (measured). A fast move or a flash scores high for several frames in a row; that isn't a
cut.

Then snap to them. Everything that starts, ends or resets within a few frames of a cut moves
onto the cut: camera resets, titles, dims, cutouts, highlights. A layer that ends at a cut has
to cover the last frame before it, so count the frames of every file made for a range and
compare with the range.

## 3. Film a screen again from its real source

When the recording shows a web page or an app you have the code or the address for, draw that
page again instead of enlarging the recording ([guide/broll.md](guide/broll.md)).

1. **Get the real page.** The app's own repository for the person's own pages; the product's
   pages with stand-in data for a dashboard. Leave its code and styles alone. Sign in read-only
   if you must sign in, and never copy a key, a token or a deploy command into what you save.
2. **Give it what the recording showed.** Read names, numbers and states off the recording
   (stills and text recognition), frame by frame where they change, and feed those to the page.
   The live site may hold a later run. A graphic never mixes numbers from two runs.
3. **Find where the page sits in their frame**: the rectangle of the browser's content in the
   recording, to the pixel. Draw one still of your page and lay it over a still of theirs
   until text lines up; fix the page width and the scale, not the picture.
4. **Write what happens as steps**, from what they did: where they scrolled (smoothed, without
   the jitter), what they clicked, when. Add one highlight for each thing they name, starting
   on the word that names it and gone before the shot changes.

   ```json
   [
     {"at": 2.0, "scroll": 0},
     {"at": 4.5, "scroll": 640},
     {"at": 6.2, "move": "#deploy"},
     {"at": 6.6, "click": "#deploy"},
     {"at": 9.0, "run": "mark('.row[data-app=api] .latency')"}
   ]
   ```

   A highlight is drawn by the page itself (a `run` step that adds an outline around an
   element's own box), so it covers the whole word and moves with the page.
5. **Film it** at the size it has in the frame, opaque:

   ```sh
   node scripts/page-frames.mjs http://localhost:5173/ plate --duration 18 --fps 30 \
     --size 1226x668 --scale 1.5 --jpeg 95 --steps steps.json --at 2,6.6,9
   ```

   `--size` is the page's own width and height in CSS pixels, and `--scale` is how many frame
   pixels each takes, so text is drawn at that size, not enlarged. To zoom in on part of the
   page, scale the page in a `run` step and it's drawn sharp at the new size. Stills first
   (`--at`), then every frame.
6. **Lay the frames over the browser area** of their footage, at the same frame numbers. Keep
   their layout, their background and their camera box.
7. **Check it against their recording**: side by side at several moments, and at each click.
   What's on your page at a moment is what was on theirs.

A real app does some things on the computer's time, not the page's clock: loading code, a
request, a panel that opens when its data arrives. The same steps can then draw a slightly
different frame on a slower pass (a larger `--scale`, a busy machine). After any change of
size, compare the new frames with the ones that were approved, and draw a stretch that differs
again on its own with `--from` and `--to`.

## 4. Text behind the person, shades and dims

[guide/behind.md](guide/behind.md) has the method and the numbers, and `scripts/cover.mjs`
measures it. What matters most when finishing over someone's cut:

- **Text behind the person** needs a cutout of them (a matte of the person over transparency)
  for every frame the text is visible. Make it from the same frames as the footage under it,
  at the same size. Use what's set up to make mattes; when nothing is, put the text beside the
  person instead of over a flat card on top of them.
- **A shade under text** comes in a little before the first word (about half a second (house))
  and goes out after the last, sliding both times. The words fade out first, then the shade leaves.
  It is gone one frame before any cut.
- **The cutout covers the shade's whole time**, not only the words' time. Make the cutout
  file start as early as the shade does. Check a still in the middle of the shade's arrival:
  the shade is behind the person there too. In JCSS, put the words and the shade in one group
  and `jcss edit behind` makes the cutout for the group's whole time ([JCSS.md](JCSS.md),
  "Behind the person").
- **A dim of the whole frame** starts and ends on their cuts.
- Look at a still from the arrival, the middle and the exit of every one of these. After a
  note about one, change them all and look at them all.

## 5. Draft, then full size

- **Draft small.** Make light copies of the footage (720p or 1080p), render at 1080p, and keep
  rendered stretches so a change only renders what it touches. For each note, send a preview
  of about ten seconds around it (all house).
- **Full size only when the draft is approved.** Then make every screen, graphic and cutout
  again at full size. A 1080p cutout over 4K footage is a soft person with a sharp background.
- **Compare the full-size file with the approved draft**, both at the draft's small size:

  ```sh
  ffmpeg -v error -i final.mp4 -i draft.mp4 -filter_complex \
    "[0:v]scale=480:270[a];[1:v]scale=480:270[b];[a][b]psnr=stats_file=psnr.log" -an -f null -
  ```

  Most frames score above 35 dB (house). Look at every stretch that dips well below the rest, in
  both files: that's where the full-size pass drew something else. The frame counts are equal,
  and the sound is the same sound.
- **Stray frames**: in the `scene.txt` of your own render (section 2), two high scores within
  a few frames of each other are a layer or a reset that missed a cut. Look at each.
- **Disk**: full-size frames, stretches and bundles are large. Put them on the drive with
  room, and delete what can be made again once the file is checked.

## 6. Say what you did

With the file: what you checked and how (stills, numbers, or watched and heard), what you
changed from their recording (a rebuilt screen, added time), and what's still open.

## What made the first one slow

Lessons from one job: a 5.5-minute 4K finish built in Remotion on one laptop. The numbers
tagged (measured) come from that job only; the habits hold for any tool.

- **Every video reference goes through one proxy switch.** One setting swaps every footage
  path between the small copy and the full-size file, so a draft never opens 4K by accident.
- **Render drafts in stretches, kept by content.** Split at the cuts and name each rendered
  stretch by a hash of everything that draws it (its rows of the table, its graphics, the
  settings). One change then renders one stretch, not the whole video.
- **Don't hand the browser decoded 4K frames one at a time.** That ran at about one frame a
  second (measured). Let the browser decode the video itself on the graphics card, or give it
  a proxy made beforehand at the size it is drawn.
- **Two heavy render workers on a laptop, no more.** A third ran it out of memory (measured).
- **Make cutouts and plates once.** Keep each by its source range and size, and reuse it until
  the footage under it changes.
- **A live preview beats all of this.** Every change above still cost a render. When the person
  can scrub and see a change at once, most drafts are never rendered: prefer a tool that has
  one ([MOTION.md](MOTION.md), "Which tool").
