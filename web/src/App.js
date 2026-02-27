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

          // Auto-load ROM for development ease
          loadDevelopmentRom();
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
      console.log('🔄 Auto-loading development ROM from http://localhost:8000/risk.bin');
      setStatus('Loading development ROM...');
      
      const response = await fetch('http://localhost:8000/risk.bin');
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
      
      // Auto-start the game after ROM is loaded
      setTimeout(() => {
        console.log('🎮 Auto-starting game...');
        handlePlay();
      }, 1000);
      
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

  const handlePlay = async () => {
    console.log('🎮 Starting game...');
    if (!wasmLoader || !romData) {
      setError('Please load a ROM first');
      return;
    }
    console.log('🎮 Game started successfully');

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
      if (window.animationId) {
        cancelAnimationFrame(window.animationId);
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

      if (window.animationId) {
        cancelAnimationFrame(window.animationId);
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
    let lastFrameTime = 0;
    let frameCount = 0;

    const renderFrame = (currentTime) => {
      if (!isPlayingRef.current || isPausedRef.current) return;

      // Calculate FPS
      if (lastFrameTime) {
        const deltaTime = currentTime - lastFrameTime;
        frameCount++;

        if (frameCount % 30 === 0) {
          const currentFps = Math.round(1000 / deltaTime);
          setFps(currentFps);
        }
      }
      lastFrameTime = currentTime;

      // Get frame buffer from WebAssembly and render to canvas
      const canvas = canvasRef.current;
      if (canvas && wasmLoader) {
        const ctx = canvas.getContext('2d');
        const frameBuffer = wasmLoader.getFrameBuffer();

        if (frameBuffer) {
          // Safely acquire the actual ArrayBuffer from WASM memory
          const wasmMemoryBuffer = wasmLoader.module.HEAPU8?.buffer
            || wasmLoader.module.memory?.buffer
            || wasmLoader.module.buffer;

          if (!wasmMemoryBuffer) {
            console.error("No compatible memory interface found to read frame buffer!");
            return;
          }

          // Create ImageData from frame buffer memory
          const imageData = new ImageData(
            new Uint8ClampedArray(
              wasmMemoryBuffer,
              frameBuffer,
              canvas.width * canvas.height * 4
            ),
            canvas.width,
            canvas.height
          );
          ctx.putImageData(imageData, 0, 0);
        }
      }

      // Update memory usage (simulated)
      if (frameCount % 60 === 0) {
        const memoryUsage = Math.round(Math.random() * 512 + 256);
        setMemory(memoryUsage);
      }

      window.animationId = requestAnimationFrame(renderFrame);
    };

    window.animationId = requestAnimationFrame(renderFrame);
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
        <Title>Xenia Web Emulator</Title>
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
