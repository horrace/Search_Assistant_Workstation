document.body.style.backgroundColor = ''; // Clear visual test
// Capture and send renderer errors to the main process
if (window.electronAPI && typeof window.electronAPI.sendErrorToMain === 'function') {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError.apply(console, args);
    try {
      let errorToSend;
      if (args[0] instanceof Error) {
        const err = args[0];
        errorToSend = { name: err.name, message: err.message, stack: err.stack };
      } else {
        const message = args.map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg);
            } catch (e) {
              return '[Unserializable Object]';
            }
          }
          return String(arg);
        }).join(' ');
        errorToSend = { name: 'ConsoleError', message: message, stack: (new Error(message)).stack };
      }
      window.electronAPI.sendErrorToMain(errorToSend);
    } catch (e) {
      originalConsoleError('[Editor] Error sending console.error to main process:', e, e.stack);
    }
  };

  const originalWindowOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if(originalWindowOnError) originalWindowOnError(message, source, lineno, colno, error);
    try {
      let errorToSend;
      if (error) {
        errorToSend = { name: error.name, message: error.message, stack: error.stack, source: source, lineno: lineno, colno: colno };
      } else {
        errorToSend = { name: 'GlobalError', message: String(message), stack: (new Error(String(message))).stack, source: source, lineno: lineno, colno: colno };
      }
      window.electronAPI.sendErrorToMain(errorToSend);
    } catch (e) {
      originalConsoleError('[Editor] Error sending window.onerror to main process:', e, e.stack);
    }
    return false; 
  };

  const originalWindowOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    if(originalWindowOnUnhandledRejection) originalWindowOnUnhandledRejection(event);
    try {
      let errorToSend;
      if (event.reason instanceof Error) {
        const err = event.reason;
        errorToSend = { name: err.name, message: err.message, stack: err.stack };
      } else {
        const message = String(event.reason || 'Unhandled promise rejection');
        errorToSend = { name: 'UnhandledPromiseRejection', message: message, stack: (new Error(message)).stack };
      }
      window.electronAPI.sendErrorToMain(errorToSend);
    } catch (e) {
      originalConsoleError('[Editor] Error sending onunhandledrejection to main process:', e, e.stack);
    }
  };

} else {
  console.error("[Editor] CRITICAL SETUP FAILURE: 'window.electronAPI' or 'window.electronAPI.sendErrorToMain' is not available. Error reporting to main process is DISABLED.");
}

// DOM Elements
const patternSelector = document.getElementById('pattern-selector');
const newPatternBtn = document.getElementById('new-pattern-btn');
const backBtn = document.getElementById('back-btn');
const undoBtn = document.getElementById('undo-btn'); // Get reference to existing Undo button
const redoBtn = document.getElementById('redo-btn'); // Get reference to Redo button
const patternItems = document.getElementById('pattern-items');
const partsBankItems = document.getElementById('parts-bank-items');
const contextMenu = document.getElementById('context-menu');
const newPatternDialog = document.getElementById('new-pattern-dialog');
const newPatternDialogOverlay = document.getElementById('new-pattern-dialog-overlay');
const newPatternDialogContent = document.getElementById('new-pattern-dialog-content'); // Keep if direct interaction with content needed
const newPatternNameInput = document.getElementById('new-pattern-name');
const dialogOkBtn = document.getElementById('dialog-ok-btn');
const dialogCancelBtn = document.getElementById('dialog-cancel-btn');
const chapterInputDialog = document.getElementById('chapter-input-dialog');
const chapterDialogTitle = document.getElementById('chapter-dialog-title');
let chapterInputName = document.getElementById('chapter-input-name'); // Changed to let for reassignment
const chapterDialogOkBtn = document.getElementById('chapter-dialog-ok-btn');
const chapterDialogCancelBtn = document.getElementById('chapter-dialog-cancel-btn');

// New Dialog: Chunk Assignment
const chunkAssignmentDialog = document.getElementById('chunk-assignment-dialog');
const chunkAssignmentDialogTitle = document.getElementById('chunk-assignment-dialog-title');
const chunkAssignItemName = document.getElementById('chunk-assign-item-name');
const chunkAssignSelect = document.getElementById('chunk-assign-select');
const chunkAssignDialogOkBtn = document.getElementById('chunk-assign-dialog-ok-btn');
const chunkAssignDialogCancelBtn = document.getElementById('chunk-assign-dialog-cancel-btn');

// Mirror Content Dialog
const mirrorContentDialog = document.getElementById('mirror-content-dialog');

// SP List Menu Elements
const spListMenuBtn = document.getElementById('sp-list-menu-btn');
const spListDropdown = document.getElementById('sp-list-dropdown');
const spListFilename = document.getElementById('sp-list-filename');
const currentSpListPath = document.getElementById('current-sp-list-path');
const loadDifferentSpListBtn = document.getElementById('load-different-sp-list-btn');

// Path Information Elements
const pathProcessCwd = document.getElementById('path-process-cwd');
const pathProcessExecPath = document.getElementById('path-process-exec-path');
const pathAppPath = document.getElementById('path-app-path');
const pathPortableExecutableDir = document.getElementById('path-portable-executable-dir');
const pathPortableExecutableFile = document.getElementById('path-portable-executable-file');
const pathCurrentDir = document.getElementById('path-current-dir');
const pathFilePath = document.getElementById('path-file-path');
const pathSpListPath = document.getElementById('path-sp-list-path');
const pathDataDir = document.getElementById('path-data-dir');
const pathSettingsDataDir = document.getElementById('path-settings-data-dir');
const pathNodeEnv = document.getElementById('path-node-env');
const pathAppIsPackaged = document.getElementById('path-app-is-packaged');

// Debug: Check if all elements were found (only log if any are missing)
if (!spListMenuBtn || !spListDropdown || !spListFilename || !currentSpListPath || !loadDifferentSpListBtn) {
  console.error('[SP List Menu] Missing DOM Elements:');
  if (!spListMenuBtn) console.error('spListMenuBtn not found');
  if (!spListDropdown) console.error('spListDropdown not found');
  if (!spListFilename) console.error('spListFilename not found');
  if (!currentSpListPath) console.error('currentSpListPath not found');
  if (!loadDifferentSpListBtn) console.error('loadDifferentSpListBtn not found');
}
const mirrorSourcePatternSelect = document.getElementById('mirror-source-pattern');
const mirrorContentSelection = document.getElementById('mirror-content-selection');
const mirrorContentOptions = document.getElementById('mirror-content-options');
const mirrorDialogOkBtn = document.getElementById('mirror-dialog-ok-btn');
const mirrorDialogCancelBtn = document.getElementById('mirror-dialog-cancel-btn');

const togglePartsBankBtn = document.getElementById('toggle-parts-bank-btn');
const partsBankContainer = document.getElementById('parts-bank-container');

if (togglePartsBankBtn && partsBankContainer) {
    togglePartsBankBtn.addEventListener('click', () => {
        partsBankContainer.classList.toggle('collapsed');
        if (partsBankContainer.classList.contains('collapsed')) {
            togglePartsBankBtn.textContent = '▶';
        } else {
            togglePartsBankBtn.textContent = '◀';
        }
    });
}

// State
let patterns = [];
let currentPattern = '';
let currentPatternItems = [];
let partsBankList = [];
let editorSettings = { hideOutroInEditor: false }; // Default editor settings
let selectedIndex = -1;
let selectedIndices = [];
let multiSelectionMode = false;
let contextMenuTargetIndex = -1;
let chunkFirstItemIndex = -1; // Keep track of first item in chunk creation
let contextMenuTargetRenderedIndex = -1;
let contextMenuTargetIsChapter = false;
let contextMenuTargetChapterName = '';
let contextMenuTargetChapterID = '';
let contextMenuTargetSpecificIndex = -1;
let chapterDialogContext = null;
let contextMenuTargetIsChunkContainer = false; 
let contextMenuTargetChunkId = null; 
let chunkAssignmentContext = null; // For storing context for the chunk assignment dialog
let isDragging = false; // Declare isDragging
let currentPatternData = [];
let mirrorReplacementContext = null; // For storing context for mirror replacement
let sacrificedItems = [];
let automaticItems = [];   // Phase 3.3 — "Automatic" (formerly Mastered): per-pattern, same semantics as Sacrificed
let abbrRegistry = {};
let generalAbbrRegistry = {};

// Phase 3 — Library (canonical Entry store)
let libraryEntries = {};   // slug → Entry
let aliasIndex = {};       // alias_lc → slug   (exact, lowercased — primary lookup)
let stemIndex  = {};       // stem    → slug   (plural-insensitive fallback)
let abbrActiveTab = 'specific';   // legacy — kept for back-compat with any stray references
// Phase 3.4 — Library dialog state
let libraryActiveTab = 'entries';
let librarySortMode  = 'alias';   // 'alias' | 'fullName'
let selectedLibrarySlug = null;
let _libSaveTimeout = null;
const LIBRARY_DIALOG_STATE_KEY = 'searchAssistant.libraryDialogDevState';

// Persist Library dialog UI across renderer hot-reloads (dev). Sync write before saves
// so a file-watch reload does not lose open/selection/filter state.
function persistLibraryDialogState() {
  try {
    const overlay = document.getElementById('abbr-registry-overlay');
    const open = overlay && overlay.style.display !== 'none';
    if (!open) {
      sessionStorage.removeItem(LIBRARY_DIALOG_STATE_KEY);
      return;
    }
    sessionStorage.setItem(LIBRARY_DIALOG_STATE_KEY, JSON.stringify({
      open: true,
      selectedSlug: selectedLibrarySlug,
      tab: libraryActiveTab,
      sortMode: librarySortMode,
      filter: currentLibraryFilter()
    }));
  } catch (_) { /* sessionStorage unavailable */ }
}

function restoreLibraryDialogIfNeeded() {
  try {
    const raw = sessionStorage.getItem(LIBRARY_DIALOG_STATE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s.open) return;

    libraryActiveTab = s.tab || 'entries';
    librarySortMode = s.sortMode || 'alias';
    selectedLibrarySlug = (s.selectedSlug && libraryEntries[s.selectedSlug]) ? s.selectedSlug : null;

    const overlay = document.getElementById('abbr-registry-overlay');
    if (overlay) overlay.style.display = 'flex';

    const sortBtn = document.getElementById('library-sort-toggle');
    if (sortBtn) {
      sortBtn.textContent = `Sort: ${librarySortMode === 'alias' ? 'Alias' : 'Full Name'}`;
    }

    applyLibraryTabVisibility();
    renderLibrary(s.filter || '');
    const search = document.getElementById('abbr-registry-search');
    if (search && s.filter) search.value = s.filter;
  } catch (_) { /* ignore corrupt state */ }
}
let coverageRequirements = [];
let coverageEditMode = false;
let covMatchTagViewOnly = true; // false = part/subpart + view; true = view only (window still on hover)

// Load available patterns
async function loadPatterns() {
  try {
    // Send request to backend
    window.electronAPI.callAPI('get_available_patterns', {});
    
    let retryTimeout;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    // Function to retry loading patterns
    const retryLoadPatterns = (delay = 3000) => {
      // Clear any existing retry timeout
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      
      retryCount++;
      console.log(`Retry attempt ${retryCount} of ${MAX_RETRIES}`);
      
      if (retryCount <= MAX_RETRIES) {
        console.log(`Retrying pattern load...`);
        
        // Retry after a delay
        retryTimeout = setTimeout(() => {
          console.log('Retrying pattern load');
          loadPatterns();
        }, delay);
      }
    };
    
    // Listen for response
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      //console.log('Received API response in editor:', data);
      
      // Only process responses for the patterns request
      if (data && data.responseFor === 'get_available_patterns') {
        if (data.error) {
          console.error('Error loading patterns:', data.error);
          
          // Check if this is a process error that requires a retry
          if (data.error.includes('process') || data.error.includes('restart')) {
            retryLoadPatterns();
            return;
          }
        }
        
        if (data.result && Array.isArray(data.result)) {
          // Clear any retry timeout
          if (retryTimeout) {
            clearTimeout(retryTimeout);
          }
          
          patterns = data.result;
          renderPatternSelector();
          unsubscribe();
        }
      }
    });
    
    // Set a timeout to retry if no response is received
    retryTimeout = setTimeout(() => {
      console.log('No response received for patterns, retrying...');
      retryLoadPatterns(1000);
    }, 5000);
    
  } catch (error) {
    console.error('Error loading patterns:', error);
  }
}

// Load editor settings
async function loadEditorSettings() {
  try {
    // Send request to backend
    window.electronAPI.callAPI('get_editor_settings', {});
    
    // Listen for response
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      // Only process responses for the editor settings request
      if (data && data.responseFor === 'get_editor_settings') {
        if (data.error) {
          console.error('Error loading editor settings:', data.error);
        } else if (data.result) {
          // Update editor settings with defaults for any missing properties
          editorSettings = {
            hideOutroInEditor: false,
            ...data.result
          };
          console.log('Editor settings loaded:', editorSettings);
          // Fix race condition: if a pattern was already loaded before settings arrived, reload it
          if (currentPattern) {
            loadPattern(currentPattern);
          }
        }
        unsubscribe();
      }
    });
    
  } catch (error) {
    console.error('Error loading editor settings:', error);
  }
}

// Save editor settings
function saveEditorSettings() {
  try {
    window.electronAPI.callAPI('save_editor_settings', editorSettings);
  } catch (error) {
    console.error('Error saving editor settings:', error);
  }
}

// Render the pattern selector dropdown
function renderPatternSelector() {
  let html = '';
  patterns.forEach(pattern => {
    html += `<option value="${pattern}">${pattern}</option>`;
  });
  
  patternSelector.innerHTML = html;
  
  // Load the first pattern if available
  if (patterns.length > 0) {
    patternSelector.value = patterns[0];
    loadPattern(patterns[0]);
  }
}

// Load a specific pattern
function loadPattern(patternName) {
  // Preserve active tab when reloading the same pattern (undo/redo, etc.)
  const tabToRestore = (patternName === currentPattern) ? getActiveTab() : 'parts-bank';
  currentPattern = patternName;
  selectedIndex = -1;
  selectedIndices = [];
  multiSelectionMode = false;
  chunkFirstItemIndex = -1; // Reset chunk first item when loading a new pattern

  // Show loading indicator
  patternItems.innerHTML = '<div class="loading-indicator">Loading pattern...</div>';
  
  let retryTimeout;
  let retryCount = 0;
  const MAX_RETRIES = 3;
  
  // Function to retry loading pattern
  const retryLoadPattern = (delay = 3000) => {
    // Clear any existing retry timeout
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
    
    retryCount++;
    console.log(`Retry attempt ${retryCount} of ${MAX_RETRIES}`);
    
    if (retryCount <= MAX_RETRIES) {
      patternItems.innerHTML = `<div class="loading-indicator">Retrying pattern load (${retryCount}/${MAX_RETRIES})...</div>`;
      
      // Retry after a delay
      retryTimeout = setTimeout(() => {
        console.log('Retrying pattern load');
        loadPattern(patternName);
      }, delay);
    } else {
      patternItems.innerHTML = `<div class="loading-indicator error">Failed to load pattern after ${MAX_RETRIES} attempts.</div>`;
      
      // Add a retry button
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Try Again';
      retryButton.className = 'retry-button';
      retryButton.addEventListener('click', () => {
        loadPattern(patternName);
      });
      
      patternItems.appendChild(retryButton);
    }
  };
  
  // Determine which API call to use based on pattern name and editor settings
  const apiMethod = patternName === 'Outro' || editorSettings.hideOutroInEditor ? 'get_pattern' : 'get_pattern_with_outro';
  
  // Send request to backend
  window.electronAPI.callAPI(apiMethod, { pattern_name: patternName });
  
  // Listen for response
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    //console.log('Received pattern data response:', data);
    
    // Only process responses for this pattern request
    if (data && data.responseFor === apiMethod) {
      if (data.error) {
        console.error('Error loading pattern:', data.error);
        
        // Check if this is a process error that requires a retry
        if (data.error.includes('process') || data.error.includes('restart')) {
          retryLoadPattern();
          unsubscribe();
          return;
        }
        
        patternItems.innerHTML = `<div class="loading-indicator error">Error loading pattern: ${data.error}</div>`;
        
        // Add a retry button
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry';
        retryButton.className = 'retry-button';
        retryButton.addEventListener('click', () => {
          loadPattern(patternName);
        });
        
        patternItems.appendChild(retryButton);
        unsubscribe();
        return;
      }
      
      if (data.result && Array.isArray(data.result)) {
        // Clear any retry timeout
        if (retryTimeout) {
          clearTimeout(retryTimeout);
        }
        
        // REMOVED: Filter out duplicate items (by abbr)
        // const seenAbbrs = new Set();
        // currentPatternItems = data.result.filter(item => {
        //   const abbr = item.abbr;
        //   if (seenAbbrs.has(abbr)) {
        //     console.log(`Filtered out duplicate item: ${abbr}`);
        //     return false;
        //   }
        //   seenAbbrs.add(abbr);
        //   return true;
        // }).map(item => ({
        //   ...item
        // }));
        currentPatternItems = data.result.map(item => ({ // Directly map without filtering
            ...item
        }));
        
        // Ensure chapter IDs exist for all items (migrate existing data)
        ensureChapterIDs();
        
        renderPatternItems();
        autoResizeToPattern();
        setActiveTab(tabToRestore);
        loadSacrificedItems(patternName);
        loadAutomaticItems(patternName);
        loadCoverageRequirements(patternName);
        unsubscribe();
      } else {
        patternItems.innerHTML = '<div class="loading-indicator error">Error loading pattern: Invalid data format</div>';
        
        // Add a retry button
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry';
        retryButton.className = 'retry-button';
        retryButton.addEventListener('click', () => {
          loadPattern(patternName);
        });
        
        patternItems.appendChild(retryButton);
        unsubscribe();
      }
    }
  });
  
  // Set a timeout to retry if no response is received
  retryTimeout = setTimeout(() => {
    console.log('No response received for pattern, retrying...');
    retryLoadPattern(1000);
  }, 5000);
}

// Auto-resize the editor window height to snugly fit the current pattern list.
function autoResizeToPattern() {
  const patternEl = document.getElementById('pattern-items');
  const headerEl  = document.querySelector('.editor-header');
  if (!patternEl) return;
  const headerH  = headerEl ? headerEl.getBoundingClientRect().height : 60;
  const itemsH   = patternEl.scrollHeight;  // actual content height regardless of CSS clip
  const padding  = 30;
  const minH     = 400;
  const maxH     = (window.screen?.availHeight || 1080) - 40;
  const targetH  = Math.min(Math.max(minH, Math.ceil(headerH) + itemsH + padding), maxH);
  if (window.electronAPI?.invoke) {
    window.electronAPI.invoke('resize-editor-height', targetH).catch(() => {});
  }
}

