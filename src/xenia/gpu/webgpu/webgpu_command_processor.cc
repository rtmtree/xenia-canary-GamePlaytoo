/**
 ******************************************************************************
 * Xenia : Xbox 360 Emulator Research Project                                 *
 ******************************************************************************
 * Copyright 2022 Ben Vanik. All rights reserved.                             *
 * Released under the BSD license - see LICENSE in the root for more details. *
 ******************************************************************************
 */

#include "xenia/gpu/webgpu/webgpu_command_processor.h"

#include <cstring>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <webgpu/webgpu.h>
#endif

#include "xenia/base/logging.h"
#include "xenia/gpu/webgpu/webgpu_graphics_system.h"
#include "xenia/ui/windowed_app_context.h"

#include <algorithm>

namespace xe {
namespace gpu {
namespace webgpu {

static uint8_t g_webgpu_frame_buffer[1280 * 720 * 4];

WebGPUCommandProcessor::WebGPUCommandProcessor(
    GraphicsSystem* graphics_system, kernel::KernelState* kernel_state)
    : CommandProcessor(graphics_system, kernel_state) {}

WebGPUCommandProcessor::~WebGPUCommandProcessor() {
  if (device_) {
    Shutdown();
  }
}

bool WebGPUCommandProcessor::Initialize() {
  if (!CommandProcessor::Initialize()) {
    return false;
  }

  InitializeWebGPU();
  CreateSwapChain();
  
  return true;
}

void WebGPUCommandProcessor::Shutdown() {
  if (frame_buffer_) {
    // Free frame buffer
    frame_buffer_ = nullptr;
  }
  
  // Removed swap chain
  
  
  if (device_) {
    // Release device
    device_ = nullptr;
  }
  
  CommandProcessor::Shutdown();
}

void WebGPUCommandProcessor::ClearCaches() {
  // Clear WebGPU-specific caches
  CommandProcessor::ClearCaches();
}

void WebGPUCommandProcessor::IssueSwap(uint32_t frontbuffer_ptr,
                                       uint32_t frontbuffer_width,
                                       uint32_t frontbuffer_height) {
  uint32_t* src_ptr = reinterpret_cast<uint32_t*>(memory_->TranslatePhysical(frontbuffer_ptr));
  if (!src_ptr) return;

  uint32_t w = std::min(frontbuffer_width, 1280u);
  uint32_t h = std::min(frontbuffer_height, 720u);

  for (uint32_t y = 0; y < h; y++) {
    for (uint32_t x = 0; x < w; x++) {
      // Decode big-endian ARGB
      uint32_t pixel = xe::byte_swap(src_ptr[y * frontbuffer_width + x]);
      uint32_t a = (pixel >> 24) & 0xFF;
      uint32_t r = (pixel >> 16) & 0xFF;
      uint32_t g = (pixel >> 8) & 0xFF;
      uint32_t b = (pixel >> 0) & 0xFF;

      uint32_t dest_idx = (y * 1280 + x) * 4;
      g_webgpu_frame_buffer[dest_idx + 0] = r;
      g_webgpu_frame_buffer[dest_idx + 1] = g;
      g_webgpu_frame_buffer[dest_idx + 2] = b;
      g_webgpu_frame_buffer[dest_idx + 3] = a;
    }
  }
}

void WebGPUCommandProcessor::InitializeWebGPU() {
#ifdef __EMSCRIPTEN
  // Request WebGPU adapter
  WGPURequestAdapterOptions adapter_options = {};
  adapter_options.powerPreference = WGPUPowerPreference_HighPerformance;
  
  // This will be called from JavaScript when running in browser
  EM_ASM({
    if (!navigator.gpu) {
      console.error('WebGPU not supported');
      return;
    }
    
    navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    }).then(function(adapter) {
      if (!adapter) {
        console.error('No appropriate GPU adapter found');
        return;
      }
      
      adapter.requestDevice().then(function(device) {
        // Store device globally for C++ to access
        window.webgpuDevice = device;
        window.webgpuQueue = device.queue;
        
        // Notify C++ that device is ready
        if (window._webgpuReady) {
          window._webgpuReady();
        }
      }).catch(function(error) {
        console.error('Failed to request WebGPU device:', error);
      });
    }).catch(function(error) {
      console.error('Failed to request WebGPU adapter:', error);
    });
  });
  
  // Wait for device to be available
  // In a real implementation, we'd use proper async handling
  device_ = reinterpret_cast<WGPUDevice>(EM_ASM_INT(
    return window.webgpuDevice ? 1 : 0;
  ));
  
