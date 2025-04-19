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
        });
        
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
  let itemIndexCounter = 0; // Index in the currentPatternItems array
  let renderedItemIndex = 0; // Index of the rendered DOM element (0, 1, 2...)

  while (itemIndexCounter < currentPatternItems.length) {
    const item = currentPatternItems[itemIndexCounter];
    const isSelected = selectedIndex === itemIndexCounter || selectedIndices.includes(itemIndexCounter);
    const isInChunk = item.chunkID > 0;

    if (isInChunk) {
      // Find all items in this chunk
      const chunkID = item.chunkID;
      const chunkItems = currentPatternItems.filter((chunkItem) => chunkItem.chunkID === chunkID);
      const chunkIndices = currentPatternItems.map((mapItem, idx) => mapItem.chunkID === chunkID ? idx : -1).filter(idx => idx !== -1);

      // Create a single list item containing all parts of the chunk
      // Use data-item-index to store the starting index of this chunk in currentPatternItems
      html += `
        <div
          class="draggable-item chunk-container ${isSelected ? 'selected' : ''}"
          data-item-index="${itemIndexCounter}"
          data-rendered-index="${renderedItemIndex}"
          data-is-chunk="true"
          data-chunk-id="${chunkID}"
          data-chunk-size="${chunkItems.length}"
          >
          <div class="chunk-header">
            <div class="drag-handle" data-handle="true"></div>
            <span>Chunk ${chunkID}</span>
          </div>
          <div class="chunk-items">
      `;

      // Add each chunk item within the container
      chunkItems.forEach((chunkItem, chunkIdx) => {
        const chunkItemIndex = chunkIndices[chunkIdx];
        html += `
          <div class="chunk-item-part" data-chunk-index="${chunkItemIndex}">
            <div class="item-abbr" contenteditable="true" data-field="abbr" data-index="${chunkItemIndex}">${chunkItem.abbr || ''}</div>
            <div class="item-strategy" contenteditable="true" data-field="strategy" data-index="${chunkItemIndex}">${chunkItem.strategy || ''}</div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;

      // Skip ahead past all the chunk items we just processed in the data array
      itemIndexCounter += chunkItems.length;
    } else {
      // Regular single item
      // Use data-item-index to store the index of this item in currentPatternItems
      html += `
        <div
          class="draggable-item ${isSelected ? 'selected' : ''}"
          data-item-index="${itemIndexCounter}"
          data-rendered-index="${renderedItemIndex}"
          data-is-chunk="false"
          >
          <div class="item-content">
            <div class="drag-handle" data-handle="true"></div>
            <div class="item-abbr" contenteditable="true" data-field="abbr">${item.abbr || ''}</div>
            <div class="item-strategy" contenteditable="true" data-field="strategy">${item.strategy || ''}</div>
          </div>
        </div>
      `;

      itemIndexCounter++;
    }
    renderedItemIndex++; // Increment for each rendered DOM element (chunk or single item)
  }

  patternItems.innerHTML = html;

  // --- Initialize SortableJS ---
  // Destroy previous instance if it exists to prevent duplicates
  if (window.sortableInstance) {
      window.sortableInstance.destroy();
  }
  window.sortableInstance = new Sortable(patternItems, {
    animation: 150, // Animation speed
    handle: '.drag-handle', // Use the drag handle
    draggable: '.draggable-item', // Specify draggable items
    ghostClass: 'sortable-ghost', // Class for the drop placeholder
    chosenClass: 'sortable-chosen', // Class for the chosen item
    dragClass: 'sortable-drag', // Class applied to the element being dragged

    onEnd: function (evt) {
        const movedElement = evt.item;
        const oldRenderedIndex = evt.oldIndex; // Visual index before move
        const newRenderedIndex = evt.newIndex; // Visual index after move

        if (oldRenderedIndex === newRenderedIndex) {
            console.log("No change in visual index.");
            renderPatternItems(); // Re-render to fix visual state if needed
            return;
        }

        // --- Build a map from visual index to data info based on *current* data ---
        // This represents the state *before* the move happened.
        const currentRenderedMap = []; // Array of { dataStartIndex, size }
        let dataIdxCounter = 0;
        while (dataIdxCounter < currentPatternItems.length) {
            const item = currentPatternItems[dataIdxCounter];
            const isChunk = item.chunkID > 0;
            if (isChunk) {
                const chunkSize = currentPatternItems.filter(i => i.chunkID === item.chunkID).length;
                currentRenderedMap.push({ dataStartIndex: dataIdxCounter, size: chunkSize });
                dataIdxCounter += chunkSize;
            } else {
                currentRenderedMap.push({ dataStartIndex: dataIdxCounter, size: 1 });
                dataIdxCounter++;
            }
        }

        // Get the data info for the item that was moved, using the *old* visual index
        const movedItemInfo = currentRenderedMap[oldRenderedIndex];
        const fromDataIndex = movedItemInfo.dataStartIndex;
        const movedItemSize = movedItemInfo.size;

        // Determine the target data index *before which* the item should be inserted.
        let targetDataIndex;
        if (newRenderedIndex >= currentRenderedMap.length) {
            // Moved visually to the end of the list
            targetDataIndex = currentPatternItems.length;
        } else {
            // Moved visually before the item that *was* at the newRenderedIndex
            targetDataIndex = currentRenderedMap[newRenderedIndex].dataStartIndex;
        }

        console.log(`Move detected: From data index ${fromDataIndex} (size ${movedItemSize}) visually dropped before item originally at data index ${targetDataIndex}`);

        // --- Calculate final API index based on drag direction ---
        let finalToIndex;
        const movingDown = newRenderedIndex > oldRenderedIndex;

        if (newRenderedIndex >= currentRenderedMap.length) {
            // Dropped visually at the very end. Insert at the end of the data array.
            finalToIndex = currentPatternItems.length;
        } else {
            // Dropped visually before the item originally at newRenderedIndex.
            // Ensure index is valid before accessing map
            if (newRenderedIndex >= currentRenderedMap.length) {
                 console.error(`Invalid newRenderedIndex ${newRenderedIndex} for map length ${currentRenderedMap.length}. Aborting move.`);
                 loadPattern(currentPattern); // Reload to reset state
                 return;
            }
            const targetItemInfo = currentRenderedMap[newRenderedIndex];

            if (movingDown) {
                // Dragging DOWN: Insert *after* the target item.
                finalToIndex = targetItemInfo.dataStartIndex + targetItemInfo.size;
            } else {
                // Dragging UP: Insert *before* the target item.
                finalToIndex = targetItemInfo.dataStartIndex;
            }
        }

        // Note: No clamping needed here as the calculation should yield valid insertion points (0 to length).
        // The API needs to handle the from_index and to_index correctly relative to the original array state.

        console.log(`Calculated final API target index (to_index, insertion point): ${finalToIndex} (movingDown=${movingDown})`);

        // Check if the final effective position is the same as the start (no actual data move needed)
        // Note: This condition might need refinement depending on API behavior.
        // If API's 'to_index' means "insert before this index", moving item at index 5 to index 6 is a move.
        // If it means "place at this index", then moving item at 5 to 5 is no move. Assuming "insert before".
        if (fromDataIndex === finalToIndex || fromDataIndex + movedItemSize === finalToIndex) {
             console.log("Effective data indices result in no change or adjacent swap handled by API logic. Aborting client-side change, letting API handle.");
             // Still call API as it might handle edge cases or need confirmation
             // renderPatternItems(); // Don't re-render here, let the API response handle it.
             // return; // Keep this commented out - let the API call proceed even for no-ops potentially
        }


        // Call backend API with corrected indices
        console.log(`Calling API: move_item pattern='${currentPattern}', from_index=${fromDataIndex}, to_index=${finalToIndex}, count=${movedItemSize}`);
        window.electronAPI.callAPI('move_item', {
            pattern_name: currentPattern,
            from_index: fromDataIndex,
            to_index: finalToIndex,
            count: movedItemSize
        });

        // Listen for response (same as before)
        const unsubscribe = window.electronAPI.onAPIResponse((data) => {
            if (data && data.responseFor === 'move_item') {
              unsubscribe();
              if (data.result && data.result.success) {
                console.log('Move successful, reloading pattern shortly...');
                // Add a small delay before reloading to potentially avoid race conditions
                setTimeout(() => {
                  loadPattern(currentPattern);
                }, 50); // 50ms delay
              } else if (data.error) {
                console.error('Error moving item:', data.error);
                loadPattern(currentPattern); // Reload pattern from backend on error
                alert(`Failed to move item: ${data.error}`);
              } else {
                 console.error('Unknown error moving item. Response:', data);
                 loadPattern(currentPattern); // Reload pattern from backend on error
                 alert('An unknown error occurred while moving the item.');
              }
            }
        });
    }
  });
  // --- End SortableJS ---


  // Add other event listeners (context menu, edits)
  document.querySelectorAll('.draggable-item').forEach(item => {
    // Right-click context menu only
    item.addEventListener('contextmenu', handleContextMenu);
  });

  // Prevent selection and dragging from contenteditable fields
  document.querySelectorAll('[contenteditable]').forEach(editableField => {
    editableField.addEventListener('blur', handleFieldEdit);

    // Prevent SortableJS from initiating drag from contenteditable fields
    editableField.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Stop event from bubbling to SortableJS
    });
     editableField.addEventListener('touchstart', (e) => { // Also for touch devices
        e.stopPropagation();
    });
  });
}

// Handle context menu
function handleContextMenu(e) {
  e.preventDefault();
  
  // Get the target item index from data-item-index (correct for both single items and chunks)
  contextMenuTargetIndex = parseInt(e.currentTarget.getAttribute('data-item-index'));
  
  // Ensure we got a valid index
  if (isNaN(contextMenuTargetIndex) || contextMenuTargetIndex < 0 || contextMenuTargetIndex >= currentPatternItems.length) {
    console.error("Could not determine valid context menu target index from:", e.currentTarget);
    return; // Don't show menu if index is invalid
  }
  
  // Create context menu items based on the item state
  const targetItem = currentPatternItems[contextMenuTargetIndex];
  const inChunk = targetItem.chunkID > 0;
  
  let menuItems = [];
  
  if (inChunk) {
    menuItems.push({
      text: 'Remove from Chunk',
      action: 'remove_from_chunk',
      enabled: true
    });
    
    menuItems.push({
      text: 'Disband Chunk',
      action: 'disband_chunk',
      enabled: true
    });
  } else {
    // Check if any first item is selected for chunk creation
    if (chunkFirstItemIndex >= 0) {
      // Cannot select a part that is already in a chunk
      const canBeLastItem = targetItem.chunkID === 0;
      
      // Check if there are any chunks between first and last items
      let hasChunksInRange = false;
      const rangeStart = Math.min(chunkFirstItemIndex, contextMenuTargetIndex);
      const rangeEnd = Math.max(chunkFirstItemIndex, contextMenuTargetIndex);
      
      for (let i = rangeStart; i <= rangeEnd; i++) {
        if (currentPatternItems[i].chunkID > 0) {
          hasChunksInRange = true;
          break;
        }
      }
      
      menuItems.push({
        text: 'Create Chunk: Last Item',
        action: 'create_chunk_last',
        enabled: canBeLastItem && !hasChunksInRange
      });
    } else {
      // Can't be first item if already in a chunk
      const canBeFirstItem = targetItem.chunkID === 0;
      
      menuItems.push({
        text: 'Create Chunk: First Item',
        action: 'create_chunk_first',
        enabled: canBeFirstItem
      });
    }
  }
  
  // Position and show the context menu
  showContextMenu(e.clientX, e.clientY, menuItems);
}

// Show context menu
function showContextMenu(x, y, items) {
  // Generate menu HTML
  let html = '';
  items.forEach(item => {
    html += `
      <div 
        class="context-menu-item ${item.enabled ? '' : 'disabled'}" 
        data-action="${item.action}" 
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
  
  switch (action) {
    case 'create_chunk_first':
      setChunkFirstItem();
      break;
    case 'create_chunk_last':
      createChunkWithRange();
      break;
    case 'remove_from_chunk':
      removeFromChunk();
      break;
    case 'disband_chunk':
      disbandChunk();
      break;
  }
  
  hideContextMenu();
}

// Set the first item for chunk creation
function setChunkFirstItem() {
  chunkFirstItemIndex = contextMenuTargetIndex;
  
  // Show a notification to the user
  const notification = document.createElement('div');
  notification.textContent = `First item selected. Now right-click on the last item and select "Create Chunk: Last Item"`;
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
  
  // Remove the notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

// Create a chunk with a range of items
function createChunkWithRange() {
  if (chunkFirstItemIndex < 0) return;
  
  const startIndex = Math.min(chunkFirstItemIndex, contextMenuTargetIndex);
  const endIndex = Math.max(chunkFirstItemIndex, contextMenuTargetIndex);
  
  // Check that no items in the range are already in chunks
  for (let i = startIndex; i <= endIndex; i++) {
    if (currentPatternItems[i].chunkID > 0) {
      alert('Cannot create chunk because some items in the range are already in chunks.');
      chunkFirstItemIndex = -1; // Reset first item
      return;
    }
  }
  
  // Send chunk creation request to backend
  window.electronAPI.callAPI('create_chunk', {
    pattern_name: currentPattern,
    start_index: startIndex,
    end_index: endIndex
  });
  
  // Listen for response and reload the pattern if successful
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'create_chunk') {
      unsubscribe();
      if (data.result && data.result.success) {
        // Reset first item selection
        chunkFirstItemIndex = -1;
        loadPattern(currentPattern);
      } else if (data.error) {
        console.error('Error creating chunk:', data.error);
        // Add error handling here if needed
      }
    }
  });
}

// Remove an item from its chunk
function removeFromChunk() {
  window.electronAPI.callAPI('remove_from_chunk', {
    pattern_name: currentPattern,
    index: contextMenuTargetIndex
  });
  
  // Listen for response and reload the pattern if successful
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'remove_from_chunk') {
      unsubscribe();
      if (data.result && data.result.success) {
        loadPattern(currentPattern);
      } else if (data.error) {
        console.error('Error removing from chunk:', data.error);
        // Add error handling here if needed
      }
    }
  });
}