// Render the pattern items
function renderPatternItems() {
  if (!currentPatternItems || currentPatternItems.length === 0) {
    patternItems.innerHTML = '<div class="loading-indicator">No items in this pattern</div>';
    return;
  }

  let html = '';
  let currentChapter = ''; // Initialize to empty string instead of null
  let currentChapterID = ''; // Track current chapter ID
  let itemIndexCounter = 0; // Index in the currentPatternItems array
  let renderedItemIndex = 0; // Visual index counter for rendered elements

  while (itemIndexCounter < currentPatternItems.length) {
    const item = currentPatternItems[itemIndexCounter];
    const itemChapter = item.chapter || ''; // Display name
    const itemChapterID = item.chapterID || ''; // Unique identifier

    // --- Chapter Boundary Check ---
    // Use chapterID for boundary detection to ensure unique chapters
    if (itemChapterID !== currentChapterID) {
      // Close previous chapter container if one was open (and it was a named chapter)
      if (currentChapter !== null && currentChapter !== '') {
        html += `</div></div>`; // Close chapter-items and chapter-container
      }
      currentChapter = itemChapter;
      currentChapterID = itemChapterID;
      // Open new chapter container if the new chapter has a name
      if (currentChapter) {
        // Check if this chapter contains any mirror items
        const chapterHasMirrors = currentPatternItems.some(item => 
          (item.chapterID || '') === currentChapterID && item.isMirror
        );
        const chapterMirrorClass = chapterHasMirrors ? 'chapter-has-mirrors' : '';
        const mirrorIcon = chapterHasMirrors ? '🔗 ' : '';
        const chapterContentEditable = chapterHasMirrors ? 'false' : 'true';
        
        html += `
          <div class="chapter-container draggable-item" data-chapter-id="${currentChapterID}" data-chapter-name="${currentChapter}" data-rendered-index="${renderedItemIndex}" data-is-chapter="true">
            <div class="chapter-header">
              <div class="drag-handle" data-handle="true"></div>
              <div class="chapter-label-container">
                <div class="chapter-label ${chapterMirrorClass}" contenteditable="${chapterContentEditable}" data-field="chapter-name" data-chapter-id="${currentChapterID}" data-original-chapter-name="${currentChapter}">${mirrorIcon}${currentChapter}</div>
              </div>
            </div>
            <div class="chapter-items sortable-group"> <!-- Added class for Sortable target -->
        `;
        renderedItemIndex++; // Increment rendered index for the chapter header
      } else {
        // Entering the root level (items outside any chapter)
        // No container needed, previous one closed above.
      }
    }

    // --- Item/Chunk Rendering Logic ---
    const isSelected = selectedIndex === itemIndexCounter || selectedIndices.includes(itemIndexCounter);
    const isInChunk = item.chunkID > 0;
    const isChunkStart = chunkFirstItemIndex === itemIndexCounter;

    if (isInChunk) {
      // Find all items belonging to this chunk *starting from the current index*
      // that also belong to the current chapter section.
      const chunkID = item.chunkID;
      const chunkItemsInOrder = [];
      let tempCounter = itemIndexCounter;
      while (tempCounter < currentPatternItems.length &&
             currentPatternItems[tempCounter].chunkID === chunkID &&
             (currentPatternItems[tempCounter].chapter || '') === currentChapter) {
          chunkItemsInOrder.push(currentPatternItems[tempCounter]);
          tempCounter++;
      }

      if (chunkItemsInOrder.length > 0) {
          const firstChunkItemIndex = currentPatternItems.findIndex(origItem => origItem === chunkItemsInOrder[0]);
          const chunkIndices = chunkItemsInOrder.map(ci => currentPatternItems.findIndex(origItem => origItem === ci));

          html += `
            <div
              class="draggable-item chunk-container ${isSelected ? 'selected' : ''}"
              data-item-index="${firstChunkItemIndex}"
              data-rendered-index="${renderedItemIndex}"
              data-is-chunk="true"
              data-chunk-id="${chunkID}" 
              data-chunk-size="${chunkItemsInOrder.length}"
              data-parent-chapter="${currentChapter || ''}"
              >
              <div class="chunk-header">
                 <div class="drag-handle" data-handle="true"></div>
              </div>
              <div class="chunk-content-wrapper"> 
                <div class="chunk-items">
          `;

          chunkItemsInOrder.forEach((chunkItem, chunkIdx) => {
            const chunkItemActualIndex = chunkIndices[chunkIdx];
            const chunkItemView = chunkItem.view_plane || '';
            const chunkItemWindow = chunkItem.window || '';
            const chunkItemSlice = chunkItem.slice_thickness || '';
            const isOutroItem = chunkItem.isOutroItem || false;
            const outroClass = isOutroItem ? 'outro-item' : '';
            const editableAttr = isOutroItem ? 'false' : 'true';
            const selectDisabled = isOutroItem ? 'disabled' : '';

            html += `
              <div class="chunk-item-part draggable-item ${chunkItem.isMirror ? 'mirror-item' : ''} ${outroClass}" data-chunk-index="${chunkItemActualIndex}" data-item-index="${chunkItemActualIndex}">
                <div class="drag-handle" data-handle="true"></div>
                <div class="item-view">${renderViewSelect(chunkItemView, chunkItemActualIndex, selectDisabled)}</div>
                <div class="item-window">${renderWindowSelect(chunkItemWindow, chunkItemActualIndex, selectDisabled)}</div>
                <div class="item-slice">${renderSliceThicknessSelect(chunkItemSlice, chunkItemActualIndex, selectDisabled)}</div>
                <div class="item-abbr" contenteditable="${editableAttr}" data-field="abbr" data-index="${chunkItemActualIndex}">${chunkItem.abbr || ''}</div>
                ${renderStrategyField(chunkItem.strategy || '', chunkItemActualIndex, editableAttr)}
              </div>
            `;
          });

          html += `
                </div>
              </div>
            </div>
          `;

          itemIndexCounter += chunkItemsInOrder.length;
          renderedItemIndex++; // Increment rendered index for the chunk container
      } else {
          // Should not happen if logic is correct, but prevents infinite loops
          console.warn(`Chunk item rendering issue at index ${itemIndexCounter} for chapter '${currentChapter}'. Skipping.`);
          itemIndexCounter++;
      }
    } else {
      // Regular single item
      const itemView = item.view_plane || '';
      const itemWindow = item.window || '';
      const itemSlice = item.slice_thickness || '';
      const isMirrorItem = item.isMirror || false;
      const isOutroItem = item.isOutroItem || false;
      const mirrorClass = isMirrorItem ? 'mirror-item' : '';
      const outroClass = isOutroItem ? 'outro-item' : '';
      const editableAttr = isOutroItem ? 'false' : 'true';
      const selectDisabled = isOutroItem ? 'disabled' : '';

      html += `
        <div
          class="draggable-item ${isSelected ? 'selected' : ''} ${isChunkStart ? 'chunk-start' : ''} ${mirrorClass} ${outroClass}"
          data-item-index="${itemIndexCounter}"
          data-rendered-index="${renderedItemIndex}"
          data-is-chunk="false"
          data-is-chapter="false" /* Mark as not a chapter container */
          data-parent-chapter="${currentChapter || ''}"
          >
          <div class="item-content">
            <div class="drag-handle" data-handle="true"></div>
            <div class="item-view">${renderViewSelect(itemView, itemIndexCounter, selectDisabled)}</div>
            <div class="item-window">${renderWindowSelect(itemWindow, itemIndexCounter, selectDisabled)}</div>
            <div class="item-slice">${renderSliceThicknessSelect(itemSlice, itemIndexCounter, selectDisabled)}</div>
            <div class="item-abbr" contenteditable="${editableAttr}" data-field="abbr" data-index="${itemIndexCounter}">${item.abbr || ''}</div>
            ${renderStrategyField(item.strategy || '', itemIndexCounter, editableAttr)}
          </div>
        </div>
      `;
      itemIndexCounter++;
      renderedItemIndex++; // Increment rendered index for the single item
    }
  }

  // Close the last chapter container if one was open (and it was a named chapter)
  if (currentChapter !== null && currentChapter !== '') {
    html += `</div></div>`; // Close chapter-items and chapter-container
  }

  patternItems.innerHTML = html;

  // --- Destroy existing Sortable instances before recreating ---
  if (window.mainSortableInstance) {
    window.mainSortableInstance.destroy();
    window.mainSortableInstance = null; // Clear reference
  }
  document.querySelectorAll('.chapter-items.sortable-group').forEach(group => {
    if (group.sortableInstance) {
      group.sortableInstance.destroy();
      group.sortableInstance = null; // Clear reference
    }
  });

  // --- Initialize SortableJS for the main container AND chapter containers ---
  const sortableOptions = {
    group: 'shared-items', // Shared group name
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    preventOnFilter: false, // <--- ADD THIS LINE
    onEnd: handleSortEnd // Use the shared handler (will be implemented next)
  };

  // Main sortable handles chapters and items *outside* chapters
  window.mainSortableInstance = new Sortable(patternItems, {
    ...sortableOptions,
    draggable: '.draggable-item', // Can drag chapters, chunks, and single items at top level
    filter: '.chapter-items, .chunk-items, select', // Prevent dragging *from* inner containers at top level AND from select elements
    // preventOnFilter is inherited from sortableOptions
  });

  // Initialize sortable for each chapter's item container
  document.querySelectorAll('.chapter-items.sortable-group').forEach(group => {
    group.sortableInstance = new Sortable(group, {
      ...sortableOptions, // This will also inherit preventOnFilter: false
      draggable: '.draggable-item:not(.chapter-container)', // Items within the chapter
      filter: 'select', // Add filter for select elements within chapters
      ghostClass: 'sortable-ghost-inner', // Different ghost class
    });
  });

  // Initialize sortable for each chunk's item container
  document.querySelectorAll('.chunk-items').forEach(chunkContainer => {
    chunkContainer.sortableInstance = new Sortable(chunkContainer, {
      ...sortableOptions, // This will also inherit preventOnFilter: false
      draggable: '.chunk-item-part', // Individual chunk items within the chunk
      filter: 'select', // Add filter for select elements within chunks
      ghostClass: 'sortable-ghost-chunk', // Different ghost class for chunks
    });
  });

  // --- Event Listeners (remain as they were after the previous edit) ---
  // Add other event listeners (context menu, edits)
  document.querySelectorAll('.draggable-item').forEach(item => {
    // Right-click context menu only
    item.addEventListener('contextmenu', handleContextMenu);
    // Add click listener for selection (handle single/multi select)
    item.addEventListener('click', (e) => handleItemClick(e, item));

     // Prevent drag handle from triggering item click selection
    const handle = item.querySelector('.drag-handle');
    if (handle) {
        handle.addEventListener('mousedown', (e) => e.stopPropagation());
        handle.addEventListener('touchstart', (e) => e.stopPropagation());
    }
  });

  // Prevent selection and dragging from contenteditable fields
  document.querySelectorAll('[contenteditable]').forEach(editableField => {
    editableField.addEventListener('blur', handleFieldEdit);
    editableField.addEventListener('keydown', handleFieldKeydown); // Added for Enter/Escape
    // Removed mousedown/touchstart from generic contenteditable, will add specifically
  });

  // Strategy chip view: click to enter edit mode
  document.querySelectorAll('.strategy-chips-view').forEach(view => {
    view.addEventListener('click', (e) => {
      if (e.target.closest('.strategy-chip--subpart')) return; // handled by drag
      const wrapper = view.closest('.item-strategy-wrapper');
      if (!wrapper) return;
      const editDiv = wrapper.querySelector('.strategy-text-edit');
      if (!editDiv || editDiv.getAttribute('contenteditable') === 'false') return;
      view.style.display = 'none';
      editDiv.style.display = '';
      editDiv.focus();
      const range = document.createRange();
      range.selectNodeContents(editDiv);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  });

  // Strategy text edit: blur → refresh chip view
  document.querySelectorAll('.strategy-text-edit').forEach(editDiv => {
    editDiv.addEventListener('blur', () => {
      const wrapper = editDiv.closest('.item-strategy-wrapper');
      if (!wrapper) return;
      const view = wrapper.querySelector('.strategy-chips-view');
      if (!view) return;
      const newText = editDiv.textContent.trim();
      const idx = editDiv.dataset.index;
      view.innerHTML = buildChipHtml(newText, idx);
      wireChipDrag(view);
      wireChipDropTarget(view);
      editDiv.style.display = 'none';
      view.style.display = '';
    });
    editDiv.addEventListener('mousedown', (e) => e.stopPropagation());
    editDiv.addEventListener('touchstart', (e) => e.stopPropagation());
  });

  // Wire drag + drop on all chip views
  document.querySelectorAll('.strategy-chips-view').forEach(view => {
    wireChipDrag(view);
    wireChipDropTarget(view);
  });

  // Add listeners for editable chapter names
  document.querySelectorAll('.chapter-label[contenteditable="true"]').forEach(label => {
    //console.log('[renderPatternItems] Attaching listeners to chapter-label:', label);
    label.removeEventListener('blur', handleFieldEdit); // Remove generic field edit
    label.addEventListener('blur', handleHeaderEdit); // Add specific header edit
    if (!label.hasAttribute('listener-keydown-set')) {
        label.addEventListener('keydown', handleFieldKeydown);
        label.setAttribute('listener-keydown-set', 'true');
    }
    label.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    label.addEventListener('touchstart', (e) => { e.stopPropagation(); });
  });

  // Add change listener for the view dropdowns
  document.querySelectorAll('.item-view-select').forEach(selectElement => {
    selectElement.addEventListener('change', handleViewChange);
    selectElement.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    selectElement.addEventListener('touchstart', (e) => { e.stopPropagation(); });
  });

  document.querySelectorAll('.item-window-select').forEach(selectElement => {
    selectElement.addEventListener('change', handleWindowChange);
    selectElement.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    selectElement.addEventListener('touchstart', (e) => { e.stopPropagation(); });
  });

  document.querySelectorAll('.item-slice-select').forEach(selectElement => {
    selectElement.addEventListener('change', handleSliceThicknessChange);
    selectElement.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    selectElement.addEventListener('touchstart', (e) => { e.stopPropagation(); });
  });

   // Setup drop zones AFTER rendering
   setupPatternDropZone(); // Ensure this is called
}

// Handle context menu
function handleContextMenu(e) {
  e.preventDefault();
  e.stopPropagation(); // Prevent event from bubbling to parent draggable items
  const exactTarget = e.target; // The most specific element clicked
  const currentTargetElement = e.currentTarget; // The .draggable-item element the listener is on

  let itemIndexForMenu = -1;
  let chunkIdForMenu = null;
  let chapterNameForMenu = '';
  let isChapterContext = false;
  let isChunkContainerContext = false;
  let isRegularItemContext = false; // This will be true for standalone items OR items within a chunk

  // Reset global context vars at the beginning
  contextMenuTargetIndex = -1;
  contextMenuTargetRenderedIndex = parseInt(currentTargetElement.dataset.renderedIndex); // Visual index of the listened-to element
  contextMenuTargetIsChapter = false;
  contextMenuTargetChapterName = '';
  contextMenuTargetChapterID = '';
  contextMenuTargetSpecificIndex = -1; // Crucial for specific item actions
  contextMenuTargetIsChunkContainer = false;
  contextMenuTargetChunkId = null;

  // 1. Check if the click was on a specific item part inside a chunk
  const clickedChunkItemPart = exactTarget.closest('.chunk-item-part');
  if (clickedChunkItemPart) {
    isRegularItemContext = true;
    contextMenuTargetSpecificIndex = parseInt(clickedChunkItemPart.dataset.chunkIndex);
    const parentChunkContainer = clickedChunkItemPart.closest('.chunk-container');
    if (parentChunkContainer) {
        contextMenuTargetChunkId = parseInt(parentChunkContainer.dataset.chunkId);
        contextMenuTargetChapterName = parentChunkContainer.dataset.parentChapter || '';
        // Get chapter ID from the actual item data
        const item = currentPatternItems[contextMenuTargetSpecificIndex];
        contextMenuTargetChapterID = item ? (item.chapterID || '') : '';
        // targetDataIndex for a regular item within a chunk is its own index
        contextMenuTargetIndex = contextMenuTargetSpecificIndex;
    }
    console.log(`Context menu on ITEM WITHIN CHUNK: SpecificIndex=${contextMenuTargetSpecificIndex}, ChunkID=${contextMenuTargetChunkId}, Chapter='${contextMenuTargetChapterName}', ChapterID='${contextMenuTargetChapterID}'`);
  } else {
    // 2. If not an item within a chunk, evaluate currentTargetElement (the .draggable-item)
    if (currentTargetElement.dataset.isChapter === 'true') {
        isChapterContext = true;
        contextMenuTargetIsChapter = true;
        contextMenuTargetChapterName = currentTargetElement.dataset.chapterName;
        contextMenuTargetChapterID = currentTargetElement.dataset.chapterId || '';
        contextMenuTargetIndex = currentPatternItems.findIndex(item => (item.chapterID || '') === contextMenuTargetChapterID || (item.chapter || '') === contextMenuTargetChapterName);
        console.log(`Context menu on CHAPTER: Name='${contextMenuTargetChapterName}', ID='${contextMenuTargetChapterID}', FirstItemIndex=${contextMenuTargetIndex}`);
    } else if (currentTargetElement.classList.contains('chunk-container')) {
        isChunkContainerContext = true;
        contextMenuTargetIsChunkContainer = true;
        contextMenuTargetIndex = parseInt(currentTargetElement.getAttribute('data-item-index')); // Index of first item in chunk
        contextMenuTargetChunkId = parseInt(currentTargetElement.dataset.chunkId);
        contextMenuTargetChapterName = currentTargetElement.dataset.parentChapter || '';
        // Get chapter ID from the actual item data
        const chunkItem = currentPatternItems[contextMenuTargetIndex];
        contextMenuTargetChapterID = chunkItem ? (chunkItem.chapterID || '') : '';
        console.log(`Context menu on CHUNK CONTAINER: ChunkID=${contextMenuTargetChunkId}, DataIndex=${contextMenuTargetIndex}, Chapter='${contextMenuTargetChapterName}', ChapterID='${contextMenuTargetChapterID}'`);
    } else { // Standalone regular item (not a chapter, not a chunk container)
        isRegularItemContext = true;
        contextMenuTargetIndex = parseInt(currentTargetElement.getAttribute('data-item-index'));
        contextMenuTargetSpecificIndex = contextMenuTargetIndex; // For standalone item, specific is same as target
        contextMenuTargetChapterName = currentTargetElement.dataset.parentChapter || '';
        // Check if this standalone item happens to be part of a chunk (data inconsistency or different rendering path)
        const item = currentPatternItems[contextMenuTargetSpecificIndex];
        if (item) {
            contextMenuTargetChapterID = item.chapterID || '';
            if (item.chunkID > 0) {
                contextMenuTargetChunkId = item.chunkID;
            }
        }
        console.log(`Context menu on STANDALONE ITEM: SpecificIndex=${contextMenuTargetSpecificIndex}, Chapter='${contextMenuTargetChapterName}', ChapterID='${contextMenuTargetChapterID}', ChunkID=${contextMenuTargetChunkId}`);
    }
  }

  // --- Build Context Menu Items ---
  let menuItems = [];
  const itemForActions = (contextMenuTargetSpecificIndex !== -1 && contextMenuTargetSpecificIndex < currentPatternItems.length)
                         ? currentPatternItems[contextMenuTargetSpecificIndex]
                         : ((contextMenuTargetIndex !== -1 && contextMenuTargetIndex < currentPatternItems.length && !isChapterContext) ? currentPatternItems[contextMenuTargetIndex] : null);


  if (isChapterContext) {
      menuItems.push({ text: `Delete Chapter \"${contextMenuTargetChapterName}\" (and contents)`, action: 'delete_chapter', enabled: true });
      menuItems.push({ text: '---', action: 'separator', enabled: false });
      menuItems.push({ text: 'Add New Item to Chapter', action: 'add_item_to_chapter', enabled: true });
      const chapterHasMirrors = currentPatternItems.some(item => (item.chapter || '') === contextMenuTargetChapterName && item.isMirror);
      menuItems.push({ text: 'Convert Mirrored Items to Regular', action: 'convert_mirrors_in_chapter', enabled: chapterHasMirrors });
  } else if (isChunkContainerContext) {
      // Menu for the chunk container itself
      menuItems.push({ text: 'New Chunk Item', action: 'new_chunk_item', enabled: true, chunkId: contextMenuTargetChunkId });
      menuItems.push({ text: 'Assign/Change Chapter', action: 'assign_chapter_for_chunk', enabled: true, chunkId: contextMenuTargetChunkId });
      menuItems.push({ text: 'Create New Chapter Here', action: 'create_chapter_here', enabled: true });
      menuItems.push({ text: 'Disband Chunk', action: 'disband_chunk', enabled: true, chunkId: contextMenuTargetChunkId });
      menuItems.push({ text: 'Delete Chunk + Items', action: 'delete_chunk_and_items', enabled: true, chunkId: contextMenuTargetChunkId });
  } else if (isRegularItemContext && itemForActions) {
      // Menu for a regular item (either standalone or an item clicked within a chunk)
      const specificItem = itemForActions; // itemForActions should point to the correct specific item
      const specificItemInChunk = specificItem?.chunkID > 0;

      menuItems.push({ text: 'Add New Item Here', action: 'add_item_here', enabled: true }); // 'here' means after this specific item
      menuItems.push({ text: 'Delete Item', action: 'delete_item', enabled: true }); // Targets specificIndex
      menuItems.push({ text: 'Duplicate Part', action: 'duplicate_part', enabled: true, itemIndex: contextMenuTargetSpecificIndex }); // Added Duplicate Part
      menuItems.push({ text: 'Move to Sacrificed', action: 'move_to_sacrificed', enabled: !specificItem.isOutroItem });
      menuItems.push({ text: 'Move to Automatic',  action: 'move_to_automatic',  enabled: !specificItem.isOutroItem });

      // Assign/Change Chunk for this specific item
      menuItems.push({ text: 'Assign/Change Chunk', action: 'assign_change_chunk', enabled: true, itemIndex: contextMenuTargetSpecificIndex });

      if (specificItemInChunk) {
          menuItems.push({ text: 'Remove Item from Chunk', action: 'remove_from_chunk', enabled: true }); // Targets specificIndex
      } else { // Only allow chunk creation for non-chunked items
          if (chunkFirstItemIndex >= 0 && chunkFirstItemIndex !== contextMenuTargetSpecificIndex) {
              const firstItem = currentPatternItems[chunkFirstItemIndex];
              const firstItemChapter = firstItem?.chapter || '';
              const canBeLastItem = !specificItemInChunk && (specificItem?.chapter || '') === firstItemChapter;
              let itemsBetweenAreValid = true;
              const start = Math.min(chunkFirstItemIndex, contextMenuTargetSpecificIndex);
              const end = Math.max(chunkFirstItemIndex, contextMenuTargetSpecificIndex);
              for (let i = start; i <= end; i++) {
                  if (!currentPatternItems[i] || currentPatternItems[i].chunkID > 0 || (currentPatternItems[i].chapter || '') !== firstItemChapter) {
                      itemsBetweenAreValid = false;
                      break;
                  }
              }
              menuItems.push({ text: 'Create Chunk: Last Item', action: 'create_chunk_last', enabled: canBeLastItem && itemsBetweenAreValid });
          } else {
              const canBeFirstItem = !specificItemInChunk;
              menuItems.push({ text: 'Create Chunk: First Item', action: 'create_chunk_first', enabled: canBeFirstItem });
          }
      }
      menuItems.push({ text: 'Assign/Change Chapter', action: 'assign_chapter_for_item', enabled: true, itemIndex: contextMenuTargetSpecificIndex });
  }

  // General "Create New Chapter Here" if no specific context menu dominated, or if appropriate for the context
  if (menuItems.length === 0 || isChunkContainerContext || (isRegularItemContext && !itemForActions)) {
    // Add separator if some items were already added (e.g. for chunk container)
    if (menuItems.length > 0 && (isChunkContainerContext || isRegularItemContext)) {
        menuItems.push({ text: '---', action: 'separator', enabled: false });
    }
    menuItems.push({ text: 'Create New Chapter Here', action: 'create_chapter_here', enabled: true });
  } else if (isRegularItemContext && itemForActions && !menuItems.find(mi => mi.action === 'create_chapter_here')) {
    // Add for regular items if not already present from another block
    menuItems.push({ text: '---', action: 'separator', enabled: false });
    menuItems.push({ text: 'Create New Chapter Here', action: 'create_chapter_here', enabled: true });
  }

  // Add mirror content option (always available)
  if (menuItems.length > 0) {
    menuItems.push({ text: '---', action: 'separator', enabled: false });
  }
  menuItems.push({ text: 'Mirror Content...', action: 'mirror_content', enabled: true });
  
  // Add remove mirror option if the target item is a mirror
  if (isRegularItemContext && itemForActions && itemForActions.isMirror) {
    menuItems.push({ text: 'Remove Mirror', action: 'remove_mirror', enabled: true, itemIndex: contextMenuTargetSpecificIndex });
  }


  // Position and show the context menu
  showContextMenu(e.clientX, e.clientY, menuItems);
}

// Show context menu
function showContextMenu(x, y, items) {
  // Generate menu HTML
  let html = '';
  items.forEach(item => {
    let dataAttributes = '';
    if (item.itemIndex !== undefined) {
      dataAttributes += ` data-item-index="${item.itemIndex}"`;
    }
    if (item.chunkId !== undefined) {
      dataAttributes += ` data-chunk-id="${item.chunkId}"`;
    }

    html += `
      <div 
        class="context-menu-item ${item.enabled ? '' : 'disabled'}" 
        data-action="${item.action}" 
        ${dataAttributes}
        ${item.enabled ? '' : 'disabled'}
      >
        ${item.text}
      </div>
    `;
  });
  
  contextMenu.innerHTML = html;
  
  // Position menu
  // First, set initial position to measure dimensions
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.style.display = 'block'; // Make it visible to get dimensions, but off-screen if needed

  const menuWidth = contextMenu.offsetWidth;
  const menuHeight = contextMenu.offsetHeight;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // Adjust y position if menu overflows bottom
  if (y + menuHeight > windowHeight) {
    y = y - menuHeight;
    // Ensure menu doesn't go off the top of the screen
    if (y < 0) {
      y = 0;
    }
  }

  // Adjust x position if menu overflows right
  if (x + menuWidth > windowWidth) {
    x = x - menuWidth;
    // Ensure menu doesn't go off the left of the screen
    if (x < 0) {
      x = 0;
    }
  }
  
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  // Ensure it's still visible after position adjustment
  contextMenu.style.display = 'block';
  
  // Add click event listeners to menu items
  document.querySelectorAll('.context-menu-item').forEach(item => {
    if (!item.classList.contains('disabled')) {
      item.addEventListener('click', handleContextMenuAction);
    }
  });
  
  // Add click event listener to document to close the menu
  document.addEventListener('click', hideContextMenu);
}

// Hide context menu
function hideContextMenu() {
  contextMenu.style.display = 'none';
  document.removeEventListener('click', hideContextMenu);
}

// Handle context menu action
function handleContextMenuAction(e) {
  const action = e.currentTarget.getAttribute('data-action');
  // These are now correctly populated by showContextMenu if the menu item object had them
  const itemIndexFromMenu = e.currentTarget.dataset.itemIndex ? parseInt(e.currentTarget.dataset.itemIndex) : undefined;
  const chunkIdFromMenu = e.currentTarget.dataset.chunkId ? parseInt(e.currentTarget.dataset.chunkId) : undefined;

  // Use globally set context variables from handleContextMenu
  const targetDataIdx = contextMenuTargetIndex; // Index of the draggable-item (chapter start, chunk start, or standalone item)
  const specificItemIdx = contextMenuTargetSpecificIndex; // THE specific item affected, esp. if inside a chunk. This is key.
  const isChapTarget = contextMenuTargetIsChapter;
  const chapName = contextMenuTargetChapterName;
  const isChunkContTarget = contextMenuTargetIsChunkContainer;
  const currentCtxChunkId = contextMenuTargetChunkId; // Chunk ID of the context element (chunk container or item within chunk)

  console.log(`Context Action: ${action}, TargetDataIdx: ${targetDataIdx}, SpecificItemIdx: ${specificItemIdx}, IsChapter: ${isChapTarget}, ChapterName: ${chapName}, IsChunkContainer: ${isChunkContTarget}, CtxChunkId: ${currentCtxChunkId}`);
  console.log(`Menu item data: itemIndexFromMenu=${itemIndexFromMenu}, chunkIdFromMenu=${chunkIdFromMenu}`);


  switch (action) {
    // --- Chunk Actions ---
    case 'create_chunk_first':
       // This action originates from right-clicking an item to be the first. specificItemIdx is that item.
       if (specificItemIdx !== -1) {
            // Remove indicator from previously selected first item
            const existingStart = patternItems.querySelector('.chunk-start');
            if(existingStart) {
                existingStart.classList.remove('chunk-start');
            }

            if (chunkFirstItemIndex === specificItemIdx) {
                // User clicked the same item again, so cancel the operation
                chunkFirstItemIndex = -1;
                console.log("Chunk creation cancelled.");
            } else {
                chunkFirstItemIndex = specificItemIdx;
                console.log(`Item at index ${specificItemIdx} set as the first item for chunk creation.`);

                // Add indicator to the new first item
                const itemElement = patternItems.querySelector(`[data-item-index="${specificItemIdx}"]`);
                if (itemElement) {
                    itemElement.classList.add('chunk-start');
                }
            }
       }
       else console.warn("Create chunk first: specificItemIdx was -1");
      break;
    case 'create_chunk_last':
      // This action originates from right-clicking an item to be the last. specificItemIdx is that item.
      if (specificItemIdx !== -1) {
        if (chunkFirstItemIndex < 0) {
            console.warn("Cannot create chunk: First item not selected.");
            // Make sure to remove any stray 'chunk-start' class
            const existingStart = patternItems.querySelector('.chunk-start');
            if(existingStart) {
                existingStart.classList.remove('chunk-start');
            }
            return;
        }

        const firstItemIndex = chunkFirstItemIndex;
        const lastItemIndex = specificItemIdx;
        const start = Math.min(firstItemIndex, lastItemIndex);
        const end = Math.max(firstItemIndex, lastItemIndex);
        
        // API call expects start_index and count
        const count = end - start + 1;

        console.log(`Requesting chunk creation from index ${start} to ${end} (count: ${count})`);
        
        // Reset chunk selection state BEFORE the async call
        chunkFirstItemIndex = -1;
        
        window.electronAPI.callAPI('create_chunk', {
            pattern_name: currentPattern,
            start_index: start,
            end_index: end
        });

        handleApiResponse('create_chunk', `creating chunk`);
      }
      else console.warn("Create chunk last: specificItemIdx was -1");
      break;
    case 'remove_from_chunk':
      // itemIndexFromMenu should be set correctly by showContextMenu for this item
      if (itemIndexFromMenu !== undefined) removeFromChunk(itemIndexFromMenu);
      else if (specificItemIdx !== -1) removeFromChunk(specificItemIdx); // Fallback to context if menu didn't pass
      else console.warn("Remove from chunk: No valid item index.");
      break;
    case 'disband_chunk':
      const anId = chunkIdFromMenu !== undefined ? chunkIdFromMenu : currentCtxChunkId;
      if (anId > 0) {
           disbandChunkByChunkId(anId);
       } else {
           console.warn("Cannot disband chunk: Invalid chunk ID from menu/context.");
       }
      break;
    case 'new_chunk_item':
        if (chunkIdFromMenu !== undefined) {
            addNewItemToChunk(chunkIdFromMenu);
        } else {
            console.warn("New chunk item action called without chunkId from menu.");
        }
        break;
    case 'delete_chunk_and_items':
        if (chunkIdFromMenu !== undefined) {
            deleteChunkAndItsItems(chunkIdFromMenu);
        } else {
            console.warn("Delete chunk + items action called without chunkId from menu.");
        }
        break;
    case 'assign_change_chunk': // For individual items
        // itemIndexFromMenu should be the specific item's index
        if (itemIndexFromMenu !== undefined) {
            assignItemToChunk(itemIndexFromMenu);
        } else if (specificItemIdx !== -1) { // Fallback, though menu should provide it
            assignItemToChunk(specificItemIdx);
        } else {
            console.warn("Assign/Change Chunk action called without a valid itemIndex.");
        }
        break;


     // --- Sacrificed Actions ---
     case 'move_to_sacrificed':
       {
         const targetIdx = specificItemIdx !== -1 ? specificItemIdx : targetDataIdx;
         if (targetIdx !== -1) moveItemToSacrificed(targetIdx);
       }
       break;

     // --- Automatic Actions ---
     case 'move_to_automatic':
       {
         const targetIdx = specificItemIdx !== -1 ? specificItemIdx : targetDataIdx;
         if (targetIdx !== -1) moveItemToAutomatic(targetIdx);
       }
       break;

     // --- Item Actions ---
     case 'add_item_here':
        // Add item relative to specificItemIdx if available, otherwise targetDataIdx.
        // calculateInsertionIndex should handle if it's after a chunk container, etc.
        const insertAfterIndex = specificItemIdx !== -1 ? specificItemIdx : targetDataIdx;
        const insertAtIndexItem = calculateInsertionIndex(insertAfterIndex, isChapTarget, false, isChunkContTarget, currentCtxChunkId);
       addNewItem(insertAtIndexItem, chapName); // chapName might need to be derived more carefully for items in chunks
       break;
     case 'delete_item':
       // This deletes the specific item right-clicked, identified by specificItemIdx
       if (specificItemIdx !== -1) {
           deleteSingleItem(specificItemIdx);
       } else {
           console.warn("Delete item action called but specificItemIdx is -1.");
       }
       break;

      // --- Chapter Actions ---
      case 'delete_chapter':
           if (isChapTarget && chapName) {
               deleteChapter(chapName);
           } else {
                console.error("Delete chapter: Target was not a chapter or chapter name is missing.");
           }
          break;
       case 'assign_chapter_for_item':
           // itemIndexFromMenu should be the specific item's index
           if (itemIndexFromMenu !== undefined) {
                assignChapterForItem(itemIndexFromMenu);
           } else if (specificItemIdx !== -1) { // Fallback
                assignChapterForItem(specificItemIdx);
           } else {
                console.warn("Assign chapter for item: No valid itemIndex.");
           }
           break;
       case 'assign_chapter_for_chunk':
            if (chunkIdFromMenu !== undefined) {
                assignChapterForChunk(chunkIdFromMenu);
            } else {
                console.warn("Assign chapter for chunk: No chunkId from menu.");
            }
           break;
       case 'create_chapter_here':
            // If context is a chunk container, insert after it. If an item, insert after it.
            const baseIndexForNewChapter = specificItemIdx !== -1 ? specificItemIdx : (isChunkContTarget ? targetDataIdx : currentPatternItems.length);
            console.log(`[create_chapter_here] baseIndexForNewChapter: ${baseIndexForNewChapter}`);
            console.log(`[create_chapter_here] Calling calculateInsertionIndex with: baseIndex=${baseIndexForNewChapter}, isChapTarget=${isChapTarget}, isCreatingChapter=true, isChunkContTarget=${isChunkContTarget}, chunkId=${currentCtxChunkId}`);
            const insertAtIndexChapter = calculateInsertionIndex(baseIndexForNewChapter, isChapTarget, true, isChunkContTarget, currentCtxChunkId);
            console.log(`[create_chapter_here] calculateInsertionIndex returned: ${insertAtIndexChapter}`);
           createNewChapterHere(insertAtIndexChapter);
           break;
       case 'add_item_to_chapter':
             if (isChapTarget && chapName) {
                  const lastItemIdx = findLastIndexOfChapter(chapName, contextMenuTargetChapterID);
                  // If chapter is empty (targetDataIdx is -1), this needs careful handling.
                  // contextMenuTargetIndex (targetDataIdx) is the first item of chapter or -1 if empty.
                  // Add after last item, or if chapter empty, effectively at start of where chapter would be.
                  const insertIdx = lastItemIdx !== -1 ? lastItemIdx + 1 : (targetDataIdx !== -1 ? targetDataIdx : currentPatternItems.length);
                 addNewItemToChapter(insertIdx, chapName, contextMenuTargetChapterID);
             } else {
                console.warn("Add item to chapter: Context was not a chapter or chapter name missing.");
             }
             break;

    case 'convert_mirrors_in_chapter':
        if (isChapTarget && chapName) {
            convertMirrorsInChapter(chapName);
        } else {
            console.error("Convert mirrors: Target was not a chapter or chapter name is missing.");
        }
        break;

    // --- Separator ---
    case 'separator':
        // Do nothing
        break;

    case 'duplicate_part':
      // itemIndexFromMenu should be set by the context menu item for 'duplicate_part'
      // specificItemIdx is also a reliable source for the item to duplicate
      const indexToDuplicate = itemIndexFromMenu !== undefined ? itemIndexFromMenu : specificItemIdx;
      if (indexToDuplicate !== -1 && indexToDuplicate < currentPatternItems.length) {
        console.log(`Requesting duplication of item at index ${indexToDuplicate}`);
        window.electronAPI.callAPI('duplicate_item', {
          pattern_name: currentPattern,
          item_index: indexToDuplicate
        });
        handleApiResponse('duplicate_item', 'duplicating item');
      } else {
        console.warn("Duplicate part action called with invalid index:", indexToDuplicate);
      }
      break;

    case 'mirror_content':
      openMirrorContentDialog();
      break;

    case 'remove_mirror':
      const mirrorItemIndex = itemIndexFromMenu !== undefined ? itemIndexFromMenu : specificItemIdx;
      if (mirrorItemIndex !== undefined && mirrorItemIndex >= 0) {
        if (confirm('Remove this mirror item? This will not affect the original content.')) {
          removeMirrorItem(mirrorItemIndex);
        }
      }
      break;

     default:
       console.warn("Unhandled context menu action:", action);
  }

  // Reset context menu state variables
    contextMenuTargetIndex = -1;
    contextMenuTargetRenderedIndex = -1;
    contextMenuTargetIsChapter = false;
    contextMenuTargetChapterName = '';
    contextMenuTargetSpecificIndex = -1;
    contextMenuTargetIsChunkContainer = false;
    contextMenuTargetChunkId = null;


  hideContextMenu();
}

// --- Helper Functions for Context Menu Actions ---

// Calculate insertion index based on context menu target
function calculateInsertionIndex(targetDataIdx, isChapter, isCreatingChapter, isChunkContainer = false, chunkId = null) {
    if (isChapter) {
        // Clicked on a chapter header
        if (targetDataIdx !== -1) {
            return targetDataIdx; // Before first item of this chapter
        } else {
            console.warn("Insertion index for empty/new chapter. Defaulting to end.");
            return currentPatternItems.length;
        }
    } else if (isChunkContainer) {
        // Clicked on a chunk container, insert *after* the entire chunk
        if (chunkId !== null) {
            let lastIndexOfChunk = -1;
            for (let i = currentPatternItems.length - 1; i >= 0; i--) {
                if (currentPatternItems[i].chunkID === chunkId) {
                    lastIndexOfChunk = i;
                    break;
                }
            }
            return lastIndexOfChunk !== -1 ? lastIndexOfChunk + 1 : currentPatternItems.length;
        } else {
             console.warn("Cannot calculate insertion index: Invalid chunkId for chunk container.");
             return currentPatternItems.length;
        }
    } else {
         // Clicked on an item (single or part of chunk)
         if (targetDataIdx !== -1) {
              const item = currentPatternItems[targetDataIdx];
              // If it's an item within a chunk (but not the container itself), insert after it.
              // If it's a standalone item, insert after it.
              return targetDataIdx + 1;
         } else {
             console.warn("Cannot calculate insertion index: Invalid targetDataIdx for item.");
              return currentPatternItems.length;
         }
    }
}

// Find last index of an item belonging to a specific chapter
function findLastIndexOfChapter(chapterName, chapterID = null) {
    // If chapter ID is provided, use it for more accurate matching
    if (chapterID) {
        for (let i = currentPatternItems.length - 1; i >= 0; i--) {
            if ((currentPatternItems[i].chapterID || '') === chapterID) {
                return i;
            }
        }
    } else {
        // Fallback to chapter name for backward compatibility
        for (let i = currentPatternItems.length - 1; i >= 0; i--) {
            if ((currentPatternItems[i].chapter || '') === chapterName) {
                return i;
            }
        }
    }
    return -1; // Not found
}


// Disband chunk by chunk ID (new helper)
function disbandChunkByChunkId(chunkId) {
    if (!chunkId || chunkId <= 0) {
         console.warn("Cannot disband chunk: Invalid chunkId", chunkId);
         return;
     }
     if (confirm(`Are you sure you want to disband chunk ${chunkId}? Items will become individual.`)) {
        console.log(`Requesting disbanding of chunk ${chunkId}`);
        window.electronAPI.callAPI('disband_chunk', {
            pattern_name: currentPattern,
            chunk_id: chunkId
        });
        handleApiResponse('disband_chunk', `disbanding chunk ${chunkId}`);
    }
}


// === ADDED: Dialog Functions ===
// --- New Dialog Functions ---
function showChapterInputDialog(context) {
    console.log("[showChapterInputDialog] Entered. Context received:", JSON.stringify(context));
    if (context && context.action === 'create_chapter') {
        console.log("[showChapterInputDialog] For 'create_chapter', context.insertionIndex is:", context.insertionIndex);
    }
    chapterDialogContext = context; // Store context

    // Customize dialog based on action
    switch (context.action) {
        case 'assign_chapter_item': // Renamed for clarity
             if (context.itemIndex === undefined || context.itemIndex < 0 || context.itemIndex >= currentPatternItems.length) {
                  console.error("Invalid itemIndex in context for assign chapter:", context);
                  alert("Error: Cannot determine item for chapter assignment.");
                  return;
             }
             const item = currentPatternItems[context.itemIndex];
             const currentItemChapter = item?.chapter || '';
             chapterDialogTitle.textContent = `Set Chapter for Item \"${item.abbr}\"`;
             chapterInputName.value = currentItemChapter; // This will become a select
             chapterInputName.placeholder = "Select Chapter (or type new, or blank for none)";
             populateChapterSelect(chapterInputName, currentItemChapter, true); // true for allow 'none'
             break;
        case 'assign_chapter_chunk':
            if (context.chunkId === undefined) {
                console.error("Invalid chunkId in context for assign chapter to chunk:", context);
                alert("Error: Cannot determine chunk for chapter assignment.");
                return;
            }
            const firstChunkItem = currentPatternItems.find(it => it.chunkID === context.chunkId);
            const currentChunkChapter = firstChunkItem?.chapter || '';
            chapterDialogTitle.textContent = `Set Chapter for Chunk ${context.chunkId}`;
            chapterInputName.value = currentChunkChapter; // This will become a select
            chapterInputName.placeholder = "Select Chapter (or type new, or blank for none)";
            populateChapterSelect(chapterInputName, currentChunkChapter, true); // true for allow 'none'
            break;
         case 'create_chapter': // Renamed from 'create'
              chapterDialogTitle.textContent = 'Enter Name for New Chapter';
              chapterInputName.value = '';
              chapterInputName.placeholder = "New Chapter Name (leave blank for no name)"; // MODIFIED PLACEHOLDER
              clearSelectAndMakeInput(chapterInputName); // Ensure it's an input field
             break;
        case 'rename_chunk':
            chapterDialogTitle.textContent = `Rename Chunk ${context.chunkId}`;
            // For renaming a chunk, we might want to allow changing its ID if that's how chunks are named.
            // Or, if chunks have separate names, this would be `chunk.name`.
            // Assuming chunk "name" is its ID for now. This usually means changing all chunkIDs.
            // This is a complex operation if "renaming" means changing the chunkID.
            // For now, let's assume chunks don't have separate names other than their ID.
            // So, this action might be more about "Re-number chunk" or similar.
            // Or, if a chunk could have a display name property, we'd edit that.
            // Let's assume for now "Rename Chunk" isn't about changing ID, but a conceptual name if it existed.
            // Since it doesn't, this might be a NO-OP or prompt for a new ID (more complex).
            // Placeholder for now:
            alert("Renaming chunk (conceptual name) is not yet fully implemented if different from ID.");
            hideChapterInputDialog(); // Hide as it's not ready
            return;
            // chapterInputName.value = context.chunkId; // Or current name if chunks had names
            // chapterInputName.placeholder = "Enter new chunk name/ID";
            // clearSelectAndMakeInput(chapterInputName);
            break;
         default:
              chapterDialogTitle.textContent = 'Enter Value';
              chapterInputName.value = '';
              chapterInputName.placeholder = "Value";
              clearSelectAndMakeInput(chapterInputName);
    }

    chapterInputDialog.style.display = 'flex';
    if (chapterInputName.tagName.toLowerCase() === 'input') {
        chapterInputName.focus();
        chapterInputName.select();
    } else if (chapterInputName.tagName.toLowerCase() === 'select') {
        chapterInputName.focus();
    }

    //console.log('Attaching listeners in showChapterInputDialog');
    if (chapterDialogOkBtn) {
        chapterDialogOkBtn.removeEventListener('click', handleChapterDialogOk);
        chapterDialogOkBtn.addEventListener('click', handleChapterDialogOk);
    }
    if (chapterDialogCancelBtn) {
        chapterDialogCancelBtn.removeEventListener('click', hideChapterInputDialog);
        chapterDialogCancelBtn.addEventListener('click', hideChapterInputDialog);
    }
}

function populateChapterSelect(selectElementOrId, currentValue, allowNone = false) {
    let select = (typeof selectElementOrId === 'string') ? document.getElementById(selectElementOrId) : selectElementOrId;
    if (!select) return;

    // Convert to select if it's an input
    if (select.tagName.toLowerCase() === 'input') {
        const newSelect = document.createElement('select');
        newSelect.id = select.id;
        newSelect.className = select.className; // Copy classes
        select.parentNode.replaceChild(newSelect, select);
        // Update chapterInputName to new select element for future references in this scope
        if (window.chapterInputName && window.chapterInputName.id === newSelect.id) { // Assuming chapterInputName is global or accessible
            window.chapterInputName = newSelect;
        }
         // Update the module-scoped chapterInputName to refer to the newSelect element directly
        if (select.id === 'chapter-input-name') { // select.id here is the id of the original input
            chapterInputName = newSelect;
        }

        select = newSelect; // Now this assignment is valid
    }

    const existingChapters = ['', ...new Set(currentPatternItems.map(item => item.chapter || '').filter(ch => ch))]; // Include "None" (empty string) and unique chapter names
    select.innerHTML = ''; // Clear existing options

    if (allowNone) {
        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = '(None)';
        select.appendChild(noneOption);
    }

    existingChapters.filter(ch => ch).forEach(chapter => { // Filter out the initial empty string if not allowing "None" explicitly via other means
        if (chapter) { // Only add non-empty chapters
            const option = document.createElement('option');
            option.value = chapter;
            option.textContent = chapter;
            select.appendChild(option);
        }
    });
    select.value = currentValue;
}

function clearSelectAndMakeInput(element) {
    if (element.tagName.toLowerCase() === 'select') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = element.id;
        input.className = element.className;
        input.placeholder = element.placeholder || "Enter value";
        element.parentNode.replaceChild(input, element);
        // Update chapterInputName to new input element if it was the global one
        if (window.chapterInputName && window.chapterInputName.id === input.id) {
             window.chapterInputName = input;
        }
         // Re-query if it was the global one
        if (element.id === 'chapter-input-name') chapterInputName = document.getElementById('chapter-input-name');
    }
}


function handleChapterDialogOk() {
    console.log('[handleChapterDialogOk] Entered. Current chapterDialogContext:', JSON.stringify(chapterDialogContext));
    if (chapterDialogContext && chapterDialogContext.action === 'create_chapter') {
        console.log('[handleChapterDialogOk] For "create_chapter", chapterDialogContext.insertionIndex is:', chapterDialogContext.insertionIndex);
    }

    const inputElement = chapterInputName; // chapterInputName can now be <input> or <select>
    const newNameRaw = inputElement.value;
    const newName = newNameRaw.trim();

    if (!chapterDialogContext) {
        console.error("Chapter dialog OK clicked but no context found.");
        hideChapterInputDialog();
        return;
    }

    const context = chapterDialogContext;
    console.log(`Chapter Dialog OK - Action: ${context.action}, Input: '${newNameRaw}' (Trimmed: '${newName}')`);

    try {
        switch (context.action) {

            case 'assign_chapter_item':
                 if (context.itemIndex === undefined || context.itemIndex < 0 || context.itemIndex >= currentPatternItems.length) {
                      console.error("Invalid itemIndex in context during OK handling:", context);
                      alert("Error: Cannot determine item for chapter assignment.");
                      break;
                 }
                const itemToAssign = currentPatternItems[context.itemIndex];
                const currentItemChapter = itemToAssign?.chapter || '';
                const itemIsChunk = itemToAssign?.chunkID > 0; // Check if the item itself is part of a chunk
                const itemIdToUpdate = itemToAssign?.id; // Assuming items have a unique 'id' if needed for more precise update

                if (newName !== currentItemChapter) {
                     console.log(`Calling API: update_item_chapter pattern='${currentPattern}', item_index=${context.itemIndex}, new_chapter='${newName}', is_chunk=${itemIsChunk}, chunk_id=${itemToAssign?.chunkID || 0}`);
                     window.electronAPI.callAPI('update_item_chapter', {
                         pattern_name: currentPattern,
                         item_index: context.itemIndex, // API needs the actual index in the array
                         new_chapter: newName,
                         is_chunk: itemIsChunk, // If the item is part of a chunk, the API needs to know to update all items in that chunk
                         chunk_id: itemToAssign?.chunkID || 0 // Pass the chunk_id if the item is part of a chunk
                     });
                     handleApiResponse('update_item_chapter', `assigning chapter to item`);
                } else {
                     console.log("No change in chapter assignment for item.");
                 }
                break;
            case 'assign_chapter_chunk':
                if (context.chunkId === undefined) {
                    console.error("Invalid chunkId in context during OK handling for assign_chapter_chunk:", context);
                    alert("Error: Cannot determine chunk for chapter assignment.");
                    break;
                }
                // Find the first item of the chunk to get its current chapter
                const firstChunkItemToAssign = currentPatternItems.find(it => it.chunkID === context.chunkId); // Renamed variable
                const currentChunkChapterToAssign = firstChunkItemToAssign?.chapter || ''; // Renamed variable
              const firstChunkItemIndex = currentPatternItems.findIndex(it => it.chunkID === context.chunkId);

                if (newName !== currentChunkChapterToAssign) {
                if (firstChunkItemIndex < 0) {
                  console.error(`Could not find a valid index for chunk ${context.chunkId}`);
                  alert(`Chunk ${context.chunkId} not found.`);
                  break;
                }
                console.log(`Calling API: update_item_chapter pattern='${currentPattern}', item_index=${firstChunkItemIndex}, new_chapter='${newName}', is_chunk=true, chunk_id=${context.chunkId}`);
                window.electronAPI.callAPI('update_item_chapter', {
                  pattern_name: currentPattern,
                  item_index: firstChunkItemIndex,
                  new_chapter: newName,
                  is_chunk: true,
                  chunk_id: context.chunkId
                });
                handleApiResponse('update_item_chapter', `assigning chapter to chunk`);
                } else {
                    console.log("No change in chapter assignment for chunk.");
                }
                break;
            case 'create_chapter':
                if (context.insertionIndex === undefined) { // Use the stored insertion index
                    console.error("Insertion index not found in context for create_chapter");
                    alert("Error: Cannot determine where to create the chapter.");
                    break;
                }

                // Check if chapter already exists (only if a name is provided)
                if (newName && currentPatternItems.some(item => item.chapter === newName)) {
                    alert(`Chapter \"${newName}\" already exists.`);
                    return; // Prevent creating duplicate chapter names
                }

                // Find the item that was right-clicked to create the chapter
                // The insertionIndex should correspond to the item that was right-clicked
                let targetItemIndex = context.insertionIndex;
                
                // If insertionIndex is at the end or beyond, use the last item
                if (targetItemIndex >= currentPatternItems.length) {
                    targetItemIndex = currentPatternItems.length - 1;
                }
                
                // If we have a valid item, assign it to the new chapter
                if (targetItemIndex >= 0 && targetItemIndex < currentPatternItems.length) {
                    console.log(`Calling API: update_item_chapter pattern='${currentPattern}', item_index=${targetItemIndex}, new_chapter='${newName}'`);
                    window.electronAPI.callAPI('update_item_chapter', {
                        pattern_name: currentPattern,
                        item_index: targetItemIndex,
                        new_chapter: newName,
                        is_chunk: false,
                        chunk_id: 0
                    });
                    handleApiResponse('update_item_chapter', 'creating new chapter by assigning item');
                } else {
                    alert("Error: Cannot find the item to assign to the new chapter.");
                }
                break;

             default:
                 console.error("Unknown chapter dialog action:", context.action);
        }
    } catch (error) {
         console.error("Error handling chapter dialog OK:", error);
         alert("An unexpected error occurred. Please check the console.");
         // Still hide dialog even on unexpected error
          hideChapterInputDialog();
          return; // Stop processing
    }

    // Hide dialog only if processing reached here without returning early
    hideChapterInputDialog();
}

function hideChapterInputDialog() {
    console.log('hideChapterInputDialog called'); // Added for debugging
    chapterInputDialog.style.display = 'none';
    chapterDialogContext = null; // Clear context
    chapterInputName.value = ''; // Clear input
}

// --- Implement Chapter Management Functions ---

function addNewItem(insertAtIndex, chapter = '') {
    console.log(`Action: Add New Item at index ${insertAtIndex}, Chapter: '${chapter}'`);
    const newItem = {
        abbr: `New Item ${Date.now() % 1000}`,
        full_name: "", strategy: "", window_level: "", best_seen_on: "",
        groupID: 0, // groupID might need logic if you group new items
        chunkID: 0, // New items are not in chunks initially
        view_plane: "",
        window: "",
        slice_thickness: "",
        chapter: chapter // Assign chapter context
    };

    // Ensure index is within bounds
    insertAtIndex = Math.max(0, Math.min(insertAtIndex, currentPatternItems.length));

    window.electronAPI.callAPI('add_item', {
        pattern_name: currentPattern,
        item_data: newItem,
        index: insertAtIndex
    });
    handleApiResponse('add_item', `adding new item to chapter '${chapter}'`);
}

function addNewItemToChapter(insertAtIndex, chapterName, chapterID) {
    console.log(`Action: Add New Item to Chapter: Name='${chapterName}', ID='${chapterID}', at index ${insertAtIndex}`);
    
    // Ensure chapter ID exists, generate one if missing
    let targetChapterID = chapterID;
    if (!targetChapterID && chapterName) {
        targetChapterID = generateChapterID();
        console.log(`Generated new chapter ID: ${targetChapterID} for chapter: ${chapterName}`);
    }
    
    const newItem = {
        abbr: `New Item ${Date.now() % 1000}`,
        full_name: "", 
        strategy: "", 
        window_level: "", 
        best_seen_on: "",
        groupID: 0,
        chunkID: 0, // New items are not in chunks initially
        view_plane: "",
        window: "",
        slice_thickness: "",
        chapter: chapterName,
        chapterID: targetChapterID
    };

    // Ensure index is within bounds
    insertAtIndex = Math.max(0, Math.min(insertAtIndex, currentPatternItems.length));

    window.electronAPI.callAPI('add_item', {
        pattern_name: currentPattern,
        item_data: newItem,
        index: insertAtIndex
    });
    handleApiResponse('add_item', `adding new item to chapter '${chapterName}' (ID: ${targetChapterID})`);
}

// Delete a single item. Chunks have their own delete mechanism.
function deleteSingleItem(itemIndex) {
    console.log("Action: Delete Single Item at index", itemIndex);
    if (itemIndex < 0 || itemIndex >= currentPatternItems.length) return;

    const itemToDelete = currentPatternItems[itemIndex];
    if (itemToDelete.chunkID > 0) {
        if (!confirm(`This item is part of chunk ${itemToDelete.chunkID}. Are you sure you want to delete only this item from the chunk? The chunk itself will remain.`)){
            return;
        }
    } else {
        if (!confirm(`Are you sure you want to delete this item: "${itemToDelete.abbr}"?`)) {
            return;
        }
    }

    console.log(`Calling API: delete_item pattern='${currentPattern}', index=${itemIndex}, count=1`);
    window.electronAPI.callAPI('delete_item', {
        pattern_name: currentPattern,
        index: itemIndex,
        count: 1 // Always 1 for single item deletion
    });
    handleApiResponse('delete_item', `deleting single item`);
}

// This function is now primarily for deleting chunks via context menu on chunk container.
// Single item deletion is handled by deleteSingleItem.
function deleteItemOrChunk(itemIndex) {
    // This function is now less used directly by context menu for "delete item"
    // It's kept for potential other uses or if a chunk context implies deleting the whole chunk.
    // The new 'delete_chunk_and_items' handles chunk deletion more explicitly.
    console.log("Action: Delete Item/Chunk starting at index", itemIndex);
    if (itemIndex < 0 || itemIndex >= currentPatternItems.length) return;

    const itemToDelete = currentPatternItems[itemIndex];
    const isChunk = itemToDelete.chunkID > 0;

    if (isChunk) { // This path should ideally be taken by delete_chunk_and_items
        const chunkId = itemToDelete.chunkID;
        deleteChunkAndItsItems(chunkId); // Delegate to specific chunk deletion
    } else { // Single item
        deleteSingleItem(itemIndex); // Delegate to specific single item deletion
    }
}

function setChunkFirstItem(index) {
    // Remove indicator from previously selected first item
    const existingStart = patternItems.querySelector('.chunk-start');
    if(existingStart) {
        existingStart.classList.remove('chunk-start');
    }

    if (chunkFirstItemIndex === index) {
        // User clicked the same item again, so cancel the operation
        chunkFirstItemIndex = -1;
        console.log("Chunk creation cancelled.");
    } else {
        chunkFirstItemIndex = index;
        console.log(`Item at index ${index} set as the first item for chunk creation.`);

        // Add indicator to the new first item
        const itemElement = patternItems.querySelector(`[data-item-index="${index}"]`);
        if (itemElement) {
            itemElement.classList.add('chunk-start');
        }
    }
}

function createChunkWithRange(lastItemIndex) {
    if (chunkFirstItemIndex < 0) {
        console.warn("Cannot create chunk: First item not selected.");
        // Make sure to remove any stray 'chunk-start' class
        const existingStart = patternItems.querySelector('.chunk-start');
        if(existingStart) {
            existingStart.classList.remove('chunk-start');
        }
        return;
    }

    const firstItemIndex = chunkFirstItemIndex;
    const start = Math.min(firstItemIndex, lastItemIndex);
    const end = Math.max(firstItemIndex, lastItemIndex);
    
    // API call expects start_index and count
    const count = end - start + 1;

    console.log(`Requesting chunk creation from index ${start} to ${end} (count: ${count})`);
    
    // Reset chunk selection state BEFORE the async call
    chunkFirstItemIndex = -1;
    
    window.electronAPI.callAPI('create_chunk', {
        pattern_name: currentPattern,
        start_index: start,
        end_index: end
    });

    handleApiResponse('create_chunk', `creating chunk`);
}


function deleteChapter(chapterName) {
    console.log("Action: Delete Chapter", chapterName);
     if (confirm(`Are you sure you want to delete the chapter "${chapterName}" and all items within it?`)) {
          console.log(`Calling API: delete_chapter pattern='${currentPattern}', chapter_name='${chapterName}'`);
         window.electronAPI.callAPI('delete_chapter', {
             pattern_name: currentPattern,
             chapter_name: chapterName
         });
         handleApiResponse('delete_chapter', `deleting chapter`);
     }
}

function assignChapterForItem(itemIndex) {
    console.log("Action: Assign Chapter for item at index", itemIndex);
    if (itemIndex < 0 || itemIndex >= currentPatternItems.length) return;
    showChapterInputDialog({ action: 'assign_chapter_item', itemIndex: itemIndex });
}

function assignChapterForChunk(chunkId) {
    console.log("Action: Assign Chapter for chunk ID", chunkId);
    if (!chunkId || chunkId <=0) return;
    const firstItemOfChunk = currentPatternItems.find(item => item.chunkID === chunkId);
    if (!firstItemOfChunk) {
        alert(`Chunk ${chunkId} not found.`);
        return;
    }
    showChapterInputDialog({ action: 'assign_chapter_chunk', chunkId: chunkId });
}


function createNewChapterHere(insertAtIndex) {
    console.log("Action: Create New Chapter near index", insertAtIndex);
    showChapterInputDialog({ action: 'create_chapter', insertionIndex: insertAtIndex });
}

// --- New/Modified Chunk Specific Functions ---
function addNewItemToChunk(chunkId) {
    console.log(`Action: Add New Item to Chunk ID ${chunkId}`);
    if (!chunkId || chunkId <= 0) {
        console.warn("Cannot add item to chunk: Invalid chunkId");
        return;
    }

    // Find the last item of the chunk to insert after it
    let lastItemIndexOfChunk = -1;
    for (let i = currentPatternItems.length - 1; i >= 0; i--) {
        if (currentPatternItems[i].chunkID === chunkId) {
            lastItemIndexOfChunk = i;
            break;
        }
    }

    if (lastItemIndexOfChunk === -1) {
        alert(`Chunk ${chunkId} not found. Cannot add item.`);
        return;
    }

    const firstItemOfChunk = currentPatternItems.find(item => item.chunkID === chunkId);
    const chapterOfChunk = firstItemOfChunk ? (firstItemOfChunk.chapter || '') : '';


    const newItem = {
        abbr: `New Item in Chunk ${Date.now() % 1000}`,
        full_name: "", strategy: "", window_level: "", best_seen_on: "",
        groupID: firstItemOfChunk ? firstItemOfChunk.groupID : 0, // Inherit groupID from chunk
        chunkID: chunkId, // Assign to the target chunk
        view_plane: "",
        window: "",
        slice_thickness: "",
        chapter: chapterOfChunk // Inherit chapter from chunk
    };

    const insertAtIndex = lastItemIndexOfChunk + 1;

    console.log(`Calling API: add_item (to chunk) pattern='${currentPattern}', item_data (for chunk ${chunkId}), index=${insertAtIndex}`);
    window.electronAPI.callAPI('add_item', {
        pattern_name: currentPattern,
        item_data: newItem, // API needs to handle assigning this to the chunk
        index: insertAtIndex
    });
    handleApiResponse('add_item', `adding new item to chunk ${chunkId}`);
}

function deleteChunkAndItsItems(chunkId) {
    console.log(`Action: Delete Chunk ID ${chunkId} and all its items`);
    if (!chunkId || chunkId <= 0) {
        console.warn("Cannot delete chunk: Invalid chunkId");
        return;
    }

    if (confirm(`Are you sure you want to delete chunk ${chunkId} and all items within it?`)) {
        console.log(`Calling API: delete_chunk pattern='${currentPattern}', chunk_id=${chunkId}`);
        window.electronAPI.callAPI('delete_chunk', { // Assuming an API endpoint like this
            pattern_name: currentPattern,
            chunk_id: chunkId
        });
        handleApiResponse('delete_chunk', `deleting chunk ${chunkId} and its items`);
    }
}

function assignItemToChunk(itemIndex) {
    console.log(`Action: Assign/Change Chunk for item at index ${itemIndex}`);
    if (itemIndex < 0 || itemIndex >= currentPatternItems.length) {
        alert("Error: Invalid item index for chunk assignment.");
        return;
    }

    const item = currentPatternItems[itemIndex];
    const currentChunkId = item.chunkID || 0;
    
    // Gather detailed chunk information: ID and concatenated abbreviations
    const chunkDetails = {}; // Store { chunkId: { id: chunkId, abbrs: ['abbr1', 'abbr2'] } }
    currentPatternItems.forEach(it => {
        if (it.chunkID && it.chunkID > 0) {
            if (!chunkDetails[it.chunkID]) {
                chunkDetails[it.chunkID] = { id: it.chunkID, abbrs: [] };
            }
            if (it.abbr) { // Only add if abbr exists
                chunkDetails[it.chunkID].abbrs.push(it.abbr);
            }
        }
    });

    const existingChunksForDialog = Object.values(chunkDetails).map(chunk => ({
        id: chunk.id,
        displayText: chunk.abbrs.length > 0 ? `${chunk.abbrs.join(', ')}` : `Chunk ${chunk.id} (empty)`
    })).sort((a, b) => a.id - b.id);
    
    chunkAssignmentContext = { itemIndex, itemName: item.abbr, currentChunkId }; // Store context

    showChunkAssignmentDialog(item.abbr, currentChunkId, existingChunksForDialog);
}


// --- Chunk Assignment Dialog Functions ---
function showChunkAssignmentDialog(itemName, currentChunkId, existingChunks) { // existingChunks is now an array of objects {id, displayText}
    if (!chunkAssignmentDialog) {
        console.error("Chunk assignment dialog element not found!");
        return;
    }

    chunkAssignItemName.textContent = itemName;

    chunkAssignSelect.innerHTML = ''; // Clear previous options
    const noneOption = document.createElement('option');
    noneOption.value = '0'; // Value for "None"
    noneOption.textContent = '(None) - Remove from chunk';
    chunkAssignSelect.appendChild(noneOption);

    existingChunks.forEach(chunk => {
        const option = document.createElement('option');
        option.value = chunk.id;
        option.textContent = chunk.displayText; // Use the generated display text
        chunkAssignSelect.appendChild(option);
    });

    // Set select to current chunk or '0' if not in a chunk
    chunkAssignSelect.value = currentChunkId === 0 ? '0' : currentChunkId.toString();

    chunkAssignmentDialog.style.display = 'flex';
    chunkAssignSelect.focus();

    // Ensure event listeners are attached (and not duplicated)
    chunkAssignDialogOkBtn.removeEventListener('click', handleChunkAssignmentDialogOk);
    chunkAssignDialogOkBtn.addEventListener('click', handleChunkAssignmentDialogOk);
    chunkAssignDialogCancelBtn.removeEventListener('click', hideChunkAssignmentDialog);
    chunkAssignDialogCancelBtn.addEventListener('click', hideChunkAssignmentDialog);
}

function hideChunkAssignmentDialog() {
    if (chunkAssignmentDialog) {
        chunkAssignmentDialog.style.display = 'none';
    }
    chunkAssignmentContext = null; // Clear context
}

function handleChunkAssignmentDialogOk() {
    if (!chunkAssignmentContext) {
        console.error("Chunk assignment OK clicked but no context found.");
        hideChunkAssignmentDialog();
        return;
    }

    const { itemIndex, currentChunkId } = chunkAssignmentContext; // currentChunkId from context is still useful for comparison
    let chosenChunkId = parseInt(chunkAssignSelect.value);

    if (isNaN(chosenChunkId) || chosenChunkId < 0) {
        alert("Invalid Chunk ID selected. Must be a non-negative number (0 for None).");
        return;
    }

    // The comparison to currentChunkId might still be useful to prevent redundant API calls
    // if the user selects the same chunk the item is already in.
    if (chosenChunkId === currentChunkId) {
        // alert("Item is already in this chunk state. No changes made."); // Optional: User might want to click OK even if no change
        console.log("Item is already in this chunk state. No API call needed.")
        hideChunkAssignmentDialog();
        return;
    }
    
    console.log(`Calling API: update_chunk pattern='${currentPattern}', item_index=${itemIndex}, new_chunk_id=${chosenChunkId}`);
    window.electronAPI.callAPI('update_chunk', {
        pattern_name: currentPattern,
        item_index: itemIndex,
        new_chunk_id: chosenChunkId
    });
    handleApiResponse('update_chunk', `assigning item to chunk ${chosenChunkId}`);
    hideChunkAssignmentDialog();
}

// Modify the existing remove_from_chunk to call the API
function removeFromChunk(itemIndex) {
  if (itemIndex >= 0 && currentPatternItems[itemIndex]?.chunkID > 0) {
    const item = currentPatternItems[itemIndex];
    const chunkId = item.chunkID;
    console.log(`Requesting removal of item at index ${itemIndex} from chunk ${chunkId}`);

    // Call API to handle removal - Let's assume update_chunk handles this
    window.electronAPI.callAPI('update_chunk', { // Or maybe remove_from_chunk if defined? Let's assume update_chunk
        pattern_name: currentPattern,
        item_index: itemIndex, // Index of item to remove
        new_chunk_id: 0 // Signal removal by setting chunkID to 0
        // chunk_id: chunkId // Optionally pass the chunk ID for backend validation
    });

     handleApiResponse('update_chunk', `removing item from chunk ${chunkId}`);
  } else {
       console.warn(`Cannot remove item from chunk: Invalid index (${itemIndex}) or item not in a chunk.`);
   }
}

// (Make sure handleApiResponse is defined correctly)
// Helper for handling API responses and reloading (if not already present and correct)
function handleApiResponse(apiMethod, actionDescription, params = {}) {
    console.log(`[handleApiResponse] Listening for ${apiMethod} (Action: ${actionDescription})`);
    let unsubscribeHandler = null; // To store the unsubscribe function

    const handleResponse = (data) => {
        console.log(`[handleApiResponse] Received response for ${data.responseFor}:`, data);
        if (data && data.responseFor === apiMethod) {
            if (unsubscribeHandler) {
                unsubscribeHandler(); // Call the unsubscribe function obtained from onAPIResponse
                unsubscribeHandler = null;
            } else {
                console.warn("[handleApiResponse] Unsubscribe handler was not set or already called.");
            }

            if (data.error) { // Top-level IPC error
                console.error(`Error ${actionDescription}:`, data.error);
                alert(`Failed to ${actionDescription}. IPC Error: ${data.error}`);
            } else if (apiMethod === 'create_pattern') {
                // Specific handling for create_pattern response
                if (data.result && data.result.success && params.newPatternName) {
                    const newPatternName = params.newPatternName;
                    console.log(`New pattern '${newPatternName}' created successfully. Adding 5 blank items and selecting.`);

                    // Persist pattern metadata (Phase 2) if captured at creation time
                    if (params.metadata && (params.metadata.modality || params.metadata.anatomy || params.metadata.indication)) {
                      window.electronAPI.callAPI('save_pattern_metadata', {
                        pattern_name: newPatternName,
                        metadata: params.metadata
                      });
                    }

                    for (let i = 0; i < 5; i++) {
                        const newItemData = {
                            view_plane: '',
                            window: '',
                            slice_thickness: '',
                            abbr: `Part ${i+1}`,
                            strategy: '',
                            chapter: '',
                            chunkID: 0
                        };
                        window.electronAPI.callAPI('add_item', {
                            pattern_name: newPatternName,
                            item_data: newItemData,
                            index: i
                        });
                    }
                    
                    const option = document.createElement('option');
                    option.value = newPatternName;
                    option.textContent = newPatternName;
                    patternSelector.appendChild(option);
                    if (!patterns.includes(newPatternName)) {
                        patterns.push(newPatternName);
                    }
                    patternSelector.value = newPatternName;
                    
                    loadPattern(newPatternName); // This will call loadPattern, which itself doesn't disable undo. 
                                               // The select change event is what should disable undo for a fresh pattern load.
                                               // After items are added, undo should be available for those add operations.

                } else {
                    const errorMessage = data.result && data.result.error ? data.result.error : "Unknown error creating pattern.";
                    console.error(`Error ${actionDescription}:`, errorMessage, "Full response data.result:", data.result);
                    alert(`Failed to ${actionDescription}. Error: ${errorMessage}`);
                }
            } else { 
                // Generic success case for other methods
                console.log(`Successfully ${actionDescription}. Result:`, data.result);
                
                let successfulModification = false;
                if (data.result && typeof data.result === 'object' && data.result.hasOwnProperty('success')) {
                    successfulModification = data.result.success === true;
                } else if (typeof data.result === 'boolean') {
                    successfulModification = data.result === true;
                }

                if (successfulModification) {
                    if (undoBtn) undoBtn.disabled = false; // Enable Undo for successful modifications
                    if (redoBtn) redoBtn.disabled = true; // Disable Redo when new action is performed
                }
                
                // Reload pattern data if it was a known modifying operation
                // This list ensures we only reload for relevant API methods.
                const modifyingMethods = [
                    'add_item', 'delete_item', 'update_item', 'move_item', 
                    'create_chunk', 'disband_chunk', 'delete_chapter', 'rename_chapter',
                    'update_item_chapter', 'update_chunk', 'rename_chunk_id', 
                    'delete_chunk', 'duplicate_item'
                    // 'update_pattern' is handled by saveCurrentPattern directly
                ];
                if (modifyingMethods.includes(apiMethod) && successfulModification) {
                    if (currentPattern) {
                        console.log(`Reloading pattern '${currentPattern}' after ${actionDescription}.`);
                        loadPattern(currentPattern); 
                    }
                }
            }
        }
    };
    
    // Store the unsubscribe function returned by onAPIResponse
    unsubscribeHandler = window.electronAPI.onAPIResponse(handleResponse);

}

// --- New Pattern Dialog Functions ---
function showNewPatternDialog() {
  newPatternNameInput.value = '';
  // Reset metadata fields
  const modEl = document.getElementById('new-pattern-modality');
  const anatEl = document.getElementById('new-pattern-anatomy');
  const indEl = document.getElementById('new-pattern-indication');
  if (modEl) modEl.value = '';
  if (anatEl) anatEl.value = '';
  if (indEl) indEl.value = '';
  newPatternDialogOverlay.style.display = 'flex'; // Use flex to center content
  newPatternNameInput.focus();
}

function hideNewPatternDialog() {
  newPatternDialogOverlay.style.display = 'none';
}

async function createNewPattern() {
  const patternName = newPatternNameInput.value.trim();
  if (patternName) {
    // Check if pattern already exists
    if (patterns.includes(patternName)) {
      alert('A pattern with this name already exists.');
      return;
    }

    // Capture metadata from dialog
    const metadata = {
      modality:   (document.getElementById('new-pattern-modality')?.value   || '').trim(),
      anatomy:    (document.getElementById('new-pattern-anatomy')?.value    || '').trim(),
      indication: (document.getElementById('new-pattern-indication')?.value || '').trim(),
      variant:    ''
    };

    console.log(`Requesting creation of new pattern: ${patternName}`, metadata);
    // Call API to create the pattern
    window.electronAPI.callAPI('create_pattern', { pattern_name: patternName });

    // Pass the new pattern name + metadata to handleApiResponse for post-creation steps
    handleApiResponse('create_pattern', `creating new pattern '${patternName}'`, { newPatternName: patternName, metadata });

    hideNewPatternDialog(); // Hide dialog immediately (optimistic)
  } else {
    alert('Pattern name cannot be empty.');
  }
}

// Ensure all contenteditable fields allow text selection and normal input behavior
document.addEventListener('mousedown', function(event) {
  let target = event.target;
  while (target && target !== document.body) {
    if (target.isContentEditable) {
      // If the target is contenteditable, stop propagation to prevent SortableJS from interfering
      // but also ensure default text selection behavior is not prevented.
      // The main concern here is if a drag starts on a contenteditable field.
      // SortableJS usually handles this well with its `filter` option for inputs/contenteditables.
      // Explicitly stopping propagation might be too aggressive if not needed.
      // For now, let's rely on SortableJS's filter. If issues persist, revisit.
      // event.stopPropagation(); // Potentially uncomment if needed
      return; // Allow default behavior for contenteditable
    }
    target = target.parentNode;
  }
}, true); // Use capture phase to catch event early


// Add this function to ensure items are properly deselected
function deselectAllItems() {
    selectedIndex = -1;
    selectedIndices = [];
    multiSelectionMode = false;
    document.querySelectorAll('.draggable-item.selected').forEach(el => {
        el.classList.remove('selected');
    });
}

// ... rest of editor.js ...

// Handle field edit
function handleFieldEdit(e) {
  const fieldElement = e.target;
  const fieldName = fieldElement.getAttribute('data-field');

  // If this is a chapter name or chunk ID field, let handleHeaderEdit deal with it.
  if (fieldName === 'chapter-name' || fieldName === 'chunk-id') {
    // console.log('handleFieldEdit: Ignoring chapter/chunk header edit, handled by handleHeaderEdit.');
    return;
  }

  const itemIndex = parseInt(fieldElement.getAttribute('data-index'));
  const newValue = fieldElement.textContent.trim(); // Trim whitespace
  console.log(`[handleFieldEdit START] Target element:`, fieldElement, `Field: ${fieldName}, Index: ${itemIndex}, NewValue: '${newValue}'`); // <<< ADDED LOG

  // Find the correct item (handle items within chunks)
  let actualItemIndex = -1;
  if (!isNaN(itemIndex)) {
    // First, check if we're inside a chunk item part
    const chunkItemPart = fieldElement.closest('.chunk-item-part');
    if (chunkItemPart) {
      // We're editing a field inside a chunk item
      actualItemIndex = parseInt(chunkItemPart.dataset.chunkIndex);
      console.log(`[handleFieldEdit] Determined actualItemIndex from chunk-item-part: ${actualItemIndex}`);
    } else {
      // We're editing a field in a regular standalone item
      actualItemIndex = itemIndex;
      console.log(`[handleFieldEdit] Determined actualItemIndex from standalone item: ${actualItemIndex}`);
    }
  } else {
    console.warn(`[handleFieldEdit] itemIndex is NaN. fieldElement:`, fieldElement, `data-index attribute:`, fieldElement.getAttribute('data-index'));
  }

  if (actualItemIndex !== -1 && actualItemIndex < currentPatternItems.length && currentPatternItems[actualItemIndex] && fieldName) {
    // Check if the value actually changed (handles undefined/null cases)
    const currentValue = currentPatternItems[actualItemIndex][fieldName] || '';
    if (currentValue !== newValue) {
      console.log(`[handleFieldEdit BEFORE UPDATE] Current item data:`, JSON.parse(JSON.stringify(currentPatternItems[actualItemIndex]))); // <<< ADDED LOG (Deep copy)
      console.log(`[handleFieldEdit] Field Edit: Index=${actualItemIndex}, Field=${fieldName}, OldValue='${currentValue}', NewValue='${newValue}'`);
      currentPatternItems[actualItemIndex][fieldName] = newValue;

      // Debounce save operation
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveCurrentPattern();
      }, 300); // Save after 300ms of inactivity
    } else {
      console.log(`[handleFieldEdit] No change detected: Index=${actualItemIndex}, Field=${fieldName}, Value='${newValue}'`);
    }
  } else {
    // Provide detailed error information for debugging
    if (fieldName && fieldName !== 'chapter-name' && fieldName !== 'chunk-id') {
      console.error("Could not determine valid index for field edit. Details:");
      console.error("  fieldElement:", fieldElement);
      console.error("  fieldName:", fieldName);
      console.error("  itemIndex (from data-index):", itemIndex);
      console.error("  actualItemIndex (calculated):", actualItemIndex);
      console.error("  currentPatternItems.length:", currentPatternItems.length);
      console.error("  newValue:", newValue);
      
      // Additional debugging for chunk items
      const chunkItemPart = fieldElement.closest('.chunk-item-part');
      if (chunkItemPart) {
        console.error("  chunkItemPart found:", chunkItemPart);
        console.error("  chunkItemPart.dataset.chunkIndex:", chunkItemPart.dataset.chunkIndex);
      } else {
        console.error("  No chunk-item-part parent found");
      }
      
      // Show a user-friendly error
      alert("Error: Could not save field changes. Please try refreshing the pattern.");
    }
  }
}

