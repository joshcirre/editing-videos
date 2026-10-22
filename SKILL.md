---
name: editing-videos
description: "Edits any video the way a good editor would: works out what kind of video it is and its point first, then sets pacing, cuts, retakes, B-roll, captions, titles and sound from the content. Use when asked to edit, cut, tighten, caption, add B-roll to, or review the edit of a recording: talks, podcasts, interviews, tutorials, screen demos, shorts, any length."
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

## With JCSS

[JCSS](https://jcss.tv) is a studio for recording and streaming. Every live decision
(cuts, zooms, titles, chapters) is saved as an edit, so the video is mostly done when you stop
recording. Its edits are plain JSON files that agents change through its MCP server and `jcss`
CLI, and it follows this guide itself:

- Every camera and screen is recorded on its own, so B-roll and cutaways start from your own
  angles.
- Transcripts are made while you record (on a capable Mac), with retakes, fillers and long
  pauses already found as cuts you can switch on and off.
- Agents check their work: `jcss_edit_frame` and stills either side of a cut, `jcss_edit_loudness`
  against the export's target.
- Every change is a version you keep or undo.

With JCSS installed, add its MCP server (`claude mcp add --scope user jcss -- <path-to-jcss>
mcp`) and call `jcss_guide` to see what it can do.
