#!/usr/bin/env node

// Simple WebAssembly Test Script
// Tests WebAssembly module by examining the generated files

const fs = require('fs');
const path = require('path');

function testWasmFiles() {
    console.log('🔍 Testing WebAssembly files...');
    
    const wasmDir = path.join(__dirname, 'web/public/wasm');
    const jsFile = path.join(wasmDir, 'xenia_wasm.js');
    const wasmFile = path.join(wasmDir, 'xenia_wasm.wasm');
    
    // Check if files exist
    console.log('\n📁 File existence check:');
    console.log(`   JS file exists: ${fs.existsSync(jsFile) ? '✅' : '❌'} ${jsFile}`);
    console.log(`   WASM file exists: ${fs.existsSync(wasmFile) ? '✅' : '❌'} ${wasmFile}`);
    
    if (!fs.existsSync(jsFile)) {
        console.error('❌ JS file not found, cannot continue');
        return false;
    }
    
    // Read and analyze JS file
    console.log('\n📄 Analyzing JS file...');
    const jsContent = fs.readFileSync(jsFile, 'utf8');
    
    // Look for exported functions
    const exportedFunctions = [];
    const functionMatches = jsContent.match(/var _([a-zA-Z0-9_]+)\s*=/g);
    
    if (functionMatches) {
        functionMatches.forEach(match => {
            const funcName = match.match(/var _([a-zA-Z0-9_]+)\s*=/)[1];
            exportedFunctions.push(`_${funcName}`);
        });
    }
    
    console.log(`   Found ${exportedFunctions.length} exported functions:`);
    exportedFunctions.forEach(func => {
        const isTarget = func.includes('read_byte') || func.includes('test_read');
        console.log(`   ${isTarget ? '🎯' : '  '} ${func}`);
    });
    
    // Check for specific functions
    const targetFunctions = [
        '_read_byte_from_memory',
        '_test_read_function',
        '_get_frame_buffer',
        '_initialize_emulator',
        '_load_rom',
        '_start_emulation'
    ];
    
    console.log('\n🎯 Target function availability:');
    let allFound = true;
    
    targetFunctions.forEach(func => {
        const found = exportedFunctions.includes(func);
        console.log(`   ${found ? '✅' : '❌'} ${func}`);
        if (!found) allFound = false;
    });
    
    // Check for ccall availability
    const hasCcall = jsContent.includes('ccall') || jsContent.includes('EXPORTED_RUNTIME_METHODS');
    console.log(`   ${hasCcall ? '✅' : '❌'} ccall runtime method`);
    
    // Check build configuration
    console.log('\n🔧 Build configuration analysis:');
    
    const hasExportedFunctions = jsContent.includes('EXPORTED_FUNCTIONS');
    console.log(`   ${hasExportedFunctions ? '✅' : '❌'} EXPORTED_FUNCTIONS found`);
    
    if (hasExportedFunctions) {
        const exportMatch = jsContent.match(/EXPORTED_FUNCTIONS[^[]*\[([^\]]+)\]/);
        if (exportMatch) {
            const exports = exportMatch[1];
            console.log(`   📋 Exported functions: ${exports}`);
            
            const hasReadByte = exports.includes('read_byte_from_memory');
            console.log(`   ${hasReadByte ? '✅' : '❌'} read_byte_from_memory in EXPORTED_FUNCTIONS`);
        }
    }
    
    // Check optimization level
    const isOptimized = !jsContent.includes('// DEBUG') && jsContent.includes('function(');
    console.log(`   ${isOptimized ? '⚡' : '🐛'} Optimization level: ${isOptimized ? 'Optimized' : 'Debug'}`);
    
    // Check WASM file size
    if (fs.existsSync(wasmFile)) {
        const wasmStats = fs.statSync(wasmFile);
        console.log(`   📦 WASM file size: ${(wasmStats.size / 1024).toFixed(1)} KB`);
    }
    
    console.log('\n📊 Test Summary:');
    console.log(`   All target functions found: ${allFound ? '✅' : '❌'}`);
    console.log(`   read_byte_from_memory available: ${exportedFunctions.includes('_read_byte_from_memory') ? '✅' : '❌'}`);
    console.log(`   test_read_function available: ${exportedFunctions.includes('_test_read_function') ? '✅' : '❌'}`);
    
    return allFound && exportedFunctions.includes('_read_byte_from_memory');
}

// Run the test
const success = testWasmFiles();
console.log(`\n${success ? '🎉' : '💥'} WebAssembly file analysis ${success ? 'PASSED' : 'FAILED'}!`);
process.exit(success ? 0 : 1);
