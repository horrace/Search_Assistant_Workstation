// version-control.js
//
// Thin wrapper around isomorphic-git scoped to the patterns directory.
// Every exported function takes `dir` (= the patterns dir) and returns a
// Promise. The wrapper is intentionally side-effect-light — it does not
// hold its own state, so multiple windows / processes can call it.
//
// File paths inside the repo are always passed as POSIX-style relative
// paths ("CT_Head.json" or "_inactive/Outro.json"); isomorphic-git treats
// these as repo-relative regardless of platform.

const fs = require('fs');
const path = require('path');
const git = require('isomorphic-git');
const jsondiffpatch = require('jsondiffpatch');

const DEFAULT_AUTHOR = {
  name: 'Search Assistant',
  email: 'app@searchassistant.local',
};

const diffpatcher = jsondiffpatch.create({
  // Compare list items by `abbr` when possible so reorders stay readable.
  objectHash: (obj, idx) => obj?.abbr ?? `$idx:${idx}`,
  arrays: { detectMove: true, includeValueOnMove: false },
});

function repoRelative(p) {
  // Normalize to forward slashes for isomorphic-git.
  return p.split(path.sep).join('/');
}

async function isRepo(dir) {
  try {
    await git.resolveRef({ fs, dir, ref: 'HEAD' });
    return true;
  } catch {
    return fs.existsSync(path.join(dir, '.git'));
  }
}

/**
 * Initialize a git repo at `dir` if one doesn't already exist. If the
 * directory has files but no .git, make the initial commit so subsequent
 * saves have something to diff against.
 */
async function init(dir) {
  if (!fs.existsSync(dir)) return false;
  if (await isRepo(dir)) return true;

  await git.init({ fs, dir, defaultBranch: 'main' });
  // Stage everything currently present
  const files = walkFiles(dir).map(f => repoRelative(path.relative(dir, f)));
  for (const f of files) {
    await git.add({ fs, dir, filepath: f });
  }
  if (files.length) {
    await git.commit({
      fs,
      dir,
      author: DEFAULT_AUTHOR,
      message: 'Initial pattern set',
    });
  }
  return true;
}

function walkFiles(dir, base = dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkFiles(full, base));
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Stage and commit a single file. No-op (returns null) if the file's
 * working-tree contents already match HEAD.
 */
async function commitFile(dir, relpath, message) {
  if (!await isRepo(dir)) return null;
  const filepath = repoRelative(relpath);

  // Check if there's anything to commit for this file
  const status = await git.status({ fs, dir, filepath });
  if (status === 'unmodified' || status === 'ignored') return null;

  await git.add({ fs, dir, filepath });
  const oid = await git.commit({
    fs, dir,
    author: DEFAULT_AUTHOR,
    message,
  });
  return oid;
}

/**
 * Stage all changes (useful after renames such as activate/deactivate) and
 * commit. No-op if there is nothing to commit.
 */
async function commitAll(dir, message) {
  if (!await isRepo(dir)) return null;
  const matrix = await git.statusMatrix({ fs, dir });
  // Each row: [filepath, HEAD, WORKDIR, STAGE]
  let touched = 0;
  for (const [filepath, head, workdir] of matrix) {
    if (head !== workdir) {
      if (workdir === 0) {
        await git.remove({ fs, dir, filepath });
      } else {
        await git.add({ fs, dir, filepath });
      }
      touched++;
    }
  }
  if (!touched) return null;
  return git.commit({ fs, dir, author: DEFAULT_AUTHOR, message });
}

/**
 * Commit log for a single pattern file (relpath relative to dir). Returns
 * newest-first array of { oid, message, author, timestamp }.
 */
async function logFile(dir, relpath, depth = 200) {
  if (!await isRepo(dir)) return [];
  const filepath = repoRelative(relpath);
  const commits = await git.log({ fs, dir, depth, filepath, force: true });
  return commits.map(c => ({
    oid: c.oid,
    message: c.commit.message.trim(),
    author: c.commit.author.name,
    timestamp: c.commit.author.timestamp * 1000, // ms
  }));
}

/**
 * Full repo log (newest-first).
 */
