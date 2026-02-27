/**
 ******************************************************************************
 * Xenia : Xbox 360 Emulator Research Project                                 *
 ******************************************************************************
 * Copyright 2022 Ben Vanik. All rights reserved.                             *
 * Released under the BSD license - see LICENSE in the root for more details. *
 ******************************************************************************
 */

#include "xenia/gpu/webgpu/webgpu_graphics_system.h"

#include "xenia/gpu/webgpu/webgpu_command_processor.h"
#include "xenia/xbox.h"

namespace xe {
namespace gpu {
namespace webgpu {

WebGPUGraphicsSystem::WebGPUGraphicsSystem() {}

WebGPUGraphicsSystem::~WebGPUGraphicsSystem() {}

std::string WebGPUGraphicsSystem::name() const {
  auto webgpu_command_processor =
      static_cast<WebGPUCommandProcessor*>(command_processor());
  if (webgpu_command_processor != nullptr) {
    return webgpu_command_processor->GetWindowTitleText();
  }
  return "WebGPU";
}

X_STATUS WebGPUGraphicsSystem::Setup(cpu::Processor* processor,
                                     kernel::KernelState* kernel_state,
                                     ui::WindowedAppContext* app_context,
                                     bool with_presentation) {
  // WebGPU provider will be created in the command processor
  return GraphicsSystem::Setup(processor, kernel_state, app_context,
                               with_presentation);
}

std::unique_ptr<CommandProcessor>
WebGPUGraphicsSystem::CreateCommandProcessor() {
  return std::make_unique<WebGPUCommandProcessor>(this, kernel_state_);
}

}  // namespace webgpu
}  // namespace gpu
}  // namespace xe
