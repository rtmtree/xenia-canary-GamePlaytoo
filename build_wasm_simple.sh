#!/bin/bash

# Simplified Xenia WebAssembly Build Script
# This script builds a minimal WebAssembly module for browser compatibility

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
OUTPUT_DIR="$WEB_DIR/src/wasm"

echo -e "${BLUE}Building simplified Xenia WebAssembly module...${NC}"

# Check if Emscripten is available
if ! command -v emcc &> /dev/null; then
    echo -e "${RED}Error: Emscripten not found. Please install Emscripten and activate it.${NC}"
    echo -e "${YELLOW}Run: source $PROJECT_ROOT/emsdk/emsdk_env.sh${NC}"
    exit 1
fi

# Create build directory
echo -e "${BLUE}Creating build directory...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

# Create a minimal WebAssembly module for browser
cat > "$BUILD_DIR/main_wasm.cpp" << 'EOF'
// Minimal WebAssembly module for Xenia browser integration
#include <emscripten.h>
#include <iostream>
#include <vector>
#include <cstdlib>
#include <string>

// Global ROM storage
static std::vector<uint8_t> rom_data;
static bool rom_loading_initialized = false;

extern "C" {
    // Initialize the emulator
    EMSCRIPTEN_KEEPALIVE
    int initialize_emulator() {
        // Simple initialization
        return 0;
    }
    
    // Initialize ROM loading for chunked transfer
    EMSCRIPTEN_KEEPALIVE
    int init_rom_loading(size_t total_size) {
        try {
            rom_data.clear();
            rom_data.reserve(total_size);
            rom_loading_initialized = true;
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Load a ROM chunk using direct memory transfer
    EMSCRIPTEN_KEEPALIVE
    int load_rom_chunk_direct(const uint8_t* chunk_data, size_t offset, size_t chunk_size) {
        if (!rom_loading_initialized) return -1;
        
        try {
            // Ensure rom_data is large enough
            if (offset + chunk_size > rom_data.size()) {
                rom_data.resize(offset + chunk_size);
            }
            
            // Copy chunk data directly (no base64 decoding needed)
            std::copy(chunk_data, chunk_data + chunk_size, rom_data.begin() + offset);
            
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Write multiple bytes to memory (for batch operations)
    EMSCRIPTEN_KEEPALIVE
    int write_bytes_to_memory(uint8_t* address, const char* data, size_t length) {
        try {
            for (size_t i = 0; i < length; i++) {
                address[i] = static_cast<uint8_t>(data[i]);
            }
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Write a single byte to memory (for fallback memory access)
    EMSCRIPTEN_KEEPALIVE
    int write_byte_to_memory(uint8_t* address, uint8_t value) {
        try {
            *address = value;
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Finalize ROM loading
    EMSCRIPTEN_KEEPALIVE
    int finalize_rom_loading() {
        rom_loading_initialized = false;
        return 0;
    }
    
    // Load a ROM file (direct method)
    EMSCRIPTEN_KEEPALIVE
    int load_rom(const uint8_t* data, size_t size) {
        try {
            rom_data.clear();
            rom_data.assign(data, data + size);
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Load ROM from base64 string (legacy method)
    EMSCRIPTEN_KEEPALIVE
    int load_rom_from_base64(const char* base64_data) {
        try {
            std::string base64_str(base64_data);
            rom_data.clear();
            rom_data.reserve(base64_str.length());
            
            // Simple base64 decode (placeholder)
            for (char c : base64_str) {
                rom_data.push_back(static_cast<uint8_t>(c));
            }
            
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Start the emulation
    EMSCRIPTEN_KEEPALIVE
    int start_emulation() {
        // Simulate starting emulation
        return 0;
    }
    
    // Stop the emulation
    EMSCRIPTEN_KEEPALIVE
    int stop_emulation() {
        // Simulate stopping emulation
        return 0;
    }
    
    // Get frame buffer pointer
    EMSCRIPTEN_KEEPALIVE
    uint8_t* get_frame_buffer() {
        static std::vector<uint8_t> frame_buffer(1280 * 720 * 4); // RGBA
        static uint32_t frame_counter = 0;
        
        // Generate animated test pattern
        frame_counter++;
        for (int y = 0; y < 720; y++) {
            for (int x = 0; x < 1280; x++) {
                int idx = (y * 1280 + x) * 4;
                uint32_t pixel = (x + y + frame_counter) * 7;
                frame_buffer[idx] = pixel % 255;     // R
                frame_buffer[idx + 1] = (pixel * 2) % 255; // G
                frame_buffer[idx + 2] = (pixel * 3) % 255; // B
                frame_buffer[idx + 3] = 255;           // A
            }
        }
        
        return frame_buffer.data();
    }
}

// No main function needed for modular build
EOF

# Compile with Emscripten for browser compatibility
echo -e "${BLUE}Compiling with Emscripten...${NC}"

cd "$BUILD_DIR"

EMCC_FLAGS=(
    -O3
    --bind
    -s WASM=1
    -s ALLOW_MEMORY_GROWTH=1
    -s EXPORTED_FUNCTIONS="[_initialize_emulator,_load_rom,_load_rom_from_base64,_init_rom_loading,_load_rom_chunk_direct,_finalize_rom_loading,_write_bytes_to_memory,_write_byte_to_memory,_start_emulation,_stop_emulation,_get_frame_buffer,_malloc,_free]"
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']"
    -s MODULARIZE=1
    -s EXPORT_NAME="'XeniaWasm'"
    -s INVOKE_RUN=0
    -s NO_EXIT_RUNTIME=1
    -s ENVIRONMENT="web"
    -s NODEJS_CATCH_EXIT=0
    -s NODEJS_CATCH_REJECTION=0
    -s SINGLE_FILE=1
    -s WASM_ASYNC_COMPILATION=0
    -s EXPORT_ES6=1
    -s EXPORT_NAME="'XeniaWasm'"
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

echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${BLUE}Files copied to: $OUTPUT_DIR${NC}"