  if (device_) {
    queue_ = reinterpret_cast<WGPUQueue>(EM_ASM_INT(
      return window.webgpuQueue ? 1 : 0;
    ));
  }
#else
  // Mock implementation for non-Emscripten builds
  device_ = reinterpret_cast<WGPUDevice>(0x12345678);  // Mock pointer
  queue_ = reinterpret_cast<WGPUQueue>(0x87654321);   // Mock pointer
#endif
}

void WebGPUCommandProcessor::CreateSwapChain() {
#ifdef __EMSCRIPTEN
  if (!device_) return;
  
  // Create canvas and swap chain
  EM_ASM({
    if (!window.webgpuDevice) return;
    
    // Get or create canvas
    let canvas = document.getElementById('game-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'game-canvas';
      canvas.width = 1280;
      canvas.height = 720;
      document.body.appendChild(canvas);
    }
    
    // Create swap chain
    const context = canvas.getContext('webgpu');
    const swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
    
    const swapChainDescriptor = {
      device: window.webgpuDevice,
      format: swapChainFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    };
    
    const swapChain = context.configure(swapChainDescriptor);
    window.webgpuSwapChain = swapChain;
  });
#endif
}

void WebGPUCommandProcessor::RenderFrame() {
  if (!device_) return;
  
  frame_counter_++;
  
#ifdef __EMSCRIPTEN
  EM_ASM({
    if (!window.webgpuDevice || !window.webgpuQueue) return;
    
    const device = window.webgpuDevice;
    const queue = window.webgpuQueue;
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    
    const context = canvas.getContext('webgpu');
    const currentTexture = context.getCurrentTexture();
    
    // Create or update guest texture
    if (!window.guestTexture) {
      window.guestTexture = device.createTexture({
        size: [1280, 720, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      
      window.guestSampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });
    }
    
    // Upload frame buffer data
    const framebufferPtr = $0;
    const framebufferData = HEAPU8.subarray(framebufferPtr, framebufferPtr + 1280 * 720 * 4);
    queue.writeTexture(
      { texture: window.guestTexture },
      framebufferData,
      { bytesPerRow: 1280 * 4 },
      { width: 1280, height: 720 }
    );
    
    // Create command encoder
    const commandEncoder = device.createCommandEncoder();
    
    // Create render pass
    const renderPassDescriptor = {
      colorAttachments: [{
        view: currentTexture.createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    };
    
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    
    // Vertex shader for a full-screen quad
    const vertexShaderCode = `
      @vertex
      fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 4>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>( 1.0, -1.0),
          vec2<f32>(-1.0,  1.0),
          vec2<f32>( 1.0,  1.0)
        );
        return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
      }
    `;
    
    // Fragment shader that samples the guest texture
    const fragmentShaderCode = `
      @group(0) @binding(0) var mySampler: sampler;
      @group(0) @binding(1) var myTexture: texture_2d<f32>;

      @fragment
      fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
        let uv = fragCoord.xy / vec2<f32>(1280.0, 720.0);
        return textureSample(myTexture, mySampler, uv);
      }
    `;
    
    // Create shaders if not already created
    if (!window.webgpuPipelines) window.webgpuPipelines = {};
    if (!window.webgpuPipelines.main) {
      const vertexModule = device.createShaderModule({ code: vertexShaderCode });
      const fragmentModule = device.createShaderModule({ code: fragmentShaderCode });
      
      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        ],
      });
      
      window.webgpuPipelines.main = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        vertex: { module: vertexModule, entryPoint: 'vs_main' },
        fragment: {
          module: fragmentModule,
          entryPoint: 'fs_main',
          targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
        },
        primitive: { topology: 'triangle-strip' },
      });
      
      window.webgpuBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: window.guestSampler },
          { binding: 1, resource: window.guestTexture.createView() },
        ],
      });
    }
    
    // Draw
    passEncoder.setPipeline(window.webgpuPipelines.main);
    passEncoder.setBindGroup(0, window.webgpuBindGroup);
    passEncoder.draw(4);
    passEncoder.end();
    
    // Submit commands
    const commandBuffer = commandEncoder.finish();
    queue.submit([commandBuffer]);
  }, xe::gpu::webgpu::g_webgpu_frame_buffer);
#endif
}

// WebAssembly exports for browser interaction
extern "C" {
  EMSCRIPTEN_KEEPALIVE
  void* webgpu_get_frame_buffer() {
    // Return pointer to the actual swapped frame buffer data
    return xe::gpu::webgpu::g_webgpu_frame_buffer;
  }
  
  EMSCRIPTEN_KEEPALIVE
  void webgpu_render_frame() {
    // This would trigger WebGPU rendering
    // For now, just increment frame counter locally for standalone exports
    // frame_counter_++;
  }
}


}  // namespace webgpu
}  // namespace gpu
}  // namespace xe
