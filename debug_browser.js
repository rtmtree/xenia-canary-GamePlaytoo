// Browser Debug Script
// Copy this into the browser console to debug WebAssembly function availability

async function debugWasmInBrowser() {
    console.log('🔍 Debugging WebAssembly in browser...');
    
    try {
        // Import the WebAssembly module
        const { default: XeniaWasm } = await import('./wasm/xenia_wasm.js');
        
        console.log('✅ Module imported successfully');
        
        // Initialize the module
        const module = await XeniaWasm({
            onRuntimeInitialized: () => {
                console.log('✅ Runtime initialized');
            }
        });
        
        console.log('✅ Module initialized');
        
        // Check all properties
        const allProps = Object.getOwnPropertyNames(module);
        const underscoredProps = allProps.filter(name => name.startsWith('_'));
        
        console.log('\n📋 All underscored functions in browser:');
        underscoredProps.forEach(prop => {
            const isTarget = prop.includes('read_byte') || prop.includes('test_read');
            console.log(`   ${isTarget ? '🎯' : '  '} ${prop}: ${typeof module[prop]}`);
        });
        
        // Test specific functions
        console.log('\n🎯 Testing specific functions:');
        
        console.log(`   _read_byte_from_memory: ${typeof module._read_byte_from_memory}`);
        console.log(`   _test_read_function: ${typeof module._test_read_function}`);
        console.log(`   _get_frame_buffer: ${typeof module._get_frame_buffer}`);
        console.log(`   ccall: ${typeof module.ccall}`);
        
        // Test calling the function
        if (module._read_byte_from_memory) {
            console.log('\n🔍 Testing _read_byte_from_memory...');
            try {
                // Get frame buffer first
                const frameBufferPtr = module._get_frame_buffer();
                console.log(`   Frame buffer pointer: ${frameBufferPtr}`);
                
                // Test reading
                const firstByte = module._read_byte_from_memory(frameBufferPtr);
                console.log(`   ✅ Successfully read first byte: ${firstByte}`);
                
            } catch (error) {
                console.error(`   ❌ Error calling _read_byte_from_memory:`, error);
            }
        } else {
            console.log('\n❌ _read_byte_from_memory not available');
        }
        
        // Test ccall
        if (module.ccall) {
            console.log('\n🔍 Testing ccall...');
            try {
                const result = module.ccall('read_byte_from_memory', 'number', ['number'], [0]);
                console.log(`   ✅ ccall successful: ${result}`);
            } catch (error) {
                console.error(`   ❌ ccall failed:`, error);
            }
        }
        
        return module;
        
    } catch (error) {
        console.error('❌ Browser debug failed:', error);
        return null;
    }
}

// Auto-run
debugWasmInBrowser().then(module => {
    if (module) {
        console.log('\n🎉 Browser debug completed successfully!');
    } else {
        console.log('\n💥 Browser debug failed!');
    }
});

console.log('📝 Paste this script into browser console and run debugWasmInBrowser()');
