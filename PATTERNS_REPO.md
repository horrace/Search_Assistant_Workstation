# Search Patterns: Separate Git Repo

The application's search patterns are intentionally **not** tracked by this
project's main git repo. They live in `data/patterns/` and are owned by a
separate git repo so that pattern edits and code changes never share a
commit history.

```
data/
  patterns/                  <- its own git repo
    CT_Head.json
    CT_Chest.json
    ...
    _inactive/               <- patterns currently retired (skipped by loader)
      OldStudy.json
    .git/                    <- standalone repo
```

The app loads every `*.json` file directly under `data/patterns/`. Any
directory whose name starts with `_` is skipped by the loader — that's how
the inactive area is hidden from the picker without losing history.

## One-time setup (development machine)

From the project root:

```bash
cd data/patterns
git init
git add .
git commit -m "Initial pattern set"

# Optional: push to a private GitHub repo
git remote add origin git@github.com:<you>/searchassistant-patterns.git
git branch -M main
git push -u origin main
```

That's it. The main project's `.gitignore` already ignores `data/patterns/`
so the standalone repo stays cleanly separated.

## On a fresh checkout

The main project does not ship pattern data. After cloning the project:

```bash
git clone git@github.com:<you>/searchassistant-patterns.git data/patterns
```

If you only want to test the app without cloning patterns, the app will
fall back to migrating a legacy `sp_list.json` (if present) into per-file
form on first launch.

## Inactive patterns

To retire a pattern without losing its history, the app moves the file from
`data/patterns/<Name>.json` to `data/patterns/_inactive/<Name>.json`. This
shows up in git as a rename, so blame and history are preserved across the
deactivation. Reactivating reverses the move.

## In-app version control

Once `data/patterns/` is a git repo (whether or not it has a remote), the
app uses [`isomorphic-git`](https://isomorphic-git.org/) to:

- **Auto-commit** every pattern edit as a separate commit on `main`
  (or whatever branch is checked out).
- **Show history per pattern** in the editor — list of commits that touched
  that one file.
- **Diff two versions** of a pattern using
  [`jsondiffpatch`](https://github.com/benjamine/jsondiffpatch) for a
  human-readable view of what changed.
- **Revert** a pattern to any prior commit (writes the old contents back
  and records a new commit).
- **Branch / tag** the pattern set — useful for trying experimental
  changes without disturbing the working set, or for snapshotting a
  release-ready bundle.

If the `data/patterns/` directory does not contain a `.git/`, version
control features are silently disabled (the app still loads patterns
normally).
