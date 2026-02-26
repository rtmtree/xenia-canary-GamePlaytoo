// Minimal WebAssembly module for Xenia browser integration
#include <emscripten.h>
#include <iostream>
#include <vector>
#include <cstdlib>

extern "C" {
    // Initialize the emulator
    EMSCRIPTEN_KEEPALIVE
    int initialize_emulator() {
        // Simple initialization
        return 0;
    }
    
    // Load a ROM file
    EMSCRIPTEN_KEEPALIVE
    int load_rom(const uint8_t* data, size_t size) {
        // Simulate ROM loading
        return 0;
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
