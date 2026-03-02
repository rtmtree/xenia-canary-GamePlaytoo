cmake_minimum_required(VERSION 3.16)
project(xenia-wasm)

# Force Emscripten config
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Add definitions
add_definitions(
    -D__EMSCRIPTEN__
    -DXE_PLATFORM_LINUX=1
    -DXE_PLATFORM_LINUX_WEB=1
    -Wno-deprecated-declarations
    -Wno-unknown-attributes
)

# Core Xenia includes
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/fmt/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/cxxopts/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/date/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/flatbuffers/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/vulkan-headers/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/imgui
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/capstone/include/capstone
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/xbyak
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/libav/include
)

# Collect all Xenia base files manually to avoid compiling Windows implementations
file(GLOB_RECURSE XENIA_CORE_FILES
    "src/xenia/base/*.cc"
    "src/xenia/kernel/*.cc"
    "src/xenia/cpu/*.cc"
    "src/xenia/app/*.cc"
    "src/xenia/gpu/*.cc"
    "src/xenia/ui/*.cc"
    "src/xenia/vfs/*.cc"
)

# Exclude all Windows, Android, Mac, and Vulkan/D3D specific renders for this stub buildup
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*_win.cc$")
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*_android.cc$")
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*_mac.cc$")
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*_ios.cc$")
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*/d3d12/.*")
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*/vulkan/.*")
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*_xaudio2.cc$")
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*_xinput.cc$")
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*_winkey.cc$")
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*microprofile_drawer.cc$") # Fails directly

# Exclude discord implementation which isn't web safe
list(FILTER XENIA_CORE_FILES EXCLUDE REGEX ".*discord_presence.cc$")

# Define target
add_executable(xenia_wasm
    ${XENIA_CORE_FILES}
    ${CMAKE_CURRENT_SOURCE_DIR}/build-wasm/main_wasm.cpp
)

# Set WASM flags
set_target_properties(xenia_wasm PROPERTIES
    LINK_FLAGS "-s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s EXPORT_ES6=1 -s MODULARIZE=1 -s EXPORT_NAME='XeniaWasm' -s EXPORTED_RUNTIME_METHODS=\"['ccall', 'cwrap']\" -O3"
)
