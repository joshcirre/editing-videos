# Editing with JCSS

[JCSS](https://jcss.tv) is a studio for recording and streaming that also edits videos made
anywhere. Its edits are plain JSON files that agents change through its `jcss` CLI and MCP
server, every change is a version the person keeps or undoes, and it follows this skill's guide
itself. These steps start from nothing but the video:

1. Find `jcss`. Try `jcss --version`. When the shell can't find it, it is inside the app:
   `/Applications/JCSS.app/Contents/Helpers/jcss` on a Mac,
   `%LOCALAPPDATA%\Programs\JCSS\cli\jcss.exe` on Windows; when JCSS installed this skill,
   "On this computer" at the end of [SKILL.md](SKILL.md) has the path. Use that path wherever
   these steps say `jcss`. When it isn't installed, tell the person and ask before installing
   anything. [jcss.tv/agents](https://jcss.tv/agents) has the CLI-only setup for Linux x64,
   Apple silicon Macs and Windows x64. Local editing doesn't need a JCSS web account.
   On Linux there is no desktop app for `jcss edit open`, and the CLI needs ffmpeg, a Vulkan
   driver (a GPU's, or Mesa's lavapipe) and, for page clips, Chrome or Chromium.
2. Open the video as an edit, in a new folder for this video (JCSS calls the folder a show):

   ```sh
   jcss edit from-video ~/Movies/talk.mov -p ~/Movies/Talk
   jcss edit from-video "https://www.dropbox.com/scl/fi/…/talk.mov?rlkey=…&dl=0" -p ~/Movies/Talk
   ```

   It makes the show when the folder has none, transcribes the video on this computer (JCSS
   doesn't have to be open) and prints the edit's id. A link is downloaded first: a Dropbox or
   Google Drive file's share link as it was copied (shared with anyone who has the link), or
   any https link that answers the file itself. When it says a speech model isn't downloaded,
   it names the download: ask the person, run it, then `jcss speech transcribe <recording>
   -p <show>`. The other choice is ElevenLabs, with no download: the video's sound is sent to
   ElevenLabs and billed to the person's account. When they choose it, they run `jcss speech
   key elevenlabs` in their own terminal (it asks for the key unseen; never ask them to send
   you the key), then you run `jcss speech use transcripts elevenlabs --yes` and transcribe
   again. On Linux (a worker) there is no keychain for it: the key comes from
   `JCSS_SPEECH_KEY_ELEVENLABS` in the environment `jcss` runs in, which whoever set the
   computer up provides.
3. Read `jcss guide edits`: the commands for changing an edit. `jcss guide` is the map of
   everything else, and the show's `AGENTS.md` is the same guide in one file.
4. Edit by the guide ([guide/read.md](guide/read.md) first) with `jcss edit … -p <show>`.
   For silence at joins, use `jcss edit pause <id> --at <seconds> --to 0.35` (or
   `--recorded`), not transcript-based trim maths. A range is
   `--from 10 --until 60 --to 0.3 [--over 1]`, one version. `--dry-run --json` reports measured
   before/after and source limits. MCP: `jcss_edit_pause`; see [guide/silence.md](guide/silence.md).
   `jcss transcript <id>` is what was said with its times, and `jcss edit cuts <id>` the
   retakes, fillers and long pauses already
   found, as cuts you switch on and off. Switched on, a cut is only skipped: finish with
   `jcss edit cuts <id> --apply`, which makes them real cuts, so the person opens a timeline
   that is really cut (long pauses down to a quarter second) and drags a cut's edge to give
   time back. The words you cut stay in their transcript, struck through, until they hide them.
   A cut can leave a new long pause or a doubled word where two pieces meet: after your cuts,
   look at `jcss edit cuts <id> --find` again. (`--find --apply` in one call, switching
   nothing, finds and makes them until nothing more is switched on.)
5. Check your work: `jcss edit still` either side of a cut, `jcss edit loudness` against the
   export's target, and `jcss edit check <id>` for anything 1 to 8 frames across a cut.
6. Hand it over: `jcss edit export <id>` renders the MP4 (it needs ffmpeg), or a Final Cut,
   Premiere or Resolve timeline. To let the person watch the edit and keep or undo each
   change, use `jcss edit open <id> -p <show>` on a Mac or Windows PC with the desktop app
   installed. It starts on the edit alone without starting cameras, screens, microphones or
   outputs. If the show is already open, it switches to the edit and leaves those as they were.
   Windows previews are designed to use smaller copies (proxies) when available, but proxy
   playback hasn't been checked on a Windows PC. Exports use the original recordings.

For long exports use `--progress` for stderr JSON lines roughly every two seconds:
`done_s`, `total_s`, `fps` (processed frames/s), `eta_s` (wall seconds, null while unknown),
`stage` (`preparing`, `video`, `audio`, `mux`). `--size 1080` caps the canvas's short side at
1080 pixels (aspect preserved, even dimensions, no canvas upscaling); `--size source` keeps
the canvas. `--draft` still caps it at 720p/30fps. `--attach [--progress]` follows an existing
export. MCP: `jcss_edit_export {id, size?: "1080"|"source", out?, vertical?, draft?}` starts in
the background; keep that MCP server alive, then `jcss_edit_export_status {job?, cancel?}`
reads live jobs from every source and completed results from this process. Completion includes
the output path and measured loudness, or an error; 100% video is not yet a finished mux.

To edit with the person at once, put the edit in JCSS web's browser editor: they watch and
change it there while you go on with `jcss edit` commands, and each side's changes reach the
other. It needs `jcss` signed in to JCSS web (`jcss web status` says) and the show shared there,
which uploads its setup and media, so share it only when the person wants that:
`jcss share -p <show> --yes`. Then:

```sh
jcss edit live <id> -p <show>
```

It prints the browser editor's link, `https://jcss.tv/shows/<show id>/edits/<id>`: give it to the
person. Keep it running while you edit (in the background, or `--rounds N` for a set number of
rounds); each change is a line, `->` yours going up and `<-` theirs coming down into the edit's
files, which the next `jcss edit` command reads. Ctrl-C stops it.

On a computer with no browser to sign in with (a server, a cloud agent), sign in with a token:
on a computer that is signed in, the person runs `jcss web token "<name>"`, which prints the
token once, and sets it as `JCSS_WEB_TOKEN` in the environment `jcss` runs in on yours.
Settings › Apps on JCSS web lists it by that name; Disconnect there ends it.

With JCSS's MCP server added (`claude mcp add --scope user jcss -- <path-to-jcss> mcp`), the
same commands are tools: `jcss_edit_from_video`, `jcss_guide`, `jcss_edit_*` (`jcss_edit_layers`
takes the commands `jcss edit run` does).

For a video recorded in JCSS there is more to start from: every camera and screen is recorded
on its own, so B-roll and cutaways come from the person's own angles, and the live cuts, zooms,
titles and chapters are already in the edit (`jcss edit from-recording`).

## Review links and headless workers

`jcss edit job <files or links…> --brief "…" -p <show>` transcribes the videos and makes a first
pass unattended. By default it publishes a draft on a review link; use `--no-review` if the
person didn't ask for a link. Publishing needs a JCSS Pro account signed in to JCSS web; reviewers
with the link don't need an account. For a headless worker, have the account owner run
`jcss web token "worker"` on a signed-in computer and pass the token securely as
`JCSS_WEB_TOKEN` in the worker's environment. Check with `jcss web status` on the worker.

For an existing edit, `jcss edit review <id> -p <show>` publishes to its review link.
`jcss edit review <id> --comments -p <show>` brings open comments in as notes without
publishing; after you address them, publish again to add a version to the same link.
When both versions came from JCSS exports and changes are available, point reviewers to
**Show me what changed** to replay the changed stretches, or have them watch the whole cut.
Versions uploaded with `--file` aren't compared.

Publishing the next version also sends locations for the previous version's notes:
the review link's "What we did with your notes" plays the nearby changed stretch.
This is source-content matching, not proof that a request was fulfilled. Explicit
`--resolve <comment>` records resolution; the watcher's local `answered` means it
considered the note, even when it made no change (decision 0243).

To edit together in the browser, use a shared show: `jcss share --yes -p <show>` first if
it isn't shared, then `jcss edit live <id> -p <show>` to sync the edit. This isn't the client
review link; publish that separately.

`jcss edit review <id> --watch -p <show>` automatically revises and publishes for new comments.
It needs a working Claude Code or Codex agent selected in Settings › AI or with
`--agent claude` or `--agent codex`.
Approval of the latest published version pauses revisions, including publication of
a waiting revision, but the watcher keeps polling and resumes after retraction.
Owner-requested `--revise` and MCP `revise: true` bypass that automatic-only lock.
For an external worker, `jcss web webhooks add <https-url>` supplies signed comment
and approval notifications; delivery is one attempt, so keep polling as the fallback
(decision 0239). Store the returned signing secret securely; it is shown only once.

## Finishing in DaVinci Resolve

When the person grades, mixes or finishes in Resolve, hand the edit over as a timeline, not an
MP4: `jcss edit export <id> --otio` writes `exports/<id>-otio/<id>.otio` pointing at the
recordings, with an `.srt` beside it when there's a transcript (`--fcpxml` also works). The
person opens it with File › Import › Timeline.

If a Resolve MCP server is already connected
([davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp): its tools are in
your list and Resolve is open), you can do that step yourself: import the `.otio` into the open
project, check that its clips are linked and that its length matches the edit, and add a marker
at each place you want the person to look (a cut you weren't sure of, a shot to grade). Grade or
change the timeline there only when asked; JCSS's edit stays the one you change and export
again. Don't install the server or change Resolve's preferences unasked: it needs Resolve
Studio (Preferences › General › External scripting using: Local), and the free edition reaches
it only through an in-app bridge.

## Layers

Anything over the picture for a stretch (a word, a title, a shade, B-roll, a page) is a layer
of the edit. Its `start` and `duration` are seconds into the video, so it can cross cuts, and
later cuts, trims and speed changes carry it the way they carry music. Give every layer a
`name` you can say ("ambitious"), and the same `group` to layers that arrive and leave
together (a word and the shade under it): moving, retiming, hiding, deleting or duplicating one
takes its group unless the command has `"alone": true`.

- `jcss edit layers <id>` lists them, top first: id, name, group, times, what each edge is held
  on, and what shows a few frames across a cut.
- `jcss edit run <id> '<command, or a list of them>'` changes them as one version, all or
  nothing, and says what each did. A layer is named by its id, name or group; `--dry-run`
  saves nothing.

  ```sh
  jcss edit run talk '{"op": "add", "clip": {"image": "assets/chart.png", "rect": {"x": 0.55, "y": 0.1, "w": 0.4, "h": 0.4}, "start": 42, "duration": 5, "name": "chart"}}' -p ~/Movies/Talk
  jcss edit run talk '[{"op": "move", "layer": "chart", "dx": -0.05, "dy": 0}, {"op": "retime", "layer": "chart", "by": 0.5}]' -p ~/Movies/Talk
  ```

  The others: `resize` (`rect`), `restyle` (`set`, merged field by field), `reword` (`text`),
  `reorder` (`to`: front, back, forward, backward), `hide`, `delete`, `duplicate`, and `anchor`
  and `speed` below.
- **Frame-exact.** Saving puts every edge on a whole frame, and an edge within 3 frames of a
  cut on the cut. `jcss edit check <id>` lists what still shows 1 to 8 frames on the other side
  of a cut, and anchors that no longer hold; the commands that change layers or cuts say so
  too. Fix each before handing over ([guide/check.md](guide/check.md)).
- **Anchors.** Hold an edge on the word that names the beat, or on a cut, and later edits carry
  it there: `{"op": "anchor", "layer": "chart", "edge": "start", "word_at": 41.8, "word":
  "revenue"}` (the word's time in the edit, from `jcss transcript <id> --find revenue`), or
  `"cut_at": 40.0` for the cut within a second of there. Without either it lets go.

### Text

`jcss edit text <id> <from> <to> --text "ambitious" --size 260 --weight 800 --rect
0.05,0.1,0.5,0.4 --name ambitious` makes a text layer and answers its id. It draws in Barlow,
which comes with JCSS (or `--font "Barlow Condensed"`, or a font file in the show such as
`fonts/Brand.ttf`), so it looks the same on every computer, and it fades in and out.
`--shade '#00000099'` or `--gradient '#000000CC,#00000000'` fills the box behind the words; with
no `--text` it's a shade alone, for a shade in the same `--group` that leads the words.
`--motion word|line|scroll` moves the words inside the box. Change it after with `jcss edit run`:
`reword` with `"text": {"text": "bold"}`, `restyle` with `"set": {"words": {"color": "#F2BD48"}}`.
`--pad <px>` sets horizontal padding in the same 1080-reference pixels as `--size`. Unshaded
text defaults to zero; a shade defaults to a quarter of the size actually drawn, capped at a
sixth of the box's width. Use `--pad 0` for flush left/right ink, even with a shade. Change just
that later with `jcss edit restyle <id> <layer> --pad 0`, or a `restyle` command's
`"set": {"words": {"pad": 0}}` (`null` restores the default).
Text creation and restyling say when words shrink or wrap and report `ink x,y,w,h` in canvas
pixels, before animation or clip transforms. Fitting uses actual glyph ink, not just advance
widths, so overhangs are not silently sliced. `jcss edit check <id>` also lists text that
shrinks or wraps a single word. Check those messages before placing poster-sized words;
render a still to judge the composition, not just the measured box.
A word on screen is a text layer, not one of the show's title designs stretched to fit it; what
text layers can't do (a style per word, outlined letters, a typewriter) is a page clip.

### Behind the person

`jcss edit behind <id> <layer>` puts a layer and its group behind the person in the video under
it, and makes the matte (their cutout) for the group's whole time before it answers: about a
third of a second of CPU a frame with no GPU, nothing when it's made already, and the person
model downloads the first time. After moving or retiming the layer, `jcss edit matte <id>` tops
the matte up; a frame without one draws the layer in front, and export and stills say how many.
`--off` puts it in front again. [guide/behind.md](guide/behind.md) still decides when, which
words and how much the person covers: look at stills across its whole time.

### Page clips

A graphic written as a web page goes in the edit as it is, and JCSS draws it on its own clock:
[MOTION.md](MOTION.md), "In a JCSS edit".

### Speed

`jcss edit speed <id> <from> <to> <speed>` plays a stretch faster or slower: 12 makes ten silent
minutes of building a 50 s montage, 0.5 is slow motion. Everything after moves up, the transcript
follows, and the sound keeps its pitch, or `--drop` silences it (usually right for a montage).
Speed 1 over the same stretch puts it back. `jcss edit speed <id> --layer broll 2` plays a video
layer twice as fast instead: the same stretch of its file, so the layer gets shorter. For a
stretch or a layer, set speed again without `--drop` to restore sound dropped by the speed
change; this doesn't unmute video muted by hand. Timeline exports carry speed as each editor's
own retime.

`jcss edit waits <id>` (MCP `jcss_edit_waits`) finds the waits to speed through: stretches of 4 s
or more with no words where the screen barely changes but something still moves (a progress bar,
scrolling log lines, a page loading). It reads the screen's own recording when there is one,
else the program; a camera in the corner of the program keeps moving, so there every quiet
stretch can look like a wait. Each comes with the `jcss edit speed … --drop` that plays it in
about 3 s. Finding changes nothing: look at each one (`jcss edit still`) and decide by
[guide/pace.md](guide/pace.md), "Waits on a screen". Speed several from the last one first, so the
earlier times still hold.

### Asking JCSS's own agent

`jcss edit ask <id> "<request>" --from <s> --to <s>` hands a request about one passage to the
person's own Claude Code or Codex, as the editor's chat does (`--agent claude` or `--agent
codex` where JCSS's settings name neither, as on a server). It sees stills of the passage,
answers with the layer commands above, looks at its answer drawn before proposing it, and goes
on from its last turn on that edit, so follow-ups ("make it yellow", "bigger", "start it half a
second earlier") take seconds. `--mark circle:x,y,r@t` says where on the picture (x, y and r in
shares of the frame, t in seconds on the edit's clock; also `arrow:x1,y1,x2,y2@t` and
`pen:x,y x,y …@t`). It may change layers up to 2 s either side of the passage, not across a cut.
The answer waits as a suggestion: asking again or `jcss edit run` changes that suggestion,
`jcss edit keep <id>` or `jcss edit discard <id>` settles it, and `--keep` keeps it at once. Keep
or discard before exporting. Over MCP: `jcss_edit_ask {id, request, from, to, marks, keep}` and
`jcss_edit_keep {id, discard}`. Use it when the person wants their agent placing something while
looking at it; a change you already know is one `jcss edit run`.
