// settings.js - Settings window functionality
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const shortcutsList = document.getElementById('shortcuts-list');
  const resetShortcutsBtn = document.getElementById('reset-shortcuts-btn');
  const saveShortcutsBtn = document.getElementById('save-shortcuts-btn');
  const transparencySlider = document.getElementById('transparency-slider');
  const transparencyValue = document.getElementById('transparency-value');
  const hideBackgroundCheckbox = document.getElementById('hide-background');
  const showChapterAsChunkCheckbox = document.getElementById('show-chapter-as-chunk');
  const inlineHeaderLayoutCheckbox = document.getElementById('inline-header-layout');
  const hideViewPlaneInChapterCheckbox = document.getElementById('hide-view-plane-in-chapter');
  const hideOutroInEditorCheckbox = document.getElementById('hide-outro-in-editor');
  const closeBtn = document.getElementById('close-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  
  // State
  let shortcuts = [];
  let currentTransparency = 1.0;

  const TRANSPARENCY_SLIDER_MIN = 0.2;
  const TRANSPARENCY_SLIDER_MAX = 1;
  let hideBackground = false;
  let showChapterAsChunk = false;
  let inlineHeaderLayout = false;
  let hideViewPlaneInChapter = true;
  let editorSettings = {
    hideOutroInEditor: false,
    sidePanelOpen: false,
    sidePanelTab: 'parts-bank'
  };
  
  async function syncTransparencySliderFromMain() {
    if (!transparencySlider || !window.electronAPI.getTransparency) return;
    try {
      let t = await window.electronAPI.getTransparency();
      t = Number(t);
      if (Number.isNaN(t)) t = 1.0;
      t = Math.min(TRANSPARENCY_SLIDER_MAX, Math.max(TRANSPARENCY_SLIDER_MIN, t));
      currentTransparency = t;
      transparencySlider.value = String(t);
      updateTransparencyDisplay();
    } catch (e) {
      console.error('Failed to sync transparency slider:', e);
    }
  }

  // Initialize
  init();
  
  async function init() {
    console.log('Settings window initialized');
    
    await syncTransparencySliderFromMain();
    updateTransparencyDisplay();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load settings
    loadShortcuts();
    loadGeneralSettings();
    loadEditorSettings();
  }
  
  function setupEventListeners() {
    // Window controls
    if (closeBtn) {
      closeBtn.addEventListener('click', closeWindow);
    }
    
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', closeWindow);
    }
    
    // Shortcuts
    if (resetShortcutsBtn) {
      resetShortcutsBtn.addEventListener('click', resetShortcutsToDefault);
    }
    
    if (saveShortcutsBtn) {
      saveShortcutsBtn.addEventListener('click', saveShortcuts);
    }
    
    // General settings
    if (transparencySlider) {
      transparencySlider.addEventListener('input', () => {
        currentTransparency = parseFloat(transparencySlider.value);
        updateTransparencyDisplay();
        window.electronAPI.setTransparency(currentTransparency);
      });
      
      transparencySlider.addEventListener('change', () => {
        saveGeneralSettings();
      });
    }
    
    if (hideBackgroundCheckbox) {
      hideBackgroundCheckbox.addEventListener('change', () => {
        hideBackground = hideBackgroundCheckbox.checked;
        saveGeneralSettings();
      });
    }
    
    if (showChapterAsChunkCheckbox) {
      showChapterAsChunkCheckbox.addEventListener('change', () => {
        showChapterAsChunk = showChapterAsChunkCheckbox.checked;
        saveGeneralSettings();
      });
    }
    
    if (inlineHeaderLayoutCheckbox) {
      inlineHeaderLayoutCheckbox.addEventListener('change', () => {
        inlineHeaderLayout = inlineHeaderLayoutCheckbox.checked;
        saveGeneralSettings();
      });
    }
    
    if (hideViewPlaneInChapterCheckbox) {
      hideViewPlaneInChapterCheckbox.addEventListener('change', () => {
        hideViewPlaneInChapter = hideViewPlaneInChapterCheckbox.checked;
        saveGeneralSettings();
      });
    }
    
    // Editor settings
    if (hideOutroInEditorCheckbox) {
      hideOutroInEditorCheckbox.addEventListener('change', () => {
        editorSettings.hideOutroInEditor = hideOutroInEditorCheckbox.checked;
        saveEditorSettings();
      });
    }
  }
  
  function closeWindow() {
    console.log('Closing settings window');
    window.close();
  }
  
  // Shortcuts management
  function loadShortcuts() {
    console.log('Loading shortcuts from backend');
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      if (data && data.responseFor === 'get_shortcuts') {
        unsubscribe();
        
        if (data.error) {
          console.error('Error loading shortcuts:', data.error);
          showMessage(`Error loading shortcuts: ${data.error}`, 'error');
          return;
        }
        
        if (data.result && Array.isArray(data.result)) {
          console.log('Shortcuts loaded successfully:', data.result);
          shortcuts = data.result;
          renderShortcutsList();
        } else {
          console.error('Invalid shortcuts data format:', data.result);
          showMessage('Error loading shortcuts: Invalid data format', 'error');
        }
      }
    });
    
    window.electronAPI.callAPI('get_shortcuts', {});
  }
  
  function renderShortcutsList() {
    if (!shortcutsList) return;
    
    shortcutsList.innerHTML = '';
    
    shortcuts.forEach((shortcut, index) => {
      const shortcutItem = document.createElement('div');
      shortcutItem.className = 'shortcut-item';
      
      shortcutItem.innerHTML = `
	    <div class="shortcut-enabled">
          <label>
            <input type="checkbox" ${shortcut.enabled ? 'checked' : ''} 
                   data-shortcut-id="${shortcut.id}"> 
          </label>
        </div>
        <div class="shortcut-info">
          <div class="shortcut-name">${shortcut.name}</div>
        </div>
        <input type="text" class="shortcut-key" value="${shortcut.accelerator}" 
               data-shortcut-id="${shortcut.id}" placeholder="e.g., Alt+Q">
      `;
      
      shortcutsList.appendChild(shortcutItem);
    });
    
    // Add event listeners for the inputs
    shortcutsList.querySelectorAll('.shortcut-key').forEach(input => {
      input.addEventListener('change', updateShortcutKey);
      input.addEventListener('keydown', captureShortcutKey);
    });
    
    shortcutsList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', updateShortcutEnabled);
    });
  }
  
  function captureShortcutKey(event) {
    event.preventDefault();
    
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('CmdOrCtrl');
    
    let key = event.key;
    
    // Handle special keys
    if (key === ' ') key = 'Space';
    else if (key === 'Escape') key = 'Escape';
    else if (key === 'Enter') key = 'Return';
    else if (key === 'Tab') key = 'Tab';
    else if (key.startsWith('Arrow')) key = key.replace('Arrow', '');
    else if (key.startsWith('F') && /F\d+/.test(key)) key = key; // Function keys
    else if (key.length === 1) key = key.toUpperCase();
    
    // Don't capture modifier keys alone
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;
    
    const shortcut = [...modifiers, key].join('+');
    event.target.value = shortcut;
    
    // Trigger change event
    event.target.dispatchEvent(new Event('change'));
  }
  
  function updateShortcutKey(event) {
    const shortcutId = event.target.dataset.shortcutId;
    const newAccelerator = event.target.value;
    
    console.log(`Updating shortcut ${shortcutId} accelerator to: ${newAccelerator}`);
    
    const shortcut = shortcuts.find(s => s.id === shortcutId);
    if (shortcut) {
      shortcut.accelerator = newAccelerator;
    }
  }
  
  function updateShortcutEnabled(event) {
    const shortcutId = event.target.dataset.shortcutId;
    const enabled = event.target.checked;
    
    console.log(`Updating shortcut ${shortcutId} enabled to: ${enabled}`);
    
    const shortcut = shortcuts.find(s => s.id === shortcutId);
    if (shortcut) {
      shortcut.enabled = enabled;
    }
  }
  
  function saveShortcuts() {
    console.log('Saving shortcuts:', shortcuts);
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      if (data && data.responseFor === 'save_shortcuts') {
        unsubscribe();
        
        if (data.error) {
          console.error('Error saving shortcuts:', data.error);
          showMessage(`Error saving shortcuts: ${data.error}`, 'error');
          return;
        }
        
        if (data.result && data.result.success) {
          console.log('Shortcuts saved successfully');
          // Re-register shortcuts in the main process
          window.electronAPI.registerShortcuts();
          showMessage('Shortcuts saved and applied successfully!', 'success');
        } else {
          console.error('Failed to save shortcuts:', data.result);
          showMessage('Failed to save shortcuts', 'error');
        }
      }
    });
    
    window.electronAPI.callAPI('save_shortcuts', shortcuts);
  }
  
  function resetShortcutsToDefault() {
    if (!confirm('Are you sure you want to reset all shortcuts to their default values?')) {
      return;
    }
    
    console.log('Resetting shortcuts to default');
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      if (data && data.responseFor === 'reset_shortcuts_to_default') {
        unsubscribe();
        
        if (data.error) {
          console.error('Error resetting shortcuts:', data.error);
          showMessage(`Error resetting shortcuts: ${data.error}`, 'error');
          return;
        }
        
        if (data.result && data.result.success) {
          console.log('Shortcuts reset successfully');
          loadShortcuts(); // Reload shortcuts from backend
          window.electronAPI.registerShortcuts();
          showMessage('Shortcuts reset to defaults!', 'success');
        } else {
          console.error('Failed to reset shortcuts:', data.result);
          showMessage('Failed to reset shortcuts', 'error');
        }
      }
    });
    
    window.electronAPI.callAPI('reset_shortcuts_to_default', {});
  }
  
  // General settings management
  function loadGeneralSettings() {
    console.log('Loading general settings');
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      if (data && data.responseFor === 'get_tumbler_settings') {
        unsubscribe();
        
        if (data.error) {
          console.error('Error loading general settings:', data.error);
          return;
        }
        
        if (data.result && typeof data.result === 'object') {
          if (data.result.error) {
            console.warn('Backend message:', data.result.error);
            return;
          }
          
          hideBackground = data.result.hideBackground || false;
          showChapterAsChunk = data.result.showChapterAsChunk || false;
          inlineHeaderLayout = data.result.inlineHeaderLayout || false;
          hideViewPlaneInChapter = data.result.hideViewPlaneInChapter !== undefined ? data.result.hideViewPlaneInChapter : true;
          if (hideBackgroundCheckbox) {
            hideBackgroundCheckbox.checked = hideBackground;
          }
          if (showChapterAsChunkCheckbox) {
            showChapterAsChunkCheckbox.checked = showChapterAsChunk;
          }
          if (inlineHeaderLayoutCheckbox) {
            inlineHeaderLayoutCheckbox.checked = inlineHeaderLayout;
          }
          if (hideViewPlaneInChapterCheckbox) {
            hideViewPlaneInChapterCheckbox.checked = hideViewPlaneInChapter;
          }
        }
      }
    });
    
    window.electronAPI.callAPI('get_tumbler_settings', {});
  }
  
  function saveGeneralSettings() {
    const settings = {
      hideBackground: hideBackground,
      showChapterAsChunk: showChapterAsChunk,
      inlineHeaderLayout: inlineHeaderLayout,
      hideViewPlaneInChapter: hideViewPlaneInChapter
    };
    
    console.log('Saving general settings:', settings);
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      if (data && data.responseFor === 'save_tumbler_settings') {
        unsubscribe();
        
        if (data.error) {
          console.error('Error saving general settings:', data.error);
          showMessage(`Error saving settings: ${data.error}`, 'error');
          return;
        }
        
        console.log('General settings saved successfully');
      }
    });
    
    window.electronAPI.callAPI('save_tumbler_settings', settings);
  }
  
  // Editor settings management
  function loadEditorSettings() {
    console.log('Loading editor settings');
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      if (data && data.responseFor === 'get_editor_settings') {
        unsubscribe();
        
        if (data.error) {
          console.error('Error loading editor settings:', data.error);
          return;
        }
        
        if (data.result && typeof data.result === 'object') {
          editorSettings = {
            hideOutroInEditor: false,
            sidePanelOpen: false,
            sidePanelTab: 'parts-bank',
            ...data.result
          };
          
          if (hideOutroInEditorCheckbox) {
            hideOutroInEditorCheckbox.checked = editorSettings.hideOutroInEditor;
          }
          
          console.log('Editor settings loaded:', editorSettings);
        }
      }
    });
    
    window.electronAPI.callAPI('get_editor_settings', {});
  }
  
  function saveEditorSettings() {
    console.log('Saving editor settings:', editorSettings);
    
    const unsubscribe = window.electronAPI.onAPIResponse((data) => {
      if (data && data.responseFor === 'save_editor_settings') {
        unsubscribe();
        
        if (data.error) {
          console.error('Error saving editor settings:', data.error);
          showMessage(`Error saving editor settings: ${data.error}`, 'error');
          return;
        }
        
        console.log('Editor settings saved successfully');
        showMessage('Editor settings saved!', 'success');
      }
    });
    
    window.electronAPI.callAPI('save_editor_settings', editorSettings);
  }
  
  function updateTransparencyDisplay() {
    if (transparencyValue) {
      transparencyValue.textContent = `${Math.round(currentTransparency * 100)}%`;
    }
  }
  
  function showMessage(message, type = 'success') {
    // Remove any existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // Trigger animation
    setTimeout(() => {
      messageDiv.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      messageDiv.classList.remove('show');
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.parentNode.removeChild(messageDiv);
        }
      }, 300);
    }, 3000);
  }
}); 