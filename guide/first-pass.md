### A first pass proposes, you decide

Covers using a detector (this skill's script, or the editor's own) to find possible cuts:
what it's for, what it can't see, how to review its list, and how to report what it removed.
Everything here is a default that the person's profile or words override, except what's marked
`(hard rule)`: see [rules.md](rules.md).

A first pass is for finding, not deciding. A detector reads every word gap in seconds and never
gets bored, so it catches the doubled "the" you'd read past. It also has no idea what the video
is about. Use it to make your own read of the transcript faster and more complete, never in
place of it.

#### What it finds

- **Stutters**: the same word or few words twice in a row, under about 0.5 s apart (common).
  Emphasis looks identical ("very, very fast"), so every one needs a listen.
- **Retakes and false starts**: two phrases close together that share most of their words, or a
  short phrase that stops and starts again the same way. The list proposes dropping the earlier
  one. The last take is not automatically the best.
- **Fillers**: those with silence on both sides, and those that run into a word. The second
  kind is listed only so you know it's there: it stays.
- **Silences**: gaps between words, with a proposed kept pause.
- **Long words**: a short word that lasts far too long. A stumble may sit inside it, or the
  transcriber stretched it over a pause or invented it over music. Listen; nothing to cut yet.

#### What it can't see

- **A retake said in other words.** "It caches the page" and "so the result gets stored" share
  nothing a word counter can match. Only reading finds these.
- **A wrong fact, a wrong name, a line the speaker would regret.** Fluent mistakes look clean.
- **A pause that's doing work**: the beat before a punchline, the breath after a question, a
  moment the speaker lets land. "So does speed really matter? … Sometimes." is one sentence
  with its pause; a silence detector offers to close it.
- **A pause while something happens in the picture.** Silence in the sound is not dead air if
  the picture is doing something: a test run, a page loading to its result, a reaction, a
  demo with music. A transcript-only pass sees 30 s of nothing there.
- **Whether a repeat is meant**: a list, a refrain, a recap, a correction to be heard.
- **Where the sound really ends.** Its times come from the transcript, and transcript times
  are estimates, not cut points (hard rule in [cut.md](cut.md)).

#### Reviewing the list

1. **Read the whole transcript first**, start to end, and note the retakes and dead stretches
   you see. Then open the candidates. What the list has that you missed is its value; what
   you found that it lacks is the reason you read.
2. **Read each candidate in its context**, the words either side, not the flagged words alone.
   Start with the confident ones, but a confidence is the detector's guess at the pattern, not
   at the edit: a 0.9 can still be emphasis.
3. **Decide by the paths in [cut.md](cut.md).** Retakes, stutters and false starts go through
   its retake steps (write out the thought that should survive, pick the take that's whole,
   keep words only one take has). Fillers go through its filler test.
4. **For every silence, look at the picture** across the gap before you close it. Anything
   over about 3 s (house) is rarely a pause: expect a screen, B-roll or music, and cut only
   the waiting.
5. **Accept by item, never by kind.** "All stutters" is the pass deciding. Leaving most of the
   list uncut is a fine outcome, and so is an empty list.
6. **Place each accepted cut by the sound**, then check both sides of the join
   ([cut.md](cut.md)). The proposed times get you near; they aren't the cut.
7. **Tell the person what you did by quoting words**: "I dropped the first 'and then the long
   awaited Rust' and kept the second, which finishes the sentence", not "accepted candidates
   12 and 44".

#### How much is too much

- **Report every automatic pass as seconds and percent removed**, by kind: "silences: 41 s
  (4.8%), retakes: 14 s (1.6%), 3 fillers: 1.2 s". The person can't judge "tightened it up".
- **Use a removal budget as a sanity check.** If a pass wants more than about a fifth of a
  talking video (common), the thresholds are wrong for this speaker or this kind of video, not
  the speaker for the thresholds. Raise them and run it again; don't accept the list and
  don't quietly drop the weakest candidates to get under.
- **Long stretches of no speech blow the budget on silences alone.** Those aren't pauses:
  judge them as screen time ([pace.md](pace.md)), not as gaps.
- **For a reflective video, a story or a live room, propose much less**: a longer gap before
  anything counts as silence, longer kept pauses, laughs and reactions left whole. The row in
  [pace.md](pace.md) sets it.
- **Silence thresholds come from the file itself**: how loud this room is when nobody speaks
  and how long this person's pauses are ([silence.md](silence.md)). The script starts from a
  kept pause of 0.3 s after a sentence and 0.2 s inside one (house), more of it after the
  outgoing word than before the incoming one; a profile's measured numbers replace both.
- **After applying, retime the transcript** so captions, text and later cuts use the new
  times ([transcript.md](transcript.md)), then run the checks ([check.md](check.md)).

#### When the editor has its own detector

Use it the same way: as proposals. JCSS has `jcss edit cuts --find`; Descript has filler and
gap removal; most editing programs have a silence tool. Ask for a list or a preview, not an
applied cut. If it can only apply, apply on a copy, read what it removed against the
transcript, and put back what was meant. Report its seconds and percent like any other pass.

#### With the script

Paths are from this skill's folder. Needs Node 22 or later and a transcript with word times; it
doesn't open the video. `--help` lists every threshold; for another language pass
`--stop-words <file>` and `--fillers`.

```
node scripts/cut-candidates.mjs --words words.json --out candidates.json
node scripts/cut-candidates.mjs --words words.json --candidates candidates.json \
  --apply decisions.json --out cut.json --source clip.mp4 --fps 30
```

The first prints counts per kind, seconds proposed, the share of the duration and `overBudget`,
and writes the list. Each candidate has an `index`, the `start` and `end` it would remove,
`text` (6 words either side, the part to remove in `[brackets]`), `keep`, a `confidence` and a
`why`. Confidence 0 or `"cut": false` means nothing is proposed.

The second turns `{"accept":[3, 12, 44]}` into a keep list on the frame grid. If you placed a
cut by the sound, edit that candidate's `start` and `end` first. A boundary that would land
inside a word is moved to the nearest gap and reported, and kept pieces under 1 s are counted:
they read as glitches. `--accept-all` is for testing thresholds; don't render from it.
