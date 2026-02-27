/**
 ******************************************************************************
 * Xenia : Xbox 360 Emulator Research Project                                 *
 ******************************************************************************
 * Copyright 2022 Ben Vanik. All rights reserved.                             *
 * Released under the BSD license - see LICENSE in the root for more details. *
 ******************************************************************************
 */

#ifndef XENIA_GPU_WEBGPU_WEBGPU_COMMAND_PROCESSOR_H_
#define XENIA_GPU_WEBGPU_WEBGPU_COMMAND_PROCESSOR_H_

#include <array>
#include <cstdint>
#include <memory>
#include <unordered_map>
#include <vector>

#include "xenia/gpu/command_processor.h"
#include "xenia/gpu/xenos.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <webgpu/webgpu.h>
#else
// Mock WebGPU for non-Emscripten builds
typedef void* WGPUDevice;
typedef void* WGPUQueue;
typedef void* WGPUSurface;
typedef void* WGPUSwapChain;
typedef void* WGPUTexture;
typedef void* WGPUBuffer;
typedef void* WGPUShaderModule;
typedef void* WGPURenderPipeline;
typedef void* WGPUCommandEncoder;
typedef void* WGPURenderPassEncoder;
#endif

namespace xe {
namespace gpu {
namespace webgpu {

class WebGPUCommandProcessor : public CommandProcessor {
 protected:
#define OVERRIDING_BASE_CMDPROCESSOR
#include "../pm4_command_processor_declare.h"
#undef OVERRIDING_BASE_CMDPROCESSOR

 public:
  WebGPUCommandProcessor(GraphicsSystem* graphics_system,
                        kernel::KernelState* kernel_state);
  ~WebGPUCommandProcessor() override;

  std::string GetWindowTitleText() const override { return "WebGPU"; }

  bool Initialize() override;
  void Shutdown() override;
  void ClearCaches() override;

  // WebGPU-specific methods
  WGPUDevice GetDevice() const { return device_; }
  WGPUQueue GetQueue() const { return queue_; }

 private:
  void InitializeWebGPU();
  void CreateSwapChain();
  void RenderFrame();

  // WebGPU objects
  WGPUDevice device_ = nullptr;
  WGPUQueue queue_ = nullptr;
  WGPUSurface surface_ = nullptr;
  WGPUSwapChain swap_chain_ = nullptr;
  
  // Frame buffer
  WGPUTexture frame_texture_ = nullptr;
  WGPUBuffer frame_buffer_ = nullptr;
  
  // Rendering state
  uint32_t frame_width_ = 1280;
  uint32_t frame_height_ = 720;
  
  // Test pattern animation
  uint32_t frame_counter_ = 0;
};

}  // namespace webgpu
}  // namespace gpu
}  // namespace xe

#endif  // XENIA_GPU_WEBGPU_WEBGPU_COMMAND_PROCESSOR_H_
