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
   * Move an item from one position to another in a pattern
   */
  move_item(pattern_name, from_index, to_index) {
    try {
      const pattern = this.patterns[pattern_name] || [];
      if (!pattern.length) {
        return { success: false, error: "Pattern not found" };
      }
      
      // Validate indices
      if (!(0 <= from_index && from_index < pattern.length) || 
          !(0 <= to_index && to_index < pattern.length)) {
        return { success: false, error: "Invalid indices" };
      }
      
      // Check if item is part of a group or chunk
      const item = pattern[from_index];
      const group_id = item.groupID || 0;
      const chunk_id = item.chunkID || 0;
      
      // Handle groups and chunks
      if (group_id > 0) {
        // Find all items in this group
        const group_indices = pattern.map((item, index) => 
          (item.groupID || 0) === group_id ? index : -1).filter(i => i !== -1);
          
        if (group_indices.length > 1) {
          // Move the entire group
          return this._move_group(pattern_name, group_indices, from_index, to_index);
        }
      } else if (chunk_id > 0) {
        // Find all items in this chunk
        const chunk_indices = pattern.map((item, index) => 
          (item.chunkID || 0) === chunk_id ? index : -1).filter(i => i !== -1);
          
        if (chunk_indices.length > 1) {
          // Move the entire chunk
          return this._move_chunk(pattern_name, chunk_indices, from_index, to_index);
        }
      }
      
      // Move a single item
      const item_to_move = pattern[from_index];
      pattern.splice(from_index, 1);
      
      // Adjust target index if needed
      if (to_index > from_index) {
        to_index -= 1;
      }
      
      pattern.splice(to_index, 0, item_to_move);
      this.patterns[pattern_name] = pattern;
      this.save_patterns();
      return { success: true };
    } catch (error) {
      console.error(`Error moving item: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Move an entire group of items together
   */
  _move_group(pattern_name, group_indices, from_index, to_index) {
    try {
      const pattern = this.patterns[pattern_name] || [];
      
      // Sort indices in ascending order
      group_indices.sort((a, b) => a - b);
      
      // Determine direction
      const is_move_down = to_index > from_index;
      
      // Collect items to move
      const group_items = [];
      for (const idx of [...group_indices].sort((a, b) => b - a)) {
        group_items.unshift(pattern.splice(idx, 1)[0]);
      }
      
      // Calculate adjusted insertion point
      let adjusted_to_index;
      if (is_move_down) {
        adjusted_to_index = to_index - group_indices.filter(i => i < to_index).length;
      } else {
        adjusted_to_index = to_index;
      }
      
      // Insert items at new position
      for (let i = 0; i < group_items.length; i++) {
        pattern.splice(adjusted_to_index + i, 0, group_items[i]);
      }
      
      this.patterns[pattern_name] = pattern;
      this.save_patterns();
      return { success: true };
    } catch (error) {
      console.error(`Error moving group: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Move an entire chunk of items together
   */
  _move_chunk(pattern_name, chunk_indices, from_index, to_index) {
    // This is essentially the same logic as _move_group
    return this._move_group(pattern_name, chunk_indices, from_index, to_index);
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
}

// Create and export the API instance
const api = new SearchPatternAPI();
module.exports = { api }; 