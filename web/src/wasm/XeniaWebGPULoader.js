// Xenia WebGPU WebAssembly Loader
class XeniaWebGPULoader {
    constructor() {
        this.module = null;
        this.isLoaded = false;
        this.device = null;
        this.context = null;
    }

    async load() {
        if (this.isLoaded) return;

        try {
            console.log('🔍 Loading Xenia WebGPU WebAssembly module...');
            const XeniaWebGPU = await import('./xenia_webgpu.js');
            this.module = await XeniaWebGPU.default();
            this.isLoaded = true;
            console.log('✅ Xenia WebGPU WebAssembly module loaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to load Xenia WebGPU WebAssembly module:', error);
            return false;
        }
    }

    async initializeWebGPU() {
        if (!this.isLoaded) throw new Error('Module not loaded');

        try {
            console.log('🔍 Initializing WebGPU...');

            // Check WebGPU support
            if (!navigator.gpu) {
                throw new Error('WebGPU not supported in this browser');
            }

            // Request adapter
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });

            if (!adapter) {
                throw new Error('No appropriate WebGPU adapter found');
            }

            // Request device
            this.device = await adapter.requestDevice();

            // Get canvas context
            const canvas = document.getElementById('game-canvas');
            if (!canvas) {
                throw new Error('Game canvas not found');
            }

            this.context = canvas.getContext('webgpu');
            if (!this.context) {
                throw new Error('Failed to get WebGPU context');
            }

            // Configure swap chain
            const swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
            this.context.configure({
                device: this.device,
                format: swapChainFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
            });

            console.log('✅ WebGPU initialized successfully');

            // Initialize C++ WebGPU system
            this.module._initialize_webgpu();
            this.module._webgpu_create_device();
            this.module._webgpu_create_swap_chain();

            return true;
        } catch (error) {
            console.error('❌ WebGPU initialization failed:', error);
            throw error;
        }
    }

    initialize() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._initialize_emulator();
    }

    loadRom(data) {
        if (!this.isLoaded) throw new Error('Module not loaded');

        // Allocate memory for ROM data
        const ptr = this.module._malloc(data.length);
        this.module.HEAPU8.set(data, ptr);

        // Call the load_rom function
        const result = this.module._load_rom(ptr, data.length);

        // Free allocated memory
        this.module._free(ptr);

        return result;
    }

    startEmulation() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._start_emulation();
    }

    stopEmulation() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._stop_emulation();
    }

    getFrameBuffer() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._get_frame_buffer();
    }

    async renderFrame() {
        if (!this.isLoaded || !this.device) return;

        try {
            // Get current texture from swap chain
            const currentTexture = this.context.getCurrentTexture();

            // Create command encoder
            const commandEncoder = this.device.createCommandEncoder();

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

            // Get frame buffer from WebAssembly
            const frameBufferPtr = this.getFrameBuffer();

            // Try different memory access methods
            let wasmMemoryBuffer = null;
            if (this.module.HEAPU8 && this.module.HEAPU8.buffer) {
                wasmMemoryBuffer = this.module.HEAPU8.buffer;
            } else if (this.module.memory && this.module.memory.buffer) {
                wasmMemoryBuffer = this.module.memory.buffer;
            } else if (this.module.buffer) {
                wasmMemoryBuffer = this.module.buffer;
            } else {
                console.error("No compatible memory interface found to read frame buffer!");
                return;
            }

            const frameBufferData = new Uint8Array(wasmMemoryBuffer, frameBufferPtr, 1280 * 720 * 4);

            // Create texture from frame buffer data
            const texture = this.device.createTexture({
                size: { width: 1280, height: 720 },
                format: 'rgba8unorm',
                usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            });

            // Write frame buffer to texture
            this.device.queue.writeTexture(
                { texture },
                frameBufferData,
                { bytesPerRow: 1280 * 4, rowsPerImage: 720 },
                { width: 1280, height: 720 }
            );

            // Create simple render pipeline to display texture
            const vertexShaderCode = `
                @vertex
                fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
                    let pos = array<vec2<f32>, 6>(
                        vec2<f32>(-1.0, -1.0),
                        vec2<f32>( 1.0, -1.0),
                        vec2<f32>( 1.0,  1.0),
                        vec2<f32>(-1.0, -1.0),
                        vec2<f32>( 1.0,  1.0),
                        vec2<f32>(-1.0,  1.0)
                    );
                    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
                }
            `;

            const fragmentShaderCode = `
                @group(0) @binding(0) var texSampler: sampler;
                @group(0) @binding(1) var frameTexture: texture_2d<f32>;
                
                @fragment
                fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
                    let uv = vec2<f32>(fragCoord.x / 1280.0, fragCoord.y / 720.0);
                    return textureSample(frameTexture, texSampler, uv);
                }
            `;

            const vertexShader = this.device.createShaderModule({ code: vertexShaderCode });
            const fragmentShader = this.device.createShaderModule({ code: fragmentShaderCode });

            const sampler = this.device.createSampler();

            const pipelineDescriptor = {
                layout: 'auto',
                vertex: {
                    module: vertexShader,
                    entryPoint: 'vs_main',
                },
                fragment: {
                    module: fragmentShader,
                    entryPoint: 'fs_main',
                    targets: [{
                        format: navigator.gpu.getPreferredCanvasFormat(),
                    }],
                },
                primitive: {
                    topology: 'triangle-list',
                },
            };

            const pipeline = this.device.createRenderPipeline(pipelineDescriptor);

            // Create bind group
            const bindGroup = this.device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: texture.createView() },
                ],
            });

            // Render
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.draw(6);
            passEncoder.end();

            // Submit commands
            const commandBuffer = commandEncoder.finish();
            this.device.queue.submit([commandBuffer]);

            // Notify C++ that frame was rendered
            this.module._webgpu_render_frame();

        } catch (error) {
            console.error('❌ WebGPU render failed:', error);
        }
    }

    getWebGPUInfo() {
        if (!this.isLoaded) throw new Error('Module not loaded');
        return this.module._get_webgpu_info();
    }
}

export default XeniaWebGPULoader;
