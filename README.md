# editing-videos

An agent skill that gives Claude Code, Codex and other agents an editor's judgment: it works
out what kind of video it's looking at and what it's for, then edits for that. The same guide
drives the AI editor in [JCSS](https://jcss.tv).

- [SKILL.md](SKILL.md): how an agent applies it.
- [EDITING.md](EDITING.md): the guide (reading the video, pacing from the content, shaping,
  cutting, B-roll, captions and titles, sound, checking, learning from notes).
- [MOTION.md](MOTION.md): motion graphics written as ordinary web pages (any CSS, SVG, canvas,
  WebGL or library) and drawn to transparent frames by `scripts/page-frames.mjs`, which needs
  only Node 22+ and Chrome.
- [JCSS.md](JCSS.md): editing with JCSS's `jcss` CLI, from nothing but the video. Read only
  when JCSS is the editor.

## Install

With [JCSS](https://jcss.tv) installed, it carries this skill and keeps it up to date, for
Claude Code and Codex in every folder:

```sh
/Applications/JCSS.app/Contents/Helpers/jcss skill install
```

Without JCSS, Claude Code:

```sh
git clone https://github.com/joshcirre/editing-videos ~/.claude/skills/editing-videos
```

Codex:

```sh
git clone https://github.com/joshcirre/editing-videos ~/.codex/skills/editing-videos
```

Then ask: "Edit my recording at ~/Movies/talk.mov" or "Tighten this podcast and tell me where
B-roll would help."

## Credits

Ideas (not text) from Nate Herk's [herk-edit-kit](https://github.com/nateherkai/herk-edit-kit),
[agent-video-editor](https://github.com/kmilo93sd/agent-video-editor) and
[bckgrnd-msc-mcp](https://github.com/chrislanejones/bckgrnd-msc-mcp)'s music skill, all MIT.
For motion graphics: [HyperFrames](https://github.com/heygen-com/hyperframes)' motion and review
notes (Apache-2.0), [timeweb](https://github.com/tungs/timeweb) (BSD-3-Clause) and Replit's
[Browsers don't want to be cameras](https://replit.com/blog/browsers-dont-want-to-be-cameras)
for the idea of a page clock the renderer runs. The scripts here are written from scratch.

## License

MIT. This folder is published from the JCSS repository with each JCSS release, so it matches the
JCSS people can download. JCSS builds the same guide into its own agents; change it there.
