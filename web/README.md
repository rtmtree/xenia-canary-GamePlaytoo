# Xenia Web Emulator

Xbox 360 Emulator running in the browser using WebAssembly and React.

## Prerequisites

1. **Emscripten SDK**: Install and activate the Emscripten SDK
   ```bash
   # Download and install emsdk
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ./emsdk install latest
   ./emsdk activate latest
   source ./emsdk_env.sh
   ```

2. **Node.js**: Install Node.js 14 or later

3. **npm**: Comes with Node.js

## Setup

1. Install React dependencies:
   ```bash
   cd web
   npm install
   ```

2. Build the WebAssembly module:
   ```bash
   npm run build-wasm
   ```

## Development

Start the development server:
```bash
npm start
```

This will:
1. Build the WebAssembly module
2. Start the React development server
3. Open the application in your browser

## Build for Production

```bash
npm run build
```

## Project Structure

```
web/
├── public/
│   ├── index.html
│   └── wasm/
│       ├── xenia_wasm.js      # Generated WebAssembly module
│       ├── xenia_wasm.wasm    # WebAssembly binary
│       └── loader.js          # WebAssembly loader
├── src/
│   ├── components/
│   │   ├── GameCanvas.js      # Game canvas component
│   │   ├── GameControls.js    # Game controls component
│   │   ├── RomImporter.js     # ROM file import component
│   │   └── StatusBar.js       # Status bar component
│   ├── wasm/
│   │   └── XeniaWasmLoader.js # WebAssembly interface
│   ├── App.js                 # Main application component
│   ├── index.js               # Application entry point
│   └── index.css              # Global styles
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## Features

- **ROM Import**: Import Xbox 360 ROM files (.iso, .xex, .bin)
- **Game Canvas**: 1280x720 canvas for game rendering
- **Game Controls**: Play, Pause, Stop, Fullscreen controls
- **Status Display**: Real-time FPS and memory usage
- **WebAssembly Integration**: High-performance emulation core
- **Responsive Design**: Works on desktop and mobile devices

## Usage

1. Open the application in your browser
2. Click "Import ROM File" to select a Xbox 360 ROM
3. Click "Play" to start the emulation
4. Use game controls to manage the emulation
5. Click "Fullscreen" for full-screen gaming

## Troubleshooting

### WebAssembly Module Not Loading

- Ensure Emscripten SDK is properly installed and activated
- Check that the WebAssembly files are generated in `public/wasm/`
- Verify browser supports WebAssembly

### ROM Loading Issues

- Ensure ROM file format is supported (.iso, .xex, .bin)
- Check file size and integrity
- Verify ROM compatibility with Xenia

### Performance Issues

- Use a modern browser with WebAssembly support
- Ensure sufficient system memory
- Try reducing canvas resolution if needed

## Development Notes

This is a proof-of-concept implementation. The WebAssembly module currently provides a minimal interface with placeholder functionality. Full Xbox 360 emulation would require:

1. Complete Xenia core integration
2. GPU rendering implementation
3. Audio system integration
4. Input handling system
5. File system emulation
6. Xbox 360 kernel implementation

## License

GPL-3.0 License - See the main Xenia project for details.
