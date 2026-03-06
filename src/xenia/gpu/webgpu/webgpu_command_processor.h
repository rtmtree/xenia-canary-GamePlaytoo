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
  // We do not override PM4 methods yet, using base CommandProcessor implementations

 public:
  WebGPUCommandProcessor(GraphicsSystem* graphics_system,
                        kernel::KernelState* kernel_state);
  ~WebGPUCommandProcessor() override;

  // Removed GetWindowTitleText as it doesn't exist in base class

  bool Initialize() override;
  void Shutdown() override;
  void ClearCaches() override;

  void IssueSwap(uint32_t frontbuffer_ptr, uint32_t frontbuffer_width,
                 uint32_t frontbuffer_height) override;

  void TracePlaybackWroteMemory(uint32_t base_ptr, uint32_t length) override {}
  void RestoreEdramSnapshot(const void* snapshot) override {}

 protected:
  bool SetupContext() override { return true; }
  void ShutdownContext() override {}

 public:
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
  // Removed WGPUSwapChain as it's not supported in newer Dawn
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
