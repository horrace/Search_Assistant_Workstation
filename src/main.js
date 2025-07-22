// Set NODE_ENV for development mode BEFORE importing API
process.env.NODE_ENV = 'development';

const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { api } = require('./api'); // Import the JavaScript API
//console.log(">>>> MAIN.JS DEBUG: api object is:", api);
//console.log(">>>> MAIN.JS DEBUG: 'create_pattern' in api:", ('create_pattern' in api));
//if (api && typeof api.create_pattern === 'function') {
    //console.log(">>>> MAIN.JS DEBUG: api.create_pattern function body (first 100 chars):", api.create_pattern.toString().substring(0, 100));
//}

// Hot reload setup in development mode
// Alternative solution: Move settings.json to a directory not watched by electron-reloader
try {
  if (process.env.NODE_ENV === 'development') {
    console.log('Hot reload enabled for development');
    require('electron-reloader')(module, {
      // debug: true, // Enable debug to see what files are being watched
      watchRenderer: true,
      ignore: [
        /node_modules/,
        /\.git/,
        /\.map$/,
        /data[\/\\]/,           // Ignore data directory completely
        /settings\.json$/,      // More specific pattern for settings.json
        /sp_list\.json$/,       // More specific pattern for sp_list.json
      ]
    });
  }
} catch (err) {
  console.error('Error setting up hot reload:', err);
}

// Create a store for app settings
const store = new Store();

// Keep a global reference of the windows to avoid garbage collection
let mainWindow;
let editorWindow;
let tumblerWindow;
let settingsWindow;

// Helper function to ensure window position is within visible bounds
function ensureWindowInBounds(x, y, width, height) {
  // Get all displays
  const displays = screen.getAllDisplays();
  
  // Check if the window would be visible on any display
  let isVisible = false;
  
  for (const display of displays) {
    const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = display.bounds;
    
    // Check if at least 50 pixels of the window would be visible on this display
    const windowRight = x + width;
    const windowBottom = y + height;
    const displayRight = displayX + displayWidth;
    const displayBottom = displayY + displayHeight;
    
    // Check if window intersects with display (with 50px minimum visibility)
    if (x < displayRight - 50 && windowRight > displayX + 50 &&
        y < displayBottom - 50 && windowBottom > displayY + 50) {
      isVisible = true;
      break;
    }
  }
  
  // If window would not be visible, center it on the primary display
  if (!isVisible) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = primaryDisplay.bounds;
    
    // Center the window on the primary display
    x = displayX + Math.floor((displayWidth - width) / 2);
    y = displayY + Math.floor((displayHeight - height) / 2);
    
    console.log(`Window position was off-screen, centering on primary display at: x=${x}, y=${y}`);
  }
  
  return { x, y };
}

function createMainWindow() {
  const savedPosition = api.get_main_window_position();
  let initialX, initialY;
  const windowWidth = 500;
  const windowHeight = 400;
  
  if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
    // Validate the saved position
    const validatedPos = ensureWindowInBounds(savedPosition.x, savedPosition.y, windowWidth, windowHeight);
    initialX = validatedPos.x;
    initialY = validatedPos.y;
    //console.log(`Found saved Main window position: x=${initialX}, y=${initialY}`);
  } else {
    //console.log("No saved Main window position found, using default.");
  }

  mainWindow = new BrowserWindow({
    x: initialX,
    y: initialY,
    width: windowWidth,
    height: windowHeight,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#303030',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Set the opacity from stored settings or default
  const transparency = store.get('transparency', 1.0);
  mainWindow.setOpacity(transparency);
  
  // Save position on move (debounced)
  let moveTimeout;
  mainWindow.on('move', () => {
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const [x, y] = mainWindow.getPosition();
        //console.log(`Main window moved to: x=${x}, y=${y}. Saving position.`);
        api.save_main_window_position({ x, y });
      }
    }, 500);
  });

  // Save position before close
  mainWindow.on('close', () => {
    clearTimeout(moveTimeout); // Clear any pending save on move
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [x, y] = mainWindow.getPosition();
      //console.log(`Main window about to close at: x=${x}, y=${y}. Saving final position.`);
      api.save_main_window_position({ x, y });
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Save initial position once shown
    if (mainWindow && !mainWindow.isDestroyed()) {
        const [x, y] = mainWindow.getPosition();
        //console.log(`Main window shown at: x=${x}, y=${y}. Saving initial position.`);
        api.save_main_window_position({ x, y });
    }
  });
}

