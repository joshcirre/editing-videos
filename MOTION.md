## Motion graphics as web pages

A graphic that moves (an animated title or lower third, a chart that builds, a diagram, a
counter, a map, a whole animated section) is written as an ordinary web page and drawn to frames
with `scripts/page-frames.mjs`. The page can use anything a browser draws: CSS, SVG, canvas,
WebGL, any animation library. There is no framework to fit into, and changing a word later means
editing the page and drawing that one graphic again.

Captions and plain titles stay in the editor when it has its own. This is for what the editor
can't draw.

It needs Node 22 or later and Chrome (or Chromium, or Edge) on this computer; the script finds
Chrome itself and installs nothing. When either is missing, say so and use the editor's own
titles ([guide/read.md](guide/read.md), "Work with what's set up").

### Which tool

Use the first of these that can draw what's wanted. It is an order, not a requirement: nothing
is installed unasked, and a tool that isn't there is never a reason to stop.

1. **The editor's own titles and graphics**, when they can draw it. Nothing to render or line
   up, and the person can change it themselves.
2. **A plain web page and `scripts/page-frames.mjs`**, for one graphic or a filmed page. It
   needs only Node and Chrome, and it is the rest of this file. In JCSS the page goes in the
   edit as it is and JCSS draws it ("In a JCSS edit" below).
