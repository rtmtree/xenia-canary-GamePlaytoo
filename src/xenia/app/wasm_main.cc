// WebAssembly module entry point for Xenia browser integration
#include <emscripten.h>
#include <iostream>
#include <vector>
#include <cstdlib>
#include <string>
#include <fstream>
#include <filesystem>

#include "xenia/emulator.h"
#include "xenia/apu/nop/nop_audio_system.h"
#include "xenia/gpu/webgpu/webgpu_graphics_system.h"
#include "xenia/hid/nop/nop_hid.h"
#include "xenia/base/threading.h"
#include "xenia/base/profiling.h"
#include "xenia/base/logging.h"
#include "xenia/config.h"

// Global ROM storage
static std::vector<uint8_t> rom_data;
static bool rom_loading_initialized = false;
static std::unique_ptr<xe::Emulator> global_emulator;

extern "C" {
    // Initialize the emulator
    EMSCRIPTEN_KEEPALIVE
    int initialize_emulator() {
        if (global_emulator) return 0;
        xe::Profiler::Initialize();

        std::filesystem::path storage_root = "/xenia";
        std::error_code ec;
        std::filesystem::create_directories(storage_root, ec);
        config::SetupConfig(storage_root);

        std::filesystem::path content_root = storage_root / "content";
        std::filesystem::path cache_root = storage_root / "cache";

        global_emulator = std::make_unique<xe::Emulator>("", storage_root, content_root, cache_root);

        // Setup the emulator using our headless/NOP factories
        auto audio_system_factory = [](xe::cpu::Processor* processor) {
            return std::make_unique<xe::apu::nop::NopAudioSystem>(processor);
        };
        auto graphics_system_factory = []() {
            return std::make_unique<xe::gpu::webgpu::WebGPUGraphicsSystem>();
        };
        auto input_driver_factory = [](xe::ui::Window* window) -> std::vector<std::unique_ptr<xe::hid::InputDriver>> {
            std::vector<std::unique_ptr<xe::hid::InputDriver>> drivers;
            drivers.push_back(xe::hid::nop::Create(window, 0));
            return drivers;
        };

        xe::X_STATUS result = global_emulator->Setup(
            nullptr,  // no window
            nullptr,  // no imgui wrapper
            true,     // require CPU backend
            audio_system_factory,
            graphics_system_factory,
            input_driver_factory
        );

        if (XFAILED(result)) {
            global_emulator.reset();
            return -1;
        }

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
            
            // Copy chunk data directly
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
    
    EMSCRIPTEN_KEEPALIVE
    uint8_t read_byte_from_memory(uint8_t* address) {
        try {
            return *address;
        } catch (...) {
            return 0;
        }
    }

    EMSCRIPTEN_KEEPALIVE
    int test_read_function() {
        return 0;
    }

    // Finalize ROM loading
    EMSCRIPTEN_KEEPALIVE
    int finalize_rom_loading() {
        if (!global_emulator || rom_data.empty()) {
            return -1;
        }

        try {
            // Create the game file in MEMFS
            std::string game_path = "/game.bin";
            std::ofstream out(game_path, std::ios::binary);
            if (!out) {
                return -1;
            }
            
            out.write(reinterpret_cast<const char*>(rom_data.data()), rom_data.size());
            out.close();
            
            // Launch the game
            xe::X_STATUS result = global_emulator->LaunchPath(game_path);
            if (XFAILED(result)) {
                return static_cast<int>(result);
            }
            
            rom_loading_initialized = false;
            return 0;
        } catch (...) {
            rom_loading_initialized = false;
            return -1;
        }
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
        if (!global_emulator) return -1;
        if (rom_data.empty()) return -1;

        std::string rom_path = "/xenia/rom.bin";
        std::ofstream out(rom_path, std::ios::binary);
        out.write(reinterpret_cast<const char*>(rom_data.data()), rom_data.size());
        out.close();

        xe::X_STATUS result = global_emulator->LaunchPath(rom_path);
        if (XFAILED(result)) {
            return -1;
        }
        return 0;
    }
    
    // Stop the emulation
    EMSCRIPTEN_KEEPALIVE
    int stop_emulation() {
        if (global_emulator) {
            global_emulator->TerminateTitle();
        }
        return 0;
    }
    
    // Get frame buffer pointer (real implementation)
    EMSCRIPTEN_KEEPALIVE
    uint8_t* get_frame_buffer() {
        if (!global_emulator) {
            return nullptr;
        }
        
        // For now, return a test pattern until we integrate real graphics
        static std::vector<uint8_t> frame_buffer(1280 * 720 * 4); // RGBA
        static uint32_t frame_counter = 0;
        
        // Generate animated test pattern
        frame_counter++;
        for (int y = 0; y < 720; y++) {
            for (int x = 0; x < 1280; x++) {
                int idx = (y * 1280 + x) * 4;
                
                float fx = x / 1280.0f;
                float fy = y / 720.0f;
                float time = frame_counter * 0.01f;
                
                float wave = sin(fx * 10.0f + time) * cos(fy * 10.0f + time);
                uint8_t r = (uint8_t)((sin(wave + time) * 0.5f + 0.5f) * 255);
                uint8_t g = (uint8_t)((cos(wave + time * 1.3f) * 0.5f + 0.5f) * 255);
                uint8_t b = (uint8_t)((sin(wave * 2.0f + time * 0.7f) * 0.5f + 0.5f) * 255);
                
                frame_buffer[idx] = r;
                frame_buffer[idx + 1] = g;
                frame_buffer[idx + 2] = b;
                frame_buffer[idx + 3] = 255;
            }
        }
        
        return frame_buffer.data();
    }
}
