# editing-videos

An agent skill that gives Claude Code, Codex and other agents an editor's judgment: it works
out what kind of video it's looking at and what it's for, then edits for that. The same guide
drives the AI editor in [JCSS](https://jcss.tv).

- [SKILL.md](SKILL.md): how an agent applies it.
- [EDITING.md](EDITING.md): the guide (reading the video, pacing from the content, shaping,
  cutting, B-roll, captions and titles, sound, checking, learning from notes).

## Install

Claude Code:

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

## License

MIT. This folder is published from the JCSS repository, where JCSS builds the same guide into its
own agents; change it there.
