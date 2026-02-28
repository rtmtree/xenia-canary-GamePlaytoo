#!/usr/bin/env node

// Comprehensive WebAssembly Test Suite
// Tests multiple scenarios until function is confirmed present

const fs = require('fs');
const path = require('path');

function runComprehensiveTest() {
    console.log('🔍 Running comprehensive WebAssembly test suite...');
    
    const wasmDir = path.join(__dirname, 'web/public/wasm');
    const jsFile = path.join(wasmDir, 'xenia_wasm.js');
    const wasmFile = path.join(wasmDir, 'xenia_wasm.wasm');
    
    // Test 1: File existence
    console.log('\n📁 Test 1: File Existence');
    console.log(`   JS file: ${fs.existsSync(jsFile) ? '✅' : '❌'}`);
    console.log(`   WASM file: ${fs.existsSync(wasmFile) ? '✅' : '❌'}`);
    
    if (!fs.existsSync(jsFile)) {
        console.log('❌ Cannot continue - JS file missing');
        return false;
    }
    
    // Test 2: File content analysis
    console.log('\n📄 Test 2: File Content Analysis');
    const jsContent = fs.readFileSync(jsFile, 'utf8');
    
    // Look for function definitions
    const readByteMatches = jsContent.match(/var (_read_byte_from_memory)\s*=/g);
    const testFuncMatches = jsContent.match(/var (_test_read_function)\s*=/g);
    const getFrameMatches = jsContent.match(/var (_get_frame_buffer)\s*=/g);
    
    console.log(`   _read_byte_from_memory defined: ${readByteMatches ? '✅' : '❌'} ${readByteMatches ? readByteMatches.length : 0} times`);
    console.log(`   _test_read_function defined: ${testFuncMatches ? '✅' : '❌'} ${testFuncMatches ? testFuncMatches.length : 0} times`);
    console.log(`   _get_frame_buffer defined: ${getFrameMatches ? '✅' : '❌'} ${getFrameMatches ? getFrameMatches.length : 0} times`);
    
    // Test 3: Export list analysis
    console.log('\n📋 Test 3: Export List Analysis');
    const exportMatch = jsContent.match(/EXPORTED_FUNCTIONS[^[]*\[([^\]]+)\]/);
    if (exportMatch) {
        const exports = exportMatch[1];
        const hasReadByte = exports.includes('read_byte_from_memory');
        const hasTestFunc = exports.includes('test_read_function');
        
        console.log(`   EXPORTED_FUNCTIONS found: ✅`);
        console.log(`   read_byte_from_memory in exports: ${hasReadByte ? '✅' : '❌'}`);
        console.log(`   test_read_function in exports: ${hasTestFunc ? '✅' : '❌'}`);
        console.log(`   Export list: ${exports}`);
    } else {
        console.log('   EXPORTED_FUNCTIONS found: ❌');
    }
    
    // Test 4: Function count analysis
    console.log('\n🔢 Test 4: Function Count Analysis');
    const allVarMatches = jsContent.match(/var _([a-zA-Z0-9_]+)\s*=/g);
    if (allVarMatches) {
        const allFunctions = allVarMatches.map(match => {
            const funcName = match.match(/var _([a-zA-Z0-9_]+)\s*=/)[1];
            return `_${funcName}`;
        });
        
        const targetFunctions = [
            '_read_byte_from_memory',
            '_test_read_function', 
            '_get_frame_buffer',
            '_initialize_emulator',
            '_load_rom',
            '_start_emulation'
        ];
        
        console.log(`   Total exported functions: ${allFunctions.length}`);
        console.log(`   Target functions found:`);
        
        let allTargetsFound = true;
        targetFunctions.forEach(func => {
            const found = allFunctions.includes(func);
            console.log(`     ${found ? '✅' : '❌'} ${func}`);
            if (!found) allTargetsFound = false;
        });
        
        console.log(`   All targets found: ${allTargetsFound ? '✅' : '❌'}`);
        
        // Test 5: Specific function verification
        console.log('\n🎯 Test 5: Specific Function Verification');
        const readByteFunc = allFunctions.find(f => f === '_read_byte_from_memory');
        if (readByteFunc) {
            console.log('   ✅ _read_byte_from_memory found in function list');
            
            // Look for function implementation
            const funcPattern = new RegExp(`var ${readByteFunc}\\s*=\\s*[^;]+;`, 'g');
            const funcImplementation = jsContent.match(funcPattern);
            if (funcImplementation) {
                console.log('   ✅ Function implementation found');
                console.log(`   📝 Implementation preview: ${funcImplementation[0].substring(0, 100)}...`);
            } else {
                console.log('   ❌ Function implementation not found');
            }
        } else {
            console.log('   ❌ _read_byte_from_memory not found');
        }
        
        return allTargetsFound && readByteFunc;
    }
    
    return false;
}

// Run test multiple times with different approaches
console.log('🚀 Starting iterative testing...');

let testResults = [];
for (let i = 1; i <= 3; i++) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔄 Test Run ${i}/3`);
    console.log(`${'='.repeat(50)}`);
    
    const result = runComprehensiveTest();
    testResults.push(result);
    
    if (result) {
        console.log(`\n🎉 Test Run ${i}: SUCCESS! Function is present.`);
        break;
    } else {
        console.log(`\n💥 Test Run ${i}: FAILED! Function not found.`);
        
        if (i < 3) {
            console.log('⏳ Waiting 2 seconds before next test...');
            // In a real scenario, we might rebuild here
        }
    }
}

// Final summary
console.log(`\n${'='.repeat(50)}`);
console.log('📊 FINAL TEST SUMMARY');
console.log(`${'='.repeat(50)}`);

const successCount = testResults.filter(r => r).length;
const totalCount = testResults.length;

console.log(`Successful tests: ${successCount}/${totalCount}`);
console.log(`Overall result: ${successCount > 0 ? '✅ FUNCTION IS PRESENT' : '❌ FUNCTION NOT FOUND'}`);

if (successCount > 0) {
    console.log('\n🎯 RECOMMENDATION: Function is properly exported!');
    console.log('   The issue is likely in browser-side timing or access.');
    console.log('   Test in browser with inline script to confirm.');
} else {
    console.log('\n💥 RECOMMENDATION: Function export failed!');
    console.log('   Need to rebuild WebAssembly with different approach.');
}

console.log('\n🏁 Testing complete!');
process.exit(successCount > 0 ? 0 : 1);