function createEditorWindow() {
  const savedPosition = api.get_editor_window_position();
  let initialX, initialY;
  const windowWidth = 800;
  const windowHeight = 700;
  
  if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
    // Validate the saved position
    const validatedPos = ensureWindowInBounds(savedPosition.x, savedPosition.y, windowWidth, windowHeight);
    initialX = validatedPos.x;
    initialY = validatedPos.y;
    //console.log(`Found saved Editor window position: x=${initialX}, y=${initialY}`);
  } else {
    //console.log("No saved Editor window position found, using default.");
  }

  editorWindow = new BrowserWindow({
    x: initialX,
    y: initialY,
    width: windowWidth,
    height: windowHeight,
    parent: mainWindow,
    modal: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#303030',
    show: false
  });

  editorWindow.loadFile(path.join(__dirname, 'editor.html'));
  
  // Editor window should always be fully opaque
  editorWindow.setOpacity(1.0);
  
  // Save position on move (debounced)
  let editorMoveTimeout;
  editorWindow.on('move', () => {
    clearTimeout(editorMoveTimeout);
    editorMoveTimeout = setTimeout(() => {
      if (editorWindow && !editorWindow.isDestroyed()) {
        const [x, y] = editorWindow.getPosition();
        //console.log(`Editor window moved to: x=${x}, y=${y}. Saving position.`);
        api.save_editor_window_position({ x, y });
      }
    }, 500);
  });

  // Save position before close
  editorWindow.on('close', () => {
    clearTimeout(editorMoveTimeout); // Clear any pending save on move
    if (editorWindow && !editorWindow.isDestroyed()) {
      const [x, y] = editorWindow.getPosition();
      //console.log(`Editor window about to close at: x=${x}, y=${y}. Saving final position.`);
      api.save_editor_window_position({ x, y });
    }
  });

  editorWindow.on('closed', () => {
    editorWindow = null;
    mainWindow.show();
  });
  
  editorWindow.once('ready-to-show', () => {
    mainWindow.hide();
    editorWindow.show();
    // Save initial position once shown
    if (editorWindow && !editorWindow.isDestroyed()) {
        const [x, y] = editorWindow.getPosition();
        //console.log(`Editor window shown at: x=${x}, y=${y}. Saving initial position.`);
        api.save_editor_window_position({ x, y });
    }
  });
}

