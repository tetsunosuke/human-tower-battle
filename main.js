import { Game } from './src/Game.js';

window.addEventListener('load', async () => {
    // Wait for external libraries to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (typeof tf !== 'undefined' && typeof bodyPix !== 'undefined' && typeof Matter !== 'undefined') {
        new Game();
    } else {
        console.error('A required library (TensorFlow.js, BodyPix, or Matter.js) failed to load.');
        alert('A required library failed to load. Please check your internet connection and refresh the page.');
    }
});
