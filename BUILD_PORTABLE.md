# Building Portable Executable

This document explains how to create a portable standalone executable for the Search Assistant app.

## Prerequisites

1. Ensure all dependencies are installed:
   ```bash
   npm install
   ```

## Building the Portable Executable

Run the following command to build the portable executable:

```bash
npm run build-portable
```

This will create a portable executable in the `dist` folder with the name:
`Search Assistant-1.0.0-portable.exe`

## Portable App Features

- **No Installation Required**: The executable can be run directly from any location (USB drive, network drive, etc.)
- **Self-Contained Data**: The app automatically creates and manages its data files in the same directory as the executable
- **Automatic Data Migration**: If data files exist in the app bundle, they will be copied to the executable directory on first run
- **Persistent Settings**: All settings and patterns are saved relative to the executable location

## Data Files

The portable app creates these files in the same directory as the executable:

- `sp_list.json` - Contains all search patterns and their data
- `settings.json` - Contains app settings, shortcuts, and preferences

## Usage

1. Copy the portable executable to any location (USB drive, network folder, local disk)
2. Run the executable directly - no installation needed
3. The app will automatically create its data files in the same folder
4. All data and settings will be preserved when you move the folder to different locations

## Notes

- The executable directory must be writable for the app to function properly
- If running from a read-only location, the app will fall back to using standard system directories
- The portable mode is automatically detected - no configuration required