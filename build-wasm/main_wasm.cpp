// Minimal WebAssembly module for Xenia browser integration
#include <emscripten.h>
#include <iostream>
#include <vector>
#include <cstdlib>
#include <string>

// Global ROM storage
static std::vector<uint8_t> rom_data;
static bool rom_loading_initialized = false;

extern "C" {
    // Initialize the emulator
    EMSCRIPTEN_KEEPALIVE
    int initialize_emulator() {
        // Simple initialization
        return 0;
    }
    
    // Initialize ROM loading for chunked transfer
    EMSCRIPTEN_KEEPALIVE
    int init_rom_loading(size_t total_size) {
        try {
            rom_data.clear();
            rom_data.reserve(total_size);
            rom_loading_initialized = true;
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Load a ROM chunk using direct memory transfer
    EMSCRIPTEN_KEEPALIVE
    int load_rom_chunk_direct(const uint8_t* chunk_data, size_t offset, size_t chunk_size) {
        if (!rom_loading_initialized) return -1;
        
        try {
            // Ensure rom_data is large enough
            if (offset + chunk_size > rom_data.size()) {
                rom_data.resize(offset + chunk_size);
            }
            
            // Copy chunk data directly (no base64 decoding needed)
            std::copy(chunk_data, chunk_data + chunk_size, rom_data.begin() + offset);
            
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Write multiple bytes to memory (for batch operations)
    EMSCRIPTEN_KEEPALIVE
    int write_bytes_to_memory(uint8_t* address, const char* data, size_t length) {
        try {
            for (size_t i = 0; i < length; i++) {
                address[i] = static_cast<uint8_t>(data[i]);
            }
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Write a single byte to memory (for fallback memory access)
    EMSCRIPTEN_KEEPALIVE
    int write_byte_to_memory(uint8_t* address, uint8_t value) {
        try {
            *address = value;
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Finalize ROM loading
    EMSCRIPTEN_KEEPALIVE
    int finalize_rom_loading() {
        rom_loading_initialized = false;
        return 0;
    }
    
    // Load a ROM file (direct method)
    EMSCRIPTEN_KEEPALIVE
    int load_rom(const uint8_t* data, size_t size) {
        try {
            rom_data.clear();
            rom_data.assign(data, data + size);
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Load ROM from base64 string (legacy method)
    EMSCRIPTEN_KEEPALIVE
    int load_rom_from_base64(const char* base64_data) {
        try {
            std::string base64_str(base64_data);
            rom_data.clear();
            rom_data.reserve(base64_str.length());
            
            // Simple base64 decode (placeholder)
            for (char c : base64_str) {
                rom_data.push_back(static_cast<uint8_t>(c));
            }
            
            return 0;
        } catch (...) {
            return -1;
        }
    }
    
    // Start the emulation
    EMSCRIPTEN_KEEPALIVE
    int start_emulation() {
        // Simulate starting emulation
        return 0;
    }
    
    // Stop the emulation
    EMSCRIPTEN_KEEPALIVE
    int stop_emulation() {
        // Simulate stopping emulation
        return 0;
    }
    
    // Get frame buffer pointer
    EMSCRIPTEN_KEEPALIVE
    uint8_t* get_frame_buffer() {
        static std::vector<uint8_t> frame_buffer(1280 * 720 * 4); // RGBA
        static uint32_t frame_counter = 0;
        
        // Generate animated test pattern
        frame_counter++;
        for (int y = 0; y < 720; y++) {
            for (int x = 0; x < 1280; x++) {
                int idx = (y * 1280 + x) * 4;
                uint32_t pixel = (x + y + frame_counter) * 7;
                frame_buffer[idx] = pixel % 255;     // R
                frame_buffer[idx + 1] = (pixel * 2) % 255; // G
                frame_buffer[idx + 2] = (pixel * 3) % 255; // B
                frame_buffer[idx + 3] = 255;           // A
            }
        }
        
        return frame_buffer.data();
    }
}

// No main function needed for modular build