async function logRepo(dir, depth = 200) {
  if (!await isRepo(dir)) return [];
  const commits = await git.log({ fs, dir, depth });
  return commits.map(c => ({
    oid: c.oid,
    message: c.commit.message.trim(),
    author: c.commit.author.name,
    timestamp: c.commit.author.timestamp * 1000,
  }));
}

/**
 * Read a file's contents at a given commit. Returns a parsed JSON object,
 * or null if the file did not exist at that commit.
 */
async function readFileAt(dir, oid, relpath) {
  if (!await isRepo(dir)) return null;
  const filepath = repoRelative(relpath);
  try {
    const { blob } = await git.readBlob({ fs, dir, oid, filepath });
    const text = Buffer.from(blob).toString('utf8');
    return JSON.parse(text);
  } catch (err) {
    if (/Could not find/i.test(err.message)) return null;
    throw err;
  }
}

/**
 * Diff a single pattern file between two commits. `oidB` may be the literal
 * string "WORKDIR" to compare oidA against the current on-disk contents.
 * Returns { delta, htmlFormatted, left, right }.
 */
async function diffFile(dir, oidA, oidB, relpath) {
  const left = await readFileAt(dir, oidA, relpath);

  let right;
  if (oidB === 'WORKDIR') {
    const fp = path.join(dir, relpath);
    right = fs.existsSync(fp)
      ? JSON.parse(fs.readFileSync(fp, 'utf8'))
      : null;
  } else {
    right = await readFileAt(dir, oidB, relpath);
  }

  const delta = diffpatcher.diff(left, right);
  const htmlFormatted = delta
    ? jsondiffpatch.formatters.html.format(delta, left)
    : '<p><em>No changes</em></p>';

  return { delta: delta || null, htmlFormatted, left, right };
}

/**
 * Revert a single pattern file to a prior commit. Writes the file back to
 * the working tree and records a new commit on top of HEAD.
 */
async function revertFile(dir, oid, relpath, message) {
  if (!await isRepo(dir)) throw new Error('Not a git repo');
  const filepath = repoRelative(relpath);
  const content = await readFileAt(dir, oid, filepath);
  const target = path.join(dir, relpath);

  if (content === null) {
    // File didn't exist at that commit — remove from working tree.
    if (fs.existsSync(target)) fs.unlinkSync(target);
    await git.remove({ fs, dir, filepath });
  } else {
    fs.writeFileSync(target, JSON.stringify(content, null, 2));
    await git.add({ fs, dir, filepath });
  }

  const newOid = await git.commit({
    fs, dir,
    author: DEFAULT_AUTHOR,
    message: message || `Revert ${relpath} to ${oid.slice(0, 7)}`,
  });
  return newOid;
}

// ---- Branches & tags ----

async function listBranches(dir) {
  if (!await isRepo(dir)) return { current: null, branches: [] };
  const branches = await git.listBranches({ fs, dir });
  let current = null;
  try {
    current = await git.currentBranch({ fs, dir, fullname: false });
  } catch {}
  return { current, branches };
}

async function createBranch(dir, name, checkout = true) {
  if (!await isRepo(dir)) throw new Error('Not a git repo');
  await git.branch({ fs, dir, ref: name });
  if (checkout) {
    await git.checkout({ fs, dir, ref: name });
  }
  return name;
}

async function checkoutBranch(dir, name) {
  if (!await isRepo(dir)) throw new Error('Not a git repo');
  await git.checkout({ fs, dir, ref: name, force: false });
  return name;
}

async function listTags(dir) {
  if (!await isRepo(dir)) return [];
  return git.listTags({ fs, dir });
}

async function createTag(dir, name, message) {
  if (!await isRepo(dir)) throw new Error('Not a git repo');
  await git.annotatedTag({
    fs, dir, ref: name,
    message: message || name,
    tagger: DEFAULT_AUTHOR,
  });
  return name;
}

module.exports = {
  init,
  commitFile,
  commitAll,
  logFile,
  logRepo,
  readFileAt,
  diffFile,
  revertFile,
  listBranches,
  createBranch,
  checkoutBranch,
  listTags,
  createTag,
  isRepo,
};