// Disband a chunk
function disbandChunk() {
  const chunkID = currentPatternItems[contextMenuTargetIndex].chunkID;
  
  window.electronAPI.callAPI('disband_chunk', {
    pattern_name: currentPattern,
    chunk_id: chunkID
  });
  
  // Listen for response and reload the pattern if successful
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'disband_chunk') {
      unsubscribe();
      if (data.result && data.result.success) {
        loadPattern(currentPattern);
      } else if (data.error) {
        console.error('Error disbanding chunk:', data.error);
        // Add error handling here if needed
      }
    }
  });
}

// Handle field edit
function handleFieldEdit(e) {
  const field = e.target.getAttribute('data-field');
  const value = e.target.textContent.trim();
  const index = parseInt(e.target.getAttribute('data-index'));
  
  if (isNaN(index) || field === null || currentPattern === null) {
    return;
  }
  
  // Send update request to backend
  window.electronAPI.callAPI('update_item', {
    pattern_name: currentPattern,
    index: index,
    field: field,
    value: value
  });
  
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'update_item') {
      unsubscribe();
      
      if (data.error) {
        console.error('Error updating item:', data.error);
      }
    }
  });
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

// Initialize the application
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
  const closeButton = document.getElementById('close-editor-btn');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      window.electronAPI.send('close-editor'); // Send IPC message to main process
    });
  } else {
    console.error('Could not find editor window close button');
  }
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', init); 