// Handler for view dropdown change
function handleViewChange(e) {
  const selectElement = e.target;
  const newView = selectElement.value;
  // Get the index from the 'data-index' attribute, which is set during rendering.
  // This index directly corresponds to the position in the flat currentPatternItems array.
  const itemIndex = parseInt(selectElement.dataset.index, 10); // Use data-index

  console.log(`View changed for data index: ${itemIndex}, new view: ${newView}`);

  // Check if the index is valid within the currentPatternItems array
  if (!isNaN(itemIndex) && itemIndex >= 0 && itemIndex < currentPatternItems.length) {
    // Update the view_plane property directly in the flat array item
    currentPatternItems[itemIndex].view_plane = newView;
    console.log(`Updated item at index ${itemIndex} view_plane:`, currentPatternItems[itemIndex]);

    // Save the changes
    saveCurrentPattern();
  } else {
    console.error("Could not find valid item index for view change:", itemIndex, selectElement);
    // Optionally, provide feedback and reload to prevent inconsistent state
     alert("Error updating view. Reloading pattern to ensure data integrity.");
     loadPattern(currentPattern); // Reload to reset state
  }
}

// Handler for window dropdown change
function handleWindowChange(e) {
  const selectElement = e.target;
  const newWindow = selectElement.value;
  const itemIndex = parseInt(selectElement.dataset.index, 10);

  console.log(`Window changed for data index: ${itemIndex}, new window: ${newWindow}`);

  if (!isNaN(itemIndex) && itemIndex >= 0 && itemIndex < currentPatternItems.length) {
    currentPatternItems[itemIndex].window = newWindow;
    console.log(`Updated item at index ${itemIndex} window:`, currentPatternItems[itemIndex]);
    saveCurrentPattern();
  } else {
    console.error("Could not find valid item index for window change:", itemIndex, selectElement);
    alert("Error updating window. Reloading pattern to ensure data integrity.");
    loadPattern(currentPattern);
  }
}

