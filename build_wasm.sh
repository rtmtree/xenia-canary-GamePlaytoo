#!/bin/bash

# Xenia WebAssembly Build Script
# This script builds the Xenia emulator using Emscripten and copies the output to the web directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$PROJECT_ROOT/web"
BUILD_DIR="$PROJECT_ROOT/build-wasm"
OUTPUT_DIR="$WEB_DIR/public/wasm"

echo -e "${BLUE}Starting Xenia WebAssembly build...${NC}"

# Check if Emscripten is available
if ! command -v emcc &> /dev/null; then
    echo -e "${RED}Error: Emscripten not found. Please install Emscripten and activate it.${NC}"
    echo -e "${YELLOW}Visit: https://emscripten.org/docs/getting_started/downloads.html${NC}"
    exit 1
fi

# Check if emsdk is activated
if [ -z "$EMSDK" ]; then
    echo -e "${RED}Error: Emscripten SDK not activated. Please run: source /path/to/emsdk/emsdk_env.sh${NC}"
    exit 1
fi

echo -e "${GREEN}Emscripten found: $(emcc --version | head -n1)${NC}"

# Create build directory
echo -e "${BLUE}Creating build directory...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

# Find Xenia source files
echo -e "${BLUE}Locating Xenia source files...${NC}"

# Common source files (adjust these paths based on actual Xenia structure)
XENIA_SOURCES=(
    "$PROJECT_ROOT/src/xenia/app/emulator_window.cc"
    "$PROJECT_ROOT/src/xenia/app/emulator.cc"
    "$PROJECT_ROOT/src/xenia/base/main.cc"
    "$PROJECT_ROOT/src/xenia/cpu/cpu.cc"
    "$PROJECT_ROOT/src/xenia/gpu/gpu.cc"
    "$PROJECT_ROOT/src/xenia/hid/hid.cc"
    "$PROJECT_ROOT/src/xenia/kernel/kernel.cc"
    "$PROJECT_ROOT/src/xenia/ui/ui.cc"
    "$PROJECT_ROOT/src/xenia/vfs/vfs.cc"
)

# Check if source files exist
VALID_SOURCES=()
for source in "${XENIA_SOURCES[@]}"; do
    if [ -f "$source" ]; then
        VALID_SOURCES+=("$source")
        echo -e "${GREEN}Found: $source${NC}"
    else
        echo -e "${YELLOW}Warning: $source not found${NC}"
    fi
done

