#!/bin/bash

# Xenia WebGPU WebAssembly Build Script
# This script builds Xenia with WebGPU support for browser compatibility

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
BUILD_DIR="$PROJECT_ROOT/build-wasm-webgpu"
OUTPUT_DIR="$WEB_DIR/src/wasm"

echo -e "${BLUE}Building Xenia WebGPU WebAssembly module...${NC}"

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

# Create WebGPU-enabled WebAssembly module
cat > "$BUILD_DIR/main_wasm.cpp" << 'EOF'
// Xenia WebGPU WebAssembly Module
#include <emscripten.h>
#include <iostream>
#include <vector>
#include <cstdlib>

extern "C" {
    // Initialize WebGPU graphics system
    EMSCRIPTEN_KEEPALIVE
    int initialize_webgpu() {
        std::cout << "Initializing WebGPU graphics system..." << std::endl;
        // WebGPU initialization will be handled in JavaScript
        return 0;
    }
    
    // Initialize the emulator
    EMSCRIPTEN_KEEPALIVE
    int initialize_emulator() {
        std::cout << "Initializing Xenia emulator..." << std::endl;
        return 0;
    }
    
    // Load a ROM file
    EMSCRIPTEN_KEEPALIVE
    int load_rom(const uint8_t* data, size_t size) {
        std::cout << "Loading ROM of size: " << size << " bytes" << std::endl;
        // TODO: Implement actual ROM loading
        return 0;
    }
    
    // Start the emulation
    EMSCRIPTEN_KEEPALIVE
    int start_emulation() {
        std::cout << "Starting Xenia emulation..." << std::endl;
        return 0;
    }
    
    // Stop the emulation
    EMSCRIPTEN_KEEPALIVE
    int stop_emulation() {
        std::cout << "Stopping Xenia emulation..." << std::endl;
        return 0;
    }
    
    // Get frame buffer pointer (WebGPU version)
    EMSCRIPTEN_KEEPALIVE
    uint8_t* get_frame_buffer() {
        static std::vector<uint8_t> frame_buffer(1280 * 720 * 4); // RGBA
        static uint32_t frame_counter = 0;
        
        // Generate animated test pattern with WebGPU-style effects
        frame_counter++;
        for (int y = 0; y < 720; y++) {
            for (int x = 0; x < 1280; x++) {
                int idx = (y * 1280 + x) * 4;
                
                // Create more complex pattern for WebGPU demo
                float fx = x / 1280.0f;
                float fy = y / 720.0f;
                float time = frame_counter * 0.01f;
                
                // Animated gradient with wave effect
                float wave = sin(fx * 10.0f + time) * cos(fy * 10.0f + time);
                uint8_t r = (uint8_t)((sin(wave + time) * 0.5f + 0.5f) * 255);
                uint8_t g = (uint8_t)((cos(wave + time * 1.3f) * 0.5f + 0.5f) * 255);
                uint8_t b = (uint8_t)((sin(wave * 2.0f + time * 0.7f) * 0.5f + 0.5f) * 255);
                
                frame_buffer[idx] = r;
                frame_buffer[idx + 1] = g;
                frame_buffer[idx + 2] = b;
                frame_buffer[idx + 3] = 255; // Alpha
            }
        }
        
        return frame_buffer.data();
    }
    
    // WebGPU-specific functions
    EMSCRIPTEN_KEEPALIVE
    int webgpu_create_device() {
        std::cout << "Creating WebGPU device..." << std::endl;
        // This will trigger WebGPU device creation in JavaScript
        return 0;
    }
    
    EMSCRIPTEN_KEEPALIVE
    int webgpu_create_swap_chain() {
        std::cout << "Creating WebGPU swap chain..." << std::endl;
        // This will trigger swap chain creation in JavaScript
        return 0;
    }
    
    EMSCRIPTEN_KEEPALIVE
    void webgpu_render_frame() {
        // This function will be called to render a frame using WebGPU
        // The actual rendering will happen in JavaScript
    }
    
    // Get WebGPU capabilities
    EMSCRIPTEN_KEEPALIVE
    const char* get_webgpu_info() {
        static std::string info = "Xenia WebGPU Backend v1.0";
        return info.c_str();
    }
}

// No main function needed for modular build
EOF

# Compile with Emscripten for WebGPU support
echo -e "${BLUE}Compiling with Emscripten for WebGPU...${NC}"

cd "$BUILD_DIR"