// Handler for slice-thickness dropdown change (schema v1)
function handleSliceThicknessChange(e) {
  const selectElement = e.target;
  const newSlice = selectElement.value;
  const itemIndex = parseInt(selectElement.dataset.index, 10);

  if (!isNaN(itemIndex) && itemIndex >= 0 && itemIndex < currentPatternItems.length) {
    currentPatternItems[itemIndex].slice_thickness = newSlice;
    saveCurrentPattern();
  } else {
    console.error("Could not find valid item index for slice-thickness change:", itemIndex, selectElement);
    alert("Error updating slice thickness. Reloading pattern to ensure data integrity.");
    loadPattern(currentPattern);
  }
}

// --- Save Function ---
let saveTimeout; // For debouncing saves

async function saveCurrentPattern() {
  console.log('[saveCurrentPattern] Attempting to save pattern:', currentPattern);
  console.log('[saveCurrentPattern] Pattern items to save:', JSON.parse(JSON.stringify(currentPatternItems))); // Log a clean copy

  // Create a deep copy to avoid potential issues with reactivity or unintended modifications
  const patternDataToSave = JSON.parse(JSON.stringify(currentPatternItems));

  // Prepare the data for saving
  const saveData = {
    pattern_name: currentPattern,
    // Ensure the items sent for saving have view_plane / window / slice_thickness fields
    items: patternDataToSave.map(item => ({
        ...item,
        view_plane: item.view_plane || '', // Allow empty view_plane
        window: item.window || '',
        slice_thickness: item.slice_thickness || ''
      }))
  };

  console.log(`Saving pattern ${currentPattern} with data:`, saveData);

  // Call backend API - Changed from 'save_pattern' to 'update_pattern'
  // And adjust payload structure to match update_pattern(pattern_name, pattern_data)
  window.electronAPI.callAPI('update_pattern', {
    pattern_name: saveData.pattern_name, // Pass pattern_name
    pattern_data: saveData.items       // Pass the items array as pattern_data
  });

  // Listen for save response (optional, for confirmation/error handling)
   const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'update_pattern') { // Check for update_pattern response
      unsubscribe();
      let anErrorOccurred = false;
      let errorMessage = 'An error occurred while saving the pattern.';

      // Modify success check: Check if data.result is simply true
      if (data.result === true) { 
        console.log('Save successful (result was true)');
        if (undoBtn) undoBtn.disabled = false; // Enable Undo on successful save
        
        // Update mirrors that reference this pattern
        updateMirrorsForPattern(currentPattern);
        if (redoBtn) redoBtn.disabled = true; // Disable Redo when new action is performed
      } else if (data.error) { // Check for explicit error first
        console.error('Error saving pattern:', data.error);
        errorMessage = `Failed to save pattern: ${data.error}`;
        alert(errorMessage);
        anErrorOccurred = true;
      } else { // Catch other non-true results (like false from save_patterns failure, or unexpected data)
          console.error('Save pattern failed or returned unexpected data. Response:', data);
          // alert('An error occurred while saving the pattern.'); // Avoid double alert if anErrorOccurred is also true
          anErrorOccurred = true; // Keep generic error message unless overridden by data.error
          if (!data.error) alert(errorMessage); // Show generic if no specific error was already alerted
      }
      
      // Re-assess coverage with the updated in-memory items (no full reload needed).
      renderCoveragePanel();
    }
  });
}

// --- Add Parts Bank Logic ---
// ... (Assuming parts bank logic exists and uses `saveCurrentPattern` or similar on changes) ...
// Make sure parts dragged from the bank are added with a default 'view: 'ax''

// Function to add item from parts bank
function addItemFromBank(partData) {
    const newItem = {
        abbr: partData.abbr || '',
        strategy: partData.strategy || '',
        chunkID: 0, // New items are not in chunks initially
        view_plane: '', // Allow empty view_plane for new items
        window: partData.window || '',
        slice_thickness: partData.slice_thickness || ''
    };

    // Add to the end of the current pattern list
    currentPatternItems.push(newItem);

    console.log('Added item from bank:', newItem);
    saveCurrentPattern(); // Save the updated pattern
    renderPatternItems(); // Re-render the list
}

// Load parts bank items
async function loadPartsBank() {
    partsBankItems.innerHTML = '<div class="loading-indicator">Loading parts bank...</div>';
    window.electronAPI.callAPI('get_parts_bank', {});

    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
        if (data && data.responseFor === 'get_parts_bank') {
            unsubscribe();
            if (data.result && Array.isArray(data.result)) {
                partsBankList = data.result.map(item => ({ ...item, view_plane: item.view_plane || '', window: item.window || '', slice_thickness: item.slice_thickness || '' })); // Allow empty fields
                renderPartsBank();
            } else if (data.error) {
                console.error('Error loading parts bank:', data.error);
                partsBankItems.innerHTML = `<div class="loading-indicator error">Error loading parts bank: ${data.error}</div>`;
            } else {
                 console.error('Unknown error loading parts bank. Response:', data);
                 partsBankItems.innerHTML = '<div class="loading-indicator error">Unknown error loading parts bank.</div>';
            }
        }
    });
}

// Render parts bank items
function renderPartsBank() {
    if (!partsBankList || partsBankList.length === 0) {
        partsBankItems.innerHTML = '<div class="loading-indicator">No parts in bank</div>';
        return;
    }

    let html = '';
    partsBankList.forEach((part, index) => {
        html += `
            <div class="part-bank-item" draggable="true" data-index="${index}">
                <span class="part-bank-abbr">${part.abbr}</span>
                <span class="part-bank-strategy">${part.strategy || ''}</span>
            </div>
        `;
    });
    partsBankItems.innerHTML = html;

    // Add drag start listeners
    document.querySelectorAll('.part-bank-item').forEach(item => {
        item.addEventListener('dragstart', handlePartBankDragStart);
    });
}

// Handle drag start from parts bank
function handlePartBankDragStart(e) {
    const index = parseInt(e.target.getAttribute('data-index'));
    if (!isNaN(index) && index < partsBankList.length) {
        const partData = partsBankList[index];
        // Set data to be transferred (e.g., JSON string of the part)
        e.dataTransfer.setData('application/json', JSON.stringify(partData));
        e.dataTransfer.effectAllowed = 'copy'; // Indicate copying
        console.log('Dragging part from bank:', partData);
    } else {
        console.error('Invalid index for parts bank drag start');
        e.preventDefault(); // Prevent drag if data is invalid
    }
}

// --- Setup Drag and Drop for Pattern Items Area ---
function setupPatternDropZone() {
    patternItems.addEventListener('dragover', (e) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'copy'; // Visual cue
        patternItems.classList.add('drag-over'); // Add visual feedback
    });

    patternItems.addEventListener('dragleave', (e) => {
        patternItems.classList.remove('drag-over'); // Remove visual feedback
    });

    patternItems.addEventListener('drop', (e) => {
        e.preventDefault();
        patternItems.classList.remove('drag-over');
        const partDataString = e.dataTransfer.getData('application/json');

        if (partDataString) {
            try {
                const partData = JSON.parse(partDataString);
                console.log('Dropped part data:', partData);
                // TODO: Determine drop position if needed, or just add to end
                addItemFromBank(partData);
            } catch (error) {
                console.error('Error parsing dropped data:', error);
            }
        } else {
            console.log('Drop event without expected data type.');
        }
    });
}

// Handle item click for selection
function handleItemClick(e, itemElement) { // itemElement is e.currentTarget (the .draggable-item)
  console.log('[handleItemClick ENTRY]', 'Event Target:', e.target, 'Item Element:', itemElement);
  // If the direct click target is an interactive element that should consume the click, return early.
  if (e.target.isContentEditable || e.target.tagName === 'SELECT' || e.target.closest('.drag-handle')) {
    console.log('[handleItemClick IGNORE]', 'Click on interactive element. Target tagName:', e.target.tagName);
    return;
  }

  // If user is in the middle of creating a chunk, a normal click should cancel it.
  if (chunkFirstItemIndex >= 0) {
      const prevItemElement = patternItems.querySelector('.chunk-start');
      if (prevItemElement) {
          prevItemElement.classList.remove('chunk-start');
      }
      chunkFirstItemIndex = -1;
      console.log("Chunk creation cancelled by click.");
  }

  // If the click wasn't on an interactive element, try to get the data-item-index for selection from the .draggable-item.
  const dataIndex = parseInt(itemElement.getAttribute('data-item-index'));

  // If the .draggable-item doesn't have a valid data-item-index (e.g., it's a chapter container),
  // then it's not selectable in this way.
  if (isNaN(dataIndex)) {
    // console.warn('handleItemClick: Clicked on a draggable element without a valid data-item-index for selection (e.g., chapter header area).', itemElement);
    return;
  }

  // If we have a valid index, proceed with selection logic.
  const isChunk = itemElement.dataset.isChunk === 'true'; // Check if the draggable item is a chunk container

  console.log(`Item clicked: Index=${dataIndex}, MultiSelect: ${multiSelectionMode}`);

  if (multiSelectionMode) {
    // Multi-selection mode (Shift key held)
    const indexPosition = selectedIndices.indexOf(dataIndex);
    if (indexPosition > -1) {
      // Already selected, deselect it
      selectedIndices.splice(indexPosition, 1);
      itemElement.classList.remove('selected');
    } else {
      // Not selected, select it
      selectedIndices.push(dataIndex);
      itemElement.classList.add('selected');
    }
    // Ensure single select index is cleared in multi-mode
    selectedIndex = -1;
  } else {
    // Single selection mode
    // Clear previous multi-selection
    selectedIndices = []; 
    document.querySelectorAll('.draggable-item.selected').forEach(el => el.classList.remove('selected'));

    if (selectedIndex === dataIndex) {
      // Clicked the same item again, deselect it
      selectedIndex = -1;
      itemElement.classList.remove('selected');
    } else {
      // Deselect previous single selection if any
      if (selectedIndex !== -1) {
        const previousSelectedItem = patternItems.querySelector(`.draggable-item[data-item-index="${selectedIndex}"]`);
        if (previousSelectedItem) {
          previousSelectedItem.classList.remove('selected');
        }
      }
      // Select the new item
      selectedIndex = dataIndex;
      itemElement.classList.add('selected');
    }
  }

  // Update visual state (might be redundant if classList handles it, but good practice)
  // renderPatternItems(); // Avoid full re-render on selection change if possible
}

// Handle keydown events on contenteditable fields
function handleFieldKeydown(e) {
  const fieldElement = e.target;

  // Enter key: Treat as blur (save)
  if (e.key === 'Enter') {
    e.preventDefault(); // Prevent adding newline
    fieldElement.blur(); // Trigger the blur event which handles saving
  }
  // Escape key: Revert changes and blur
  else if (e.key === 'Escape') {
    // Find original value (assuming it's stored somewhere or reload)
    // For simplicity, we just blur, losing current edits.
    // A more robust solution would store the original value on focus.
    console.log('Escape pressed, reverting changes (by blurring)');
    fieldElement.blur(); 
  }
}

// Handle reordering of items within a chunk
function handleChunkItemReorder(evt) {
    const movedElement = evt.item;
    const fromContainer = evt.from;
    const toContainer = evt.to;
    const oldIndex = evt.oldIndex;
    const newIndex = evt.newIndex;

    console.log("SortEnd: Handling chunk item reorder");

    // Get the chunk container and chunk ID
    const chunkContainer = toContainer.closest('.chunk-container');
    if (!chunkContainer) {
        console.error("Could not find chunk container for chunk item reorder");
        loadPattern(currentPattern);
        return;
    }

    const chunkId = parseInt(chunkContainer.dataset.chunkId);
    if (isNaN(chunkId) || chunkId <= 0) {
        console.error("Invalid chunk ID for chunk item reorder:", chunkId);
        loadPattern(currentPattern);
        return;
    }

    // Get all chunk items in their new visual order
    const chunkItems = Array.from(toContainer.children).filter(child => 
        child.classList.contains('chunk-item-part')
    );

    // Extract the data indices in the new order
    const newOrderIndices = chunkItems.map(item => {
        const dataIndex = parseInt(item.dataset.chunkIndex);
        if (isNaN(dataIndex)) {
            console.error("Invalid data index for chunk item:", item);
            return -1;
        }
        return dataIndex;
    }).filter(index => index !== -1);

    if (newOrderIndices.length === 0) {
        console.error("No valid indices found for chunk items");
        loadPattern(currentPattern);
        return;
    }

    console.log(`Reordering chunk ${chunkId} items to new order:`, newOrderIndices);

    // Call API to reorder chunk items
    window.electronAPI.callAPI('reorder_chunk_items', {
        pattern_name: currentPattern,
        chunk_id: chunkId,
        new_order: newOrderIndices
    });

    // Handle API response
    handleApiResponse('reorder_chunk_items', `reordering items in chunk ${chunkId}`);
}

// --- Updated SortableJS onEnd handler ---
function handleSortEnd(evt) {
    let { from: fromContainer, to: toContainer, oldIndex, newIndex, item: movedElement } = evt;

    // Drop into sacrificed panel is handled by the onAdd callback there
    const sacrificedContainer = document.getElementById('sacrificed-items');
    if (toContainer === sacrificedContainer) return;

    // If the item was dropped back in the same place visually, do nothing.
    if (fromContainer === toContainer && oldIndex === newIndex) {
        console.log("SortEnd: No visual change detected. Aborting API call.");
        return;
    }

    console.log("SortEnd Event Details:");
    console.log(` -> Moved Element:`, movedElement);
    console.log(` -> From Container:`, fromContainer, `(Old Index: ${oldIndex})`);
    console.log(` -> To Container:`, toContainer, `(New Index: ${newIndex})`);

    // Check if this is a chunk item being reordered within a chunk
    const isChunkItemPart = movedElement.classList.contains('chunk-item-part');
    const isFromChunkContainer = fromContainer.classList.contains('chunk-items');
    const isToChunkContainer = toContainer.classList.contains('chunk-items');

    if (isChunkItemPart && isFromChunkContainer && isToChunkContainer) {
        // Handle chunk item reordering within chunk
        handleChunkItemReorder(evt);
        return;
    }

    const isChapterContainer = movedElement.dataset.isChapter === 'true';
    const isChunk = movedElement.dataset.isChunk === 'true';
    const isSingleItem = !isChapterContainer && !isChunk;

    // --- Determine the *original* data index and size ---
    let originalDataStartIndex = -1;
    let movedItemSize = 1;
    let movedItemOriginalChapter = '';
    let movedItemOriginalChapterID = '';

    if (isChapterContainer) {
        // Dragging a chapter container.
        const chapterName = movedElement.dataset.chapterName;
      const chapterID = movedElement.dataset.chapterId || '';
      const chapterItems = currentPatternItems.filter(item =>
        chapterID ? ((item.chapterID || '') === chapterID) : ((item.chapter || '') === chapterName)
      );
        if (chapterItems.length > 0) {
            originalDataStartIndex = currentPatternItems.findIndex(item => item === chapterItems[0]);
            movedItemSize = chapterItems.length;
            movedItemOriginalChapter = chapterName; // Chapter name is its own 'chapter'
        movedItemOriginalChapterID = chapterID;
        console.log(` -> Moving CHAPTER '${chapterName}' (${movedItemOriginalChapterID}): Starts at data index ${originalDataStartIndex}, size ${movedItemSize}`);
        } else {
            console.error(`Cannot move chapter '${chapterName}': No items found in data.`);
            loadPattern(currentPattern); return;
        }
    } else if (isChunk) {
        // Dragging a chunk container.
        originalDataStartIndex = parseInt(movedElement.dataset.itemIndex);
        movedItemSize = parseInt(movedElement.dataset.chunkSize);
        movedItemOriginalChapter = movedElement.dataset.parentChapter || '';
        movedItemOriginalChapterID = currentPatternItems[originalDataStartIndex]?.chapterID || '';
        console.log(` -> Moving CHUNK ID ${movedElement.dataset.chunkId}: Starts at data index ${originalDataStartIndex}, size ${movedItemSize}, from chapter '${movedItemOriginalChapter}' (${movedItemOriginalChapterID})`);
    } else {
        // Dragging a single item.
        originalDataStartIndex = parseInt(movedElement.dataset.itemIndex);
        movedItemSize = 1;
        movedItemOriginalChapter = movedElement.dataset.parentChapter || '';
        movedItemOriginalChapterID = currentPatternItems[originalDataStartIndex]?.chapterID || '';
        console.log(` -> Moving SINGLE ITEM: Data index ${originalDataStartIndex}, from chapter '${movedItemOriginalChapter}' (${movedItemOriginalChapterID})`);
    }

    // Validate parsed indices/size
    if (isNaN(originalDataStartIndex) || originalDataStartIndex < 0 || isNaN(movedItemSize) || movedItemSize <= 0) {
        console.error("Failed to determine valid original data index or size:", movedElement);
        loadPattern(currentPattern); return;
    }

    // --- Determine Target Chapter ---
    let targetChapterName = '';
    let targetChapterID = '';
    if (isChapterContainer) {
        // Custom handling for dropping a chapter onto another chapter
        if (toContainer !== patternItems && toContainer.classList.contains('chapter-items')) {
            const targetChapterElement = toContainer.closest('.chapter-container');

            if (targetChapterElement) {
                // This is a chapter being dropped inside another chapter.
                // The desired behavior is to move the dragged chapter *before* the target chapter.
                console.log(` -> Chapter drop on another chapter detected. Target: ${targetChapterElement.dataset.chapterName}`);
                
                // Manually move the dragged DOM element to its new intended position in the main list
                patternItems.insertBefore(movedElement, targetChapterElement);

                // Update 'toContainer' and 'newIndex' to reflect this change,
                // so the rest of the function behaves as if it was a valid root-level drop.
                toContainer = patternItems;
                const topLevelItems = Array.from(patternItems.children)
                                          .filter(child => child.nodeType === Node.ELEMENT_NODE && child.classList.contains('draggable-item'));
                newIndex = topLevelItems.indexOf(movedElement);
                
                console.log(` -> DOM corrected. New container is root. New visual index is ${newIndex}.`);

            } else {
                console.error("Chapter dropped into an unknown container, reverting.", toContainer);
                loadPattern(currentPattern); 
                return;
            }
        }
        targetChapterName = movedElement.dataset.chapterName; // A chapter defines its own target name
        targetChapterID = movedElement.dataset.chapterId || '';
    } else if (toContainer.classList.contains('chapter-items')) {
        // Dropped inside a chapter's item list
        const targetChapterContainer = toContainer.closest('.chapter-container');
        targetChapterName = targetChapterContainer?.dataset.chapterName || '';
        targetChapterID = targetChapterContainer?.dataset.chapterId || '';
    } else if (toContainer === patternItems) {
        // Dropped in the main list (outside any chapter container)
        targetChapterName = ''; // Explicitly set to no chapter
        targetChapterID = '';
    } else {
        console.warn("Dropped into an unexpected container:", toContainer, "Assuming root (no chapter).");
        targetChapterName = '';
        targetChapterID = '';
    }
      console.log(` -> Target Chapter: '${targetChapterName}' (${targetChapterID})`);

    // --- Calculate Target API Linear Index --- Based on final visual order
    let targetApiIndex = 0;
    let currentLinearIndex = 0;
    let dropPointFound = false;

    // Iterate through the visual structure *after* the drop to find insertion point
    const topLevelItems = Array.from(patternItems.children)
                              .filter(child => child.nodeType === Node.ELEMENT_NODE && child.classList.contains('draggable-item'));

    for (const topLevelNode of topLevelItems) {
        if (dropPointFound) break; // Stop counting once insertion point is passed

        const nodeIsChapter = topLevelNode.dataset.isChapter === 'true';

        if (toContainer === patternItems && topLevelNode === movedElement) {
            // If dropped directly in patternItems, this element marks the insertion point.
             targetApiIndex = currentLinearIndex;
             dropPointFound = true;
             console.log(` -> Drop point found in root at index ${newIndex}, maps to API index ${targetApiIndex}`);
             // Don't break yet, need to check if moved element itself needs adding to index
             // continue; // Skip adding size of moved element itself here
        }

        if (nodeIsChapter) {
            const chapterName = topLevelNode.dataset.chapterName;
          const chapterID = topLevelNode.dataset.chapterId || '';
            const itemsInsideChapter = Array.from(topLevelNode.querySelector('.chapter-items')?.children || [])
                                        .filter(child => child.nodeType === Node.ELEMENT_NODE && child.classList.contains('draggable-item'));

            // Is the drop target inside *this* chapter?
            if (toContainer === topLevelNode.querySelector('.chapter-items')) {
                console.log(` -> Drop target is inside chapter '${chapterName}'`);
                for (let i = 0; i < itemsInsideChapter.length; i++) {
                    const itemElement = itemsInsideChapter[i];
                    // If this item is the insertion point marker (where movedElement is now)
                    if (itemElement === movedElement) {
                        targetApiIndex = currentLinearIndex; // We insert *before* this accumulated index
                        dropPointFound = true;
                        console.log(` -> Drop point found in chapter '${chapterName}' at visual index ${newIndex}, maps to API index ${targetApiIndex}`);
                        break; // Stop iterating this chapter's items
                    }
                    // Add size of item *before* the drop position
                    const itemIsChunk = itemElement.dataset.isChunk === 'true';
                    const itemSize = itemIsChunk ? parseInt(itemElement.dataset.chunkSize) : 1;
                    currentLinearIndex += isNaN(itemSize) ? 1 : itemSize;
                }
                // If dropped at the very end of the chapter, the loop finishes,
                // targetApiIndex should be currentLinearIndex after the loop.
                if (!dropPointFound && newIndex === itemsInsideChapter.length) {
                     targetApiIndex = currentLinearIndex;
                     dropPointFound = true;
                     console.log(` -> Drop point found at END of chapter '${chapterName}', maps to API index ${targetApiIndex}`);
                }

            } else {
                // Drop target is not in this chapter, just add the size of all its items.
                // Use original data to get accurate size, as DOM might be mid-update.
                const chapterItemsInData = currentPatternItems.filter(d =>
                  chapterID ? ((d.chapterID || '') === chapterID) : ((d.chapter || '') === chapterName)
                );
                const chapterDataSize = chapterItemsInData.length > 0 ? chapterItemsInData.length : 0;
                console.log(` -> Accumulating size for chapter '${chapterName}' (${chapterID}): ${chapterDataSize}`);
                currentLinearIndex += chapterDataSize;
            }
        } else {
             // It's an item/chunk directly in patternItems (root level).
             // If we haven't found the drop point yet, add its size.
             if (!dropPointFound) {
                 // Don't add size of the moved item if it was already in the root *before* the drop point
                 // This prevents double counting when dragging down within the root.
                 const isSelfBeforeDrop = (fromContainer === patternItems && topLevelNode === movedElement && evt.oldIndex < newIndex);

                 if (!isSelfBeforeDrop) {
                     const itemIsChunk = topLevelNode.dataset.isChunk === 'true';
                     const itemSize = itemIsChunk ? parseInt(topLevelNode.dataset.chunkSize) : 1;
                     currentLinearIndex += isNaN(itemSize) ? 1 : itemSize;
                     console.log(` -> Accumulating size for root item/chunk: ${isNaN(itemSize) ? 1 : itemSize}`);
                 }
             }
        }
    }

     // If dropped at the very end of the root container
    if (!dropPointFound && toContainer === patternItems && newIndex === topLevelItems.length) {
         targetApiIndex = currentLinearIndex;
         dropPointFound = true;
         console.log(` -> Drop point found at END of root, maps to API index ${targetApiIndex}`);
    }

    if (!dropPointFound) {
        console.error("Could not determine final target API index from visual drop. Complex scenario? Reloading.",
                      { from: fromContainer, to: toContainer, oldIndex: oldIndex, newIndex: newIndex });
        loadPattern(currentPattern);
        return;
    }

    console.log(` -> Calculated final Target API Index (before adjustment): ${targetApiIndex}`);

    // --- Modified block for downward move adjustment ---
    let finalApiTargetIndex = targetApiIndex; // Start with the visually calculated target index

    if (originalDataStartIndex < targetApiIndex && movedItemSize > 0) { // It's a downward move relative to data indices.
      const isMovingOutOfChapterToRoot = (movedItemOriginalChapterID !== '' && targetChapterID === '');
      const isMovingWithinSameChapter = (movedItemOriginalChapterID === targetChapterID);

        if (isMovingOutOfChapterToRoot) {
            // When moving out of a chapter downwards to the root,
            // the user reports the pre-adjusted targetApiIndex is correct,
            // and the standard +movedItemSize adjustment makes it land too low.
            console.log(` -> Downward move: ITEM OUT OF CHAPTER ('${movedItemOriginalChapter}') TO ROOT. Original Target API Index: ${targetApiIndex}. No +size adjustment for API call.`);
            // finalApiTargetIndex remains targetApiIndex (the pre-adjustment value for this specific case)
        } else if (isMovingWithinSameChapter) {
            // When moving within the same chapter, the targetApiIndex is already correctly calculated
            // and adding movedItemSize would cause it to overshoot the intended position.
            console.log(` -> Downward move: WITHIN SAME CHAPTER ('${movedItemOriginalChapter}'). Original Target API Index: ${targetApiIndex}. No +size adjustment needed.`);
            // finalApiTargetIndex remains targetApiIndex (no adjustment needed for within-chapter moves)
        } else {
            // Standard downward move (e.g., within root, root to chapter, chapter to different chapter).
            // Apply adjustment to counteract API's potential subtraction.
            console.log(` -> Downward move: Standard (cross-chapter or root). Adjusting: ${targetApiIndex} + ${movedItemSize}`);
            finalApiTargetIndex = targetApiIndex + movedItemSize;
        }
    } else {
        // For upward moves or no change in visual order, targetApiIndex is usually correct as is.
        // finalApiTargetIndex is already targetApiIndex by initialization.
        console.log(` -> Upward move or no significant visual reordering affecting API index calculation. Using Target API Index: ${targetApiIndex}`);
    }
    console.log(` -> Final Target API Index for call: ${finalApiTargetIndex}`);
    // --- End of modified block ---

    // --- Handle Chapter Change --- Determine if the effective chapter changed
    const needsChapterUpdate = !isChapterContainer && (
      targetChapterName !== movedItemOriginalChapter || targetChapterID !== movedItemOriginalChapterID
    );
    // When moving a chapter container, its items intrinsically adopt the new position's context (which is always root).
    // The backend needs to handle setting the chapter field for all items within the moved chapter if necessary.
    // For now, we assume moving a chapter sets its items' chapter field TO the chapter name.
    // But the API call needs to know the *chapter* was moved.

    // --- Prepare API Call ---
    const apiParams = {
        pattern_name: currentPattern,
        from_index: originalDataStartIndex,
        to_index: finalApiTargetIndex, // Use the conditionally adjusted target index
        count: movedItemSize
    };

    if (isChapterContainer) {
        // Moving a chapter container. Signal this to the backend.
        // Backend needs to re-assign chapter property for all 'count' items.
        // Let's use a specific parameter.
        apiParams.moved_chapter_name = movedElement.dataset.chapterName;
        console.log(` -> API Call: Moving Chapter '${apiParams.moved_chapter_name}'`);
    } else if (needsChapterUpdate) {
        // Moving an item/chunk into a different chapter or into/out of the root.
        apiParams.new_chapter = targetChapterName; // Can be empty string for root
      apiParams.new_chapter_id = targetChapterID;
      console.log(` -> API Call: Updating chapter for moved item/chunk to '${targetChapterName}' (${targetChapterID})`);
    }

    console.log(` -> Calling API: move_item with params:`, apiParams);
    window.electronAPI.callAPI('move_item', apiParams);

    // --- API Response Handling ---
    // Use the generic helper function
    handleApiResponse('move_item', `moving item/chunk/chapter`);

    // NOTE: We RELY on the API call success and subsequent `loadPattern`
    // triggered by `handleApiResponse` to refresh the UI correctly.
    // SortableJS's own DOM manipulations are effectively reverted by the reload.
}

// Initialize
// SP List Menu Functionality
function initializeSpListMenu() {
  // Set up event listeners for SP list menu
  spListMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSpListDropdown();
  });
  
  loadDifferentSpListBtn.addEventListener('click', () => {
    hideSpListDropdown();
    openSpListFileDialog();
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!spListMenuBtn.contains(e.target) && !spListDropdown.contains(e.target)) {
      hideSpListDropdown();
    }
  });
  
  // Load initial SP list info
  updateSpListDisplay();
}

function toggleSpListDropdown() {
  const isVisible = spListDropdown.style.display !== 'none';
  if (isVisible) {
    hideSpListDropdown();
  } else {
    showSpListDropdown();
  }
}

function showSpListDropdown() {
  spListDropdown.style.display = 'block';
  updateSpListDisplay(); // Refresh the display when showing
}

function hideSpListDropdown() {
  spListDropdown.style.display = 'none';
}

function updateSpListDisplay() {
  // Request current SP list info from the backend
  window.electronAPI.callAPI('get_sp_list_info', {});
  
  // Set up listener for the response
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'get_sp_list_info') {
      unsubscribe(); // Remove this listener
      
      if (data.error) {
        console.error('[SP List Menu] Error getting SP list info:', data.error);
        spListFilename.textContent = 'Error loading';
        currentSpListPath.textContent = 'Error: ' + data.error;
        // Clear path info on error
        pathProcessCwd.textContent = 'Error';
        pathProcessExecPath.textContent = 'Error';
        pathAppPath.textContent = 'Error';
        pathCurrentDir.textContent = 'Error';
        pathFilePath.textContent = 'Error';
        pathSpListPath.textContent = 'Error';
        pathDataDir.textContent = 'Error';
        pathSettingsDataDir.textContent = 'Error';
        pathNodeEnv.textContent = 'Error';
        pathAppIsPackaged.textContent = 'Error';
      } else if (data.result) {
        const info = data.result;
        // Update the display with the current SP list info
        spListFilename.textContent = info.filename || 'sp_list.json';
        currentSpListPath.textContent = info.fullPath || 'Path not available';
        
        // Update all the additional path information
        pathProcessCwd.textContent = info.processCwd || 'Not available';
        pathProcessExecPath.textContent = info.processExecPath || 'Not available';
        pathAppPath.textContent = info.appPath || 'Not available';
        if (pathPortableExecutableDir) pathPortableExecutableDir.textContent = info.portableExecutableDir || 'Not available';
        if (pathPortableExecutableFile) pathPortableExecutableFile.textContent = info.portableExecutableFile || 'Not available';
        pathCurrentDir.textContent = info.currentDir || 'Not available';
        pathFilePath.textContent = info.filePath || 'Not available';
        pathSpListPath.textContent = info.spListPath || 'Not available';
        pathDataDir.textContent = info.dataDir || 'Not available';
        pathSettingsDataDir.textContent = info.settingsDataDirectory || 'Not set';
        pathNodeEnv.textContent = info.nodeEnv || 'Not set';
        pathAppIsPackaged.textContent = info.appIsPackaged !== undefined ? info.appIsPackaged.toString() : 'Not available';
      }
    }
  });
}

function openSpListFileDialog() {
  // Request file dialog from main process
  window.electronAPI.invoke('show-sp-list-file-dialog')
    .then((result) => {
      if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        loadSpListFromPath(selectedPath);
      }
    })
    .catch((error) => {
      console.error('[SP List Menu] Error opening file dialog:', error);
    });
}

function loadSpListFromPath(filePath) {
  // Request backend to load SP list from the specified path
  window.electronAPI.callAPI('load_sp_list_from_path', { filePath: filePath });
  
  // Set up listener for the response
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'load_sp_list_from_path') {
      unsubscribe(); // Remove this listener
      
      if (data.error) {
        console.error('[SP List Menu] Error loading SP list from path:', data.error);
        alert('Failed to load SP list: ' + data.error);
      } else {
        console.log('[SP List Menu] Successfully loaded SP list from:', filePath);
        // Refresh the display
        updateSpListDisplay();
        // Reload the patterns to reflect the new SP list
        loadPatterns();
      }
    }
  });
}

