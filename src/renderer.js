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
      originalConsoleError('[Renderer] Error sending console.error to main process:', e, e.stack);
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
      originalConsoleError('[Renderer] Error sending window.onerror to main process:', e, e.stack);
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
      originalConsoleError('[Renderer] Error sending onunhandledrejection to main process:', e, e.stack);
    }
  };

} else {
  console.error("[Renderer] CRITICAL SETUP FAILURE: 'window.electronAPI' or 'window.electronAPI.sendErrorToMain' is not available. Error reporting to main process is DISABLED.");
}

// Main renderer process for the application
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const patternList = document.getElementById('pattern-list');
  const editButton = document.getElementById('edit-button');
  const transparencySlider = document.getElementById('transparency-slider');
  const transparencyValue = document.getElementById('transparency-value');
  const errorMessage = document.getElementById('error-message');
  
  // Current state
  let patterns = [];
  let currentTransparency = 1.0;
  
  // Initialize the application
  init();
  
  // Initialize the application
  function init() {
    // Update transparency display
    updateTransparencyDisplay();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load patterns
    loadPatterns();
    
    // Load settings
    loadSettings();
    
    // Log for debugging
    console.log('Application initialized');
    if (window.electronAPI.log) {
      window.electronAPI.log.info('Renderer initialized');
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Edit button
    if (editButton) {
      editButton.addEventListener('click', () => {
        console.log('Edit button clicked');
        window.electronAPI.openEditor();
      });
    }
    
    // Refresh button (development only)
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        console.log('Refresh button clicked');
        window.location.reload();
      });
    }
    
    // Settings button
    const settingsButton = document.getElementById('settings-button');
    const settingsMenu = document.getElementById('settings-menu');
    
    if (settingsButton && settingsMenu) {
      settingsButton.addEventListener('click', () => {
        const isVisible = settingsMenu.style.display === 'block';
        settingsMenu.style.display = isVisible ? 'none' : 'block';
      });
      
      // Close menu when clicking outside the button AND outside the menu itself
      document.addEventListener('click', (event) => {
        if (settingsMenu.style.display === 'block' && 
            !settingsButton.contains(event.target) && 
            !settingsMenu.contains(event.target)) {
          settingsMenu.style.display = 'none';
        }
      });
    }
    
    // Transparency slider
    if (transparencySlider) {
      // Stop propagation on mousedown to prevent closing menu prematurely
      transparencySlider.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });
      transparencySlider.addEventListener('input', () => { 
        // No stopPropagation here, let document listener handle clicks outside
        currentTransparency = parseFloat(transparencySlider.value);
        updateTransparencyDisplay();
        window.electronAPI.setTransparency(currentTransparency);
        // Consider saving on 'change' event instead if 'input' saves too often
      });
      transparencySlider.addEventListener('change', () => { 
          // Save setting when user finishes interacting with slider
          saveSettings(); 
      });
    }
    
    
    // Settings window management
    setupSettingsEventListeners();
  }
  
  // Load settings
  function loadSettings() {
    // Try to get settings from backend
    window.electronAPI.callAPI('get_tumbler_settings', {});
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      if (data && data.responseFor === 'get_tumbler_settings') {
        unsubscribe();
        
        if (data.error) {
          console.error('Error loading settings:', data.error);
          return;
        }
        
        if (data.result && typeof data.result === 'object') {
          // If there's an error in the result, the API method might not exist yet
          if (data.result.error) {
            console.warn('Backend message:', data.result.error);
            return;
          }
          
        }
      }
    });
  }
  
  // Save settings
  function saveSettings() {
    // Settings are now managed in the settings window
    // This function is kept for potential future local settings
  }
  
  // Update transparency display
  function updateTransparencyDisplay() {
    if (transparencyValue) {
      transparencyValue.textContent = `${Math.round(currentTransparency * 100)}%`;
    }
  }
  
  // Load patterns from the backend
  function loadPatterns() {
    try {
      // Only show loading indicator if no patterns are loaded yet
      if (!patterns || patterns.length === 0) {
        patternList.innerHTML = '<div class="loading-indicator">Loading patterns...</div>';
      }
      
      console.log("Requesting patterns from backend");
      
      // Create a pattern received handler
      const unsubscribe = window.electronAPI.onAPIResponse((data) => {
        console.log('Received backend response', {
          responseType: data.responseFor,
          hasError: !!data.error,
          hasResult: !!data.result
        });
        
        // Only process responses for the patterns request
        if (data && data.responseFor === 'get_available_patterns') {
          console.log('Processing response for get_available_patterns');
          
          if (data.error) {
            console.error('Error from backend:', data.error);
            showError(`Error loading patterns: ${data.error}`);
            patternList.innerHTML = `<div class="loading-indicator error">Error loading patterns: ${data.error}</div>`;
            
            // Add a retry button
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Retry';
            retryButton.className = 'retry-button';
            retryButton.addEventListener('click', () => {
              console.log('Retry button clicked');
              if (unsubscribe) unsubscribe();
              loadPatterns();
            });
            
            patternList.appendChild(retryButton);
            unsubscribe();
            return;
          }
          
          // Check if result exists and is an array
          if (data.result && Array.isArray(data.result)) {
            console.log('Patterns loaded successfully:', data.result);
            patterns = data.result;
            renderPatternList();
          } else {
            console.error('Invalid pattern data format:', data.result);
            
            patternList.innerHTML = '<div class="loading-indicator error">Error loading patterns: Invalid data format</div>';
            
            // Add a retry button
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Retry';
            retryButton.className = 'retry-button';
            retryButton.addEventListener('click', () => {
              console.log('Retry button clicked');
              if (unsubscribe) unsubscribe();
              loadPatterns();
            });
            
            patternList.appendChild(retryButton);
          }
          
          unsubscribe();
        }
      });
      
      // Send request to backend
      window.electronAPI.callAPI('get_available_patterns', {});
      
    } catch (error) {
      console.error('Error loading patterns:', error);
      showError(`Error loading patterns: ${error.message}`);
      patternList.innerHTML = `<div class="loading-indicator error">Error loading patterns: ${error.message}</div>`;
      
      // Add a retry button
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Retry';
      retryButton.className = 'retry-button';
      retryButton.addEventListener('click', loadPatterns);
      
      patternList.appendChild(retryButton);
    }
  }
  
  // Render the pattern list
  function renderPatternList() {
    console.log('Rendering pattern list with', patterns.length, 'patterns');
    
    if (!patterns || patterns.length === 0) {
      patternList.innerHTML = '<div class="loading-indicator">No patterns available</div>';
      return;
    }
    
    // Clear pattern list
    patternList.innerHTML = '';
    
    // Create pattern items as grid (filter out Outro pattern)
    patterns.filter(pattern => pattern !== 'Outro').forEach(pattern => {
      const patternItem = document.createElement('div');
      patternItem.className = 'pattern-item';
      patternItem.setAttribute('data-pattern', pattern);
      
      const title = document.createElement('h2');
      title.textContent = pattern;
      
      const divider = document.createElement('div');
      divider.className = 'pattern-item-divider';
      
      patternItem.appendChild(title);
      patternItem.appendChild(divider);
      
      // Add click event listener
      patternItem.addEventListener('click', () => {
        const patternName = patternItem.getAttribute('data-pattern');
        console.log('Pattern item clicked:', patternName);
        openTumblerView(patternName);
      });
      
      patternList.appendChild(patternItem);
    });
    
    console.log('Pattern list rendered successfully');
  }
  
  // Open the pattern tumbler view
  function openTumblerView(patternName) {
    console.log('Opening tumbler view for pattern:', patternName);
    window.electronAPI.openTumbler(patternName);
  }
  
  // Show an error message
  function showError(message) {
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        errorMessage.style.display = 'none';
      }, 5000);
    } else {
      console.error('Error message element not found, message was:', message);
    }
  }

  // Settings window management functions
  function setupSettingsEventListeners() {
    const settingsButton = document.getElementById('settings-button-main');
    
    if (settingsButton) {
      settingsButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openSettingsWindow();
      });
    }
  }
  
  function openSettingsWindow() {
    console.log('Opening settings window');
    window.electronAPI.openSettings();
  }

  // Custom window controls
  const closeButton = document.getElementById('close-main-btn');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      window.close(); // Close the main window (should trigger app quit)
    });
  } else {
    console.error('Could not find main window close button');
  }
}); 