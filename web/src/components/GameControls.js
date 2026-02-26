import React from 'react';
import styled from 'styled-components';

const ControlsContainer = styled.div`
  display: flex;
  gap: 10px;
`;

const ControlButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const GameControls = ({
  isPlaying,
  isPaused,
  isLoading,
  hasRom,
  onPlay,
  onPause,
  onStop,
  onFullscreen
}) => {
  return (
    <ControlsContainer>
      <ControlButton
        onClick={onPlay}
        disabled={!hasRom || isPlaying || isLoading}
      >
        ▶️ Play
      </ControlButton>
      <ControlButton
        onClick={onPause}
        disabled={!isPlaying || isLoading}
      >
        {isPaused ? '▶️ Resume' : '⏸️ Pause'}
      </ControlButton>
      <ControlButton
        onClick={onStop}
        disabled={!isPlaying || isLoading}
      >
        ⏹️ Stop
      </ControlButton>
      <ControlButton
        onClick={onFullscreen}
        disabled={!isPlaying}
      >
        🔳 Fullscreen
      </ControlButton>
    </ControlsContainer>
  );
};

export default GameControls;