function init() {
  // Add global error handler for all errors including ReferenceErrors
  window.addEventListener('error', function(event) {
    // Log the error
    console.error('Global error caught:', event.error);
    
    // Check for dragEvent not defined error
    if (event.error && event.error.message && event.error.message.includes('dragEvent is not defined')) {
      console.warn('dragEvent reference error caught - reinitializing dragEvent');
      
      // Reinitialize the dragEvent if it's undefined
      window.dragEvent = window.dragEvent || {
        clientX: 0,
        clientY: 0,
        target: null,
        currentTarget: null,
        dataTransfer: {
          dropEffect: 'none',
          effectAllowed: 'none',
          files: [],
          items: [],
          types: [],
          setData: function() {},
          getData: function() { return ''; }
        },
        preventDefault: function() {},
        stopPropagation: function() {}
      };
      
      // Make sure local var references the global
      dragEvent = window.dragEvent;
      
      // Show notification to user
      const notification = document.createElement('div');
      notification.textContent = 'Drag and drop restored - please try again';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.backgroundColor = 'rgba(79, 195, 247, 0.9)';
      notification.style.color = '#fff';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '4px';
      notification.style.zIndex = '9999';
      notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
      
      document.body.appendChild(notification);
      
      // Remove after 3 seconds
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
          if (notification.parentNode) {
            document.body.removeChild(notification);
          }
        }, 500);
      }, 3000);
    }
    
    // Clean up drag state if an error occurs during drag operations
    if (isDragging) {
      console.log('Cleaning up drag state after error');
      isDragging = false;
      
      if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem.setAttribute('draggable', 'false');
        draggedItem = null;
      }
      
      // Remove placeholder if it exists
      if (dragPlaceholder && dragPlaceholder.parentNode) {
        dragPlaceholder.parentNode.removeChild(dragPlaceholder);
      }
      dragPlaceholder = null;
      
      // Remove any drag-over classes
      document.querySelectorAll('.drag-over').forEach(item => {
        item.classList.remove('drag-over');
      });
    }
  });

  // *** Debugging: Check if button elements exist before adding listeners ***
  //console.log('Checking Chapter Dialog Buttons in init:');
  //console.log(' - chapterDialogOkBtn:', chapterDialogOkBtn);
  //console.log(' - chapterDialogCancelBtn:', chapterDialogCancelBtn);
  // *** End Debugging ***

  // Load available patterns and editor settings
  loadPatterns();
  loadEditorSettings();

  // Listen for editor settings changes from the settings window
  window.electronAPI.on('editor-settings-changed', (newSettings) => {
    editorSettings = { hideOutroInEditor: false, ...newSettings };
    console.log('Editor settings changed, reloading pattern:', editorSettings);
    if (currentPattern) {
      loadPattern(currentPattern);
    }
  });
  
  // Set up event listeners
  patternSelector.addEventListener('change', () => {
    coverageEditMode = false;
    loadPattern(patternSelector.value);
    if (undoBtn) undoBtn.disabled = true; // Disable undo when user manually selects a new pattern
    if (redoBtn) redoBtn.disabled = true; // Disable redo when user manually selects a new pattern
  });
  
  newPatternBtn.addEventListener('click', showNewPatternDialog);
  backBtn.addEventListener('click', () => {
    chunkFirstItemIndex = -1; // Reset chunk first item when going back to main
    window.electronAPI.closeEditor();
  });
  
  // New pattern dialog
  dialogOkBtn.addEventListener('click', createNewPattern);
  dialogCancelBtn.addEventListener('click', hideNewPatternDialog);
  
  // Keyboard events
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      multiSelectionMode = true;
    } else if (e.key === 'Escape') {
      hideContextMenu();
      hideNewPatternDialog();
    }
  });
  
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      multiSelectionMode = false;
    }
  });

  // Add event listener for custom close button
  // REMOVED: Block below attempted to find a button with ID 'close-editor-btn' which does not exist in editor.html
  /*
  const closeButton = document.getElementById('close-editor-btn'); 
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      window.electronAPI.send('close-editor'); // Send IPC message to main process
    });
  } else {
    console.error('Could not find editor window close button');
  }
  */

  loadPartsBank();
  setupPatternDropZone(); // Add drop zone setup
  initRightPanelTabs();
  loadAbbrRegistry();
  loadLibrary();

  const abbrRegistryBtn = document.getElementById('abbr-registry-btn');
  if (abbrRegistryBtn) abbrRegistryBtn.addEventListener('click', openAbbrRegistry);
  const abbrRegistryCloseBtn = document.getElementById('abbr-registry-close-btn');
  if (abbrRegistryCloseBtn) abbrRegistryCloseBtn.addEventListener('click', closeAbbrRegistry);
  initAbbrRegistrySearch();

  // Close registry on overlay click
  const abbrOverlay = document.getElementById('abbr-registry-overlay');
  if (abbrOverlay) {
    abbrOverlay.addEventListener('click', (e) => {
      if (e.target === abbrOverlay) closeAbbrRegistry();
    });
  }

  // Initialize SP List Menu
  initializeSpListMenu();

  // Debounce save pattern changes
  // Moved saveTimeout declaration outside saveCurrentPattern

  // Event listeners
  patternSelector.addEventListener('change', () => {
    coverageEditMode = false;
    loadPattern(patternSelector.value);
  });

  backBtn.addEventListener('click', () => {
    window.electronAPI.closeEditor();
  });

  newPatternBtn.addEventListener('click', showNewPatternDialog);
  dialogOkBtn.addEventListener('click', createNewPattern);
  dialogCancelBtn.addEventListener('click', hideNewPatternDialog);

  // Close context menu on click outside
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      hideContextMenu();
    }
     // Also handle deselection if clicking outside items
    if (!patternItems.contains(e.target) && !e.target.closest('.draggable-item')) {
        if (selectedIndex !== -1 || selectedIndices.length > 0) {
            console.log('Clicked outside, deselecting.');
            deselectAllItems(); // Deselect if clicking outside pattern items area
        }
    }
  });

   // Keyboard listeners for multi-select etc.
  // document.addEventListener('keydown', handleKeyDown); // REMOVED
  // document.addEventListener('keyup', handleKeyUp);   // REMOVED

  // Setup drop zone AFTER initializing sortable for pattern items
  setupPatternDropZone(); 

  // Add listeners for the chapter input dialog
  // chapterDialogOkBtn.addEventListener('click', handleChapterDialogOk);           // MOVED to showChapterInputDialog
  // chapterDialogCancelBtn.addEventListener('click', hideChapterInputDialog);     // MOVED to showChapterInputDialog
   // Optional: Handle Enter key in input field
   chapterInputName.addEventListener('keydown', (e) => {
       if (e.key === 'Enter') {
           handleChapterDialogOk();
       } else if (e.key === 'Escape') {
           hideChapterInputDialog();
       }
   });

  // Event listener for the Undo button
if (undoBtn) {
  undoBtn.addEventListener('click', handleUndo);
}

// Event listener for the Redo button
if (redoBtn) {
  redoBtn.addEventListener('click', handleRedo);
}

// Keyboard shortcuts for Undo/Redo
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault(); // Prevent default browser undo (e.g., in text fields)
    if (!undoBtn.disabled) {
      handleUndo();
    }
  } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
    event.preventDefault(); // Prevent default browser redo
    if (!redoBtn.disabled) {
      handleRedo();
    }
  }
});

  // Initialize mirror content editing prevention
  preventMirrorEditing();

  // Load initial pattern
  loadPatternData(currentPattern);
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', init); 

// --- Function to handle editing of chapter names and chunk IDs directly ---
function handleHeaderEdit(e) {
  console.log('[handleHeaderEdit] Triggered by event:', e.type, 'on element:', e.target);
  const fieldElement = e.target;
  const fieldName = fieldElement.getAttribute('data-field');
  let newValue = fieldElement.textContent.trim();

  if (fieldName === 'chapter-name') {
    const originalChapterName = fieldElement.getAttribute('data-original-chapter-name');
    const chapterID = fieldElement.getAttribute('data-chapter-id');
    
    if (newValue !== originalChapterName) {
      // Update only items belonging to this specific chapter ID
      console.log(`Updating client data: Renaming chapter "${originalChapterName}" to "${newValue}" for chapter ID: ${chapterID}`);
      
      currentPatternItems = currentPatternItems.map(item => {
        if ((item.chapterID || '') === chapterID) {
          return { ...item, chapter: newValue };
        }
        return item;
      });
      
      // Update the data attribute to reflect the new name
      fieldElement.setAttribute('data-original-chapter-name', newValue);
      
      saveCurrentPattern(); // Save the entire modified pattern
      renderPatternItems(); // Re-render from updated client data
    } else {
      // If no actual change, but the field was blurred, ensure original value is displayed
      fieldElement.textContent = originalChapterName; 
    }
  } 
  // REMOVED: else if (fieldName === 'chunk-id') block as the element is removed
  // else if (fieldName === 'chunk-id') {
  //   const currentChunkIdStr = fieldElement.getAttribute('data-current-chunk-id');
  //   const currentChunkIdInt = parseInt(currentChunkIdStr, 10);
  //   const newChunkIdParsed = parseInt(newValue, 10);

  //   if (isNaN(newChunkIdParsed) || newChunkIdParsed <= 0) {
  //     alert("Chunk ID must be a positive number.");
  //     fieldElement.textContent = currentChunkIdStr; // Revert
  //     return;
  //   }

  //   const newChunkIdStr = newChunkIdParsed.toString();

  //   if (newChunkIdStr !== currentChunkIdStr) {
  //     const otherChunkIDs = [...new Set(currentPatternItems.map(item => item.chunkID).filter(id => id && id !== currentChunkIdInt).map(id => id.toString()))];
  //     if (otherChunkIDs.includes(newChunkIdStr)) {
  //         alert(`Error: Chunk ID "${newChunkIdStr}" already exists. Please choose a unique ID.`);
  //         fieldElement.textContent = currentChunkIdStr; // Revert
  //         return;
  //     }

  //     console.log(`Updating client data: Changing Chunk ID from ${currentChunkIdInt} to ${newChunkIdParsed}`);
  //     currentPatternItems = currentPatternItems.map(item => {
  //       if (item.chunkID === currentChunkIdInt) {
  //         return { ...item, chunkID: newChunkIdParsed };
  //       }
  //       return item;
  //     });
  //     saveCurrentPattern(); // Save the entire modified pattern
  //     renderPatternItems(); // Re-render from updated client data
  //   } else {
  //     // If no actual change, ensure original value is displayed.
  //     fieldElement.textContent = currentChunkIdStr; 
  //   }
  // }
}

// Function to deselect all currently selected items
function deselectAllItems() {
  // Clear single selection state
  if (selectedIndex !== -1) {
    const previousSelectedItem = patternItems.querySelector(`.draggable-item[data-item-index="${selectedIndex}"]`);
    if (previousSelectedItem) {
      previousSelectedItem.classList.remove('selected');
    }
    selectedIndex = -1;
  }

  // Clear multi-selection state
  if (selectedIndices.length > 0) {
    selectedIndices.forEach(index => {
      const itemElement = patternItems.querySelector(`.draggable-item[data-item-index="${index}"]`);
      if (itemElement) {
        itemElement.classList.remove('selected');
      }
    });
    selectedIndices = [];
  }
  
  // As a catch-all, ensure no items have .selected class if state somehow diverged
  document.querySelectorAll('#pattern-items .draggable-item.selected').forEach(el => {
    el.classList.remove('selected');
  });

  console.log('All items deselected.');
  // No re-render needed usually, class removal should suffice for visuals.
}

// --- Undo Functionality ---
async function handleUndo() {
  if (!currentPattern || currentPattern === '-') { 
    console.warn("Undo action attempted without a valid pattern selected.");
    console.error("No pattern selected to undo action for."); 
    if(undoBtn) undoBtn.disabled = true;
    return;
  }

  console.log(`[UNDO] Attempting to undo last action for pattern: ${currentPattern}`); 
  try {
    const result = await window.electronAPI.invoke('undo-last-action', currentPattern); 
    console.log("[UNDO] API response received:", JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("[UNDO] Action undone successfully according to API."); 
      if (result.reverted_pattern_data) {
        console.log("[UNDO] Reverted pattern data received. Item count:", result.reverted_pattern_data.length);
        // console.log("[UNDO] Reverted data sample (first item):", JSON.stringify(result.reverted_pattern_data[0], null, 2));
        
        currentPatternData = result.reverted_pattern_data; // Update local data store
        console.log("[UNDO] currentPatternData updated. Item count:", currentPatternData.length);
        // console.log("[UNDO] currentPatternData sample (first item):", JSON.stringify(currentPatternData[0], null, 2));

        currentPatternItems = currentPatternData; // <--- ****** ADD THIS LINE ******
        console.log("[UNDO] currentPatternItems is now updated from currentPatternData. Item count:", currentPatternItems.length);


        // Destroy existing Sortable instances before re-rendering
        // This is crucial if SortableJS is active on the elements being re-rendered.
        if (typeof Sortable !== 'undefined') { // Check if Sortable is loaded
            if (window.mainSortableInstance) {
                try {
                    window.mainSortableInstance.destroy();
                    console.log("[UNDO] Main Sortable instance destroyed for undo.");
                } catch (e) { console.error("[UNDO] Error destroying main sortable:", e); }
                window.mainSortableInstance = null;
            }
            document.querySelectorAll('.chapter-items.sortable-group').forEach(group => {
                if (group.sortableInstance) {
                    try {
                        group.sortableInstance.destroy();
                        console.log("[UNDO] Chapter Sortable instance destroyed for undo.");
                    } catch (e) { console.error("[UNDO] Error destroying chapter sortable:", e); }
                    group.sortableInstance = null;
                }
            });
        }

        console.log("[UNDO] About to call renderPatternItems. Current patternItems.innerHTML before render:", patternItems.innerHTML.substring(0, 200) + "...");
        renderPatternItems(); // Call without arguments as per its definition
        console.log("[UNDO] renderPatternItems called. Current patternItems.innerHTML after render:", patternItems.innerHTML.substring(0, 200) + "...");
        
        // If you had other UI elements that depend on this data (e.g., a chapter dropdown that is separate),
        // you would update them here too. Since updateChapterDropdown was removed, we assume
        // renderPatternItems handles all necessary visual updates for the main list.

      } else {
        // This fallback should ideally not be hit if API always returns data on success.
        console.warn("[UNDO] Undo successful but no reverted pattern data received. Performing full reload as fallback.");
        await loadPattern(currentPattern); // Full reload for the current pattern
            }
      if(undoBtn) undoBtn.disabled = !result.can_undo_more;
      if(redoBtn) redoBtn.disabled = !result.can_redo; // Update redo button state
    } else {
      console.error("[UNDO] Failed to undo last action:", result.error || "Unknown error from API.");
      if(undoBtn) undoBtn.disabled = true;
    }
  } catch (error) {
    console.error("[UNDO] Error calling undo-last-action via invoke:", error);
    if(undoBtn) undoBtn.disabled = true;
  }
}

// --- Redo Functionality ---
async function handleRedo() {
  if (!currentPattern) {
    console.warn("Redo action attempted without a valid pattern selected.");
    console.error("No pattern selected to redo action for.");
    if(redoBtn) redoBtn.disabled = true;
    return;
  }
  
  console.log(`[REDO] Attempting to redo last action for pattern: ${currentPattern}`);
  try {
    const result = await window.electronAPI.invoke('redo-last-action', currentPattern);
    console.log("[REDO] API response received:", JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log("[REDO] Action redone successfully according to API.");
      if (result.reverted_pattern_data) {
        console.log("[REDO] Reverted pattern data received. Item count:", result.reverted_pattern_data.length);
        
        currentPatternData = result.reverted_pattern_data;
        console.log("[REDO] currentPatternData updated. Item count:", currentPatternData.length);
        
        currentPatternItems = currentPatternData;
        console.log("[REDO] currentPatternItems is now updated from currentPatternData. Item count:", currentPatternItems.length);
        
        // Destroy existing sortables before re-rendering
        if (typeof Sortable !== 'undefined') { // Check if Sortable is loaded
            if (window.mainSortableInstance) {
                try {
                    window.mainSortableInstance.destroy();
                    console.log("[REDO] Main Sortable instance destroyed for redo.");
                } catch (e) { console.error("[REDO] Error destroying main sortable:", e); }
                window.mainSortableInstance = null;
            }
            document.querySelectorAll('.chapter-items.sortable-group').forEach(group => {
                if (group.sortableInstance) {
                    try {
                        group.sortableInstance.destroy();
                        console.log("[REDO] Chapter Sortable instance destroyed for redo.");
                    } catch (e) { console.error("[REDO] Error destroying chapter sortable:", e); }
                    group.sortableInstance = null;
                }
            });
        }
        
        renderPatternItems();
        console.log("[REDO] renderPatternItems called.");
        
      } else {
        console.warn("[REDO] Redo successful but no reverted pattern data received. Performing full reload as fallback.");
        await loadPattern(currentPattern);
      }
      if(redoBtn) redoBtn.disabled = !result.can_redo_more;
      if(undoBtn) undoBtn.disabled = !result.can_undo; // Update undo button state
    } else {
      console.error("[REDO] Failed to redo last action:", result.error || "Unknown error from API.");
      if(redoBtn) redoBtn.disabled = true;
    }
  } catch (error) {
    console.error("[REDO] Error calling redo-last-action via invoke:", error);
    if(redoBtn) redoBtn.disabled = true;
  }
}

// --- MODIFICATIONS TO EXISTING FUNCTIONS ---

// Modify loadPatternData (or your equivalent pattern loading function)
async function loadPatternData(patternName, dataToRender = null) { // Added dataToRender for clarity
  // ... (existing initial checks for patternName)
  if (!patternName || patternName === '-') {
    // ... (clear editor state)
    if (undoBtn) undoBtn.disabled = true; // Disable undo when no pattern
    if (redoBtn) redoBtn.disabled = true; // Disable redo when no pattern
    return;
  }
  // `currentPattern` should be updated here if `patternName` is valid and different.
  // However, `loadPattern` is the main function that sets `currentPattern`.
  // This function `loadPatternData` seems to be a helper or an older version.
  // Let's assume `currentPattern` is correctly set by the calling context (e.g., `loadPattern`)
  // before this or `handleUndo` is invoked.

  try { // Ensure TRY block is present
    // ... (existing logic to show loading indicator)
    
    if (dataToRender) { // If data is directly provided (e.g., from undo/redo that doesn't use this for reload)
      currentPatternData = dataToRender;
      // ... (render pattern, update dropdowns etc.)
    } else {
      // ... (existing logic to fetch pattern data using window.electronAPI.callAPI or invoke)
      // ... (on successful fetch:)
      // currentPatternData = fetchedData;
      // ... (render pattern, update dropdowns etc.)
    }
    
    // After successfully loading and rendering a pattern (unless it was a render from an undo operation itself):
    // If dataToRender was null, it means a fresh load, so reset undo availability for this pattern in this session view.
    if (!dataToRender && undoBtn) {
        // The backend history is separate. Here, we mean no actions in *this editor session* have been taken yet on this freshly loaded pattern.
        undoBtn.disabled = true;
    }
    if (!dataToRender && redoBtn) {
        redoBtn.disabled = true; // Also disable redo on fresh load
    }

  } catch (error) { // Ensure CATCH block is present
    console.error(`Error in loadPatternData for ${patternName}:`, error);
    // ... (existing error handling, e.g., show error message in UI)
    if (undoBtn) undoBtn.disabled = true; // Disable undo on load error
    if (redoBtn) redoBtn.disabled = true; // Disable redo on load error
  }
}

// Mirror Content Dialog Functions
function openMirrorContentDialog() {
    console.log('Opening mirror content dialog');
    
    // Store the current context for replacement
    mirrorReplacementContext = {
        isChapter: contextMenuTargetIsChapter,
        isChunkContainer: contextMenuTargetIsChunkContainer,
        chapterName: contextMenuTargetChapterName,
        chapterID: contextMenuTargetChapterID,
        chunkId: contextMenuTargetChunkId,
        targetIndex: contextMenuTargetIndex,
        specificIndex: contextMenuTargetSpecificIndex
    };
    
    console.log('Stored mirror replacement context:', mirrorReplacementContext);
    
    // Reset dialog state
    mirrorSourcePatternSelect.value = '';
    mirrorContentSelection.style.display = 'none';
    mirrorContentOptions.innerHTML = '';
    mirrorDialogOkBtn.disabled = true;
    
    // Load available patterns
    loadMirrorSourcePatterns();
    
    // Show dialog
    mirrorContentDialog.style.display = 'flex';
}

function loadMirrorSourcePatterns() {
    console.log('Loading source patterns for mirror dialog');
    
    // Clear existing options
    while (mirrorSourcePatternSelect.children.length > 1) {
        mirrorSourcePatternSelect.removeChild(mirrorSourcePatternSelect.lastChild);
    }
    
    // Get available patterns
    window.electronAPI.callAPI('get_available_patterns', {});
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
        if (data && data.responseFor === 'get_available_patterns') {
            unsubscribe();
            
            if (data.error) {
                console.error('Error loading patterns for mirror dialog:', data.error);
                return;
            }
            
            if (data.result && Array.isArray(data.result)) {
                data.result.forEach(patternName => {
                    // Don't include the current pattern
                    if (patternName !== currentPattern) {
                        const option = document.createElement('option');
                        option.value = patternName;
                        option.textContent = patternName;
                        mirrorSourcePatternSelect.appendChild(option);
                    }
                });
            }
        }
    });
}

function onMirrorSourcePatternChange() {
    const selectedPattern = mirrorSourcePatternSelect.value;
    
    if (!selectedPattern) {
        mirrorContentSelection.style.display = 'none';
        mirrorDialogOkBtn.disabled = true;
        return;
    }
    
    console.log('Loading mirror options for pattern:', selectedPattern);
    
    // Get mirror options for the selected pattern
    window.electronAPI.callAPI('get_pattern_mirror_options', { pattern_name: selectedPattern });
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
        if (data && data.responseFor === 'get_pattern_mirror_options') {
            unsubscribe();
            
            if (data.error) {
                console.error('Error loading mirror options:', data.error);
                return;
            }
            
            if (data.result && data.result.success) {
                displayMirrorContentOptions(data.result);
            }
        }
    });
}

function displayMirrorContentOptions(mirrorData) {
    console.log('Displaying mirror content options:', mirrorData);
    
    mirrorContentOptions.innerHTML = '';
    
    // Add chapters
    if (mirrorData.chapters && mirrorData.chapters.length > 0) {
        const chapterHeader = document.createElement('div');
        chapterHeader.className = 'mirror-option-header';
        chapterHeader.textContent = 'Chapters:';
        mirrorContentOptions.appendChild(chapterHeader);
        
        mirrorData.chapters.forEach(chapter => {
            const option = document.createElement('div');
            option.className = 'mirror-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = chapter.chapter;
            checkbox.setAttribute('data-type', 'chapter');
            checkbox.addEventListener('change', updateMirrorDialogOkButton);
            
            const label = document.createElement('span');
            label.className = 'mirror-option-label';
            label.textContent = `${chapter.chapter}`;
            
            const description = document.createElement('div');
            description.className = 'mirror-option-description';
            description.textContent = `${chapter.items.length} items: ${chapter.items.map(item => item.abbr).join(', ')}`;
            
            option.appendChild(checkbox);
            option.appendChild(label);
            option.appendChild(description);
            mirrorContentOptions.appendChild(option);
        });
    }
    
    // Add chunks
    if (mirrorData.chunks && mirrorData.chunks.length > 0) {
        const chunkHeader = document.createElement('div');
        chunkHeader.className = 'mirror-option-header';
        chunkHeader.textContent = 'Chunks:';
        mirrorContentOptions.appendChild(chunkHeader);
        
        mirrorData.chunks.forEach(chunk => {
            const option = document.createElement('div');
            option.className = 'mirror-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = chunk.chunkID;
            checkbox.setAttribute('data-type', 'chunk');
            checkbox.addEventListener('change', updateMirrorDialogOkButton);
            
            const label = document.createElement('span');
            label.className = 'mirror-option-label';
            label.textContent = `Chunk ${chunk.chunkID}`;
            if (chunk.chapter) {
                label.textContent += ` (Chapter: ${chunk.chapter})`;
            }
            
            const description = document.createElement('div');
            description.className = 'mirror-option-description';
            description.textContent = `${chunk.items.length} items: ${chunk.items.map(item => item.abbr).join(', ')}`;
            
            option.appendChild(checkbox);
            option.appendChild(label);
            option.appendChild(description);
            mirrorContentOptions.appendChild(option);
        });
    }
    
    if ((mirrorData.chapters && mirrorData.chapters.length > 0) || (mirrorData.chunks && mirrorData.chunks.length > 0)) {
        mirrorContentSelection.style.display = 'block';
	} else {
        const noContentMsg = document.createElement('div');
        noContentMsg.textContent = 'No chapters or chunks available to mirror.';
        noContentMsg.style.color = '#BBB';
        mirrorContentOptions.appendChild(noContentMsg);
        mirrorContentSelection.style.display = 'block';
    }
}

function updateMirrorDialogOkButton() {
    const checkedBoxes = mirrorContentOptions.querySelectorAll('input[type="checkbox"]:checked');
    mirrorDialogOkBtn.disabled = checkedBoxes.length === 0;
}

function closeMirrorContentDialog() {
    mirrorContentDialog.style.display = 'none';
    mirrorReplacementContext = null; // Clear context when dialog is closed
}

function addSelectedMirrors() {
    const selectedPattern = mirrorSourcePatternSelect.value;
    const checkedBoxes = mirrorContentOptions.querySelectorAll('input[type="checkbox"]:checked');
    
    if (!selectedPattern || checkedBoxes.length === 0) {
        return;
    }
    
    if (!mirrorReplacementContext) {
        console.error('No mirror replacement context available');
        alert('Error: No replacement context available');
        closeMirrorContentDialog();
        return;
    }
    
    const mirrorConfigs = Array.from(checkedBoxes).map(checkbox => ({
        source_pattern: selectedPattern,
        type: checkbox.getAttribute('data-type'),
        identifier: checkbox.getAttribute('data-type') === 'chunk' ? parseInt(checkbox.value) : checkbox.value
    }));
    
    console.log('Replacing content with mirrors:', mirrorConfigs);
    console.log('Using replacement context:', mirrorReplacementContext);
    
    // Replace existing chapter/chunk content with mirrors
    window.electronAPI.callAPI('replace_with_mirrors', {
        target_pattern: currentPattern,
        mirror_configs: mirrorConfigs,
        replacement_context: mirrorReplacementContext
    });
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
        if (data && data.responseFor === 'replace_with_mirrors') {
            unsubscribe();
            
            console.log('Replace with mirrors response received:', data);
            
            if (data.error) {
                console.error('Error replacing with mirrors:', data.error);
                alert(`Error replacing with mirrors: ${data.error}`);
                closeMirrorContentDialog(); // Close dialog even on error
                return;
            }
            
            if (data.result && data.result.success) {
                console.log('Mirrors replaced successfully:', data.result);
                console.log(`Replaced ${data.result.itemsReplaced} items with ${data.result.mirrorsAdded} mirror items.`);
                
                // Enable undo button
                if (undoBtn) undoBtn.disabled = false;
                
                // Close dialog first to avoid any interference
                closeMirrorContentDialog();
                
                // Clear replacement context
                mirrorReplacementContext = null;
                
                // Then reload pattern data to show the mirrors
                setTimeout(() => {
                    loadPattern(currentPattern);
                }, 100);
            } else {
                console.error('Failed to replace with mirrors:', data.result);
                alert('Failed to replace with mirrors.');
                closeMirrorContentDialog(); // Close dialog even on error
                mirrorReplacementContext = null; // Clear context on error too
            }
        }
    });
}

// Set up mirror dialog event listeners
if (mirrorSourcePatternSelect) {
    mirrorSourcePatternSelect.addEventListener('change', onMirrorSourcePatternChange);
}

if (mirrorDialogOkBtn) {
    mirrorDialogOkBtn.addEventListener('click', addSelectedMirrors);
}

if (mirrorDialogCancelBtn) {
    mirrorDialogCancelBtn.addEventListener('click', closeMirrorContentDialog);
}

// Prevent editing of mirror content
function preventMirrorEditing() {
    // Add event listeners to prevent editing of mirror content
    document.addEventListener('focus', function(e) {
        if (e.target.hasAttribute('contenteditable') && e.target.closest('.mirror-item')) {
            e.target.blur();
            e.preventDefault();
        }
    }, true);

    document.addEventListener('keydown', function(e) {
        if (e.target.hasAttribute('contenteditable') && e.target.closest('.mirror-item')) {
            e.preventDefault();
        }
    }, true);

    document.addEventListener('input', function(e) {
        if (e.target.hasAttribute('contenteditable') && e.target.closest('.mirror-item')) {
            e.preventDefault();
            // Restore original content if somehow changed
            const mirrorItem = e.target.closest('.mirror-item');
            if (mirrorItem) {
                const itemIndex = parseInt(mirrorItem.getAttribute('data-item-index'));
                if (!isNaN(itemIndex) && currentPatternItems[itemIndex]) {
                    const originalValue = currentPatternItems[itemIndex][e.target.getAttribute('data-field')] || '';
                    if (e.target.textContent !== originalValue) {
                        e.target.textContent = originalValue;
                    }
                }
            }
        }
    }, true);
}

// Remove a mirror item from the current pattern
function removeMirrorItem(itemIndex) {
    console.log('Removing mirror item at index:', itemIndex);
    
    if (!currentPatternItems[itemIndex] || !currentPatternItems[itemIndex].isMirror) {
        console.error('Item at index is not a mirror item or does not exist');
        return;
    }
    
    // Call API to remove the mirror
    window.electronAPI.callAPI('remove_mirrors_from_pattern', {
        pattern_name: currentPattern,
        mirror_indices: [itemIndex]
    });
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
        if (data && data.responseFor === 'remove_mirrors_from_pattern') {
            unsubscribe();
            
            if (data.error) {
                console.error('Error removing mirror:', data.error);
                alert(`Error removing mirror: ${data.error}`);
                return;
            }
            
            if (data.result && data.result.success) {
                console.log(`Mirror removed successfully. Removed ${data.result.removedCount} items.`);
                
                // Enable undo button
                if (undoBtn) undoBtn.disabled = false;
                
                // Reload pattern data to show the changes
                loadPattern(currentPattern);
            } else {
                console.error('Failed to remove mirror:', data.result);
                alert('Failed to remove mirror.');
            }
        }
    });
}

// Chapter ID management functions
function generateChapterID() {
    return 'chapter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function ensureChapterIDs() {
    if (!currentPatternItems) return;
    
    let modified = false;
    const chapterIDMap = new Map(); // Map chapter names to IDs
    
    currentPatternItems.forEach(item => {
        if (item.chapter && !item.chapterID) {
            // If this chapter name hasn't been seen before, create a new ID
            if (!chapterIDMap.has(item.chapter)) {
                chapterIDMap.set(item.chapter, generateChapterID());
            }
            item.chapterID = chapterIDMap.get(item.chapter);
            modified = true;
        }
    });
    
    if (modified) {
        console.log('Added chapter IDs to items without them');
        // Save the pattern to persist the chapter IDs
        saveCurrentPattern();
    }
}

function createNewChapter(chapterName, targetIndex = -1) {
    const newChapterID = generateChapterID();
    
    // Create a new item with the chapter
    const newItem = {
        abbr: '',
        full_name: '',
        strategy: '',
        window_level: '',
        best_seen_on: '',
        groupID: 0,
        chunkID: 0,
        view_plane: '',
        chapter: chapterName,
        chapterID: newChapterID,
        window: '',
        slice_thickness: ''
    };
    
    if (targetIndex >= 0 && targetIndex < currentPatternItems.length) {
        currentPatternItems.splice(targetIndex, 0, newItem);
    } else {
        currentPatternItems.push(newItem);
    }
    
    saveCurrentPattern();
}

function updateChapterName(chapterID, newChapterName) {
    let modified = false;
    
    currentPatternItems.forEach(item => {
        if (item.chapterID === chapterID) {
            item.chapter = newChapterName;
            modified = true;
        }
    });
    
    if (modified) {
        saveCurrentPattern();
    }
}

// Update mirrors when source pattern changes
function updateMirrorsForPattern(sourcePattern) {
    console.log('Updating mirrors for source pattern:', sourcePattern);
    
    // Call API to update all mirrors from this source pattern
    window.electronAPI.callAPI('update_mirrors_for_pattern', {
        source_pattern: sourcePattern
    });
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
        if (data && data.responseFor === 'update_mirrors_for_pattern') {
            unsubscribe();
            
            if (data.error) {
                console.error('Error updating mirrors:', data.error);
                return;
            }
            
            if (data.result && data.result.success) {
                const updatedPatterns = data.result.updatedPatterns || [];
                console.log(`Mirrors updated successfully. Updated patterns: ${updatedPatterns.join(', ')}`);
                
                if (updatedPatterns.length > 0) {
                    console.log(`Updated ${updatedPatterns.length} patterns with mirrors from ${sourcePattern}`);
                }
            }
        }
    });
}

function formatStrategyText(text) {
    if (!text) return '';
    // Use a regex to wrap parenthesized content in a span
    return text.replace(/(\(.*?\))/g, '<span class="parenthesized">$1</span>');
}

