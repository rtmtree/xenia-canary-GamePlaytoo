// Xenia WebAssembly Loader
class XeniaWasmLoader {
    constructor() {
        this.module = null;
        this.isLoaded = false;
    }
    
    async load() {
        if (this.isLoaded) return;
        
        try {
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

            this.module = await window.XeniaWasm({
                mainScriptUrlOrBlob: '/wasm/xenia_wasm.js',
                locateFile: function (path) {
                    return '/wasm/' + path;
                }
            });
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
