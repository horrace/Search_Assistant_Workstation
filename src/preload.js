const { contextBridge, ipcRenderer } = require('electron');

// Set up logging
const log = {
  info: (...args) => console.log('[PRELOAD]', ...args),
  error: (...args) => console.error('[PRELOAD ERROR]', ...args)
};

// Expose a limited API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Window management
  openEditor: () => ipcRenderer.send('open-editor'),
  openTumbler: (patternName) => ipcRenderer.send('open-tumbler', patternName),
  openSettings: () => ipcRenderer.send('open-settings'),
  closeEditor: () => ipcRenderer.send('close-editor'),
  closeTumbler: () => ipcRenderer.send('close-tumbler'),
  closeSettings: () => ipcRenderer.send('close-settings'),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  
  // Settings
  setTransparency: (value) => ipcRenderer.send('set-transparency', value),
  
  // Shortcuts management
  registerShortcuts: () => ipcRenderer.send('register-shortcuts'),
  unregisterShortcuts: () => ipcRenderer.send('unregister-shortcuts'),
  
  // API communication with JavaScript backend
  callAPI: (method, params) => {
    //log.info('Sending message to backend', { method, params });
    ipcRenderer.send('api-request', { method, params });
  },
  
  // Listeners
  onAPIResponse: (callback) => {
    // Create a handler function
    const handler = (event, data) => {
    //   log.info('Received response from backend', { 
    //     method: data.responseFor,
    //     hasError: !!data.error,
    //     hasResult: !!data.result,
    //     resultType: data.result ? (Array.isArray(data.result) ? 'array' : typeof data.result) : 'none'
    //   });
      
      if (data.error) {
        log.error('Response contains error', data.error);
      }
      
      try {
        callback(data);
      } catch (err) {
        log.error('Error in callback', err);
      }
    };
    
    // Register the handler
    ipcRenderer.on('api-response', handler);
    
    // Return a function to remove this specific handler
    return () => {
      //log.info('Removing message handler');
      ipcRenderer.removeListener('api-response', handler);
    };
  },
  
  onPatternSelected: (callback) => {
    const handler = (event, patternName) => {
      //log.info('Pattern selected', patternName);
      callback(patternName);
    };
    ipcRenderer.on('pattern-selected', handler);
    return () => ipcRenderer.removeListener('pattern-selected', handler);
  },
  
  onAdvanceTumbler: (callback) => {
    const handler = (event) => {
      callback();
    };
    ipcRenderer.on('advance-tumbler', handler);
    return () => ipcRenderer.removeListener('advance-tumbler', handler);
  },
  
  // Debug logging
  log: {
    info: (...args) => log.info(...args),
    error: (...args) => log.error(...args)
  },
  
  // Method for invoking main process handlers that return promises
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Send simple one-way messages (e.g., window controls)
  send: (channel, data) => ipcRenderer.send(channel, data),

  // New function to send errors to the main process
  sendErrorToMain: (error) => {
    // Basic serialization for an Error object
    const serializableError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      source: error.source, // Keep these as they might be useful
      lineno: error.lineno,
      colno: error.colno
    };
    try {
      ipcRenderer.send('renderer-error', serializableError);
    } catch (e) {
      // Fallback log if send itself fails, using original console.error if preload's log is broken
      (console.error || console.log)('[Preload] CRITICAL: Error during ipcRenderer.send in sendErrorToMain:', e, 'Failed to send:', serializableError);
    }
  },

  // Listen for one-way messages from main (e.g., pattern selection for tumbler)
  on: (channel, callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  }
});

console.log('Preload script executed, electronAPI exposed.'); 