function createTumblerWindow(patternName) {
  const savedPosition = api.get_tumbler_window_position();
  const savedSize = api.get_tumbler_window_size();
  let initialX, initialY;
  let windowWidth = 500; // Default width
  const windowHeight = 300; // Fixed height
  
  // Use saved width if available
  if (savedSize && typeof savedSize.width === 'number') {
    windowWidth = Math.max(300, Math.min(1200, savedSize.width)); // Constrain to min/max
    console.log(`Found saved Tumbler width: ${windowWidth}`);
  } else {
    console.log("No saved Tumbler width found, using default.");
  }

  if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
    // Validate the saved position
    const validatedPos = ensureWindowInBounds(savedPosition.x, savedPosition.y, windowWidth, windowHeight);
    initialX = validatedPos.x;
    initialY = validatedPos.y;
    //console.log(`Found saved Tumbler position: x=${initialX}, y=${initialY}`);
  } else {
    // Default position if none saved (e.g., centered on parent or primary display)
    // For now, let Electron handle default positioning if nothing is saved.
    console.log("No saved Tumbler position found, using default.");
  }

  tumblerWindow = new BrowserWindow({
    x: initialX, // Apply saved X or undefined
    y: initialY, // Apply saved Y or undefined
    width: windowWidth,
    height: windowHeight,
    parent: mainWindow,
    modal: false,
    frame: false,  // No title bar
    titleBarStyle: 'hidden',
    transparent: true, // Re-enable transparency
    hasShadow: false, // Disable window shadow
    alwaysOnTop: true, // Stay on top of other windows
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#00000000', // Fully transparent background
    show: false,
    resizable: true, // Allow resizing
    minWidth: 300, // Minimum width
    maxWidth: 1200, // Maximum width
    minHeight: windowHeight, // Fix height to original
    maxHeight: windowHeight, // Fix height to original
    fullscreenable: false // Prevent fullscreen which can affect size
  });

  tumblerWindow.loadFile(path.join(__dirname, 'tumbler.html'));
  
  // Send the pattern name to the window
  tumblerWindow.webContents.on('did-finish-load', () => {
    tumblerWindow.webContents.send('pattern-selected', patternName);
  });
  
  // Save position on move (debounced)
  let moveTimeout;
  tumblerWindow.on('move', () => {
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      if (tumblerWindow) { // Check if window still exists
        const [x, y] = tumblerWindow.getPosition();
        //console.log(`Tumbler moved to: x=${x}, y=${y}. Saving position.`);
        api.save_tumbler_window_position({ x, y });
      }
    }, 500);
  });
  
  // Save size on resize (debounced)
  let resizeTimeout;
  tumblerWindow.on('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (tumblerWindow && !tumblerWindow.isDestroyed()) {
        const [width, height] = tumblerWindow.getSize();
        //console.log(`Tumbler resized to: width=${width}, height=${height}. Saving size.`);
        api.save_tumbler_window_size({ width, height });
      }
    }, 500);
  });
  
  // Use 'close' event to save position *before* the window is destroyed
  tumblerWindow.on('close', () => {
    clearTimeout(moveTimeout); // Clear any pending save on move
    clearTimeout(resizeTimeout); // Clear any pending save on resize
    
    // Check if tumblerWindow still exists and is not yet destroyed
    // This check is more of a safeguard; 'close' should fire before destruction.
    if (tumblerWindow && !tumblerWindow.isDestroyed()) {
      const [x, y] = tumblerWindow.getPosition();
      const [width, height] = tumblerWindow.getSize();
      //console.log(`Tumbler about to close at: x=${x}, y=${y}, size: ${width}x${height}. Saving final position and size.`);
      api.save_tumbler_window_position({ x, y });
      api.save_tumbler_window_size({ width, height });
    } else {
      console.log("Tumbler window was already destroyed or null before 'close' event finished processing for saving position and size.");
    }
    // It's important that tumblerWindow is nulled *after* any operations on it.
    // And mainWindow.show() should be called after we're done with tumblerWindow.
  });
  
  // Original 'closed' event logic for nullifying and showing main window
  tumblerWindow.on('closed', () => {
    tumblerWindow = null; // Nullify the global reference
    if (mainWindow && !mainWindow.isDestroyed()) { // Ensure mainWindow still exists
        mainWindow.show();
    }
  });
  
  tumblerWindow.once('ready-to-show', () => {
    mainWindow.hide();
    tumblerWindow.show();
    // Save initial position and size once shown, in case it's a new window or defaults were used
    if (tumblerWindow) {
        const [x, y] = tumblerWindow.getPosition();
        const [width, height] = tumblerWindow.getSize();
        //console.log(`Tumbler shown at: x=${x}, y=${y}, size: ${width}x${height}. Saving initial position and size.`);
        api.save_tumbler_window_position({ x, y });
        api.save_tumbler_window_size({ width, height });
    }
  });

  // Workaround for Electron issue #39959 (frameless transparent window artifact on blur/focus)
  if (/^(27|28)\.\d+\.\d+/.test(process.versions.electron) && process.platform === "win32") {
    tumblerWindow.on("blur", () => {
      if (!tumblerWindow) return; // Check if window still exists
      try {
        const [width_39959, height_39959] = tumblerWindow.getSize();
        if (width_39959 > 0 && height_39959 > 0) { // Ensure size is valid
          tumblerWindow.setSize(width_39959, height_39959 + 1, false); // false = no animation
          tumblerWindow.setSize(width_39959, height_39959, false);
        }
      } catch (error) {
        console.error("Error during blur resize workaround:", error);
      }
    });
    tumblerWindow.on("focus", () => {
       if (!tumblerWindow) return; // Check if window still exists
       try {
        const [width_39959, height_39959] = tumblerWindow.getSize();
        if (width_39959 > 0 && height_39959 > 0) { // Ensure size is valid
           tumblerWindow.setSize(width_39959, height_39959 + 1, false);
           tumblerWindow.setSize(width_39959, height_39959, false);
        }
       } catch (error) {
         console.error("Error during focus resize workaround:", error);
       }
    });
  }
}