function convertMirrorsInChapter(chapterName) {
  if (confirm(`Are you sure you want to convert all mirrored items in the chapter "${chapterName}" to regular items? This will make them editable.`)) {
    let itemsChanged = false;
    currentPatternItems = currentPatternItems.map(item => {
      if ((item.chapter || '') === chapterName && item.isMirror) {
        itemsChanged = true;
        const { isMirror, mirrorSource, ...regularItem } = item;
        return regularItem;
      }
      return item;
    });

    if (itemsChanged) {
      console.log(`Converted mirrored items in chapter "${chapterName}" to regular items.`);
      renderPatternItems();
      saveCurrentPattern();
    } else {
      console.log(`No mirrored items found in chapter "${chapterName}" to convert.`);
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Strategy chip parsing ──────────────────────────────────────────────────

function parseStrategyIntoChips(text) {
  const chips = [];
  if (!text) return chips;
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') {
      if (depth === 0 && current.trim()) {
        current.split(',').forEach(part => {
          const t = part.trim();
          if (t) chips.push({ type: 'subpart', text: t });
        });
        current = '';
      }
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
      if (depth === 0) {
        chips.push({ type: 'strategy', text: current.trim() });
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    current.split(',').forEach(part => {
      const t = part.trim();
      if (t) chips.push({ type: 'subpart', text: t });
    });
  }
  return chips;
}

// ─── Right panel tab switching ──────────────────────────────────────────────

function initRightPanelTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('tab-content--active'));
      btn.classList.add('tab-btn--active');
      const panel = document.querySelector(`.tab-content[data-tab="${tab}"]`);
      if (panel) panel.classList.add('tab-content--active');
    });
  });
}

function getActiveTab() {
  const btn = document.querySelector('.tab-btn--active');
  return btn ? btn.dataset.tab : 'parts-bank';
}

function setActiveTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('tab-content--active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('tab-btn--active');
  const content = document.querySelector(`.tab-content[data-tab="${tabName}"]`);
  if (content) content.classList.add('tab-content--active');
}

// ─── Sacrificed panel ──────────────────────────────────────────────────────

function loadSacrificedItems(patternName) {
  window.electronAPI.callAPI('get_sacrificed_items', { pattern_name: patternName });
  const unsub = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'get_sacrificed_items') {
      unsub();
      sacrificedItems = (data.result && Array.isArray(data.result)) ? data.result : [];
      renderSacrificedItems();
      renderCoveragePanel();
    }
  });
}

function saveSacrificedItems() {
  window.electronAPI.callAPI('save_sacrificed_items', {
    pattern_name: currentPattern,
    items: sacrificedItems
  });
}

// Automatic items (Phase 3.3) — same shape and semantics as sacrificed; per-pattern.
function loadAutomaticItems(patternName) {
  window.electronAPI.callAPI('get_automatic_items', { pattern_name: patternName });
  const unsub = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'get_automatic_items') {
      unsub();
      automaticItems = (data.result && Array.isArray(data.result)) ? data.result : [];
      renderAutomaticItemsTab();
      renderCoveragePanel(); // re-render the below-coverage strip
    }
  });
}

// Render the Automatic list inside the Sacrificed tab pane.
function renderAutomaticItemsTab() {
  const container = document.getElementById('automatic-items');
  if (!container) return;

  if (!automaticItems || automaticItems.length === 0) {
    container.innerHTML = '<div class="sacrificed-empty">No automatic items</div>';
    return;
  }

  container.innerHTML = automaticItems.map((item, i) => {
    const chips = parseStrategyIntoChips(item.strategy || '');
    const chipHtml = chips.map(c =>
      `<span class="sacrificed-chip sacrificed-chip--${c.type}">${escapeHtml(c.text)}</span>`
    ).join('');
    return `
      <div class="sacrificed-item" data-automatic-index="${i}">
        <div class="drag-handle" data-handle="true"></div>
        <div class="sacrificed-content">
          <span class="sacrificed-abbr">${escapeHtml(item.abbr || '')}</span>
          <div class="sacrificed-strategy">${chipHtml || escapeHtml(item.strategy || '')}</div>
        </div>
        <button class="restore-btn" data-automatic-index="${i}" title="Restore to pattern">&#x21A9;</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      restoreFromAutomatic(parseInt(btn.dataset.automaticIndex, 10));
    });
  });
}

function saveAutomaticItems() {
  window.electronAPI.callAPI('save_automatic_items', {
    pattern_name: currentPattern,
    items: automaticItems
  });
}

// Move a pattern item into the Automatic list. Mirrors the Sacrificed counterpart
// but persists to a parallel collection.
function moveItemToAutomatic(itemIndex) {
  if (!Array.isArray(currentPatternItems)) return;
  if (itemIndex < 0 || itemIndex >= currentPatternItems.length) return;
  const item = currentPatternItems[itemIndex];
  if (!item || item.isOutroItem) return;
  automaticItems.push({ abbr: item.abbr || '', strategy: item.strategy || '' });
  saveAutomaticItems();
  // Remove from the active pattern
  window.electronAPI.callAPI('delete_item', { pattern_name: currentPattern, item_index: itemIndex });
  handleApiResponse('delete_item', `removing item moved to Automatic`);
}

// Restore an Automatic entry back into the active pattern (append at end).
function restoreFromAutomatic(autoIndex) {
  if (autoIndex < 0 || autoIndex >= automaticItems.length) return;
  const item = automaticItems.splice(autoIndex, 1)[0];
  saveAutomaticItems();
  const newItem = {
    abbr: item.abbr || '',
    strategy: item.strategy || '',
    view_plane: '',
    window: '',
    slice_thickness: '',
    chapter: '',
    chunkID: 0
  };
  window.electronAPI.callAPI('add_item', {
    pattern_name: currentPattern,
    item_data: newItem,
    index: (currentPatternItems || []).length
  });
  handleApiResponse('add_item', `restoring item from Automatic`);
  renderCoveragePanel();
}

function renderSacrificedItems() {
  const container = document.getElementById('sacrificed-items');
  if (!container) return;

  if (!sacrificedItems || sacrificedItems.length === 0) {
    container.innerHTML = '<div class="sacrificed-empty">No sacrificed items</div>';
    initSacrificedSortable();
    return;
  }

  container.innerHTML = sacrificedItems.map((item, i) => {
    const chips = parseStrategyIntoChips(item.strategy || '');
    const chipHtml = chips.map(c =>
      `<span class="sacrificed-chip sacrificed-chip--${c.type}">${escapeHtml(c.text)}</span>`
    ).join('');
    return `
      <div class="sacrificed-item" data-sacrificed-index="${i}">
        <div class="drag-handle" data-handle="true"></div>
        <div class="sacrificed-content">
          <span class="sacrificed-abbr">${escapeHtml(item.abbr || '')}</span>
          <div class="sacrificed-strategy">${chipHtml || escapeHtml(item.strategy || '')}</div>
        </div>
        <button class="restore-btn" data-sacrificed-index="${i}" title="Restore to pattern">&#x21A9;</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      restoreFromSacrificed(parseInt(btn.dataset.sacrificedIndex));
    });
  });

  initSacrificedSortable();
  renderCoveragePanel();
}

function initSacrificedSortable() {
  const container = document.getElementById('sacrificed-items');
  if (!container) return;

  if (container.sortableInstance) {
    container.sortableInstance.destroy();
    container.sortableInstance = null;
  }

  container.sortableInstance = new Sortable(container, {
    group: { name: 'shared-items', put: true, pull: false },
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    draggable: '.sacrificed-item',
    onAdd: handleItemDropToSacrificed,
    onEnd: handleSacrificedReorder
  });

  // HTML5 drop for subpart chips (chip-level DnD, separate from SortableJS whole-item DnD)
  container.removeEventListener('dragover', _sacrificedChipDragOver);
  container.removeEventListener('dragleave', _sacrificedChipDragLeave);
  container.removeEventListener('drop', handleChipDropToSacrificed);
  container.addEventListener('dragover', _sacrificedChipDragOver);
  container.addEventListener('dragleave', _sacrificedChipDragLeave);
  container.addEventListener('drop', handleChipDropToSacrificed);
}

function _sacrificedChipDragOver(e) {
  if (!e.dataTransfer.types.includes('application/json')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.getElementById('sacrificed-items')?.classList.add('drag-over');
}

function _sacrificedChipDragLeave() {
  document.getElementById('sacrificed-items')?.classList.remove('drag-over');
}

function handleItemDropToSacrificed(evt) {
  const movedEl = evt.item;
  const itemIndex = parseInt(movedEl.dataset.itemIndex);

  if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= currentPatternItems.length) {
    movedEl.remove();
    renderSacrificedItems();
    return;
  }

  const item = currentPatternItems[itemIndex];
  if (!item) {
    movedEl.remove();
    renderSacrificedItems();
    return;
  }

  sacrificedItems.push({ abbr: item.abbr || '', strategy: item.strategy || '' });
  currentPatternItems.splice(itemIndex, 1);

  saveCurrentPattern();
  saveSacrificedItems();
  renderPatternItems();
  renderSacrificedItems();
}

function handleSacrificedReorder(evt) {
  if (evt.from !== evt.to) return;
  if (evt.oldIndex === evt.newIndex) return;
  const moved = sacrificedItems.splice(evt.oldIndex, 1)[0];
  sacrificedItems.splice(evt.newIndex, 0, moved);
  saveSacrificedItems();
}

function restoreFromSacrificed(sacrificedIndex) {
  if (sacrificedIndex < 0 || sacrificedIndex >= sacrificedItems.length) return;

  const item = sacrificedItems.splice(sacrificedIndex, 1)[0];
  currentPatternItems.push({
    abbr: item.abbr || '',
    strategy: item.strategy || '',
    view_plane: '',
    window: '',
    slice_thickness: '',
    chunkID: 0,
    chapter: '',
    chapterID: ''
  });

  saveCurrentPattern();
  saveSacrificedItems();
  renderPatternItems();
  renderSacrificedItems();
}

function moveItemToSacrificed(itemIndex) {
  if (itemIndex < 0 || itemIndex >= currentPatternItems.length) return;

  const item = currentPatternItems[itemIndex];
  sacrificedItems.push({ abbr: item.abbr || '', strategy: item.strategy || '' });
  currentPatternItems.splice(itemIndex, 1);

  saveCurrentPattern();
  saveSacrificedItems();
  renderPatternItems();
  renderSacrificedItems();
}

// ─── Strategy chip rendering ────────────────────────────────────────────────

function serializeChipsToStrategy(chips) {
  const subparts = chips.filter(c => c.type === 'subpart').map(c => c.text);
  const strategies = chips.filter(c => c.type === 'strategy').map(c => c.text);
  let result = subparts.join(', ');
  if (strategies.length) result += (result ? ' ' : '') + strategies.join(' ');
  return result.trim();
}

function buildChipHtml(strategyText, itemIndex) {
  const chips = parseStrategyIntoChips(strategyText || '');
  if (!chips.length) return `<span class="strategy-placeholder">+ strategy</span>`;
  return chips.map(c => {
    if (c.type === 'subpart') {
      return `<span class="strategy-chip strategy-chip--subpart" draggable="true" data-chip-type="subpart" data-chip-text="${escapeHtml(c.text)}" data-item-index="${itemIndex}">${escapeHtml(c.text)}</span>`;
    }
    return `<span class="strategy-chip strategy-chip--strategy">${escapeHtml(c.text)}</span>`;
  }).join('');
}

// ─── Canonical option lists (schema v1) ─────────────────────────────────────
// One place; reused by pattern editor, coverage prefs, and Library editor.
const VIEW_PLANE_OPTIONS      = ['ax', 'cor', 'sag', '3D', 'CPR'];
const WINDOW_OPTIONS          = ['ST', 'bone', 'brain', 'lung', 'stroke', 'CTA', 'CTV'];
const SLICE_THICKNESS_OPTIONS = ['thin', '3mm', 'MIP', 'tMIP', 'MinIP', 'thin + MIP'];

function renderOptionList(options, selectedValue, blankLabel = '-') {
  const blankOpt = `<option value="" ${!selectedValue ? 'selected' : ''}>${blankLabel}</option>`;
  const opts = options.map(v =>
    `<option value="${escapeHtml(v)}" ${selectedValue === v ? 'selected' : ''}>${escapeHtml(v)}</option>`
  ).join('');
  return blankOpt + opts;
}

function renderViewSelect(selectedValue, index, selectDisabled = '') {
  return `<select class="item-view-select" data-index="${index}" ${selectDisabled}>${renderOptionList(VIEW_PLANE_OPTIONS, selectedValue || '')}</select>`;
}

function renderWindowSelect(selectedValue, index, selectDisabled = '') {
  return `<select class="item-window-select" data-index="${index}" ${selectDisabled}>${renderOptionList(WINDOW_OPTIONS, selectedValue || '')}</select>`;
}

function renderSliceThicknessSelect(selectedValue, index, selectDisabled = '') {
  return `<select class="item-slice-select" data-index="${index}" ${selectDisabled}>${renderOptionList(SLICE_THICKNESS_OPTIONS, selectedValue || '')}</select>`;
}

function renderStrategyField(strategy, index, editableAttr) {
  const chipHtml = buildChipHtml(strategy, index);
  return `
    <div class="item-strategy-wrapper">
      <div class="strategy-chips-view" data-index="${index}">${chipHtml}</div>
      <div class="item-strategy strategy-text-edit" contenteditable="${editableAttr}" data-field="strategy" data-index="${index}" style="display:none">${escapeHtml(strategy)}</div>
    </div>
  `;
}

// ─── Chip drag-and-drop ─────────────────────────────────────────────────────

function wireChipDrag(container) {
  container.querySelectorAll('.strategy-chip--subpart').forEach(chip => {
    chip.addEventListener('dragstart', handleChipDragStart);
    chip.addEventListener('dragend', () => { isDragging = false; });
  });
}

function handleChipDragStart(e) {
  isDragging = true;
  e.stopPropagation(); // Don't trigger SortableJS on the parent item
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'chip',
    chipText: e.target.dataset.chipText,
    itemIndex: parseInt(e.target.dataset.itemIndex)
  }));
  e.dataTransfer.effectAllowed = 'move';
}

function handleChipDropToSacrificed(e) {
  const container = document.getElementById('sacrificed-items');
  container?.classList.remove('drag-over');
  e.preventDefault();
  e.stopPropagation();

  let data;
  try { data = JSON.parse(e.dataTransfer.getData('application/json')); } catch { return; }
  if (!data || data.type !== 'chip') return;

  const { chipText, itemIndex } = data;
  if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= currentPatternItems.length) return;

  const item = currentPatternItems[itemIndex];
  if (item.isOutroItem) return;

  sacrificedItems.push({ abbr: item.abbr || '', strategy: chipText });

  // Remove the chip from the item's strategy
  const chips = parseStrategyIntoChips(item.strategy || '');
  const remaining = chips.filter(c => !(c.type === 'subpart' && c.text === chipText));
  currentPatternItems[itemIndex] = { ...item, strategy: serializeChipsToStrategy(remaining) };

  saveCurrentPattern();
  saveSacrificedItems();
  renderPatternItems();
  renderSacrificedItems();
}

// ─── Chip-to-chip drag (within / between strategy fields) ───────────────────

function wireChipDropTarget(view) {
  view.removeEventListener('dragover', handleChipViewDragOver);
  view.removeEventListener('dragleave', handleChipViewDragLeave);
  view.removeEventListener('drop', handleChipViewDrop);
  view.addEventListener('dragover', handleChipViewDragOver);
  view.addEventListener('dragleave', handleChipViewDragLeave);
  view.addEventListener('drop', handleChipViewDrop);
}

function getChipInsertionIndex(e, view) {
  const chips = Array.from(view.querySelectorAll('.strategy-chip'));
  if (!chips.length) return 0;
  const mouseX = e.clientX;
  for (let i = 0; i < chips.length; i++) {
    const rect = chips[i].getBoundingClientRect();
    if (mouseX < rect.left + rect.width / 2) return i;
  }
  return chips.length;
}

function handleChipViewDragOver(e) {
  if (!e.dataTransfer.types.includes('application/json')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const view = e.currentTarget;
  view.classList.add('chip-drop-target');
  const idx = getChipInsertionIndex(e, view);
  view.dataset.dropInsertIndex = idx;
  const chips = view.querySelectorAll('.strategy-chip');
  chips.forEach((chip, i) => chip.classList.toggle('chip-insert-before', i === idx));
  view.classList.toggle('chip-insert-at-end', idx >= chips.length);
}

function handleChipViewDragLeave(e) {
  // Only clear if leaving the view itself (not entering a child chip)
  if (e.currentTarget.contains(e.relatedTarget)) return;
  const view = e.currentTarget;
  view.classList.remove('chip-drop-target', 'chip-insert-at-end');
  view.querySelectorAll('.strategy-chip').forEach(c => c.classList.remove('chip-insert-before'));
}

function handleChipViewDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const view = e.currentTarget;
  const insertIndex = parseInt(view.dataset.dropInsertIndex ?? '999');
  view.classList.remove('chip-drop-target', 'chip-insert-at-end');
  view.querySelectorAll('.strategy-chip').forEach(c => c.classList.remove('chip-insert-before'));

  let data;
  try { data = JSON.parse(e.dataTransfer.getData('application/json')); } catch { return; }
  if (!data || data.type !== 'chip') return;

  const targetItemIndex = parseInt(view.dataset.index);
  const { chipText, itemIndex: sourceItemIndex } = data;

  if (isNaN(targetItemIndex) || targetItemIndex < 0 || targetItemIndex >= currentPatternItems.length) return;
  if (isNaN(sourceItemIndex) || sourceItemIndex < 0 || sourceItemIndex >= currentPatternItems.length) return;

  const sourceItem = currentPatternItems[sourceItemIndex];
  const targetItem = currentPatternItems[targetItemIndex];
  if (sourceItem.isOutroItem || targetItem.isOutroItem) return;

  // Remove chip from source item
  const sourceChips = parseStrategyIntoChips(sourceItem.strategy || '');
  const sourceRemaining = sourceChips.filter(c => !(c.type === 'subpart' && c.text === chipText));
  currentPatternItems[sourceItemIndex] = { ...sourceItem, strategy: serializeChipsToStrategy(sourceRemaining) };

  // Insert chip into target item at insertIndex (position among all chips in the view)
  const targetChips = parseStrategyIntoChips(
    sourceItemIndex === targetItemIndex
      ? serializeChipsToStrategy(sourceRemaining)  // source already updated
      : targetItem.strategy || ''
  );
  const targetSubparts = targetChips.filter(c => c.type === 'subpart');
  const targetStrategies = targetChips.filter(c => c.type === 'strategy');
  // insertIndex is among visible chips (subparts + strategies); clamp to subpart range
  const subpartInsert = Math.min(insertIndex, targetSubparts.length);
  targetSubparts.splice(subpartInsert, 0, { type: 'subpart', text: chipText });
  currentPatternItems[targetItemIndex] = {
    ...currentPatternItems[targetItemIndex],
    strategy: serializeChipsToStrategy([...targetSubparts, ...targetStrategies])
  };

  saveCurrentPattern();
  renderPatternItems();
}

// ─── Coverage panel ─────────────────────────────────────────────────────────

// ─── Coverage requirements ───────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadCoverageRequirements(patternName) {
  window.electronAPI.callAPI('get_coverage_requirements', { pattern_name: patternName });
  const unsub = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'get_coverage_requirements') {
      unsub();
      coverageRequirements = Array.isArray(data.result) ? data.result : [];
      renderCoveragePanel();
    }
  });
}

function saveCoverageRequirements() {
  window.electronAPI.callAPI('save_coverage_requirements', {
    pattern_name: currentPattern,
    requirements: coverageRequirements
  });
}

// Expand a string's whitespace-delimited tokens using the general abbreviation registry
function expandWithGeneralAbbrs(text) {
  return text.split(/\s+/).map(token => {
    const match = Object.entries(generalAbbrRegistry)
      .find(([k]) => k.toLowerCase() === token.toLowerCase());
    return match ? (match[1].fullName || token).toLowerCase() : token.toLowerCase();
  }).join(' ');
}

// Hybrid match: pattern item satisfies requirement iff
//   1. Library hierarchy says so (item's entry is an ancestor of, or equal to, the
//      requirement's entry — e.g. `vertebrobas` satisfies `basilar_artery`); OR
//   2. The classic fuzzy fallback matches (handles unregistered items/requirements).
function matchesRequirement(req, item) {
  if (item.isOutroItem) return false;
  const needle = (req.label || '').toLowerCase();
  if (!needle) return false;

  // 1) Library-based match — fires only when both sides resolve to entries
  const libHit = libraryAncestorMatch(req, item);
  if (libHit === true) return true;
  // libHit === false means both sides resolved but no ancestor relationship — still allow
  // fuzzy fallback to catch sibling/synonym cases the user hasn't modeled yet.

  // 2) Fuzzy fallback (legacy behavior, retained for unregistered data).
  //    All comparisons run on stem-normalized lowercase forms so plural
  //    variants (e.g. "subclavian arteries" ↔ "subclavian artery") match.
  const stemNeedle = normalizeForMatch(needle);
  const abbrSegments = splitCompoundLabel(item.abbr || '');
  const abbrKeys = [...new Set([...(abbrSegments.length ? abbrSegments : [item.abbr || '']), item.abbr].filter(Boolean))];

  const subparts = parseStrategyIntoChips(item.strategy || '')
    .filter(c => c.type === 'subpart')
    .map(c => c.text.toLowerCase());
  const stemSubparts = subparts.map(normalizeForMatch);

  const containsEither = (a, b) => a && b && (a.includes(b) || b.includes(a));

  const fuzzyAgainst = (stemN) => {
    for (const part of abbrSegments.length ? abbrSegments : [item.abbr || '']) {
      if (containsEither(normalizeForMatch(part), stemN)) return true;
      const fullName = (abbrRegistry[part]?.fullName || '').toLowerCase();
      if (containsEither(normalizeForMatch(fullName), stemN)) return true;
    }
    if (stemSubparts.some(s => containsEither(s, stemN))) return true;
    for (const key of abbrKeys) {
      const registryEntry = abbrRegistry[key];
      if (registryEntry?.subparts?.length) {
        const regSubs = registryEntry.subparts.map(s => normalizeForMatch(s));
        if (regSubs.some(s => containsEither(s, stemN))) return true;
      }
    }
    return false;
  };

  if (fuzzyAgainst(stemNeedle)) return true;

  // Try again with general-abbr-expanded needle (e.g. "R Kidney" → "right kidney"),
  // also stem-normalized so plurals still match after expansion.
  const expandedNeedle = expandWithGeneralAbbrs(needle);
  if (expandedNeedle !== needle) {
    const stemExpanded = normalizeForMatch(expandedNeedle);
    if (fuzzyAgainst(stemExpanded)) return true;
  }

  return false;
}

function groupMatches(matches) {
  const grouped = {};
  matches.forEach(m => {
    const key = `${m.abbr}|${m.view}|${m.window}`;
    if (!grouped[key]) grouped[key] = { abbr: m.abbr, view: m.view, window: m.window, count: 0 };
    grouped[key].count++;
  });
  return Object.values(grouped);
}

// Build a quick item-key index for manual-match lookup.
// Key shape: `${abbr}|${view_plane}|${window}` — matches the keys stored in
// excludedMatches/manualMatches.
function buildPatternItemIndex(items) {
  const map = new Map();
  for (const it of items) {
    const key = `${it.abbr}|${it.view_plane || ''}|${it.window || ''}`;
    if (!map.has(key)) map.set(key, { abbr: it.abbr, view: it.view_plane || '', window: it.window || '', count: 0 });
    map.get(key).count++;
  }
  return map;
}

function assessCoverage() {
  const items = (currentPatternItems || []).filter(i => !i.isOutroItem);
  const itemIndex = buildPatternItemIndex(items);

  // Resolve manualMatches[] (array of keys) into the same shape as auto matches,
  // dropping any keys that no longer exist in the pattern.
  function resolveManualMatches(manualKeys) {
    if (!Array.isArray(manualKeys)) return [];
    const seen = new Set();
    const out = [];
    for (const key of manualKeys) {
      if (seen.has(key)) continue;
      const hit = itemIndex.get(key);
      if (hit) {
        out.push({ abbr: hit.abbr, view: hit.view, window: hit.window, count: hit.count, manual: true });
        seen.add(key);
      }
    }
    return out;
  }

  function assessOne(req) {
    const excluded = req.excludedMatches || [];
    const manual   = req.manualMatches   || [];
    const candidates = items.filter(item => {
      const key = `${item.abbr}|${item.view_plane || ''}|${item.window || ''}`;
      return !excluded.includes(key);
    });

    const subs = req.subRequirements || [];
    if (subs.length > 0) {
      const subAssessed = subs.map(sub => {
        const subExcluded = sub.excludedMatches || [];
        const subManual   = sub.manualMatches   || [];
        const subCandidates = items.filter(item => {
          const key = `${item.abbr}|${item.view_plane || ''}|${item.window || ''}`;
          return !subExcluded.includes(key);
        });
        const rawMatches = subCandidates
          .filter(item => matchesRequirement(sub, item))
          .map(item => ({ abbr: item.abbr, view: item.view_plane || '', window: item.window || '' }));
        // Merge auto + manual (manual wins on dup key — keeps the `manual: true` tag)
        const auto = groupMatches(rawMatches);
        const manualResolved = resolveManualMatches(subManual);
        const keyOf = m => `${m.abbr}|${m.view}|${m.window}`;
        const manualKeys = new Set(manualResolved.map(keyOf));
        const merged = [...manualResolved, ...auto.filter(m => !manualKeys.has(keyOf(m)))];
        return { ...sub, satisfied: merged.length > 0, matches: merged };
      });
      return { ...req, satisfied: subAssessed.every(s => s.satisfied), subAssessed, matches: [] };
    }

    // No sub-requirements — auto + manual matches
    const rawMatches = candidates
      .filter(item => matchesRequirement(req, item))
      .map(item => ({ abbr: item.abbr, view: item.view_plane || '', window: item.window || '' }));
    const auto = groupMatches(rawMatches);
    const manualResolved = resolveManualMatches(manual);
    const keyOf = m => `${m.abbr}|${m.view}|${m.window}`;
    const manualKeys = new Set(manualResolved.map(keyOf));
    const merged = [...manualResolved, ...auto.filter(m => !manualKeys.has(keyOf(m)))];
    return { ...req, satisfied: merged.length > 0, subAssessed: null, matches: merged };
  }

  return coverageRequirements.map(assessOne);
}

// Small inline indicator that shows which Library entry a requirement label
// resolves to. Helps users debug why coverage matching isn't firing as expected.
// Falls into one of three states:
//   • exact resolution → "→ <entry display name>" (greenish)
//   • no resolution    → "no library match" (amber; fuzzy fallback still runs)
//   • empty label      → nothing
function resolvedEntryIndicatorHtml(label) {
  if (!label || !String(label).trim()) return '';
  const slug = resolveToEntrySlug(label);
  if (!slug || !libraryEntries[slug]) {
    return `<span class="cov-resolved-entry cov-resolved-entry--none" title="No Library entry exactly matches this label. Coverage will fall back to fuzzy string matching.">no library match</span>`;
  }
  const e = libraryEntries[slug];
  const display = libraryEntryPrimaryLabel(e, slug);
  return `<span class="cov-resolved-entry" title="Resolves to Library entry: ${escapeHtml(slug)}">→ ${escapeHtml(display)}</span>`;
}

function resolvedLibraryEntryDisplay(label) {
  const slug = resolveToEntrySlug(label);
  if (!slug || !libraryEntries[slug]) return null;
  return libraryEntryPrimaryLabel(libraryEntries[slug], slug);
}

// Assessment view: library resolution hints appear only while hovering the status icon.
function coverageStatusIconHtml(label, satisfied, iconClass = 'cov-icon') {
  const icon = satisfied ? '✓' : '✗';
  const display = resolvedLibraryEntryDisplay(label);
  let tipHtml = '';
  if (satisfied && display) {
    tipHtml = `<span class="cov-icon-hover-tip">Resolves to Library Entry: ${escapeHtml(display)}</span>`;
  } else if (!satisfied && label && String(label).trim() && !display) {
    tipHtml = '<span class="cov-icon-hover-tip">no library match</span>';
  }
  const tipClass = tipHtml ? ' cov-icon--has-tip' : '';
  return `<span class="${iconClass}${tipClass}">${icon}${tipHtml}</span>`;
}

function covMatchTagMainHtml(m) {
  if (covMatchTagViewOnly) {
    return m.view ? escapeHtml(m.view) : '';
  }
  const mainParts = [m.abbr, m.view].filter(Boolean);
  return mainParts.length ? escapeHtml(mainParts.join(' · ')) : '';
}

function covMatchTagHtml(m, reqId, subId) {
  const mainHtml = covMatchTagMainHtml(m);
  const windowHtml = m.window
    ? `<span class="cov-match-tag-window">${mainHtml ? ' · ' : ''}${escapeHtml(m.window)}</span>`
    : '';
  const countStr = m.count > 1 ? ` ×${m.count}` : '';
  const matchKey = `${m.abbr}|${m.view}|${m.window}`;
  const subAttr = subId ? `data-sub-id="${escapeHtml(subId)}"` : '';
  const manualClass = m.manual ? ' cov-match-manual' : '';
  const manualBadge = m.manual ? `<span class="cov-match-manual-badge" title="Manually linked">🔗</span>` : '';
  return `<span class="cov-match-tag${manualClass}" data-req-id="${escapeHtml(reqId)}" ${subAttr} data-match-key="${escapeHtml(matchKey)}">${manualBadge}${mainHtml}${windowHtml}${countStr}<button class="cov-match-exclude-btn" title="Mark irrelevant">✕</button></span>`;
}

function renderCoveragePanel() {
  const panel = document.getElementById('coverage-panel');
  if (!panel) return;
  panel.innerHTML = coverageEditMode
    ? renderCoverageEditHtml()
    : renderCoverageAssessmentHtml();
  wireCoveragePanel(panel);
}

function renderCoverageAssessmentHtml() {
  const assessed = assessCoverage();
  const tasks = assessed.filter(r => r.type === 'task');
  const parts = assessed.filter(r => r.type === 'part');
  const totalSat = assessed.filter(r => r.satisfied).length;

  let html = `<div class="cov-toolbar">`;
  if (assessed.length) html += `<span class="cov-score">${totalSat}/${assessed.length}</span>`;
  html += `<div class="cov-match-display-toggle" title="How match tags are labeled">
    <button type="button" class="cov-match-display-btn${covMatchTagViewOnly ? ' cov-match-display-btn--active' : ''}" data-mode="view">View only</button>
    <button type="button" class="cov-match-display-btn${covMatchTagViewOnly ? '' : ' cov-match-display-btn--active'}" data-mode="full">Part+view</button>
  </div>`;
  html += `<button class="btn btn-secondary cov-edit-btn">Edit ✏</button></div>`;

  if (!assessed.length) {
    html += `<div class="cov-empty">No requirements defined.<br>Click Edit to add tasks and parts.</div>`;
    return html;
  }

  function excludedTagHtml(key, reqId, subId) {
    const parts = key.split('|').filter(Boolean);
    const subAttr = subId ? `data-sub-id="${escapeHtml(subId)}"` : '';
    return `<span class="cov-excluded-tag" data-req-id="${escapeHtml(reqId)}" ${subAttr} data-match-key="${escapeHtml(key)}">${escapeHtml(parts.join(' · '))}<button class="cov-match-restore-btn" title="Restore match">↩</button></span>`;
  }

  function itemHtml(r) {
    const cls = r.satisfied ? 'cov-satisfied' : 'cov-unsatisfied';
    const excluded = r.excludedMatches || [];

    let contentHtml = '';
    if (r.subAssessed && r.subAssessed.length > 0) {
      // Nested sub-requirements view
      const subRows = r.subAssessed.map(sub => {
        const subCls = sub.satisfied ? 'cov-satisfied' : 'cov-unsatisfied';
        const subExcluded = sub.excludedMatches || [];
        const subMatches = sub.satisfied
          ? sub.matches.map(m => covMatchTagHtml(m, r.id, sub.id)).join('')
          : '';
        const subExcludedHtml = (!covMatchTagViewOnly && subExcluded.length)
          ? `<span class="cov-excluded-wrap">${subExcluded.map(k => excludedTagHtml(k, r.id, sub.id)).join('')}</span>`
          : '';
        return `<div class="cov-sub-item ${subCls}">
          ${coverageStatusIconHtml(sub.label, sub.satisfied, 'cov-sub-icon')}
          <span class="cov-sub-label">${escapeHtml(sub.label)}</span>
          ${subMatches}${subExcludedHtml}
        </div>`;
      }).join('');
      contentHtml = `<div class="cov-sub-list">${subRows}</div>`;
    } else {
      // Standard single-level match tags inline with label
      const matchTags = r.satisfied
        ? r.matches.map(m => covMatchTagHtml(m, r.id, null)).join('')
        : '';
      const hintHtml = (!r.satisfied && r.type === 'part' && (r.preferredView || r.preferredWindow || r.preferredSliceThickness))
        ? `<span class="cov-hint">expected: ${escapeHtml([r.preferredView, r.preferredWindow, r.preferredSliceThickness].filter(Boolean).join(' '))}</span>`
        : '';
      const excludedHtml = (!covMatchTagViewOnly && excluded.length)
        ? `<span class="cov-excluded-wrap">${excluded.map(k => excludedTagHtml(k, r.id, null)).join('')}</span>`
        : '';
      contentHtml = `${matchTags}${hintHtml}${excludedHtml}`;
    }

    const linkBtn = r.subAssessed
      ? ''
      : `<button class="cov-link-match-btn" data-req-id="${escapeHtml(r.id)}" title="Manually link a pattern item to this requirement">+ link</button>`;

    return `<div class="cov-item ${cls}">
      ${coverageStatusIconHtml(r.label, r.satisfied, 'cov-icon')}
      <div class="cov-item-body">
        <div class="cov-item-line">
          <span class="cov-label">${escapeHtml(r.label)}</span>
          ${r.subAssessed ? '' : contentHtml}
          ${linkBtn}
        </div>
        ${r.subAssessed ? contentHtml : ''}
      </div>
    </div>`;
  }

  if (tasks.length) {
    html += `<div class="cov-section-head">Tasks</div>`;
    html += tasks.map(itemHtml).join('');
  }
  if (parts.length) {
    html += `<div class="cov-section-head">Parts</div>`;
    html += parts.map(itemHtml).join('');
  }

  // Sacrificed + Automatic below coverage (Phase 3.3)
  html += renderBelowCoverageStripHtml();

  return html;
}

