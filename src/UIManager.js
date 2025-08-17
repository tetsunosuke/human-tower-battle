export class UIManager {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.characterSelect = document.getElementById('characterSelect');
        this.cameraButton = document.getElementById('charCamera');

        this.resizeCanvas();
        this.setupUIEventListeners();
    }

    setupUIEventListeners() {
        document.getElementById('resetButton').addEventListener('click', () => this.game.resetGame());
    }

    updateCharacterSelectUI(characterShapes) {
        const existingButtons = this.characterSelect.querySelectorAll('.character-button:not(.camera-button)');
        existingButtons.forEach(button => button.remove());

        // Only show camera button, no asset-based characters
        this.setupCameraButtonEvents();
        
        // Auto-select camera button
        this.cameraButton.classList.add('selected');
    }


    setupCameraButtonEvents() {
        const newCameraButton = this.cameraButton.cloneNode(true);
        this.cameraButton.parentNode.replaceChild(newCameraButton, this.cameraButton);
        this.cameraButton = newCameraButton;

        this.cameraButton.addEventListener('click', () => {
            document.querySelectorAll('.character-button').forEach(b => b.classList.remove('selected'));
            this.cameraButton.classList.add('selected');
            this.game.selectedCharacter = 'camera';
            console.log('Selected camera character');

            if (this.game.cameraManager.extractedPersonImage) {
                this.game.cameraManager.frozenPersonImage = this.game.cameraManager.extractedPersonImage;
            }
            if (this.game.cameraManager.personVertices) {
                this.game.cameraManager.frozenPersonVertices = JSON.parse(JSON.stringify(this.game.cameraManager.personVertices));
            }
        });
    }

    updateDetectedPeopleUI(detectedPeople) {
        const container = document.getElementById('detectedObjects');
        container.innerHTML = '<div>検出された人:</div>';

        if (detectedPeople.length > 0) {
            this.cameraButton.style.display = 'block';
            this.cameraButton.textContent = '🧑';
            this.updateCameraButtonBackground();

            detectedPeople.forEach((person, index) => {
                const div = document.createElement('div');
                div.className = 'detected-person';
                div.textContent = `人物 ${index + 1} (${Math.round(person.confidence * 100)}%)`;
                container.appendChild(div);
            });
        } else {
            if (!this.game.cameraManager.frozenPersonImage) {
                this.cameraButton.style.display = 'none';
                this.cameraButton.style.backgroundImage = '';
                // Keep camera selected since it's the only option
            } else {
                this.updateCameraButtonBackground();
            }
        }
    }

    updateCameraButtonBackground() {
        // Show live camera image until confirmed, then show frozen image
        const imageToShow = this.game.isObjectConfirmed ? 
            (this.game.cameraManager.frozenPersonImage || this.game.cameraManager.extractedPersonImage) :
            this.game.cameraManager.extractedPersonImage;
            
        if (imageToShow) {
            // Update button size based on person aspect ratio
            const personWidth = this.game.cameraManager.extractedPersonWidth || 80;
            const personHeight = this.game.cameraManager.extractedPersonHeight || 80;
            const aspectRatio = personWidth / personHeight;
            let width, height;
            if (aspectRatio > 1) {
                width = 80;
                height = 80 / aspectRatio;
            } else {
                width = 80 * aspectRatio;
                height = 80;
            }
            
            this.cameraButton.style.width = `${width}px`;
            this.cameraButton.style.height = `${height}px`;
            this.cameraButton.style.backgroundImage = `url(${imageToShow})`;
            this.cameraButton.style.backgroundSize = 'cover';
            this.cameraButton.style.backgroundPosition = 'center';
            this.cameraButton.textContent = '';
        } else {
            // Reset to default square size when no person detected
            this.cameraButton.style.width = '70px';
            this.cameraButton.style.height = '70px';
            this.cameraButton.style.backgroundImage = '';
            this.cameraButton.textContent = '🧑';
        }
    }

    drawScores() {
        const scoreY = 40;
        let timeString = '0:00';
        if (this.game.gameStartTime !== null) {
            const elapsedSeconds = Math.floor((Date.now() - this.game.gameStartTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        const scores = [
            `オブジェクト: ${this.game.objectCount}`,
            `時間: ${timeString}`,
            `高さ: ${this.game.maxHeightPixels}px`
        ];

        this.ctx.save();
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const totalWidth = scores.length * 150;
        const startX = (this.canvas.width - totalWidth) / 2;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(startX - 20, scoreY - 20, totalWidth + 40, 40);

        scores.forEach((score, index) => {
            const x = startX + (index + 0.5) * 150;
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(score, x, scoreY);
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(score, x, scoreY);
        });

        this.ctx.restore();
    }

    drawGameOverScreen() {
        if (!this.game.finalStats) return;

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('ゲームオーバー', centerX, centerY - 100);
        this.ctx.fillStyle = '#ff4444';
        this.ctx.fillText('ゲームオーバー', centerX, centerY - 100);

        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = 'white';

        const stats = [
            `オブジェクト: ${this.game.finalStats.objects}`,
            `時間: ${this.game.finalStats.time}`,
            `最大高度: ${this.game.finalStats.height}px`
        ];

        stats.forEach((stat, index) => {
            const y = centerY - 20 + (index * 40);
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(stat, centerX, y);
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(stat, centerX, y);
        });

        this.ctx.font = '18px Arial';
        this.ctx.fillStyle = '#cccccc';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText('「ゲームをリセット」で再挑戦', centerX, centerY + 120);
        this.ctx.fillText('「ゲームをリセット」で再挑戦', centerX, centerY + 120);

        this.ctx.restore();
    }

    drawPreview() {
        this.ctx.save();
        // Different opacity for confirmed vs unconfirmed objects
        this.ctx.globalAlpha = this.game.isObjectConfirmed ? 0.9 : 0.6;
        this.ctx.translate(this.game.dropX, this.game.dropY + this.game.cameraOffset);
        this.ctx.rotate(this.game.currentRotation);

        const characterType = this.game.selectedCharacter;
        if (characterType === 'camera') {
            this.drawCameraPreview();
        }

        this.ctx.restore();
    }

    drawCameraPreview() {
        const personImage = this.game.cameraManager.frozenPersonImage || this.game.cameraManager.extractedPersonImage;
        if (personImage) {
            if (!this.previewPersonImageElement) {
                this.previewPersonImageElement = new Image();
            }
            if (this.previewPersonImageElement.src !== personImage) {
                this.previewPersonImageElement.src = personImage;
            }

            if (this.previewPersonImageElement.complete) {
                const personWidth = this.game.cameraManager.extractedPersonWidth || 80;
                const personHeight = this.game.cameraManager.extractedPersonHeight || 80;
                const aspectRatio = personWidth / personHeight;
                let width, height;
                if (aspectRatio > 1) {
                    width = 80;
                    height = 80 / aspectRatio;
                } else {
                    width = 80 * aspectRatio;
                    height = 80;
                }
                this.ctx.drawImage(this.previewPersonImageElement, -width / 2, -height / 2, width, height);
                this.drawRotationAngle(height / 2 + 15);
            }
        } else {
            this.ctx.fillStyle = 'rgba(100, 100, 100, 0.6)';
            this.ctx.fillRect(-40, -40, 80, 80);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('📷', 0, 8);
        }
    }


    drawRotationAngle(yOffset) {
        if (this.game.currentRotation !== 0) {
            this.ctx.globalAlpha = 0.8;
            this.ctx.fillStyle = 'white';
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 1;
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            const degrees = Math.round(this.game.currentRotation * 180 / Math.PI);
            this.ctx.strokeText(`${degrees}°`, 0, yOffset);
            this.ctx.fillText(`${degrees}°`, 0, yOffset);
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(0, this.game.cameraOffset);

        this.drawGround();
        this.drawPlayAreaBoundaries();
        this.drawGameObjects();

        this.ctx.restore();

        this.drawScores();

        if (this.game.showGameOverScreen) {
            this.drawGameOverScreen();
        }

        if (this.game.showPreview && !this.game.isGameOver) {
            this.drawPreview();
        }

        // Update camera button background in real-time
        this.updateCameraButtonBackground();

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, 2);
    }

    drawGround() {
        const ground = this.game.physicsManager.ground;
        const groundWidth = this.canvas.width * 0.5;
        const groundX = (this.canvas.width - groundWidth) / 2;
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(groundX, ground.position.y - 25, groundWidth, 50);
    }

    drawPlayAreaBoundaries() {
        const groundWidth = this.canvas.width * 0.5;
        const groundX = (this.canvas.width - groundWidth) / 2;
        const groundY = this.game.physicsManager.ground.position.y;
        
        // Draw left and right boundaries
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 10]);
        
        // Left boundary
        this.ctx.beginPath();
        this.ctx.moveTo(groundX, 0);
        this.ctx.lineTo(groundX, groundY + 25);
        this.ctx.stroke();
        
        // Right boundary
        this.ctx.beginPath();
        this.ctx.moveTo(groundX + groundWidth, 0);
        this.ctx.lineTo(groundX + groundWidth, groundY + 25);
        this.ctx.stroke();
        
        // Reset line dash
        this.ctx.setLineDash([]);
    }

    drawGameObjects() {
        this.game.gameObjects.forEach(obj => {
            const { x, y } = obj.position;
            const angle = obj.angle;

            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(angle);

            if (obj.isPersonImage && obj.personImage) {
                this.drawPersonImage(obj);
            } else {
                this.drawCharacterImage(obj);
            }

            this.ctx.restore();
        });
    }

    drawPersonImage(obj) {
        if (!obj.imageElement) {
            obj.imageElement = new Image();
            obj.imageElement.src = obj.personImage;
        }

        if (obj.imageElement.complete) {
            const shape = obj.shape;
            this.ctx.drawImage(obj.imageElement, -shape.width / 2, -shape.height / 2, shape.width, shape.height);
        } else {
            this.drawCharacterImage(obj); // Fallback
        }
    }

    drawCharacterImage(obj) {
        const shape = obj.shape;
        this.ctx.fillStyle = '#FF6B6B';
        this.ctx.fillRect(-shape.width / 2, -shape.height / 2, shape.width, shape.height);
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
}
