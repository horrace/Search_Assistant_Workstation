const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { api } = require('./api'); // Import the JavaScript API

// Set NODE_ENV for development mode
process.env.NODE_ENV = 'development';

// Hot reload setup in development mode
try {
  if (process.env.NODE_ENV === 'development') {
    console.log('Hot reload enabled for development');
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true,
      ignore: ['*.json', 'sp_list.json', 'settings.json']
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

function createMainWindow() {
  const savedPosition = api.get_main_window_position();
  let initialX, initialY;
  if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
    initialX = savedPosition.x;
    initialY = savedPosition.y;
    console.log(`Found saved Main window position: x=${initialX}, y=${initialY}`);
  } else {
    console.log("No saved Main window position found, using default.");
  }

  mainWindow = new BrowserWindow({
    x: initialX,
    y: initialY,
    width: 500,
    height: 400,
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
        console.log(`Main window moved to: x=${x}, y=${y}. Saving position.`);
        api.save_main_window_position({ x, y });
      }
    }, 500);
  });

  // Save position before close
  mainWindow.on('close', () => {
    clearTimeout(moveTimeout); // Clear any pending save on move
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [x, y] = mainWindow.getPosition();
      console.log(`Main window about to close at: x=${x}, y=${y}. Saving final position.`);
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
        console.log(`Main window shown at: x=${x}, y=${y}. Saving initial position.`);
        api.save_main_window_position({ x, y });
    }
  });
}

function createEditorWindow() {
  const savedPosition = api.get_editor_window_position();
  let initialX, initialY;
  if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
    initialX = savedPosition.x;
    initialY = savedPosition.y;
    console.log(`Found saved Editor window position: x=${initialX}, y=${initialY}`);
  } else {
    console.log("No saved Editor window position found, using default.");
  }

  editorWindow = new BrowserWindow({
    x: initialX,
    y: initialY,
    width: 800,
    height: 700,
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
        console.log(`Editor window moved to: x=${x}, y=${y}. Saving position.`);
        api.save_editor_window_position({ x, y });
      }
    }, 500);
  });

  // Save position before close
  editorWindow.on('close', () => {
    clearTimeout(editorMoveTimeout); // Clear any pending save on move
    if (editorWindow && !editorWindow.isDestroyed()) {
      const [x, y] = editorWindow.getPosition();
      console.log(`Editor window about to close at: x=${x}, y=${y}. Saving final position.`);
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
        console.log(`Editor window shown at: x=${x}, y=${y}. Saving initial position.`);
        api.save_editor_window_position({ x, y });
    }
  });
}

function createTumblerWindow(patternName) {
  const savedPosition = api.get_tumbler_window_position();
  let initialX, initialY;

  if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
    initialX = savedPosition.x;
    initialY = savedPosition.y;
    console.log(`Found saved Tumbler position: x=${initialX}, y=${initialY}`);
  } else {
    // Default position if none saved (e.g., centered on parent or primary display)
    // For now, let Electron handle default positioning if nothing is saved.
    console.log("No saved Tumbler position found, using default.");
  }

  tumblerWindow = new BrowserWindow({
    x: initialX, // Apply saved X or undefined
    y: initialY, // Apply saved Y or undefined
    width: 500,
    height: 300,
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
    resizable: false, // Prevent user resizing which can interfere with dragging
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
        console.log(`Tumbler moved to: x=${x}, y=${y}. Saving position.`);
        api.save_tumbler_window_position({ x, y });
      }
    }, 500); // Debounce for 500ms
  });
  
  // Use 'close' event to save position *before* the window is destroyed
  tumblerWindow.on('close', () => {
    clearTimeout(moveTimeout); // Clear any pending save on move
    
    // Check if tumblerWindow still exists and is not yet destroyed
    // This check is more of a safeguard; 'close' should fire before destruction.
    if (tumblerWindow && !tumblerWindow.isDestroyed()) {
      const [x, y] = tumblerWindow.getPosition();
      console.log(`Tumbler about to close at: x=${x}, y=${y}. Saving final position.`);
      api.save_tumbler_window_position({ x, y });
    } else {
      console.log("Tumbler window was already destroyed or null before 'close' event finished processing for saving position.");
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
    // Save initial position once shown, in case it's a new window or position was defaulted
    if (tumblerWindow) {
        const [x, y] = tumblerWindow.getPosition();
        console.log(`Tumbler shown at: x=${x}, y=${y}. Saving initial position.`);
        api.save_tumbler_window_position({ x, y });
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

// IPC handlers for window management
ipcMain.on('open-editor', () => {
  if (!editorWindow) createEditorWindow();
});

ipcMain.on('open-tumbler', (event, patternName) => {
  if (!tumblerWindow) createTumblerWindow(patternName);
});

ipcMain.on('close-editor', () => {
  if (editorWindow) editorWindow.close();
});

ipcMain.on('close-tumbler', () => {
  if (tumblerWindow) tumblerWindow.close();
});

// Handle moving the tumbler window
ipcMain.on('move-tumbler-window', (event, data) => {
  if (tumblerWindow) {
    // Calculate target position based on absolute mouse coordinates and initial offset
    const targetX = data.screenX - data.offsetX;
    const targetY = data.screenY - data.offsetY;
    
    // Use setPosition with calculated absolute coordinates
    tumblerWindow.setPosition(targetX, targetY, false); // false = don't animate
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
  console.log('Received API request:', data);
  
  try {
    const { method, params = {} } = data;
    let result;
    
    // Direct method call to API
    if (method in api) {
      // Convert snake_case to camelCase if needed (for future compatibility)
      const jsMethod = method.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      
      console.log(`Calling API method: ${jsMethod || method}`);
      
      // Call the method with parameters
      if (typeof api[method] === 'function') {
        // Handle different parameter formats based on the method
        switch (method) {
          case 'get_pattern':
            result = api[method](params.pattern_name);
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
            
          case 'set_transparency':
            result = api[method](params.value);
            break;
            
          case 'save_tumbler_settings':
            result = api[method](params);
            break;
            
          case 'get_parts_bank':
            result = api[method]();
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
    console.log(`Sending response for ${method}:`, 
      typeof result === 'object' ? 
        JSON.stringify(result).substring(0, 100) + (JSON.stringify(result).length > 100 ? '...' : '') : 
        result
    );
    
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

// App lifecycle events
app.whenReady().then(() => {
  createMainWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
}); 