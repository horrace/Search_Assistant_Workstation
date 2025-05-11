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
  closeEditor: () => ipcRenderer.send('close-editor'),
  closeTumbler: () => ipcRenderer.send('close-tumbler'),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  
  // Settings
  setTransparency: (value) => ipcRenderer.send('set-transparency', value),
  
  // API communication with JavaScript backend
  callAPI: (method, params) => {
    log.info('Sending message to backend', { method, params });
    ipcRenderer.send('api-request', { method, params });
  },
  
  // Listeners
  onAPIResponse: (callback) => {
    // Create a handler function
    const handler = (event, data) => {
      log.info('Received response from backend', { 
        method: data.responseFor,
        hasError: !!data.error,
        hasResult: !!data.result,
        resultType: data.result ? (Array.isArray(data.result) ? 'array' : typeof data.result) : 'none'
      });
      
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
      log.info('Removing message handler');
      ipcRenderer.removeListener('api-response', handler);
    };
  },
  
  onPatternSelected: (callback) => {
    const handler = (event, patternName) => {
      log.info('Pattern selected', patternName);
      callback(patternName);
    };
    ipcRenderer.on('pattern-selected', handler);
    return () => ipcRenderer.removeListener('pattern-selected', handler);
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