3. **[HyperFrames](https://github.com/heygen-com/hyperframes)** (Apache-2.0), when it is already
   set up or the person agrees to set it up, for anything bigger: many graphics over one video,
   captions, a whole composed finishing pass, a live preview the person can steer. It is the
   same idea as this file (an HTML page drawn one frame at a time), so a page written here
   moves over ("Moving a page to HyperFrames" below). There is no React project or bundle to
   keep for one video.
4. **Remotion**, only when the project already uses it or the person asks for it. Then follow
   Remotion's own skills, not this file. It is a React project with a build step, and a company
   of more than three people needs its paid company licence (Remotion's "License & Pricing"
   page, read 2026-11-12): check Remotion's licence before using it for one.

### 1. Decide before writing the page

- **Beats first.** Write a small table: each thing that appears, the second it comes on and goes
  off, and its exact words. Take the words and numbers from the transcript, and anchor each beat
  to the word that names it ([guide/broll.md](guide/broll.md)). Animate only after the table
  reads right.
- **Tokens first.** At the top of the page, as CSS custom properties: four to six colours, one or
  two typefaces, the text sizes, three easings and the durations (house). Take them from the
  person's brand, or from the titles the video already has. The rest of the page uses only those, so
  every graphic in the video matches and one change restyles them all.
- **Real things only.** Names, numbers, logos and screenshots come from the transcript or from
  files the person handed over. When one is missing, ask; never draw a look-alike or invent a
  figure.

### 2. How it should move

- **Ease by what the thing is doing.** Arriving slows into place: `cubic-bezier(0.16, 1, 0.3, 1)`.
  Leaving speeds away: `cubic-bezier(0.7, 0, 0.84, 0)`. Moving across the frame eases both ways:
  `cubic-bezier(0.76, 0, 0.24, 1)`. The three curves are (house). One curve at one length on
  everything is what makes a graphic look generated.
- **Lengths**: a move takes 0.3–0.6 s. An exit is about half as long as the entrance. Items in a
  group follow each other by 60–120 ms (all house).
- **Once it lands, it stays still.** No floating, pulsing or breathing while people read. Not
  everything fades and slides up: pick the entrance from the thing (a bar grows from its base, a
  line draws along its path, a card comes from the edge it sits against).
- **Nothing starts from nothing**: scale from about 0.95 (house) with opacity, not from 0.
- **One piece of text per beat.** A big number or a headline stands alone: no small label above
  it, no caption line under it. That stack is a web page's hero section, and on video it reads
  as generated. If the label matters, it's the next beat or it's said aloud.
- **Reading time** is the guide's ([guide/text.md](guide/text.md)): about 1 s plus 0.3 s a
  word (common), at least 2 s (house), counted from when the text has landed.
- **Size and place**: text no smaller than 2.6% of the frame's shorter side (28 px at 1080p);
  a title 4–9% of the height (house). Text stays inside the middle 80% of the frame, everything
  else inside 90% (common). The footage behind is unknown, so text sits on its own box or a
  strong shadow. For a vertical video, also look at a still shrunk to 360 px (house) wide.

### 3. Write the page

- **One graphic, one `.html` file**, in a folder with everything it loads (fonts, images,
  libraries) by relative path. Load nothing from the network: the next render must draw the same
  picture, and a font that arrives late is drawn as a different font.
- **The body is the video's size** in pixels (`width: 1920px; height: 1080px; overflow: hidden`)
  with no background, so the frames are transparent wherever the page is.
- **Time 0 is when the page loads.** Animate the way you would for a browser: CSS animations and
  transitions, `element.animate()`, `setTimeout`, `requestAnimationFrame`, SVG animation, a
  canvas or WebGL loop, a library. The script runs the page's clock (`scripts/page-clock.js`),
  so each of those lands on the exact frame however long the frame took to draw, and
  `Math.random()` gives the same numbers on every render.
- **Load everything at the start.** An image or a `fetch` that begins partway through arrives
  when the computer gets to it, not at a time on the clock.
- **Not on the clock**: `<video>`, `<audio>`, GIFs, iframes and workers (a canvas drawn in a
  worker). Footage goes under the graphic in the editor, sound goes in the editor.
- **Optional**: define `window.renderAt(seconds)` and the script calls it for every frame after
  moving the clock. Use it for a canvas you'd rather draw as a function of time.
- **Values come in through the query**, so one page serves every use:
  `lower-third.html?name=Dana%20Lee&role=Head%20of%20Product`, read with
  `new URLSearchParams(location.search)`.
- **Libraries**: plain CSS and `element.animate()` cover most graphics. anime.js and Motion are
  MIT. GSAP is free under its own license, which doesn't allow building it into a tool where
  people make animations without code; a page you write for one video is fine. HyperFrames is
  Apache-2.0. Remotion has its own licence, free for one person or a small company and paid
  for a larger one: check it, don't assume.

### 4. Draw stills, then the frames

Paths are from this skill's folder. Use the video's frame rate and size.

```sh
# stills first: a few moments, in under a second
node scripts/page-frames.mjs graphics/lower-third.html stills --duration 4 --at 0.3,2,3.9

# then every frame: frames/00000.png, 00001.png, ...
node scripts/page-frames.mjs "graphics/lower-third.html?name=Dana%20Lee" frames --duration 4 --fps 30 --size 1920x1080
```

For a full-size render, draw the same page larger instead of enlarging its frames: `--scale 2`
makes a 1920x1080 page 3840x2160 frames, with the text drawn at that size. `--from` and `--to`
draw one stretch again, with the same frame numbers.

`node scripts/page-frames.mjs --help` lists the rest. It prints one line of JSON, and exits with
an error naming the cause when the page threw, logged an error or asked for a file that didn't
load: fix those before trusting the frames. Without a graphics card a 1080p frame takes about
0.1 s, so a 5 s graphic at 30 fps takes about 15 s.

### 5. Check it

- **Stills before the full render**: the first frame (empty, unless the graphic is cut on), the
  middle of each move, a frame where everything has landed, and the last frame (empty again,
  unless it's cut off).
- **Look at one still at full size.** A contact sheet shows layout and timing; it hides soft
  text, a wrong font and a one-pixel gap.
- **Look at it over the footage it goes on**, at that moment, for contrast and for what it
  covers (never a mouth, a talking face or something the viewer reads:
  [guide/text.md](guide/text.md)):

  ```sh
  ffmpeg -v error -y -ss 12.3 -i video.mp4 -i stills/00060.png -filter_complex overlay -frames:v 1 check.png
  ```

- **A contact sheet of the whole move**, every tenth frame over grey:

  ```sh
  ffmpeg -v error -y -f lavfi -i color=gray:s=1920x1080:r=30 -framerate 30 -i frames/%05d.png \
    -filter_complex "[0][1]overlay=shortest=1,select='not(mod(n,10))',scale=480:-1,tile=4x3" -frames:v 1 sheet.png
  ```

- **Fix the three worst things, by frame number, then draw again.** Stop after two to four
  rounds (house); if it still isn't right, the beats or the tokens are wrong, not the animation.

### 6. Put it in the edit

- **Straight onto the video** with ffmpeg, starting at 12.3 s:

  ```sh
  ffmpeg -i video.mp4 -itsoffset 12.3 -framerate 30 -i frames/%05d.png \
    -filter_complex "[0][1]overlay=eof_action=pass" -c:a copy out.mp4
  ```

- **For Final Cut Pro, Premiere or Resolve**, a ProRes 4444 file, which keeps the transparency:

  ```sh
  ffmpeg -framerate 30 -i frames/%05d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le lower-third.mov
  ```

- **For a web page**, a transparent WebM (Chrome, Edge and Firefox; Safari shows it without
  transparency):

  ```sh
  ffmpeg -framerate 30 -i frames/%05d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 lower-third.webm
  ```

- **Keep the page with the project**, beside the edit, with the command that drew it. The page
  is the graphic; the frames are something you can make again.

### In a JCSS edit

In JCSS ([JCSS.md](JCSS.md)) the page itself is part of the edit, a page clip, and JCSS draws
it in Chrome on the same clock as this file's script (`page-clock.js`). Sections 1 to 3 and 5
stand; there are no frames to draw, lay over or keep by hand. The preview, stills and export
read the same frames, kept per clip in the show, and a changed word draws that clip again and
nothing else.

1. Put the page in a folder of its own in the show (`graphics/lower-third/index.html`, its fonts
   beside it): every file in the folder is part of the clip.
2. Add it as a layer, its values in `variables` (they arrive in the query, as in section 3). It
   covers the frame and is transparent where the page draws nothing:

   ```sh
   jcss edit run talk '{"op": "add", "clip": {"motion": "graphics/lower-third/index.html", "variables": {"name": "Dana Lee"}, "start": 12.3, "duration": 4, "name": "lower third"}}' -p ~/Movies/Talk
   ```

3. Draw and check it: `jcss edit pages <id> --draw --check -p <show>` draws what isn't drawn
   yet, then draws each clip again slowly and names the frames that came out differently: a
   page doing work on real time, not on the clock. Fix those as section 3 says.
4. Look at it with `jcss edit still <id> <seconds> -o still.png -p <show>` at the moments
   section 5 lists, over the footage it's on.

A real page filmed as B-roll is a page clip too: `motion` is its `http://` or `https://` address,
`steps` the same list as `--steps` (times on the page's clock), `page_scale` is `--scale`, and
`"jpeg": 95` keeps opaque frames. Either kind goes behind the person like any layer.

### Filming a real page

The same script films a page that already exists (the app or site the video is about), as
B-roll that replaces an enlarged screen recording. [FINISHING.md](FINISHING.md) §3 has the
method; the script's part is:

```sh
node scripts/page-frames.mjs http://localhost:5173/ plate --duration 18   --size 1226x668 --scale 1.5 --jpeg 95 --steps steps.json
```

- The page is an `http://` or `https://` address, or a file. It runs on the page's clock like
  any other.
- `--steps` is a JSON list of what happens and when: `scroll` (the page glides between two
  scroll steps), `move` and `click` (a real pointer, by selector or `[x, y]`, so hover and
  pressed states are the page's own), and `run` (any JavaScript: add a highlight, scale the
  page for a closer look, set its data).
- `--jpeg 95` writes opaque JPEG frames, which is what a filmed screen wants. `--size` is the
  page's own size in CSS pixels; `--scale` multiplies it into frame pixels.
- A page you don't control can do things on the computer's time (a request, code that loads
  late). Have everything loaded before time 0 where you can, and compare a second pass with
  the first before trusting it.

### Moving a page to HyperFrames

A page written this way becomes a HyperFrames composition. This was read from HyperFrames' docs
on 2026-11-12 (the file is in the comment after each point) and not run here: look at stills
before trusting a detail.

- **What stays**: the HTML and CSS, the tokens, the beats table, how it moves (section 2), and
  fonts loaded from files in the project with `@font-face`. <!-- references/format.md, Fonts -->
- **The root is one element** with `data-composition-id`, `data-width`, `data-height`,
  `data-start="0"` and `data-duration` in seconds: the video's length and size, in place of
  `--duration` and `--size`. <!-- references/format.md; hyperframes/SKILL.md, contract 2 -->
- **Each beat is a clip**: `class="clip"`, `data-start` and `data-duration` in seconds, shown
  from its start up to, not including, its end. What is in front is CSS `z-index`;
  `data-track-index` is only a row in their editor. <!-- docs/concepts/data-attributes.mdx -->
- **Motion is one paused timeline the renderer seeks**, not a page left to run:
  `gsap.timeline({ paused: true })`, each tween placed at its second, then
  `window.__timelines["<composition id>"] = tl`. No `setTimeout`, `requestAnimationFrame`,
  `Date.now()`, unseeded `Math.random()` or late fetch. <!-- docs/concepts/determinism.mdx -->
- **Without GSAP**: CSS `@keyframes` (finite, fill `both`) and a paused `element.animate()`
  are seeked too; a canvas draws from `e.detail.time` in an `hf-seek` listener, where
  `window.renderAt` was. CSS transitions are not listed. <!-- references/runtimes.md -->
- **Footage goes in the page**, under the graphics: a full-frame `<video muted playsinline>`
  with its own `data-start` and `data-duration` and a lower `z-index`. `data-has-audio="true"`
  in place of `muted` keeps its sound. Never play or seek it. <!-- references/format.md, Adding media -->
- **The commands**: `npx hyperframes preview` is the live preview; `check` finds broken
  timing, overflow and poor contrast; `snapshot --at 2.9,10.4` writes stills; `render` writes
  MP4, or keeps transparency with `--format webm`, `mov` or `png-sequence`. `check` and
  `snapshot` are this file's stills-first habit: run both before any render.
  <!-- docs/packages/cli.mdx: preview, check, snapshot, render -->
- **Setting it up is the person's call.** It needs Node 22 or later and FFmpeg; `npx` downloads
  the CLI, and `init` installs agent skills unless given `--skip-skills`. The CLI reports usage
  unless `HYPERFRAMES_NO_TELEMETRY=1` is set: set it unless the person says otherwise, and
  never sign in or turn telemetry on for them. <!-- README.md; docs/packages/cli.mdx: init, telemetry -->
- **Not verified**: that a page from this file runs unchanged (expect to rewrite timers and
  transitions as a timeline); where to load GSAP from (their example uses a CDN; keep a copy
  in the project, as section 3 says); and its speed over long 4K footage. Their docs say every
  frame of each source video is extracted before capture, so [FINISHING.md](FINISHING.md),
  "What made the first one slow", still applies. <!-- docs/packages/cli.mdx, Segmented capture -->

### What goes wrong

- **A font that isn't on the next computer.** Put the font file in the folder and load it with
  `@font-face`. A system font draws differently on another machine.
- **Two computers, two pictures.** Different Chrome versions and graphics cards round edges
  differently. Draw every graphic of one video on one computer.
- **Comparing two renders byte for byte.** They are the same picture, but an edge that's moving
  can differ by one level of transparency in a one-pixel line. Compare by eye or with a
  tolerance, not by hash.
- **An exit that never plays.** A CSS entrance animation with `animation-fill-mode: forwards` or
  `both` keeps holding its last frame, so a later transition on the same properties does
  nothing. Write the exit as a second animation, or leave the fill off and put the resting
  values in the element's own style.
- **A graphic that only works in the browser.** If it needs a click, a hover or a scroll to
  start, it never starts here: begin everything from the page loading, or give the click,
  hover or scroll its time with `--steps`.
- **A panel that fades in one pass and pops in the next.** On a real app, something waited on
  the computer's time, and a slower pass (a larger `--scale`) finished it between two frames.
  Draw that stretch again on its own with `--from` and `--to`, and compare it with the pass
  that was approved.
- **Purple blacks after an ffmpeg `blend`** (a glow or light leak laid over the video with a
  mode such as `screen`). `blend` works on each plane, and in YUV the colour planes rest at the
  middle, not at zero. Convert both inputs to RGB first:
  `[0]format=gbrp[a];[1]format=gbrp[b];[a][b]blend=all_mode=screen`.
