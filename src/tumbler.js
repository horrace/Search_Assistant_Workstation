// DOM Elements
const tumblerCounter = document.getElementById('tumbler-counter');
const closeButton = document.getElementById('close-button');
const tumblerAbbr = document.getElementById('tumbler-abbr');
const tumblerStrategy = document.getElementById('tumbler-strategy');
const tumblerChunk = document.getElementById('tumbler-chunk');
const decreaseFontBtn = document.getElementById('decrease-font');
const increaseFontBtn = document.getElementById('increase-font');
const tumblerTimer = document.getElementById('tumbler-timer');
const tumblerContainer = document.querySelector('.tumbler-container');
const tumblerHeader = document.querySelector('.tumbler-header');

// State
let currentPattern = '';
let patternItems = [];
let currentItemIndex = 0;
let totalItems = 0;
let elapsedSeconds = 0;
let timerInterval = null;
let fontScaleFactor = 1.0;
let hideBackground = false;

// Font size base values
const abbrBaseFontSize = 24;
const strategyBaseFontSize = 14;
const chunkItemAbbrBaseFontSize = 16;
const chunkItemStrategyBaseFontSize = 14;

// Initialize the application
function init() {
  // Get the pattern name from the main process
  window.electronAPI.onPatternSelected((patternName) => {
    currentPattern = patternName;
    loadPattern(patternName);
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
    if (data && Array.isArray(data.result)) {
      patternItems = data.result;
      totalItems = patternItems.length;
      currentItemIndex = 0;
      displayCurrentItem();
    }
  });
}

// Update font sizes based on scale factor
function updateFontSizes() {
  tumblerAbbr.style.fontSize = `${abbrBaseFontSize * fontScaleFactor}px`;
  tumblerStrategy.style.fontSize = `${strategyBaseFontSize * fontScaleFactor}px`;
  
  // Update chunk item font sizes if visible
  document.querySelectorAll('.chunk-item-abbr').forEach(el => {
    el.style.fontSize = `${chunkItemAbbrBaseFontSize * fontScaleFactor}px`;
  });
  
  document.querySelectorAll('.chunk-item-strategy').forEach(el => {
    el.style.fontSize = `${chunkItemStrategyBaseFontSize * fontScaleFactor}px`;
  });
}

// Display the current item
function displayCurrentItem() {
  if (!patternItems || patternItems.length === 0) {
    return;
  }
  
  const item = patternItems[currentItemIndex];
  
  // Update counter
  tumblerCounter.textContent = `${currentItemIndex + 1}/${totalItems}`;
  
  // Check if current item is part of a chunk
  const chunkID = item.chunkID || 0;
  
  if (chunkID > 0) {
    // --- Chunk Item Display ---
    // Hide the main abbreviation and strategy elements
    tumblerAbbr.style.display = 'none';
    tumblerStrategy.style.display = 'none';
    
    // Find all items in this chunk
    const chunkItems = patternItems.filter(i => (i.chunkID || 0) === chunkID);
    
    // Render chunk items
    let html = '';
    chunkItems.forEach(chunkItem => {
      html += `
        <div class="chunk-item">
          <div class="chunk-item-abbr">${chunkItem.abbr || ''}</div>
          ${chunkItem.strategy ? `<div class="chunk-item-strategy">${chunkItem.strategy}</div>` : ''}
        </div>
      `;
    });
    
    tumblerChunk.innerHTML = html;
    tumblerChunk.style.display = 'block'; // Show the chunk container
    
    // Apply current background visibility to newly created chunk items
    if (hideBackground) {
      const chunkElements = document.querySelectorAll('.chunk-item-abbr, .chunk-item-strategy');
      chunkElements.forEach(el => {
        el.style.backgroundColor = 'transparent';
      });
    }
  } else {
    // --- Single Item Display ---
    // Show the main abbreviation and strategy elements
    tumblerAbbr.style.display = 'block';
    tumblerStrategy.style.display = 'block';
    
    // Update abbreviation and strategy text
    tumblerAbbr.textContent = item.abbr || '';
    tumblerStrategy.textContent = item.strategy || '';
    
    // Hide the chunk container
    tumblerChunk.style.display = 'none';
  }
  
  // Update font sizes (now applies to either main or chunk elements based on visibility)
  updateFontSizes();
}

// Go to the next item
function nextItem() {
  if (!patternItems || patternItems.length === 0) {
    return;
  }
  
  const currentItem = patternItems[currentItemIndex];
  const currentChunkID = currentItem.chunkID || 0;
  
  if (currentItemIndex >= patternItems.length - 1) {
    // Reached the end, return to the main page instead of wrapping
    window.electronAPI.closeTumbler();
    return;
  } else {
    // Check if we're in a chunk and need to skip to the next chunk
    if (currentChunkID > 0) {
      // Find the first item after this chunk
      let i = currentItemIndex + 1;
      while (i < patternItems.length) {
        if ((patternItems[i].chunkID || 0) !== currentChunkID) {
          currentItemIndex = i;
          displayCurrentItem();
          return;
        }
        i++;
      }
      // If no item found after this chunk, also return to main page
      window.electronAPI.closeTumbler();
      return;
    } else {
      // Move to the next item
      currentItemIndex++;
    }
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