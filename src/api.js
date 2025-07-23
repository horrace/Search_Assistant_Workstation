// api.js - JavaScript implementation of the Search Pattern API
const fs = require('fs');
const path = require('path');
const { app } = require('electron');


class SearchPatternAPI {
  constructor() {
    this.patterns = {};
    this.current_pattern = "CThead";
    this.settings = { "transparency": 1.0, "tumbler": {} };
    this.patternHistory = {}; // Added for undo functionality
    this.patternRedoHistory = {}; // Added for redo functionality
    this.maxHistoryLength = 50; // Limit undo/redo history per pattern
    
    // Initialize paths
    this.appPath = app.getAppPath();
    console.log('App path:', this.appPath);
    
    // Determine if we're in development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    console.log('Running in development mode:', isDevelopment);
    
    const executableDir = path.dirname(process.execPath);
    console.log('Executable directory:', executableDir);
    
    // Configure data locations based on mode
    if (isDevelopment) {
      // Development mode: prioritize project directories
      this.dataLocations = [
        path.join(this.appPath, 'src'),                  // Check in src directory first
        path.join(this.appPath),                         // Check in app root
        path.dirname(this.appPath),                      // Check in parent directory
        path.join(app.getPath('userData')),              // Check in user data directory
        path.join(app.getPath('userData'), 'data'),      // Check in user data/data directory
        executableDir,                                   // Directory next to executable (last resort)
      ];
      this.dataDir = this.dataLocations[0]; // Default to src directory in development
    } else {
      // Production mode: ONLY use executable directory (true portable mode)
      this.dataLocations = [
        executableDir,                                   // Directory next to executable (portable) - ONLY location
      ];
      this.dataDir = this.dataLocations[0]; // Default to executable directory in production
    }
    
    // Log all potential locations
    console.log('Checking these locations for data files (priority order):');
    this.dataLocations.forEach((location, index) => console.log(`${index + 1}. ${location}`));
    
    // Initialize portable data files if needed
    this.initializePortableFiles();
    
    // Try to load existing patterns and settings
    this.load_patterns();
    this.load_settings();
    
    console.log('SearchPatternAPI initialized');
  }
  
  /**
   * Initialize data files (passive approach to avoid security software detection)
   */
  initializePortableFiles() {
    // We'll be passive - only create files when the user actually saves data
    // This avoids triggering security software that monitors file creation on startup
    
    const primaryDataDir = this.dataLocations[0];
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      console.log('Development mode ready - data files will be created in project directory when needed:', primaryDataDir);
    } else {
      console.log('True portable mode - data files will ONLY be created in executable directory:', primaryDataDir);
      console.log('No fallback locations - executable directory must be writable for app to function');
    }
    
