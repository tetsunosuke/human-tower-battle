import { BODY_PIX_CONFIG, CAMERA_CONFIG } from './config.js';

export class CameraManager {
    constructor(game) {
        this.game = game;
        this.cameraVideo = document.getElementById('cameraVideo');
        this.cameraCanvas = document.getElementById('cameraCanvas');
        this.cameraCtx = this.cameraCanvas.getContext('2d', { willReadFrequently: true });

        this.bodyPixModel = null;
        this.isCameraActive = false;
        this.detectedPeople = [];
        this.extractedPersonImage = null;
        this.frozenPersonImage = null;
        this.personVertices = null;
        this.frozenPersonVertices = null;
        this.extractedPersonWidth = 0;
        this.extractedPersonHeight = 0;

        // Multiple camera support
        this.availableCameras = [];
        this.currentCameraIndex = 0;
        this.currentStream = null;

        this.loadBodyPix();
        this.detectAvailableCameras();
    }

    async loadBodyPix() {
        try {
            this.bodyPixModel = await bodyPix.load(BODY_PIX_CONFIG);
            console.log('BodyPix model loaded');
            this.tryStartCamera();
        } catch (error) {
            console.error('Failed to load BodyPix model:', error);
        }
    }

    async detectAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableCameras = devices.filter(device => device.kind === 'videoinput');
            console.log(`Found ${this.availableCameras.length} camera(s):`, this.availableCameras);
            
