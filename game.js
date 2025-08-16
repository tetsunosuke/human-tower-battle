class HumanTowerBattle {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.cameraVideo = document.getElementById('cameraVideo');
        this.cameraCanvas = document.getElementById('cameraCanvas');
        this.cameraCtx = this.cameraCanvas.getContext('2d');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.setupPhysics();
        this.setupCamera();
        this.setupUI();
        
        this.objectCount = 0; // 落としたオブジェクトの個数
        this.gameStartTime = null; // 最初のオブジェクト落下時刻
        this.maxHeightPixels = 0; // 最高点の高さ（ピクセル）
        this.selectedCharacter = 0;
        this.gameObjects = [];
        this.cameraOffset = 0;
        this.isGameOver = false;
        this.showGameOverScreen = false;
        this.finalStats = null;
        this.lastDropTime = 0; // 最後のオブジェクト落下時刻
        this.dropCooldown = 1000; // 落下間隔制限（ミリ秒）
        this.lastDroppedObject = null; // 最後に落としたオブジェクト
        
        // プレビューと回転機能
        this.mouseX = 0;
        this.mouseY = 0;
        this.currentRotation = 0; // 現在の回転角度（ラジアン）
        this.showPreview = false;
        
        // 動的にキャラクター画像を読み込み
        this.characterShapes = [];
        this.characterImages = [];
        this.loadCharacterImagesFromAssets();
        
        this.bodyPixModel = null;
        this.isCameraActive = false;
        this.detectedPeople = [];
        this.extractedPersonImage = null;
        this.frozenPersonImage = null;
        this.personVertices = null;
        this.frozenPersonVertices = null;
        
        this.loadBodyPix();
        this.gameLoop();
        
        // アプリケーション開始時にカメラを自動で開始
        setTimeout(() => {
            this.toggleCamera();
        }, 1000);
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.cameraCanvas.width = 200;
        this.cameraCanvas.height = 150;
        
        if (this.ground) {
            this.createGround();
        }
    }
    
    setupPhysics() {
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        this.engine.world.gravity.y = 0.8;
        
        this.createGround();
        this.canvas.addEventListener('click', (e) => this.dropCharacter(e));
        
        // マウスイベントリスナーを追加
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseenter', () => this.showPreview = true);
        this.canvas.addEventListener('mouseleave', () => this.showPreview = false);
        
        // キーボードイベントリスナーを追加（回転用）
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    createGround() {
        if (this.ground) {
            Matter.World.remove(this.world, this.ground);
        }
        
        const ground = Matter.Bodies.rectangle(
            this.canvas.width / 2,
            this.canvas.height - 25,
            this.canvas.width * 0.5,
            50,
            { isStatic: true, render: { fillStyle: '#8B4513' } }
        );
        
        Matter.World.add(this.world, ground);
        this.ground = ground;
    }
    
    async loadCharacterImagesFromAssets() {
        const maxCharacters = 20; // 最大検索数
        const characterNames = ['Standing', 'Walking', 'Running', 'Jumping', 'Meditating', 'Sitting', 'Dancing', 'Sleeping', 'Working', 'Playing'];
        
        // 連番でファイルを試行し、存在するファイルのみを読み込み
        for (let i = 1; i <= maxCharacters; i++) {
            const imagePath = `assets/character${i}.svg`;
            
            try {
                const exists = await this.checkImageExists(imagePath);
                if (exists) {
                    const shape = {
                        image: imagePath,
                        width: 60, // 初期値（後で更新）
                        height: 60, // 初期値（後で更新）
                        name: characterNames[i - 1] || `Character ${i}`,
                        index: i - 1
                    };
                    
                    this.characterShapes.push(shape);
                    await this.loadSingleCharacterImage(shape, this.characterShapes.length - 1);
                } else {
                    // 連続で存在しないファイルが見つかったら終了
                    if (i <= 5) {
                        console.warn(`Character image ${i} not found: ${imagePath}`);
                    } else {
                        break;
                    }
                }
            } catch (error) {
                console.error(`Error checking character image ${i}:`, error);
                break;
            }
        }
        
        // カメラキャラクターを追加
        const cameraShape = { 
            image: null, 
            width: 30, 
            height: 60, 
            isCamera: true, 
            name: 'Camera',
            index: this.characterShapes.length
        };
        this.characterShapes.push(cameraShape);
        this.characterImages.push(null);
        
        console.log(`Loaded ${this.characterShapes.length - 1} character images`);
        
        // UIを更新
        this.updateCharacterSelectUI();
    }
    
    checkImageExists(imagePath) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = imagePath;
        });
    }
    
    loadSingleCharacterImage(shape, index) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = shape.image;
            img.onload = () => {
                // 画像読み込み完了時に実際のアスペクト比を計算
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                const targetHeight = 60; // 基準の高さ
                const targetWidth = targetHeight * aspectRatio;
                
                // シェイプ情報を更新
                shape.width = targetWidth;
                shape.height = targetHeight;
                shape.aspectRatio = aspectRatio;
                
                this.characterImages[index] = img;
                
                console.log(`Character image ${index + 1} loaded: ${shape.name} (${img.naturalWidth}x${img.naturalHeight}, aspect: ${aspectRatio.toFixed(2)})`);
                resolve();
            };
            img.onerror = () => {
                console.error(`Failed to load character image ${index + 1}: ${shape.image}`);
                this.characterImages[index] = null;
                resolve();
            };
        });
    }
    
    updateCharacterSelectUI() {
        const characterSelect = document.getElementById('characterSelect');
        const existingButtons = characterSelect.querySelectorAll('.character-button:not(.camera-button)');
        
        // 既存のボタンを削除
        existingButtons.forEach(button => button.remove());
        
        // 新しいボタンを作成
        this.characterShapes.forEach((shape, index) => {
            if (!shape.isCamera) {
                const button = document.createElement('div');
                button.className = 'character-button';
                button.setAttribute('data-character', index);
                button.id = `char${index}`;
                
                if (shape.image) {
                    const img = document.createElement('img');
                    img.src = shape.image;
                    img.alt = shape.name;
                    button.appendChild(img);
                } else {
                    button.textContent = shape.name;
                }
                
                // クリックイベントを追加
                button.addEventListener('click', () => {
                    // 全てのボタンから選択状態を削除
                    document.querySelectorAll('.character-button').forEach(b => b.classList.remove('selected'));
                    // クリックしたボタンを選択状態にする
                    button.classList.add('selected');
                    
                    // 選択したキャラクターを設定
                    this.selectedCharacter = index;
                    console.log(`Selected character ${index}: ${shape.name}`);
                });
                
                // カメラボタンの前に挿入
                const cameraButton = document.getElementById('charCamera');
                characterSelect.insertBefore(button, cameraButton);
                
                // 最初のボタンを選択状態にする
                if (index === 0) {
                    button.classList.add('selected');
                }
            }
        });
        
        // 既存のUIセットアップを再実行（カメラボタン用）
        this.setupCameraButtonEvents();
    }

    async loadBodyPix() {
        try {
            this.bodyPixModel = await bodyPix.load({
                architecture: 'MobileNetV1',
                outputStride: 16,
                multiplier: 0.5,
                quantBytes: 2
            });
            console.log('BodyPix model loaded');
        } catch (error) {
            console.error('Failed to load BodyPix model:', error);
        }
    }
    
    async setupCamera() {
        // カメラの初期化のみ
    }
    
    async toggleCamera() {
        if (!this.isCameraActive) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                });
                this.cameraVideo.srcObject = stream;
                this.isCameraActive = true;
                this.startPersonDetection();
            } catch (error) {
                console.error('Camera access denied:', error);
                alert('Camera access is required for person detection');
            }
        }
    }
    
    async startPersonDetection() {
        if (!this.bodyPixModel || !this.isCameraActive) return;
        
        const detectPeople = async () => {
            if (!this.isCameraActive || this.cameraVideo.videoWidth === 0 || this.cameraVideo.readyState !== 4) {
                setTimeout(detectPeople, 100);
                return;
            }
            
            try {
                const segmentation = await this.bodyPixModel.segmentPerson(this.cameraVideo, {
                    flipHorizontal: false,
                    internalResolution: 'medium',
                    segmentationThreshold: 0.5
                });
                
                this.processSegmentation(segmentation);
                this.updateDetectedPeopleUI();
                
                if (this.isCameraActive) {
                    requestAnimationFrame(detectPeople);
                }
            } catch (error) {
                console.error('Person detection error:', error);
                if (this.isCameraActive) {
                    setTimeout(detectPeople, 1000);
                }
            }
        };
        
        this.cameraVideo.addEventListener('loadeddata', () => {
            setTimeout(detectPeople, 1000);
        });
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
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const personWidth = maxX - minX;
            const personHeight = maxY - minY;
            
            // 人物画像を抽出
            this.extractPersonImage(segmentation, minX, minY, personWidth, personHeight);
            
            this.detectedPeople = [{
                id: 'person_1',
                x: centerX,
                y: centerY,
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
        
        // キャンバスに現在のビデオフレームを描画
        this.cameraCanvas.width = videoWidth;
        this.cameraCanvas.height = videoHeight;
        this.cameraCtx.drawImage(this.cameraVideo, 0, 0, videoWidth, videoHeight);
        
        // 人物部分のみを抽出するための新しいキャンバス
        const extractCanvas = document.createElement('canvas');
        const extractCtx = extractCanvas.getContext('2d');
        extractCanvas.width = width;
        extractCanvas.height = height;
        
        const imageData = this.cameraCtx.getImageData(0, 0, videoWidth, videoHeight);
        const extractedData = extractCtx.createImageData(width, height);
        
        // セグメンテーションマスクを使用して人物部分のみコピー
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const sourceX = minX + x;
                const sourceY = minY + y;
                
                if (sourceX < videoWidth && sourceY < videoHeight) {
                    const maskIndex = sourceY * videoWidth + sourceX;
                    const sourceIndex = (sourceY * videoWidth + sourceX) * 4;
                    const targetIndex = (y * width + x) * 4;
                    
                    if (data[maskIndex] === 1) { // 人物部分の場合
                        extractedData.data[targetIndex] = imageData.data[sourceIndex];     // R
                        extractedData.data[targetIndex + 1] = imageData.data[sourceIndex + 1]; // G
                        extractedData.data[targetIndex + 2] = imageData.data[sourceIndex + 2]; // B
                        extractedData.data[targetIndex + 3] = 255; // A (不透明)
                    } else {
                        // 背景部分は透明にする
                        extractedData.data[targetIndex + 3] = 0;
                    }
                }
            }
        }
        
        extractCtx.putImageData(extractedData, 0, 0);
        this.extractedPersonImage = extractCanvas.toDataURL();
        this.extractedPersonWidth = width;
        this.extractedPersonHeight = height;
        
        // 人物の輪郭を抽出
        this.personVertices = this.extractPersonContour(segmentation, minX, minY, width, height);
    }
    
    extractPersonContour(segmentation, minX, minY, width, height) {
        const { data } = segmentation;
        const videoWidth = this.cameraVideo.videoWidth;
        const scale = 60 / height; // 物理エンジン用のスケール（高さ60pxに正規化）
        
        // 簡略化された輪郭点を抽出（パフォーマンスのため）
        const step = Math.max(1, Math.floor(Math.min(width, height) / 20)); // 適度な解像度
        const vertices = [];
        
        // 上端の輪郭を抽出
        for (let x = 0; x < width; x += step) {
            for (let y = 0; y < height; y++) {
                const sourceX = minX + x;
                const sourceY = minY + y;
                if (sourceX < videoWidth && sourceY < this.cameraVideo.videoHeight) {
                    const maskIndex = sourceY * videoWidth + sourceX;
                    if (data[maskIndex] === 1) {
                        vertices.push({
                            x: (x - width/2) * scale,
                            y: (y - height/2) * scale
                        });
                        break;
                    }
                }
            }
        }
        
        // 右端の輪郭を抽出
        for (let y = 0; y < height; y += step) {
            for (let x = width - 1; x >= 0; x--) {
                const sourceX = minX + x;
                const sourceY = minY + y;
                if (sourceX < videoWidth && sourceY < this.cameraVideo.videoHeight) {
                    const maskIndex = sourceY * videoWidth + sourceX;
                    if (data[maskIndex] === 1) {
                        vertices.push({
                            x: (x - width/2) * scale,
                            y: (y - height/2) * scale
                        });
                        break;
                    }
                }
            }
        }
        
        // 下端の輪郭を抽出
        for (let x = width - 1; x >= 0; x -= step) {
            for (let y = height - 1; y >= 0; y--) {
                const sourceX = minX + x;
                const sourceY = minY + y;
                if (sourceX < videoWidth && sourceY < this.cameraVideo.videoHeight) {
                    const maskIndex = sourceY * videoWidth + sourceX;
                    if (data[maskIndex] === 1) {
                        vertices.push({
                            x: (x - width/2) * scale,
                            y: (y - height/2) * scale
                        });
                        break;
                    }
                }
            }
        }
        
        // 左端の輪郭を抽出
        for (let y = height - 1; y >= 0; y -= step) {
            for (let x = 0; x < width; x++) {
                const sourceX = minX + x;
                const sourceY = minY + y;
                if (sourceX < videoWidth && sourceY < this.cameraVideo.videoHeight) {
                    const maskIndex = sourceY * videoWidth + sourceX;
                    if (data[maskIndex] === 1) {
                        vertices.push({
                            x: (x - width/2) * scale,
                            y: (y - height/2) * scale
                        });
                        break;
                    }
                }
            }
        }
        
        // 最低3点は必要（三角形）
        if (vertices.length < 3) {
            return null;
        }
        
        return vertices;
    }
    
    updateDetectedPeopleUI() {
        const container = document.getElementById('detectedObjects');
        container.innerHTML = '<div>Detected People:</div>';
        
        const cameraButton = document.getElementById('charCamera');
        
        if (this.detectedPeople.length > 0) {
            // カメラで人物が検出された場合、カメラキャラクターボタンを表示
            cameraButton.style.display = 'block';
            cameraButton.textContent = '🧑';
            
            // リアルタイムで抽出された人物画像を更新（プレビュー目的）
            if (this.extractedPersonImage && !this.frozenPersonImage) {
                this.extractedPersonImage = this.extractedPersonImage;
            }
            
            // カメラボタンの背景表示を更新
            this.updateCameraButtonBackground();
            
            this.detectedPeople.forEach((person, index) => {
                const div = document.createElement('div');
                div.className = 'detected-person';
                div.textContent = `Person ${index + 1} (${Math.round(person.confidence * 100)}%)`;
                div.addEventListener('click', () => this.dropDetectedPerson(person));
                container.appendChild(div);
            });
        } else {
            // 人物が検出されていない場合の処理
            if (!this.frozenPersonImage) {
                // 静止画像が保存されていない場合のみボタンを非表示
                cameraButton.style.display = 'none';
                cameraButton.style.backgroundImage = '';
                if (this.selectedCharacter === 'camera') {
                    // カメラキャラクターが選択されていた場合、デフォルトに戻す
                    this.selectedCharacter = 0;
                    document.querySelectorAll('.character-button').forEach(b => b.classList.remove('selected'));
                    document.getElementById('char0').classList.add('selected');
                }
            } else {
                // 静止画像が保存されている場合はボタンを表示し続ける
                this.updateCameraButtonBackground();
            }
        }
    }
    
    updateCameraButtonBackground() {
        const cameraButton = document.getElementById('charCamera');
        
        // 静止画像が保存されている場合はそれを表示、そうでなければリアルタイム画像を表示
        const imageToShow = this.frozenPersonImage || this.extractedPersonImage;
        
        if (imageToShow) {
            cameraButton.style.backgroundImage = `url(${imageToShow})`;
            cameraButton.style.backgroundSize = 'cover';
            cameraButton.style.backgroundPosition = 'center';
            cameraButton.textContent = ''; // 絵文字を非表示にして画像を見えるようにする
        } else {
            cameraButton.style.backgroundImage = '';
            cameraButton.textContent = '🧑';
        }
    }
    
    setupUI() {
        this.setupCameraButtonEvents();
        document.getElementById('resetButton').addEventListener('click', () => this.resetGame());
    }
    
    setupCameraButtonEvents() {
        const cameraButton = document.getElementById('charCamera');
        if (cameraButton) {
            // 既存のイベントリスナーを削除
            cameraButton.replaceWith(cameraButton.cloneNode(true));
            const newCameraButton = document.getElementById('charCamera');
            
            newCameraButton.addEventListener('click', () => {
                // 全てのボタンから選択状態を削除
                document.querySelectorAll('.character-button').forEach(b => b.classList.remove('selected'));
                // カメラボタンを選択状態にする
                newCameraButton.classList.add('selected');
                
                this.selectedCharacter = 'camera';
                console.log('Selected camera character');
                
                // カメラボタンクリック時に現在の人物画像と輪郭データを静止画像として保存
                if (this.extractedPersonImage) {
                    this.frozenPersonImage = this.extractedPersonImage;
                }
                if (this.personVertices) {
                    this.frozenPersonVertices = JSON.parse(JSON.stringify(this.personVertices)); // ディープコピー
                }
            });
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
    }
    
    handleKeyDown(e) {
        // Rキー またはスペースキーで回転
        if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
            e.preventDefault();
            this.currentRotation += Math.PI / 4; // 45度回転
            if (this.currentRotation >= Math.PI * 2) {
                this.currentRotation = 0; // 360度で0に戻す
            }
            console.log(`Rotation: ${Math.round(this.currentRotation * 180 / Math.PI)}°`);
        }
    }
    
    dropCharacter(e) {
        if (this.isGameOver) return;
        
        // 落下間隔制限をチェック
        const currentTime = Date.now();
        if (currentTime - this.lastDropTime < this.dropCooldown) {
            console.log('Drop cooldown active. Please wait...');
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = Math.max(50, e.clientY - rect.top);
        
        // デバッグ出力
        console.log('Selected character:', this.selectedCharacter, 'Rotation:', Math.round(this.currentRotation * 180 / Math.PI) + '°');
        
        this.createCharacter(x, y - this.cameraOffset, this.selectedCharacter, this.currentRotation);
        this.lastDropTime = currentTime; // 落下時刻を記録
    }
    
    dropDetectedPerson(person) {
        if (this.isGameOver) return;
        
        // 落下間隔制限をチェック
        const currentTime = Date.now();
        if (currentTime - this.lastDropTime < this.dropCooldown) {
            console.log('Drop cooldown active. Please wait...');
            return;
        }
        
        const x = Math.random() * (this.canvas.width - 100) + 50;
        const y = 50 - this.cameraOffset;
        
        this.createCharacter(x, y, Math.floor(Math.random() * 5));
        this.lastDropTime = currentTime; // 落下時刻を記録
    }
    
    createCharacter(x, y, characterType, rotation = 0) {
        let actualCharacterType, shape;
        
        console.log('Creating character with type:', characterType);
        
        let body;
        
        if (characterType === 'camera' && this.frozenPersonImage && this.extractedPersonWidth && this.extractedPersonHeight) {
            // カメラキャラクターで静止画像が保存されている場合は実際の抽出画像サイズを使用
            actualCharacterType = 5;
            const aspectRatio = this.extractedPersonWidth / this.extractedPersonHeight;
            const targetHeight = 60; // 基準の高さ
            const targetWidth = targetHeight * aspectRatio;
            
            shape = {
                emoji: '🧑',
                width: targetWidth,
                height: targetHeight,
                actualWidth: this.extractedPersonWidth,
                actualHeight: this.extractedPersonHeight,
                isCamera: true
            };
            console.log('Using camera character with frozen image and aspect ratio:', shape);
            
            // 輪郭データがある場合は複合形状を作成、ない場合は長方形
            if (this.frozenPersonVertices && this.frozenPersonVertices.length >= 3) {
                try {
                    body = Matter.Bodies.fromVertices(x, y, this.frozenPersonVertices, {
                        restitution: 0.3,
                        friction: 0.8,
                        density: 0.001,
                        render: {
                            fillStyle: '#FF6B6B'
                        }
                    });
                    console.log('Created character with custom vertices:', this.frozenPersonVertices.length, 'points');
                } catch (error) {
                    console.warn('Failed to create character from vertices, falling back to rectangle:', error);
                    body = Matter.Bodies.rectangle(x, y, shape.width, shape.height, {
                        restitution: 0.3,
                        friction: 0.8,
                        density: 0.001,
                        render: {
                            fillStyle: '#FF6B6B'
                        }
                    });
                }
            } else {
                body = Matter.Bodies.rectangle(x, y, shape.width, shape.height, {
                    restitution: 0.3,
                    friction: 0.8,
                    density: 0.001,
                    render: {
                        fillStyle: '#FF6B6B'
                    }
                });
            }
        } else if (characterType === 'camera') {
            // フォールバック
            actualCharacterType = 5;
            shape = this.characterShapes[5];
            console.log('Using fallback camera character:', shape);
            
            body = Matter.Bodies.rectangle(x, y, shape.width, shape.height, {
                restitution: 0.3,
                friction: 0.8,
                density: 0.001,
                render: {
                    fillStyle: '#FF6B6B'
                }
            });
        } else {
            actualCharacterType = characterType;
            shape = this.characterShapes[characterType];
            console.log('Using regular character:', shape);
            
            body = Matter.Bodies.rectangle(x, y, shape.width, shape.height, {
                restitution: 0.3,
                friction: 0.8,
                density: 0.001,
                render: {
                    fillStyle: '#FF6B6B'
                }
            });
        }
        
        body.characterType = actualCharacterType;
        body.characterImage = this.characterImages[actualCharacterType];
        body.createdAt = Date.now();
        body.shape = shape; // シェイプ情報を保存
        
        // カメラキャラクターの場合、静止画像または抽出された人物画像を保存
        if (characterType === 'camera' && (this.frozenPersonImage || this.extractedPersonImage)) {
            body.personImage = this.frozenPersonImage || this.extractedPersonImage;
            body.isPersonImage = true;
        }
        
        // 回転を適用
        if (rotation !== 0) {
            Matter.Body.setAngle(body, rotation);
        }
        
        Matter.World.add(this.world, body);
        this.gameObjects.push(body);
        
        this.objectCount += 1; // オブジェクト数を増加
        this.lastDroppedObject = body; // 最後に落としたオブジェクトを記録
        
        // 最初のオブジェクトの場合、タイマーを開始
        if (this.gameStartTime === null) {
            this.gameStartTime = Date.now();
        }
        
        this.updateUI();
    }
    
    checkGameOver() {
        const groundY = this.ground.position.y;
        const platformWidth = this.canvas.width * 0.5;
        const platformLeft = (this.canvas.width - platformWidth) / 2;
        const platformRight = platformLeft + platformWidth;
        
        for (let i = this.gameObjects.length - 1; i >= 0; i--) {
            const obj = this.gameObjects[i];
            
            // キャラクターが土台から完全に落ちた場合（左右に落ちた場合）
            const fellOffSide = (obj.position.x < platformLeft - 50 || obj.position.x > platformRight + 50) && 
                               obj.position.y > groundY - 100;
            
            // キャラクターが画面下に落ちた場合
            const fellOffBottom = obj.position.y > this.canvas.height + 100;
            
            if (fellOffSide || fellOffBottom) {
                Matter.World.remove(this.world, obj);
                this.gameObjects.splice(i, 1);
                
                if (!this.isGameOver) {
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
                    break;
                }
            }
        }
    }
    
    updateCamera() {
        const groundY = this.ground.position.y - 25; // 土台の上面
        let highestY = groundY; // カメラ制御用の全体の最高点
        let maxObjectHeight = 0; // 各オブジェクトの高さの最大値
        
        // オブジェクトがある場合のみ計算
        if (this.gameObjects.length > 0) {
            this.gameObjects.forEach((obj, index) => {
                // 各オブジェクトの最高点を計算
                let objHighestY = groundY;
                
                const vertices = obj.vertices;
                if (vertices && vertices.length > 0) {
                    // すべての頂点のy座標から最小値（最も高い点）を見つける
                    objHighestY = vertices[0].y;
                    vertices.forEach(vertex => {
                        if (vertex.y < objHighestY) {
                            objHighestY = vertex.y;
                        }
                    });
                } else {
                    // 頂点がない場合は中心位置から半分の高さを引く（フォールバック）
                    objHighestY = obj.position.y - (obj.bounds ? (obj.bounds.max.y - obj.bounds.min.y) / 2 : 30);
                }
                
                // このオブジェクトの土台からの高さを計算
                const objectHeightFromGround = Math.max(0, Math.round(groundY - objHighestY));
                
                // 最大の高さを更新
                if (objectHeightFromGround > maxObjectHeight) {
                    maxObjectHeight = objectHeightFromGround;
                }
                
                // カメラ制御用の全体最高点を更新
                if (objHighestY < highestY) {
                    highestY = objHighestY;
                }
            });
        }
        
        // スコア用の最大高さを設定（現在の最大オブジェクト高さを使用）
        this.maxHeightPixels = maxObjectHeight;
        
        // 最後に落としたオブジェクトのデバッグ情報のみ表示
        if (this.lastDroppedObject) {
            console.log('=== HEIGHT DEBUG INFO (Last Dropped Object) ===');
            console.log('Ground Y (top surface):', groundY);
            console.log('Ground position.y:', this.ground.position.y);
            console.log('Last Dropped Object:');
            console.log('  Position:', this.lastDroppedObject.position);
            console.log('  Bounds:', this.lastDroppedObject.bounds);
            
            const vertices = this.lastDroppedObject.vertices;
            let lastObjHighestY = groundY;
            if (vertices && vertices.length > 0) {
                console.log('  Vertices count:', vertices.length);
                console.log('  Vertices:', vertices.map(v => ({ x: Math.round(v.x), y: Math.round(v.y) })));
                
                lastObjHighestY = vertices[0].y;
                vertices.forEach(vertex => {
                    if (vertex.y < lastObjHighestY) {
                        lastObjHighestY = vertex.y;
                    }
                });
                console.log('  Object highest Y:', lastObjHighestY);
            }
            
            const lastObjHeight = Math.round(groundY - lastObjHighestY);
            console.log('Height from ground:', lastObjHeight, 'px');
            console.log('Max object height:', maxObjectHeight, 'px');
            console.log('Current max height score:', this.maxHeightPixels, 'px');
            console.log('===============================================');
        }
        
        const targetOffset = Math.max(0, this.canvas.height - highestY - 200);
        this.cameraOffset += (targetOffset - this.cameraOffset) * 0.05;
    }
    
    updateUI() {
        // スコア表示は土台の下にcanvasで描画するため、ここでは何もしない
    }
    
    resetGame() {
        this.gameObjects.forEach(obj => {
            Matter.World.remove(this.world, obj);
        });
        this.gameObjects = [];
        this.objectCount = 0;
        this.gameStartTime = null;
        this.maxHeightPixels = 0;
        this.cameraOffset = 0;
        this.isGameOver = false;
        this.showGameOverScreen = false;
        this.finalStats = null;
        this.lastDropTime = 0; // 落下時刻もリセット
        this.lastDroppedObject = null; // 最後に落としたオブジェクトもリセット
        this.updateUI();
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(0, this.cameraOffset);
        
        this.ctx.fillStyle = '#8B4513';
        const groundWidth = this.canvas.width * 0.5;
        const groundX = (this.canvas.width - groundWidth) / 2;
        this.ctx.fillRect(groundX, this.ground.position.y - 25, groundWidth, 50);
        
        this.gameObjects.forEach(obj => {
            const { x, y } = obj.position;
            const angle = obj.angle;
            
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(angle);
            
            if (obj.isPersonImage && obj.personImage) {
                // 人物画像を描画
                if (!obj.imageElement) {
                    obj.imageElement = new Image();
                    obj.imageElement.src = obj.personImage;
                }
                
                if (obj.imageElement.complete) {
                    const shape = obj.shape || this.characterShapes[obj.characterType];
                    this.ctx.drawImage(obj.imageElement, -shape.width/2, -shape.height/2, shape.width, shape.height);
                } else {
                    // 画像が読み込まれていない場合はキャラクター画像を表示
                    if (obj.characterImage && obj.characterImage.complete) {
                        const shape = obj.shape || this.characterShapes[obj.characterType];
                        this.ctx.drawImage(obj.characterImage, -shape.width/2, -shape.height/2, shape.width, shape.height);
                    }
                }
            } else {
                // 通常のキャラクター画像を描画
                if (obj.characterImage && obj.characterImage.complete) {
                    const shape = obj.shape || this.characterShapes[obj.characterType];
                    this.ctx.drawImage(obj.characterImage, -shape.width/2, -shape.height/2, shape.width, shape.height);
                } else {
                    // 画像が読み込まれていない場合はフォールバック（色つき矩形）
                    const shape = obj.shape || this.characterShapes[obj.characterType];
                    this.ctx.fillStyle = '#FF6B6B';
                    this.ctx.fillRect(-shape.width/2, -shape.height/2, shape.width, shape.height);
                }
            }
            
            this.ctx.restore();
        });
        
        this.ctx.restore();
        
        // 土台の下にスコアを横一列で描画
        this.drawScores();
        
        // ゲームオーバー画面を描画
        if (this.showGameOverScreen) {
            this.drawGameOverScreen();
        }
        
        // プレビュー表示
        if (this.showPreview && !this.isGameOver) {
            this.drawPreview();
        }
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, 2);
    }
    
    drawScores() {
        // カメラオフセットに関係なく、画面最上部に固定表示
        const scoreY = 40; // 画面上から40px下
        
        // 経過時間を計算（タイマーが開始されていない場合は0:00を表示）
        let timeString = '0:00';
        if (this.gameStartTime !== null) {
            const elapsedSeconds = Math.floor((Date.now() - this.gameStartTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // スコア情報
        const scores = [
            `Objects: ${this.objectCount}`,
            `Time: ${timeString}`,
            `Height: ${this.maxHeightPixels}px`
        ];
        
        // フォントとスタイルを設定
        this.ctx.save();
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 背景を描画
        const totalWidth = scores.length * 150; // 各スコア項目150px幅
        const startX = (this.canvas.width - totalWidth) / 2;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(startX - 20, scoreY - 20, totalWidth + 40, 40);
        
        // スコアを横一列で描画
        scores.forEach((score, index) => {
            const x = startX + (index + 0.5) * 150;
            
            // 縁取りテキスト
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(score, x, scoreY);
            
            // メインテキスト
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(score, x, scoreY);
        });
        
        this.ctx.restore();
    }
    
    drawGameOverScreen() {
        if (!this.finalStats) return;
        
        // 半透明のオーバーレイ
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // ゲームオーバーテキスト
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // "GAME OVER" テキスト
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText('GAME OVER', centerX, centerY - 100);
        this.ctx.fillStyle = '#ff4444';
        this.ctx.fillText('GAME OVER', centerX, centerY - 100);
        
        // 最終スコア表示
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = 'white';
        
        const stats = [
            `Objects: ${this.finalStats.objects}`,
            `Time: ${this.finalStats.time}`,
            `Max Height: ${this.finalStats.height}px`
        ];
        
        stats.forEach((stat, index) => {
            const y = centerY - 20 + (index * 40);
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(stat, centerX, y);
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(stat, centerX, y);
        });
        
        // リセットボタンの案内
        this.ctx.font = '18px Arial';
        this.ctx.fillStyle = '#cccccc';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText('Click "Reset Game" to play again', centerX, centerY + 120);
        this.ctx.fillText('Click "Reset Game" to play again', centerX, centerY + 120);
        
        this.ctx.restore();
    }
    
    drawPreview() {
        this.ctx.save();
        
        // マウスカーソルの位置に半透明で描画
        this.ctx.globalAlpha = 0.6;
        this.ctx.translate(this.mouseX, this.mouseY + this.cameraOffset);
        this.ctx.rotate(this.currentRotation);
        
        if (this.selectedCharacter === 'camera') {
            // カメラキャラクターの場合
            if (this.frozenPersonImage || this.extractedPersonImage) {
                // 静止画像または抽出画像がある場合
                const personImage = this.frozenPersonImage || this.extractedPersonImage;
                
                if (!this.previewPersonImageElement) {
                    this.previewPersonImageElement = new Image();
                }
                
                if (this.previewPersonImageElement.src !== personImage) {
                    this.previewPersonImageElement.src = personImage;
                }
                
                if (this.previewPersonImageElement.complete) {
                    // 実際の人物画像のサイズを計算
                    const personWidth = this.extractedPersonWidth || 60;
                    const personHeight = this.extractedPersonHeight || 60;
                    const aspectRatio = personWidth / personHeight;
                    
                    let width, height;
                    if (aspectRatio > 1) {
                        width = 60;
                        height = 60 / aspectRatio;
                    } else {
                        width = 60 * aspectRatio;
                        height = 60;
                    }
                    
                    this.ctx.drawImage(this.previewPersonImageElement, -width/2, -height/2, width, height);
                    
                    // 回転角度を表示
                    if (this.currentRotation !== 0) {
                        this.ctx.globalAlpha = 0.8;
                        this.ctx.fillStyle = 'white';
                        this.ctx.strokeStyle = 'black';
                        this.ctx.lineWidth = 1;
                        this.ctx.font = '12px Arial';
                        this.ctx.textAlign = 'center';
                        const degrees = Math.round(this.currentRotation * 180 / Math.PI);
                        this.ctx.strokeText(`${degrees}°`, 0, height/2 + 15);
                        this.ctx.fillText(`${degrees}°`, 0, height/2 + 15);
                    }
                }
            } else {
                // カメラ画像がない場合はフォールバック表示
                this.ctx.fillStyle = 'rgba(100, 100, 100, 0.6)';
                this.ctx.fillRect(-30, -30, 60, 60);
                this.ctx.fillStyle = 'white';
                this.ctx.font = '24px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('📷', 0, 8);
            }
        } else {
            // 通常のキャラクター画像の場合
            const shape = this.characterShapes[this.selectedCharacter];
            const image = this.characterImages[this.selectedCharacter];
            
            if (!shape || !image || !image.complete) {
                this.ctx.restore();
                return;
            }
            
            // キャラクター画像を描画
            this.ctx.drawImage(image, -shape.width/2, -shape.height/2, shape.width, shape.height);
            
            // 回転角度を表示
            if (this.currentRotation !== 0) {
                this.ctx.globalAlpha = 0.8;
                this.ctx.fillStyle = 'white';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 1;
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                const degrees = Math.round(this.currentRotation * 180 / Math.PI);
                this.ctx.strokeText(`${degrees}°`, 0, shape.height/2 + 15);
                this.ctx.fillText(`${degrees}°`, 0, shape.height/2 + 15);
            }
        }
        
        this.ctx.restore();
    }
    
    gameLoop() {
        Matter.Engine.update(this.engine);
        this.updateCamera();
        this.checkGameOver();
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

// ゲームクラスの定義のみ（初期化はHTMLから行う）