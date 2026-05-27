// history.js — renderer for the Pattern History window.
//
// Talks to main via window.electronAPI (preload). Two data flows:
//   1) callAPI('get_available_patterns') to populate the pattern dropdown.
//   2) electronAPI.vc.* for git operations (log/diff/revert/branches/tags).
//
// Selection model:
//   - Single-click a commit -> compare that commit's pattern file vs the
//     current working-tree contents.
//   - Shift-click a second commit -> compare commit-A (older) vs commit-B
//     (newer). Click again on the same row to deselect that side.

(function () {
  const $ = (id) => document.getElementById(id);

  const state = {
    patterns: [],
    currentPattern: null,
    commits: [],
    leftOid: null,
    rightOid: null,   // null => WORKDIR
    branches: [],
    currentBranch: null,
  };

  // -- Bootstrap -----------------------------------------------------------

  document.addEventListener('DOMContentLoaded', async () => {
    $('close-btn').addEventListener('click', () => window.electronAPI.closeHistory());
    $('pattern-selector').addEventListener('change', (e) => loadPattern(e.target.value));
    $('branch-selector').addEventListener('change', (e) => checkoutBranch(e.target.value));
    $('new-branch-btn').addEventListener('click', createBranch);
    $('new-tag-btn').addEventListener('click', createTag);
    $('revert-btn').addEventListener('click', revertToSelected);

    window.electronAPI.onPatternSelected((name) => {
      if (name && state.patterns.includes(name)) {
        $('pattern-selector').value = name;
        loadPattern(name);
      }
    });

    const status = await window.electronAPI.vc.available();
    if (!status?.available || !status?.isRepo) {
      $('status').textContent = 'No git repo at data/ — run the setup in PATTERNS_REPO.md.';
      $('status').style.color = '#e88';
    }

    await loadPatternList();
    await refreshBranches();
    await refreshTags();
  });

  // -- Pattern list --------------------------------------------------------

  function loadPatternList() {
    return new Promise((resolve) => {
      const cleanup = window.electronAPI.onAPIResponse((data) => {
        if (data?.responseFor !== 'get_available_patterns') return;
        cleanup();
        state.patterns = data.result || [];
        const sel = $('pattern-selector');
        sel.innerHTML = '';
        for (const p of state.patterns) {
          const opt = document.createElement('option');
          opt.value = p; opt.textContent = p;
          sel.appendChild(opt);
        }
        if (state.patterns.length) loadPattern(state.patterns[0]);
        resolve();
      });
      window.electronAPI.callAPI('get_available_patterns', {});
    });
  }

  // -- Commits / diff ------------------------------------------------------

  async function loadPattern(name) {
    state.currentPattern = name;
    state.leftOid = state.rightOid = null;
    $('revert-btn').disabled = true;
    $('diff-output').className = 'diff-empty';
    $('diff-output').textContent = 'Loading commits…';

    const log = await window.electronAPI.vc.log({ pattern: name });
    if (log?.error) {
      $('diff-output').textContent = `Error: ${log.error}`;
      return;
    }
    state.commits = log || [];
    renderCommits();
    if (!state.commits.length) {
      $('diff-output').textContent = 'No commits yet for this pattern.';
    } else {
      $('diff-output').textContent = 'Click a commit to see the diff vs the current file.';
    }
  }

  function renderCommits() {
    const box = $('commits');
    box.innerHTML = '';
    for (const c of state.commits) {
      const row = document.createElement('div');
      row.className = 'commit-row';
      row.dataset.oid = c.oid;
      const date = new Date(c.timestamp).toLocaleString();
      row.innerHTML = `
        <div class="msg"></div>
        <div class="meta"></div>
      `;
      row.querySelector('.msg').textContent = c.message;
      row.querySelector('.meta').textContent = `${c.oid.slice(0, 7)} • ${c.author} • ${date}`;
      row.addEventListener('click', (e) => selectCommit(c.oid, e.shiftKey));
      box.appendChild(row);
    }
    paintSelection();
  }

  function paintSelection() {
    document.querySelectorAll('.commit-row').forEach(row => {
      row.classList.remove('selected', 'compare-left', 'compare-right');
      const oid = row.dataset.oid;
      if (oid === state.leftOid)  row.classList.add('compare-left');
      if (oid === state.rightOid) row.classList.add('compare-right');
      if (oid === state.leftOid && !state.rightOid) row.classList.add('selected');
    });
  }

  async function selectCommit(oid, shift) {
    if (shift && state.leftOid && state.leftOid !== oid) {
      // Second selection: figure out older vs newer by index in log
      const idxA = state.commits.findIndex(c => c.oid === state.leftOid);
      const idxB = state.commits.findIndex(c => c.oid === oid);
      // Older = larger index (log is newest-first)
      const older = idxA > idxB ? state.leftOid : oid;
      const newer = idxA > idxB ? oid : state.leftOid;
      state.leftOid  = older;
      state.rightOid = newer;
    } else {
      // Single-select: diff this commit vs working tree
      state.leftOid  = oid;
      state.rightOid = null;
    }
    paintSelection();
    $('revert-btn').disabled = !state.leftOid || state.rightOid !== null;
    await renderDiff();
  }

  async function renderDiff() {
    if (!state.leftOid) {
      $('diff-output').className = 'diff-empty';
      $('diff-output').textContent = 'Select a commit.';
      return;
    }
    $('diff-output').className = 'diff-empty';
    $('diff-output').textContent = 'Computing diff…';
    const res = await window.electronAPI.vc.diff({
      pattern: state.currentPattern,
      oidA: state.leftOid,
      oidB: state.rightOid, // null -> WORKDIR
    });
    if (res?.error) {
      $('diff-output').textContent = `Error: ${res.error}`;
      return;
    }
    $('diff-output').className = '';
    $('diff-output').innerHTML = res.htmlFormatted || '<p><em>No changes</em></p>';
  }

  // -- Revert --------------------------------------------------------------

  async function revertToSelected() {
    if (!state.leftOid || state.rightOid) return;
    const short = state.leftOid.slice(0, 7);
    if (!confirm(`Revert ${state.currentPattern} to commit ${short}? This creates a new commit on top of the current branch.`)) return;
    const res = await window.electronAPI.vc.revert({
      pattern: state.currentPattern,
      oid: state.leftOid,
    });
    if (res?.error) {
      $('status').textContent = `Revert failed: ${res.error}`;
      return;
    }
    $('status').textContent = `Reverted (new commit ${res.oid.slice(0, 7)}).`;
    await loadPattern(state.currentPattern);
  }

  // -- Branches ------------------------------------------------------------

  async function refreshBranches() {
    const res = await window.electronAPI.vc.listBranches();
    if (res?.error) return;
    state.branches = res.branches || [];
    state.currentBranch = res.current || null;
    const sel = $('branch-selector');
    sel.innerHTML = '';
    for (const b of state.branches) {
      const opt = document.createElement('option');
      opt.value = b; opt.textContent = b;
      if (b === state.currentBranch) opt.textContent += '  *';
      sel.appendChild(opt);
    }
    sel.value = state.currentBranch || '';
  }

  async function createBranch() {
    const name = prompt('New branch name:');
    if (!name) return;
    const res = await window.electronAPI.vc.createBranch({ name, checkout: true });
    if (res?.error) { $('status').textContent = `Branch failed: ${res.error}`; return; }
    $('status').textContent = `Created and switched to branch '${name}'.`;
    await refreshBranches();
    if (state.currentPattern) await loadPattern(state.currentPattern);
  }

  async function checkoutBranch(name) {
    if (!name || name === state.currentBranch) return;
    const res = await window.electronAPI.vc.checkoutBranch({ name });
    if (res?.error) { $('status').textContent = `Checkout failed: ${res.error}`; await refreshBranches(); return; }
    $('status').textContent = `Switched to branch '${name}'.`;
    await refreshBranches();
    await loadPatternList();
  }

  // -- Tags ----------------------------------------------------------------

  async function refreshTags() {
    const res = await window.electronAPI.vc.listTags();
    if (res?.error) return;
    const sel = $('tag-selector');
    sel.innerHTML = '<option value="">(tags)</option>';
    for (const t of res.tags || []) {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    }
  }

  async function createTag() {
    const name = prompt('Tag name (e.g. v1.0):');
    if (!name) return;
    const message = prompt(`Tag message for ${name}:`, name) || name;
    const res = await window.electronAPI.vc.createTag({ name, message });
    if (res?.error) { $('status').textContent = `Tag failed: ${res.error}`; return; }
    $('status').textContent = `Created tag '${name}'.`;
    await refreshTags();
  }
})();