if [ ${#VALID_SOURCES[@]} -eq 0 ]; then
    echo -e "${RED}Error: No valid source files found. Please check the paths.${NC}"
    exit 1
fi

# Create a minimal main file for WebAssembly
cat > "$BUILD_DIR/main_wasm.cpp" << 'EOF'
// Main entry point for Xenia WebAssembly build
#include <emscripten.h>
#include <iostream>
#include <vector>

extern "C" {
    // Initialize the emulator
    EMSCRIPTEN_KEEPALIVE
    int initialize_emulator() {
        std::cout << "Initializing Xenia WebAssembly emulator..." << std::endl;
        // TODO: Initialize actual Xenia components
        return 0;
    }
    
    // Load a ROM file
    EMSCRIPTEN_KEEPALIVE
    int load_rom(const uint8_t* data, size_t size) {
        std::cout << "Loading ROM of size: " << size << " bytes" << std::endl;
        // TODO: Implement ROM loading
        return 0;
    }
    
    // Start the emulation
    EMSCRIPTEN_KEEPALIVE
    int start_emulation() {
        std::cout << "Starting emulation..." << std::endl;
        // TODO: Start actual emulation
        return 0;
    }
    
    // Stop the emulation
    EMSCRIPTEN_KEEPALIVE
    int stop_emulation() {
        std::cout << "Stopping emulation..." << std::endl;
        // TODO: Stop actual emulation
        return 0;
    }
    
    // Render frame to canvas
    EMSCRIPTEN_KEEPALIVE
    void render_frame() {
        // TODO: Render actual frame
        // This will be called from JavaScript animation loop
    }
    
    // Get frame buffer pointer
    EMSCRIPTEN_KEEPALIVE
    uint8_t* get_frame_buffer() {
        static std::vector<uint8_t> frame_buffer(1280 * 720 * 4); // RGBA
        // Fill with test pattern
        for (int i = 0; i < 1280 * 720; i++) {
            int idx = i * 4;
            frame_buffer[idx] = (i * 7) % 255;     // R
            frame_buffer[idx + 1] = (i * 13) % 255; // G
            frame_buffer[idx + 2] = (i * 17) % 255; // B
            frame_buffer[idx + 3] = 255;           // A
        }
        return frame_buffer.data();
    }
}

int main() {
    std::cout << "Xenia WebAssembly module loaded" << std::endl;
    return 0;
}
EOF

# Compile with Emscripten
echo -e "${BLUE}Compiling with Emscripten...${NC}"

cd "$BUILD_DIR"

EMCC_FLAGS=(
    -O3
    --bind
    -s WASM=1
    -s ALLOW_MEMORY_GROWTH=1
    -s EXPORTED_FUNCTIONS="[_initialize_emulator,_load_rom,_start_emulation,_stop_emulation,_render_frame,_get_frame_buffer]"
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']"
    -s MODULARIZE=1
    -s EXPORT_NAME="'XeniaWasm'"
    -s INVOKE_RUN=0
    -s NO_EXIT_RUNTIME=1
    -s ERROR_ON_UNDEFINED_SYMBOLS=0
    -s WARN_ON_UNDEFINED_SYMBOLS=0
    -I"$PROJECT_ROOT/src"
    -I"$PROJECT_ROOT/third_party"
    --std=c++17
    -o xenia_wasm.js
    main_wasm.cpp
)

echo "Running: emcc ${EMCC_FLAGS[@]}"
emcc "${EMCC_FLAGS[@]}"

# Check if compilation succeeded
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Compilation successful!${NC}"
else
    echo -e "${RED}Compilation failed!${NC}"
    exit 1
fi

# Copy generated files to web directory
echo -e "${BLUE}Copying files to web directory...${NC}"

cp xenia_wasm.js "$OUTPUT_DIR/"
cp xenia_wasm.wasm "$OUTPUT_DIR/" 2>/dev/null || echo -e "${YELLOW}Warning: .wasm file not generated${NC}"

# Create a loader script for the WebAssembly module
cat > "$OUTPUT_DIR/loader.js" << 'EOF'
// Xenia WebAssembly Loader
class XeniaWasmLoader {
    constructor() {
        this.module = null;
        this.isLoaded = false;
    }
    
    async load() {
        if (this.isLoaded) return;
        
        try {
            // Import the WebAssembly module
            const XeniaWasm = await import('./xenia_wasm.js');
            this.module = await XeniaWasm.default();
            this.isLoaded = true;
            console.log('Xenia WebAssembly module loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load Xenia WebAssembly module:', error);
            return false;
        }
    }
    
    initialize() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._initialize_emulator();
    }
    
    loadRom(data) {
        if (!this.isLoaded) throw new Error('Module not loaded');
        
        // Allocate memory for ROM data
        const ptr = this.module._malloc(data.length);
        this.module.HEAPU8.set(data, ptr);
        
        // Call the load_rom function
        const result = this.module._load_rom(ptr, data.length);
        
        // Free allocated memory
        this.module._free(ptr);
        
        return result;
    }
    
    startEmulation() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._start_emulation();
    }
    
    stopEmulation() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._stop_emulation();
    }
    
    getFrameBuffer() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._get_frame_buffer();
    }
}

export default XeniaWasmLoader;
EOF

echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${BLUE}Files copied to: $OUTPUT_DIR${NC}"
echo -e "${YELLOW}Note: This is a minimal build. You'll need to integrate actual Xenia source files for full functionality.${NC}"
