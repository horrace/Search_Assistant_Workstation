const { app, BrowserWindow, ipcMain } = require('electron');
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
      watchRenderer: true
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
  mainWindow = new BrowserWindow({
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
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

function createEditorWindow() {
  editorWindow = new BrowserWindow({
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
  
  editorWindow.on('closed', () => {
    editorWindow = null;
    mainWindow.show();
  });
  
  editorWindow.once('ready-to-show', () => {
    mainWindow.hide();
    editorWindow.show();
  });
}

function createTumblerWindow(patternName) {
  tumblerWindow = new BrowserWindow({
    width: 400,
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
  
  tumblerWindow.on('closed', () => {
    tumblerWindow = null;
    mainWindow.show();
  });
  
  tumblerWindow.once('ready-to-show', () => {
    mainWindow.hide();
    tumblerWindow.show();
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
            
          case 'set_transparency':
            result = api[method](params.value);
            break;
            
          case 'save_tumbler_settings':
            result = api[method](params);
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