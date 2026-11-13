# editing-videos

An agent skill that gives Claude Code, Codex and other agents an editor's judgment: it works
out what kind of video it's looking at and what it's for, then edits for that. The same guide
drives the AI editor in [JCSS](https://jcss.tv).

- [SKILL.md](SKILL.md): the order of work, and which file to read when.
- [guide/](guide/read.md): the guide, one topic a file: [reading the video](guide/read.md),
  [pace](guide/pace.md), [shape](guide/shape.md), [cutting](guide/cut.md),
  [B-roll](guide/broll.md), [text and captions](guide/text.md), [sound](guide/sound.md),
  [checking](guide/check.md) and [learning from notes](guide/notes.md).
- [MOTION.md](MOTION.md): motion graphics written as ordinary web pages (any CSS, SVG, canvas,
  WebGL or library) and drawn to transparent frames by `scripts/page-frames.mjs`, which needs
  only Node 22+ and Chrome.
- [FINISHING.md](FINISHING.md): finishing a cut the person made themselves, without moving a
  cut: finding their cuts in the picture, filming screens again from the real page, text
  behind a person, and going from a draft to the full-size file.
- [JCSS.md](JCSS.md): editing with JCSS's `jcss` CLI, from nothing but the video. Read only
  when JCSS is the editor.

## What's in it

- `SKILL.md` is a short router: the order of work and which file to read when.
- `guide/` holds one topic per file. `guide/rules.md` is the short list of hard rules no style
  overrides; everything else is a default.
- `TASTE.md` is the taste profile (`editing.md`): how a person's own taste, said or measured,
  beats the guide's defaults, for one show or for all their videos.
- `scripts/` are small Node programs with no dependencies (most need ffmpeg): finding silence,
  proposing cuts, retiming a transcript, measuring a finished video, checking a render.
- `evals/` holds cases for checking a change to the guide: see [evals/README.md](evals/README.md).
  No hard-rule case may regress.

When a motion framework is wanted, the skill prefers HyperFrames; Remotion only where a project
already uses it. It never installs either unasked.

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
for the idea of a page clock the renderer runs.

For the taste profile, the checks and the first pass, ideas (not text or code) from
[video-use](https://github.com/browser-use/video-use) (MIT),
[HyperFrames](https://github.com/heygen-com/hyperframes)' media and review notes (Apache-2.0),
herk-edit-kit again, [Remotion's skills](https://github.com/remotion-dev/skills),
[ChatCut's agent plugin](https://github.com/chatcut-inc/agent-plugin) (Apache-2.0),
[video-agent-skills](https://github.com/Melvynx/video-agent-skills) (MIT),
[video-editing-skill](https://github.com/maxazure/video-editing-skill),
[b-roll-skills](https://github.com/iart-ai/b-roll-skills) (MIT),
[claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) (MIT) and
[OpenMontage](https://github.com/openmontageinc/openmontage). The scripts here are written from
scratch.

## License

MIT. This folder is published from the JCSS repository with each JCSS release, so it matches the
JCSS people can download. JCSS builds the same guide into its own agents; change it there.
