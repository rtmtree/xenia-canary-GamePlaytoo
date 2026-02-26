import React, { useRef } from 'react';
import styled from 'styled-components';

const ImportSection = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const FileLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  border: none;
  font-size: 1rem;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileInfo = styled.div`
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  opacity: 0.8;
`;

const FileName = styled.span`
  font-weight: 600;
`;

const FileSize = styled.span`
  font-size: 0.8rem;
  opacity: 0.7;
`;

const RomImporter = ({ onRomLoad }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      onRomLoad(e.target.result);
    };

    reader.onerror = () => {
      console.error('Failed to read ROM file');
    };

    reader.readAsArrayBuffer(file);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <ImportSection>
      <FileLabel onClick={handleClick}>
        <span className="icon">📁</span>
        Import ROM File
      </FileLabel>
      <FileInput
        ref={fileInputRef}
        type="file"
        accept=".iso,.xex,.bin"
        onChange={handleFileSelect}
      />
      <FileInfo>
        <FileName>No file selected</FileName>
        <FileSize></FileSize>
      </FileInfo>
    </ImportSection>
  );
};

export default RomImporter;
