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
anywhere, through its `jcss` CLI and MCP server. When the person asks for JCSS, read
[JCSS.md](JCSS.md) before running anything: it says where `jcss` is, how to open a video as an
edit, and how to check it and hand it over.
