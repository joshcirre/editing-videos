# Evals

`evals.json` is a set of cases for telling whether a change to this skill made it better or
worse. Each case is a request in a person's own words, the situation around it, the behaviour a
good answer shows and the behaviour that fails. They test the judgment in the agent's answer
and plan: what it reads, what it asks, what it decides to cut or leave, what it says it
checked. They don't test rendered video; no case needs footage.

## A case

- `id`, `area`: a name, and the guide file or part of the skill it exercises.
- `prompt`: what the person says.
- `setup`: what is true around the request: a transcript excerpt, profile lines, which tools
  exist, what the agent already did. Give it to the agent as facts, or build it as files.
- `expect`: behaviours a good response shows. `fail`: behaviours that fail the case.
- `hard_rule`: `true` when the case tempts the agent to break a rule in
  [../guide/rules.md](../guide/rules.md).

## Run one by hand

1. Start a fresh agent with this skill loaded and nothing else from earlier runs.
2. Give it the case's `setup` as the situation, then the `prompt` as the person's message.
   When the setup lists tools that aren't there, tell the agent so; don't let it find out what
   your own computer has.
3. Let it answer once. When it asks a question, answer the way the setup implies, or say "your
   call", and let it carry on to a plan or a result.
4. Compare what it did and said with `expect` and `fail`.

A harness does the same: one fresh run per case, then a grader (a person, or a model given the
case and the run) marks each `expect` and `fail` line as seen or not seen.

## Grade

- **A case passes only when no `fail` behaviour appears.** One is enough to fail it.
- **`expect` lines say how good a pass is.** A pass that shows under half of them is weak:
  note it, because it is the next thing to regress.
- **Hard-rule cases are must-pass.** A skill that fails one is broken, whatever its total.
- **Grade behaviour, not wording.** A default in `expect` (0.7 of a zoom, 4 dB) is graded as
  "one change of about that size"; arithmetic (a retimed word, a frame count) is exact.
- Run each case three times (house) when you can; passing once in three isn't a pass.

## The bar for a change to the guide

Run every case before the change and after it. The change goes in when no hard-rule case
regresses and the overall pass rate doesn't drop. A change that fixes one case and breaks
another isn't finished. When a case fails because the guide now says something different on
purpose, change the case in the same commit and say why.

## Add a case when a note reveals a gap

This is the guide's own note-to-rule loop ([../guide/notes.md](../guide/notes.md)), applied to
the skill. When a person corrects an edit and the guide should have prevented it:

1. Write the case first: their request as `prompt`, the situation as `setup`, what went wrong
   as a `fail` line, what they wanted as `expect`. Invent the content: no real names or brands.
2. Run it against the skill as it is. It should fail; otherwise the gap is somewhere else.
3. Change the guide, run it again, then run all the others.

Keep each case about one decision. Bump `version` when a case's meaning changes.
