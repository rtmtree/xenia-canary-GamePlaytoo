import React from 'react';
import styled from 'styled-components';

const StatusBarContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  font-size: 0.9rem;
  backdrop-filter: blur(5px);

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
`;

const StatusItem = styled.span`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const StatusBar = ({ status, fps, memory }) => {
  return (
    <StatusBarContainer>
      <StatusItem>
        <strong>Status:</strong> {status}
      </StatusItem>
      <StatusItem>
        <strong>FPS:</strong> {fps}
      </StatusItem>
      <StatusItem>
        <strong>Memory:</strong> {memory} MB
      </StatusItem>
    </StatusBarContainer>
  );
};

export default StatusBar;
