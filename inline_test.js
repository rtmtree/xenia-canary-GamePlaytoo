// Copy and paste this entire script into the browser console at http://localhost:8000

(async function inlineWasmTest() {
    console.log('🔍 Starting inline WebAssembly test...');
    
    try {
        // Wait a bit for everything to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if wasmLoader exists
        if (!window.wasmLoader) {
            console.log('❌ wasmLoader not found. Checking global scope...');
            console.log('Available globals:', Object.keys(window).filter(k => k.includes('wasm') || k.includes('Wasm')));
            return;
        }
        
        console.log('✅ wasmLoader found');
        console.log('wasmLoader.isLoaded:', window.wasmLoader.isLoaded);
        console.log('wasmLoader.module exists:', !!window.wasmLoader.module);
        
        if (!window.wasmLoader.isLoaded || !window.wasmLoader.module) {
            console.log('❌ WebAssembly not loaded yet. Waiting...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        const module = window.wasmLoader.module;
        console.log('✅ WebAssembly module available');
        
        // Check all properties
        const allProps = Object.getOwnPropertyNames(module);
        const underscoredProps = allProps.filter(name => name.startsWith('_'));
        
        console.log('\n📋 All underscored functions:');
        underscoredProps.forEach(prop => {
            const isTarget = prop.includes('read_byte') || prop.includes('test_read');
            console.log(`   ${isTarget ? '🎯' : '  '} ${prop}: ${typeof module[prop]}`);
        });
        
        // Test specific functions
        console.log('\n🎯 Target function availability:');
        console.log(`   _read_byte_from_memory: ${typeof module._read_byte_from_memory}`);
        console.log(`   _test_read_function: ${typeof module._test_read_function}`);
        console.log(`   _get_frame_buffer: ${typeof module._get_frame_buffer}`);
        console.log(`   ccall: ${typeof module.ccall}`);
        
        // Test frame buffer
        if (module._get_frame_buffer) {
            console.log('\n🔍 Testing frame buffer...');
            try {
                const frameBufferPtr = module._get_frame_buffer();
                console.log(`   ✅ Frame buffer pointer: ${frameBufferPtr}`);
                
                // Test read_byte_from_memory
                if (module._read_byte_from_memory) {
                    console.log('🔍 Testing _read_byte_from_memory...');
                    try {
                        const firstByte = module._read_byte_from_memory(frameBufferPtr);
                        console.log(`   ✅ Successfully read first byte: ${firstByte}`);
                        
                        // Test reading more bytes
                        const testBytes = [];
                        for (let i = 0; i < 5; i++) {
                            testBytes.push(module._read_byte_from_memory(frameBufferPtr + i));
                        }
                        console.log(`   ✅ Successfully read 5 bytes: [${testBytes.join(', ')}]`);
                        
                        console.log('\n🎉 WebAssembly frame buffer reading WORKS!');
                        
                    } catch (error) {
                        console.error(`   ❌ Error calling _read_byte_from_memory:`, error);
                    }
                } else {
                    console.log('   ❌ _read_byte_from_memory not available');
                }
                
            } catch (error) {
                console.error(`   ❌ Error getting frame buffer:`, error);
            }
        } else {
            console.log('   ❌ _get_frame_buffer not available');
        }
        
        // Test ccall
        if (module.ccall) {
            console.log('\n🔍 Testing ccall...');
            try {
                const frameBufferPtr = module._get_frame_buffer();
                const result = module.ccall('read_byte_from_memory', 'number', ['number'], [frameBufferPtr]);
                console.log(`   ✅ ccall successful: ${result}`);
                console.log('🎉 WebAssembly ccall reading WORKS!');
            } catch (error) {
                console.error(`   ❌ ccall failed:`, error);
            }
        } else {
            console.log('   ❌ ccall not available');
        }
        
        // Test the actual getFrameBufferData method
        if (window.wasmLoader.getFrameBufferData) {
            console.log('\n🔍 Testing getFrameBufferData method...');
            try {
                const result = window.wasmLoader.getFrameBufferData(1280, 720);
                console.log(`   ✅ getFrameBufferData successful, buffer size: ${result.byteLength}`);
                console.log('🎉 Full frame buffer pipeline WORKS!');
            } catch (error) {
                console.error(`   ❌ getFrameBufferData failed:`, error);
            }
        }
        
    } catch (error) {
        console.error('❌ Inline test failed:', error);
    }
    
    console.log('\n📊 Test completed!');
})();
