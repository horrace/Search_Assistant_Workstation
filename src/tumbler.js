// DOM Elements
const tumblerCounter = document.getElementById('tumbler-counter');
const closeButton = document.getElementById('close-button');
const tumblerAbbr = document.getElementById('tumbler-abbr');
const tumblerStrategy = document.getElementById('tumbler-strategy');
const tumblerChunk = document.getElementById('tumbler-chunk');
const tumblerChapterLabel = document.getElementById('tumbler-chapter-label');
const decreaseFontBtn = document.getElementById('decrease-font');
const increaseFontBtn = document.getElementById('increase-font');
const tumblerTimer = document.getElementById('tumbler-timer');
const tumblerContainer = document.querySelector('.tumbler-container');
const tumblerHeader = document.querySelector('.tumbler-header');
const nextArea = document.getElementById('next-area');

// State
let currentPattern = '';
let patternItems = []; // Original full list of all items
let displayableUnits = []; // New: Holds single items or one representative item per chunk
let currentDisplayIndex = 0; // New: Index for displayableUnits
let totalDisplayItems = 0; // New: Count of units in displayableUnits
let elapsedSeconds = 0;
let timerInterval = null;
let fontScaleFactor = 1.0;
let hideBackground = false;

// Font size base values
const abbrBaseFontSize = 20;
const strategyBaseFontSize = 14;
const chunkItemAbbrBaseFontSize = 20;
const chunkItemStrategyBaseFontSize = 14;

// Added: Font size base for chapter
const chapterBaseFontSize = 16; // Adjust as needed

// Initialize the application
function init() {
  // Get the pattern name from the main process
  window.electronAPI.onPatternSelected((patternName) => {
    currentPattern = patternName;
    loadPattern(patternName);
  });
  
  // Listen for advance-tumbler command from global shortcut
  window.electronAPI.onAdvanceTumbler(() => {
    console.log('Tumbler received advance-tumbler event');
    nextItem();
  });
  
  // Set up event listeners
  closeButton.addEventListener('click', () => {
    window.electronAPI.closeTumbler();
  });
  
  // Font size controls
  decreaseFontBtn.addEventListener('click', () => {
    // Decrease font size (min scale factor: 0.7)
    fontScaleFactor = Math.max(0.7, fontScaleFactor - 0.1);
    updateFontSizes();
  });
  
  increaseFontBtn.addEventListener('click', () => {
    // Increase font size (max scale factor: 1.5)
    fontScaleFactor = Math.min(1.5, fontScaleFactor + 0.1);
    updateFontSizes();
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      nextItem();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      window.electronAPI.closeTumbler();
    }
  });
  
  // Setup dragging functionality
  setupDragHandling();
  
  // Load settings and setup background visibility
  loadSettings();
  
  // Start the timer
  startTimer();

  // Add click event listener to the next area
  if (nextArea) {
    nextArea.addEventListener('click', () => {
      nextItem();
    });
  }
}

// Set up drag handling for the window
function setupDragHandling() {
  // No custom logic needed here anymore.
  // Dragging is handled by Electron via CSS (-webkit-app-region: drag).
  // Ensure interactive elements within the header have -webkit-app-region: no-drag in CSS.
  console.log("Tumbler window dragging enabled via CSS.");
}

// Update background visibility based on setting
function updateBackgroundVisibility() {
  if (hideBackground) {
    tumblerContainer.classList.add('no-background');
    
    // Remove any inline background styles when hiding background
    const contentElements = document.querySelectorAll('.tumbler-abbr, .tumbler-strategy, .tumbler-chunk, .chunk-item-abbr, .chunk-item-strategy');
    contentElements.forEach(el => {
      el.style.backgroundColor = 'transparent';
      el.style.boxShadow = 'none';
    });
  } else {
    tumblerContainer.classList.remove('no-background');
    
    // Restore original background styles
    const contentElements = document.querySelectorAll('.tumbler-abbr, .tumbler-strategy, .tumbler-chunk');
    contentElements.forEach(el => {
      el.style.backgroundColor = 'rgba(48, 48, 48, 0.95)';
      el.style.boxShadow = 'none';
    });
  }
}

// Load settings from backend
function loadSettings() {
  window.electronAPI.callAPI('get_tumbler_settings', {});
  
  const unsubscribe = window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'get_tumbler_settings') {
      unsubscribe();
      
      // Check if response contains an error or if the result is valid
      if (data.error) {
        console.error('Error loading tumbler settings from backend:', data.error);
        return;
      }
      
      if (data.result && typeof data.result === 'object') {
        // If result.error exists, it's likely the API method wasn't found yet
        if (data.result.error) {
          console.warn('Backend message:', data.result.error);
          return;
        }
        
        hideBackground = data.result.hideBackground || false;
        updateBackgroundVisibility();
      }
    }
  });
}

