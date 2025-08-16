import { UIManager } from './UIManager.js';
import { PhysicsManager } from './PhysicsManager.js';
import { CameraManager } from './CameraManager.js';
import { checkImageExists } from './utils.js';
import { MAX_CHARACTERS, CHARACTER_NAMES, DROP_COOLDOWN, CHARACTER_IMAGE_SETTINGS } from './config.js';

export class Game {
    constructor() {
        this.uiManager = new UIManager(this);
        this.physicsManager = new PhysicsManager(this);
        this.cameraManager = new CameraManager(this);

        this.initializeGameState();
        this.initializeDropPosition();
        this.loadAssets();
        this.setupEventListeners();
        this.setupHelpDialog();

        this.gameLoop();
    }

    initializeGameState() {
        this.objectCount = 0;
        this.gameStartTime = null;
        this.maxHeightPixels = 0;
        this.selectedCharacter = 'camera';
        this.gameObjects = [];
        this.cameraOffset = 0;
        this.isGameOver = false;
        this.showGameOverScreen = false;
        this.finalStats = null;
        this.lastDropTime = 0;
        this.lastDroppedObject = null;

        this.mouseX = 0;
        this.mouseY = 0;
        this.currentRotation = 0;
        this.showPreview = true; // Always show preview now
        
        // Fixed drop position system
        this.dropX = 0; // Will be set to center in initializeDropPosition
        this.dropY = 150; // Fixed Y position for dropping
        
        // Two-step drop process
        this.isObjectConfirmed = false; // True when object is confirmed and ready to drop

        this.characterShapes = [];
        this.characterImages = [];
        
        // Help dialog state
        this.gameStarted = false;
    }

    initializeDropPosition() {
        // Set drop position to center of canvas
        this.dropX = this.uiManager.canvas.width / 2;
    }

    async loadAssets() {
        await this.loadCharacterImages();
        this.uiManager.updateCharacterSelectUI(this.characterShapes);
    }

    async loadCharacterImages() {
        // Only create camera character shape - no asset images
        const cameraShape = { 
            image: null, 
            width: 30, 
            height: 60, 
            isCamera: true, 
            name: 'カメラ',
            index: 0
        };
        this.characterShapes.push(cameraShape);
        this.characterImages.push(null);
    }

    setupHelpDialog() {
        // Check if user has seen the help dialog before
        if (!this.getCookie('hideHelpDialog')) {
            this.showHelpDialog();
        } else {
            this.gameStarted = true;
        }

        // Setup help dialog event listeners
        document.getElementById('startGameButton').addEventListener('click', () => {
            this.hideHelpDialog();
        });
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    setCookie(name, value, days = 365) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    }

    showHelpDialog() {
        document.getElementById('helpDialog').style.display = 'block';
        this.gameStarted = false;
    }

    hideHelpDialog() {
        const dontShowAgain = document.getElementById('dontShowAgain').checked;
        if (dontShowAgain) {
            this.setCookie('hideHelpDialog', 'true');
        }
        document.getElementById('helpDialog').style.display = 'none';
        this.gameStarted = true;
    }

    setupEventListeners() {
        const canvas = this.uiManager.canvas;
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('resize', () => this.handleResize());
    }

    handleCanvasClick(e) {
        if (this.isGameOver || !this.gameStarted) return;
        this.handleDropAction();
    }

    handleDropAction() {
        if (!this.isObjectConfirmed) {
            // First step: Confirm the object
            this.isObjectConfirmed = true;
            // Freeze the current camera image
            if (this.cameraManager.extractedPersonImage) {
                this.cameraManager.frozenPersonImage = this.cameraManager.extractedPersonImage;
            }
            if (this.cameraManager.personVertices) {
                this.cameraManager.frozenPersonVertices = JSON.parse(JSON.stringify(this.cameraManager.personVertices));
            }
        } else {
            // Second step: Drop the object
            const currentTime = Date.now();
            if (currentTime - this.lastDropTime < DROP_COOLDOWN) {
                return;
            }
            
            this.dropCharacter(this.dropX, this.dropY - this.cameraOffset);
            this.lastDropTime = currentTime;
            this.isObjectConfirmed = false; // Reset for next object
        }
    }

