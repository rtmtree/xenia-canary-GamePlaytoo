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
            
            // Use chunked loading instead of base64 conversion
            return this.loadRomInChunks(data);
        } catch (error) {
            console.error('❌ Error loading ROM via ccall:', error);
            throw error;
        }
    }
    
    // Load ROM in smaller chunks to avoid string length limits
    loadRomInChunks(data) {
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
        
        // Load each chunk
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, bytes.length);
            const chunk = bytes.slice(start, end);
            
            // Convert chunk to base64 (much smaller)
            const base64Chunk = this.arrayBufferToBase64(chunk.buffer);
            
            // Load this chunk
            const chunkResult = this.module.ccall('load_rom_chunk', 'number', 
                ['string', 'number', 'number'], [base64Chunk, start, chunk.length]);
            
            if (chunkResult !== 0) {
                throw new Error(`Failed to load chunk ${i + 1}/${totalChunks}`);
            }
            
            console.log(`🔍 Loaded chunk ${i + 1}/${totalChunks} (${((i + 1) / totalChunks * 100).toFixed(1)}%)`);
        }
        
        // Finalize ROM loading
        const finalResult = this.module.ccall('finalize_rom_loading', 'number', [], []);
        
        if (finalResult !== 0) {
            throw new Error('Failed to finalize ROM loading');
        }
        
        console.log('🔍 ROM loading completed successfully');
        return 0;
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
}

export default XeniaWasmLoader;
