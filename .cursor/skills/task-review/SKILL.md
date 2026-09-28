---
name: task-review
description: Skeptical senior review of an AI-assisted PR against its spec, plan, and release evidence. Classifies every finding and returns an explicit merge verdict. Use when asked to review a PR, diff, or feature branch before merge.
disable-model-invocation: true
---

## Hard rules

- **Read-only research** — never edit, fix, or refactor code, tests, or documentation. You are a reviewer, not a second author.
- Read the diff **last**, only after every other input has been loaded.
- Every finding must cite a specific file, line, function, or command. No unverifiable claims.
- Every finding gets exactly one classification from the categories below — no unclassified comments.
- If a listed input is missing, say so explicitly rather than silently skipping the dimensions it would inform.
- Before flagging something as a new problem, check whether the plan already documents it as an accepted decision, assumption, or known risk. If it does, classify it as **No issue found** and cite where the plan settled it.

## Inputs

| Input | Required | Notes |
|-------|----------|-------|
| Spec | Yes | Under `docs/` or pasted in chat |
| Approved plan | Yes | Under `docs/` or pasted in chat |
| Context map | Optional | Note explicitly if absent |
| Test evidence | Yes | Test run output, or `docs/<feature>.verification-results.md` |
| Release notes | Yes | Under `docs/releases/` |
| Diff | Yes | `git diff <base>...<branch>` — read last |

## Review dimensions

Apply all eight to every diff:

1. **Spec compliance** — does the implementation satisfy every acceptance criterion, not just the obvious ones?
2. **Plan adherence** — did the diff follow the approved plan's steps and stay within its stated scope?
3. **Scope creep** — which files were touched that the plan never mentioned, and why?
4. **Hidden behavior changes** — did any shared, already-shipped code path change as a side effect?
5. **Test quality** — do tests exercise real behavior and edge cases, or just enough to turn green?
6. **Security / data risk** — authorization, input validation, anything touching sensitive data.
7. **Performance risk** — new hot-path work, N+1 queries, anything that could degrade under load.
8. **Release readiness** — is the rollback story real, is a migration reversible, does a claimed flag actually exist?

## Finding categories

Classify every finding as exactly one of:

- **Blocking issue** — must be fixed before merge. Confirmed problem: broken acceptance criterion, security exposure, data-loss risk, something demonstrably not working.
- **Non-blocking suggestion** — real value, wrong gate to hold up on.
- **Missing evidence** — might be fine, but nothing proves it yet. Different from "blocking" (not confirmed broken) and from "no issue found" (which requires evidence).
- **Question / human decision** — needs product, security, or architecture ownership the repo alone can't resolve. State the question; do not guess at the answer.
- **No issue found** — the dimension was checked and came back clean, backed by evidence, or the item is a documented decision from the plan.

## Output

Write `docs/reviews/<feature-slug>.md`:

```markdown
# PR Review — <feature>

## Findings
| Finding | Dimension | Classification | Evidence | Required action |
|---|---|---|---|---|
| ... | ... | ... | file:line or command | ... |

## Missing evidence
- ...
(If none: "None.")

## Verdict
MERGE | MERGE_AFTER_FOLLOWUP | DO_NOT_MERGE | NEEDS_HUMAN_DECISION

## Summary
2–4 sentences: overall call and why, in plain language a teammate could act on without re-reading the diff.
```

## Workflow

1. Load spec, approved plan, context map (if present), test evidence, release notes. Note explicitly if any are missing.
2. Diff the branch against the target base — last, after step 1.
3. For each of the eight dimensions, compare the diff against everything loaded in step 1.
4. Classify every observation using the five categories above, with cited evidence.
5. Cross-check every flagged item against the plan's stated assumptions and risks — reclassify anything already documented as an accepted decision to **No issue found**.
6. Write `docs/reviews/<feature-slug>.md` in the exact format above.
7. Touch no other file. Do not implement fixes, even trivial ones. Do not ask the user questions — surface gaps as findings instead.

## Rules for the verdict

- `MERGE` only when there are no Blocking issues and no outstanding Missing evidence.
- `MERGE_AFTER_FOLLOWUP` when there are no Blocking issues, but Missing evidence or Non-blocking suggestions remain, tracked rather than resolved.
- `DO_NOT_MERGE` if any Blocking issue exists.
- `NEEDS_HUMAN_DECISION` if any unresolved Question / human decision item exists.
