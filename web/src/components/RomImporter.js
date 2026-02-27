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

const ProgressInfo = styled.div`
  font-size: 0.8rem;
  color: #4CAF50;
  font-weight: 600;
`;

const ProgressBar = styled.div`
  width: 200px;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  border-radius: 3px;
  transition: width 0.3s ease;
  width: ${props => props.percentage}%;
`;

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB limit

const RomImporter = ({ onRomLoad, wasmLoader }) => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [streamingProgress, setStreamingProgress] = React.useState(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);

    console.log('Selected file:', file.name, 'Size:', file.size, 'Type:', file.type);

    // For very large files, suggest alternative approaches
    if (file.size > MAX_FILE_SIZE) {
      const errorMsg = `File too large (${formatFileSize(file.size)}). Maximum supported size is ${formatFileSize(MAX_FILE_SIZE)}.\n\nFor large ROM files, consider:\n1. Using the desktop Xenia application\n2. WebAssembly-based streaming (requires backend changes)\n3. File chunking/streaming implementation`;
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    // Try streaming approach for medium files (500MB - 2GB)
    if (file.size > 500 * 1024 * 1024) {
      console.log('Using streaming approach for large file');
      try {
        await streamFileToWasm(file);
        return;
      } catch (error) {
        console.error('Streaming failed, falling back to FileReader:', error);
        setStreamingProgress(null);
      }
    }

    // Standard FileReader for smaller files
    const reader = new FileReader();
    reader.onload = (e) => {
      console.log('File read successfully, size:', e.target.result.byteLength);
      onRomLoad(e.target.result);
    };

    reader.onerror = (error) => {
      console.error('Failed to read ROM file:', error);
      console.error('FileReader error:', reader.error);
      
      let errorMsg = 'Failed to read ROM file';
      if (reader.error) {
        if (reader.error.name === 'NotReadableError') {
          errorMsg = `Cannot read file. This may be due to the file size (${formatFileSize(file.size)}) being too large for browser memory, or file permission issues.`;
        } else {
          errorMsg = `FileReader error: ${reader.error.message}`;
        }
      }
      setError(errorMsg);
    };

    reader.onabort = () => {
      console.warn('File reading was aborted');
      setError('File reading was aborted');
    };

    try {
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Exception while starting file read:', error);
      setError('Exception while reading file: ' + error.message);
    }
  };

  const streamFileToWasm = async (file) => {
    if (!wasmLoader || !wasmLoader.isLoaded) {
      throw new Error('WebAssembly module not loaded. Please wait for initialization to complete.');
    }

    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const totalSize = file.size;
    let offset = 0;
    
    console.log(`Starting streaming for ${file.name} (${formatFileSize(totalSize)}) in ${CHUNK_SIZE} byte chunks`);
    setStreamingProgress(0);

    // Create a temporary buffer to accumulate chunks
    const chunks = [];
    
    try {
      while (offset < totalSize) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const arrayBuffer = await chunk.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        chunks.push(data);
        
        offset += data.length;
        
        // Report progress
        const progress = (offset / totalSize * 100).toFixed(1);
        setStreamingProgress(parseFloat(progress));
        console.log(`Streaming progress: ${progress}% (${offset}/${totalSize} bytes)`);
        
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      console.log(`File streaming complete, assembling final buffer...`);
      
      // Combine all chunks into a single ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const finalBuffer = new Uint8Array(totalLength);
      let position = 0;
      
      for (const chunk of chunks) {
        finalBuffer.set(chunk, position);
        position += chunk.length;
      }
      
      console.log(`Final buffer assembled, size: ${finalBuffer.length} bytes`);
      
      // Pass the complete file data to the ROM loader
      onRomLoad(finalBuffer.buffer);
      
      setStreamingProgress(100);
      console.log(`File successfully streamed and loaded: ${file.name}`);
      
    } finally {
      // Clear progress after a delay
      setTimeout(() => setStreamingProgress(null), 2000);
    }
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
        <FileName style={{ color: error ? '#ff6b6b' : 'inherit' }}>
          {selectedFile ? selectedFile.name : 'No file selected'}
        </FileName>
        {streamingProgress !== null ? (
          <>
            <ProgressInfo>Streaming: {streamingProgress.toFixed(1)}%</ProgressInfo>
            <ProgressBar>
              <ProgressFill percentage={streamingProgress} />
            </ProgressBar>
          </>
        ) : (
          <FileSize style={{ color: error ? '#ff6b6b' : 'inherit' }}>
            {error ? error : (selectedFile ? formatFileSize(selectedFile.size) : '')}
          </FileSize>
        )}
      </FileInfo>
    </ImportSection>
  );
};

export default RomImporter;
