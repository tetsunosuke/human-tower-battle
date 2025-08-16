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
        this.loadAssets();
        this.setupEventListeners();

        this.gameLoop();
    }

    initializeGameState() {
        this.objectCount = 0;
        this.gameStartTime = null;
        this.maxHeightPixels = 0;
        this.selectedCharacter = 0;
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
        this.showPreview = false;

        this.characterShapes = [];
        this.characterImages = [];
    }

    async loadAssets() {
        await this.loadCharacterImages();
        this.uiManager.updateCharacterSelectUI(this.characterShapes);
    }

    async loadCharacterImages() {
        for (let i = 1; i <= MAX_CHARACTERS; i++) {
            const imagePath = `assets/character${i}.svg`;
            if (await checkImageExists(imagePath)) {
                const shape = {
                    image: imagePath,
                    width: CHARACTER_IMAGE_SETTINGS.height, // Initial value
                    height: CHARACTER_IMAGE_SETTINGS.height, // Initial value
                    name: CHARACTER_NAMES[i - 1] || `キャラクター ${i}`,
                    index: i - 1
                };
                this.characterShapes.push(shape);
                await this.loadSingleCharacterImage(shape, this.characterShapes.length - 1);
            } else if (i > 5) {
                break; // Stop if we miss a few
            }
        }

        const cameraShape = { 
            image: null, 
            width: 30, 
            height: 60, 
            isCamera: true, 
            name: 'カメラ',
            index: this.characterShapes.length
        };
        this.characterShapes.push(cameraShape);
        this.characterImages.push(null);
    }

    loadSingleCharacterImage(shape, index) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = shape.image;
            img.onload = () => {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                shape.width = CHARACTER_IMAGE_SETTINGS.height * aspectRatio;
                shape.height = CHARACTER_IMAGE_SETTINGS.height;
                this.characterImages[index] = img;
                resolve();
            };
            img.onerror = () => {
                this.characterImages[index] = null;
                resolve();
            };
        });
    }

    setupEventListeners() {
        const canvas = this.uiManager.canvas;
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseenter', () => this.showPreview = true);
        canvas.addEventListener('mouseleave', () => this.showPreview = false);
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('resize', () => this.handleResize());
    }

    handleCanvasClick(e) {
        if (this.isGameOver) return;

        const currentTime = Date.now();
        if (currentTime - this.lastDropTime < DROP_COOLDOWN) {
            return;
        }

        const rect = this.uiManager.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = Math.max(50, e.clientY - rect.top);

        this.dropCharacter(x, y - this.cameraOffset);
        this.lastDropTime = currentTime;
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

    handleMouseMove(e) {
        const rect = this.uiManager.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    }

    handleKeyDown(e) {
        if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
            e.preventDefault();
            this.currentRotation = (this.currentRotation + Math.PI / 4) % (Math.PI * 2);
        }
    }

    handleResize() {
        this.uiManager.resizeCanvas();
        this.physicsManager.createGround();
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