function renderBelowCoverageStripHtml() {
  function listHtml(items, kind) {
    if (!items || items.length === 0) {
      return `<div class="cov-strip-empty">none</div>`;
    }
    return items.map((it, i) => {
      const chips = parseStrategyIntoChips(it.strategy || '');
      const chipHtml = chips.map(c =>
        `<span class="cov-strip-chip cov-strip-chip--${c.type}">${escapeHtml(c.text)}</span>`
      ).join('');
      return `<div class="cov-strip-item" data-kind="${kind}" data-strip-index="${i}">
        <span class="cov-strip-abbr">${escapeHtml(it.abbr || '')}</span>
        <span class="cov-strip-chips">${chipHtml}</span>
        <button class="cov-strip-restore-btn" data-kind="${kind}" data-strip-index="${i}" title="Restore to pattern">↩</button>
      </div>`;
    }).join('');
  }

  return `
    <div class="cov-strip-separator"></div>
    <div class="cov-strip-container">
      <div class="cov-strip-col">
        <div class="cov-strip-head">Sacrificed</div>
        ${listHtml(sacrificedItems, 'sacrificed')}
      </div>
      <div class="cov-strip-col">
        <div class="cov-strip-head">Automatic</div>
        ${listHtml(automaticItems, 'automatic')}
      </div>
    </div>
  `;
}

function renderCoverageEditHtml() {
  // Use canonical option lists (same as pattern editor)
  const viewVals  = ['', ...VIEW_PLANE_OPTIONS];
  const winVals   = ['', ...WINDOW_OPTIONS];
  const sliceVals = ['', ...SLICE_THICKNESS_OPTIONS];

  function makeViewSelect(id, selectedVal) {
    const opts = viewVals.map(v =>
      `<option value="${escapeHtml(v)}"${v === selectedVal ? ' selected' : ''}>${v || 'plane best seen on'}</option>`
    ).join('');
    const placeholder = !selectedVal ? ' cov-pref-placeholder-active' : '';
    return `<select class="cov-pref-view${placeholder}" data-id="${id}" data-field="preferredView">${opts}</select>`;
  }

  function makeWinSelect(id, selectedVal) {
    const opts = winVals.map(w =>
      `<option value="${escapeHtml(w)}"${w === selectedVal ? ' selected' : ''}>${w || 'window best seen on'}</option>`
    ).join('');
    const placeholder = !selectedVal ? ' cov-pref-placeholder-active' : '';
    return `<select class="cov-pref-window${placeholder}" data-id="${id}" data-field="preferredWindow">${opts}</select>`;
  }

  function makeSliceSelect(id, selectedVal) {
    const opts = sliceVals.map(s =>
      `<option value="${escapeHtml(s)}"${s === selectedVal ? ' selected' : ''}>${s || 'slice thickness best seen on'}</option>`
    ).join('');
    const placeholder = !selectedVal ? ' cov-pref-placeholder-active' : '';
    return `<select class="cov-pref-slice${placeholder}" data-id="${id}" data-field="preferredSliceThickness">${opts}</select>`;
  }

  let html = `<div class="cov-toolbar">
    <button class="btn cov-add-task-btn">+ Task</button>
    <button class="btn cov-add-part-btn">+ Part</button>
    <button class="btn cov-done-btn">✓ Done</button>
  </div>`;

  if (!coverageRequirements.length) {
    html += `<div class="cov-empty">No requirements yet. Add tasks and parts above.</div>`;
  }

  const tasks = coverageRequirements.filter(r => r.type === 'task');
  const parts = coverageRequirements.filter(r => r.type === 'part');

  function editItemHtml(r) {
    const subs = r.subRequirements || [];
    const prefHtml = r.type === 'part' ? `
      <div class="cov-prefs">
        ${makeViewSelect(r.id, r.preferredView || '')}
        ${makeWinSelect(r.id, r.preferredWindow || '')}
        ${makeSliceSelect(r.id, r.preferredSliceThickness || '')}
      </div>` : '';
    const subListHtml = subs.length ? `
      <div class="cov-sub-edit-list">
        ${subs.map(sub => `
          <div class="cov-sub-edit-item" data-sub-id="${escapeHtml(sub.id)}">
            <span class="cov-sub-bullet">└</span>
            <input class="cov-label-input cov-sub-label-input" data-parent-id="${escapeHtml(r.id)}" data-sub-id="${escapeHtml(sub.id)}" value="${escapeHtml(sub.label)}" placeholder="Sub-label...">
            ${resolvedEntryIndicatorHtml(sub.label)}
            <button class="cov-sub-del-btn" data-parent-id="${escapeHtml(r.id)}" data-sub-id="${escapeHtml(sub.id)}" title="Remove sub">✕</button>
          </div>`).join('')}
      </div>` : '';
    // Library import — only offer when the label resolves to a Library entry that has children
    const resolvedSlug = resolveToEntrySlug(r.label);
    const resolvedChildren = resolvedSlug
      ? Object.entries(libraryEntries).filter(([, e]) => (e.parents || []).includes(resolvedSlug))
      : [];
    const importBtnHtml = resolvedChildren.length
      ? `<button class="cov-import-subs-btn" data-id="${escapeHtml(r.id)}" title="Import ${resolvedChildren.length} subpart(s) from Library">↓ Import ${resolvedChildren.length} from Library</button>`
      : '';

    return `<div class="cov-edit-item" data-id="${escapeHtml(r.id)}">
      <div class="drag-handle" data-handle="true"></div>
      <span class="cov-type-badge cov-type-${r.type}">${r.type === 'task' ? 'T' : 'P'}</span>
      <div class="cov-edit-body">
        <div class="cov-edit-label-row">
          <input class="cov-label-input" data-id="${escapeHtml(r.id)}" value="${escapeHtml(r.label)}" placeholder="Label...">
          ${resolvedEntryIndicatorHtml(r.label)}
        </div>
        ${prefHtml}
        ${subListHtml}
        <div class="cov-edit-actions">
          <button class="cov-add-sub-btn" data-id="${escapeHtml(r.id)}">+ Sub</button>
          ${importBtnHtml}
        </div>
      </div>
      <button class="cov-del-btn" data-id="${escapeHtml(r.id)}" title="Remove">✕</button>
    </div>`;
  }

  if (tasks.length) {
    html += `<div class="cov-section-head">Tasks</div>`;
    html += `<div id="cov-task-list" class="cov-sortable-list">${tasks.map(editItemHtml).join('')}</div>`;
  } else {
    html += `<div id="cov-task-list" class="cov-sortable-list cov-sortable-empty"></div>`;
  }

  if (parts.length) {
    html += `<div class="cov-section-head">Parts <span class="cov-section-hint">(drag to order superior→inferior)</span></div>`;
    html += `<div id="cov-part-list" class="cov-sortable-list">${parts.map(editItemHtml).join('')}</div>`;
  } else {
    html += `<div id="cov-part-list" class="cov-sortable-list cov-sortable-empty"></div>`;
  }

  return html;
}

function wireCoveragePanel(panel) {
  // Assessment mode — edit button
  const editBtn = panel.querySelector('.cov-edit-btn');
  if (editBtn) editBtn.addEventListener('click', () => {
    coverageEditMode = true;
    renderCoveragePanel();
  });

  // Assessment mode — match tag display toggle (global)
  panel.querySelectorAll('.cov-match-display-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewOnly = btn.dataset.mode === 'view';
      if (viewOnly === covMatchTagViewOnly) return;
      covMatchTagViewOnly = viewOnly;
      renderCoveragePanel();
    });
  });

  // Assessment mode — match tag display toggle (global)
  panel.querySelectorAll('.cov-match-display-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewOnly = btn.dataset.mode === 'view';
      if (viewOnly === covMatchTagViewOnly) return;
      covMatchTagViewOnly = viewOnly;
      renderCoveragePanel();
    });
  });

  // Assessment mode — exclude match (mark irrelevant)
  panel.querySelectorAll('.cov-match-exclude-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tag = btn.closest('[data-req-id]');
      if (!tag) return;
      excludeMatch(tag.dataset.reqId, tag.dataset.matchKey, tag.dataset.subId || null);
    });
  });

  // Assessment mode — restore excluded match
  panel.querySelectorAll('.cov-match-restore-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tag = btn.closest('[data-req-id]');
      if (!tag) return;
      restoreMatch(tag.dataset.reqId, tag.dataset.matchKey, tag.dataset.subId || null);
    });
  });

  // Assessment mode — link match (opposite of exclude). Opens an in-place picker
  // of pattern items that aren't already linked to this requirement.
  panel.querySelectorAll('.cov-link-match-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showLinkMatchPopover(btn, btn.dataset.reqId);
    });
  });

  // Below-coverage strip — restore items from Sacrificed / Automatic back into the pattern
  panel.querySelectorAll('.cov-strip-restore-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.stripIndex, 10);
      if (isNaN(idx)) return;
      if (btn.dataset.kind === 'automatic') restoreFromAutomatic(idx);
      else if (btn.dataset.kind === 'sacrificed') restoreFromSacrificed(idx);
    });
  });

  // Edit mode — done
  const doneBtn = panel.querySelector('.cov-done-btn');
  if (doneBtn) doneBtn.addEventListener('click', () => {
    coverageEditMode = false;
    renderCoveragePanel();
  });

  const addTaskBtn = panel.querySelector('.cov-add-task-btn');
  if (addTaskBtn) addTaskBtn.addEventListener('click', () => addCoverageRequirement('task'));

  const addPartBtn = panel.querySelector('.cov-add-part-btn');
  if (addPartBtn) addPartBtn.addEventListener('click', () => addCoverageRequirement('part'));

  // Edit mode — delete top-level requirement
  panel.querySelectorAll('.cov-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCoverageRequirement(btn.dataset.id));
  });

  // Edit mode — add sub-requirement
  panel.querySelectorAll('.cov-add-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => addSubRequirement(btn.dataset.id));
  });

  // Edit mode — import subparts from Library (one-shot bulk-add of child entries)
  panel.querySelectorAll('.cov-import-subs-btn').forEach(btn => {
    btn.addEventListener('click', () => importSubpartsFromLibrary(btn.dataset.id));
  });

  // Edit mode — delete sub-requirement
  panel.querySelectorAll('.cov-sub-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteSubRequirement(btn.dataset.parentId, btn.dataset.subId));
  });

  // Edit mode — label input for top-level requirements
  panel.querySelectorAll('.cov-label-input:not(.cov-sub-label-input)').forEach(input => {
    input.addEventListener('change', (e) => {
      updateCoverageRequirement(e.target.dataset.id, 'label', e.target.value.trim());
      // Re-render so the resolved-Entry indicator reflects the new label
      renderCoveragePanel();
    });
  });

  // Edit mode — label input for sub-requirements
  panel.querySelectorAll('.cov-sub-label-input').forEach(input => {
    input.addEventListener('change', (e) => {
      updateSubRequirement(e.target.dataset.parentId, e.target.dataset.subId, 'label', e.target.value.trim());
      renderCoveragePanel();
    });
  });

  // Edit mode — view/window/slice preference selects
  panel.querySelectorAll('.cov-pref-view, .cov-pref-window, .cov-pref-slice').forEach(sel => {
    sel.addEventListener('change', (e) => {
      updateCoverageRequirement(e.target.dataset.id, e.target.dataset.field, e.target.value);
      // Toggle placeholder styling
      if (e.target.value) e.target.classList.remove('cov-pref-placeholder-active');
      else e.target.classList.add('cov-pref-placeholder-active');
    });
  });

  initCoverageEditSortable('cov-task-list', 'task');
  initCoverageEditSortable('cov-part-list', 'part');
}

function initCoverageEditSortable(listId, type) {
  const el = document.getElementById(listId);
  if (!el) return;
  if (el.sortableInstance) { el.sortableInstance.destroy(); el.sortableInstance = null; }
  el.sortableInstance = new Sortable(el, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    draggable: '.cov-edit-item',
    onEnd(evt) {
      if (evt.oldIndex === evt.newIndex) return;
      // Reorder within the type-specific list, then re-merge into coverageRequirements
      const typeItems = coverageRequirements.filter(r => r.type === type);
      const [moved] = typeItems.splice(evt.oldIndex, 1);
      typeItems.splice(evt.newIndex, 0, moved);
      coverageRequirements = [
        ...coverageRequirements.filter(r => r.type !== type),
        ...typeItems
      ];
      saveCoverageRequirements();
    }
  });
}

function addCoverageRequirement(type) {
  const newReq = { id: generateId(), type, label: '', preferredView: '', preferredWindow: '', preferredSliceThickness: '', subRequirements: [], excludedMatches: [] };
  coverageRequirements.push(newReq);
  saveCoverageRequirements();
  renderCoveragePanel();
  // Focus the new input
  const panel = document.getElementById('coverage-panel');
  const inputs = panel ? panel.querySelectorAll('.cov-label-input') : [];
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function deleteCoverageRequirement(id) {
  coverageRequirements = coverageRequirements.filter(r => r.id !== id);
  saveCoverageRequirements();
  renderCoveragePanel();
}

function updateCoverageRequirement(id, field, value) {
  const req = coverageRequirements.find(r => r.id === id);
  if (req) { req[field] = value; saveCoverageRequirements(); }
}

function addSubRequirement(parentId) {
  const req = coverageRequirements.find(r => r.id === parentId);
  if (!req) return;
  if (!req.subRequirements) req.subRequirements = [];
  const newSub = { id: generateId(), label: '', excludedMatches: [] };
  req.subRequirements.push(newSub);
  saveCoverageRequirements();
  renderCoveragePanel();
  setTimeout(() => {
    const panel = document.getElementById('coverage-panel');
    const inputs = panel?.querySelectorAll(`.cov-sub-label-input[data-parent-id="${CSS.escape(parentId)}"]`);
    if (inputs?.length) inputs[inputs.length - 1].focus();
  }, 20);
}

// Pull child entries from the Library and add them as sub-requirements (Phase 3.3).
// Skips children whose label is already present in the existing sub-requirement list.
function importSubpartsFromLibrary(parentId) {
  const req = coverageRequirements.find(r => r.id === parentId);
  if (!req) return;
  const parentSlug = resolveToEntrySlug(req.label);
  if (!parentSlug) return;

  if (!req.subRequirements) req.subRequirements = [];
  const existingLabelsLc = new Set(req.subRequirements.map(s => (s.label || '').trim().toLowerCase()));

  const childSlugs = Object.entries(libraryEntries)
    .filter(([, e]) => (e.parents || []).includes(parentSlug))
    .map(([slug]) => slug);

  let added = 0;
  for (const slug of childSlugs) {
    const e = libraryEntries[slug];
    const label = libraryEntryPrimaryLabel(e, slug);
    if (!label) continue;
    if (existingLabelsLc.has(label.toLowerCase())) continue;
    req.subRequirements.push({ id: generateId(), label, excludedMatches: [] });
    existingLabelsLc.add(label.toLowerCase());
    added++;
  }

  if (added > 0) {
    saveCoverageRequirements();
    renderCoveragePanel();
  }
}

function deleteSubRequirement(parentId, subId) {
  const req = coverageRequirements.find(r => r.id === parentId);
  if (!req || !req.subRequirements) return;
  req.subRequirements = req.subRequirements.filter(s => s.id !== subId);
  saveCoverageRequirements();
  renderCoveragePanel();
}

function updateSubRequirement(parentId, subId, field, value) {
  const req = coverageRequirements.find(r => r.id === parentId);
  if (!req || !req.subRequirements) return;
  const sub = req.subRequirements.find(s => s.id === subId);
  if (sub) { sub[field] = value; saveCoverageRequirements(); }
}

function excludeMatch(reqId, matchKey, subId) {
  const req = coverageRequirements.find(r => r.id === reqId);
  if (!req) return;
  if (subId) {
    const sub = (req.subRequirements || []).find(s => s.id === subId);
    if (!sub) return;
    if (!sub.excludedMatches) sub.excludedMatches = [];
    if (!sub.excludedMatches.includes(matchKey)) sub.excludedMatches.push(matchKey);
    // If user excludes a previously-manually-linked match, also drop it from manualMatches
    sub.manualMatches = (sub.manualMatches || []).filter(k => k !== matchKey);
  } else {
    if (!req.excludedMatches) req.excludedMatches = [];
    if (!req.excludedMatches.includes(matchKey)) req.excludedMatches.push(matchKey);
    req.manualMatches = (req.manualMatches || []).filter(k => k !== matchKey);
  }
  saveCoverageRequirements();
  renderCoveragePanel();
}

// Add a manual match (positive feedback — claim coverage that the matcher missed)
function addManualMatch(reqId, matchKey, subId) {
  const req = coverageRequirements.find(r => r.id === reqId);
  if (!req) return;
  if (subId) {
    const sub = (req.subRequirements || []).find(s => s.id === subId);
    if (!sub) return;
    if (!sub.manualMatches) sub.manualMatches = [];
    if (!sub.manualMatches.includes(matchKey)) sub.manualMatches.push(matchKey);
    // If the user manually links a match they previously excluded, restore it
    sub.excludedMatches = (sub.excludedMatches || []).filter(k => k !== matchKey);
  } else {
    if (!req.manualMatches) req.manualMatches = [];
    if (!req.manualMatches.includes(matchKey)) req.manualMatches.push(matchKey);
    req.excludedMatches = (req.excludedMatches || []).filter(k => k !== matchKey);
  }
  saveCoverageRequirements();
  renderCoveragePanel();
}

function removeManualMatch(reqId, matchKey, subId) {
  const req = coverageRequirements.find(r => r.id === reqId);
  if (!req) return;
  if (subId) {
    const sub = (req.subRequirements || []).find(s => s.id === subId);
    if (sub) sub.manualMatches = (sub.manualMatches || []).filter(k => k !== matchKey);
  } else {
    req.manualMatches = (req.manualMatches || []).filter(k => k !== matchKey);
  }
  saveCoverageRequirements();
  renderCoveragePanel();
}

// Build a list of in-pattern items not yet linked to this requirement (or sub).
// Returns array of { key, label } where key = `abbr|view|window`.
function getLinkableMatchesFor(reqId, subId) {
  const req = coverageRequirements.find(r => r.id === reqId);
  if (!req) return [];
  const target = subId ? (req.subRequirements || []).find(s => s.id === subId) : req;
  if (!target) return [];
  const already = new Set([
    ...((target.manualMatches || [])),
    // Don't include items already auto-matched (assessment will show them anyway)
    ...((currentPatternItems || [])
        .filter(it => !it.isOutroItem && matchesRequirement(target, it))
        .map(it => `${it.abbr}|${it.view_plane || ''}|${it.window || ''}`))
  ]);
  const seen = new Set();
  const out = [];
  for (const it of (currentPatternItems || [])) {
    if (it.isOutroItem) continue;
    const key = `${it.abbr}|${it.view_plane || ''}|${it.window || ''}`;
    if (already.has(key) || seen.has(key)) continue;
    seen.add(key);
    const labelParts = [it.abbr, it.view_plane, it.window].filter(Boolean);
    out.push({ key, label: labelParts.join(' · ') });
  }
  return out;
}

// Lightweight, inline popover for picking a pattern item to manually link.
function showLinkMatchPopover(anchorBtn, reqId, subId) {
  // Close any existing popover first
  document.querySelectorAll('.cov-link-popover').forEach(el => el.remove());

  const items = getLinkableMatchesFor(reqId, subId || null);
  const pop = document.createElement('div');
  pop.className = 'cov-link-popover';
  if (!items.length) {
    pop.innerHTML = `<div class="cov-link-popover-empty">No unlinked pattern items.</div>`;
  } else {
    pop.innerHTML = `
      <div class="cov-link-popover-title">Link a pattern item to this requirement:</div>
      <div class="cov-link-popover-list">
        ${items.map(it => `
          <button class="cov-link-popover-item" data-match-key="${escapeHtml(it.key)}">${escapeHtml(it.label)}</button>
        `).join('')}
      </div>
    `;
  }
  document.body.appendChild(pop);

  // Position next to the anchor button
  const rect = anchorBtn.getBoundingClientRect();
  pop.style.left = `${Math.min(window.innerWidth - 240, rect.left)}px`;
  pop.style.top  = `${rect.bottom + 4}px`;

  // Wire item clicks
  pop.querySelectorAll('.cov-link-popover-item').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      addManualMatch(reqId, b.dataset.matchKey, subId || null);
      pop.remove();
    });
  });

  // Dismiss on outside click
  setTimeout(() => {
    const onDoc = (ev) => {
      if (!pop.contains(ev.target)) {
        pop.remove();
        document.removeEventListener('mousedown', onDoc);
      }
    };
    document.addEventListener('mousedown', onDoc);
  }, 0);
}

function restoreMatch(reqId, matchKey, subId) {
  const req = coverageRequirements.find(r => r.id === reqId);
  if (!req) return;
  if (subId) {
    const sub = (req.subRequirements || []).find(s => s.id === subId);
    if (sub) sub.excludedMatches = (sub.excludedMatches || []).filter(k => k !== matchKey);
  } else {
    req.excludedMatches = (req.excludedMatches || []).filter(k => k !== matchKey);
  }
  saveCoverageRequirements();
  renderCoveragePanel();
}

// ─── Abbreviation registry ───────────────────────────────────────────────────

const DEFAULT_GENERAL_ABBRS = {
  // Orthopedic / extremity
  "fx":      { fullName: "fracture", note: "" },
  "displac": { fullName: "displacement", note: "" },
  "disloc":  { fullName: "dislocation", note: "" },
  "CMC":     { fullName: "carpometacarpal", note: "" },
  "MCP":     { fullName: "metacarpophalangeal", note: "" },
  "TMT":     { fullName: "tarsometatarsal", note: "" },
  "MTP":     { fullName: "metatarsophalangeal", note: "" },
  "IP":      { fullName: "proximal interphalangeal", note: "" },
  "DIP":     { fullName: "distal interphalangeal", note: "" },
  "RUE":     { fullName: "right upper extremity", note: "" },
  "LUE":     { fullName: "left upper extremity", note: "" },
  "RLE":     { fullName: "right lower extremity", note: "" },
  "LLE":     { fullName: "left lower extremity", note: "" },
  "BUE":     { fullName: "bilateral upper extremities", note: "" },
  "BLE":     { fullName: "bilateral lower extremities", note: "" },
  "UE":      { fullName: "upper extremity", note: "" },
  "LE":      { fullName: "lower extremity", note: "" },
  "DJD":     { fullName: "degenerative joint disease", note: "" },
  "CTD":     { fullName: "connective tissue disease", note: "" },
  // Abdomen / lobes / cardiac
  "RUQ":     { fullName: "right upper quadrant", note: "" },
  "RLQ":     { fullName: "right lower quadrant", note: "" },
  "LUQ":     { fullName: "left upper quadrant", note: "" },
  "LLQ":     { fullName: "left lower quadrant", note: "" },
  "RUL":     { fullName: "right upper lobe", note: "" },
  "RML":     { fullName: "right middle lobe", note: "" },
  "RLL":     { fullName: "right lower lobe", note: "" },
  "LUL":     { fullName: "left upper lobe", note: "" },
  "LLL":     { fullName: "left lower lobe", note: "" },
  "RA":      { fullName: "right atrium", note: "" },
  "RV":      { fullName: "right ventricle", note: "" },
  "LA":      { fullName: "left atrium", note: "" },
  "LV":      { fullName: "left ventricle", note: "" },
  // Arteries
  "aort":       { fullName: "aorta", note: "" },
  "PCA":        { fullName: "posterior cerebral artery", note: "" },
  "ACA":        { fullName: "anterior cerebral artery", note: "" },
  "MCA":        { fullName: "middle cerebral artery", note: "" },
  "vertebrobas":{ fullName: "V4 vertebral arteries and basilar artery", note: "" },
  "CCA":        { fullName: "common carotid artery", note: "" },
  "ICA":        { fullName: "internal carotid artery", note: "" },
  "ECA":        { fullName: "external carotid artery", note: "" },
  "CFA":        { fullName: "common femoral artery", note: "" },
  "SFA":        { fullName: "superficial femoral artery", note: "" },
  "ATA":        { fullName: "anterior tibial artery", note: "" },
  "PTA":        { fullName: "posterior tibial artery", note: "" },
  "SUBCLVA":    { fullName: "subclavian artery", note: "" },
  // Veins / AV
  "IJV":   { fullName: "internal jugular vein", note: "" },
  "SVC":   { fullName: "superior vena cava", note: "" },
  "IVC":   { fullName: "inferior vena cava", note: "" },
  "CIV":   { fullName: "common iliac vein", note: "" },
  "EIV":   { fullName: "external iliac vein", note: "" },
  "CFV":   { fullName: "common femoral vein", note: "" },
  "SFV":   { fullName: "superficial femoral vein", note: "" },
  "AV":    { fullName: "arteriovenous", note: "" },
  "AVM":   { fullName: "arteriovenous malformation", note: "" },
  "dAVF":  { fullName: "dural arteriovenous fistula", note: "" },
  // Neuro
  "pfossa": { fullName: "posterior fossa", note: "" },
  "HN":     { fullName: "head and neck", note: "" },
  "WM":     { fullName: "white matter", note: "" },
  "GM":     { fullName: "gray matter", note: "" },
  "CC":     { fullName: "corpus callosum", note: "" },
  "BG":     { fullName: "basal ganglia", note: "" },
  "LM":     { fullName: "leptomeningeal", note: "" },
  "bstem":  { fullName: "brainstem", note: "" },
  "CSF":    { fullName: "cerebrospinal fluid", note: "" },
  "SVID":   { fullName: "chronic small vessel ischemic disease", note: "" },
  "CNS":    { fullName: "central nervous system", note: "" },
  "PNS":    { fullName: "peripheral nervous system", note: "" },
  // ENT / temporal bone
  "PORP":  { fullName: "partial ossicular replacement prosthesis", note: "" },
  "TORP":  { fullName: "total ossicular replacement prosthesis", note: "" },
  "TM":    { fullName: "tympanic membrane", note: "" },
  "IAC":   { fullName: "internal auditory canal", note: "" },
  "EAC":   { fullName: "external auditory canal", note: "" },
  "Tbone": { fullName: "temporal bone", note: "" },
  "TMJ":   { fullName: "temporomandibular joint", note: "" },
  // Spine
  "TL":     { fullName: "thoracolumbar", note: "" },
  "Cspine": { fullName: "cervical spine", note: "" },
  "Tspine": { fullName: "thoracic spine", note: "" },
  "Lspine": { fullName: "lumbar spine", note: "" },
  "ID/EM":  { fullName: "intradural/extramedullary", note: "" },
  // Chest / pathology
  "PTX":      { fullName: "pneumothorax", note: "" },
  "mets":     { fullName: "metastases", note: "" },
  "ST":       { fullName: "soft tissues", note: "" },
  "athero":   { fullName: "atherosclerosis", note: "" },
  "calc":     { fullName: "calcification", note: "" },
  "adenoCa":  { fullName: "adenocarcinoma", note: "" },
  "infxn":    { fullName: "infection", note: "" },
  "dz":       { fullName: "disease", note: "" },
  "enhanc":   { fullName: "enhancement", note: "" },
  "subq":     { fullName: "subcutaneous", note: "" },
  "periph":   { fullName: "peripheral", note: "" },
  // OB
  "IUP":     { fullName: "intrauterine pregnancy", note: "" },
  "ectopic":  { fullName: "ectopic pregnancy", note: "" },
  "PUL":     { fullName: "pregnancy of unknown location", note: "" },
  "GS":      { fullName: "gestational sac", note: "" },
  "GA":      { fullName: "gestational age", note: "" },
  "CRL":     { fullName: "crown-rump length", note: "" },
  "LMP":     { fullName: "last menstrual period", note: "" },
  "RPOC":    { fullName: "retained products of conception", note: "" },
  // GI
  "IBD": { fullName: "inflammatory bowel disease", note: "" },
  "IBS": { fullName: "irritable bowel disease", note: "" },
  "SBO": { fullName: "small bowel obstruction", note: "" },
  // General modifiers
  "adj":   { fullName: "adjacent", note: "" },
  "incl":  { fullName: "including", note: "" },
  "dx":    { fullName: "diagnosis", note: "" },
  "assoc": { fullName: "associated", note: "" },
  "w/in":  { fullName: "within", note: "" },
  "w/":    { fullName: "with", note: "" },
  "w/o":   { fullName: "without", note: "" },
  // Anatomical directions / planes
  "prox":  { fullName: "proximal", note: "" },
  "dist":  { fullName: "distal", note: "" },
  "ant":   { fullName: "anterior", note: "" },
  "post":  { fullName: "posterior", note: "" },
  "sup":   { fullName: "superior", note: "" },
  "inf":   { fullName: "inferior", note: "" },
  "med":   { fullName: "medial", note: "" },
  "lat":   { fullName: "lateral", note: "" },
  "L":     { fullName: "left", note: "" },
  "R":     { fullName: "right", note: "" },
  "ax":    { fullName: "axial", note: "" },
  "cor":   { fullName: "coronal", note: "" },
  "sag":   { fullName: "sagittal", note: "" },
  "recon": { fullName: "reconstruction", note: "" },
};

function loadAbbrRegistry() {
  window.electronAPI.callAPI('get_abbr_registry', {});
  const unsub = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'get_abbr_registry') {
      unsub();
      const raw = (data.result && typeof data.result === 'object') ? data.result : {};
      // Migrate: old flat format → specific section
      if ('specific' in raw || 'general' in raw) {
        abbrRegistry = raw.specific || {};
        generalAbbrRegistry = raw.general || {};
      } else {
        abbrRegistry = raw;
        generalAbbrRegistry = {};
      }
      // Seed defaults if general section has never been populated
      if (Object.keys(generalAbbrRegistry).length === 0) {
        generalAbbrRegistry = { ...DEFAULT_GENERAL_ABBRS };
        saveAbbrRegistry();
      }
    }
  });
}

function saveAbbrRegistry() {
  window.electronAPI.callAPI('save_abbr_registry', {
    registry: { specific: abbrRegistry, general: generalAbbrRegistry }
  });
  // Adapter writes through to the Library — refresh in-memory Library so the
  // hybrid matcher and any new UI see the change immediately.
  loadLibrary();
  renderCoveragePanel();
}

// ─── Phase 3 — Library (canonical Entry store) ──────────────────────────────
function loadLibrary() {
  window.electronAPI.callAPI('get_library', {});
  const unsub = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'get_library') {
      unsub();
      const result = (data.result && typeof data.result === 'object') ? data.result : {};
      libraryEntries = (result.entries && typeof result.entries === 'object') ? result.entries : {};
      rebuildAliasIndex();
      // Coverage may re-assess now that Library is available
      try { renderCoveragePanel(); } catch (_) {}
      // If the Library dialog happens to be open, refresh it with the new data
      const overlay = document.getElementById('abbr-registry-overlay');
      if (overlay && overlay.style.display !== 'none') {
        try { renderLibrary(currentLibraryFilter()); } catch (_) {}
      } else {
        restoreLibraryDialogIfNeeded();
      }
    }
  });
}

