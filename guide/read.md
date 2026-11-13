### What a good edit is

Start here: what a good edit is, working with what's set up, and reading the video first.
Everything here is a default that the person's profile or words override, except what's marked
`(hard rule)`: see [rules.md](rules.md).

A good edit makes the video's point as clearly as possible, for the people who will watch it,
where they will watch it. It isn't a house style: a two-hour talk, a podcast, a tutorial and a
30-second short each need a different edit. Work out which one this is before you cut anything.

For a small, specific request (fix a title, cut this sentence, swap this shot), make that change
well and leave the rest alone. Use this guide for *how*; don't re-edit what nobody asked about.

### Work with what's set up

Use only the tools and services that are already working where you are: the editor, what's installed
on this computer, and accounts or API keys that are already set up. Never sign up for anything, ask
for or paste a key, install something paid, or send the person's footage to an outside service just
to follow this guide (hard rule). When a step would need a service that isn't set up (stock footage
or music, generated images, video or music, cloud transcription), skip it, do the best edit with
what's there, and at the end say what you skipped and what setting it up would add. A missing
service is never a reason to stop, and never a reason to lower the bar on the rest.

### Read the video first

Read the whole transcript (and the brief, notes and markers) before changing anything, then
write your read in two to four sentences (house):

- **What it is**: someone teaching, a talk to a room, a conversation, a demo on a screen, a
  story, an announcement, a performance, a mix.
- **Who watches it, and where**: a phone feed, a TV, a podcast app, a website, a room.
- **The point**: in one sentence, what a viewer should know, feel or do at the end.
- **What carries it**: the words, a face, the screen, an action, music.
- **Its natural length**: what it takes to make the point, not a target to hit.

For example: "A 40-minute talk given to a live room, for people who weren't there, watched on a
TV or laptop. The point is the closing challenge. The words carry it, and the room's reactions
matter. Keep its pace; cut the housekeeping and the false starts."

Ask when the answer would change the edit and the content can't settle it: who it's for, where
it's going, a length it must fit, what has to stay, what's off limits. Ask few questions, make
them specific, and give your best guess with each. When you can't ask (you get one answer),
edit from your best read and say what you assumed. The person's words and the brief always win
over your read.

Two answers are settled before the first cut, by the brief, by asking, or as a guess you state:
about how long it will be, and whether it's wide or vertical. A first version at the wrong
length is made again from nothing.

A third, when the video arrives already cut: is the cut theirs? A cut the person made is final
(hard rule). Add picture and sound over it; don't move a cut, shorten a pause or change its length.
Time changes only in a stretch they left whole on purpose (a long silent run that becomes a montage)
and for what they ask for by name (a cold open, a closing card). Put added time at one of their cuts
and move everything after it by the same amount. Then prove it: the frame count is the one you
worked out, and their voice lines up with their cut before and after each change.

Look at the files too. Know who and what is in each clip before you use it: a folder that was
handed over isn't all the same person or the same event. Compare where each file's picture and
sound start (`ffprobe -v error -show_entries stream=codec_type,start_time -of csv=p=0 clip.mp4`
prints both); a picture that starts seconds after its sound turns up in the edit as a frozen or
late shot.