function createSettingsWindow() {
  const savedPosition = api.get_settings_window_position();
  let initialX, initialY;
  const windowWidth = 700;
  const windowHeight = 600;
  
  if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
    // Validate the saved position
    const validatedPos = ensureWindowInBounds(savedPosition.x, savedPosition.y, windowWidth, windowHeight);
    initialX = validatedPos.x;
    initialY = validatedPos.y;
    console.log(`Found saved Settings window position: x=${initialX}, y=${initialY}`);
  } else {
    // Center the settings window relative to the main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [mainX, mainY] = mainWindow.getPosition();
      const [mainWidth, mainHeight] = mainWindow.getSize();
      
      // Calculate center position
      initialX = mainX + Math.floor((mainWidth - windowWidth) / 2);
      initialY = mainY + Math.floor((mainHeight - windowHeight) / 2);
      
      // Ensure the window is within screen bounds
      const validatedPos = ensureWindowInBounds(initialX, initialY, windowWidth, windowHeight);
      initialX = validatedPos.x;
      initialY = validatedPos.y;
      
      console.log(`No saved Settings window position found, centering relative to main window: x=${initialX}, y=${initialY}`);
    } else {
      // Fallback to screen center if main window not available
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      
      initialX = Math.floor((screenWidth - windowWidth) / 2);
      initialY = Math.floor((screenHeight - windowHeight) / 2);
      
      console.log(`No main window available, centering on screen: x=${initialX}, y=${initialY}`);
    }
  }

  settingsWindow = new BrowserWindow({
    x: initialX,
    y: initialY,
    width: windowWidth,
    height: windowHeight,
    modal: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#303030',
    show: false,
    resizable: true,
    minWidth: 600,
    minHeight: 500,
    alwaysOnTop: false,
    skipTaskbar: false
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  
  // Settings window should always be fully opaque
  settingsWindow.setOpacity(1.0);
  
  // Save position on move (debounced)
  let settingsMoveTimeout;
  settingsWindow.on('move', () => {
    clearTimeout(settingsMoveTimeout);
    settingsMoveTimeout = setTimeout(() => {
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        const [x, y] = settingsWindow.getPosition();
        console.log(`Settings window moved to: x=${x}, y=${y}. Saving position.`);
        api.save_settings_window_position({ x, y });
      }
    }, 500);
  });

  // Save position before close
  settingsWindow.on('close', () => {
    clearTimeout(settingsMoveTimeout); // Clear any pending save on move
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      const [x, y] = settingsWindow.getPosition();
      console.log(`Settings window about to close at: x=${x}, y=${y}. Saving final position.`);
      api.save_settings_window_position({ x, y });
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  settingsWindow.once('ready-to-show', () => {
    // Show settings window first
    settingsWindow.show();
    settingsWindow.focus();
    
    // Then hide main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
    
    // Save initial position once shown
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        const [x, y] = settingsWindow.getPosition();
        console.log(`Settings window shown at: x=${x}, y=${y}. Saving initial position.`);
        api.save_settings_window_position({ x, y });
    }
  });
}

// Global shortcuts management
let registeredShortcuts = [];

function registerGlobalShortcuts() {
  try {
    // Clear any existing shortcuts
    unregisterAllShortcuts();
    
    // Get shortcuts from settings
    const shortcuts = api.get_shortcuts() || [];
    console.log('Registering global shortcuts:', shortcuts);
    
    shortcuts.forEach(shortcut => {
      if (shortcut.enabled && shortcut.accelerator) {
        try {
          const success = globalShortcut.register(shortcut.accelerator, () => {
            console.log(`Global shortcut triggered: ${shortcut.name} (${shortcut.accelerator})`);
            executeShortcutAction(shortcut);
          });
          
          if (success) {
            registeredShortcuts.push(shortcut.accelerator);
            console.log(`Successfully registered shortcut: ${shortcut.accelerator} for ${shortcut.name}`);
          } else {
            console.warn(`Failed to register shortcut: ${shortcut.accelerator} for ${shortcut.name}`);
          }
        } catch (error) {
          console.error(`Error registering shortcut ${shortcut.accelerator}:`, error);
        }
      }
    });
  } catch (error) {
    console.error('Error in registerGlobalShortcuts:', error);
  }
}
function unregisterAllShortcuts() {
  registeredShortcuts.forEach(accelerator => {
    globalShortcut.unregister(accelerator);
  });
  registeredShortcuts = [];
  console.log('Unregistered all global shortcuts');
}
function executeShortcutAction(shortcut) {
  try {
    console.log(`Executing shortcut action: ${shortcut.action}`);
    
    switch (shortcut.action) {
      case 'show-main':
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
        break;
        
      case 'hide-main':
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.hide();
        }
        break;
        
      case 'toggle-main':
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        }
        break;
        
      case 'open-editor':
        if (!editorWindow) createEditorWindow();
        break;
        
      case 'open-tumbler':
        if (shortcut.patternName && !tumblerWindow) {
          createTumblerWindow(shortcut.patternName);
        }
        break;
        
      case 'advance-tumbler':
        console.log('Advance tumbler action triggered');
        console.log('tumblerWindow exists:', !!tumblerWindow);
        if (tumblerWindow) {
          console.log('tumblerWindow.isDestroyed():', tumblerWindow.isDestroyed());
        }
        if (tumblerWindow && !tumblerWindow.isDestroyed()) {
          console.log('Sending advance-tumbler event to tumbler window');
          // Send the nextItem command to the tumbler window
          tumblerWindow.webContents.send('advance-tumbler');
        } else {
          console.log('Tumbler window not available for advance action');
        }
        break;
        
      case 'close-all':
        if (tumblerWindow) tumblerWindow.close();
        if (editorWindow) editorWindow.close();
        break;
        
      case 'quit-app':
        app.quit();
        break;
        
      default:
        console.warn(`Unknown shortcut action: ${shortcut.action}`);
    }
  } catch (error) {
    console.error(`Error executing shortcut action ${shortcut.action}:`, error);
  }
}

