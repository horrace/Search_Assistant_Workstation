// DOM Elements
const patternSelector = document.getElementById('pattern-selector');
const newPatternBtn = document.getElementById('new-pattern-btn');
const backBtn = document.getElementById('back-btn');
const patternItems = document.getElementById('pattern-items');
const partsBankItems = document.getElementById('parts-bank-items');
const contextMenu = document.getElementById('context-menu');
const newPatternDialog = document.getElementById('new-pattern-dialog');
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
const chunkAssignCurrentId = document.getElementById('chunk-assign-current-id');
const chunkAssignSelect = document.getElementById('chunk-assign-select');
const chunkAssignNewIdInput = document.getElementById('chunk-assign-new-id');
const chunkAssignDialogOkBtn = document.getElementById('chunk-assign-dialog-ok-btn');
const chunkAssignDialogCancelBtn = document.getElementById('chunk-assign-dialog-cancel-btn');

// State
let patterns = [];
let currentPattern = '';
let currentPatternItems = [];
let partsBankList = [];
let selectedIndex = -1;
let selectedIndices = [];
let multiSelectionMode = false;
let contextMenuTargetIndex = -1;
let chunkFirstItemIndex = -1; // Keep track of first item in chunk creation
let contextMenuTargetRenderedIndex = -1;
let contextMenuTargetIsChapter = false;
let contextMenuTargetChapterName = '';
let contextMenuTargetSpecificIndex = -1;
let chapterDialogContext = null;
let contextMenuTargetIsChunkContainer = false; 
let contextMenuTargetChunkId = null; 
let chunkAssignmentContext = null; // For storing context for the chunk assignment dialog
let isDragging = false; // Declare isDragging

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
      console.log('Received API response in editor:', data);
      
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
  
  // Send request to backend
  window.electronAPI.callAPI('get_pattern', { pattern_name: patternName });
  
  // Listen for response
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    console.log('Received pattern data response:', data);
    
    // Only process responses for this pattern request
    if (data && data.responseFor === 'get_pattern') {
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
        
        // Filter out duplicate items (by abbr)
        const seenAbbrs = new Set();
        currentPatternItems = data.result.filter(item => {
          const abbr = item.abbr;
          if (seenAbbrs.has(abbr)) {
            console.log(`Filtered out duplicate item: ${abbr}`);
            return false;
          }
          seenAbbrs.add(abbr);
          return true;
        }).map(item => ({
          ...item
        }));
        
        renderPatternItems();
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

// Render the pattern items
function renderPatternItems() {
  if (!currentPatternItems || currentPatternItems.length === 0) {
    patternItems.innerHTML = '<div class="loading-indicator">No items in this pattern</div>';
    return;
  }

  let html = '';
  let currentChapter = ''; // Initialize to empty string instead of null
  let itemIndexCounter = 0; // Index in the currentPatternItems array
  let renderedItemIndex = 0; // Visual index counter for rendered elements

  while (itemIndexCounter < currentPatternItems.length) {
    const item = currentPatternItems[itemIndexCounter];
    const itemChapter = item.chapter || ''; // Treat undefined/null chapter as empty string

    // --- Chapter Boundary Check ---
    if (itemChapter !== (currentChapter === null ? '' : currentChapter)) {
      // Close previous chapter container if one was open (and it was a named chapter)
      if (currentChapter !== null && currentChapter !== '') {
        html += `</div></div>`; // Close chapter-items and chapter-container
      }
      currentChapter = itemChapter;
      // Open new chapter container if the new chapter has a name
      if (currentChapter) {
        html += `
          <div class="chapter-container draggable-item" data-chapter-name="${currentChapter}" data-rendered-index="${renderedItemIndex}" data-is-chapter="true">
            <div class="chapter-header">
              <div class="drag-handle" data-handle="true"></div>
              <span class="chapter-label">${currentChapter}</span>
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
                 <span>Chunk ${chunkID}</span>
              </div>
              <div class="chunk-items">
          `;

          chunkItemsInOrder.forEach((chunkItem, chunkIdx) => {
            const chunkItemActualIndex = chunkIndices[chunkIdx];
            const chunkItemView = chunkItem.view_plane || 'ax';
            html += `
              <div class="chunk-item-part" data-chunk-index="${chunkItemActualIndex}">
                <div class="item-view">
                  <select class="item-view-select" data-index="${chunkItemActualIndex}">
                    <option value="ax" ${chunkItemView === 'ax' ? 'selected' : ''}>ax</option>
                    <option value="cor" ${chunkItemView === 'cor' ? 'selected' : ''}>cor</option>
                    <option value="sag" ${chunkItemView === 'sag' ? 'selected' : ''}>sag</option>
                  </select>
                </div>
                <div class="item-abbr" contenteditable="true" data-field="abbr" data-index="${chunkItemActualIndex}">${chunkItem.abbr || ''}</div>
                <div class="item-strategy" contenteditable="true" data-field="strategy" data-index="${chunkItemActualIndex}">${chunkItem.strategy || ''}</div>
              </div>
            `;
          });

          html += `
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
      html += `
        <div
          class="draggable-item ${isSelected ? 'selected' : ''}"
          data-item-index="${itemIndexCounter}"
          data-rendered-index="${renderedItemIndex}"
          data-is-chunk="false"
          data-is-chapter="false" /* Mark as not a chapter container */
          data-parent-chapter="${currentChapter || ''}"
          >
          <div class="item-content">
            <div class="drag-handle" data-handle="true"></div>
            <div class="item-view">
              <select class="item-view-select" data-index="${itemIndexCounter}">
                <option value="ax" ${item.view_plane === 'ax' ? 'selected' : ''}>ax</option>
                <option value="cor" ${item.view_plane === 'cor' ? 'selected' : ''}>cor</option>
                <option value="sag" ${item.view_plane === 'sag' ? 'selected' : ''}>sag</option>
              </select>
            </div>
            <div class="item-abbr" contenteditable="true" data-field="abbr" data-index="${itemIndexCounter}">${item.abbr || ''}</div>
            <div class="item-strategy" contenteditable="true" data-field="strategy" data-index="${itemIndexCounter}">${item.strategy || ''}</div>
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
    onEnd: handleSortEnd // Use the shared handler (will be implemented next)
  };

  // Main sortable handles chapters and items *outside* chapters
  window.mainSortableInstance = new Sortable(patternItems, {
    ...sortableOptions,
    draggable: '.draggable-item', // Can drag chapters, chunks, and single items at top level
    filter: '.chapter-items, .chunk-items', // Prevent dragging *from* inner containers at top level
  });

  // Initialize sortable for each chapter's item container
  document.querySelectorAll('.chapter-items.sortable-group').forEach(group => {
    group.sortableInstance = new Sortable(group, {
      ...sortableOptions,
      draggable: '.draggable-item:not(.chapter-container)', // Items within the chapter
      ghostClass: 'sortable-ghost-inner', // Different ghost class
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
    editableField.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    editableField.addEventListener('touchstart', (e) => { e.stopPropagation(); });
  });

  // Add change listener for the view dropdowns
  document.querySelectorAll('.item-view-select').forEach(selectElement => {
    selectElement.addEventListener('change', handleViewChange);
    selectElement.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    selectElement.addEventListener('touchstart', (e) => { e.stopPropagation(); });
  });

   // Setup drop zones AFTER rendering
   setupPatternDropZone(); // Ensure this is called
}

// Handle context menu
function handleContextMenu(e) {
  e.preventDefault();
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
        // targetDataIndex for a regular item within a chunk is its own index
        contextMenuTargetIndex = contextMenuTargetSpecificIndex;
    }
    console.log(`Context menu on ITEM WITHIN CHUNK: SpecificIndex=${contextMenuTargetSpecificIndex}, ChunkID=${contextMenuTargetChunkId}, Chapter='${contextMenuTargetChapterName}'`);
  } else {
    // 2. If not an item within a chunk, evaluate currentTargetElement (the .draggable-item)
    if (currentTargetElement.dataset.isChapter === 'true') {
        isChapterContext = true;
        contextMenuTargetIsChapter = true;
        contextMenuTargetChapterName = currentTargetElement.dataset.chapterName;
        contextMenuTargetIndex = currentPatternItems.findIndex(item => (item.chapter || '') === contextMenuTargetChapterName);
        console.log(`Context menu on CHAPTER: Name='${contextMenuTargetChapterName}', FirstItemIndex=${contextMenuTargetIndex}`);
    } else if (currentTargetElement.classList.contains('chunk-container')) {
        isChunkContainerContext = true;
        contextMenuTargetIsChunkContainer = true;
        contextMenuTargetIndex = parseInt(currentTargetElement.getAttribute('data-item-index')); // Index of first item in chunk
        contextMenuTargetChunkId = parseInt(currentTargetElement.dataset.chunkId);
        contextMenuTargetChapterName = currentTargetElement.dataset.parentChapter || '';
        console.log(`Context menu on CHUNK CONTAINER: ChunkID=${contextMenuTargetChunkId}, DataIndex=${contextMenuTargetIndex}, Chapter='${contextMenuTargetChapterName}'`);
    } else { // Standalone regular item (not a chapter, not a chunk container)
        isRegularItemContext = true;
        contextMenuTargetIndex = parseInt(currentTargetElement.getAttribute('data-item-index'));
        contextMenuTargetSpecificIndex = contextMenuTargetIndex; // For standalone item, specific is same as target
        contextMenuTargetChapterName = currentTargetElement.dataset.parentChapter || '';
        // Check if this standalone item happens to be part of a chunk (data inconsistency or different rendering path)
        const item = currentPatternItems[contextMenuTargetSpecificIndex];
        if (item && item.chunkID > 0) {
            contextMenuTargetChunkId = item.chunkID;
        }
        console.log(`Context menu on STANDALONE ITEM: SpecificIndex=${contextMenuTargetSpecificIndex}, Chapter='${contextMenuTargetChapterName}', ChunkID=${contextMenuTargetChunkId}`);
    }
  }

  // --- Build Context Menu Items ---
  let menuItems = [];
  const itemForActions = (contextMenuTargetSpecificIndex !== -1 && contextMenuTargetSpecificIndex < currentPatternItems.length)
                         ? currentPatternItems[contextMenuTargetSpecificIndex]
                         : ((contextMenuTargetIndex !== -1 && contextMenuTargetIndex < currentPatternItems.length && !isChapterContext) ? currentPatternItems[contextMenuTargetIndex] : null);


  if (isChapterContext) {
      menuItems.push({ text: `Rename Chapter \"${contextMenuTargetChapterName}\"`, action: 'rename_chapter', enabled: true });
      menuItems.push({ text: `Delete Chapter \"${contextMenuTargetChapterName}\" (and contents)`, action: 'delete_chapter', enabled: true });
      menuItems.push({ text: '---', action: 'separator', enabled: false });
      menuItems.push({ text: 'Add New Item to Chapter', action: 'add_item_to_chapter', enabled: true });
  } else if (isChunkContainerContext) {
      // Menu for the chunk container itself
      // "Rename Chunk" is removed as per request. Will be handled by direct edit later.
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
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
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
       if (specificItemIdx !== -1) setChunkFirstItem(specificItemIdx);
       else console.warn("Create chunk first: specificItemIdx was -1");
      break;
    case 'create_chunk_last':
      // This action originates from right-clicking an item to be the last. specificItemIdx is that item.
      if (specificItemIdx !== -1) createChunkWithRange(specificItemIdx);
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
    // 'rename_chunk' case removed
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
      case 'rename_chapter':
          if (isChapTarget && chapName) {
              renameChapter(chapName);
          } else {
              console.error("Rename chapter: Target was not a chapter or chapter name is missing.");
          }
          break;
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
            const insertAtIndexChapter = calculateInsertionIndex(baseIndexForNewChapter, isChapTarget, true, isChunkContTarget, currentCtxChunkId);
           createNewChapterHere(insertAtIndexChapter);
           break;
       case 'add_item_to_chapter':
             if (isChapTarget && chapName) {
                  const lastItemIdx = findLastIndexOfChapter(chapName);
                  // If chapter is empty (targetDataIdx is -1), this needs careful handling.
                  // contextMenuTargetIndex (targetDataIdx) is the first item of chapter or -1 if empty.
                  // Add after last item, or if chapter empty, effectively at start of where chapter would be.
                  const insertIdx = lastItemIdx !== -1 ? lastItemIdx + 1 : (targetDataIdx !== -1 ? targetDataIdx : currentPatternItems.length);
                 addNewItem(insertIdx, chapName);
             } else {
                console.warn("Add item to chapter: Context was not a chapter or chapter name missing.");
             }
             break;

    // --- Separator ---
    case 'separator':
        // Do nothing
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
function findLastIndexOfChapter(chapterName) {
    for (let i = currentPatternItems.length - 1; i >= 0; i--) {
        if ((currentPatternItems[i].chapter || '') === chapterName) {
            return i;
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
    console.log("Showing chapter input dialog for context:", context);
    chapterDialogContext = context; // Store context

    // Customize dialog based on action
    switch (context.action) {
        case 'rename_chapter': // Renamed from 'rename' to be more specific
            chapterDialogTitle.textContent = `Rename Chapter \"${context.oldName}\"`;
            chapterInputName.value = context.oldName;
            chapterInputName.placeholder = "Enter new chapter name";
            // Populate select with existing chapters
            populateChapterSelect(chapterInputName, context.oldName, true); // true for allow 'none'
            break;
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
              chapterInputName.placeholder = "New Chapter Name (cannot be blank)";
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

    console.log('Attaching listeners in showChapterInputDialog');
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
    console.log('handleChapterDialogOk called');
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
            case 'rename_chapter':
                 if (newName !== context.oldName) {
                      if (newName === "" && context.oldName !== "") {
                           if (!confirm(`Setting an empty chapter name will move items from "${context.oldName}" to the root level. Continue?`)) {
                                return;
                            }
                       }
                     console.log(`Calling API: rename_chapter pattern='${currentPattern}', old_name='${context.oldName}', new_name='${newName}'`);
                     window.electronAPI.callAPI('rename_chapter', {
                         pattern_name: currentPattern,
                         old_name: context.oldName,
                         new_name: newName
                     });
                     handleApiResponse('rename_chapter', `renaming chapter`);
                 } else {
                      console.log("No change in chapter name.");
                 }
                break;

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
                const firstChunkItem = currentPatternItems.find(it => it.chunkID === context.chunkId);
                const currentChunkChapter = firstChunkItem?.chapter || '';

                if (newName !== currentChunkChapter) {
                    console.log(`Calling API: update_item_chapter (for whole chunk) pattern='${currentPattern}', chunk_id=${context.chunkId}, new_chapter='${newName}'`);
                    // The API 'update_item_chapter' needs an item_index, so we give the index of the first item of the chunk.
                    // The API backend should then iterate through all items of that chunk.
                    const firstItemIndexOfChunk = currentPatternItems.findIndex(it => it.chunkID === context.chunkId);
                    if (firstItemIndexOfChunk === -1) {
                        console.error(`Could not find first item for chunk ID ${context.chunkId} to assign chapter.`);
                        alert(`Error: Could not find chunk ${context.chunkId}.`);
                        break;
                    }
                    window.electronAPI.callAPI('update_item_chapter', {
                        pattern_name: currentPattern,
                        item_index: firstItemIndexOfChunk, // API will use this to identify the chunk via chunk_id
                        new_chapter: newName,
                        is_chunk: true, // Crucial: tells the API this is for a whole chunk
                        chunk_id: context.chunkId
                    });
                    handleApiResponse('update_item_chapter', `assigning chapter to chunk ${context.chunkId}`);
                } else {
                    console.log(`No change in chapter assignment for chunk ${context.chunkId}.`);
                }
                break;

            case 'create_chapter':
                 if (newName) {
                      if (context.insertAtIndex === undefined) {
                          console.error("Missing insertAtIndex in context for create chapter action.");
                           alert("Error: Cannot determine where to create chapter.");
                           break;
                      }
                      console.log(`Creating chapter '${newName}' by adding new item at index ${context.insertAtIndex}`);
                      addNewItem(context.insertAtIndex, newName);
                 } else {
                      alert("Chapter name cannot be empty.");
                      return;
                 }
                break;
            // case 'rename_chunk': // Placeholder logic
            //     if (newName) {
            //         console.log(`Request to rename chunk ${context.chunkId} to ${newName}`);
            //         // API call for renaming chunk ID or name would go here
            //         // window.electronAPI.callAPI('rename_chunk_id', { pattern_name: currentPattern, old_chunk_id: context.chunkId, new_chunk_id: newName });
            //         // handleApiResponse('rename_chunk_id', `renaming chunk ${context.chunkId}`);
            //         alert("Chunk renaming API call not yet implemented.");
            //     } else {
            //         alert("New chunk name/ID cannot be empty.");
            //         return;
            //     }
            //     break;

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
        view_plane: "ax",
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


// (deleteItemOrChunk function already exists and should work, might need slight adjustment if API changes)
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


function renameChapter(oldChapterName) {
    console.log("Action: Rename Chapter", oldChapterName);
    showChapterInputDialog({ action: 'rename_chapter', oldName: oldChapterName });
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
    showChapterInputDialog({ action: 'create_chapter', insertAtIndex: insertAtIndex });
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
        view_plane: "ax",
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
    const existingChunkIds = [...new Set(currentPatternItems.map(i => i.chunkID).filter(id => id && id > 0))];
    
    chunkAssignmentContext = { itemIndex, itemName: item.abbr, currentChunkId }; // Store context

    showChunkAssignmentDialog(item.abbr, currentChunkId, existingChunkIds);
}


// --- Chunk Assignment Dialog Functions ---
function showChunkAssignmentDialog(itemName, currentChunkId, existingChunkIds) {
    if (!chunkAssignmentDialog) {
        console.error("Chunk assignment dialog element not found!");
        return;
    }

    chunkAssignItemName.textContent = itemName;
    chunkAssignCurrentId.textContent = currentChunkId === 0 ? 'None' : currentChunkId;

    chunkAssignSelect.innerHTML = ''; // Clear previous options
    const noneOption = document.createElement('option');
    noneOption.value = '0'; // Value for "None"
    noneOption.textContent = '(None) - Remove from chunk';
    chunkAssignSelect.appendChild(noneOption);

    existingChunkIds.sort((a, b) => a - b).forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `Chunk ${id}`;
        chunkAssignSelect.appendChild(option);
    });

    // Set select to current chunk or '0' if not in a chunk
    chunkAssignSelect.value = currentChunkId === 0 ? '0' : currentChunkId.toString();
    chunkAssignNewIdInput.value = ''; // Clear new ID input

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

    const { itemIndex, currentChunkId } = chunkAssignmentContext;
    let chosenChunkId = parseInt(chunkAssignSelect.value);
    const newChunkIdRaw = chunkAssignNewIdInput.value.trim();

    if (newChunkIdRaw !== '') {
        const newId = parseInt(newChunkIdRaw);
        if (isNaN(newId) || newId <= 0) {
            alert("New Chunk ID must be a positive number if specified.");
            chunkAssignNewIdInput.focus();
            return;
        }
        // User entered a new ID, this takes precedence
        chosenChunkId = newId;
        console.log(`User specified new chunk ID: ${chosenChunkId}`);
    } else {
        console.log(`User selected from existing/none: ${chosenChunkId}`);
    }

    if (isNaN(chosenChunkId) || chosenChunkId < 0) {
        alert("Invalid Chunk ID selected or entered. Must be a non-negative number (0 for None).");
        return;
    }

    if (chosenChunkId === currentChunkId) {
        alert("Item is already in this chunk state. No changes made.");
        hideChunkAssignmentDialog();
        return;
    }
    
    // If chosenChunkId > 0 and it's a *new* ID not in existing list (excluding 0 for 'None'),
    // it implies creating a new chunk with just this item.
    // The backend API 'update_chunk' should handle this logic of assigning to new or existing.

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
function handleApiResponse(apiMethod, actionDescription) {
    // Ensure only one listener is active per action
    // REMOVED: const listenerId = `${apiMethod}_${Date.now()}`; // Unique ID for listener - Not needed with returned unsubscribe function

    let unsubscribe = null; // Variable to hold the unsubscribe function

    const handleResponse = (data) => {
        if (data && data.responseFor === apiMethod) {
            if (unsubscribe) { // Check if unsubscribe function exists
                 console.log(`[EDITOR] Unsubscribing listener for ${apiMethod}`); // Use console.log
                 unsubscribe(); // Call the returned unsubscribe function
                 unsubscribe = null; // Clear it after use
            } else {
                 console.warn(`[EDITOR] No unsubscribe function found for ${apiMethod} listener.`); // Use console.warn
            }
            // window.electronAPI.removeAPIResponseListener(listenerId); // REMOVED: Incorrect usage
            if (data.result && data.result.success) {
                console.log(`[EDITOR] Success ${actionDescription}. Reloading pattern.`); // Use console.log
                loadPattern(currentPattern);
            } else if (data.error) {
                console.error(`[EDITOR] Error ${actionDescription}:`, data.error); // Use console.error
                alert(`Error ${actionDescription}: ${data.error}`);
                loadPattern(currentPattern); // Reload even on error to ensure consistency
            } else {
                 console.error(`[EDITOR] Unknown error/response ${actionDescription}:`, data); // Use console.error
                 alert(`An unknown error occurred while ${actionDescription}.`);
                 loadPattern(currentPattern);
            }
        }
    };

    // Call onAPIResponse and store the returned unsubscribe function
    unsubscribe = window.electronAPI.onAPIResponse(handleResponse);
    // Pass listener ID
    // REMOVED: window.electronAPI.onAPIResponse(handleResponse, listenerId);
}

// Ensure add_item handles chapter correctly (already modified above)
// Ensure delete_item handles chunks correctly (already modified above)
// Ensure rename_chapter calls API (modified above)
// Ensure delete_chapter calls API (modified above)
// Ensure assign_chapter calls API (modified above)
// Ensure create_chapter_here calls addNewItem (modified above)
// Ensure create_chunk_first/last are using correct indices (modified above)
// Ensure remove_from_chunk calls API (modified above)
// Ensure disband_chunk calls API using chunkId (modified above)

// ... rest of editor.js ...

// Handle field edit
function handleFieldEdit(e) {
  const fieldElement = e.target;
  const fieldName = fieldElement.getAttribute('data-field');
  const itemIndex = parseInt(fieldElement.getAttribute('data-index'));
  const newValue = fieldElement.textContent.trim(); // Trim whitespace

  // Find the correct item (handle items within chunks)
  let actualItemIndex = -1;
  if (!isNaN(itemIndex)) {
     // Check if the element is part of a chunk or a single item
    const parentDraggable = fieldElement.closest('.draggable-item');
    if (parentDraggable && parentDraggable.dataset.isChunk === 'true') {
        // It's inside a chunk, use the chunk-index
         actualItemIndex = parseInt(fieldElement.closest('.chunk-item-part')?.dataset.chunkIndex);
    } else if (parentDraggable && parentDraggable.dataset.isChunk === 'false') {
        // It's a single item, use the item-index directly
         actualItemIndex = itemIndex; // This should match parentDraggable.dataset.itemIndex
    }
  }

  if (actualItemIndex !== -1 && actualItemIndex < currentPatternItems.length && fieldName && currentPatternItems[actualItemIndex][fieldName] !== newValue) {
    console.log(`Field Edit: Index=${actualItemIndex}, Field=${fieldName}, NewValue='${newValue}'`);
    currentPatternItems[actualItemIndex][fieldName] = newValue;

    // Debounce save operation
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveCurrentPattern();
    }, 300); // Save after 300ms of inactivity
  } else if (isNaN(actualItemIndex) || actualItemIndex === -1) {
     console.error("Could not determine valid index for field edit from:", fieldElement);
  }
}

// Show new pattern dialog
function showNewPatternDialog() {
  newPatternDialog.style.display = 'block';
  newPatternNameInput.value = '';
  newPatternNameInput.focus();
}

// Hide new pattern dialog
function hideNewPatternDialog() {
  newPatternDialog.style.display = 'none';
}

// Create a new pattern
function createNewPattern() {
  const patternName = newPatternNameInput.value.trim();
  
  if (!patternName) {
    alert('Please enter a pattern name');
    return;
  }
  
  // Send create pattern request to backend
  window.electronAPI.callAPI('update_pattern', {
    pattern_name: patternName,
    pattern_data: []
  });
  
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'update_pattern') {
      unsubscribe();
      
      hideNewPatternDialog();
      
      // Reload patterns to include the new one
      loadPatterns();
    }
  });
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

// --- Save Function ---
let saveTimeout; // For debouncing saves

async function saveCurrentPattern() {
  console.log('Saving pattern:', currentPattern);
  console.log('Pattern items to save:', currentPatternItems); // Log the data being sent

  // Create a deep copy to avoid potential issues with reactivity or unintended modifications
  const patternDataToSave = JSON.parse(JSON.stringify(currentPatternItems));

  // Prepare the data for saving
  const saveData = {
    pattern_name: currentPattern,
    // Ensure the items sent for saving have the view_plane property
    items: patternDataToSave.map(item => ({
        ...item,
        view_plane: item.view_plane || 'ax' // Ensure default if somehow missing
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
      // Modify success check: Check if data.result is simply true
      if (data.result === true) { 
        console.log('Save successful (result was true)');
        // Optionally, reload the pattern to confirm save, but might be disruptive
        // loadPattern(currentPattern); 
      } else if (data.error) { // Check for explicit error first
        console.error('Error saving pattern:', data.error);
        // Optionally provide user feedback (e.g., alert)
        alert(`Failed to save pattern: ${data.error}`);
      } else { // Catch other non-true results (like false from save_patterns failure, or unexpected data)
          console.error('Save pattern failed or returned unexpected data. Response:', data);
          alert('An error occurred while saving the pattern.');
      }
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
        view_plane: 'ax' // Default view for new items
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
                partsBankList = data.result.map(item => ({ ...item, view_plane: item.view_plane || 'ax' })); // Add default view
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
function handleItemClick(e, itemElement) {
  const clickedItemIndex = parseInt(itemElement.getAttribute('data-item-index'));
  const isChunk = itemElement.dataset.isChunk === 'true';

  if (isNaN(clickedItemIndex)) {
    console.error('Invalid index on clicked item:', itemElement);
    return;
  }

  // Prevent selection changes if clicking on contenteditable or select
  if (e.target.isContentEditable || e.target.tagName === 'SELECT' || e.target.closest('.drag-handle')) {
    return;
  }

  console.log(`Item clicked: Index ${clickedItemIndex}, MultiSelect: ${multiSelectionMode}`);

  if (multiSelectionMode) {
    // Multi-selection mode (Shift key held)
    const indexPosition = selectedIndices.indexOf(clickedItemIndex);
    if (indexPosition > -1) {
      // Already selected, deselect it
      selectedIndices.splice(indexPosition, 1);
      itemElement.classList.remove('selected');
    } else {
      // Not selected, select it
      selectedIndices.push(clickedItemIndex);
      itemElement.classList.add('selected');
    }
    // Ensure single select index is cleared in multi-mode
    selectedIndex = -1;
  } else {
    // Single selection mode
    // Clear previous multi-selection
    selectedIndices = []; 
    document.querySelectorAll('.draggable-item.selected').forEach(el => el.classList.remove('selected'));

    if (selectedIndex === clickedItemIndex) {
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
      selectedIndex = clickedItemIndex;
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

// --- Updated SortableJS onEnd handler ---
function handleSortEnd(evt) {
    const movedElement = evt.item; // The element that was moved
    const fromContainer = evt.from; // Container element moved FROM
    const toContainer = evt.to; // Container element moved TO
    const oldIndex = evt.oldIndex; // Index within FROM container
    const newIndex = evt.newIndex; // Index within TO container

    // If the item was dropped back in the same place visually, do nothing.
    if (fromContainer === toContainer && oldIndex === newIndex) {
        console.log("SortEnd: No visual change detected. Aborting API call.");
        return;
    }

    console.log("SortEnd Event Details:");
    console.log(` -> Moved Element:`, movedElement);
    console.log(` -> From Container:`, fromContainer, `(Old Index: ${oldIndex})`);
    console.log(` -> To Container:`, toContainer, `(New Index: ${newIndex})`);

    const isChapterContainer = movedElement.dataset.isChapter === 'true';
    const isChunk = movedElement.dataset.isChunk === 'true';
    const isSingleItem = !isChapterContainer && !isChunk;

    // --- Determine the *original* data index and size ---
    let originalDataStartIndex = -1;
    let movedItemSize = 1;
    let movedItemOriginalChapter = '';

    if (isChapterContainer) {
        // Dragging a chapter container.
        const chapterName = movedElement.dataset.chapterName;
        const chapterItems = currentPatternItems.filter(item => (item.chapter || '') === chapterName);
        if (chapterItems.length > 0) {
            originalDataStartIndex = currentPatternItems.findIndex(item => item === chapterItems[0]);
            movedItemSize = chapterItems.length;
            movedItemOriginalChapter = chapterName; // Chapter name is its own 'chapter'
            console.log(` -> Moving CHAPTER '${chapterName}': Starts at data index ${originalDataStartIndex}, size ${movedItemSize}`);
        } else {
            console.error(`Cannot move chapter '${chapterName}': No items found in data.`);
            loadPattern(currentPattern); return;
        }
    } else if (isChunk) {
        // Dragging a chunk container.
        originalDataStartIndex = parseInt(movedElement.dataset.itemIndex);
        movedItemSize = parseInt(movedElement.dataset.chunkSize);
        movedItemOriginalChapter = movedElement.dataset.parentChapter || '';
        console.log(` -> Moving CHUNK ID ${movedElement.dataset.chunkId}: Starts at data index ${originalDataStartIndex}, size ${movedItemSize}, from chapter '${movedItemOriginalChapter}'`);
    } else {
        // Dragging a single item.
        originalDataStartIndex = parseInt(movedElement.dataset.itemIndex);
        movedItemSize = 1;
        movedItemOriginalChapter = movedElement.dataset.parentChapter || '';
        console.log(` -> Moving SINGLE ITEM: Data index ${originalDataStartIndex}, from chapter '${movedItemOriginalChapter}'`);
    }

    // Validate parsed indices/size
    if (isNaN(originalDataStartIndex) || originalDataStartIndex < 0 || isNaN(movedItemSize) || movedItemSize <= 0) {
        console.error("Failed to determine valid original data index or size:", movedElement);
        loadPattern(currentPattern); return;
    }

    // --- Determine Target Chapter ---
    let targetChapterName = '';
    if (isChapterContainer) {
        // Chapters can only be dropped in the root container (patternItems)
        if (toContainer !== patternItems) {
            console.error("Chapters can only be dropped in the main list, not inside other chapters.");
            loadPattern(currentPattern); return;
        }
        targetChapterName = movedElement.dataset.chapterName; // A chapter defines its own target name
    } else if (toContainer.classList.contains('chapter-items')) {
        // Dropped inside a chapter's item list
        targetChapterName = toContainer.closest('.chapter-container')?.dataset.chapterName || '';
    } else if (toContainer === patternItems) {
        // Dropped in the main list (outside any chapter container)
        targetChapterName = ''; // Explicitly set to no chapter
    } else {
        console.warn("Dropped into an unexpected container:", toContainer, "Assuming root (no chapter).");
        targetChapterName = '';
    }
    console.log(` -> Target Chapter Name: '${targetChapterName}'`);

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
                const chapterItemsInData = currentPatternItems.filter(d => (d.chapter || '') === chapterName);
                const chapterDataSize = chapterItemsInData.length > 0 ? chapterItemsInData.length : 0;
                console.log(` -> Accumulating size for chapter '${chapterName}': ${chapterDataSize}`);
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
        const isMovingOutOfChapterToRoot = (movedItemOriginalChapter !== '' && targetChapterName === '');

        if (isMovingOutOfChapterToRoot) {
            // When moving out of a chapter downwards to the root,
            // the user reports the pre-adjusted targetApiIndex is correct,
            // and the standard +movedItemSize adjustment makes it land too low.
            console.log(` -> Downward move: ITEM OUT OF CHAPTER ('${movedItemOriginalChapter}') TO ROOT. Original Target API Index: ${targetApiIndex}. No +size adjustment for API call.`);
            // finalApiTargetIndex remains targetApiIndex (the pre-adjustment value for this specific case)
        } else {
            // Standard downward move (e.g., within root, within chapter, root to chapter, chapter to chapter).
            // Apply adjustment to counteract API's potential subtraction.
            console.log(` -> Downward move: Standard. Adjusting: ${targetApiIndex} + ${movedItemSize}`);
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
    const needsChapterUpdate = !isChapterContainer && targetChapterName !== movedItemOriginalChapter;
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
        console.log(` -> API Call: Updating chapter for moved item/chunk to '${targetChapterName}'`);
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
  console.log('Checking Chapter Dialog Buttons in init:');
  console.log(' - chapterDialogOkBtn:', chapterDialogOkBtn);
  console.log(' - chapterDialogCancelBtn:', chapterDialogCancelBtn);
  // *** End Debugging ***

  // Load available patterns
  loadPatterns();
  
  // Set up event listeners
  patternSelector.addEventListener('change', () => {
    loadPattern(patternSelector.value);
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

  // Debounce save pattern changes
  // Moved saveTimeout declaration outside saveCurrentPattern

  // Event listeners
  patternSelector.addEventListener('change', () => {
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
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

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
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', init); 