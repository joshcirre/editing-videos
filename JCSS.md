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
   https://jcss.tv) and ask before installing anything.
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
4. Edit by [EDITING.md](EDITING.md) with `jcss edit … -p <show>`. `jcss transcript <id>` is what was
   said with its times, and `jcss edit cuts <id>` the retakes, fillers and long pauses already
   found, as cuts you switch on and off. Switched on, a cut is only skipped: finish with
   `jcss edit cuts <id> --apply`, which makes them real cuts, so the person opens a timeline
   that is really cut (long pauses down to a quarter second) and drags a cut's edge to give
   time back. The words you cut stay in their transcript, struck through, until they hide them.
   A cut can leave a new long pause or a doubled word where two pieces meet: after your cuts,
   look at `jcss edit cuts <id> --find` again. (`--find --apply` in one call, switching
   nothing, finds and makes them until nothing more is switched on.)
5. Check your work: `jcss edit still` either side of a cut, `jcss edit loudness` against the
   export's target.
6. Hand it over: `jcss edit export <id>` renders the MP4 (it needs ffmpeg), or a Final Cut,
   Premiere or Resolve timeline. To let the person watch the edit and keep or undo each
   change, `jcss edit open <id> -p <show>` opens JCSS on the edit alone (a Mac for now).
   Open it that way, not by opening the app or the show: that starts the show's cameras,
   screens and outputs.

`jcss edit job <files or links…> --brief "…" -p <show>` runs steps 2 to 6 unattended and ends
with a review link people comment on; it needs the person signed in to JCSS web, so use it
when they ask for a review link.

With JCSS's MCP server added (`claude mcp add --scope user jcss -- <path-to-jcss> mcp`), the
same commands are tools: `jcss_edit_from_video`, `jcss_guide`, `jcss_edit_*`.

For a video recorded in JCSS there is more to start from: every camera and screen is recorded
on its own, so B-roll and cutaways come from the person's own angles, and the live cuts, zooms,
titles and chapters are already in the edit (`jcss edit from-recording`).