// IPC handlers for shortcuts management
ipcMain.on('register-shortcuts', () => {
  registerGlobalShortcuts();
});
ipcMain.on('unregister-shortcuts', () => {
  unregisterAllShortcuts();
});

// IPC handlers for window management
ipcMain.on('open-editor', () => {
  if (!editorWindow) createEditorWindow();
});
ipcMain.on('open-tumbler', (event, patternName) => {
  if (!tumblerWindow) createTumblerWindow(patternName);
});
ipcMain.on('open-settings', () => {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    createSettingsWindow();
  } else {
    // If settings window exists, just focus it
    settingsWindow.show();
    settingsWindow.focus();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  }
});

ipcMain.on('close-editor', () => {
  if (editorWindow) editorWindow.close();
});
ipcMain.on('close-tumbler', () => {
  if (tumblerWindow) tumblerWindow.close();
});
ipcMain.on('close-settings', () => {
  if (settingsWindow) settingsWindow.close();
});

// Listen for errors from the renderer process
ipcMain.on('renderer-error', (event, error) => {
  console.error('--- Renderer Process Error ---');
  console.error('Name:', error.name);
  console.error('Message:', error.message);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  // You could also log to a file here if needed
  // const fs = require('fs');
  // fs.appendFileSync('renderer-errors.log', `${new Date().toISOString()} - ${error.name}: ${error.message}\n${error.stack || ''}\n\n`);
});

// Handle moving the tumbler window
ipcMain.on('move-tumbler-window', (event, data) => {
  if (tumblerWindow) {
    // Calculate target position based on absolute mouse coordinates and initial offset
    const targetX = data.screenX - data.offsetX;
    const targetY = data.screenY - data.offsetY;
    
    // Validate the target position to ensure it's within bounds
    const [width, height] = tumblerWindow.getSize();
    const validatedPos = ensureWindowInBounds(targetX, targetY, width, height);
    
    // Use setPosition with validated coordinates
    tumblerWindow.setPosition(validatedPos.x, validatedPos.y, false); // false = don't animate
  }
});

// Add handler for getting window position
ipcMain.handle('get-window-position', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    return window.getPosition();
  } 
  return [0, 0]; // Default or error case
});

