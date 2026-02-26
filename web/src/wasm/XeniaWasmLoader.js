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
            // Import the WebAssembly module
            const XeniaWasm = await import('./xenia_wasm.js');
            console.log('🔍 Module imported, initializing...');
            this.module = await XeniaWasm.default();
            console.log('🔍 Module initialized:', this.module);
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
