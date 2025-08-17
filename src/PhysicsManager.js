import { GRAVITY, GROUND_COLOR } from './config.js';

export class PhysicsManager {
    constructor(game) {
        this.game = game;
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        this.engine.world.gravity.y = GRAVITY;

        this.createGround();
    }

    createGround() {
        if (this.ground) {
            Matter.World.remove(this.world, this.ground);
        }

        const ground = Matter.Bodies.rectangle(
            this.game.uiManager.canvas.width / 2,
            this.game.uiManager.canvas.height - 25,
            this.game.uiManager.canvas.width * 0.5,
            50,
            { isStatic: true, render: { fillStyle: GROUND_COLOR } }
        );

        Matter.World.add(this.world, ground);
        this.ground = ground;
    }

    createCharacter(x, y, characterType, rotation) {
        // Only camera characters are supported now
        const body = this.createCameraCharacter(x, y, rotation);

        body.characterType = characterType;
        body.createdAt = Date.now();

        if (this.game.cameraManager.frozenPersonImage || this.game.cameraManager.extractedPersonImage) {
            body.personImage = this.game.cameraManager.frozenPersonImage || this.game.cameraManager.extractedPersonImage;
            body.isPersonImage = true;
        }

        if (rotation !== 0) {
            Matter.Body.setAngle(body, rotation);
        }

        Matter.World.add(this.world, body);
        return body;
    }


    createCameraCharacter(x, y, rotation) {
        const cameraManager = this.game.cameraManager;
        let body;

        if (cameraManager.frozenPersonImage && cameraManager.extractedPersonWidth && cameraManager.extractedPersonHeight) {
            // Use the same size calculation as preview to ensure consistency
            const personWidth = cameraManager.extractedPersonWidth || 80;
            const personHeight = cameraManager.extractedPersonHeight || 80;
            const aspectRatio = personWidth / personHeight;
            let width, height;
            if (aspectRatio > 1) {
                width = 80;
                height = 80 / aspectRatio;
            } else {
                width = 80 * aspectRatio;
                height = 80;
            }
            const shape = {
                width: width,
                height: height,
            };

            if (cameraManager.frozenPersonVertices && cameraManager.frozenPersonVertices.length >= 3) {
                try {
                    body = Matter.Bodies.fromVertices(x, y, cameraManager.frozenPersonVertices, {
                        restitution: 0.3,
                        friction: 0.8,
                        density: 0.001,
                    });
                } catch (error) {
                    console.warn('Failed to create character from vertices, falling back to rectangle:', error);
                    body = Matter.Bodies.rectangle(x, y, shape.width, shape.height, { restitution: 0.3, friction: 0.8, density: 0.001 });
                }
            } else {
                body = Matter.Bodies.rectangle(x, y, shape.width, shape.height, { restitution: 0.3, friction: 0.8, density: 0.001 });
            }
            body.shape = shape; // Attach shape info for rendering
        } else {
            // Fallback for camera character
            const shape = { width: 80, height: 80 };
            body = Matter.Bodies.rectangle(x, y, shape.width, shape.height, { restitution: 0.3, friction: 0.8, density: 0.001 });
            body.shape = shape;
        }
        return body;
    }

    update() {
        Matter.Engine.update(this.engine);
    }

    removeObject(obj) {
        Matter.World.remove(this.world, obj);
    }

    clear() {
        this.game.gameObjects.forEach(obj => {
            this.removeObject(obj);
        });
    }
}
