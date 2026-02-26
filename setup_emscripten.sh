#!/bin/bash

# Emscripten SDK Setup Script for Xenia WebAssembly Build
# This script downloads and sets up Emscripten SDK

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMSDK_DIR="$PROJECT_ROOT/emsdk"

echo -e "${BLUE}Setting up Emscripten SDK for Xenia WebAssembly build...${NC}"

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: Git not found. Please install Git first.${NC}"
    exit 1
fi

# Check if emsdk directory already exists
if [ -d "$EMSDK_DIR" ]; then
    echo -e "${YELLOW}Emscripten SDK directory already exists at $EMSDK_DIR${NC}"
    echo -e "${YELLOW}Updating existing installation...${NC}"
    cd "$EMSDK_DIR"
    git pull
else
    echo -e "${BLUE}Downloading Emscripten SDK...${NC}"
    git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
    cd "$EMSDK_DIR"
fi

# Install latest emsdk
echo -e "${BLUE}Installing Emscripten SDK...${NC}"
./emsdk install latest

# Activate latest emsdk
echo -e "${BLUE}Activating Emscripten SDK...${NC}"
./emsdk activate latest

# Source the environment
echo -e "${BLUE}Setting up environment...${NC}"
source ./emsdk_env.sh

# Verify installation
if command -v emcc &> /dev/null; then
    echo -e "${GREEN}Emscripten SDK installed successfully!${NC}"
    echo -e "${GREEN}Version: $(emcc --version | head -n1)${NC}"
else
    echo -e "${RED}Error: Emscripten installation failed${NC}"
    exit 1
fi

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${BLUE}To use Emscripten in your current shell session, run:${NC}"
echo -e "${YELLOW}source $EMSDK_DIR/emsdk_env.sh${NC}"
echo -e ""
echo -e "${BLUE}To add to your shell profile permanently, add this line to ~/.zshrc or ~/.bash_profile:${NC}"
echo -e "${YELLOW}source $EMSDK_DIR/emsdk_env.sh${NC}"
echo -e ""
echo -e "${BLUE}After sourcing the environment, you can run:${NC}"
echo -e "${YELLOW}./build_wasm.sh${NC}"
