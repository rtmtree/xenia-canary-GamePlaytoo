#!/usr/bin/env node

// WebAssembly Test Script
// Tests WebAssembly module loading and function availability

const fs = require('fs');
const path = require('path');

async function testWasm() {
    console.log('🔍 Testing WebAssembly module...');
    
    try {
        // Load the WebAssembly module
        const wasmPath = path.join(__dirname, 'web/public/wasm/xenia_wasm.js');
        
        if (!fs.existsSync(wasmPath)) {
            console.error('❌ WebAssembly JS file not found:', wasmPath);
            return false;
        }
        
        console.log('✅ Found WebAssembly JS file');
        
        // Load the module
        const XeniaWasm = require(wasmPath);
        
        // Initialize the module
        console.log('🔍 Initializing WebAssembly module...');
        
        const module = await XeniaWasm({
            onRuntimeInitialized: () => {
                console.log('✅ Emscripten runtime initialized');
            }
        });
        
        console.log('✅ WebAssembly module loaded successfully');
        
        // Check available functions
        const allProps = Object.getOwnPropertyNames(module);
        const underscoredProps = allProps.filter(name => name.startsWith('_'));
        const readByteProps = allProps.filter(name => name.includes('read_byte'));
        
        console.log('\n🔍 Available functions:');
        console.log('   Total properties:', allProps.length);
        console.log('   Underscored functions:', underscoredProps.length);
        console.log('   Functions with "read_byte":', readByteProps.length);
        
        console.log('\n📋 All underscored functions:');
        underscoredProps.forEach(prop => console.log(`   - ${prop}`));
        
        console.log('\n📋 Functions with "read_byte":');
        readByteProps.forEach(prop => console.log(`   - ${prop}`));
        
        // Check specific functions
        const requiredFunctions = [
            '_malloc',
            '_free', 
            '_initialize_emulator',
            '_load_rom',
            '_start_emulation',
            '_stop_emulation',
            '_get_frame_buffer',
            '_read_byte_from_memory',
            '_test_read_function'
        ];
        
        console.log('\n🎯 Required function availability:');
        let allAvailable = true;
        
        requiredFunctions.forEach(func => {
            const available = !!module[func];
            console.log(`   ${available ? '✅' : '❌'} ${func}: ${available}`);
            if (!available) allAvailable = false;
        });
        
        // Test frame buffer functionality
        if (module._get_frame_buffer) {
            console.log('\n🔍 Testing frame buffer...');
            try {
                const frameBufferPtr = module._get_frame_buffer();
                console.log(`✅ Frame buffer pointer: ${frameBufferPtr}`);
                
                if (module._read_byte_from_memory) {
                    console.log('🔍 Testing read_byte_from_memory...');
                    try {
                        const firstByte = module._read_byte_from_memory(frameBufferPtr);
                        console.log(`✅ Successfully read first byte: ${firstByte}`);
                        
                        // Test reading more bytes
                        const testBytes = [];
                        for (let i = 0; i < 10; i++) {
                            testBytes.push(module._read_byte_from_memory(frameBufferPtr + i));
                        }
                        console.log(`✅ Successfully read 10 bytes: [${testBytes.join(', ')}]`);
                        
                    } catch (error) {
                        console.error('❌ Error reading frame buffer:', error.message);
                    }
                } else {
                    console.log('❌ read_byte_from_memory not available for testing');
                }
                
            } catch (error) {
                console.error('❌ Error getting frame buffer:', error.message);
            }
        } else {
            console.log('❌ get_frame_buffer not available');
        }
        
        // Test ccall functionality
        if (module.ccall) {
            console.log('\n🔍 Testing ccall...');
            try {
                if (module._read_byte_from_memory) {
                    const result = module.ccall('read_byte_from_memory', 'number', ['number'], [0]);
                    console.log(`✅ ccall test successful: ${result}`);
                } else {
                    console.log('❌ Cannot test ccall - read_byte_from_memory not available');
                }
            } catch (error) {
                console.error('❌ ccall test failed:', error.message);
            }
        } else {
            console.log('❌ ccall not available');
        }
        
        console.log('\n📊 Test Summary:');
        console.log(`   All required functions available: ${allAvailable ? '✅' : '❌'}`);
        console.log(`   Frame buffer reading: ${module._read_byte_from_memory ? '✅' : '❌'}`);
        console.log(`   ccall functionality: ${module.ccall ? '✅' : '❌'}`);
        
        return allAvailable && module._read_byte_from_memory;
        
    } catch (error) {
        console.error('❌ WebAssembly test failed:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Run the test
testWasm().then(success => {
    if (success) {
        console.log('\n🎉 WebAssembly test PASSED! All functions available.');
        process.exit(0);
    } else {
        console.log('\n💥 WebAssembly test FAILED! Some functions missing.');
        process.exit(1);
    }
}).catch(error => {
    console.error('\n💥 Test script error:', error);
    process.exit(1);
});