ipcMain.on('set-transparency', (event, value) => {
  // Store the transparency setting
  store.set('transparency', value);
  
  // Apply to main and tumbler windows only (not editor)
  if (mainWindow) mainWindow.setOpacity(value);
  if (tumblerWindow) tumblerWindow.setOpacity(value);
  
  // Update the API setting as well
  api.set_transparency(value);
});

// Handle API requests from the renderer process
ipcMain.on('api-request', (event, data) => {
  //console.log('Received API request:', data);
  
  try {
    const { method, params = {} } = data;
    let result;
    
    // Direct method call to API
    if (method in api) {
      // Convert snake_case to camelCase if needed (for future compatibility)
      const jsMethod = method.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      
      //console.log(`Calling API method: ${jsMethod || method}`);
      
      // Call the method with parameters
      if (typeof api[method] === 'function') {
        // Handle different parameter formats based on the method
        switch (method) {
          case 'get_pattern':
            result = api[method](params.pattern_name);
            break;
            
          case 'get_pattern_with_outro':
            result = api[method](params.pattern_name);
            break;
            
          case 'reload_patterns':
            result = api[method]();
            break;
            
          case 'update_pattern':
            result = api[method](params.pattern_name, params.pattern_data);
            break;
            
          case 'move_item':
            result = api[method](
              params.pattern_name,
              params.from_index,
              params.to_index,
              params.count,
              params.new_chapter,
              params.moved_chapter_name
            );
            break;
            
          case 'update_item':
            result = api[method](params.pattern_name, params.index, params.field, params.value);
            break;
            
          case 'create_chunk':
            result = api[method](params.pattern_name, params.start_index, params.end_index);
            break;
            
          case 'disband_chunk':
            result = api[method](params.pattern_name, params.chunk_id);
            break;
            
          case 'add_item':
            result = api[method](params.pattern_name, params.item_data, params.index);
            break;
            
          case 'delete_item':
            result = api[method](params.pattern_name, params.index, params.count);
            break;
            
          case 'rename_chapter':
            result = api[method](params.pattern_name, params.old_name, params.new_name);
            break;
            
          case 'delete_chapter':
            result = api[method](params.pattern_name, params.chapter_name);
            break;
            
          case 'update_item_chapter':
            result = api[method](
                params.pattern_name,
                params.item_index,
                params.new_chapter,
                params.is_chunk,
                params.chunk_id
            );
            break;
            
           case 'update_chunk':
                result = api[method](params.pattern_name, params.item_index, params.new_chunk_id);
                break;
            
          case 'rename_chunk_id':
                result = api[method](params.pattern_name, params.old_chunk_id, params.new_chunk_id);
                break;
            
          case 'delete_chunk':
                result = api[method](params.pattern_name, params.chunk_id);
                break;
            
          case 'duplicate_item':
            result = api[method](params.pattern_name, params.item_index);
            break;
            
          case 'set_transparency':
            result = api[method](params.value);
            break;
            
          case 'save_tumbler_settings':
            result = api[method](params);
            break;
            
          case 'get_editor_settings':
            result = api[method]();
            break;
            
          case 'save_editor_settings':
            result = api[method](params);
            break;
            
          case 'get_parts_bank':
            result = api[method]();
            break;
            
          case 'get_shortcuts':
            result = api[method]();
            break;
            
          case 'save_shortcuts':
            result = api[method](params);
            break;
            
          case 'update_shortcut':
            result = api[method](params.shortcut_id, params.shortcut_data);
            break;
            
          case 'reset_shortcuts_to_default':
            result = api[method]();
            break;
            
          case 'get_pattern_mirror_options':
            result = api[method](params.pattern_name);
            break;
            
          case 'add_mirrors_to_pattern':
            result = api[method](params.target_pattern, params.mirror_configs);
            break;
            
          case 'update_mirrors_for_pattern':
            result = api[method](params.source_pattern);
            break;
            
          case 'remove_mirrors_from_pattern':
            result = api[method](params.pattern_name, params.mirror_indices);
            break;
            
          case 'replace_with_mirrors':
            result = api[method](params.target_pattern, params.mirror_configs, params.replacement_context);
            break;
            
          default:
            // For simple methods with no parameters or a single parameter object
            result = params && Object.keys(params).length > 0 ? api[method](params) : api[method]();
        }
      } else {
        result = { error: `Method ${method} is not a function` };
      }
    } else {
      result = { error: `Unknown method: ${method}` };
    }
    
    // Send the result back to the renderer
    // console.log(`Sending response for ${method}:`, 
    //   typeof result === 'object' ? 
    //     JSON.stringify(result).substring(0, 100) + (JSON.stringify(result).length > 100 ? '...' : '') : 
    //     result
    // );
    
    // If result is undefined, send an empty array to prevent errors
    if (result === undefined) {
      console.warn(`Warning: Result for ${method} is undefined, sending empty array instead`);
      result = [];
    }
    
    event.sender.send('api-response', {
      responseFor: method,
      result
    });
    
  } catch (error) {
    console.error(`Error processing request: ${error.message}`);
    console.error(error.stack);
    event.sender.send('api-response', {
      responseFor: data.method,
      error: error.message
    });
  }
});

