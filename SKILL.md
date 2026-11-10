---
name: editing-videos
description: "Edits any video the way a good editor would: works out what kind of video it is and its point first, then sets pacing, cuts, retakes, B-roll, captions, titles, motion graphics and sound from the content. Use when asked to edit, cut, tighten, caption, add B-roll or animated graphics to, or review the edit of a recording (talks, podcasts, interviews, tutorials, screen demos, shorts, any length), and when asked to use JCSS or its `jcss` CLI on a video."
license: MIT
---

# Editing videos

Taste for editing, written down so an agent can follow it with any editor: Final Cut Pro,
Premiere, Resolve, CapCut, ffmpeg, Remotion, HyperFrames or JCSS.

## How to use it

1. Read [EDITING.md](EDITING.md) in full. It is the guide; this file only says how to apply it.
2. Read the whole transcript, the brief and any notes. If there's no transcript, make one with
   word timings first, with what's already here (the editor's own, or a local Whisper). Use an
   online transcription service only if it's already set up; if nothing can transcribe, say so
   and ask for a transcript.
   Throughout, use only services already set up (EDITING.md, "Work with what's set up").
3. Write your read of the video (EDITING.md §1) and ask the person what you need to know. When
   you can't ask, go with your best read and say what you assumed.
4. Edit in this order: retakes and mistakes, then cuts between phrases, then the shape (the
   opening, chapters, the ending), then B-roll and graphics, then captions and titles, then
   sound.
5. Check it (§8) before you say it's done, and turn the person's notes into rules (§9).

For a small, specific request, skip to the part of the guide it touches.

## Motion graphics

When the edit needs a graphic that moves and the editor can't draw it (an animated title or
lower third, a chart that builds, a diagram, a counter), read [MOTION.md](MOTION.md) and write
the graphic as a web page. `scripts/page-frames.mjs` draws the page to transparent frames, on
the exact frame, whatever the page animates with. It needs Node 22 or later and Chrome on this
computer, and installs nothing.

```sh
node scripts/page-frames.mjs graphics/lower-third.html frames --duration 4 --fps 30 --size 1920x1080
```

## With JCSS

[JCSS](https://jcss.tv) is a studio for recording and streaming that also edits videos made
anywhere. Its edits are plain JSON files that agents change through its `jcss` CLI and MCP
server, every change is a version the person keeps or undoes, and it follows this guide itself.
Edit with it when the person asks for JCSS, starting from nothing but the video:

1. Find `jcss`. Try `jcss --version`. When the shell can't find it, it is inside the app:
   `/Applications/JCSS.app/Contents/Helpers/jcss` on a Mac,
   `%LOCALAPPDATA%\Programs\JCSS\cli\jcss.exe` on Windows; when JCSS installed this skill,
   "On this computer" at the end of this file has the path. Use that path wherever these steps
   say `jcss`. When JCSS isn't installed, tell the person (it comes from https://jcss.tv)
   and ask before installing anything.
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
4. Edit by this skill's guide with `jcss edit … -p <show>`. `jcss transcript <id>` is what was
   said with its times, and `jcss edit cuts <id>` the retakes, fillers and long pauses already
   found, as cuts you switch on and off.
5. Check your work: `jcss edit still` either side of a cut, `jcss edit loudness` against the
   export's target.
6. Hand it over: `jcss edit export <id>` renders the MP4 (it needs ffmpeg), or a Final Cut,
   Premiere or Resolve timeline. The person can open the show in JCSS to watch the edit and
   keep or undo each change.

`jcss edit job <files or links…> --brief "…" -p <show>` runs steps 2 to 6 unattended and ends
with a review link people comment on; it needs the person signed in to JCSS web, so use it
when they ask for a review link.

With JCSS's MCP server added (`claude mcp add --scope user jcss -- <path-to-jcss> mcp`), the
same commands are tools: `jcss_edit_from_video`, `jcss_guide`, `jcss_edit_*`.

For a video recorded in JCSS there is more to start from: every camera and screen is recorded
on its own, so B-roll and cutaways come from the person's own angles, and the live cuts, zooms,
titles and chapters are already in the edit (`jcss edit from-recording`).
