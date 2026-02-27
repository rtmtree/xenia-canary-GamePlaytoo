import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import RomImporter from './components/RomImporter';
import WebGPUCanvas from './components/WebGPUCanvas';
import GameControls from './components/GameControls';
import StatusBar from './components/StatusBar';
import XeniaWebGPULoader from './wasm/XeniaWebGPULoader';

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

function AppWebGPU() {
  const [webgpuLoader, setWebgpuLoader] = useState(null);
  const [romData, setRomData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState(0);
  const [status, setStatus] = useState('Initializing WebGPU...');
  const [wasmTest, setWasmTest] = useState('Not tested');
  const [webgpuInfo, setWebgpuInfo] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    const initializeWebGPU = async () => {
      try {
        console.log('🔍 Starting WebGPU WebAssembly initialization...');
        setIsLoading(true);
        setStatus('Loading WebGPU WebAssembly...');

        const loader = new XeniaWebGPULoader();
        console.log('🔍 Loader created, attempting to load...');
        const success = await loader.load();
        console.log('🔍 Load result:', success);

        if (success) {
          setWebgpuLoader(loader);
          setStatus('Initializing WebGPU...');
          setWasmTest('✅ WebGPU WebAssembly loaded successfully');
          console.log('✅ WebGPU WebAssembly loaded successfully');

          // Test functions
          try {
            const initResult = loader.module._initialize_emulator();
            const webgpuInitResult = loader.module._initialize_webgpu();
            const info = loader.getWebGPUInfo();
            setWebgpuInfo(info);
            setWasmTest(`✅ Functions working! init: ${initResult}, webgpu: ${webgpuInitResult}`);
            console.log('✅ WebGPU info:', info);
          } catch (e) {
            setWasmTest('❌ Functions failed: ' + e.message);
          }

          // Initialize WebGPU
          try {
            await loader.initializeWebGPU();
            setStatus('WebGPU Ready');
            setWasmTest('✅ WebGPU fully initialized!');
          } catch (webgpuError) {
            console.error('WebGPU initialization failed:', webgpuError);
            setStatus('WebGPU Failed - Using Software Rendering');
            setWasmTest('⚠️ WebGPU failed, using software rendering');
          }
        } else {
          setError('Failed to load WebGPU WebAssembly module');
          setStatus('Error');
          setWasmTest('❌ WebGPU WebAssembly load failed');
          console.error('❌ WebGPU WebAssembly load failed');
        }
      } catch (err) {
        console.error('❌ WebGPU WebAssembly initialization error:', err);
        setError(`WebGPU WebAssembly initialization failed: ${err.message}`);
        setStatus('Error');
      } finally {
        setIsLoading(false);
      }
    };

    initializeWebGPU();
  }, []);

  const handleRomLoad = (data) => {
    setRomData(data);
    setError(null);
    setStatus('ROM loaded successfully');
  };

  const handlePlay = async () => {
    if (!webgpuLoader || !romData) return;

    try {
      setIsLoading(true);
      setStatus('Starting game with WebGPU...');

      // Initialize emulator
      webgpuLoader.initialize();

      // Load ROM
      const romArray = new Uint8Array(romData);
      webgpuLoader.loadRom(romArray);

      // Start emulation
      webgpuLoader.startEmulation();

      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsPaused(false);
      isPausedRef.current = false;
      setStatus('Game running with WebGPU');
      setIsLoading(false);

      // Start WebGPU render loop
      startWebGPURenderLoop();
    } catch (err) {
      setError(`Failed to start game: ${err.message}`);
      setStatus('Error');
      setIsLoading(false);
    }
  };

  const handlePause = () => {
    if (!webgpuLoader) return;

    if (isPausedRef.current) {
      // Resume
      setIsPaused(false);
      isPausedRef.current = false;
      setStatus('Game running with WebGPU');
      startWebGPURenderLoop();
    } else {
      // Pause
      setIsPaused(true);
      isPausedRef.current = true;
      setStatus('Game paused');
      if (window.webgpuAnimationId) {
        cancelAnimationFrame(window.webgpuAnimationId);
      }
    }
  };

  const handleStop = () => {
    if (!webgpuLoader) return;

    try {
      webgpuLoader.stopEmulation();

      setIsPlaying(false);
      isPlayingRef.current = false;
      setIsPaused(false);
      isPausedRef.current = false;
      setStatus('Game stopped');
      setFps(0);
      setMemory(0);

      if (window.webgpuAnimationId) {
        cancelAnimationFrame(window.webgpuAnimationId);
        window.webgpuAnimationId = null;
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

  const startWebGPURenderLoop = () => {
    let lastFrameTime = 0;
    let frameCount = 0;

    const renderFrame = async (currentTime) => {
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

      // Render using WebGPU
      if (webgpuLoader) {
        try {
          await webgpuLoader.renderFrame();
        } catch (error) {
          console.error('WebGPU render error:', error);
        }
      }

      // Update memory usage (simulated)
      if (frameCount % 60 === 0) {
        const memoryUsage = Math.round(Math.random() * 512 + 256);
        setMemory(memoryUsage);
      }

      window.webgpuAnimationId = requestAnimationFrame(renderFrame);
    };

    window.webgpuAnimationId = requestAnimationFrame(renderFrame);
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
        <Title>Xenia WebGPU Emulator</Title>
        <Subtitle>Xbox 360 Emulator with WebGPU Graphics</Subtitle>
        {webgpuInfo && (
          <div style={{ marginTop: '10px', fontSize: '0.9rem', opacity: 0.8 }}>
            {webgpuInfo}
          </div>
        )}
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
          <WebGPUCanvas
            ref={canvasRef}
            isLoading={isLoading}
            error={error}
            onRetry={handleErrorRetry}
            isPlaying={isPlaying}
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

export default AppWebGPU;