// Irregular plurals (Latin/Greek) common in radiology. Looked up BEFORE the
// regex rules so they always win. Shape: plural → canonical singular. Both
// forms get normalized to the singular at match time, so "Foramina" and
// "Foramen" resolve to the same entry.
const IRREGULAR_PLURALS = Object.freeze({
  // Latin -us / -i
  'bronchi':    'bronchus',
  'thrombi':    'thrombus',
  'emboli':     'embolus',
  'foci':       'focus',
  'alveoli':    'alveolus',
  'humeri':     'humerus',
  'gyri':       'gyrus',
  'sulci':      'sulcus',
  'nuclei':     'nucleus',
  'menisci':    'meniscus',
  'calculi':    'calculus',
  'tarsi':      'tarsus',

  // Latin -um / -a
  'septa':       'septum',
  'ostia':       'ostium',
  'atria':       'atrium',
  'ganglia':     'ganglion',
  'mediastina':  'mediastinum',
  'antra':       'antrum',
  'diverticula': 'diverticulum',

  // Latin -en / -ina
  'foramina':   'foramen',
  'lumina':     'lumen',

  // Greek -is / -es (anatomy)
  'pelves':      'pelvis',
  'epiphyses':   'epiphysis',
  'metaphyses':  'metaphysis',
  'diaphyses':   'diaphysis',
  'apophyses':   'apophysis',
  'symphyses':   'symphysis',
  'testes':      'testis',

  // Greek -is / -es (pathology -osis/-oses, -asis/-ases, -ysis/-yses)
  'diagnoses':    'diagnosis',
  'prognoses':    'prognosis',
  'metastases':   'metastasis',
  'atelectases':  'atelectasis',
  'stenoses':     'stenosis',
  'thromboses':   'thrombosis',
  'fibroses':     'fibrosis',
  'anastomoses':  'anastomosis',
  'necroses':     'necrosis',
  'cirrhoses':    'cirrhosis',
  'scolioses':    'scoliosis',
  'kyphoses':     'kyphosis',
  'analyses':     'analysis',
  'paralyses':    'paralysis',

  // Latin -x / -ces
  'indices':     'index',
  'appendices':  'appendix',
  'vertices':    'vertex',
  'apices':      'apex',
  'cortices':    'cortex',
  'helices':     'helix',
  'fornices':    'fornix',
  'matrices':    'matrix',
  'cervices':    'cervix',

  // Latin/Greek -nx → -nges
  'thoraces':   'thorax',
  'larynges':   'larynx',
  'pharynges':  'pharynx',
  'meninges':   'meninx',
  'phalanges':  'phalanx',

  // Misc anatomy
  'corpora':   'corpus',
  'viscera':   'viscus',
  'crura':     'crus',
});

// Lightweight English stemmer for plural-insensitive matching. Tokenizes on
// whitespace, applies common singularization rules, rejoins. Intentionally
// conservative — preserves Latin -us/-is/-os endings and -ss words. Irregular
// Latin/Greek plurals are handled by the IRREGULAR_PLURALS lookup above;
// everything else falls through the regex suffix rules: arteries↔artery,
// kidneys↔kidney, vertebrae↔vertebra.
function stemEnglishToken(t) {
  if (t.length < 4) return t;
  // Irregular plurals first — beats the regex rules
  if (Object.prototype.hasOwnProperty.call(IRREGULAR_PLURALS, t)) {
    return IRREGULAR_PLURALS[t];
  }
  if (t.endsWith('ies')) return t.slice(0, -3) + 'y';                                  // arteries → artery
  if (t.endsWith('xes') || t.endsWith('ches') || t.endsWith('shes')) return t.slice(0, -2); // boxes → box, brushes → brush
  if (t.endsWith('ae'))  return t.slice(0, -1);                                        // vertebrae → vertebra
  if (t.endsWith('s')) {
    // Preserve common non-plural -s endings
    if (t.endsWith('ss') || t.endsWith('us') || t.endsWith('is') || t.endsWith('os')) return t;
    return t.slice(0, -1);                                                             // kidneys → kidney
  }
  return t;
}

function normalizeForMatch(s) {
  if (!s) return '';
  return String(s).toLowerCase().trim().split(/\s+/).map(stemEnglishToken).join(' ');
}

function rebuildAliasIndex() {
  aliasIndex = {};
  stemIndex  = {};
  const addKey = (k, slug) => {
    if (!k) return;
    if (!aliasIndex[k]) aliasIndex[k] = slug;
    const stem = normalizeForMatch(k);
    if (stem && !stemIndex[stem]) stemIndex[stem] = slug;
  };
  for (const [slug, entry] of Object.entries(libraryEntries || {})) {
    if (!entry) continue;
    // Slug itself is a lookup key
    addKey(slug.toLowerCase(), slug);
    // Aliases
    for (const a of (entry.aliases || [])) {
      if (a) addKey(String(a).trim().toLowerCase(), slug);
    }
    // Full name — requirements labeled with the human-readable name should resolve
    if (entry.fullName) addKey(String(entry.fullName).trim().toLowerCase(), slug);
  }
}

// Primary label for UI: first alias, else full name (not stored as an alias).
function libraryEntryPrimaryLabel(e, slug = '') {
  if (!e) return slug || '';
  const alias = (e.aliases && e.aliases[0]) || '';
  if (alias) return alias;
  return e.fullName || slug || '';
}

// Split compound pattern labels / requirement text on common radiology separators.
// e.g. "VertebroBas, PCAs" → ["VertebroBas", "PCAs"]; "CCA/ICA" → ["CCA", "ICA"]
const COMPOUND_LABEL_SEP = /\s*(?:->|→|[,;\/\\])\s*/;

function splitCompoundLabel(s) {
  if (!s) return [];
  const whole = String(s).trim();
  if (!whole) return [];
  const parts = whole.split(COMPOUND_LABEL_SEP).map(p => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [whole];
}

// Resolve one label segment (no compound splitting).
function resolveLabelSegmentToSlug(s) {
  if (!s) return null;
  const k = String(s).trim().toLowerCase();
  if (!k) return null;
  if (aliasIndex[k]) return aliasIndex[k];
  const stem = normalizeForMatch(s);
  if (stem && stemIndex[stem]) return stemIndex[stem];
  return null;
}

// All Library slugs resolved from a label (whole string, then each compound segment).
function resolveCompoundToEntrySlugs(s) {
  if (!s) return [];
  const slugs = [];
  const seenSeg = new Set();
  const addSeg = (seg) => {
    const key = String(seg || '').trim().toLowerCase();
    if (!key || seenSeg.has(key)) return;
    seenSeg.add(key);
    const slug = resolveLabelSegmentToSlug(seg);
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  };
  addSeg(s);
  for (const seg of splitCompoundLabel(s)) addSeg(seg);
  return slugs;
}

// Resolve a free-form abbreviation/name to a Library slug.
//   1. Whole string, then each compound segment (comma, /, \, ;, ->, →).
//   2. Per segment: exact alias / slug / fullName, then plural-insensitive stem index.
// Returns null if neither layer hits — caller falls back to fuzzy substring matching.
function resolveToEntrySlug(s) {
  const slugs = resolveCompoundToEntrySlugs(s);
  return slugs.length ? slugs[0] : null;
}

// Compute children of a slug at render time.
// `parents` is the single source of truth — children are derived by scanning
// for any entry that lists this slug in its parents array.
function childrenSlugsOf(slug) {
  if (!slug) return [];
  return Object.entries(libraryEntries)
    .filter(([, e]) => Array.isArray(e.parents) && e.parents.includes(slug))
    .map(([s]) => s);
}

// Walk ancestors (self → parents → grandparents …) breadth-first.
// Returns a Set of slugs including the starting slug.
function getAncestorSlugs(slug, maxDepth = 16) {
  const out = new Set();
  if (!slug) return out;
  const queue = [{ s: slug, d: 0 }];
  while (queue.length) {
    const { s, d } = queue.shift();
    if (out.has(s) || d > maxDepth) continue;
    out.add(s);
    const e = libraryEntries[s];
    if (!e || !Array.isArray(e.parents)) continue;
    for (const p of e.parents) queue.push({ s: p, d: d + 1 });
  }
  return out;
}

// Library-based match: does the pattern item's entry sit at-or-above the
// requirement's entry in the hierarchy? Direction is "broader satisfies
// narrower" — e.g. a pattern item `vertebrobas` satisfies a requirement
// labeled `basilar artery` because `basilar artery` lists `vertebrobas` as
// a parent (vertebrobas is anatomically broader).
// Returns true/false/null (null = could not determine; caller falls back to fuzzy).
function libraryAncestorMatch(req, item) {
  const itemSlugs = resolveCompoundToEntrySlugs(item.abbr);
  if (!itemSlugs.length) return null;               // unregistered pattern item — fall back
  const reqSlug  = resolveToEntrySlug(req.label);
  if (!reqSlug) return null;                        // unregistered requirement label — fall back
  // Walk ancestors of the REQUIREMENT (the narrower side); if any item segment
  // resolves to an ancestor (or equal), the item is broader and satisfies the requirement.
  const reqAncestors = getAncestorSlugs(reqSlug);
  return itemSlugs.some(slug => reqAncestors.has(slug));
}

// ─── Library dialog (Phase 3.4) ─────────────────────────────────────────────
// Master-detail UI over libraryEntries; the General tab keeps a simple table.

function openAbbrRegistry() {
  // Discard any sentinel rows left from cancelled add operations
  delete generalAbbrRegistry['__new_general__'];

  // Refresh from backend in case data changed externally (e.g. via another window)
  loadLibrary();

  document.getElementById('abbr-registry-overlay').style.display = 'flex';
  const search = document.getElementById('abbr-registry-search');
  if (search) { search.value = ''; search.focus(); }

  libraryActiveTab = 'entries';
  applyLibraryTabVisibility();
  renderLibrary('');
  persistLibraryDialogState();
}

function closeAbbrRegistry() {
  document.getElementById('abbr-registry-overlay').style.display = 'none';
  document.querySelectorAll('.library-ac-dropdown').forEach(d => d.style.display = 'none');
  persistLibraryDialogState();
}

function currentLibraryFilter() {
  return document.getElementById('abbr-registry-search')?.value || '';
}

function applyLibraryTabVisibility() {
  document.querySelectorAll('.library-tab-btn').forEach(btn => {
    btn.classList.toggle('library-tab-btn--active', btn.dataset.libraryTab === libraryActiveTab);
  });
  document.querySelectorAll('.library-tab-content').forEach(c => {
    c.classList.toggle('library-tab-content--active', c.dataset.libraryTab === libraryActiveTab);
  });
}

function renderLibrary(filter) {
  renderLibraryList(filter);
  // Auto-select first entry if nothing selected and entries exist
  if ((!selectedLibrarySlug || !libraryEntries[selectedLibrarySlug])) {
    const first = Object.keys(libraryEntries).sort()[0];
    selectedLibrarySlug = first || null;
  }
  renderLibraryEditPane();
  renderGeneralAbbrsTable(filter);
}

function renderLibraryList(filter) {
  const list = document.getElementById('library-list');
  if (!list) return;
  const filterLc = (filter || '').toLowerCase();

  let entries = Object.entries(libraryEntries).filter(([slug, e]) => {
    if (!filterLc) return true;
    if (slug.toLowerCase().includes(filterLc)) return true;
    if ((e.fullName || '').toLowerCase().includes(filterLc)) return true;
    return (e.aliases || []).some(a => a.toLowerCase().includes(filterLc));
  });

  if (librarySortMode === 'fullName') {
    entries.sort(([, a], [, b]) => (a.fullName || '').localeCompare(b.fullName || ''));
  } else {
    entries.sort(([, a], [, b]) => {
      return libraryEntryPrimaryLabel(a).localeCompare(libraryEntryPrimaryLabel(b));
    });
  }

  const countEl = document.getElementById('library-entry-count');
  if (countEl) countEl.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

  if (entries.length === 0) {
    list.innerHTML = '<div class="library-list-empty">No entries match.</div>';
    return;
  }

  list.innerHTML = entries.map(([slug, e]) => {
    const hasAlias = !!(e.aliases && e.aliases[0]);
    const alias = libraryEntryPrimaryLabel(e, slug);
    const isSel = slug === selectedLibrarySlug ? ' library-list-item--selected' : '';
    const typeBadge = e.type === 'task'
      ? '<span class="library-type-tag library-type-tag--task">T</span>'
      : '<span class="library-type-tag library-type-tag--anatomy">A</span>';
    const hasChildren = Object.values(libraryEntries).some(other => (other.parents || []).includes(slug));
    const hasParents = (e.parents || []).length > 0;
    const hierIcon = hasChildren && hasParents ? '↕' : (hasChildren ? '↧' : (hasParents ? '↥' : ''));
    return `<div class="library-list-item${isSel}" data-slug="${escapeHtml(slug)}">
      ${typeBadge}
      <span class="library-list-alias">${escapeHtml(alias)}</span>
      <span class="library-list-fullname">${escapeHtml(hasAlias ? (e.fullName || '') : '')}</span>
      ${hierIcon ? `<span class="library-list-hier" title="hierarchy">${hierIcon}</span>` : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.library-list-item').forEach(row => {
    row.addEventListener('click', () => {
      selectedLibrarySlug = row.dataset.slug;
      renderLibraryList(currentLibraryFilter());
      renderLibraryEditPane();
      persistLibraryDialogState();
    });
  });
}

function renderLibraryEditPane() {
  const pane = document.getElementById('library-edit-pane');
  if (!pane) return;
  const slug = selectedLibrarySlug;
  if (!slug || !libraryEntries[slug]) {
    pane.innerHTML = '<div class="library-edit-empty">Select an entry to edit, or click <strong>+ Add Entry</strong>.</div>';
    return;
  }
  const e = libraryEntries[slug];

  function defaultSelectHtml(kind, val) {
    const options = kind === 'view' ? VIEW_PLANE_OPTIONS :
                    kind === 'window' ? WINDOW_OPTIONS :
                    SLICE_THICKNESS_OPTIONS;
    const id = `library-default-${kind}`;
    return `<select id="${id}" class="library-input library-input--small">
      <option value="">—</option>
      ${options.map(o => `<option value="${escapeHtml(o)}"${o === val ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}
    </select>`;
  }

  function chipHtml(text, idx, kind) {
    return `<span class="library-chip" data-chip-kind="${kind}" data-chip-index="${idx}">${escapeHtml(text)}<button class="library-chip-x" data-chip-index="${idx}" title="Remove">×</button></span>`;
  }

  function refChipHtml(refSlug, idx, kind) {
    const r = libraryEntries[refSlug];
    const label = r ? libraryEntryPrimaryLabel(r, refSlug) : `${refSlug} (missing)`;
    const missing = r ? '' : ' library-chip--missing';
    return `<span class="library-chip library-chip--ref${missing}" data-chip-kind="${kind}" data-chip-index="${idx}" data-slug="${escapeHtml(refSlug)}">${escapeHtml(label)}<button class="library-chip-x" data-chip-index="${idx}" title="Remove">×</button></span>`;
  }

  pane.innerHTML = `
    <div class="library-edit-form">
      <div class="library-edit-header-row">
        <span class="library-slug" title="Entry ID">${escapeHtml(slug)}</span>
        <div class="library-edit-type-toggle">
          <button class="library-type-btn${e.type === 'anatomy' ? ' library-type-btn--active' : ''}" data-type="anatomy">Anatomy</button>
          <button class="library-type-btn${e.type === 'task' ? ' library-type-btn--active' : ''}" data-type="task">Task</button>
        </div>
        <button id="library-delete-entry-btn" class="library-delete-btn" title="Delete entry">✕</button>
      </div>

      <label class="library-edit-row">
        <span class="library-label">Full Name</span>
        <input type="text" class="library-input" id="library-fullname" value="${escapeHtml(e.fullName || '')}" placeholder="e.g. basilar artery">
      </label>

      <div class="library-edit-row">
        <span class="library-label">Aliases <em>(abbreviations &amp; synonyms)</em></span>
        <div class="library-chips" id="library-aliases-chips">${(e.aliases || []).map((a, i) => chipHtml(a, i, 'alias')).join('')}</div>
        <input type="text" class="library-chip-input" id="library-alias-input" placeholder="Add alias and press Enter…">
      </div>

      <div class="library-edit-row">
        <span class="library-label">Parents <em>(this is a part of…)</em></span>
        <div class="library-chips" id="library-parents-chips">${(e.parents || []).map((p, i) => refChipHtml(p, i, 'parents')).join('')}</div>
        <div class="library-autocomplete-wrap">
          <input type="text" class="library-chip-input" id="library-parent-input" placeholder="Add parent entry…">
          <div class="library-ac-dropdown" id="library-parent-ac" style="display:none;"></div>
        </div>
      </div>

      <div class="library-edit-row">
        <span class="library-label">Children <em>(constituent parts/tasks — computed from each child's Parents)</em></span>
        <div class="library-chips" id="library-children-chips">${childrenSlugsOf(slug).map((c, i) => refChipHtml(c, i, 'children')).join('')}</div>
        <div class="library-autocomplete-wrap">
          <input type="text" class="library-chip-input" id="library-child-input" placeholder="Add child entry…">
          <div class="library-ac-dropdown" id="library-child-ac" style="display:none;"></div>
        </div>
      </div>

      <div class="library-edit-row">
        <span class="library-label">Flows To <em>(naturally followed by…)</em></span>
        <div class="library-chips" id="library-flowsto-chips">${(e.flowsTo || []).map((f, i) => refChipHtml(f, i, 'flowsTo')).join('')}</div>
        <div class="library-autocomplete-wrap">
          <input type="text" class="library-chip-input" id="library-flowsto-input" placeholder="Add follow-on entry…">
          <div class="library-ac-dropdown" id="library-flowsto-ac" style="display:none;"></div>
        </div>
      </div>

      <div class="library-edit-row library-defaults-row">
        <span class="library-label">Defaults</span>
        <div class="library-defaults-grid">
          <label class="library-default-field">
            <span>view</span>
            ${defaultSelectHtml('view', e.defaultView || '')}
          </label>
          <label class="library-default-field">
            <span>window</span>
            ${defaultSelectHtml('window', e.defaultWindow || '')}
          </label>
          <label class="library-default-field">
            <span>slice</span>
            ${defaultSelectHtml('slice', e.defaultSliceThickness || '')}
          </label>
          <label class="library-default-field library-default-field--strategy">
            <span>strategy</span>
            <input type="text" class="library-input library-input--small" id="library-default-strategy" value="${escapeHtml(e.defaultStrategy || '')}" placeholder="default strategy">
          </label>
        </div>
      </div>

      <label class="library-edit-row">
        <span class="library-label">Image <em>(relative path under data/library/images/)</em></span>
        <input type="text" class="library-input" id="library-image" value="${escapeHtml(e.image || '')}" placeholder="e.g. images/basilar.png">
      </label>

      <label class="library-edit-row">
        <span class="library-label">Note</span>
        <textarea class="library-input library-textarea" id="library-note" placeholder="Clinical context, mnemonics, etc.">${escapeHtml(e.note || '')}</textarea>
      </label>
    </div>
  `;

  wireLibraryEditPane(slug);
}

function wireLibraryEditPane(slug) {
  // Type toggle
  document.querySelectorAll('#library-edit-pane .library-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      libraryEntries[slug].type = btn.dataset.type;
      scheduleLibrarySave();
      renderLibraryEditPane();
      renderLibraryList(currentLibraryFilter());
    });
  });

  // Delete
  document.getElementById('library-delete-entry-btn')?.addEventListener('click', () => deleteLibraryEntry(slug));

  // Simple text/textarea/select fields
  const wireField = (id, field) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      libraryEntries[slug][field] = el.value;
      scheduleLibrarySave();
      if (field === 'fullName') renderLibraryList(currentLibraryFilter());
    });
  };
  wireField('library-fullname',         'fullName');
  wireField('library-image',            'image');
  wireField('library-default-strategy', 'defaultStrategy');
  wireField('library-note',             'note');
  wireField('library-default-view',     'defaultView');
  wireField('library-default-window',   'defaultWindow');
  wireField('library-default-slice',    'defaultSliceThickness');

  // Aliases — free-text chips
  wireAliasChips(slug);

  // Parents / flowsTo — slug-reference chips with autocomplete (stored on the entry)
  wireRefChips(slug, 'parents',  'library-parents-chips',  'library-parent-input',   'library-parent-ac');
  wireRefChips(slug, 'flowsTo',  'library-flowsto-chips',  'library-flowsto-input',  'library-flowsto-ac');

  // Children — virtual field: mutations are applied to the OTHER entry's `parents`,
  // keeping `parents` as the single source of truth for the hierarchy.
  wireChildrenChips(slug, 'library-children-chips', 'library-child-input', 'library-child-ac');
}

function wireChildrenChips(parentSlug, chipsId, inputId, acId) {
  const container = document.getElementById(chipsId);
  const input = document.getElementById(inputId);
  const ac = document.getElementById(acId);
  if (!container || !input || !ac) return;

  // Remove chip → unparent the child
  container.querySelectorAll('.library-chip-x').forEach(btn => {
    btn.addEventListener('click', () => {
      const childSlug = btn.parentElement?.dataset.slug;
      if (!childSlug || !libraryEntries[childSlug]) return;
      libraryEntries[childSlug].parents = (libraryEntries[childSlug].parents || [])
        .filter(p => p !== parentSlug);
      scheduleLibrarySave();
      renderLibraryEditPane();
      renderLibraryList(currentLibraryFilter());
    });
  });

  const updateAC = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { ac.innerHTML = ''; ac.style.display = 'none'; return; }
    // Exclude self and current children
    const exclude = new Set([parentSlug, ...childrenSlugsOf(parentSlug)]);
    const matches = Object.entries(libraryEntries)
      .filter(([s]) => !exclude.has(s))
      .filter(([s, ee]) => {
        if (s.toLowerCase().includes(q)) return true;
        if ((ee.fullName || '').toLowerCase().includes(q)) return true;
        return (ee.aliases || []).some(a => a.toLowerCase().includes(q));
      })
      .slice(0, 8);
    if (matches.length === 0) { ac.style.display = 'none'; return; }
    ac.innerHTML = matches.map(([s, ee]) => {
      const label = libraryEntryPrimaryLabel(ee, s);
      const sub = (ee.fullName && ee.fullName !== label) ? `<span class="library-ac-sub">${escapeHtml(ee.fullName)}</span>` : '';
      return `<button class="library-ac-item" data-slug="${escapeHtml(s)}">${escapeHtml(label)}${sub}</button>`;
    }).join('');
    ac.style.display = 'block';
    ac.querySelectorAll('.library-ac-item').forEach(b => {
      b.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        const childSlug = b.dataset.slug;
        if (!libraryEntries[childSlug]) return;
        if (!Array.isArray(libraryEntries[childSlug].parents)) libraryEntries[childSlug].parents = [];
        if (!libraryEntries[childSlug].parents.includes(parentSlug)) {
          libraryEntries[childSlug].parents.push(parentSlug);
        }
        scheduleLibrarySave();
        ac.style.display = 'none';
        renderLibraryEditPane();
        renderLibraryList(currentLibraryFilter());
      });
    });
  };

  input.addEventListener('input', updateAC);
  input.addEventListener('focus', updateAC);
  input.addEventListener('blur', () => setTimeout(() => { ac.style.display = 'none'; }, 150));
}

function wireAliasChips(slug) {
  const container = document.getElementById('library-aliases-chips');
  const input = document.getElementById('library-alias-input');
  if (!container || !input) return;

  container.querySelectorAll('.library-chip-x').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.chipIndex, 10);
      if (!libraryEntries[slug].aliases) libraryEntries[slug].aliases = [];
      libraryEntries[slug].aliases.splice(i, 1);
      scheduleLibrarySave();
      renderLibraryEditPane();
      renderLibraryList(currentLibraryFilter());
    });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    if (!libraryEntries[slug].aliases) libraryEntries[slug].aliases = [];
    // Case-insensitive dedup — "Basilar Artery" and "basilar artery" are the same alias
    const vLc = v.toLowerCase();
    if (libraryEntries[slug].aliases.some(a => String(a).toLowerCase() === vLc)) {
      input.value = '';
      return;
    }
    libraryEntries[slug].aliases.push(v);
    scheduleLibrarySave();
    renderLibraryEditPane();
    renderLibraryList(currentLibraryFilter());
    setTimeout(() => document.getElementById('library-alias-input')?.focus(), 0);
  });
}

function wireRefChips(slug, field, chipsId, inputId, acId) {
  const container = document.getElementById(chipsId);
  const input = document.getElementById(inputId);
  const ac = document.getElementById(acId);
  if (!container || !input || !ac) return;

  container.querySelectorAll('.library-chip-x').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.chipIndex, 10);
      if (!libraryEntries[slug][field]) libraryEntries[slug][field] = [];
      libraryEntries[slug][field].splice(i, 1);
      scheduleLibrarySave();
      renderLibraryEditPane();
    });
  });

  const updateAC = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { ac.innerHTML = ''; ac.style.display = 'none'; return; }
    const current = new Set([slug, ...(libraryEntries[slug][field] || [])]);
    const matches = Object.entries(libraryEntries)
      .filter(([s]) => !current.has(s))
      .filter(([s, ee]) => {
        if (s.toLowerCase().includes(q)) return true;
        if ((ee.fullName || '').toLowerCase().includes(q)) return true;
        return (ee.aliases || []).some(a => a.toLowerCase().includes(q));
      })
      .slice(0, 8);
    if (matches.length === 0) { ac.style.display = 'none'; return; }
    ac.innerHTML = matches.map(([s, ee]) => {
      const label = libraryEntryPrimaryLabel(ee, s);
      const sub = (ee.fullName && ee.fullName !== label) ? `<span class="library-ac-sub">${escapeHtml(ee.fullName)}</span>` : '';
      return `<button class="library-ac-item" data-slug="${escapeHtml(s)}">${escapeHtml(label)}${sub}</button>`;
    }).join('');
    ac.style.display = 'block';
    ac.querySelectorAll('.library-ac-item').forEach(b => {
      b.addEventListener('mousedown', (ev) => {  // mousedown so it fires before blur
        ev.preventDefault();
        const ref = b.dataset.slug;
        if (!libraryEntries[slug][field]) libraryEntries[slug][field] = [];
        if (!libraryEntries[slug][field].includes(ref)) {
          libraryEntries[slug][field].push(ref);
        }
        scheduleLibrarySave();
        ac.style.display = 'none';
        renderLibraryEditPane();
      });
    });
  };

  input.addEventListener('input', updateAC);
  input.addEventListener('focus', updateAC);
  input.addEventListener('blur', () => setTimeout(() => { ac.style.display = 'none'; }, 150));
}

function scheduleLibrarySave() {
  if (_libSaveTimeout) clearTimeout(_libSaveTimeout);
  _libSaveTimeout = setTimeout(() => {
    _libSaveTimeout = null;
    saveLibraryToBackend();
  }, 250);
}

function saveLibraryToBackend() {
  persistLibraryDialogState();
  window.electronAPI.callAPI('save_library', {
    entries: libraryEntries,
    generalAbbrs: generalAbbrRegistry
  });
  // Keep the alias index and the legacy `abbrRegistry` adapter view in sync
  rebuildAliasIndex();
  loadAbbrRegistry();
  renderCoveragePanel();
}

function addLibraryEntry() {
  let base = 'new_entry';
  let slug = base;
  let n = 1;
  while (libraryEntries[slug]) { n++; slug = `${base}_${n}`; }
  libraryEntries[slug] = {
    type: 'anatomy',
    fullName: '',
    aliases: [],
    parents: [],
    flowsTo: [],
    defaultView: '',
    defaultWindow: '',
    defaultSliceThickness: '',
    defaultStrategy: '',
    image: '',
    note: ''
  };
  selectedLibrarySlug = slug;
  saveLibraryToBackend();
  renderLibraryList(currentLibraryFilter());
  renderLibraryEditPane();
  setTimeout(() => document.getElementById('library-fullname')?.focus(), 30);
}

function deleteLibraryEntry(slug) {
  if (!libraryEntries[slug]) return;
  const label = libraryEntryPrimaryLabel(libraryEntries[slug], slug);
  if (!confirm(`Delete Library entry "${label}"?`)) return;
  // Remove from any other entry's parents/flowsTo references
  for (const [s, e] of Object.entries(libraryEntries)) {
    if (s === slug) continue;
    if (Array.isArray(e.parents) && e.parents.includes(slug)) {
      e.parents = e.parents.filter(p => p !== slug);
    }
    if (Array.isArray(e.flowsTo) && e.flowsTo.includes(slug)) {
      e.flowsTo = e.flowsTo.filter(f => f !== slug);
    }
  }
  delete libraryEntries[slug];
  if (selectedLibrarySlug === slug) selectedLibrarySlug = null;
  saveLibraryToBackend();
  renderLibraryList(currentLibraryFilter());
  renderLibraryEditPane();
}

// ─── General Abbreviations tab (Phase 3.4) ─────────────────────────────────
function renderGeneralAbbrsTable(filter) {
  const tbody = document.getElementById('abbr-registry-tbody-general');
  if (!tbody) return;
  const filterLc = (filter || '').toLowerCase();

  const entries = Object.entries(generalAbbrRegistry)
    .filter(([k, v]) => {
      if (!filterLc) return true;
      if (k.toLowerCase().includes(filterLc)) return true;
      return (v && (v.fullName || '').toLowerCase().includes(filterLc));
    })
    .sort(([a], [b]) => a.localeCompare(b));

  tbody.innerHTML = entries.map(([abbr, val]) => `
    <tr data-abbr="${escapeHtml(abbr)}">
      <td><input class="library-general-key" type="text" value="${escapeHtml(abbr)}" placeholder="ABBR"></td>
      <td><input class="library-general-fullname" type="text" value="${escapeHtml(val.fullName || '')}" placeholder="Full name"></td>
      <td><input class="library-general-note" type="text" value="${escapeHtml(val.note || '')}" placeholder="Note"></td>
      <td><button class="library-general-del" title="Remove">✕</button></td>
    </tr>`
  ).join('');

  // Per-row wiring — same closure pattern used elsewhere
  tbody.querySelectorAll('tr').forEach(tr => {
    const rowAbbr = tr.dataset.abbr;

    tr.querySelector('.library-general-key')?.addEventListener('change', (e) => {
      const newAbbr = e.target.value.trim();
      const f = currentLibraryFilter();
      if (!newAbbr) {
        delete generalAbbrRegistry[rowAbbr];
        saveLibraryToBackend();
        renderGeneralAbbrsTable(f);
        return;
      }
      if (newAbbr === rowAbbr) return;
      generalAbbrRegistry[newAbbr] = generalAbbrRegistry[rowAbbr] || { fullName: '', note: '' };
      delete generalAbbrRegistry[rowAbbr];
      saveLibraryToBackend();
      renderGeneralAbbrsTable(f);
    });

    tr.querySelector('.library-general-fullname')?.addEventListener('change', (e) => {
      if (!generalAbbrRegistry[rowAbbr]) generalAbbrRegistry[rowAbbr] = { fullName: '', note: '' };
      generalAbbrRegistry[rowAbbr].fullName = e.target.value.trim();
      saveLibraryToBackend();
    });

    tr.querySelector('.library-general-note')?.addEventListener('change', (e) => {
      if (!generalAbbrRegistry[rowAbbr]) generalAbbrRegistry[rowAbbr] = { fullName: '', note: '' };
      generalAbbrRegistry[rowAbbr].note = e.target.value.trim();
      saveLibraryToBackend();
    });

    tr.querySelector('.library-general-del')?.addEventListener('click', () => {
      delete generalAbbrRegistry[rowAbbr];
      saveLibraryToBackend();
      renderGeneralAbbrsTable(currentLibraryFilter());
    });
  });
}

function addGeneralAbbreviation() {
  const sentinel = '__new_general__';
  delete generalAbbrRegistry[sentinel];
  generalAbbrRegistry[sentinel] = { fullName: '', note: '' };
  const search = document.getElementById('abbr-registry-search');
  if (search) search.value = '';
  renderGeneralAbbrsTable('');
  setTimeout(() => {
    const row = document.querySelector(`#abbr-registry-tbody-general tr[data-abbr="${CSS.escape(sentinel)}"]`);
    const input = row?.querySelector('.library-general-key');
    if (input) { input.value = ''; input.focus(); input.select(); }
  }, 20);
}

// Stub kept so any stale references don't crash; new code uses renderLibrary().
function renderAbbrRegistryDialog(filter) {
  renderLibrary(filter);
}

// ─── Library dialog wiring (Phase 3.4) ─────────────────────────────────────
function initAbbrRegistrySearch() {
  // Search input — filters both the Library list and the General table
  const search = document.getElementById('abbr-registry-search');
  if (search) {
    search.addEventListener('input', (e) => {
      const f = e.target.value;
      renderLibraryList(f);
      renderGeneralAbbrsTable(f);
      persistLibraryDialogState();
    });
  }

  // Tab switching (entries ⇄ general)
  document.querySelectorAll('.library-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      libraryActiveTab = btn.dataset.libraryTab;
      applyLibraryTabVisibility();
      persistLibraryDialogState();
    });
  });

  // Sort toggle (Alias ⇄ Full Name)
  const sortBtn = document.getElementById('library-sort-toggle');
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      librarySortMode = librarySortMode === 'alias' ? 'fullName' : 'alias';
      sortBtn.textContent = `Sort: ${librarySortMode === 'alias' ? 'Alias' : 'Full Name'}`;
      renderLibraryList(currentLibraryFilter());
      persistLibraryDialogState();
    });
  }

  // + Add Entry (Library)
  document.getElementById('library-add-entry-btn')?.addEventListener('click', addLibraryEntry);

  // + Add General Abbreviation
  document.getElementById('library-general-add-btn')?.addEventListener('click', addGeneralAbbreviation);
}
