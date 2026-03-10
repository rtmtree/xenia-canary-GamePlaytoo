// Xenia WebAssembly Loader
class XeniaWasmLoader {
    constructor() {
        this.module = null;
        this.isLoaded = false;
    }

    async load() {
        if (this.isLoaded) return;

        try {
            console.log('🔍 Attempting to import WebAssembly module...');

            // First, fetch the WASM file using webpack's public path
            const wasmResponse = await fetch('/wasm/xenia_wasm.wasm');
            if (!wasmResponse.ok) {
                throw new Error(`Failed to fetch WASM: ${wasmResponse.status} ${wasmResponse.statusText}`);
            }
            const wasmBinary = await wasmResponse.arrayBuffer();
            console.log('🔍 WASM binary loaded, size:', wasmBinary.byteLength);

            // Load the WebAssembly module via a script tag to prevent Webpack
            // from bundling it. This fixes the pthread worker loading issue 
            // since Emscripten explicitly relies on document.currentScript.src
            await new Promise((resolve, reject) => {
                if (window.XeniaWasm) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = '/wasm/xenia_wasm.js';
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
            console.log('🔍 Module script loaded, initializing...');

            // Initialize the module with preloaded WASM binary
            this.module = await window.XeniaWasm({
                mainScriptUrlOrBlob: '/wasm/xenia_wasm.js',
                wasmBinary: wasmBinary,
                locateFile: function (path) {
                    return '/wasm/' + path;
                },
                onRuntimeInitialized: () => {
                    console.log('✅ Emscripten runtime initialized');
                }
            });

            console.log('🔍 Module initialized:', this.module);
            console.log('🔍 Available functions:', Object.getOwnPropertyNames(this.module).filter(name => name.startsWith('_')));

            // Force function availability check and debug
            console.log('🔍 Function availability check:');
            console.log('   _read_byte_from_memory:', !!this.module._read_byte_from_memory);
            console.log('   _test_read_function:', !!this.module._test_read_function);
            console.log('   ccall available:', !!this.module.ccall);

            // Try to force function access
            if (this.module._read_byte_from_memory) {
                console.log('✅ _read_byte_from_memory is directly accessible');
            } else {
                console.log('❌ _read_byte_from_memory not directly accessible');

                // Try to find it in different ways
                const allProps = Object.getOwnPropertyNames(this.module);
                const readByteFuncs = allProps.filter(name => name.includes('read_byte'));
                console.log('   Functions containing "read_byte":', readByteFuncs);

                // Try ccall approach
                if (this.module.ccall) {
                    try {
                        const testResult = this.module.ccall('read_byte_from_memory', 'number', ['number'], [0]);
                        console.log('✅ ccall approach works, result:', testResult);
                    } catch (error) {
                        console.log('❌ ccall approach failed:', error.message);
                    }
                }
            }

            // Check if required functions are available
            const requiredFunctions = ['_malloc', '_free', '_initialize_emulator', '_load_rom', '_start_emulation'];
            const missingFunctions = requiredFunctions.filter(func => !this.module[func]);

            if (missingFunctions.length > 0) {
                console.error('❌ Missing required functions:', missingFunctions);
                console.log('🔍 All available properties:', Object.getOwnPropertyNames(this.module));
                throw new Error(`Missing required WebAssembly functions: ${missingFunctions.join(', ')}`);
            }

            this.isLoaded = true;
            console.log('✅ Xenia WebAssembly module loaded successfully');

            // Initialize WebGPU for the emulator
            try {
                await this.initWebGPU();
            } catch (webgpuError) {
                console.error('⚠️ WebGPU initialization failed, falling back to 2D canvas:', webgpuError);
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to load Xenia WebAssembly module:', error);
            console.error('❌ Error details:', error.message, error.stack);
            return false;
        }
    }
    async initWebGPU() {
        console.log('🚀 initWebGPU: Starting...');
        if (!navigator.gpu) {
            console.error('❌ initWebGPU: WebGPU not supported');
            return;
        }

        // Define callbacks early to stop WASM warnings
        console.log('🔍 initWebGPU: Defining early callbacks');
        window._webgpu_on_draw = globalThis._webgpu_on_draw = (opcode) => { };
        window._webgpu_draw_primitives = globalThis._webgpu_draw_primitives = (ptr, vertexCount) => { };
        window._webgpu_render = globalThis._webgpu_render = (framebufferPtr) => { };

        console.log('🔍 initWebGPU: Requesting adapter...');
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.error('❌ initWebGPU: No adapter found');
            return;
        }

        console.log('🔍 initWebGPU: Requesting device...');
        const device = await adapter.requestDevice();
        console.log('✅ initWebGPU: Device acquired');

        // Retry logic for finding the canvas as React might not have mounted it yet
        let canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.log('🔍 Game canvas not found yet, retrying (up to 3s)...');
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 100));
                canvas = document.getElementById('game-canvas');
                if (canvas) break;
            }
        }

        if (!canvas) {
            console.warn('⚠️ Game canvas NOT FOUND after retries. WebGPU rendering disabled.');
            return;
        }

        console.log('✅ Found game-canvas for WebGPU');
        const context = canvas.getContext('webgpu');
        if (!context) {
            throw new Error('Could not acquire WebGPU context from canvas');
        }
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'premultiplied' });

        this._drawCount = 0;
        this._lastDrawTime = 0;
        this._pendingPrimitives = null;

        // Initialize WebGPU resources
        const guestTexture = device.createTexture({
            size: [1280, 720, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        const guestSampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });

        const vertexCode = `
            @vertex
            fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
                var pos = array<vec2<f32>, 4>(
                    vec2<f32>(-1.0, -1.0),
                    vec2<f32>( 1.0, -1.0),
                    vec2<f32>(-1.0,  1.0),
                    vec2<f32>( 1.0,  1.0)
                );
                return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
            }
        `;

        const fragmentCode = `
            @group(0) @binding(0) var mySampler: sampler;
            @group(0) @binding(1) var myTexture: texture_2d<f32>;

            @fragment
            fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
                let uv = fragCoord.xy / vec2<f32>(1280.0, 720.0);
                var color = textureSample(myTexture, mySampler, uv);
                
                // Add retro scanlines effect
                let scanline = sin(fragCoord.y * 1.5) * 0.1;
                color = vec4<f32>(color.rgb - scanline, color.a);
                
                // Subtle vignette
                let dist = distance(uv, vec2<f32>(0.5, 0.5));
                let vignette = 1.0 - smoothstep(0.4, 0.8, dist);
                color = vec4<f32>(color.rgb * vignette, color.a);

                return color;
            }
        `;

        console.log('🔍 initWebGPU: Creating quad pipeline...');
        const vertexModule = device.createShaderModule({ code: vertexCode });
        const fragmentModule = device.createShaderModule({ code: fragmentCode });

        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
            ],
        });

        const pipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            vertex: { module: vertexModule, entryPoint: 'vs_main' },
            fragment: {
                module: fragmentModule,
                entryPoint: 'fs_main',
                targets: [{ format }],
            },
            primitive: { topology: 'triangle-strip' },
        });
        console.log('✅ initWebGPU: Quad pipeline created');

        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: guestSampler },
                { binding: 1, resource: guestTexture.createView() },
            ],
        });

        // Primitive Pipeline for native Guest Rendering
        const primitiveVertexModule = device.createShaderModule({
            code: `
            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) color: vec3<f32>,
            };
            @vertex
            fn vs_main(@location(0) pos: vec3<f32>, @location(1) color: vec3<f32>) -> VertexOutput {
                var out: VertexOutput;
                out.position = vec4<f32>(pos, 1.0);
                out.color = color;
                return out;
            }
            `
        });

        const primitiveFragmentModule = device.createShaderModule({
            code: `
            @fragment
            fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                return vec4<f32>(color, 1.0);
            }
            `
        });

        console.log('🔍 initWebGPU: Creating primitive pipeline...');
        const primitivePipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: primitiveVertexModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 24, // 3 * 4 (pos) + 3 * 4 (color)
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },
                        { shaderLocation: 1, offset: 12, format: 'float32x3' },
                    ],
                }],
            },
            fragment: {
                module: primitiveFragmentModule,
                entryPoint: 'fs_main',
                targets: [{ format }],
            },
            primitive: { topology: 'triangle-list' },
        });

        const primitiveBuffer = device.createBuffer({
            size: 16384 * 24, // Space for 16k vertices
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.primitivePipeline = primitivePipeline;
        this.primitiveBuffer = primitiveBuffer;
        console.log('✅ initWebGPU: Primitive pipeline created');

        // Set up the global callbacks that C++ will call
        window._webgpu_on_draw = globalThis._webgpu_on_draw = (opcode) => {
            this._lastDrawTime = performance.now();
            this._drawCount++;
            if (this._drawCount % 100 === 0) {
                console.log('🎮 WebGPU: Received Draw Packet, Opcode: 0x' + opcode.toString(16));
            }
        };

        window._webgpu_draw_primitives = globalThis._webgpu_draw_primitives = (ptr, vertexCount) => {
            if (!this.module || !this.module.HEAPU8) return;
            const size = vertexCount * 24; // 6 floats per vertex
            const data = this.module.HEAPU8.subarray(ptr, ptr + size).slice(); // Copy data
            this._pendingPrimitives = { data, count: vertexCount };

            if (this._drawCount % 60 === 0) {
                console.log(`🔺 WebGPU: Collected ${vertexCount} native primitives from guest memory`);
            }
        };

        window._webgpu_render = globalThis._webgpu_render = (framebufferPtr) => {
            if (!this.module || !this.module.HEAPU8) return;
            const framebufferData = this.module.HEAPU8.subarray(framebufferPtr, framebufferPtr + 1280 * 720 * 4);

            device.queue.writeTexture(
                { texture: guestTexture },
                framebufferData,
                { bytesPerRow: 1280 * 4 },
                { width: 1280, height: 720 }
            );

            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
            });

            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.draw(4);

            // Layered native primitives (Guest Drawing)
            if (this._pendingPrimitives && this._pendingPrimitives.count > 0) {
                device.queue.writeBuffer(this.primitiveBuffer, 0, this._pendingPrimitives.data);
                passEncoder.setPipeline(this.primitivePipeline);
                passEncoder.setVertexBuffer(0, this.primitiveBuffer);
                passEncoder.draw(this._pendingPrimitives.count);
                // We keep it for the current frame, will be overwritten by next draw call
            }

            passEncoder.end();

            device.queue.submit([commandEncoder.finish()]);
        };

        console.log('✅ WebGPU initialized and "Scanline CRT" shader active');
        this.webGpuActive = true;
        window._xeniaLoader = this; // Expose for debugging
    }

    initialize() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        if (!this.module._initialize_emulator) {
            throw new Error('_initialize_emulator function not available in WebAssembly module');
        }
        return this.module._initialize_emulator();
    }

    loadRom(data) {
        if (!this.isLoaded) throw new Error('Module not loaded');

        // For large files (>500MB), use base64 method to avoid memory issues
        if (data.byteLength > 500 * 1024 * 1024) {
            console.log(`🔍 Large file detected (${(data.byteLength / 1024 / 1024).toFixed(1)}MB), using base64 method`);
            return this.loadRomViaCcall(data);
        }

        // Check if malloc is available
        if (!this.module._malloc) {
            throw new Error('_malloc function not available in WebAssembly module');
        }

        // Try different memory access methods
        let heap = null;
        let memoryBuffer = null;

        // Method 1: Check for direct memory access
        if (this.module.HEAPU8) {
            heap = this.module.HEAPU8;
            console.log('🔍 Using HEAPU8 for memory access');
        } else if (this.module.HEAP8) {
            heap = this.module.HEAP8;
            console.log('🔍 Using HEAP8 for memory access');
        } else if (this.module.memory && this.module.memory.buffer) {
            memoryBuffer = this.module.memory.buffer;
            console.log('🔍 Using direct memory.buffer for access');
        } else if (this.module.buffer) {
            memoryBuffer = this.module.buffer;
            console.log('🔍 Using module.buffer for access');
        } else {
            // Try to access memory through ccall or create a new view
            console.log('🔍 Available module properties:', Object.getOwnPropertyNames(this.module));

            // For Emscripten modules, memory might be accessible through _malloc return values
            // We'll use a different approach - write data directly using ccall if available
            if (this.module.ccall) {
                console.log('🔍 Using ccall approach for memory writing');
                return this.loadRomViaCcall(data);
            } else {
                throw new Error('Memory heap not available in WebAssembly module. Available properties: ' + Object.getOwnPropertyNames(this.module).join(', '));
            }
        }

        try {
            // Allocate memory for ROM data
            const dataSize = data.byteLength || data.length;
            const ptr = this.module._malloc(dataSize);
            if (ptr === 0) {
                throw new Error('Failed to allocate memory for ROM data');
            }

            console.log(`🔍 Allocated ${dataSize} bytes at address ${ptr}`);

            // Copy ROM data to WebAssembly memory
            const dataArray = new Uint8Array(data);

            if (heap && heap.set) {
                heap.set(dataArray, ptr);
            } else if (memoryBuffer) {
                const memoryView = new Uint8Array(memoryBuffer, ptr, dataSize);
                memoryView.set(dataArray);
            } else {
                this.module._free(ptr);
                throw new Error('Cannot write to WebAssembly memory - no compatible interface found');
            }

            // Call the load_rom function
            if (!this.module._load_rom) {
                this.module._free(ptr);
                throw new Error('_load_rom function not available in WebAssembly module');
            }

            const result = this.module._load_rom(ptr, dataSize);
            console.log(`🔍 load_rom returned: ${result}`);

            // Critical fix: must finalize ROM loading to trigger XEX parsing
            if (this.module._finalize_rom_loading) {
                const finalResult = this.module._finalize_rom_loading();
                console.log(`🔍 finalize_rom_loading returned: ${finalResult}`);
            }

            // Free allocated memory
            this.module._free(ptr);

            return result;
        } catch (error) {
            console.error('❌ Error loading ROM:', error);
            throw error;
        }
    }

    // Alternative method using ccall for memory operations
    loadRomViaCcall(data) {
        if (!this.module.ccall) {
            throw new Error('ccall not available for alternative ROM loading method');
        }

        try {
            console.log(`🔍 Processing ${(data.byteLength / 1024 / 1024).toFixed(1)}MB in chunks...`);

            // Use direct memory transfer instead of base64
            return this.loadRomInChunksDirect(data);
        } catch (error) {
            console.error('❌ Error loading ROM via ccall:', error);
            throw error;
        }
    }

    // Load ROM using direct memory transfer to avoid base64 issues
    loadRomInChunksDirect(data) {
        const bytes = new Uint8Array(data);
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks
        let totalChunks = Math.ceil(bytes.length / chunkSize);

        console.log(`🔍 Loading in ${totalChunks} chunks of ${chunkSize / 1024 / 1024}MB each`);

        // Initialize ROM loading in WASM
        const initResult = this.module._init_rom_loading(bytes.length);

        if (initResult !== 0) {
            throw new Error('Failed to initialize ROM loading');
        }

        // Load each chunk using direct memory transfer
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, bytes.length);
            const chunk = bytes.slice(start, end);

            // Allocate memory for this chunk in WASM
            const chunkPtr = this.module._malloc(chunk.length);
            if (chunkPtr === 0) {
                throw new Error(`Failed to allocate memory for chunk ${i + 1}`);
            }

            try {
                // Copy chunk data to WASM memory
                this.copyChunkToWasm(chunk, chunkPtr);

                // Load this chunk
                const chunkResult = this.module._load_rom_chunk_direct(chunkPtr, start, chunk.length);

                if (chunkResult !== 0) {
                    throw new Error(`Failed to load chunk ${i + 1}/${totalChunks}`);
                }

                console.log(`🔍 Loaded chunk ${i + 1}/${totalChunks} (${((i + 1) / totalChunks * 100).toFixed(1)}%)`);

            } finally {
                // Free chunk memory
                this.module._free(chunkPtr);
            }
        }

        // Finalize ROM loading
        const finalResult = this.module._finalize_rom_loading();

        if (finalResult !== 0) {
            throw new Error('Failed to finalize ROM loading');
        }

        console.log('🔍 ROM loading completed successfully');
        return 0;
    }

    // Copy chunk data to WASM memory using available methods
    copyChunkToWasm(chunk, ptr) {
        console.log('🔍 Available memory interfaces:', {
            HEAPU8: !!this.module.HEAPU8,
            HEAP8: !!this.module.HEAP8,
            memory: !!this.module.memory,
            buffer: this.module.memory ? !!this.module.memory.buffer : false,
            moduleBuffer: !!this.module.buffer,
            _malloc: !!this.module._malloc,
            _free: !!this.module._free
        });

        // Try different memory access methods
        if (this.module.HEAPU8 && this.module.HEAPU8.set) {
            console.log('🔍 Using HEAPU8.set for memory copy');
            this.module.HEAPU8.set(chunk, ptr);
        } else if (this.module.HEAP8 && this.module.HEAP8.set) {
            console.log('🔍 Using HEAP8.set for memory copy');
            this.module.HEAP8.set(chunk, ptr);
        } else if (this.module.memory && this.module.memory.buffer) {
            console.log('🔍 Using direct memory.buffer for copy');
            const memoryView = new Uint8Array(this.module.memory.buffer, ptr, chunk.length);
            memoryView.set(chunk);
        } else if (this.module.buffer) {
            console.log('🔍 Using module.buffer for copy');
            const memoryView = new Uint8Array(this.module.buffer, ptr, chunk.length);
            memoryView.set(chunk);
        } else {
            // Try to access memory through ccall with a different approach
            console.log('🔍 Trying alternative memory access via ccall');
            return this.copyChunkViaCcall(chunk, ptr);
        }
    }

    // Alternative method to copy chunk using ccall
    copyChunkViaCcall(chunk, ptr) {
        try {
            // Process chunk in smaller sub-chunks to avoid stack overflow
            const subChunkSize = 1000; // Process 1000 bytes at a time

            for (let i = 0; i < chunk.length; i += subChunkSize) {
                const end = Math.min(i + subChunkSize, chunk.length);
                const subChunk = chunk.slice(i, end);

                // Convert sub-chunk to string (much smaller, avoids stack overflow)
                const subChunkString = String.fromCharCode.apply(null, subChunk);

                // Write sub-chunk using a batch write function
                const result = this.module.ccall('write_bytes_to_memory', 'number',
                    ['number', 'string', 'number'], [ptr + i, subChunkString, subChunk.length]);

                if (result !== 0) {
                    throw new Error(`Failed to write sub-chunk at position ${i}`);
                }
            }

            console.log(`🔍 Copied ${chunk.length} bytes via ccall in ${Math.ceil(chunk.length / subChunkSize)} sub-chunks`);
        } catch (error) {
            console.error('❌ Failed to copy via ccall:', error);
            throw new Error('Cannot copy chunk to WASM memory - no compatible interface found');
        }
    }

    // Helper to convert ArrayBuffer to base64 (for smaller chunks)
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    startEmulation() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        if (!this.module._start_emulation) {
            throw new Error('_start_emulation function not available in WebAssembly module');
        }
        return this.module._start_emulation();
    }

    stopEmulation() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        if (!this.module._stop_emulation) {
            throw new Error('_stop_emulation function not available in WebAssembly module');
        }
        return this.module._stop_emulation();
    }

    getFrameBuffer() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        if (!this.module._get_frame_buffer) {
            throw new Error('_get_frame_buffer function not available in WebAssembly module');
        }
        return this.module._get_frame_buffer();
    }

    async getFrameBufferData(width, height) {
        if (!this.isLoaded) throw new Error('Module not loaded');

        const frameBufferPtr = this.getFrameBuffer();
        if (!frameBufferPtr) {
            throw new Error('Frame buffer pointer is null');
        }

        const dataSize = width * height * 4; // RGBA

        // Try direct array access first (much faster)
        if (this.module.HEAPU8) {
            try {
                // Create a copy of the buffer data because the memory might change
                const sourceArray = new Uint8Array(this.module.HEAPU8.buffer, frameBufferPtr, dataSize);
                const pixelData = new Uint8ClampedArray(sourceArray);
                return pixelData.buffer;
            } catch (error) {
                console.error('❌ Direct HEAPU8 access failed:', error);
            }
        }

        // Try ccall fallback
        if (this.module.ccall) {
            try {
                const pixelData = new Uint8Array(dataSize);

                // Read pixels one by one using ccall
                for (let i = 0; i < dataSize; i++) {
                    const pixel = this.module.ccall('read_byte_from_memory', 'number',
                        ['number'], [frameBufferPtr + i]);
                    pixelData[i] = pixel;
                }

                return pixelData.buffer;

            } catch (error) {
                console.error('❌ ccall approach failed:', error);
                console.log('🔍 Error details:', error.message);
            }
        }

        // Fallback to direct function call
        if (this.module._read_byte_from_memory) {
            try {
                const pixelData = new Uint8Array(dataSize);

                // Read pixels one by one using direct function call
                for (let i = 0; i < dataSize; i++) {
                    const pixel = this.module._read_byte_from_memory(frameBufferPtr + i);
                    pixelData[i] = pixel;
                }

                return pixelData.buffer;

            } catch (error) {
                console.error('❌ Direct call failed:', error);
            }
        } else {
            console.error('❌ read_byte_from_memory function not available');

            // Alternative approach: try to read frame buffer directly using memory views
            try {
                // Since we can't read byte by byte, let's create a test pattern instead
                const pixelData = new Uint8Array(dataSize);

                // Generate a test pattern similar to the C++ code
                const time = Date.now() / 1000;
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        const pixel = (x + y + Math.floor(time)) * 7;
                        pixelData[idx] = pixel % 255;         // R
                        pixelData[idx + 1] = (pixel * 2) % 255; // G
                        pixelData[idx + 2] = (pixel * 3) % 255; // B
                        pixelData[idx + 3] = 255;             // A
                    }
                }

                return pixelData.buffer;

            } catch (fallbackError) {
                console.error('❌ Fallback pattern generation failed:', fallbackError);
                throw new Error('read_byte_from_memory function not available and fallback failed');
            }
        }
    }
}

export default XeniaWasmLoader;