            // Update UI with camera selection if multiple cameras available
            if (this.availableCameras.length > 1) {
                this.game.uiManager.createCameraSelector(this.availableCameras);
            }
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
        }
    }

    tryStartCamera() {
        // Automatically start the camera once the model is loaded
        setTimeout(() => {
            this.toggleCamera();
        }, 1000);
    }

    async toggleCamera() {
        if (!this.isCameraActive) {
            await this.startCamera(this.currentCameraIndex);
        } else {
            this.stopCamera();
        }
    }

    async startCamera(cameraIndex = 0) {
        try {
            // Stop current stream if active
            if (this.currentStream) {
                this.stopCamera();
            }

            const constraints = { 
                video: { 
                    width: CAMERA_CONFIG.width, 
                    height: CAMERA_CONFIG.height 
                } 
            };

            // If specific camera is selected and available
            if (this.availableCameras.length > cameraIndex) {
                constraints.video.deviceId = { exact: this.availableCameras[cameraIndex].deviceId };
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentStream = stream;
            this.cameraVideo.srcObject = stream;
            this.currentCameraIndex = cameraIndex;
            this.isCameraActive = true;
            this.startPersonDetection();
            
            console.log(`Started camera: ${this.availableCameras[cameraIndex]?.label || 'Default'}`);
        } catch (error) {
            console.error('Camera access denied:', error);
            alert('人物検出にはカメラへのアクセスが必要です');
        }
    }

    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        this.cameraVideo.srcObject = null;
        this.isCameraActive = false;
        this.detectedPeople = [];
        this.extractedPersonImage = null;
    }

    async switchCamera(cameraIndex) {
        if (cameraIndex !== this.currentCameraIndex && cameraIndex < this.availableCameras.length) {
            console.log(`Switching to camera ${cameraIndex}: ${this.availableCameras[cameraIndex].label}`);
            await this.startCamera(cameraIndex);
        }
    }

    startPersonDetection() {
        if (!this.bodyPixModel || !this.isCameraActive) return;

        const detect = async () => {
            if (!this.isCameraActive || this.cameraVideo.videoWidth === 0 || this.cameraVideo.readyState < 4) {
                requestAnimationFrame(detect);
                return;
            }

            try {
                const segmentation = await this.bodyPixModel.segmentPerson(this.cameraVideo, {
                    flipHorizontal: false,
                    internalResolution: 'medium',
                    segmentationThreshold: 0.5
                });
                this.processSegmentation(segmentation);
                this.game.uiManager.updateDetectedPeopleUI(this.detectedPeople);
            } catch (error) {
                console.error('Person detection error:', error);
            }
            if (this.isCameraActive) {
                requestAnimationFrame(detect);
            }
        };

        this.cameraVideo.addEventListener('loadeddata', detect);
    }

    processSegmentation(segmentation) {
        const { data, width, height } = segmentation;
        let personPixels = 0;
        let minX = width, maxX = 0, minY = height, maxY = 0;

        for (let i = 0; i < data.length; i++) {
            if (data[i] === 1) {
                personPixels++;
                const x = i % width;
                const y = Math.floor(i / width);
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }

        if (personPixels > 1000) {
            const personWidth = maxX - minX;
            const personHeight = maxY - minY;
            this.extractPersonImage(segmentation, minX, minY, personWidth, personHeight);
            this.detectedPeople = [{
                id: 'person_1',
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2,
                width: personWidth,
                height: personHeight,
                confidence: personPixels / (personWidth * personHeight)
            }];
        } else {
            this.detectedPeople = [];
            this.extractedPersonImage = null;
        }
    }

    extractPersonImage(segmentation, minX, minY, width, height) {
        const { data } = segmentation;
        const videoWidth = this.cameraVideo.videoWidth;
        const videoHeight = this.cameraVideo.videoHeight;

        this.cameraCanvas.width = videoWidth;
        this.cameraCanvas.height = videoHeight;
        this.cameraCtx.drawImage(this.cameraVideo, 0, 0, videoWidth, videoHeight);

        const extractCanvas = document.createElement('canvas');
        const extractCtx = extractCanvas.getContext('2d');
        extractCanvas.width = width;
        extractCanvas.height = height;

        const imageData = this.cameraCtx.getImageData(0, 0, videoWidth, videoHeight);
        const extractedData = extractCtx.createImageData(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const sourceX = minX + x;
                const sourceY = minY + y;
                if (sourceX < videoWidth && sourceY < videoHeight) {
                    const maskIndex = sourceY * videoWidth + sourceX;
                    const sourceIndex = (sourceY * videoWidth + sourceX) * 4;
                    const targetIndex = (y * width + x) * 4;
                    if (data[maskIndex] === 1) {
                        extractedData.data[targetIndex] = imageData.data[sourceIndex];
                        extractedData.data[targetIndex + 1] = imageData.data[sourceIndex + 1];
                        extractedData.data[targetIndex + 2] = imageData.data[sourceIndex + 2];
                        extractedData.data[targetIndex + 3] = 255;
                    } else {
                        extractedData.data[targetIndex + 3] = 0;
                    }
                }
            }
        }

        extractCtx.putImageData(extractedData, 0, 0);
        this.extractedPersonImage = extractCanvas.toDataURL();
        this.extractedPersonWidth = width;
        this.extractedPersonHeight = height;
        this.personVertices = this.extractPersonContour(segmentation, minX, minY, width, height);
    }

    extractPersonContour(segmentation, minX, minY, width, height) {
        const { data } = segmentation;
        const videoWidth = this.cameraVideo.videoWidth;
        const scale = 480 / height;
        const step = Math.max(1, Math.floor(Math.min(width, height) / 20));
        const vertices = [];

        // Simplified contour extraction
        for (let x = 0; x < width; x += step) {
            for (let y = 0; y < height; y++) {
                if (data[(minY + y) * videoWidth + (minX + x)] === 1) {
                    vertices.push({ x: (x - width / 2) * scale, y: (y - height / 2) * scale });
                    break;
                }
            }
        }
        for (let y = 0; y < height; y += step) {
            for (let x = width - 1; x >= 0; x--) {
                if (data[(minY + y) * videoWidth + (minX + x)] === 1) {
                    vertices.push({ x: (x - width / 2) * scale, y: (y - height / 2) * scale });
                    break;
                }
            }
        }
        for (let x = width - 1; x >= 0; x -= step) {
            for (let y = height - 1; y >= 0; y--) {
                if (data[(minY + y) * videoWidth + (minX + x)] === 1) {
                    vertices.push({ x: (x - width / 2) * scale, y: (y - height / 2) * scale });
                    break;
                }
            }
        }
        for (let y = height - 1; y >= 0; y -= step) {
            for (let x = 0; x < width; x++) {
                if (data[(minY + y) * videoWidth + (minX + x)] === 1) {
                    vertices.push({ x: (x - width / 2) * scale, y: (y - height / 2) * scale });
                    break;
                }
            }
        }

        return vertices.length >= 3 ? vertices : null;
    }
}
