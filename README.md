# Search Pattern Assistant

A desktop application for radiologists to manage and review search patterns when reviewing medical imaging studies.

## Features

- Manage search patterns for different imaging modalities
- Drag-and-drop pattern editor
- Create "chunks" of related items
- Pattern review tumbler with timer
- Adjustable font size in review mode
- Variable window transparency
- Dark theme for optimal use in radiology reading rooms

## Installation

### Prerequisites

- Node.js 14+

### Setup

1. Install dependencies:

```bash
npm install
```

2. Start the application:

```bash
npm start
```

## Building

To create an executable for your platform:

```bash
npm run build
```

This will create executables in the `dist` folder.

## Usage

### Main Window

- Select a pattern from the list to review it
- Use the Pattern Editor button to edit patterns
- Adjust the transparency slider to make the window more transparent

### Pattern Editor

- Select a pattern from the dropdown to edit
- Drag and drop items to reorder them
- Click on item text to edit
- Right-click to open context menu for grouping options
- Use shift key to select multiple items

### Pattern Review (Tumbler)

- Use right arrow, down arrow, or space to advance to the next item
- Click the + or - buttons to adjust font size
- Timer in bottom right shows elapsed time
- ESC key to close

## Development

The application uses:

- Electron for the desktop application framework
- HTML/CSS/JavaScript for the user interface

### Project Structure

- `src/` - Electron frontend code
- `dist/` - Built application packages 