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
titles (EDITING.md, "Work with what's set up").

### 1. Decide before writing the page

- **Beats first.** Write a small table: each thing that appears, the second it comes on and goes
  off, and its exact words. Take the words and numbers from the transcript, and anchor each beat
  to the word that names it (EDITING.md §5). Animate only after the table reads right.
- **Tokens first.** At the top of the page, as CSS custom properties: four to six colours, one or
  two typefaces, the text sizes, three easings and the durations. Take them from the person's
  brand, or from the titles the video already has. The rest of the page uses only those, so
  every graphic in the video matches and one change restyles them all.
- **Real things only.** Names, numbers, logos and screenshots come from the transcript or from
  files the person handed over. When one is missing, ask; never draw a look-alike or invent a
  figure.

### 2. How it should move

- **Ease by what the thing is doing.** Arriving slows into place: `cubic-bezier(0.16, 1, 0.3, 1)`.
  Leaving speeds away: `cubic-bezier(0.7, 0, 0.84, 0)`. Moving across the frame eases both ways:
  `cubic-bezier(0.76, 0, 0.24, 1)`. One curve at one length on everything is what makes a
  graphic look generated.
- **Lengths**: a move takes 0.3–0.6 s. An exit is about half as long as the entrance. Items in a
  group follow each other by 60–120 ms.
- **Once it lands, it stays still.** No floating, pulsing or breathing while people read. Not
  everything fades and slides up: pick the entrance from the thing (a bar grows from its base, a
  line draws along its path, a card comes from the edge it sits against).
- **Nothing starts from nothing**: scale from about 0.95 with opacity, not from 0.
- **One piece of text per beat.** A big number or a headline stands alone: no small label above
  it, no caption line under it. That stack is a web page's hero section, and on video it reads
  as generated. If the label matters, it's the next beat or it's said aloud.
- **Reading time** is the guide's (EDITING.md §6): about 1 s plus 0.3 s a word, at least 2 s,
  counted from when the text has landed.
- **Size and place**: text no smaller than 2.6% of the frame's shorter side (28 px at 1080p);
  a title 4–9% of the height. Text stays inside the middle 80% of the frame, everything else
  inside 90%. The footage behind is unknown, so text sits on its own box or a strong shadow.
  For a vertical video, also look at a still shrunk to 360 px wide.

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
  people make animations without code; a page you write for one video is fine.

### 4. Draw stills, then the frames

Paths are from this skill's folder. Use the video's frame rate and size.

```sh
# stills first: a few moments, in under a second
node scripts/page-frames.mjs graphics/lower-third.html stills --duration 4 --at 0.3,2,3.9

# then every frame: frames/00000.png, 00001.png, ...
node scripts/page-frames.mjs "graphics/lower-third.html?name=Dana%20Lee" frames --duration 4 --fps 30 --size 1920x1080
```

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
  covers (never a mouth, a talking face or something the viewer reads: EDITING.md §6):

  ```sh
  ffmpeg -v error -y -ss 12.3 -i video.mp4 -i stills/00060.png -filter_complex overlay -frames:v 1 check.png
  ```

- **A contact sheet of the whole move**, every tenth frame over grey:

  ```sh
  ffmpeg -v error -y -f lavfi -i color=gray:s=1920x1080:r=30 -framerate 30 -i frames/%05d.png \
    -filter_complex "[0][1]overlay=shortest=1,select='not(mod(n,10))',scale=480:-1,tile=4x3" -frames:v 1 sheet.png
  ```

- **Fix the three worst things, by frame number, then draw again.** Stop after two to four
  rounds; if it still isn't right, the beats or the tokens are wrong, not the animation.

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
  start, it never starts here: begin everything from the page loading.
- **Purple blacks after an ffmpeg `blend`** (a glow or light leak laid over the video with a
  mode such as `screen`). `blend` works on each plane, and in YUV the colour planes rest at the
  middle, not at zero. Convert both inputs to RGB first:
  `[0]format=gbrp[a];[1]format=gbrp[b];[a][b]blend=all_mode=screen`.