    // Note: We don't test write permissions or create files proactively anymore
    // Files will be created naturally when the user saves patterns or settings
  }
  
  /**
   * Find file in possible locations
   */
  findFile(filename) {
    for (const location of this.dataLocations) {
      const filePath = path.join(location, filename);
      console.log(`Checking for ${filename} at: ${filePath}`);
      if (fs.existsSync(filePath)) {
        console.log(`Found ${filename} at: ${filePath}`);
        return filePath;
      }
    }
    console.log(`Could not find ${filename} in any location`);
    return null;
  }
  
  /**
   * Load patterns from sp_list.json
   */
  load_patterns() {
    try {
      // Try to find sp_list.json in any of our locations
      const sp_list_path = this.findFile('sp_list.json');
      
      this.patternHistory = {}; // Reset history on load

      if (sp_list_path) {
        const data = fs.readFileSync(sp_list_path, 'utf8');
        this.patterns = JSON.parse(data);
        //console.log(`Loaded patterns for ${Object.keys(this.patterns).length} modality/parts`);
        
        // Remember this directory for future saves
        this.dataDir = path.dirname(sp_list_path);
      } else {
        console.log('No existing sp_list.json found, patterns will be an empty object until saved');
        this.patterns = {};
      }
    } catch (error) {
      console.error(`Error loading patterns: ${error.message}`);
      console.error(error.stack);
      // Fall back to empty patterns
      this.patterns = {};
    }
  }
  
  /**
   * Load settings from settings.json if it exists
   */
  load_settings() {
    try {
      // Try to find settings.json in any of our locations
      const settings_path = this.findFile('settings.json');
      
      if (settings_path) {
        const data = fs.readFileSync(settings_path, 'utf8');
        this.settings = JSON.parse(data);
        //console.log("Settings loaded successfully");
        
        // Remember this directory for future saves if not already set
        if (!this.dataDir) {
          this.dataDir = path.dirname(settings_path);
        }
      }
    } catch (error) {
      console.error(`Error loading settings: ${error.message}`);
    }
  }
  
  /**
   * Save patterns to sp_list.json (with fallback for portable mode)
   */
  save_patterns() {
    try {
      // Log a snippet of the data about to be saved for the first pattern found
      if (this.patterns && Object.keys(this.patterns).length > 0) {
        const firstPatternName = Object.keys(this.patterns)[0];
        const firstPatternSample = this.patterns[firstPatternName];
        if (firstPatternSample && firstPatternSample.length > 0) {
          console.log(`[API save_patterns] Data for pattern '${firstPatternName}' before stringify - First item chapter: ${firstPatternSample[0]?.chapter}, chunkID: ${firstPatternSample[0]?.chunkID}`);
        }
      }

      const data_to_save = JSON.stringify(this.patterns, null, 2);
      
      // Try to save to each location until one succeeds
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      for (const location of this.dataLocations) {
        try {
          // Create the directory if it doesn't exist
          if (!fs.existsSync(location)) {
            fs.mkdirSync(location, { recursive: true });
          }
          
          const sp_list_path = path.join(location, 'sp_list.json');
          fs.writeFileSync(sp_list_path, data_to_save);
          
          // If successful, update our data directory and return
          this.dataDir = location;
          console.log("[API save_patterns] Patterns saved successfully to:", sp_list_path);
          return true;
          
        } catch (locationError) {
          if (isDevelopment) {
            console.log(`[API save_patterns] Cannot write to ${location}: ${locationError.message}`);
            // Continue to next location in development mode
          } else {
            // In production (portable) mode, there's only one location - fail immediately with clear message
            console.error(`[API save_patterns] PORTABLE MODE ERROR: Cannot write to executable directory ${location}: ${locationError.message}`);
            console.error("[API save_patterns] The executable directory must be writable for the portable app to function");
            return false;
          }
        }
      }
      
      // If we get here, all locations failed (only possible in development mode)
      console.error("[API save_patterns] Failed to save to any location");
      return false;
      
    } catch (error) {
      console.error(`Error saving patterns: ${error.message}`);
      console.error(error.stack);
      return false;
    }
  }
  
  /**
   * Save settings to settings.json (with fallback for portable mode)
   */
  save_settings() {
    try {
      const data_to_save = JSON.stringify(this.settings, null, 2);
      
      // Try to save to each location until one succeeds
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      for (const location of this.dataLocations) {
        try {
          // Create the directory if it doesn't exist
          if (!fs.existsSync(location)) {
            fs.mkdirSync(location, { recursive: true });
          }
          
          const settings_path = path.join(location, 'settings.json');
          fs.writeFileSync(settings_path, data_to_save);
          
          // If successful, update our data directory and return
          this.dataDir = location;
          console.log("[API save_settings] Settings saved successfully to:", settings_path);
          return true;
          
        } catch (locationError) {
          if (isDevelopment) {
            console.log(`[API save_settings] Cannot write to ${location}: ${locationError.message}`);
            // Continue to next location in development mode
          } else {
            // In production (portable) mode, there's only one location - fail immediately with clear message
            console.error(`[API save_settings] PORTABLE MODE ERROR: Cannot write to executable directory ${location}: ${locationError.message}`);
            console.error("[API save_settings] The executable directory must be writable for the portable app to function");
            return false;
          }
        }
      }
      
      // If we get here, all locations failed (only possible in development mode)
      console.error("[API save_settings] Failed to save settings to any location");
      return false;
      
    } catch (error) {
      console.error(`Error saving settings: ${error.message}`);
      console.error(error.stack);
      return false;
    }
  }
  
  /**
   * Get a list of all available patterns
   */
  get_available_patterns() {
    try {
      // Get patterns from saved data
      let patterns = Object.keys(this.patterns);
      //console.log("Patterns in memory:", patterns);
      //console.log(`Retrieved ${patterns.length} patterns: ${patterns}`);
      
      // Ensure we always return a list, even if empty
      return patterns.length ? patterns : [];
    } catch (error) {
      console.error(`Error in get_available_patterns: ${error.message}`);
      console.error(error.stack);
      return [];
    }
  }

  /**
   * Reload patterns from disk (useful when patterns file is updated externally)
   */
  reload_patterns() {
    try {
      console.log('Reloading patterns from disk...');
      this.load_patterns();
      const patternCount = Object.keys(this.patterns).length;
      console.log(`Reloaded ${patternCount} patterns successfully`);
      return { success: true, pattern_count: patternCount, patterns: Object.keys(this.patterns) };
    } catch (error) {
      console.error(`Error reloading patterns: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get a specific pattern by name
   */
  get_pattern(pattern_name) {
    // Check if pattern_name is a string
    if (typeof pattern_name !== 'string') {
      console.error('Invalid pattern_name type, expected string');
      return []; // Return empty array or an error object: { success: false, error: "Invalid pattern_name" }
    }
    
    try {
      if (pattern_name in this.patterns) {
        //console.log(`Pattern data for ${pattern_name}: Found ${this.patterns[pattern_name].length} items`);
        return this.patterns[pattern_name];
      } else {
        console.log(`Pattern not found: ${pattern_name}`);
        // For consistency with get_available_patterns, return empty array if not found.
        // Or, return an error object if preferred: return { success: false, error: "Pattern not found" };
        return []; 
      }
    } catch (error) {
      console.error(`Error in get_pattern: ${error.message}`);
      console.error(error.stack);
      return []; // Or an error object
    }
  }

  /**
   * Get a specific pattern by name with Outro automatically appended (for tumbler display)
   */
  get_pattern_with_outro(pattern_name) {
    // Check if pattern_name is a string
    if (typeof pattern_name !== 'string') {
      console.error('Invalid pattern_name type, expected string');
      return [];
    }
    
    try {
      // Don't append Outro to itself
      if (pattern_name === 'Outro') {
        return this.get_pattern(pattern_name);
      }
      
      const basePattern = this.get_pattern(pattern_name);
      const outroPattern = this.get_pattern('Outro');
      
      // If no Outro pattern exists, just return the base pattern
      if (!outroPattern || outroPattern.length === 0) {
        return basePattern;
      }
      
      // Create a deep copy of the base pattern and append Outro items
      const result = JSON.parse(JSON.stringify(basePattern));
      
      // Mark Outro items to distinguish them visually
      const outroItems = outroPattern.map(item => ({
        ...JSON.parse(JSON.stringify(item)),
        isOutroItem: true // Flag to identify Outro items
      }));
      
      result.push(...outroItems);
      
      console.log(`Pattern with Outro: ${pattern_name} has ${basePattern.length} base items + ${outroItems.length} outro items = ${result.length} total`);
      return result;
      
    } catch (error) {
      console.error(`Error getting pattern with outro ${pattern_name}: ${error.message}`);
      return this.get_pattern(pattern_name); // Fallback to base pattern
    }
  }
  
  /**
   * Private helper to save pattern state to history for undo
   */
  _saveStateToHistory(pattern_name) {
    if (!this.patterns.hasOwnProperty(pattern_name)) {
      console.warn(`_saveStateToHistory: Attempted to save history for non-existent pattern '${pattern_name}'`);
      return;
    }
    if (!this.patternHistory[pattern_name]) {
      this.patternHistory[pattern_name] = [];
    }
    // Deep clone the current state of the pattern
    const currentState = JSON.parse(JSON.stringify(this.patterns[pattern_name]));
    this.patternHistory[pattern_name].push(currentState);

    // Keep history length in check
    if (this.patternHistory[pattern_name].length > this.maxHistoryLength) {
      this.patternHistory[pattern_name].shift(); // Remove the oldest state
    }
    
    // Clear redo history for this pattern since new changes invalidate redo states
    this.patternRedoHistory[pattern_name] = [];
    
    console.log(`_saveStateToHistory: Saved state for '${pattern_name}'. History size: ${this.patternHistory[pattern_name].length}`);
  }

  /**
   * Undo the last action for a given pattern.
   */
  undo_last_action(pattern_name) {
    console.log(`[API undo_last_action] Attempting to undo for pattern: ${pattern_name}`);
    if (!this.patternHistory[pattern_name] || this.patternHistory[pattern_name].length === 0) {
      console.warn(`[API undo_last_action] No history available for pattern '${pattern_name}' to undo.`);
      return { success: false, error: "No actions to undo.", can_undo_more: false, reverted_pattern_data: null };
    }

    try {
      // Save current state to redo history before undoing
      if (!this.patternRedoHistory[pattern_name]) {
        this.patternRedoHistory[pattern_name] = [];
      }
      const currentStateForRedo = JSON.parse(JSON.stringify(this.patterns[pattern_name]));
      this.patternRedoHistory[pattern_name].push(currentStateForRedo);
      
      // Keep redo history length in check
      if (this.patternRedoHistory[pattern_name].length > this.maxHistoryLength) {
        this.patternRedoHistory[pattern_name].shift();
      }
      
      // The last element is the current state IF _saveStateToHistory is called *before* modification.
      // If it's called *after*, then the history stores previous states.
      // For a typical undo, we want to revert to the state *before* the last change.
      // So, pop the current state (which was just saved before the action that we now want to undo).
      // The new "current" state will be the one at the top of the history stack.
      
      // If _saveStateToHistory is called *before* the change, the history stack looks like:
      // [StateA, StateB (current state before change C happened)]
      // After change C, current this.patterns[pattern_name] is StateC.
      // To undo C, we want to restore StateB.
      
      // Let's adjust: _saveStateToHistory should save the state *before* it's modified.
      // Then, undo will pop the last saved state and apply it.

      const previousState = this.patternHistory[pattern_name].pop();
      if (!previousState) {
         console.warn(`[API undo_last_action] Popped undefined state for '${pattern_name}'. This shouldn't happen if history was not empty.`);
         // Remove the state we added to redo history since undo failed
         this.patternRedoHistory[pattern_name].pop();
         return { success: false, error: "Internal error: Corrupted history.", can_undo_more: this.patternHistory[pattern_name] && this.patternHistory[pattern_name].length > 0, can_redo: false, reverted_pattern_data: null };
      }

      // Deep clone to avoid reference issues, though previousState should already be a clone.
      this.patterns[pattern_name] = JSON.parse(JSON.stringify(previousState));
      
      console.log(`[API undo_last_action] Reverted '${pattern_name}' to previous state. History size now: ${this.patternHistory[pattern_name]?.length || 0}`);

      const saved = this.save_patterns();
      if (saved) {
        console.log(`[API undo_last_action] Successfully reverted and saved pattern '${pattern_name}'.`);
        return { 
          success: true, 
          reverted_pattern_data: this.patterns[pattern_name], 
          can_undo_more: this.patternHistory[pattern_name] && this.patternHistory[pattern_name].length > 0,
          can_redo: this.patternRedoHistory[pattern_name] && this.patternRedoHistory[pattern_name].length > 0
        };
      } else {
        console.error(`[API undo_last_action] Failed to save pattern '${pattern_name}' after undo. CRITICAL: State might be inconsistent.`);
        // Attempt to restore the state we tried to pop (put it back on history)
        this.patternHistory[pattern_name].push(previousState);
        // Also remove the state we added to redo history
        this.patternRedoHistory[pattern_name].pop();
        // Optionally, try to reload patterns from disk to ensure consistency, though this might lose the "current" state that failed to save.
        // this.load_patterns(); // This is a drastic measure.
        return { 
          success: false, 
          error: "Failed to save pattern after undo. State might be inconsistent.", 
          can_undo_more: this.patternHistory[pattern_name] && this.patternHistory[pattern_name].length > 0,
          can_redo: false,
          reverted_pattern_data: null
        };
      }
    } catch (e) {
      console.error(`[API undo_last_action] Error during undo for ${pattern_name}: ${e.message}`);
      console.error(e.stack);
      return { 
        success: false, 
        error: `Error during undo: ${e.message}`, 
        can_undo_more: this.patternHistory[pattern_name] && this.patternHistory[pattern_name].length > 0,
        can_redo: false,
        reverted_pattern_data: null
      };
    }
  }
  
  /**
   * Redo the last undone action for a given pattern.
   */
  redo_last_action(pattern_name) {
    console.log(`[API redo_last_action] Attempting to redo for pattern: ${pattern_name}`);
    if (!this.patternRedoHistory[pattern_name] || this.patternRedoHistory[pattern_name].length === 0) {
      console.warn(`[API redo_last_action] No redo history available for pattern '${pattern_name}' to redo.`);
      return { success: false, error: "No actions to redo.", can_redo_more: false, reverted_pattern_data: null };
    }

    try {
      // Save current state to undo history before redoing
      if (!this.patternHistory[pattern_name]) {
        this.patternHistory[pattern_name] = [];
      }
      const currentStateForUndo = JSON.parse(JSON.stringify(this.patterns[pattern_name]));
      this.patternHistory[pattern_name].push(currentStateForUndo);
      
      // Keep undo history length in check
      if (this.patternHistory[pattern_name].length > this.maxHistoryLength) {
        this.patternHistory[pattern_name].shift();
      }
      
      // Pop the last state from redo history and apply it
      const redoState = this.patternRedoHistory[pattern_name].pop();
      if (!redoState) {
         console.warn(`[API redo_last_action] Popped undefined state for '${pattern_name}'. This shouldn't happen if redo history was not empty.`);
         // Remove the state we added to undo history since redo failed
         this.patternHistory[pattern_name].pop();
         return { success: false, error: "Internal error: Corrupted redo history.", can_redo_more: false, can_undo: this.patternHistory[pattern_name] && this.patternHistory[pattern_name].length > 0, reverted_pattern_data: null };
      }

      // Deep clone to avoid reference issues
      this.patterns[pattern_name] = JSON.parse(JSON.stringify(redoState));
      
      console.log(`[API redo_last_action] Applied redo state for '${pattern_name}'. Redo history size now: ${this.patternRedoHistory[pattern_name]?.length || 0}`);

      const saved = this.save_patterns();
      if (saved) {
        console.log(`[API redo_last_action] Successfully applied redo and saved pattern '${pattern_name}'.`);
        return { 
          success: true, 
          reverted_pattern_data: this.patterns[pattern_name], 
          can_redo_more: this.patternRedoHistory[pattern_name] && this.patternRedoHistory[pattern_name].length > 0,
          can_undo: this.patternHistory[pattern_name] && this.patternHistory[pattern_name].length > 0
        };
      } else {
        console.error(`[API redo_last_action] Failed to save pattern '${pattern_name}' after redo. CRITICAL: State might be inconsistent.`);
        // Attempt to restore the state we tried to pop (put it back on redo history)
        this.patternRedoHistory[pattern_name].push(redoState);
        // Also remove the state we added to undo history
        this.patternHistory[pattern_name].pop();
        return { 
          success: false, 
          error: "Failed to save pattern after redo. State might be inconsistent.", 
          can_redo_more: this.patternRedoHistory[pattern_name] && this.patternRedoHistory[pattern_name].length > 0,
          can_undo: false,
          reverted_pattern_data: null
        };
      }
    } catch (e) {
      console.error(`[API redo_last_action] Error during redo for ${pattern_name}: ${e.message}`);
      console.error(e.stack);
      return { 
        success: false, 
        error: `Error during redo: ${e.message}`, 
        can_redo_more: this.patternRedoHistory[pattern_name] && this.patternRedoHistory[pattern_name].length > 0,
        can_undo: false,
        reverted_pattern_data: null
      };
    }
  }
  
  /**
   * Update a specific pattern
   */
  update_pattern(pattern_name, pattern_data) {
    //console.log(`[API update_pattern] Received request for ${pattern_name}. Incoming pattern_data has ${pattern_data?.length} items.`);
    if (pattern_data && pattern_data.length > 0) {
      console.log(`[API update_pattern] Incoming first item chapter: ${pattern_data[0]?.chapter}, chunkID: ${pattern_data[0]?.chunkID}`);
    }

    try {
      this._saveStateToHistory(pattern_name); // Save state before modification
      // Deep clone to ensure we have plain objects and to avoid potential IPC proxy issues.
      const plain_pattern_data = JSON.parse(JSON.stringify(pattern_data));
      this.patterns[pattern_name] = plain_pattern_data;

      console.log(`[API update_pattern] Assigned new data for ${pattern_name}. In-memory this.patterns[${pattern_name}] now has ${this.patterns[pattern_name]?.length} items.`);
      if (this.patterns[pattern_name] && this.patterns[pattern_name].length > 0) {
        console.log(`[API update_pattern] In-memory first item chapter: ${this.patterns[pattern_name][0]?.chapter}, chunkID: ${this.patterns[pattern_name][0]?.chunkID}`);
      }
      return this.save_patterns(); // save_patterns returns true/false
    } catch (e) {
      console.error(`[API update_pattern] Error processing/assigning pattern_data for ${pattern_name}: ${e.message}`);
      console.error(e.stack);
      return false; // Indicate failure
    }
  }

  create_pattern({ pattern_name }) {
    console.log(`[API create_pattern] Attempting to create pattern: ${pattern_name}`);
    if (!pattern_name || pattern_name.trim() === "") {
        console.warn("[API create_pattern] Pattern name cannot be empty.");
        return { success: false, error: "Pattern name cannot be empty." };
    }
    if (!this.patterns) { // Should be initialized by constructor
        console.error("[API create_pattern] this.patterns is not initialized!");
        // Attempt to recover, though this indicates an earlier issue, possibly in constructor or load_patterns
        this.load_patterns(); 
        if (!this.patterns) {
             console.error("[API create_pattern] CRITICAL: this.patterns still not initialized after reload attempt.");
             return { success: false, error: "Internal server error: Patterns data structure not available."};
        }
    }
    if (this.patterns.hasOwnProperty(pattern_name)) {
        console.warn(`[API create_pattern] Pattern "${pattern_name}" already exists.`);
        return { success: false, error: `Pattern "${pattern_name}" already exists.` };
    }
    try {
        this.patterns[pattern_name] = []; // Create new pattern with an empty list of items
        this.patternHistory[pattern_name] = []; // Initialize history for the new pattern
        this.patternRedoHistory[pattern_name] = []; // Initialize redo history for the new pattern
        const saved = this.save_patterns(); // Save the changes
        if (saved) {
            console.log(`[API create_pattern] Successfully created pattern: ${pattern_name}`);
            return { success: true, new_pattern_name: pattern_name };
        } else {
            console.error(`[API create_pattern] Failed to save after creating pattern: ${pattern_name}`);
            // Attempt to remove the partially created pattern to maintain consistency if save fails
            delete this.patterns[pattern_name]; 
            return { success: false, error: `Failed to save new pattern: ${pattern_name}` };
        }
    } catch (e) {
        console.error(`[API create_pattern] Error creating pattern ${pattern_name}:`, e);
        return { success: false, error: `Failed to save new pattern: ${e.message}` };
    }
  }
  
  /**
   * Move item(s) from one position to another in a pattern, potentially updating chapter.
   */
  move_item(pattern_name, from_index, to_index, count = 1, new_chapter = undefined, moved_chapter_name = undefined) {
    try {
      this._saveStateToHistory(pattern_name); // Save state before modification
      const pattern = this.patterns[pattern_name] || [];
      if (!pattern.length) {
        console.error(`move_item: Pattern not found - ${pattern_name}`);
        return { success: false, error: "Pattern not found" };
      }
      count = Math.max(1, parseInt(count)); // Ensure count is at least 1

      console.log(`API: move_item received: pattern='${pattern_name}', from=${from_index}, to=${to_index}, count=${count}, new_chapter='${new_chapter}', moved_chapter_name='${moved_chapter_name}'`);

      // Validate indices and count
      if (!(0 <= from_index && from_index < pattern.length) || count <= 0 || from_index + count > pattern.length) {
         console.error(`move_item: Invalid from_index or count. from=${from_index}, count=${count}, length=${pattern.length}`);
        return { success: false, error: "Invalid source index or count" };
      }
      // `to_index` is the insertion point (0 to pattern.length is valid)
       if (!(0 <= to_index && to_index <= pattern.length)) { // Allow insertion at the end
          console.error(`move_item: Invalid to_index. to=${to_index}, length=${pattern.length}`);
         return { success: false, error: "Invalid target index" };
       }

      // --- Perform the move ---
      // 1. Extract the items to move
      const items_to_move = pattern.splice(from_index, count);

      // 2. Adjust the target index if the removal affected it
      let adjusted_to_index = to_index;
      if (to_index > from_index) {
        adjusted_to_index -= count;
      }
      // Clamp adjusted_to_index just in case (0 to new length)
       adjusted_to_index = Math.max(0, Math.min(pattern.length, adjusted_to_index));


      // 3. Insert the items at the adjusted target index
      // Using splice arguments expansion: pattern.splice(adjusted_to_index, 0, item1, item2, ...)
      pattern.splice(adjusted_to_index, 0, ...items_to_move);

      // --- Update Chapter if necessary ---
      // Note: Chapter update happens *after* the move, operating on the items
      // now located at `adjusted_to_index` up to `adjusted_to_index + count`.
      if (moved_chapter_name !== undefined) {
         // Moving a whole chapter. All moved items should now belong to this chapter.
         console.log(` -> Updating chapter for moved chapter items to '${moved_chapter_name}'`);
         for (let i = 0; i < count; i++) {
             const currentItemIndex = adjusted_to_index + i;
             if (pattern[currentItemIndex]) { // Check item exists
                 pattern[currentItemIndex].chapter = moved_chapter_name;
             } else {
                  console.warn(`move_item: Index out of bounds during chapter update for moved chapter: ${currentItemIndex}`);
             }
         }
      } else if (new_chapter !== undefined) {
        // Only update chapter if it's actually different from each item's current chapter
        // This prevents items from being moved out of their chapter when moving within the same chapter
        console.log(` -> Checking if chapter update is needed for moved items to '${new_chapter}'`);
        
        let itemsUpdated = 0;
        for (let i = 0; i < count; i++) {
            const currentItemIndex = adjusted_to_index + i;
            if (pattern[currentItemIndex]) {
                const currentItemChapter = pattern[currentItemIndex].chapter || '';
                // Only update if the target chapter is different from the item's current chapter
                if (new_chapter !== currentItemChapter) {
                    pattern[currentItemIndex].chapter = new_chapter;
                    itemsUpdated++;
                    console.log(`   -> Updated item ${currentItemIndex} chapter from '${currentItemChapter}' to '${new_chapter}'`);
                } else {
                    console.log(`   -> Item ${currentItemIndex} already in target chapter '${new_chapter}', no update needed`);
                }
            } else {
                 console.warn(`move_item: Index out of bounds during chapter update: ${currentItemIndex}`);
            }
        }
        
        if (itemsUpdated === 0) {
            console.log(` -> No items needed chapter updates - all items already in target chapter '${new_chapter}'`);
        } else {
            console.log(` -> Updated chapter for ${itemsUpdated} out of ${count} moved items`);
        }
      }

      // --- Save ---
      this.patterns[pattern_name] = pattern;
      const saved = this.save_patterns();

      if (saved) {
          console.log(`API: move_item successful for pattern '${pattern_name}'.`);
          return { success: true };
      } else {
           console.error(`API: move_item failed during save for pattern '${pattern_name}'.`);
           // Attempt to reload patterns to revert state in memory? Might be risky.
           this.load_patterns(); // Try to reload from the last saved state
           return { success: false, error: "Failed to save updated pattern" };
      }

    } catch (error) {
      console.error(`Error in move_item: ${error.message}\n${error.stack}`);
      // Attempt to reload patterns on unexpected error
       this.load_patterns();
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Update a specific field in a pattern item
   */
  update_item(pattern_name, index, field, value) {
    try {
      this._saveStateToHistory(pattern_name); // Save state before modification
      const pattern = this.patterns[pattern_name] || [];
      if (!pattern.length || !(0 <= index && index < pattern.length)) {
        return { success: false, error: "Invalid pattern or index" };
      }
      
      // Update the field
      pattern[index][field] = value;
      this.patterns[pattern_name] = pattern;
      this.save_patterns();
      return { success: true };
    } catch (error) {
      console.error(`Error updating item: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a chunk from items between start_index and end_index (inclusive)
   */
  create_chunk(pattern_name, start_index, end_index) {
    try {
      this._saveStateToHistory(pattern_name); // Save state before modification
      const pattern = this.patterns[pattern_name] || [];
      if (!pattern.length) {
        return { success: false, error: "Pattern not found" };
      }
      
      // Validate indices
      if (!(0 <= start_index && start_index < pattern.length) || 
          !(0 <= end_index && end_index < pattern.length)) {
        return { success: false, error: "Invalid indices" };
      }
      
      // Ensure start_index <= end_index
      if (start_index > end_index) {
        [start_index, end_index] = [end_index, start_index];
      }
      
      // Generate a new unique chunk ID
      const existing_chunks = new Set();
      for (const item of pattern) {
        const chunk_id = item.chunkID || 0;
        if (chunk_id > 0) {
          existing_chunks.add(chunk_id);
        }
      }
      
      let new_chunk_id = 1;
      while (existing_chunks.has(new_chunk_id)) {
        new_chunk_id += 1;
      }
      
      // Assign the chunk ID to all items in the range
      for (let i = start_index; i <= end_index; i++) {
        pattern[i].chunkID = new_chunk_id;
      }
      
      this.patterns[pattern_name] = pattern;
      this.save_patterns();
      return { success: true, chunkID: new_chunk_id };
    } catch (error) {
      console.error(`Error creating chunk: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Remove all items from a chunk
   */
  disband_chunk(pattern_name, chunk_id) {
    try {
      this._saveStateToHistory(pattern_name); // Save state before modification
      const pattern = this.patterns[pattern_name] || [];
      if (!pattern.length || chunk_id <= 0) {
        return { success: false, error: "Invalid pattern or chunk ID" };
      }
      
      // Remove all items from the chunk
      for (const item of pattern) {
        if ((item.chunkID || 0) === chunk_id) {
          item.chunkID = 0;
        }
      }
      
      this.patterns[pattern_name] = pattern;
      this.save_patterns();
      return { success: true };
    } catch (error) {
      console.error(`Error disbanding chunk: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Remove a single item from its chunk
   */
  remove_from_chunk(pattern_name, index) {
    try {
      this._saveStateToHistory(pattern_name); // Save state before modification
      const pattern = this.patterns[pattern_name] || [];
      if (!pattern.length || !(0 <= index && index < pattern.length)) {
        return { success: false, error: "Invalid pattern or index" };
      }
      
      // Set chunk ID to 0 (no chunk)
      pattern[index].chunkID = 0;
      this.patterns[pattern_name] = pattern;
      this.save_patterns();
      return { success: true };
    } catch (error) {
      console.error(`Error removing from chunk: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reorder items within a chunk
   */
  reorder_chunk_items(pattern_name, chunk_id, new_order) {
    try {
      this._saveStateToHistory(pattern_name); // Save state before modification
      const pattern = this.patterns[pattern_name] || [];
      if (!pattern.length) {
        return { success: false, error: "Pattern not found" };
      }

      console.log(`API: reorder_chunk_items received: pattern='${pattern_name}', chunk_id=${chunk_id}, new_order=[${new_order.join(', ')}]`);

      // Validate chunk_id
      if (!chunk_id || chunk_id <= 0) {
        return { success: false, error: "Invalid chunk ID" };
      }

      // Validate new_order array
      if (!Array.isArray(new_order) || new_order.length === 0) {
        return { success: false, error: "Invalid new order array" };
      }

      // Get all items belonging to this chunk
      const chunkItems = [];
      const chunkItemIndices = [];
      for (let i = 0; i < pattern.length; i++) {
        if (pattern[i].chunkID === chunk_id) {
          chunkItems.push(pattern[i]);
          chunkItemIndices.push(i);
        }
      }

      if (chunkItems.length === 0) {
        return { success: false, error: "No items found for this chunk" };
      }

      if (chunkItems.length !== new_order.length) {
        return { success: false, error: "New order length doesn't match chunk size" };
      }

      // Validate that all indices in new_order are valid and belong to this chunk
      for (const index of new_order) {
        if (!chunkItemIndices.includes(index)) {
          return { success: false, error: `Index ${index} is not part of chunk ${chunk_id}` };
        }
      }

      // Create reordered chunk items based on new_order
      const reorderedItems = new_order.map(index => {
        const originalItem = pattern[index];
        if (!originalItem) {
          throw new Error(`Item at index ${index} not found`);
        }
        return { ...originalItem }; // Create a copy
      });

      // Replace the chunk items in the pattern with the reordered items
      // We need to replace them in their original positions to maintain the overall pattern structure
      for (let i = 0; i < chunkItemIndices.length; i++) {
        const patternIndex = chunkItemIndices[i];
        pattern[patternIndex] = reorderedItems[i];
      }

      this.patterns[pattern_name] = pattern;
      const saved = this.save_patterns();

      if (saved) {
        console.log(`API: reorder_chunk_items successful for pattern '${pattern_name}', chunk ${chunk_id}`);
        return { success: true };
      } else {
        console.error(`API: reorder_chunk_items failed during save for pattern '${pattern_name}'`);
        this.load_patterns(); // Try to reload from the last saved state
        return { success: false, error: "Failed to save updated pattern" };
      }

    } catch (error) {
      console.error(`Error in reorder_chunk_items: ${error.message}\n${error.stack}`);
      this.load_patterns();
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get the current app transparency value
   */
  get_transparency() {
    return this.settings.transparency || 1.0;
  }
  
  /**
   * Set the app transparency value
   */
  set_transparency(value) {
    try {
      this.settings.transparency = parseFloat(value);
      this.save_settings();
      return { success: true, transparency: value };
    } catch (error) {
      console.error(`Error setting transparency: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get the current tumbler settings
   */
  get_tumbler_settings() {
    return this.settings.tumbler || {};
  }
  
  /**
   * Save tumbler settings
   */
  save_tumbler_settings(settings_data) {
    try {
      // Store the tumbler settings
      this.settings.tumbler = settings_data;
      this.save_settings();
      return { success: true, settings: settings_data };
    } catch (error) {
      console.error(`Error saving tumbler settings: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current editor settings
   */
  get_editor_settings() {
    return this.settings.editor || {};
  }
  
  /**
   * Save editor settings
   */
  save_editor_settings(settings_data) {
    try {
      // Store the editor settings
      this.settings.editor = settings_data;
      this.save_settings();
      return { success: true, settings: settings_data };
    } catch (error) {
      console.error(`Error saving editor settings: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current tumbler window position settings
   */
  get_tumbler_window_position() {
    return this.settings.tumblerWindowPosition || null; // Return null if not set
  }

  /**
   * Save tumbler window position settings
   */
  save_tumbler_window_position(position_data) {
    try {
      // Ensure this.settings is initialized
      if (!this.settings) {
        this.settings = {};
      }
      this.settings.tumblerWindowPosition = position_data;
      this.save_settings();
      return { success: true, position: position_data };
    } catch (error) {
      console.error(`Error saving tumbler window position: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current tumbler window size settings
   */
  get_tumbler_window_size() {
    return this.settings.tumblerWindowSize || null;
  }

  /**
   * Save tumbler window size settings
   */
  save_tumbler_window_size(size_data) {
    try {
      // Ensure this.settings is initialized
      if (!this.settings) {
        this.settings = {};
      }
      this.settings.tumblerWindowSize = size_data;
      this.save_settings();
      return { success: true, size: size_data };
    } catch (error) {
      console.error(`Error saving tumbler window size: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current main window position settings
   */
  get_main_window_position() {
    return this.settings.mainWindowPosition || null;
  }

  /**
   * Save main window position settings
   */
  save_main_window_position(position_data) {
    try {
      if (!this.settings) this.settings = {};
      this.settings.mainWindowPosition = position_data;
      this.save_settings();
      return { success: true, position: position_data };
    } catch (error) {
      console.error(`Error saving main window position: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current editor window position settings
   */
  get_editor_window_position() {
    return this.settings.editorWindowPosition || null;
  }

  /**
   * Save editor window position settings
   */
  save_editor_window_position(position_data) {
    try {
      if (!this.settings) this.settings = {};
      this.settings.editorWindowPosition = position_data;
      this.save_settings();
      return { success: true, position: position_data };
    } catch (error) {
      console.error(`Error saving editor window position: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current settings window position settings
   */
  get_settings_window_position() {
    return this.settings.settingsWindowPosition || null;
  }

  /**
   * Save settings window position settings
   */
  save_settings_window_position(position_data) {
    try {
      if (!this.settings) this.settings = {};
      this.settings.settingsWindowPosition = position_data;
      this.save_settings();
      return { success: true, position: position_data };
    } catch (error) {
      console.error(`Error saving settings window position: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add a new item to a pattern at a specific index.
   */
  add_item(pattern_name, item_data, index) {
    try {
      this._saveStateToHistory(pattern_name); // Save state before modification
      const pattern = this.patterns[pattern_name] || [];
      // Validate index (allow insertion at the end)
      if (index < 0 || index > pattern.length) { // Also allow index === pattern.length for appending
         console.error(`add_item: Invalid index ${index}, pattern length is ${pattern.length}`);
        return { success: false, error: "Invalid insertion index" };
      }
      // Ensure item_data has basic structure (at least chapter)
      if (!item_data || typeof item_data.chapter === 'undefined') {
           console.error(`add_item: Missing item_data or chapter field.`);
           item_data = { ...item_data, chapter: '' }; // Default chapter if missing
      }

      console.log(`API: add_item received: pattern='${pattern_name}', index=${index}, item=`, item_data);

      // Insert item at the specified index or append if index is -1 (though frontend sends specific index or relies on last)
      if (index === -1 || index === pattern.length) {
          pattern.push(item_data);
      } else {
          pattern.splice(index, 0, item_data);
      }

      this.patterns[pattern_name] = pattern;
      const saved = this.save_patterns();
      return { success: saved, error: saved ? null : "Failed to save pattern" };

    } catch (error) {
      console.error(`Error in add_item: ${error.message}\n${error.stack}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete item(s) from a pattern starting at a specific index.
   */
  delete_item(pattern_name, index, count = 1) {
    try {
        this._saveStateToHistory(pattern_name); // Save state before modification
        const pattern = this.patterns[pattern_name] || [];
        count = Math.max(1, parseInt(count)); // Ensure count is at least 1

        console.log(`API: delete_item received: pattern='${pattern_name}', index=${index}, count=${count}`);

        // Validate index and count
        if (!(0 <= index && index < pattern.length) || count <= 0 || index + count > pattern.length) {
            console.error(`delete_item: Invalid index or count. index=${index}, count=${count}, length=${pattern.length}`);
            return { success: false, error: "Invalid index or count" };
        }

        // Remove the items
        pattern.splice(index, count);

        this.patterns[pattern_name] = pattern;
        const saved = this.save_patterns();
        return { success: saved, error: saved ? null : "Failed to save pattern" };

    } catch (error) {
        console.error(`Error in delete_item: ${error.message}\n${error.stack}`);
        return { success: false, error: error.message };
    }
  }

  /**
   * Delete a chapter and all its items from a pattern.
   */
  delete_chapter(pattern_name, chapter_name) {
    try {
      this._saveStateToHistory(pattern_name); // Save state before modification
      const original_pattern = this.patterns[pattern_name] || [];
      if (!original_pattern.length && Object.keys(this.patterns).includes(pattern_name)) { 
        // Pattern exists but is empty, so deleting a chapter from it is fine (no-op)
      } else if (!Object.keys(this.patterns).includes(pattern_name)) {
        console.error(`delete_chapter: Pattern not found - ${pattern_name}`);
        return { success: false, error: "Pattern not found" };
      }
       console.log(`API: delete_chapter received: pattern='${pattern_name}', chapter='${chapter_name}'`);

      // Filter out items belonging to the specified chapter
      const new_pattern = original_pattern.filter(item => (item.chapter || '') !== chapter_name);

      if (new_pattern.length === original_pattern.length && original_pattern.length > 0) { // Check if pattern had items
          console.warn(`delete_chapter: No items found with chapter '${chapter_name}' in pattern '${pattern_name}'.`);
          // If the chapter didn't exist in a non-empty pattern, still consider it a success (idempotent)
          // If pattern was empty, it's also a success.
      }

      this.patterns[pattern_name] = new_pattern;
      const saved = this.save_patterns();
      return { success: saved, error: saved ? null : "Failed to save pattern" };

    } catch (error) {
      console.error(`Error in delete_chapter: ${error.message}\n${error.stack}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update the chapter for a specific item or all items in a chunk.
   */
  update_item_chapter(pattern_name, item_index, new_chapter, is_chunk = false, chunk_id = 0) {
    try {
       this._saveStateToHistory(pattern_name); // Save state before modification
       let pattern = this.patterns[pattern_name] || [];
       if (!pattern.length && pattern_name !== '-') { // Allow '-' for initial load maybe? Check usage.
         // If pattern_name is not '-', it should exist. If it's empty, that's fine.
         if (pattern_name !== '-' && !this.patterns[pattern_name]) {
            console.error(`update_item_chapter: Pattern not found - ${pattern_name}`);
            return { success: false, error: "Pattern not found" };
         }
       }
       console.log(`API: update_item_chapter received: pattern='${pattern_name}', index=${item_index}, new_chapter='${new_chapter}', is_chunk=${is_chunk}, chunk_id=${chunk_id}`);

       const items_to_update_indices = [];
       if (is_chunk && chunk_id > 0) {
           console.log(` -> Identifying items for chunk ${chunk_id}`);
           pattern.forEach((item, idx) => {
               if (item.chunkID === chunk_id) {
                   items_to_update_indices.push(idx);
               }
           });
       } else { // Single item update
           if (item_index >= 0 && item_index < pattern.length) {
               items_to_update_indices.push(item_index);
               console.log(` -> Identifying single item at index ${item_index}`);
           } else {
               console.error(`update_item_chapter: Invalid index ${item_index} for single item update. Pattern length: ${pattern.length}`);
               return { success: false, error: "Invalid item index" };
           }
       }

       if (items_to_update_indices.length === 0) {
           console.warn("update_item_chapter: No items identified for update.");
           return { success: true }; // No items to update, operation is vacuously successful.
       }

       // Check if a change is actually needed before doing complex operations
       let needs_change = false;
       for (const idx of items_to_update_indices) {
           if (pattern[idx].chapter !== new_chapter) {
               needs_change = true;
               break;
           }
       }

       if (!needs_change) {
           console.warn("update_item_chapter: All identified items already have the target chapter. No change needed.");
           return { success: true };
       }

       // Store items to move and their original first index
       const original_first_index = Math.min(...items_to_update_indices);
       const items_to_move = items_to_update_indices
           .sort((a, b) => a - b) // Process in original order
           .map(idx => pattern[idx]);

       // Create a new pattern array without the items to move
       const remaining_items = pattern.filter((_, idx) => !items_to_update_indices.includes(idx));

       // Update chapter for the items to move
       items_to_move.forEach(item => {
           item.chapter = new_chapter;
       });
       console.log(` -> Updated chapter to '${new_chapter}' for ${items_to_move.length} item(s)`);

       // Determine insertion point
       let insertion_point = -1;
       if (new_chapter !== '') { // Only try to append to existing if new_chapter is not root
            for (let i = remaining_items.length - 1; i >= 0; i--) {
                if (remaining_items[i].chapter === new_chapter) {
                    insertion_point = i + 1;
                    break;
                }
            }
       }

       if (insertion_point === -1) {
           // No existing block for this chapter found, or assigning to root.
           // Insert at the original position of the first moved item, adjusted for removals before it.
           let adjusted_original_first_index = original_first_index;
           let removed_before_original = 0;
            items_to_update_indices.forEach(idx => {
                if (idx < original_first_index) {
                    removed_before_original++;
                }
            });
           adjusted_original_first_index -= removed_before_original;

           insertion_point = Math.max(0, Math.min(remaining_items.length, adjusted_original_first_index));
           console.log(` -> No existing chapter block for '${new_chapter}' found or assigning to root. Inserting at original adjusted index: ${insertion_point}`);
       } else {
           console.log(` -> Existing chapter block for '${new_chapter}' found. Inserting at index: ${insertion_point}`);
       }
       
       // Insert items_to_move into remaining_items at insertion_point
       remaining_items.splice(insertion_point, 0, ...items_to_move);

       this.patterns[pattern_name] = remaining_items;
       const saved = this.save_patterns();
       return { success: saved, error: saved ? null : "Failed to save pattern" };

    } catch (error) {
       console.error(`Error in update_item_chapter: ${error.message}\n${error.stack}`);
       return { success: false, error: error.message };
    }
  }

   /**
   * Update properties of items within a chunk, or remove an item from a chunk.
   */
  update_chunk(pattern_name, item_index, new_chunk_id) {
     try {
       this._saveStateToHistory(pattern_name); // Save state before modification
       const pattern = this.patterns[pattern_name] || [];
       if (!this.patterns.hasOwnProperty(pattern_name)) {
            console.error(`update_chunk: Pattern not found - ${pattern_name}`);
            return { success: false, error: "Pattern not found" };
       }
        console.log(`API: update_chunk received: pattern='${pattern_name}', item_index=${item_index}, new_chunk_id=${new_chunk_id}`);

       if (item_index < 0 || item_index >= pattern.length) {
            console.error(`update_chunk: Invalid item_index ${item_index}. Pattern length: ${pattern.length}`);
            return { success: false, error: "Invalid item index" };
        }

       const item = pattern[item_index];
       const originalChunkId = item.chunkID || 0;

       if (new_chunk_id === originalChunkId) {
           console.warn(`update_chunk: Item at index ${item_index} is already in chunk state ${new_chunk_id}.`);
           return { success: true }; 
       }

       // --- Handle Assigning TO a Chunk (new_chunk_id > 0) --- 
       if (new_chunk_id > 0) {
           console.log(` -> Assigning item at index ${item_index} to chunk ${new_chunk_id}`);
           item.chunkID = new_chunk_id;
           // Optional: If removing from a chunk with only one item left, disband that old chunk.
           if (originalChunkId > 0) {
               const remainingInOldChunk = pattern.filter(i => i.chunkID === originalChunkId).length;
               if (remainingInOldChunk === 1) {
                   console.log(` -> Auto-disbanding old chunk ${originalChunkId} as only one item remains after moving item ${item_index}.`);
                   pattern.forEach(i => {
                       if (i.chunkID === originalChunkId) {
                           i.chunkID = 0;
                       }
                   });
               }
           }
       } 
       // --- Handle Removing FROM a Chunk (new_chunk_id === 0) ---
       else { // new_chunk_id is 0
           if (originalChunkId === 0) {
                console.warn(`update_chunk: Item at index ${item_index} is not in a chunk.`);
                return { success: true }; // Nothing to do
           }
            item.chunkID = 0;
            console.log(` -> Removed item at index ${item_index} from chunk ${originalChunkId}`);

            // Optional: Auto-disband if only one item left in the original chunk
            const remainingInChunk = pattern.filter(i => i.chunkID === originalChunkId).length;
            if (remainingInChunk === 1) {
                 console.log(` -> Auto-disbanding chunk ${originalChunkId} as only one item remains.`);
                 pattern.forEach(i => {
                     if (i.chunkID === originalChunkId) {
                         i.chunkID = 0;
                     }
                 });
            }
       }

       // --- Save and Return --- 
       this.patterns[pattern_name] = pattern;
       const saved = this.save_patterns();
       return { success: saved, error: saved ? null : "Failed to save pattern" };

     } catch (error) {
        console.error(`Error in update_chunk: ${error.message}\n${error.stack}`);
        return { success: false, error: error.message };
     }
   }

  // --- New API methods for chunk management ---

  /**
   * Delete all items belonging to a specific chunk ID from a pattern.
   */
  delete_chunk(pattern_name, chunk_id) {
    try {
      if (!this.patterns.hasOwnProperty(pattern_name)) {
        console.error(`delete_chunk: Pattern not found - ${pattern_name}`);
        return { success: false, error: "Pattern not found" };
      }
      this._saveStateToHistory(pattern_name); // Save state before modification
      const original_pattern = this.patterns[pattern_name] || []; // Get pattern, even if empty

      if (chunk_id <= 0) {
        console.error(`delete_chunk: Invalid chunk_id ${chunk_id}`);
        return { success: false, error: "Invalid chunk ID" };
      }

      console.log(`API: delete_chunk received: pattern='${pattern_name}', chunk_id=${chunk_id}`);
      const new_pattern = original_pattern.filter(item => item.chunkID !== chunk_id);

      if (new_pattern.length === original_pattern.length) {
        // This means no items were found with that chunk_id.
        // This could be an error if the chunk was expected to exist, or success if it's an idempotent operation.
        console.warn(`delete_chunk: No items found with chunk ID ${chunk_id} in pattern '${pattern_name}'.`);
        return { success: true }; // No change needed, operation considered successful.
      }

      this.patterns[pattern_name] = new_pattern;
      const saved = this.save_patterns();
      return { success: saved, error: saved ? null : "Failed to save pattern" };

    } catch (error) {
      console.error(`Error in delete_chunk: ${error.message}\n${error.stack}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Duplicate an item in a pattern.
   */
  duplicate_item(pattern_name, item_index) {
    try {
      if (!this.patterns.hasOwnProperty(pattern_name)) {
        console.error(`duplicate_item: Pattern not found - ${pattern_name}`);
        return { success: false, error: "Pattern not found" };
      }
      this._saveStateToHistory(pattern_name); // Save state before modification
      const pattern = this.patterns[pattern_name] || [];

      if (!(0 <= item_index && item_index < pattern.length)) {
        console.error(`duplicate_item: Invalid item_index ${item_index}. Pattern length: ${pattern.length}`);
        return { success: false, error: "Invalid item index" };
      }

      const item_to_duplicate = pattern[item_index];
      // Deep clone the item to ensure no shared references, especially for complex objects
      const duplicated_item = JSON.parse(JSON.stringify(item_to_duplicate));
      
      // Reset chunkID for the duplicated item if it was part of a chunk,
      // as duplicating an item should typically create a new, independent item.
      // If specific chunk behavior is needed for duplicates, this can be adjusted.
      if (duplicated_item.chunkID && duplicated_item.chunkID > 0) {
        console.log(`Duplicate_item: Resetting chunkID for duplicated item (original chunkID: ${duplicated_item.chunkID})`);
        duplicated_item.chunkID = 0; 
      }

      console.log(`API: duplicate_item received: pattern='${pattern_name}', index=${item_index}, item to duplicate=`, item_to_duplicate);

      pattern.splice(item_index + 1, 0, duplicated_item);

      this.patterns[pattern_name] = pattern;
      const saved = this.save_patterns();
      
      if (saved) {
        console.log(`API: duplicate_item successful for pattern '${pattern_name}'. New item added at index ${item_index + 1}`);
        return { success: true, new_item_index: item_index + 1, item_data: duplicated_item };
      } else {
        console.error(`API: duplicate_item failed during save for pattern '${pattern_name}'.`);
        // Attempt to reload patterns to revert state in memory if save fails
        this.load_patterns(); 
        return { success: false, error: "Failed to save updated pattern after duplication" };
      }

    } catch (error) {
      console.error(`Error in duplicate_item: ${error.message}\n${error.stack}`);
      // Attempt to reload patterns on unexpected error
      this.load_patterns();
      return { success: false, error: error.message };
    }
  }

  // --- Shortcuts Methods ---
  get_shortcuts() {
    console.log('[API get_shortcuts] Retrieving shortcuts.');
    if (!this.settings || !this.settings.shortcuts) {
      console.log('[API get_shortcuts] No shortcuts found in settings, returning default shortcuts.');
      return this.get_default_shortcuts();
    }
    return this.settings.shortcuts;
  }

  get_default_shortcuts() {
    return [
      {
        id: 'toggle-main',
        name: 'Toggle Main Window',
        accelerator: 'Alt+Q',
        action: 'toggle-main',
        enabled: false,
        description: ''
      },
      {
        id: 'show-main',
        name: 'Show Main Window',
        accelerator: 'Alt+S',
        action: 'show-main',
        enabled: false,
        description: 'Show and focus main window'
      },
      {
        id: 'open-editor',
        name: 'Open Editor',
        accelerator: 'Alt+E',
        action: 'open-editor',
        enabled: false,
        description: ''
      },
      {
        id: 'advance-tumbler',
        name: 'Advance Tumbler',
        accelerator: 'Alt+D',
        action: 'advance-tumbler',
        enabled: true,
        description: ''
      },
      {
        id: 'close-all',
        name: 'Close All Windows',
        accelerator: 'Alt+X',
        action: 'close-all',
        enabled: false,
        description: 'Close all secondary windows (editor and tumbler)'
      }
    ];
  }

  save_shortcuts(shortcuts_data) {
    console.log('[API save_shortcuts] Saving shortcuts data.');
    try {
      if (!this.settings) {
        this.settings = {};
      }
      this.settings.shortcuts = JSON.parse(JSON.stringify(shortcuts_data)); // Deep clone
      const saved = this.save_settings();
      return { success: saved, error: saved ? null : "Failed to save settings with shortcuts." };
    } catch (error) {
      console.error(`[API save_shortcuts] Error saving shortcuts: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  update_shortcut(shortcut_id, shortcut_data) {
    console.log(`[API update_shortcut] Updating shortcut ${shortcut_id}:`, shortcut_data);
    try {
      if (!this.settings) {
        this.settings = {};
      }
      if (!this.settings.shortcuts || !Array.isArray(this.settings.shortcuts)) {
        this.settings.shortcuts = this.get_default_shortcuts();
      }

      const shortcutIndex = this.settings.shortcuts.findIndex(s => s.id === shortcut_id);
      if (shortcutIndex === -1) {
        console.error(`[API update_shortcut] Shortcut with id ${shortcut_id} not found.`);
        return { success: false, error: `Shortcut with id ${shortcut_id} not found.` };
      }

      // Update the shortcut
      this.settings.shortcuts[shortcutIndex] = { ...this.settings.shortcuts[shortcutIndex], ...shortcut_data };
      
      const saved = this.save_settings();
      return { success: saved, error: saved ? null : "Failed to save settings after shortcut update." };
    } catch (error) {
      console.error(`[API update_shortcut] Error updating shortcut: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  reset_shortcuts_to_default() {
    console.log('[API reset_shortcuts_to_default] Resetting shortcuts to default.');
    try {
      if (!this.settings) {
        this.settings = {};
      }
      this.settings.shortcuts = this.get_default_shortcuts();
      const saved = this.save_settings();
      return { success: saved, error: saved ? null : "Failed to save settings after reset." };
    } catch (error) {
      console.error(`[API reset_shortcuts_to_default] Error resetting shortcuts: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // --- Parts Bank Methods ---
  get_parts_bank() {
    //console.log('[API get_parts_bank] Retrieving parts bank.');
    if (!this.settings || !this.settings.parts_bank) {
        //console.warn('[API get_parts_bank] Parts bank not found in settings, returning empty array.');
        return []; // Ensure it returns an array even if undefined
    }
    return this.settings.parts_bank;
  }

  save_parts_bank(parts_bank_data) {
    //console.log('[API save_parts_bank] Saving parts bank data.');
    try {
        if (!this.settings) {
            this.settings = {}; // Initialize settings if it doesn't exist
        }
        this.settings.parts_bank = JSON.parse(JSON.stringify(parts_bank_data)); // Deep clone
        const saved = this.save_settings();
        return { success: saved, error: saved ? null : "Failed to save settings with parts bank." };
    } catch (error) {
        console.error(`[API save_parts_bank] Error saving parts bank: ${error.message}`);
        return { success: false, error: error.message };
    }
  }

  add_to_parts_bank(item_data) {
    //console.log('[API add_to_parts_bank] Adding item to parts bank:', item_data);
    try {
        if (!this.settings) {
            this.settings = {};
        }
        if (!this.settings.parts_bank || !Array.isArray(this.settings.parts_bank)) {
            this.settings.parts_bank = [];
        }
        // Ensure item_data is a plain object
        const plain_item_data = JSON.parse(JSON.stringify(item_data));
        this.settings.parts_bank.push(plain_item_data);
        const saved = this.save_settings();
        return { success: saved, error: saved ? null : "Failed to save settings after adding to parts bank." };
    } catch (error) {
        console.error(`[API add_to_parts_bank] Error adding to parts bank: ${error.message}`);
        return { success: false, error: error.message };
    }
  }

  delete_from_parts_bank(item_abbr) {
    console.log('[API delete_from_parts_bank] Deleting item from parts bank by abbr:', item_abbr);
    try {
        if (!this.settings || !this.settings.parts_bank || !Array.isArray(this.settings.parts_bank)) {
            console.warn('[API delete_from_parts_bank] Parts bank is empty or not found.');
            return { success: false, error: "Parts bank is empty or not found." };
        }
        const initial_length = this.settings.parts_bank.length;
        this.settings.parts_bank = this.settings.parts_bank.filter(item => item.abbr !== item_abbr);
        
        if (this.settings.parts_bank.length === initial_length) {
            console.warn(`[API delete_from_parts_bank] Item with abbr "${item_abbr}" not found in parts bank.`);
            return { success: false, error: `Item with abbr "${item_abbr}" not found.` };
        }

        const saved = this.save_settings();
        return { success: saved, error: saved ? null : "Failed to save settings after deleting from parts bank." };
    } catch (error) {
        console.error(`[API delete_from_parts_bank] Error deleting from parts bank: ${error.message}`);
        return { success: false, error: error.message };
    }
  }

  /**
   * Get available chapters and chunks from a pattern for mirroring
   */
  get_pattern_mirror_options(pattern_name) {
    console.log(`[API get_pattern_mirror_options] Getting mirror options for pattern: ${pattern_name}`);
    try {
      if (!pattern_name || typeof pattern_name !== 'string') {
        return { success: false, error: "Invalid pattern name" };
      }

      if (!this.patterns[pattern_name]) {
        return { success: false, error: "Pattern not found" };
      }

      const pattern = this.patterns[pattern_name];
      const chapters = new Map();
      const chunks = new Map();

      // Collect chapters and chunks
      pattern.forEach((item, index) => {
        if (item.chapter && item.chapter !== '_') {
          if (!chapters.has(item.chapter)) {
            chapters.set(item.chapter, {
              chapter: item.chapter,
              items: []
            });
          }
          chapters.get(item.chapter).items.push({
            index: index,
            abbr: item.abbr,
            full_name: item.full_name
          });
        }
        if (item.chunkID && item.chunkID !== 0) {
          if (!chunks.has(item.chunkID)) {
            chunks.set(item.chunkID, {
              chunkID: item.chunkID,
              chapter: item.chapter,
              items: []
            });
          }
          chunks.get(item.chunkID).items.push({
            index: index,
            abbr: item.abbr,
            full_name: item.full_name
          });
        }
      });

      return {
        success: true,
        chapters: Array.from(chapters.values()),
        chunks: Array.from(chunks.values()),
        pattern_name: pattern_name
      };
    } catch (error) {
      console.error(`[API get_pattern_mirror_options] Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add mirrors to a pattern
   */
  add_mirrors_to_pattern(target_pattern, mirror_configs) {
    console.log(`[API add_mirrors_to_pattern] Adding mirrors to pattern: ${target_pattern}`);
    try {
      if (!target_pattern || typeof target_pattern !== 'string') {
        return { success: false, error: "Invalid target pattern name" };
      }

      if (!Array.isArray(mirror_configs) || mirror_configs.length === 0) {
        return { success: false, error: "Invalid mirror configurations" };
      }

      if (!this.patterns[target_pattern]) {
        return { success: false, error: "Target pattern not found" };
      }

      // Save state for undo
      this._saveStateToHistory(target_pattern);

      const targetPattern = this.patterns[target_pattern];
      let mirrorsAdded = 0;

      for (const config of mirror_configs) {
        const { source_pattern, type, identifier } = config;

        if (!this.patterns[source_pattern]) {
          console.warn(`[API add_mirrors_to_pattern] Source pattern not found: ${source_pattern}`);
          continue;
        }

        const sourcePattern = this.patterns[source_pattern];
        let itemsToMirror = [];

        if (type === 'chapter') {
          itemsToMirror = sourcePattern.filter(item => item.chapter === identifier);
        } else if (type === 'chunk') {
          itemsToMirror = sourcePattern.filter(item => item.chunkID === identifier);
        }

        // Add mirror items to target pattern, preserving their relative order
        // Sort items by their original index to maintain sequence
        const sortedItemsToMirror = itemsToMirror
          .map(item => ({ item, originalIndex: sourcePattern.indexOf(item) }))
          .sort((a, b) => a.originalIndex - b.originalIndex);
          
        for (const { item: sourceItem, originalIndex } of sortedItemsToMirror) {
          const mirrorItem = {
            ...JSON.parse(JSON.stringify(sourceItem)),
            isMirror: true,
            mirrorSource: {
              pattern: source_pattern,
              type: type,
              identifier: identifier,
              originalIndex: originalIndex
            }
          };
          targetPattern.push(mirrorItem);
          mirrorsAdded++;
        }
      }

      if (mirrorsAdded > 0) {
        const saved = this.save_patterns();
        if (saved) {
          return { 
            success: true, 
            mirrorsAdded: mirrorsAdded,
            pattern_data: this.patterns[target_pattern]
          };
        } else {
          return { success: false, error: "Failed to save patterns after adding mirrors" };
        }
      } else {
        return { success: false, error: "No mirrors were added" };
      }
    } catch (error) {
      console.error(`[API add_mirrors_to_pattern] Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update mirrors when source pattern changes
   */
  update_mirrors_for_pattern(source_pattern) {
    console.log(`[API update_mirrors_for_pattern] Updating mirrors for source pattern: ${source_pattern}`);
    try {
      if (!source_pattern || typeof source_pattern !== 'string') {
        return { success: false, error: "Invalid source pattern name" };
      }

      if (!this.patterns[source_pattern]) {
        return { success: false, error: "Source pattern not found" };
      }

      const sourcePattern = this.patterns[source_pattern];
      let updatedPatterns = [];

      // Find all patterns that have mirrors from this source
      for (const [patternName, pattern] of Object.entries(this.patterns)) {
        if (patternName === source_pattern) continue;

        let patternUpdated = false;
        for (let i = 0; i < pattern.length; i++) {
          const item = pattern[i];
          if (item.isMirror && item.mirrorSource && item.mirrorSource.pattern === source_pattern) {
            // Update mirror item with current source data
            const { type, identifier, originalIndex } = item.mirrorSource;
            let sourceItem = null;

            // Find the exact source item using originalIndex first (most accurate)
            if (typeof originalIndex === 'number' && originalIndex >= 0 && originalIndex < sourcePattern.length) {
              const candidateItem = sourcePattern[originalIndex];
              // Verify it still matches the expected type and identifier
              if (type === 'chapter' && candidateItem.chapter === identifier) {
                sourceItem = candidateItem;
              } else if (type === 'chunk' && candidateItem.chunkID === identifier) {
                sourceItem = candidateItem;
              }
            }

            // Fallback: search by type and identifier if originalIndex doesn't work
            if (!sourceItem) {
              if (type === 'chapter') {
                // Find all items in the chapter and match by relative position
                const chapterItems = sourcePattern.filter(src => src.chapter === identifier);
                const mirrorChapterItems = pattern.filter(itm => 
                  itm.isMirror && itm.mirrorSource && 
                  itm.mirrorSource.pattern === source_pattern && 
                  itm.mirrorSource.type === 'chapter' && 
                  itm.mirrorSource.identifier === identifier
                );
                const mirrorPosition = mirrorChapterItems.indexOf(item);
                if (mirrorPosition >= 0 && mirrorPosition < chapterItems.length) {
                  sourceItem = chapterItems[mirrorPosition];
                }
              } else if (type === 'chunk') {
                // Find all items in the chunk and match by relative position
                const chunkItems = sourcePattern.filter(src => src.chunkID === identifier);
                const mirrorChunkItems = pattern.filter(itm => 
                  itm.isMirror && itm.mirrorSource && 
                  itm.mirrorSource.pattern === source_pattern && 
                  itm.mirrorSource.type === 'chunk' && 
                  itm.mirrorSource.identifier === identifier
                );
                const mirrorPosition = mirrorChunkItems.indexOf(item);
                if (mirrorPosition >= 0 && mirrorPosition < chunkItems.length) {
                  sourceItem = chunkItems[mirrorPosition];
                }
              }
            }

            if (sourceItem) {
              // Update mirror item while preserving mirror metadata and target context
              const mirrorSource = item.mirrorSource;
              const targetChapter = item.chapter;
              const targetChapterID = item.chapterID;
              
              Object.assign(item, JSON.parse(JSON.stringify(sourceItem)));
              
              // Restore mirror metadata
              item.isMirror = true;
              item.mirrorSource = mirrorSource;
              
              // Preserve target chapter if it was different from source
              if (targetChapter !== sourceItem.chapter) {
                item.chapter = targetChapter;
              }
              if (targetChapterID && targetChapterID !== sourceItem.chapterID) {
                item.chapterID = targetChapterID;
              }
              
              patternUpdated = true;
            }
          }
        }

        if (patternUpdated) {
          updatedPatterns.push(patternName);
        }
      }

      if (updatedPatterns.length > 0) {
        const saved = this.save_patterns();
        return { 
          success: saved, 
          updatedPatterns: updatedPatterns,
          error: saved ? null : "Failed to save patterns after updating mirrors"
        };
      } else {
        return { success: true, updatedPatterns: [] };
      }
    } catch (error) {
      console.error(`[API update_mirrors_for_pattern] Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove mirrors from a pattern
   */
  remove_mirrors_from_pattern(pattern_name, mirror_indices) {
    console.log(`[API remove_mirrors_from_pattern] Removing mirrors from pattern: ${pattern_name}`);
    try {
      if (!pattern_name || typeof pattern_name !== 'string') {
        return { success: false, error: "Invalid pattern name" };
      }

      if (!Array.isArray(mirror_indices) || mirror_indices.length === 0) {
        return { success: false, error: "Invalid mirror indices" };
      }

      if (!this.patterns[pattern_name]) {
        return { success: false, error: "Pattern not found" };
      }

      // Save state for undo
      this._saveStateToHistory(pattern_name);

      const pattern = this.patterns[pattern_name];
      let removedCount = 0;

      // Sort indices in descending order to avoid index shifting issues
      const sortedIndices = mirror_indices.sort((a, b) => b - a);

      for (const index of sortedIndices) {
        if (index >= 0 && index < pattern.length && pattern[index].isMirror) {
          pattern.splice(index, 1);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        const saved = this.save_patterns();
        return { 
          success: saved, 
          removedCount: removedCount,
          pattern_data: this.patterns[pattern_name],
          error: saved ? null : "Failed to save patterns after removing mirrors"
        };
      } else {
        return { success: false, error: "No mirrors were removed" };
      }
    } catch (error) {
      console.error(`[API remove_mirrors_from_pattern] Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Replace existing chapter/chunk content with mirrors
   */
  replace_with_mirrors(target_pattern, mirror_configs, replacement_context) {
    console.log(`[API replace_with_mirrors] Replacing content in pattern: ${target_pattern}`);
    console.log('Replacement context:', replacement_context);
    try {
      if (!target_pattern || typeof target_pattern !== 'string') {
        return { success: false, error: "Invalid target pattern name" };
      }

      if (!Array.isArray(mirror_configs) || mirror_configs.length === 0) {
        return { success: false, error: "Invalid mirror configurations" };
      }

      if (!replacement_context) {
        return { success: false, error: "Invalid replacement context" };
      }

      if (!this.patterns[target_pattern]) {
        return { success: false, error: "Target pattern not found" };
      }

      // Save state for undo
      this._saveStateToHistory(target_pattern);

      const targetPattern = this.patterns[target_pattern];
      let mirrorsAdded = 0;

      // Step 1: Identify what to replace
      let itemsToRemove = [];
      let insertionIndex = 0;

      if (replacement_context.isChapter) {
        // Replace entire chapter
        const chapterID = replacement_context.chapterID;
        const chapterName = replacement_context.chapterName;
        
        // Find all items in this chapter
        for (let i = 0; i < targetPattern.length; i++) {
          const item = targetPattern[i];
          const itemChapterID = item.chapterID || '';
          const itemChapterName = item.chapter || '';
          
          if ((chapterID && itemChapterID === chapterID) || 
              (!chapterID && itemChapterName === chapterName)) {
            if (itemsToRemove.length === 0) {
              insertionIndex = i; // Remember where to insert new content
            }
            itemsToRemove.push(i);
          }
        }
      } else if (replacement_context.isChunkContainer) {
        // Replace entire chunk
        const chunkId = replacement_context.chunkId;
        
        // Find all items in this chunk
        for (let i = 0; i < targetPattern.length; i++) {
          const item = targetPattern[i];
          if (item.chunkID === chunkId) {
            if (itemsToRemove.length === 0) {
              insertionIndex = i; // Remember where to insert new content
            }
            itemsToRemove.push(i);
          }
        }
      } else {
        // Replace single item
        const specificIndex = replacement_context.specificIndex;
        if (specificIndex >= 0 && specificIndex < targetPattern.length) {
          itemsToRemove.push(specificIndex);
          insertionIndex = specificIndex;
        }
      }

      if (itemsToRemove.length === 0) {
        return { success: false, error: "No items found to replace" };
      }

      console.log(`Found ${itemsToRemove.length} items to replace at positions:`, itemsToRemove);
      console.log(`Will insert new content at index: ${insertionIndex}`);

      // Step 2: Remove existing items (in reverse order to preserve indices)
      const sortedIndices = itemsToRemove.sort((a, b) => b - a);
      for (const index of sortedIndices) {
        targetPattern.splice(index, 1);
      }

      // Step 3: Collect mirror content
      let allMirrorItems = [];
      for (const config of mirror_configs) {
        const { source_pattern, type, identifier } = config;

        if (!this.patterns[source_pattern]) {
          console.warn(`[API replace_with_mirrors] Source pattern not found: ${source_pattern}`);
          continue;
        }

        const sourcePattern = this.patterns[source_pattern];
        let itemsToMirror = [];

        if (type === 'chapter') {
          itemsToMirror = sourcePattern.filter(item => item.chapter === identifier);
        } else if (type === 'chunk') {
          itemsToMirror = sourcePattern.filter(item => item.chunkID === identifier);
        }

        // Sort items by their original index to maintain sequence
        const sortedItemsToMirror = itemsToMirror
          .map(item => ({ item, originalIndex: sourcePattern.indexOf(item) }))
          .sort((a, b) => a.originalIndex - b.originalIndex);

        for (const { item: sourceItem, originalIndex } of sortedItemsToMirror) {
          const mirrorItem = {
            ...sourceItem,
            isMirror: true,
            mirrorSource: {
              pattern: source_pattern,
              type: type,
              identifier: identifier,
              originalIndex: originalIndex
            }
          };

          // Preserve target chapter/chunk information if replacing within a specific context
          if (replacement_context.isChapter) {
            mirrorItem.chapter = replacement_context.chapterName;
            if (replacement_context.chapterID) {
              mirrorItem.chapterID = replacement_context.chapterID;
            }
          }

          allMirrorItems.push(mirrorItem);
          mirrorsAdded++;
        }
      }

      // Step 4: Insert mirror items at the original location
      if (allMirrorItems.length > 0) {
        targetPattern.splice(insertionIndex, 0, ...allMirrorItems);
      }

      if (mirrorsAdded > 0) {
        const saved = this.save_patterns();
        return {
          success: saved,
          mirrorsAdded: mirrorsAdded,
          itemsReplaced: itemsToRemove.length,
          pattern_data: this.patterns[target_pattern],
          error: saved ? null : "Failed to save patterns after replacing with mirrors"
        };
      } else {
        return { success: false, error: "No mirrors were added" };
      }
    } catch (error) {
      console.error(`[API replace_with_mirrors] Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

} // END OF SearchPatternAPI CLASS


// Create and export the API instance
const api = new SearchPatternAPI();
module.exports = { api }; 