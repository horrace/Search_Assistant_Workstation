// api.js - JavaScript implementation of the Search Pattern API
const fs = require('fs');
const path = require('path');
const { app } = require('electron');


class SearchPatternAPI {
  constructor() {
    this.patterns = {};
    this.current_pattern = "CThead";
    this.settings = { "transparency": 1.0, "tumbler": {} };
    
    // Initialize paths
    this.appPath = app.getAppPath();
    console.log('App path:', this.appPath);
    
    // Try multiple locations for data files
    this.dataLocations = [
      path.join(this.appPath, 'src'),                  // Check in src directory
      path.join(this.appPath),                         // Check in app root
      path.join(app.getPath('userData')),              // Check in user data directory
      path.join(app.getPath('userData'), 'data'),      // Check in user data/data directory
      path.dirname(this.appPath)                       // Check in parent directory
    ];
    
    // Log all potential locations
    console.log('Checking these locations for data files:');
    this.dataLocations.forEach(location => console.log('- ' + location));
    
    // Set default data directory
    this.dataDir = this.dataLocations[3]; // Default to user data/data directory
    
    // Try to load existing patterns and settings
    this.load_patterns();
    this.load_settings();
    
    console.log('SearchPatternAPI initialized');
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
      
      if (sp_list_path) {
        const data = fs.readFileSync(sp_list_path, 'utf8');
        this.patterns = JSON.parse(data);
        console.log(`Loaded patterns for ${Object.keys(this.patterns).length} modality/parts`);
        
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
        console.log("Settings loaded successfully");
        
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
   * Save patterns to sp_list.json
   */
  save_patterns() {
    try {
      // Create the directory if it doesn't exist
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      
      const sp_list_path = path.join(this.dataDir, 'sp_list.json');
      
      // Log a snippet of the data about to be saved for the first pattern found
      if (this.patterns && Object.keys(this.patterns).length > 0) {
        const firstPatternName = Object.keys(this.patterns)[0];
        const firstPatternSample = this.patterns[firstPatternName];
        if (firstPatternSample && firstPatternSample.length > 0) {
          console.log(`[API save_patterns] Data for pattern '${firstPatternName}' before stringify - First item chapter: ${firstPatternSample[0]?.chapter}, chunkID: ${firstPatternSample[0]?.chunkID}`);
        }
      }

      const data_to_save = JSON.stringify(this.patterns, null, 2);
      fs.writeFileSync(sp_list_path, data_to_save);
      console.log("[API save_patterns] Patterns saved successfully to:", sp_list_path);
      return true;
    } catch (error) {
      console.error(`Error saving patterns: ${error.message}`);
      console.error(error.stack);
      return false;
    }
  }
  
  /**
   * Save settings to settings.json
   */
  save_settings() {
    try {
      // Create the directory if it doesn't exist
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      
      const settings_path = path.join(this.dataDir, 'settings.json');
      fs.writeFileSync(settings_path, JSON.stringify(this.settings, null, 2));
      console.log("Settings saved successfully to:", settings_path);
      return true;
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
      console.log("Patterns in memory:", patterns);
      console.log(`Retrieved ${patterns.length} patterns: ${patterns}`);
      
      // Ensure we always return a list, even if empty
      return patterns.length ? patterns : [];
    } catch (error) {
      console.error(`Error in get_available_patterns: ${error.message}`);
      console.error(error.stack);
      return [];
    }
  }
  
  /**
   * Get a specific pattern by name
   */
  get_pattern(pattern_name) {
    // Check if pattern_name is a string
    if (typeof pattern_name !== 'string') {
      console.error('Invalid pattern_name type, expected string');
      return [];
    }
    
    try {
      if (pattern_name in this.patterns) {
        console.log(`Pattern data for ${pattern_name}: Found ${this.patterns[pattern_name].length} items`);
        return this.patterns[pattern_name];
      } else {
        console.log(`Pattern not found: ${pattern_name}`);
        return [];
      }
    } catch (error) {
      console.error(`Error in get_pattern: ${error.message}`);
      console.error(error.stack);
      return [];
    }
  }
  
  /**
   * Update a specific pattern
   */
  update_pattern(pattern_name, pattern_data) {
    console.log(`[API update_pattern] Received request for ${pattern_name}. Incoming pattern_data has ${pattern_data?.length} items.`);
    if (pattern_data && pattern_data.length > 0) {
      console.log(`[API update_pattern] Incoming first item chapter: ${pattern_data[0]?.chapter}, chunkID: ${pattern_data[0]?.chunkID}`);
    }

    try {
      // Deep clone to ensure we have plain objects and to avoid potential IPC proxy issues.
      const plain_pattern_data = JSON.parse(JSON.stringify(pattern_data));
      this.patterns[pattern_name] = plain_pattern_data;

      console.log(`[API update_pattern] Assigned new data for ${pattern_name}. In-memory this.patterns[${pattern_name}] now has ${this.patterns[pattern_name]?.length} items.`);
      if (this.patterns[pattern_name] && this.patterns[pattern_name].length > 0) {
        console.log(`[API update_pattern] In-memory first item chapter: ${this.patterns[pattern_name][0]?.chapter}, chunkID: ${this.patterns[pattern_name][0]?.chunkID}`);
      }
      return this.save_patterns();
    } catch (e) {
      console.error(`[API update_pattern] Error processing/assigning pattern_data for ${pattern_name}: ${e.message}`);
      console.error(e.stack);
      return false; // Indicate failure
    }
  }
  
  /**
   * Move item(s) from one position to another in a pattern, potentially updating chapter.
   */
  move_item(pattern_name, from_index, to_index, count = 1, new_chapter = undefined, moved_chapter_name = undefined) {
    try {
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
        // Moving item(s)/chunk(s) into a potentially new chapter (or root '')
         console.log(` -> Updating chapter for moved item(s) to '${new_chapter}'`);
         for (let i = 0; i < count; i++) {
             const currentItemIndex = adjusted_to_index + i;
              if (pattern[currentItemIndex]) { // Check item exists
                  pattern[currentItemIndex].chapter = new_chapter;
              } else {
                   console.warn(`move_item: Index out of bounds during chapter update: ${currentItemIndex}`);
              }
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
   * Add a new item to a pattern at a specific index.
   */
  add_item(pattern_name, item_data, index) {
    try {
      const pattern = this.patterns[pattern_name] || [];
      // Validate index (allow insertion at the end)
      if (index < 0 || index > pattern.length) {
         console.error(`add_item: Invalid index ${index}, pattern length is ${pattern.length}`);
        return { success: false, error: "Invalid insertion index" };
      }
      // Ensure item_data has basic structure (at least chapter)
      if (!item_data || typeof item_data.chapter === 'undefined') {
           console.error(`add_item: Missing item_data or chapter field.`);
           item_data = { ...item_data, chapter: '' }; // Default chapter if missing
      }

      console.log(`API: add_item received: pattern='${pattern_name}', index=${index}, item=`, item_data);

      // Insert item at the specified index
      pattern.splice(index, 0, item_data);

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
      const original_pattern = this.patterns[pattern_name] || [];
      if (!original_pattern.length) {
        return { success: false, error: "Pattern not found" };
      }
       console.log(`API: delete_chapter received: pattern='${pattern_name}', chapter='${chapter_name}'`);

      // Filter out items belonging to the specified chapter
      const new_pattern = original_pattern.filter(item => (item.chapter || '') !== chapter_name);

      if (new_pattern.length === original_pattern.length) {
          console.warn(`delete_chapter: No items found with chapter '${chapter_name}'.`);
          return { success: true }; // No change needed, success.
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
       } else {
           if (item_index >= 0 && item_index < pattern.length) {
               items_to_update_indices.push(item_index);
               console.log(` -> Identifying single item at index ${item_index}`);
           } else {
               console.error(`update_item_chapter: Invalid index ${item_index} for single item update.`);
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
   * Currently used by frontend only for removing an item (setting new_chunk_id = 0).
   */
  update_chunk(pattern_name, item_index, new_chunk_id) {
     try {
       const pattern = this.patterns[pattern_name] || [];
       if (!pattern.length) {
         return { success: false, error: "Pattern not found" };
       }
        console.log(`API: update_chunk received: pattern='${pattern_name}', item_index=${item_index}, new_chunk_id=${new_chunk_id}`);

       if (item_index < 0 || item_index >= pattern.length) {
            console.error(`update_chunk: Invalid item_index ${item_index}`);
            return { success: false, error: "Invalid item index" };
        }

       const item = pattern[item_index];
       const originalChunkId = item.chunkID || 0;

       if (new_chunk_id === originalChunkId) {
           console.warn(`update_chunk: Item at index ${item_index} is already in chunk state ${new_chunk_id}.`);
           return { success: true }; // No change needed, operation successful conceptually.
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
      const original_pattern = this.patterns[pattern_name] || [];
      if (!original_pattern.length) {
        return { success: false, error: "Pattern not found" };
      }
      if (chunk_id <= 0) {
        return { success: false, error: "Invalid chunk ID" };
      }

      console.log(`API: delete_chunk received: pattern='${pattern_name}', chunk_id=${chunk_id}`);
      const new_pattern = original_pattern.filter(item => item.chunkID !== chunk_id);

      if (new_pattern.length === original_pattern.length) {
        console.warn(`delete_chunk: No items found with chunk ID ${chunk_id}.`);
        return { success: true }; // No change needed, success.
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
      const pattern = this.patterns[pattern_name] || [];
      if (!pattern.length || !(0 <= item_index && item_index < pattern.length)) {
        console.error(`duplicate_item: Invalid pattern or index. Pattern: ${pattern_name}, Index: ${item_index}`);
        return { success: false, error: "Invalid pattern or item index" };
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


      console.log(`API: duplicate_item received: pattern='${pattern_name}', index=${item_index}, item=`, item_to_duplicate);

      // Insert the duplicated item right after the original
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
}

// Create and export the API instance
const api = new SearchPatternAPI();
module.exports = { api }; 