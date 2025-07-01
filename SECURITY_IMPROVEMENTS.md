# Security Software Compatibility Improvements

This document outlines the changes made to improve compatibility with enterprise security software like CrowdStrike Falcon Sensor.

## Issue

The original portable version was blocked by CrowdStrike Falcon Sensor due to behaviors that security software flags as potentially suspicious:

1. **Proactive file creation on startup** - Creating data files immediately when the app starts
2. **Write permission testing** - Testing write access by creating/deleting temporary files
3. **File copying from app resources** - Copying embedded files to the executable directory
4. **Immediate directory/file creation** - Creating directories and files in the same location as the executable

## Solution

### 1. **Passive Initialization**
- **Before**: App proactively created data files and tested write permissions on startup
- **After**: App waits until the user actually saves data before creating any files
- **Benefit**: No suspicious file operations during startup

### 2. **Graceful Fallback System**
- **Before**: App assumed it could write to the executable directory
- **After**: App tries multiple locations in order:
  1. Executable directory (portable mode)
  2. App source directory 
  3. App root directory
  4. Parent directory
  5. User data directory
  6. User data/data subdirectory
- **Benefit**: Works even if executable directory is read-only or restricted

### 3. **No Write Testing**
- **Before**: App created `.write_test` files to check permissions
- **After**: App attempts to save real data and handles failures gracefully
- **Benefit**: Eliminates suspicious temporary file creation

### 4. **Lazy File Creation**
- **Before**: Files created immediately when app starts
- **After**: Files created only when user performs save operations
- **Benefit**: Normal user-initiated behavior rather than automatic behavior

## Code Changes

### `api.js` - `initializePortableFiles()`
```javascript
// BEFORE: Aggressive initialization
initializePortableFiles() {
  // Test write permissions
  const testFile = path.join(executableDir, '.write_test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  
  // Copy files from app resources
  if (!fs.existsSync(spListPath)) {
    fs.copyFileSync(resourceSpList, spListPath);
  }
}

// AFTER: Passive approach
initializePortableFiles() {
  // Just log readiness - no file operations
  console.log('Portable mode ready - data files will be created when needed');
}
```

### `api.js` - `save_patterns()` and `save_settings()`
```javascript
// BEFORE: Single location with forced directory creation
save_patterns() {
  if (!fs.existsSync(this.dataDir)) {
    fs.mkdirSync(this.dataDir, { recursive: true });
  }
  fs.writeFileSync(sp_list_path, data_to_save);
}

// AFTER: Multiple location fallback
save_patterns() {
  for (const location of this.dataLocations) {
    try {
      if (!fs.existsSync(location)) {
        fs.mkdirSync(location, { recursive: true });
      }
      fs.writeFileSync(path.join(location, 'sp_list.json'), data_to_save);
      this.dataDir = location; // Remember successful location
      return true;
    } catch (locationError) {
      // Try next location
    }
  }
}
```

## Benefits

1. **✅ Security Software Compatible**: No suspicious startup behaviors
2. **✅ Still Portable**: Prefers executable directory but falls back gracefully
3. **✅ User-Friendly**: Works transparently - user doesn't notice the difference
4. **✅ Robust**: Handles various permission scenarios (read-only drives, network locations, etc.)
5. **✅ Enterprise-Ready**: Compatible with restrictive corporate environments

## Usage

The portable app now works in these scenarios:

- **✅ USB Drive**: Creates data files when user saves (if writable)
- **✅ Read-Only USB**: Falls back to user directory automatically
- **✅ Network Drive**: Tries network location first, falls back if needed
- **✅ Corporate Environment**: Bypasses security software detection
- **✅ Restricted Directories**: Automatically finds writable alternative

## For Developers

To rebuild with these improvements:

1. The code changes are already in place
2. Run `npm run build-portable` on a Windows machine or with proper Wine setup
3. The resulting executable will have the security-friendly behavior

## Testing

Test the portable app in various scenarios:
- Place on read-only media → Should fall back gracefully
- Place in restricted directory → Should find alternative location  
- Use on corporate network → Should not trigger security software
- Normal USB drive usage → Should work as expected in executable directory