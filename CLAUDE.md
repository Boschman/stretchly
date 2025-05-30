# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Installation
```bash
npm install
```

### Running the Application
```bash
# Start the application
npm start

# Development mode with debugging (enables remote debugging on port 9222)
npm run dev
```

### Testing
```bash
# Run all tests
npm test

# Run a single test file
npm run test-single <filename>

# Run tests with coverage
npm run coverage

# Watch mode for TDD
npm run tdd
```

### Code Quality
```bash
# Run linting (uses StandardJS)
npm run lint
```

### Building and Packaging
```bash
# Create unpacked build for testing
npm run pack

# Create distributables for all platforms
npm run dist
```

## Architecture Overview

Stretchly is an Electron-based break reminder application with the following key components:

### Main Process (`app/main.js`)
- Entry point that manages the application lifecycle
- Handles tray icon, system integration, and IPC communication
- Creates and manages all windows (break windows, preferences, etc.)
- Integrates with system features like autostart, DND detection, and idle monitoring

### Core Components

1. **BreaksPlanner** (`app/breaksPlanner.js`)
   - Schedules and manages break timing
   - Handles break postponement and natural breaks
   - Integrates with DND manager and app exclusions

2. **Break Windows**
   - `app/microbreak.html/js` - Mini break windows (20-second breaks)
   - `app/break.html/js` - Long break windows (5-minute breaks)
   - Customizable themes, sounds, and ideas

3. **Preferences System**
   - Uses `electron-store` for persistent settings
   - `app/preferences.html/js` - Main preferences window
   - Advanced preferences available via JSON file editing

4. **Utilities** (`app/utils/`)
   - `scheduler.js` - Core timing mechanism
   - `naturalBreaksManager.js` - Idle time detection
   - `dndManager.js` - Do Not Disturb integration
   - `appExclusionsManager.js` - App-based break pausing
   - `breakShortcuts.js` - Global keyboard shortcuts

### Localization
- i18next-based internationalization
- Translation files in `app/locales/`
- Translations managed via Weblate

### Testing
- Uses Vitest for unit testing
- Tests located in `test/` directory
- Configuration in `vitest.config.ts`

## Important Development Notes

- Node.js version must match the one specified in `package.json` (currently 20.18.1)
- Follow StandardJS code style (enforced by linter)
- The app runs in the system tray by default (LSUIElement/LSBackgroundOnly on macOS)
- Break windows are designed to be always-on-top and fullscreen-capable
- Preferences can be edited programmatically or via the JSON file
- The app supports command-line interaction when running (`stretchly help`)

## Platform-Specific Considerations

- **macOS**: App is not code-signed; requires quarantine bypass
- **Windows**: Integrates with Windows Focus Assist/Quiet Hours
- **Linux**: May require additional packages for natural breaks (`libxss-dev`)

## Before Making Changes

1. Open an issue to discuss the feature/change
2. Follow the contributing guidelines in CONTRIBUTING.md
3. Write tests when possible
4. Update CHANGELOG.md with your changes
5. Add yourself to the contributors list in README.md