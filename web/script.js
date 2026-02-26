class XeniaWebEmulator {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.romInput = document.getElementById('rom-input');
        this.playBtn = document.getElementById('play-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.errorOverlay = document.getElementById('error-overlay');
        this.errorMessage = document.getElementById('error-message');
        this.retryBtn = document.getElementById('retry-btn');
        this.fileInfo = document.getElementById('file-info');
        this.fileName = document.getElementById('file-name');
        this.fileSize = document.getElementById('file-size');
        this.status = document.getElementById('status');
        this.fpsCounter = document.getElementById('fps');
        this.memoryCounter = document.getElementById('memory');
        
        this.romData = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.animationId = null;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        
        this.initializeEventListeners();
        this.initializeCanvas();
    }
    
    initializeEventListeners() {
        // File input
        this.romInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Game controls
        this.playBtn.addEventListener('click', () => this.startGame());
        this.pauseBtn.addEventListener('click', () => this.pauseGame());
        this.stopBtn.addEventListener('click', () => this.stopGame());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.retryBtn.addEventListener('click', () => this.hideError());
        
        // Canvas events
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Keyboard events for game controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }
    
    initializeCanvas() {
        // Set canvas size
        this.canvas.width = 1280;
        this.canvas.height = 720;
        
        // Clear canvas with black background
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw placeholder text
        this.ctx.fillStyle = '#333';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('No game loaded', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Import a ROM file to start', this.canvas.width / 2, this.canvas.height / 2 + 30);
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Update file info
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        
        // Read ROM file
        const reader = new FileReader();
        reader.onload = (e) => {
            this.romData = e.target.result;
            this.enableControls();
            this.updateStatus('ROM loaded successfully');
            console.log('ROM file loaded:', file.name, this.formatFileSize(file.size));
        };
        
        reader.onerror = () => {
            this.showError('Failed to read ROM file');
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    enableControls() {
        this.playBtn.disabled = false;
        this.fullscreenBtn.disabled = false;
    }
    
    disableControls() {
        this.playBtn.disabled = true;
        this.pauseBtn.disabled = true;
        this.stopBtn.disabled = true;
        this.fullscreenBtn.disabled = true;
    }
    
    async startGame() {
        if (!this.romData) {
            this.showError('No ROM file loaded');
            return;
        }
        
        try {
            this.showLoading();
            this.updateStatus('Starting game...');
            
            // Simulate game initialization
            await this.simulateGameInitialization();
            
            this.isPlaying = true;
            this.isPaused = false;
            this.hideLoading();
            
            // Update UI
            this.playBtn.disabled = true;
            this.pauseBtn.disabled = false;
            this.stopBtn.disabled = false;
            
            this.updateStatus('Game running');
            this.startGameLoop();
            
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to start game: ' + error.message);
        }
    }
    
    pauseGame() {
        if (!this.isPlaying) return;
        
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.pauseBtn.textContent = '▶️ Resume';
            this.updateStatus('Game paused');
            cancelAnimationFrame(this.animationId);
        } else {
            this.pauseBtn.textContent = '⏸️ Pause';
            this.updateStatus('Game running');
            this.startGameLoop();
        }
    }
    
    stopGame() {
        this.isPlaying = false;
        this.isPaused = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset UI
        this.playBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.pauseBtn.textContent = '⏸️ Pause';
        this.stopBtn.disabled = true;
        
        // Clear canvas
        this.initializeCanvas();
        this.updateStatus('Game stopped');
        this.updateFPS(0);
        this.updateMemory(0);
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.canvas.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    startGameLoop() {
        const gameLoop = (currentTime) => {
            if (!this.isPlaying || this.isPaused) return;
            
            // Calculate FPS
            if (this.lastFrameTime) {
                const deltaTime = currentTime - this.lastFrameTime;
                this.frameCount++;
                
                if (this.frameCount % 30 === 0) {
                    this.fps = Math.round(1000 / deltaTime);
                    this.updateFPS(this.fps);
                }
            }
            this.lastFrameTime = currentTime;
            
            // Render game
            this.renderFrame();
            
            // Update memory usage (simulated)
            if (this.frameCount % 60 === 0) {
                const memoryUsage = Math.round(Math.random() * 512 + 256);
                this.updateMemory(memoryUsage);
            }
            
            this.animationId = requestAnimationFrame(gameLoop);
        };
        
        this.animationId = requestAnimationFrame(gameLoop);
    }
    
    renderFrame() {
        // Simulate game rendering
        const time = Date.now() * 0.001;
        
        // Create a simple animated pattern to simulate game rendering
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw some animated rectangles to simulate game graphics
        for (let i = 0; i < 50; i++) {
            const x = (Math.sin(time + i) * 0.5 + 0.5) * this.canvas.width;
            const y = (Math.cos(time * 0.7 + i) * 0.5 + 0.5) * this.canvas.height;
            const size = Math.sin(time + i * 0.1) * 10 + 20;
            
            const hue = (time * 50 + i * 10) % 360;
            this.ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            this.ctx.fillRect(x - size/2, y - size/2, size, size);
        }
        
        // Draw game info overlay
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`FPS: ${this.fps}`, 10, 20);
        this.ctx.fillText(`Frame: ${this.frameCount}`, 10, 40);
    }
    
    handleKeyDown(event) {
        // Handle game keyboard input
        if (this.isPlaying && !this.isPaused) {
            console.log('Key down:', event.key);
            // Add game-specific keyboard handling here
        }
    }
    
    handleKeyUp(event) {
        // Handle game keyboard input
        if (this.isPlaying && !this.isPaused) {
            console.log('Key up:', event.key);
            // Add game-specific keyboard handling here
        }
    }
    
    async simulateGameInitialization() {
        // Simulate game loading time
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, 2000);
        });
    }
    
    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }
    
    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorOverlay.style.display = 'flex';
        this.updateStatus('Error');
    }
    
    hideError() {
        this.errorOverlay.style.display = 'none';
    }
    
    updateStatus(text) {
        this.status.textContent = text;
    }
    
    updateFPS(fps) {
        this.fpsCounter.textContent = `FPS: ${fps}`;
    }
    
    updateMemory(memoryMB) {
        this.memoryCounter.textContent = `Memory: ${memoryMB} MB`;
    }
}

// Initialize the emulator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const emulator = new XeniaWebEmulator();
    
    // Make emulator available globally for debugging
    window.xeniaEmulator = emulator;
    
    console.log('Xenia Web Emulator initialized');
});
