# Editing with JCSS

[JCSS](https://jcss.tv) is a studio for recording and streaming that also edits videos made
anywhere. Its edits are plain JSON files that agents change through its `jcss` CLI and MCP
server, every change is a version the person keeps or undoes, and it follows this skill's guide
itself. These steps start from nothing but the video:

1. Find `jcss`. Try `jcss --version`. When the shell can't find it, it is inside the app:
   `/Applications/JCSS.app/Contents/Helpers/jcss` on a Mac,
   `%LOCALAPPDATA%\Programs\JCSS\cli\jcss.exe` on Windows; when JCSS installed this skill,
   "On this computer" at the end of [SKILL.md](SKILL.md) has the path. Use that path wherever
   these steps say `jcss`. When JCSS isn't installed, tell the person (it comes from
   https://jcss.tv) and ask before installing anything. On Linux with no screen (a server, a
   cloud agent) there is no app: `jcss` is a download of its own, `jcss-<version>-linux-x64.tar.gz`
   in each release, and does everything here but `jcss edit open`. It needs ffmpeg, a Vulkan
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
   again.
3. Read `jcss guide edits`: the commands for changing an edit. `jcss guide` is the map of
   everything else, and the show's `AGENTS.md` is the same guide in one file.
4. Edit by the guide ([guide/read.md](guide/read.md) first) with `jcss edit … -p <show>`.
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
   change, `jcss edit open <id> -p <show>` opens JCSS on the edit alone (a Mac for now).
   Open it that way, not by opening the app or the show: that starts the show's cameras,
   screens and outputs.

`jcss edit job <files or links…> --brief "…" -p <show>` runs steps 2 to 6 unattended and ends
with a review link people comment on; it needs the person signed in to JCSS web, so use it
when they ask for a review link.

With JCSS's MCP server added (`claude mcp add --scope user jcss -- <path-to-jcss> mcp`), the
same commands are tools: `jcss_edit_from_video`, `jcss_guide`, `jcss_edit_*` (`jcss_edit_layers`
takes the commands `jcss edit run` does).

For a video recorded in JCSS there is more to start from: every camera and screen is recorded
on its own, so B-roll and cutaways come from the person's own angles, and the live cuts, zooms,
titles and chapters are already in the edit (`jcss edit from-recording`).

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
layer twice as fast instead: the same stretch of its file, so the layer gets shorter. Timeline
exports carry speed as each editor's own retime.

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
