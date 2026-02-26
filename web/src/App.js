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
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState(0);
  const [status, setStatus] = useState('Initializing...');
  const canvasRef = useRef(null);

  useEffect(() => {
    const initializeWasm = async () => {
      try {
        const loader = new XeniaWasmLoader();
        const success = await loader.load();
        if (success) {
          setWasmLoader(loader);
          setStatus('Ready');
        } else {
          setError('Failed to load WebAssembly module');
          setStatus('Error');
        }
      } catch (err) {
        setError(`WebAssembly initialization failed: ${err.message}`);
        setStatus('Error');
      }
    };

    initializeWasm();
  }, []);

  const handleRomLoad = (data) => {
    setRomData(data);
    setError(null);
    setStatus('ROM loaded successfully');
  };

  const handlePlay = async () => {
    if (!wasmLoader || !romData) return;

    try {
      setIsLoading(true);
      setStatus('Starting game...');

      // Initialize emulator
      wasmLoader.initialize();

      // Load ROM
      const romArray = new Uint8Array(romData);
      wasmLoader.loadRom(romArray);

      // Start emulation
      wasmLoader.startEmulation();

      setIsPlaying(true);
      setIsPaused(false);
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

    if (isPaused) {
      // Resume
      setIsPaused(false);
      setStatus('Game running');
      startRenderLoop();
    } else {
      // Pause
      setIsPaused(true);
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
      setIsPaused(false);
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
      if (!isPlaying || isPaused) return;

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
          // Create ImageData from frame buffer
          const imageData = new ImageData(
            new Uint8ClampedArray(frameBuffer),
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
          <RomImporter onRomLoad={handleRomLoad} />
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
          />
        </GameContainer>
      </Main>
    </AppContainer>
  );
}

export default App;
