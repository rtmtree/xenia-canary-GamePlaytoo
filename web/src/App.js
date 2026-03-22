import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import RomImporter from './components/RomImporter';
import GameCanvas from './components/GameCanvas';
import GameControls from './components/GameControls';
import StatusBar from './components/StatusBar';
import XeniaWasmLoader from './wasm/XeniaWasmLoader';

const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
`;

const Header = styled.header`
  text-align: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  opacity: 0.9;
`;

const Main = styled.main`
  flex: 1;
  padding: 30px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
`;

const ControlsSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 20px;
`;

const GameContainer = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 30px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
`;

function App() {
  const [wasmLoader, setWasmLoader] = useState(null);
  const [romData, setRomData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState(0);
  const [status, setStatus] = useState('Initializing...');
  const [wasmTest, setWasmTest] = useState('Not tested');
  const canvasRef = useRef(null);
  const hasAutoLoadedRom = useRef(false);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const initializeWasm = async () => {
      try {
        console.log('🔍 Starting WebAssembly initialization...');
        const loader = new XeniaWasmLoader();
        console.log('🔍 Loader created, attempting to load...');
        const success = await loader.load();
        console.log('🔍 Load result:', success);
        if (success) {
          setWasmLoader(loader);
          setStatus('Ready');
          setWasmTest('✅ WebAssembly loaded successfully');
          console.log('✅ WebAssembly loaded successfully');

          // Test functions
          try {
            const initResult = loader.module._initialize_emulator();
            const frameBuffer = loader.module._get_frame_buffer();
            setWasmTest(`✅ Functions working! init: ${initResult}, frameBuffer: ${frameBuffer}`);
          } catch (e) {
            setWasmTest('❌ Functions failed: ' + e.message);
          }

          // Auto-load ROM for development ease (only once)
          if (!hasAutoLoadedRom.current) {
            hasAutoLoadedRom.current = true;
            loadDevelopmentRom();
          }
        } else {
          setError('Failed to load WebAssembly module');
          setStatus('Error');
          setWasmTest('❌ WebAssembly load failed');
          console.error('❌ WebAssembly load failed');
        }
      } catch (err) {
        console.error('❌ WebAssembly initialization error:', err);
        setError(`WebAssembly initialization failed: ${err.message}`);
        setStatus('Error');
      }
    };

    initializeWasm();
  }, []);

  const loadDevelopmentRom = async () => {
    try {
      console.log('🔄 Auto-loading development ROM from http://localhost:8008/risk.bin');
      setStatus('Loading development ROM...');

      const response = await fetch('http://localhost:8008/risk2.bin');
      // const response = await fetch('http://localhost:8008/nier.iso');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (total > 0) {
          const progress = (loaded / total * 100).toFixed(1);
          setStatus(`Loading ROM: ${progress}%`);
          console.log(`📊 ROM loading progress: ${progress}% (${loaded}/${total} bytes)`);
        }
      }

      // Combine all chunks into a single ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const romBuffer = new Uint8Array(totalLength);
      let position = 0;

      for (const chunk of chunks) {
        romBuffer.set(chunk, position);
        position += chunk.length;
      }

      console.log(`✅ Development ROM loaded successfully: ${romBuffer.length} bytes`);
      handleRomLoad(romBuffer.buffer);

    } catch (error) {
      console.error('❌ Failed to load development ROM:', error);
      setError(`Failed to auto-load ROM: ${error.message}`);
      setStatus('Ready - Please load ROM manually');
    }
  };

  const handleRomLoad = (data) => {
    setRomData(data);
    setError(null);
    setStatus('ROM loaded successfully');
  };

  // Auto-start when both WebAssembly and ROM are ready
  useEffect(() => {
    if (wasmLoader && romData && !isPlaying && !isLoading) {
      console.log('🎮 Both WebAssembly and ROM ready, auto-starting game...');
      setTimeout(() => {
        handlePlay();
      }, 1000);
    }
  }, [wasmLoader, romData, isPlaying, isLoading]);

  const handlePlay = async () => {
    console.log('🎮 Starting game...');
    if (isPlayingRef.current || isLoading) {
      console.log('⚠️ Game already starting or playing, ignoring request');
      return;
    }
    if (!wasmLoader || !romData) {
      console.log({ wasmLoader, romData });
      setError('Please load a ROM first');
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Starting game...');

      // Initialize emulator
      wasmLoader.initialize();

      // Load ROM
      wasmLoader.loadRom(romData);

      // Start emulation
      wasmLoader.startEmulation();

      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsPaused(false);
      isPausedRef.current = false;
      setStatus('Game running');
      setIsLoading(false);

      // Start render loop
      startRenderLoop();

      console.log('🎮 Game started successfully');
    } catch (err) {
      setError(`Failed to start game: ${err.message}`);
      setStatus('Error');
      setIsLoading(false);
    }
  };

  const handlePause = () => {
    if (!wasmLoader) return;

    if (isPausedRef.current) {
      // Resume
      setIsPaused(false);
      isPausedRef.current = false;
      setStatus('Game running');
      startRenderLoop();
    } else {
      // Pause
      setIsPaused(true);
      isPausedRef.current = true;
      setStatus('Game paused');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  const handleStop = () => {
    if (!wasmLoader) return;

    try {
      wasmLoader.stopEmulation();
      setIsPlaying(false);
      isPlayingRef.current = false;
      setIsPaused(false);
      isPausedRef.current = false;
      setStatus('Game stopped');
      setFps(0);
      setMemory(0);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } catch (err) {
      setError(`Failed to stop game: ${err.message}`);
    }
  };

  const startRenderLoop = () => {
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = lastFrameTime;

    const renderFrame = async (currentTime) => {
      if (!isPlayingRef.current || isPausedRef.current) return;

      const canvas = canvasRef.current;

      frameCount++;
      if (currentTime - lastFpsUpdate >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastFpsUpdate = currentTime;
      }

      // If WebGPU is active, manually drive _webgpu_render each frame since
      // C++ _get_frame_buffer only returns a pointer and doesn't fire the callback
      if (wasmLoader && wasmLoader.webGpuActive) {
        const fbPtr = wasmLoader.getFrameBuffer();
        if (fbPtr && globalThis._webgpu_render) {
          globalThis._webgpu_render(fbPtr);
        }
        animationFrameRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      const ctx = canvas.getContext('2d');
      // Get frame buffer pointer
      const frameBuffer = wasmLoader.getFrameBuffer();

      if (frameBuffer) {
        try {
          // If WebGPU is active, skipping 2D context update
          if (wasmLoader.webGpuActive) return;

          // Use the new async frame buffer reading method
          const frameBufferData = await wasmLoader.getFrameBufferData(canvas.width, canvas.height);

          if (ctx) {
            // Create ImageData from the frame buffer data
            const imageData = new ImageData(
              new Uint8ClampedArray(frameBufferData),
              canvas.width,
              canvas.height
            );
            ctx.putImageData(imageData, 0, 0);
          }

        } catch (error) {
          console.error('❌ Failed to read frame buffer:', error);
          // Don't return here, continue the loop so it can retry next frame
        }
      }

      // Continue render loop
      if (isPlayingRef.current && !isPausedRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      }
    };

    // Start the render loop
    renderFrame(performance.now());
  };

  const handleFullscreen = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      if (canvas.requestFullscreen) {
        canvas.requestFullscreen();
      } else if (canvas.webkitRequestFullscreen) {
        canvas.webkitRequestFullscreen();
      } else if (canvas.msRequestFullscreen) {
        canvas.msRequestFullscreen();
      }
    }
  };

  const handleErrorRetry = () => {
    setError(null);
    setStatus('Ready');
  };

  return (
    <AppContainer>
      <Header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <Title>Xenia Web Emulator</Title>
          {wasmLoader && wasmLoader.webGpuActive && (
            <span style={{
              background: 'linear-gradient(45deg, #00f2fe 0%, #4facfe 100%)',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              boxShadow: '0 0 10px rgba(79, 172, 254, 0.5)',
              textShadow: '0 0 5px rgba(255,255,255,0.5)'
            }}>WEBGPU ACTIVE</span>
          )}
        </div>
        <Subtitle>Xbox 360 Emulator in the Browser</Subtitle>
      </Header>

      <Main>
        <ControlsSection>
          <RomImporter onRomLoad={handleRomLoad} wasmLoader={wasmLoader} />
          <GameControls
            isPlaying={isPlaying}
            isPaused={isPaused}
            isLoading={isLoading}
            hasRom={!!romData}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onFullscreen={handleFullscreen}
          />
        </ControlsSection>

        <GameContainer>
          <GameCanvas
            ref={canvasRef}
            isLoading={isLoading}
            isPlaying={isPlaying}
            error={error}
            onRetry={handleErrorRetry}
          />
          <StatusBar
            status={status}
            fps={fps}
            memory={memory}
            wasmTest={wasmTest}
          />
        </GameContainer>
      </Main>
    </AppContainer>
  );
}

export default App;