// Load a pattern
function loadPattern(patternName) {
  // Send request to backend
  window.electronAPI.callAPI('get_pattern', { pattern_name: patternName });

  // Listen for response
  window.electronAPI.onAPIResponse((data) => {
    if (data && data.responseFor === 'get_pattern' && Array.isArray(data.result)) {
      patternItems = data.result;
      displayableUnits = [];
      const processedChunkIDs = new Set();

      for (const item of patternItems) {
        const chunkID = item.chunkID || 0;
        if (chunkID > 0) {
          if (!processedChunkIDs.has(chunkID)) {
            displayableUnits.push(item); // Add the first item of the chunk as representative
            processedChunkIDs.add(chunkID);
          }
        } else {
          displayableUnits.push(item); // Add non-chunk item
        }
      }

      totalDisplayItems = displayableUnits.length;
      currentDisplayIndex = 0;
      displayCurrentItem();
    } else if (data && data.responseFor === 'get_pattern' && data.error) {
      console.error("Error loading pattern:", data.error);
      // Handle error display if necessary
      tumblerCounter.textContent = "Error";
    }
  });
}

// Update font sizes based on scale factor
function updateFontSizes() {
  tumblerAbbr.style.fontSize = `${abbrBaseFontSize * fontScaleFactor}px`;
  tumblerStrategy.style.fontSize = `${strategyBaseFontSize * fontScaleFactor}px`;
  
  // Ensure view font size is also updated for the dynamic view element
  const tumblerViewDynamic = document.getElementById('tumbler-view-dynamic');
  if (tumblerViewDynamic) {
      tumblerViewDynamic.style.fontSize = `${(abbrBaseFontSize - 4) * fontScaleFactor}px`; // Adjust base size as needed
  }
  
  // Update chapter label font size
  if (tumblerChapterLabel) {
      tumblerChapterLabel.style.fontSize = `${chapterBaseFontSize * fontScaleFactor}px`;
  }
  
  // Update chunk item font sizes if visible
  document.querySelectorAll('.chunk-item-abbr').forEach(el => {
    el.style.fontSize = `${chunkItemAbbrBaseFontSize * fontScaleFactor}px`;
  });
  
  document.querySelectorAll('.chunk-item-strategy').forEach(el => {
    el.style.fontSize = `${chunkItemStrategyBaseFontSize * fontScaleFactor}px`;
  });
}

function formatStrategyText(text) {
    if (!text) return '';
    // Use a regex to find all occurrences of text within parentheses.
    // The 'g' flag ensures all matches are replaced, not just the first.
    // The regex captures the content *inside* the parentheses.
    // We then wrap the entire match (including parentheses) in a span.
    return text.replace(/\((.*?)\)/g, '<span class="parenthesized">($1)</span>');
}

