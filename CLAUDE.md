# Project context for Claude

## Branch policy

Before making any file edits at the start of a session:

1. Run `git branch --show-current` and `git rev-parse --show-toplevel` and
   surface the result to the user.
2. If the current branch is NOT `Load_from_exeDir_manualAttempt`, **stop
   and confirm with the user** before editing anything. In particular,
   working-tree paths containing `.claude/worktrees/` indicate a worktree
   checkout — never edit there without explicit confirmation; changes made
   in a worktree do not automatically land on the active branch and
   migrating them later is error-prone.
3. If the working tree has uncommitted changes (`git status --short` is
   non-empty), call them out before adding new edits, so the user is aware
   of work in progress that could be clobbered.

## Pattern data lives in its own repo

The application's search patterns live under `data/patterns/` and are
owned by a **separate git repo** (see `PATTERNS_REPO.md`). The main
project's `.gitignore` deliberately excludes `data/patterns/` — do not
add those files to the project repo, and do not edit them by overwriting
the directory wholesale. Per-file edits via the API (`save_pattern` /
`save_patterns`) are the supported path; they auto-commit to the
patterns repo via isomorphic-git.