EMCC_FLAGS=(
    -O3
    --bind
    -s WASM=1
    -s ALLOW_MEMORY_GROWTH=1
    -s EXPORTED_FUNCTIONS="[_initialize_webgpu,_initialize_emulator,_load_rom,_start_emulation,_stop_emulation,_get_frame_buffer,_webgpu_create_device,_webgpu_create_swap_chain,_webgpu_render_frame,_get_webgpu_info]"
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']"
    -s MODULARIZE=1
    -s EXPORT_NAME="'XeniaWebGPU'"
    -s INVOKE_RUN=0
    -s NO_EXIT_RUNTIME=1
    -s ENVIRONMENT="web"
    -s NODEJS_CATCH_EXIT=0
    -s NODEJS_CATCH_REJECTION=0
    -s SINGLE_FILE=1
    -s WASM_ASYNC_COMPILATION=0
    --std=c++17
    -o xenia_webgpu.js
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

cp xenia_webgpu.js "$OUTPUT_DIR/"
cp xenia_webgpu.wasm "$OUTPUT_DIR/" 2>/dev/null || echo -e "${YELLOW}Warning: .wasm file not generated${NC}"

# Create WebGPU loader script
cat > "$OUTPUT_DIR/XeniaWebGPULoader.js" << 'EOF'
// Xenia WebGPU WebAssembly Loader
class XeniaWebGPULoader {
    constructor() {
        this.module = null;
        this.isLoaded = false;
        this.device = null;
        this.context = null;
    }
    
    async load() {
        if (this.isLoaded) return;
        
        try {
            console.log('🔍 Loading Xenia WebGPU WebAssembly module...');
            const XeniaWebGPU = await import('./xenia_webgpu.js');
            this.module = await XeniaWebGPU.default();
            this.isLoaded = true;
            console.log('✅ Xenia WebGPU WebAssembly module loaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to load Xenia WebGPU WebAssembly module:', error);
            return false;
        }
    }
    
    async initializeWebGPU() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        
        try {
            console.log('🔍 Initializing WebGPU...');
            
            // Check WebGPU support
            if (!navigator.gpu) {
                throw new Error('WebGPU not supported in this browser');
            }
            
            // Request adapter
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });
            
            if (!adapter) {
                throw new Error('No appropriate WebGPU adapter found');
            }
            
            // Request device
            this.device = await adapter.requestDevice();
            
            // Get canvas context
            const canvas = document.getElementById('game-canvas');
            if (!canvas) {
                throw new Error('Game canvas not found');
            }
            
            this.context = canvas.getContext('webgpu');
            if (!this.context) {
                throw new Error('Failed to get WebGPU context');
            }
            
            // Configure swap chain
            const swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
            this.context.configure({
                device: this.device,
                format: swapChainFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
            });
            
            console.log('✅ WebGPU initialized successfully');
            
            // Initialize C++ WebGPU system
            this.module._initialize_webgpu();
            this.module._webgpu_create_device();
            this.module._webgpu_create_swap_chain();
            
            return true;
        } catch (error) {
            console.error('❌ WebGPU initialization failed:', error);
            throw error;
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
    
    async renderFrame() {
        if (!this.isLoaded || !this.device) return;
        
        try {
            // Get current texture from swap chain
            const currentTexture = this.context.getCurrentTexture();
            
            // Create command encoder
            const commandEncoder = this.device.createCommandEncoder();
            
            // Create render pass
            const renderPassDescriptor = {
                colorAttachments: [{
                    view: currentTexture.createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
            };
            
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            
            // Get frame buffer from WebAssembly
            const frameBufferPtr = this.getFrameBuffer();
            const frameBufferData = new Uint8Array(this.module.HEAPU8.buffer, frameBufferPtr, 1280 * 720 * 4);
            
            // Create texture from frame buffer data
            const texture = this.device.createTexture({
                size: { width: 1280, height: 720 },
                format: 'rgba8unorm',
                usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            });
            
            // Write frame buffer to texture
            this.device.queue.writeTexture(
                { texture },
                frameBufferData,
                { bytesPerRow: 1280 * 4, rowsPerImage: 720 },
                { width: 1280, height: 720 }
            );
            
            // Create simple render pipeline to display texture
            const vertexShaderCode = `
                @vertex
                fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
                    let pos = array<vec2<f32>, 6>(
                        vec2<f32>(-1.0, -1.0),
                        vec2<f32>( 1.0, -1.0),
                        vec2<f32>( 1.0,  1.0),
                        vec2<f32>(-1.0, -1.0),
                        vec2<f32>( 1.0,  1.0),
                        vec2<f32>(-1.0,  1.0)
                    );
                    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
                }
            `;
            
            const fragmentShaderCode = `
                @group(0) @binding(0) var texSampler: sampler;
                @group(0) @binding(1) var frameTexture: texture_2d<f32>;
                
                @fragment
                fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
                    let uv = vec2<f32>(fragCoord.x / 1280.0, fragCoord.y / 720.0);
                    return textureSample(frameTexture, texSampler, uv);
                }
            `;
            
            const vertexShader = this.device.createShaderModule({ code: vertexShaderCode });
            const fragmentShader = this.device.createShaderModule({ code: fragmentShaderCode });
            
            const sampler = this.device.createSampler();
            
            const pipelineDescriptor = {
                layout: 'auto',
                vertex: {
                    module: vertexShader,
                    entryPoint: 'vs_main',
                },
                fragment: {
                    module: fragmentShader,
                    entryPoint: 'fs_main',
                    targets: [{
                        format: navigator.gpu.getPreferredCanvasFormat(),
                    }],
                },
                primitive: {
                    topology: 'triangle-list',
                },
            };
            
            const pipeline = this.device.createRenderPipeline(pipelineDescriptor);
            
            // Create bind group
            const bindGroup = this.device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: texture.createView() },
                ],
            });
            
            // Render
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.draw(6);
            passEncoder.end();
            
            // Submit commands
            const commandBuffer = commandEncoder.finish();
            this.device.queue.submit([commandBuffer]);
            
            // Notify C++ that frame was rendered
            this.module._webgpu_render_frame();
            
        } catch (error) {
            console.error('❌ WebGPU render failed:', error);
        }
    }
    
    getWebGPUInfo() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._get_webgpu_info();
    }
}

export default XeniaWebGPULoader;