    dropCharacter(x, y) {
        const body = this.physicsManager.createCharacter(x, y, this.selectedCharacter, this.currentRotation);
        this.gameObjects.push(body);
        this.objectCount++;
        this.lastDroppedObject = body;

        if (this.gameStartTime === null) {
            this.gameStartTime = Date.now();
        }
    }


    handleKeyDown(e) {
        if (!this.gameStarted) return;
        
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.currentRotation = (this.currentRotation + Math.PI / 4) % (Math.PI * 2);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.currentRotation = (this.currentRotation - Math.PI / 4 + Math.PI * 2) % (Math.PI * 2);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const playAreaLeft = (this.uiManager.canvas.width - this.uiManager.canvas.width * 0.5) / 2;
            this.dropX = Math.max(playAreaLeft + 30, this.dropX - 20);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const playAreaRight = (this.uiManager.canvas.width + this.uiManager.canvas.width * 0.5) / 2;
            this.dropX = Math.min(playAreaRight - 30, this.dropX + 20);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.handleDropAction();
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            this.takeScreenshot();
        }
    }

    takeScreenshot(isGameOver = false) {
        const canvas = this.uiManager.canvas;
        const link = document.createElement('a');
        
        // Generate filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const prefix = isGameOver ? 'gameover' : 'screenshot';
        const filename = `human-tower-${prefix}-${timestamp}.png`;
        
        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log(`Screenshot saved as: ${filename}`);
        }, 'image/png');
    }

    handleResize() {
        this.uiManager.resizeCanvas();
        this.physicsManager.createGround();
        this.initializeDropPosition();
    }

    checkGameOver() {
        const groundY = this.physicsManager.ground.position.y;
        const platformWidth = this.uiManager.canvas.width * 0.5;
        const platformLeft = (this.uiManager.canvas.width - platformWidth) / 2;
        const platformRight = platformLeft + platformWidth;

        for (let i = this.gameObjects.length - 1; i >= 0; i--) {
            const obj = this.gameObjects[i];
            const fellOffSide = (obj.position.x < platformLeft - 50 || obj.position.x > platformRight + 50) && obj.position.y > groundY - 100;
            const fellOffBottom = obj.position.y > this.uiManager.canvas.height + 100;

            if (fellOffSide || fellOffBottom) {
                this.physicsManager.removeObject(obj);
                this.gameObjects.splice(i, 1);

                if (!this.isGameOver) {
                    this.triggerGameOver();
                    break;
                }
            }
        }
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.showGameOverScreen = true;

        let timeString = '0:00';
        if (this.gameStartTime !== null) {
            const elapsedSeconds = Math.floor((Date.now() - this.gameStartTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        this.finalStats = {
            objects: this.objectCount,
            time: timeString,
            height: this.maxHeightPixels
        };

        // Auto-screenshot after game over screen is rendered
        setTimeout(() => {
            this.takeScreenshot(true);
        }, 1000);
    }

    updateCamera() {
        const groundY = this.physicsManager.ground.position.y - 25;
        let highestY = groundY;
        let maxObjectHeight = 0;

        if (this.gameObjects.length > 0) {
            this.gameObjects.forEach(obj => {
                let objHighestY = obj.vertices.reduce((min, v) => Math.min(min, v.y), obj.vertices[0].y);
                const objectHeightFromGround = Math.max(0, Math.round(groundY - objHighestY));
                maxObjectHeight = Math.max(maxObjectHeight, objectHeightFromGround);
                highestY = Math.min(highestY, objHighestY);
            });
        }

        this.maxHeightPixels = maxObjectHeight;
        const targetOffset = Math.max(0, this.uiManager.canvas.height - highestY - 200);
        this.cameraOffset += (targetOffset - this.cameraOffset) * 0.05;
    }

    resetGame() {
        this.physicsManager.clear();
        this.initializeGameState();
        this.uiManager.updateCharacterSelectUI(this.characterShapes);
    }

    gameLoop() {
        this.physicsManager.update();
        this.updateCamera();
        this.checkGameOver();
        this.uiManager.render();

        requestAnimationFrame(() => this.gameLoop());
    }
}
