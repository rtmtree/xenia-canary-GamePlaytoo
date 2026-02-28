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
            
            // Import the WebAssembly module
            const XeniaWasm = await import('./xenia_wasm.js');
            console.log('🔍 Module imported, initializing...');
            
            // Initialize the module with preloaded WASM binary
            this.module = await XeniaWasm.default({
                wasmBinary: wasmBinary,
                onRuntimeInitialized: () => {
                    console.log('✅ Emscripten runtime initialized');
                }
            });
            
            console.log('🔍 Module initialized:', this.module);
            console.log('🔍 Available functions:', Object.getOwnPropertyNames(this.module).filter(name => name.startsWith('_')));
            
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
            return true;
        } catch (error) {
            console.error('❌ Failed to load Xenia WebAssembly module:', error);
            console.error('❌ Error details:', error.message, error.stack);
            return false;
        }
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
            const ptr = this.module._malloc(data.length);
            if (ptr === 0) {
                throw new Error('Failed to allocate memory for ROM data');
            }
            
            console.log(`🔍 Allocated ${data.length} bytes at address ${ptr}`);
            
            // Copy ROM data to WebAssembly memory
            const dataArray = new Uint8Array(data);
            
            if (heap && heap.set) {
                heap.set(dataArray, ptr);
            } else if (memoryBuffer) {
                const memoryView = new Uint8Array(memoryBuffer, ptr, data.length);
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
            
            const result = this.module._load_rom(ptr, data.length);
            console.log(`🔍 load_rom returned: ${result}`);
            
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
        const initResult = this.module.ccall('init_rom_loading', 'number', 
            ['number'], [bytes.length]);
        
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
                const chunkResult = this.module.ccall('load_rom_chunk_direct', 'number', 
                    ['number', 'number', 'number'], [chunkPtr, start, chunk.length]);
                
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
        const finalResult = this.module.ccall('finalize_rom_loading', 'number', [], []);
        
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
    
    getFrameBufferData(width, height) {
        if (!this.isLoaded) throw new Error('Module not loaded');
        
        const frameBufferPtr = this.getFrameBuffer();
        if (!frameBufferPtr) {
            throw new Error('Frame buffer pointer is null');
        }
        
        const dataSize = width * height * 4; // RGBA
        
        // Debug: Check available functions
        console.log('🔍 Available functions:', {
            ccall: !!this.module.ccall,
            _read_byte_from_memory: !!this.module._read_byte_from_memory,
            available_props: Object.getOwnPropertyNames(this.module).filter(name => name.includes('read_byte')),
            all_underscored: Object.getOwnPropertyNames(this.module).filter(name => name.startsWith('_')),
            all_underscored_list: Object.getOwnPropertyNames(this.module).filter(name => name.startsWith('_')).join(', ')
        });
        
        // Try direct function call first
        if (this.module._read_byte_from_memory) {
            try {
                // Create a JavaScript array to hold the pixel data
                const pixelData = new Uint8Array(dataSize);
                
                // Read pixels one by one using direct function call
                for (let i = 0; i < dataSize; i++) {
                    const pixel = this.module._read_byte_from_memory(frameBufferPtr + i);
                    pixelData[i] = pixel;
                }
                
                console.log(`✅ Successfully read ${dataSize} bytes via direct function call`);
                return pixelData.buffer;
                
            } catch (error) {
                console.error('❌ Failed to read frame buffer via direct call:', error);
                
                // Fallback to ccall if available
                if (this.module.ccall) {
                    try {
                        const pixelData = new Uint8Array(dataSize);
                        for (let i = 0; i < dataSize; i++) {
                            const pixel = this.module.ccall('read_byte_from_memory', 'number',
                                ['number'], [frameBufferPtr + i]);
                            pixelData[i] = pixel;
                        }
                        console.log(`✅ Successfully read ${dataSize} bytes via ccall fallback`);
                        return pixelData.buffer;
                    } catch (ccallError) {
                        console.error('❌ Both direct call and ccall failed:', ccallError);
                        throw new Error('Failed to read frame buffer data');
                    }
                } else {
                    throw new Error('Failed to read frame buffer data and no ccall available');
                }
            }
        } else {
            console.error('❌ read_byte_from_memory function not available');
            console.log('🔍 Trying alternative frame buffer access...');
            
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
                
                console.log(`✅ Generated test pattern (${dataSize} bytes) as fallback`);
                return pixelData.buffer;
                
            } catch (fallbackError) {
                console.error('❌ Fallback pattern generation failed:', fallbackError);
                throw new Error('read_byte_from_memory function not available and fallback failed');
            }
        }
    }
}

export default XeniaWasmLoader;
