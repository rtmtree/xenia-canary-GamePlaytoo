#!/usr/bin/env node

// Automated Test Runner
// Simulates the browser environment test

const fs = require('fs');
const path = require('path');

console.log('🔍 Running automated WebAssembly test...');

// Check if the production build is ready
const buildDir = path.join(__dirname, 'web/build');
const wasmDir = path.join(__dirname, 'web/public/wasm');

console.log('\n📁 Build status:');
console.log(`   Production build exists: ${fs.existsSync(buildDir) ? '✅' : '❌'}`);
console.log(`   WASM files exist: ${fs.existsSync(wasmDir) ? '✅' : '❌'}`);

if (fs.existsSync(wasmDir)) {
    const files = fs.readdirSync(wasmDir);
    console.log(`   WASM files: ${files.join(', ')}`);
}

// Check the current XeniaWasmLoader implementation
const loaderPath = path.join(__dirname, 'web/src/wasm/XeniaWasmLoader.js');
if (fs.existsSync(loaderPath)) {
    console.log('\n📄 Checking XeniaWasmLoader implementation...');
    const loaderContent = fs.readFileSync(loaderPath, 'utf8');
    
    // Check for the debug logging we added
    const hasDebugLogging = loaderContent.includes('all_underscored_list');
    console.log(`   Debug logging present: ${hasDebugLogging ? '✅' : '❌'}`);
    
    // Check for fallback mechanism
    const hasFallback = loaderContent.includes('Generated test pattern');
    console.log(`   Fallback mechanism: ${hasFallback ? '✅' : '❌'}`);
    
    // Check for direct function call
    const hasDirectCall = loaderContent.includes('module._read_byte_from_memory');
    console.log(`   Direct function call: ${hasDirectCall ? '✅' : '❌'}`);
}

// Create a simple HTML test page
const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>WebAssembly Test</title>
</head>
<body>
    <h1>WebAssembly Test</h1>
    <div id="results"></div>
    
    <script>
        // Test script - copy this to console
        async function testWasm() {
            console.log('🔍 Testing WebAssembly...');
            
            // Wait for wasmLoader
            let attempts = 0;
            while (!window.wasmLoader && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.wasmLoader) {
                console.log('❌ wasmLoader not found');
                return;
            }
            
            console.log('✅ wasmLoader found');
            
            if (!window.wasmLoader.isLoaded) {
                console.log('❌ WebAssembly not loaded');
                return;
            }
            
            const module = window.wasmLoader.module;
            const hasReadByte = !!module._read_byte_from_memory;
            const hasTestFunc = !!module._test_read_function;
            const hasGetFrame = !!module._get_frame_buffer;
            
            console.log('🎯 Function availability:');
            console.log('   _read_byte_from_memory:', hasReadByte);
            console.log('   _test_read_function:', hasTestFunc);
            console.log('   _get_frame_buffer:', hasGetFrame);
            
            if (hasReadByte && hasGetFrame) {
                try {
                    const framePtr = module._get_frame_buffer();
                    const firstByte = module._read_byte_from_memory(framePtr);
                    console.log('🎉 SUCCESS: Read first byte:', firstByte);
                    
                    // Test full pipeline
                    const buffer = window.wasmLoader.getFrameBufferData(1280, 720);
                    console.log('🎉 SUCCESS: Full pipeline works, size:', buffer.byteLength);
                    
                } catch (error) {
                    console.error('❌ Error in pipeline:', error);
                }
            }
        }
        
        // Auto-run test
        setTimeout(testWasm, 2000);
        
        // Also make it available globally
        window.testWasm = testWasm;
    </script>
    
    <p>Open console to see test results, or wait for auto-test to complete.</p>
</body>
</html>
`;

// Write test HTML file
const testHtmlPath = path.join(__dirname, 'web/test_wasm.html');
fs.writeFileSync(testHtmlPath, testHtml);
console.log(`\n📝 Test HTML created: ${testHtmlPath}`);
console.log('   Visit: http://localhost:8000/test_wasm.html');

console.log('\n📊 Test Summary:');
console.log('✅ Files analyzed');
console.log('✅ Test page created');
console.log('🌐 Ready for browser testing');

console.log('\n🎯 Next Steps:');
console.log('1. Visit http://localhost:8000/test_wasm.html');
console.log('2. Open browser console (F12)');
console.log('3. Check test results automatically or run testWasm()');

// Also provide the inline test content for easy copying
console.log('\n📋 Inline Test (copy to console at http://localhost:8000):');
console.log('---');
console.log(`
(async function() {
    console.log('🔍 Testing WebAssembly...');
    await new Promise(r => setTimeout(r, 2000));
    
    if (!window.wasmLoader) {
        console.log('❌ wasmLoader not found');
        return;
    }
    
    const module = window.wasmLoader.module;
    console.log('🎯 Functions:', {
        _read_byte_from_memory: !!module._read_byte_from_memory,
        _test_read_function: !!module._test_read_function,
        _get_frame_buffer: !!module._get_frame_buffer
    });
    
    if (module._read_byte_from_memory && module._get_frame_buffer) {
        try {
            const ptr = module._get_frame_buffer();
            const byte = module._read_byte_from_memory(ptr);
            console.log('🎉 SUCCESS: Read byte:', byte);
        } catch (e) {
            console.error('❌ Error:', e);
        }
    }
})();
`);
console.log('---');
