import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

const CanvasContainer = styled.div`
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
`;

const GameCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: auto;
  max-height: 600px;
  object-fit: contain;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
  backdrop-filter: blur(5px);
`;

const Spinner = styled.div`
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(220, 53, 69, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
  backdrop-filter: blur(5px);
`;

const ErrorMessage = styled.p`
  color: white;
  font-size: 1.1rem;
  margin-bottom: 20px;
  text-align: center;
`;

const RetryButton = styled.button`
  background: #fff;
  color: #dc3545;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    background: #f8f9fa;
  }
`;

const GameCanvasComponent = React.forwardRef(({ isLoading, error, onRetry }, ref) => {
  const canvasRef = useRef(null);

  // Forward the ref to the canvas element
  React.useImperativeHandle(ref, () => canvasRef.current);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set canvas size
      canvas.width = 1280;
      canvas.height = 720;

      // Initial clear with black background
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw placeholder text
      ctx.fillStyle = '#333';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No game loaded', canvas.width / 2, canvas.height / 2);
      ctx.font = '16px Arial';
      ctx.fillText('Import a ROM file to start', canvas.width / 2, canvas.height / 2 + 30);
    }
  }, []);

  return (
    <CanvasContainer>
      <GameCanvas
        ref={canvasRef}
        width={1280}
        height={720}
      />
      
      {isLoading && (
        <LoadingOverlay>
          <Spinner />
          <p>Loading game...</p>
        </LoadingOverlay>
      )}
      
      {error && (
        <ErrorOverlay>
          <ErrorMessage>{error}</ErrorMessage>
          <RetryButton onClick={onRetry}>Retry</RetryButton>
        </ErrorOverlay>
      )}
    </CanvasContainer>
  );
});

GameCanvasComponent.displayName = 'GameCanvasComponent';

export default GameCanvasComponent;
