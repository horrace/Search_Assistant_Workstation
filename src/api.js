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
      fs.writeFileSync(sp_list_path, JSON.stringify(this.patterns, null, 2));
      console.log("Patterns saved successfully to:", sp_list_path);
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
    this.patterns[pattern_name] = pattern_data;
    return this.save_patterns();
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
   * Rename a chapter within a pattern.
   */
  rename_chapter(pattern_name, old_name, new_name) {
    try {
        const pattern = this.patterns[pattern_name] || [];
        if (!pattern.length) {
            return { success: false, error: "Pattern not found" };
        }
         console.log(`API: rename_chapter received: pattern='${pattern_name}', old='${old_name}', new='${new_name}'`);

        let changed = false;
        for (const item of pattern) {
            if ((item.chapter || '') === old_name) {
                item.chapter = new_name; // Assign new name (can be '')
                changed = true;
            }
        }

        if (!changed) {
            console.warn(`rename_chapter: No items found with chapter '${old_name}'.`);
            // Return success even if nothing changed, as the state is technically correct.
            return { success: true };
        }

        this.patterns[pattern_name] = pattern;
        const saved = this.save_patterns();
        return { success: saved, error: saved ? null : "Failed to save pattern" };

    } catch (error) {
        console.error(`Error in rename_chapter: ${error.message}\n${error.stack}`);
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
       const pattern = this.patterns[pattern_name] || [];
       if (!pattern.length) {
         return { success: false, error: "Pattern not found" };
       }
        console.log(`API: update_item_chapter received: pattern='${pattern_name}', index=${item_index}, new_chapter='${new_chapter}', is_chunk=${is_chunk}, chunk_id=${chunk_id}`);

       let changed = false;
       if (is_chunk && chunk_id > 0) {
           // Update chapter for all items in the specified chunk
            console.log(` -> Updating chapter for chunk ${chunk_id}`);
            for (const item of pattern) {
                if (item.chunkID === chunk_id) {
                     if (item.chapter !== new_chapter) {
                        item.chapter = new_chapter;
                        changed = true;
                    }
                }
            }
       } else {
           // Update chapter for a single item
           if (item_index >= 0 && item_index < pattern.length) {
               if (pattern[item_index].chapter !== new_chapter) {
                    pattern[item_index].chapter = new_chapter;
                    changed = true;
                     console.log(` -> Updating chapter for single item at index ${item_index}`);
               }
           } else {
                console.error(`update_item_chapter: Invalid index ${item_index} for single item update.`);
                return { success: false, error: "Invalid item index" };
           }
       }

        if (!changed) {
             console.warn("update_item_chapter: No chapter change needed.");
             return { success: true }; // No actual change, but operation is valid.
         }

       this.patterns[pattern_name] = pattern;
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

       // Currently only supports removing item from chunk
       if (new_chunk_id === 0) {
           const originalChunkId = pattern[item_index].chunkID;
           if (originalChunkId === 0) {
                console.warn(`update_chunk: Item at index ${item_index} is not in a chunk.`);
                return { success: true }; // Nothing to do
           }
            pattern[item_index].chunkID = 0;
            console.log(` -> Removed item at index ${item_index} from chunk ${originalChunkId}`);

            // Optional: Auto-disband if only one item left in the original chunk
            const remainingInChunk = pattern.filter(item => item.chunkID === originalChunkId).length;
            if (remainingInChunk === 1) {
                 console.log(` -> Auto-disbanding chunk ${originalChunkId} as only one item remains.`);
                 pattern.forEach(item => {
                     if (item.chunkID === originalChunkId) {
                         item.chunkID = 0;
                     }
                 });
            }

           this.patterns[pattern_name] = pattern;
           const saved = this.save_patterns();
           return { success: saved, error: saved ? null : "Failed to save pattern" };
       } else {
            console.error("update_chunk: Currently only supports removing items (new_chunk_id=0).");
            return { success: false, error: "Operation not supported" };
       }

     } catch (error) {
        console.error(`Error in update_chunk: ${error.message}\n${error.stack}`);
        return { success: false, error: error.message };
     }
   }
}

// Create and export the API instance
const api = new SearchPatternAPI();
module.exports = { api }; 