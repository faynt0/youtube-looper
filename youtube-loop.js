// ==UserScript==
// @name         YouTube Video Looper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Loop YouTube videos with custom start and end times
// @author       You
// @match        https://www.youtube.com/watch*
// @match        https://m.youtube.com/watch*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let loopInterval;
    let isLooping = false;
    let startTime = 0;
    let endTime = 0;
    let isMinimized = true; // Start minimized

    // Create the control panel
    function createControlPanel() {
        const controlPanel = document.createElement('div');
        controlPanel.id = 'youtube-looper-panel';
        controlPanel.style.cssText = `
            position: fixed;
            top: 90px;
            right: 5px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 8px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
        `;

        // Add CSS to hide panel in fullscreen
        const style = document.createElement('style');
        style.textContent = `
            :-webkit-full-screen #youtube-looper-panel {
                display: none !important;
            }
            :fullscreen #youtube-looper-panel {
                display: none !important;
            }
        `;
        document.head.appendChild(style);

        // Create header with title and minimize button
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.2); cursor: pointer;';

        const minimizeBtn = document.createElement('div');
        minimizeBtn.id = 'minimize-btn';
        minimizeBtn.textContent = '−';
        minimizeBtn.style.cssText = 'width: 20px; height: 20px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: bold; font-size: 16px; hover: background: rgba(255,255,255,0.3);';
        header.appendChild(minimizeBtn);
        controlPanel.appendChild(header);

        // Create main content container
        const content = document.createElement('div');
        content.id = 'panel-content';
        content.style.cssText = 'padding: 15px; min-width: 250px;';

        // Create start time section
        const startSection = document.createElement('div');
        startSection.style.cssText = 'margin-bottom: 10px;';
        
        const startLabel = document.createElement('label');
        startLabel.textContent = 'Start Time (seconds):';
        startLabel.style.cssText = 'display: block; margin-bottom: 5px;';
        startSection.appendChild(startLabel);

        const startInput = document.createElement('input');
        startInput.type = 'number';
        startInput.id = 'start-time';
        startInput.placeholder = '0';
        startInput.style.cssText = 'width: 100%; padding: 5px; border: none; border-radius: 4px; box-sizing: border-box;';
        startSection.appendChild(startInput);
        content.appendChild(startSection);

        // Create end time section
        const endSection = document.createElement('div');
        endSection.style.cssText = 'margin-bottom: 15px;';
        
        const endLabel = document.createElement('label');
        endLabel.textContent = 'End Time (seconds):';
        endLabel.style.cssText = 'display: block; margin-bottom: 5px;';
        endSection.appendChild(endLabel);

        const endInput = document.createElement('input');
        endInput.type = 'number';
        endInput.id = 'end-time';
        endInput.placeholder = 'Video duration';
        endInput.style.cssText = 'width: 100%; padding: 5px; border: none; border-radius: 4px; box-sizing: border-box;';
        endSection.appendChild(endInput);
        content.appendChild(endSection);

        // Create button section
        const buttonSection = document.createElement('div');
        buttonSection.style.cssText = 'display: flex; gap: 10px;';

        const toggleButton = document.createElement('button');
        toggleButton.id = 'toggle-loop';
        toggleButton.textContent = 'Start Loop';
        toggleButton.style.cssText = 'flex: 1; padding: 8px; border: none; border-radius: 4px; background: #ff0000; color: white; cursor: pointer; font-weight: bold;';
        buttonSection.appendChild(toggleButton);

        const setCurrentButton = document.createElement('button');
        setCurrentButton.id = 'set-current';
        setCurrentButton.textContent = 'Set Current';
        setCurrentButton.style.cssText = 'flex: 1; padding: 8px; border: none; border-radius: 4px; background: #666; color: white; cursor: pointer;';
        buttonSection.appendChild(setCurrentButton);
        content.appendChild(buttonSection);

        // Create help text
        const helpText = document.createElement('div');
        helpText.textContent = 'Click "Set Current" to use current video time as start';
        helpText.style.cssText = 'margin-top: 10px; font-size: 12px; opacity: 0.8;';
        content.appendChild(helpText);

        controlPanel.appendChild(content);

        // Start in minimized state
        content.style.display = 'none';
        minimizeBtn.textContent = '+';
        controlPanel.style.minWidth = 'auto';
        header.style.borderBottom = 'none';

        // Add minimize/maximize functionality
        const toggleMinimize = () => {
            isMinimized = !isMinimized;
            if (isMinimized) {
                content.style.display = 'none';
                minimizeBtn.textContent = '+';
                controlPanel.style.minWidth = 'auto';
                header.style.borderBottom = 'none';
            } else {
                content.style.display = 'block';
                minimizeBtn.textContent = '−';
                controlPanel.style.minWidth = '250px';
                header.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
            }
        };

        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMinimize();
        });

        header.addEventListener('click', toggleMinimize);

        // Add hover effect to minimize button
        minimizeBtn.addEventListener('mouseenter', () => {
            minimizeBtn.style.background = 'rgba(255,255,255,0.3)';
        });
        minimizeBtn.addEventListener('mouseleave', () => {
            minimizeBtn.style.background = 'rgba(255,255,255,0.2)';
        });

        document.body.appendChild(controlPanel);
        return controlPanel;
    }

    // Get the YouTube video element
    function getVideoElement() {
        return document.querySelector('video');
    }

    // Convert time string (MM:SS or HH:MM:SS) to seconds
    function timeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        return Number(timeStr) || 0;
    }

    // Start the loop functionality
    function startLoop() {
        const video = getVideoElement();
        if (!video) return;

        const startInput = document.getElementById('start-time');
        const endInput = document.getElementById('end-time');
        
        startTime = timeToSeconds(startInput.value) || 0;
        
        // If end time is empty, use video duration (loop whole video)
        if (!endInput.value || endInput.value.trim() === '') {
            endTime = video.duration - 1;
        } else {
            endTime = timeToSeconds(endInput.value);
        }

        if (startTime >= endTime) {
            alert('Start time must be less than end time!');
            return;
        }

        isLooping = true;

        loopInterval = setInterval(() => {
            if (video.currentTime >= endTime) {
                video.currentTime = startTime;
            }
        }, 100);

        document.getElementById('toggle-loop').textContent = 'Stop Loop';
        document.getElementById('toggle-loop').style.background = '#00aa00';
    }

    // Stop the loop functionality
    function stopLoop() {
        if (loopInterval) {
            clearInterval(loopInterval);
            loopInterval = null;
        }
        isLooping = false;
        document.getElementById('toggle-loop').textContent = 'Start Loop';
        document.getElementById('toggle-loop').style.background = '#ff0000';
    }

    // Set current video time as start time
    function setCurrentTime() {
        const video = getVideoElement();
        if (!video) return;
        
        document.getElementById('start-time').value = Math.floor(video.currentTime);
    }

    // Initialize the script
    function init() {
        // Wait for the page to load completely
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Wait for video to be available
        const checkForVideo = setInterval(() => {
            const video = getVideoElement();
            if (video) {
                clearInterval(checkForVideo);
                
                // Remove existing panel if it exists
                const existingPanel = document.getElementById('youtube-looper-panel');
                if (existingPanel) {
                    existingPanel.remove();
                }

                // Create control panel
                createControlPanel();

                // Add event listeners
                document.getElementById('toggle-loop').addEventListener('click', () => {
                    if (isLooping) {
                        stopLoop();
                    } else {
                        startLoop();
                    }
                });

                document.getElementById('set-current').addEventListener('click', setCurrentTime);

                // Set default end time to video duration when it's loaded
                video.addEventListener('loadedmetadata', () => {
                    if (!document.getElementById('end-time').value) {
                        document.getElementById('end-time').value = Math.floor(video.duration);
                    }
                });

                // Stop loop when video ends naturally
                video.addEventListener('ended', stopLoop);

                // Allow Enter key to start/stop loop
                document.addEventListener('keydown', (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    if (e.key === 'l' && e.ctrlKey) {
                        e.preventDefault();
                        if (isLooping) {
                            stopLoop();
                        } else {
                            startLoop();
                        }
                    }
                });
            }
        }, 1000);
    }

    // Handle navigation changes (YouTube is a SPA)
    let currentUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== currentUrl) {
            currentUrl = location.href;
            if (location.href.includes('/watch')) {
                stopLoop();
                setTimeout(init, 1000);
            }
        }
    }).observe(document, { subtree: true, childList: true });

    // Initial load
    if (location.href.includes('/watch')) {
        init();
    }
})();