// Display the current item
function displayCurrentItem() {
  if (!displayableUnits || displayableUnits.length === 0) {
    tumblerCounter.textContent = "0/0";
    tumblerAbbr.textContent = '';
    tumblerStrategy.textContent = '';
    tumblerChunk.style.display = 'none';
    // Also hide the unchunked row and its dynamic view if they exist
    const unchunkedRow = document.getElementById('unchunked-item-row');
    if (unchunkedRow) unchunkedRow.style.display = 'none';
    const dynamicView = document.getElementById('tumbler-view-dynamic');
    if (dynamicView) dynamicView.style.display = 'none';
    if (tumblerChapterLabel) tumblerChapterLabel.style.display = 'none';
    return;
  }

  // Get references to the new elements for unchunked display
  const unchunkedItemRow = document.getElementById('unchunked-item-row');
  const tumblerViewDynamic = document.getElementById('tumbler-view-dynamic');
  const abbrStrategyWrapper = document.getElementById('abbr-strategy-wrapper');

  // Get the representative item for the current display unit
  const representativeItem = displayableUnits[currentDisplayIndex];

  // Update counter using display indices
  tumblerCounter.textContent = `${currentDisplayIndex + 1}/${totalDisplayItems}`;

  const chunkID = representativeItem.chunkID || 0;
  const itemAbbr = representativeItem.abbr || '';
  const itemStrategy = representativeItem.strategy || '';
  const itemView = representativeItem.view_plane || 'ax'; // Default to 'ax' or ensure it can be empty
  const itemChapter = representativeItem.chapter || '';

  // --- Update Chapter Display ---
  if (tumblerChapterLabel) {
    // Show chapter label if the representative item has a chapter AND it's not a chunk
    // or if it IS a chunk, the chapter is usually associated with the chunk itself.
    // For simplicity, we tie chapter display to the representative item's chapter field.
    if (itemChapter) { 
      tumblerChapterLabel.textContent = itemChapter;
      tumblerChapterLabel.style.display = 'block';
    } else {
      tumblerChapterLabel.textContent = '';
      tumblerChapterLabel.style.display = 'none';
    }
  }

  if (chunkID > 0) { // CHUNK DISPLAY
    // Hide the unchunked item row. This hides view, abbr, and strategy IF they are inside.
    if (unchunkedItemRow) unchunkedItemRow.style.display = 'none';

    // Explicitly hide the original tumblerAbbr and tumblerStrategy elements
    // to prevent them from taking up space if they are outside unchunkedItemRow
    // (e.g., when a chunk is the first item displayed).
    tumblerAbbr.style.display = 'none';
    tumblerStrategy.style.display = 'none';
    
    tumblerChunk.style.display = 'block';
    let chunkHTML = '';
    const itemsInChunk = patternItems.filter(item => item.chunkID === chunkID);
    itemsInChunk.forEach(item => {
      // Make sure to use item.view_plane for chunk item view
      const chunkItemViewText = item.view_plane ? `${item.view_plane} ` : '';
      chunkHTML += `
        <div class="chunk-item">
          <span class="chunk-item-view">${chunkItemViewText}</span>
          <span class="chunk-item-abbr">${item.abbr}</span>
          <span class="chunk-item-strategy">${formatStrategyText(item.strategy)}</span>
        </div>
      `;
    });
    tumblerChunk.innerHTML = chunkHTML;

  } else { // UNCHUNKED ITEM DISPLAY
    tumblerChunk.style.display = 'none'; // Hide chunk container

    // Ensure correct parenting structure for unchunked items
    // Parent unchunkedItemRow should contain tumblerViewDynamic and abbrStrategyWrapper
    if (tumblerViewDynamic.parentNode !== unchunkedItemRow) {
        unchunkedItemRow.appendChild(tumblerViewDynamic);
    }
    if (abbrStrategyWrapper.parentNode !== unchunkedItemRow) {
        unchunkedItemRow.appendChild(abbrStrategyWrapper);
    }

    // Parent abbrStrategyWrapper should contain tumblerAbbr and tumblerStrategy
    if (tumblerAbbr.parentNode !== abbrStrategyWrapper) {
        abbrStrategyWrapper.appendChild(tumblerAbbr);
    }
    if (tumblerStrategy.parentNode !== abbrStrategyWrapper) {
        abbrStrategyWrapper.appendChild(tumblerStrategy);
    }

    // Set content for unchunked items
    tumblerViewDynamic.textContent = itemView ? itemView : ''; // Display view or empty
    tumblerAbbr.textContent = itemAbbr;
    tumblerStrategy.innerHTML = formatStrategyText(itemStrategy);

    // Set visibility of individual elements within the row
    tumblerViewDynamic.style.display = itemView ? 'block' : 'none'; // Show if itemView exists
    tumblerAbbr.style.display = itemAbbr ? 'block' : 'none'; // Show if itemAbbr exists
    tumblerStrategy.style.display = itemStrategy ? 'block' : 'none'; // Show if itemStrategy exists

    unchunkedItemRow.style.display = 'flex'; // Show the row (CSS handles flex properties)

    // Removed the requestAnimationFrame block for wrapped-indented logic
  }

  updateFontSizes(); // Call to update font sizes for all relevant elements
}

// Go to the next item
function nextItem() {
  if (!displayableUnits || displayableUnits.length === 0) {
    return;
  }

  if (currentDisplayIndex >= totalDisplayItems - 1) {
    // Reached the end of displayable units, close tumbler
    window.electronAPI.closeTumbler();
    return;
  } else {
    // Move to the next displayable unit
    currentDisplayIndex++;
  }
  
  displayCurrentItem();
}

// Start the timer
function startTimer() {
  elapsedSeconds = 0;
  updateTimerDisplay();
  
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);
}

// Update the timer display
function updateTimerDisplay() {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  
  // Round time to nearest 10 seconds
  const roundedSeconds = Math.floor(seconds / 10) * 10;
  tumblerTimer.textContent = `${minutes}:${roundedSeconds < 10 ? '0' : ''}${roundedSeconds}`;
}

// Clean up on unload
window.addEventListener('beforeunload', () => {
  clearInterval(timerInterval);
});

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', init); 