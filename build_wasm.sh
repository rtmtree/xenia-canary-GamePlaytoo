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

# Copy the existing main_wasm.cpp instead of generating a new one
echo -e "${BLUE}Using existing main_wasm.cpp file...${NC}"
if [ -f "$BUILD_DIR/main_wasm.cpp" ]; then
    echo -e "${GREEN}Found existing main_wasm.cpp${NC}"
else
    echo -e "${RED}Error: main_wasm.cpp not found in build directory${NC}"
    exit 1
fi

# Compile with Emscripten
echo -e "${BLUE}Compiling with Emscripten...${NC}"

cd "$BUILD_DIR"

EMCC_FLAGS=(
    -O0  # Disable optimization to prevent function removal
    --bind
    -s WASM=1
    -s ALLOW_MEMORY_GROWTH=1
    -s EXPORTED_FUNCTIONS="[_malloc,_free,_initialize_emulator,_load_rom,_start_emulation,_stop_emulation,_get_frame_buffer,_read_byte_from_memory,_write_byte_to_memory,_write_bytes_to_memory,_init_rom_loading,_load_rom_chunk_direct,_finalize_rom_loading,_load_rom_from_base64,_test_read_function]"
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']"
    -s MODULARIZE=1
    -s EXPORT_NAME="'XeniaWasm'"
    -s INVOKE_RUN=0
    -s NO_EXIT_RUNTIME=1
    -s ERROR_ON_UNDEFINED_SYMBOLS=0
    -s WARN_ON_UNDEFINED_SYMBOLS=0
    -s ENVIRONMENT="web"
    -s WASM_ASYNC_COMPILATION=0
    -s SINGLE_FILE=0
    -s EXPORT_ES6=1
    -s NO_FORCE_FILESYSTEM=1
    -s RETAIN_COMPILER_SETTINGS=1
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