ipcMain.handle('duplicate-item', async (event, pattern_name, item_index) => {
  return api.duplicate_item(pattern_name, item_index);
});

ipcMain.handle('undo-last-action', async (event, pattern_name) => {
  return api.undo_last_action(pattern_name);
});

ipcMain.handle('redo-last-action', async (event, pattern_name) => {
  return api.redo_last_action(pattern_name);
});

// App lifecycle events
app.whenReady().then(() => {
  createMainWindow();
  
  // Register global shortcuts after main window is created
  setTimeout(() => {
    registerGlobalShortcuts();
  }, 1000); // Small delay to ensure everything is initialized
  
  // Listen for display changes and revalidate window positions
  screen.on('display-added', handleDisplayChange);
  screen.on('display-removed', handleDisplayChange);
  screen.on('display-metrics-changed', handleDisplayChange);
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Handle display configuration changes
function handleDisplayChange() {
  console.log('Display configuration changed, validating window positions...');
  
  // Check and reposition main window if needed
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [x, y] = mainWindow.getPosition();
    const [width, height] = mainWindow.getSize();
    const validatedPos = ensureWindowInBounds(x, y, width, height);
    
    if (validatedPos.x !== x || validatedPos.y !== y) {
      mainWindow.setPosition(validatedPos.x, validatedPos.y);
      console.log(`Repositioned main window to: x=${validatedPos.x}, y=${validatedPos.y}`);
    }
  }
  
  // Check and reposition editor window if needed
  if (editorWindow && !editorWindow.isDestroyed()) {
    const [x, y] = editorWindow.getPosition();
    const [width, height] = editorWindow.getSize();
    const validatedPos = ensureWindowInBounds(x, y, width, height);
    
    if (validatedPos.x !== x || validatedPos.y !== y) {
      editorWindow.setPosition(validatedPos.x, validatedPos.y);
      console.log(`Repositioned editor window to: x=${validatedPos.x}, y=${validatedPos.y}`);
    }
  }
  
  // Check and reposition tumbler window if needed
  if (tumblerWindow && !tumblerWindow.isDestroyed()) {
    const [x, y] = tumblerWindow.getPosition();
    const [width, height] = tumblerWindow.getSize();
    const validatedPos = ensureWindowInBounds(x, y, width, height);
    
    if (validatedPos.x !== x || validatedPos.y !== y) {
      tumblerWindow.setPosition(validatedPos.x, validatedPos.y);
      console.log(`Repositioned tumbler window to: x=${validatedPos.x}, y=${validatedPos.y}`);
    }
  }
  
  // Check and reposition settings window if needed
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    const [x, y] = settingsWindow.getPosition();
    const [width, height] = settingsWindow.getSize();
    const validatedPos = ensureWindowInBounds(x, y, width, height);
    
    if (validatedPos.x !== x || validatedPos.y !== y) {
      settingsWindow.setPosition(validatedPos.x, validatedPos.y);
      console.log(`Repositioned settings window to: x=${validatedPos.x}, y=${validatedPos.y}`);
    }
  }
}

app.on('will-quit', () => {
  // Unregister all global shortcuts before quitting
  unregisterAllShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
}); 