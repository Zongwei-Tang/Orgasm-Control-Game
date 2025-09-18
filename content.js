class VideoTimerExtension {
  constructor() {
    this.isActive = false;
    this.isPaused = false;
    this.timer = null;
    this.frequencyInterval = null;
    this.randomFrequencyInterval = null;
    this.stopInterval = null;
    this.timeLimit = 5; // minutes
    this.frequency = 5; // times per 5 seconds
    this.direction = 'up';
    this.isHighFrequency = false; // Track current frequency type
    this.overlay = null;
    this.videos = [];
    this.elapsedTime = 0;
    this.counter = 0;
    this.transparency = 0.9;
    this.randomMode = false;
    this.infiniteMode = false;
    this.currentRandomFreq = 5;
    this.previousFreq = 5;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.isInStop = false;
    this.stopCountdown = 0;
    this.highFreqStartTime = 0;
    this.currentFreqStartTime = 0;
    this.lastStopTime = 0; // Track when last stop ended
    this.previousSectionDuration = 0; // Track duration of previous frequency section
    this.previousSectionFreq = 0; // Track frequency of previous section
    this.isOrgasmMode = false; // Track orgasm mode state
    this.volume = 1.0; // Default volume (100%)
    this.audioContext = null;
    this.orgasmAudio = null; // Track orgasm audio element

    this.init();
  }

  init() {
    // Load settings from storage
    chrome.storage.sync.get(['timeLimit', 'frequency', 'transparency', 'randomMode', 'infiniteMode', 'volume'], (result) => {
      this.timeLimit = result.timeLimit || 5;
      this.frequency = result.frequency || 5;
      this.transparency = result.transparency || 0.9;
      this.randomMode = result.randomMode || false;
      this.infiniteMode = result.infiniteMode || false;
      this.volume = result.volume || 1.0;
    });

    // Initialize audio context
    this.initAudio();

    // Watch for video elements
    this.watchForVideos();

    // Show control buttons immediately
    this.showControlButtons();
  }

  initAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('Audio context not supported');
      this.audioContext = null;
    }
  }

  playCountSound() {
    if (!this.audioContext || this.volume === 0) return;

    try {
      // Resume audio context if suspended (required by browser policies)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // Different tones for up and down
      if (this.direction === 'up') {
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime); // Higher pitch for up
      } else {
        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime); // Lower pitch for down
      }

      oscillator.type = 'sine';

      // Very short sound (50ms)
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.05);
    } catch (e) {
      console.log('Error playing sound:', e);
    }
  }

  watchForVideos() {
    // Initial scan for videos
    this.videos = Array.from(document.querySelectorAll('video'));

    // Watch for dynamically added videos
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
            if (node.tagName === 'VIDEO') {
              this.videos.push(node);
            }
            videos.forEach(video => this.videos.push(video));
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }


  startTimer() {
    if (this.isActive && !this.isPaused) return;

    this.isActive = true;
    this.isPaused = false;

    if (!this.infiniteMode) {
      this.timer = setInterval(() => {
        if (!this.isPaused) {
          this.elapsedTime++;
          if (this.elapsedTime >= this.timeLimit * 60) { // Convert minutes to seconds
            this.showOverMessage();
            this.stopTimer();
            this.updateButtonStates();
          }
          this.updateTimerDisplay();
        }
      }, 1000);
    }

    this.startFrequencyCounter();
    this.showControlButtons();
  }

  pauseTimer() {
    this.isPaused = true;
    if (this.frequencyInterval) {
      clearInterval(this.frequencyInterval);
      this.frequencyInterval = null;
    }
    if (this.randomFrequencyInterval) {
      clearTimeout(this.randomFrequencyInterval);
      this.randomFrequencyInterval = null;
    }
    if (this.stopInterval) {
      clearInterval(this.stopInterval);
      this.stopInterval = null;
    }
  }

  resumeTimer() {
    if (this.isActive && this.isPaused) {
      this.isPaused = false;

      // Restart frequency counter
      this.startFrequencyCounter();

      // If in random mode, schedule next frequency change
      if (this.randomMode && !this.randomFrequencyInterval) {
        // Calculate remaining time for current frequency
        const elapsed = Date.now() - this.currentFreqStartTime;
        const remainingTime = Math.max(1000, 5000 - elapsed); // At least 1 second remaining

        this.randomFrequencyInterval = setTimeout(() => {
          this.updateRandomFrequency();
        }, remainingTime);
      }
    }
  }

  stopTimer() {
    this.isActive = false;
    this.isPaused = false;
    this.elapsedTime = 0;
    this.counter = 0;
    this.direction = 'up';
    this.isInStop = false;
    this.stopCountdown = 0;
    this.highFreqStartTime = 0;
    this.currentFreqStartTime = 0;
    this.isOrgasmMode = false;

    // Stop orgasm audio if playing
    this.stopOrgasmAudio();

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.frequencyInterval) {
      clearInterval(this.frequencyInterval);
      this.frequencyInterval = null;
    }

    if (this.randomFrequencyInterval) {
      clearInterval(this.randomFrequencyInterval);
      this.randomFrequencyInterval = null;
    }

    if (this.stopInterval) {
      clearInterval(this.stopInterval);
      this.stopInterval = null;
    }

    // Don't hide panel, just reset display
    this.updateTimerDisplay();
    this.updateFrequencyDisplay(this.counter);
  }

  startFrequencyCounter() {
    if (this.frequencyInterval) {
      clearInterval(this.frequencyInterval);
    }

    if (this.randomMode) {
      this.startRandomFrequencyMode();
    } else {
      // Calculate interval: 5000ms / frequency = milliseconds per cycle
      const intervalMs = 5000 / this.frequency;

      this.frequencyInterval = setInterval(() => {
        if (!this.isPaused) {
          if (this.direction === 'up') {
            this.counter++;
          } else {
            this.counter--;
          }

          // Play count sound
          this.playCountSound();

          this.updateFrequencyDisplay(this.counter);

          // Alternate direction each cycle
          this.direction = this.direction === 'up' ? 'down' : 'up';
        }
      }, intervalMs);
    }
  }

  startRandomFrequencyMode() {
    this.updateRandomFrequency();
    this.startCurrentFrequencyInterval();
  }

  updateRandomFrequency() {
    // Don't change frequency if in orgasm mode
    if (this.isOrgasmMode) {
      return;
    }

    if (this.randomFrequencyInterval) {
      clearTimeout(this.randomFrequencyInterval);
    }

    const totalTime = this.infiniteMode ? Infinity : this.timeLimit * 60; // total seconds
    const elapsed = this.elapsedTime;
    const remaining = totalTime - elapsed;

    let newFreq, nextChangeTime;

    // Alternate between high and low frequency
    if (!this.infiniteMode && remaining <= 30) {
      // Last 30 seconds: always high frequency
      newFreq = this.getRandomFrequency(9, 12);
      this.isHighFrequency = true;
      nextChangeTime = this.getRandomTime(1000, 3000);
    } else {
      // Alternate between high and low frequency
      if (this.isHighFrequency) {
        // Switch to low frequency
        newFreq = this.getRandomFrequency(3, 6);
        this.isHighFrequency = false;
        nextChangeTime = this.getRandomTime(3000, 10000); // Max 10 seconds for low freq
      } else {
        // Switch to high frequency
        newFreq = this.getRandomFrequency(9, 12);
        this.isHighFrequency = true;
        nextChangeTime = this.getRandomTime(3000, 25000); // Can stay longer for high freq
      }
    }

    // Show frequency change reminder
    this.showFrequencyChangeReminder(this.currentRandomFreq, newFreq);

    // Track previous section for stop duration calculation
    if (this.currentFreqStartTime > 0) {
      this.previousSectionDuration = (Date.now() - this.currentFreqStartTime) / 1000; // seconds
      this.previousSectionFreq = this.currentRandomFreq;
    }

    // Update previous frequency for relative comparison
    this.previousFreq = this.currentRandomFreq;
    this.currentRandomFreq = newFreq;
    this.currentFreqStartTime = Date.now();

    // If this is the first frequency change, set initial state
    if (this.previousFreq === 0) {
      // Start with low frequency
      this.currentRandomFreq = this.getRandomFrequency(3, 6);
      this.isHighFrequency = false;
    }

    // Track high frequency periods for stop logic
    if (newFreq >= 7.5) {
      if (this.highFreqStartTime === 0) {
        this.highFreqStartTime = Date.now();
      }
    } else {
      this.highFreqStartTime = 0;
    }

    this.updateCurrentFreqDisplay();
    this.startCurrentFrequencyInterval();

    // Update speed indicator after a brief delay to ensure state is stable
    setTimeout(() => {
      this.updateSpeedIndicator();
    }, 50);

    // Schedule next frequency change
    this.randomFrequencyInterval = setTimeout(() => {
      this.updateRandomFrequency();
    }, nextChangeTime);
  }

  getRandomFrequency(min, max) {
    return Math.random() * (max - min) + min;
  }

  getRandomTime(min, max) {
    return Math.random() * (max - min) + min;
  }

  startCurrentFrequencyInterval() {
    if (this.frequencyInterval) {
      clearInterval(this.frequencyInterval);
    }

    const intervalMs = 5000 / this.currentRandomFreq;

    this.frequencyInterval = setInterval(() => {
      if (!this.isPaused && !this.isInStop) {
        if (this.direction === 'up') {
          this.counter++;
        } else {
          this.counter--;
        }

        // Play count sound
        this.playCountSound();

        this.updateFrequencyDisplay(this.counter);

        // Alternate direction each cycle
        this.direction = this.direction === 'up' ? 'down' : 'up';

        // Check for random stops during high frequency (but not in orgasm mode)
        if (this.randomMode && this.currentRandomFreq >= 3 && !this.isOrgasmMode) {
          this.checkForRandomStop();
        }
      }
    }, intervalMs);
  }

  checkForRandomStop() {
    const currentTime = Date.now();
    const freqDuration = (currentTime - this.currentFreqStartTime) / 1000; // seconds
    const timeSinceLastStop = (currentTime - this.lastStopTime) / 1000; // seconds

    // Only add stops if:
    // 1. High frequency has lasted at least 3 seconds
    // 2. At least 3 seconds have passed since last stop ended
    if (freqDuration >= 3 && timeSinceLastStop >= 3) {
      // Random chance for stop (5% per cycle during high frequency)
      if (Math.random() < 0.05) {
        this.startRandomStop();
      }
    }
  }

  startRandomStop() {
    if (this.isInStop) return;

    const currentTime = Date.now();

    // Determine stop duration based on previous section characteristics
    let stopDuration;

    // Check if previous section was high frequency (>=7.5) and long duration (>=15 seconds)
    if (this.previousSectionFreq >= 7.5 && this.previousSectionDuration >= 15) {
      // High frequency with long duration = longer stop
      stopDuration = this.getRandomTime(6, 8);
    } else {
      // Short duration OR low frequency (regardless of duration) = shorter stop
      stopDuration = this.getRandomTime(3, 4);
    }

    this.isInStop = true;
    this.stopCountdown = Math.ceil(stopDuration);

    // Clear current frequency interval
    if (this.frequencyInterval) {
      clearInterval(this.frequencyInterval);
      this.frequencyInterval = null;
    }

    // Start stop countdown
    this.stopInterval = setInterval(() => {
      if (!this.isPaused) {
        this.stopCountdown--;
        this.updateFrequencyDisplay(this.stopCountdown);

        if (this.stopCountdown <= 0) {
          this.endRandomStop();
        }
      }
    }, 1000);

    // Update display to show stop state
    this.direction = 'stop';
    this.updateFrequencyDisplay(this.stopCountdown);
    this.updateSpeedIndicator(); // Update speed indicator to show "Stop"
  }

  endRandomStop() {
    this.isInStop = false;
    this.stopCountdown = 0;
    this.lastStopTime = Date.now(); // Record when this stop ended

    if (this.stopInterval) {
      clearInterval(this.stopInterval);
      this.stopInterval = null;
    }

    // Resume normal frequency counter
    this.direction = 'up'; // Reset direction
    this.startCurrentFrequencyInterval();

    // Update speed indicator after a brief delay to ensure state is stable
    setTimeout(() => {
      this.updateSpeedIndicator();
    }, 50);
  }

  showFrequencyChangeReminder(oldFreq, newFreq) {
    if (oldFreq === newFreq) return;

    // Determine if new frequency is faster or slower than previous
    const isFaster = newFreq > oldFreq;
    const message = isFaster ? 'Now fast!' : 'Now slow!';
    const color = isFaster ? '#FF5722' : '#2196F3';

    // Add reminder to panel instead of center screen
    const freqElement = document.getElementById('current-freq');
    if (freqElement) {
      const originalColor = freqElement.style.color;
      freqElement.style.color = color;
      freqElement.style.fontWeight = 'bold';
      freqElement.style.textShadow = `0 0 8px ${color}66`;

      // Reset after 1.5 seconds
      setTimeout(() => {
        freqElement.style.color = originalColor;
        freqElement.style.fontWeight = '';
        freqElement.style.textShadow = '';
      }, 1500);
    }

    // Show brief tooltip-style indicator
    const controls = document.getElementById('video-timer-controls');
    if (controls) {
      const existingTooltip = controls.querySelector('.freq-change-tooltip');
      if (existingTooltip) {
        existingTooltip.remove();
      }

      const tooltip = document.createElement('div');
      tooltip.className = `freq-change-tooltip ${isFaster ? 'fast' : 'slow'}`;
      tooltip.textContent = message;
      controls.appendChild(tooltip);

      // Remove after 2 seconds
      setTimeout(() => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      }, 2000);
    }
  }

  updateCurrentFreqDisplay() {
    const freqElement = document.getElementById('current-freq');
    if (freqElement) {
      freqElement.textContent = this.currentRandomFreq.toFixed(1);
    }
  }

  showControlButtons() {
    if (document.getElementById('video-timer-controls')) return;

    const controls = document.createElement('div');
    controls.id = 'video-timer-controls';
    controls.className = 'video-timer-controls';
    controls.style.opacity = this.transparency;

    const timeDisplay = this.infiniteMode ?
      'Time: <span id="timer-seconds">∞</span>' :
      `Time: <span id="timer-seconds">${this.timeLimit * 60}</span>s`;

    const speedIndicator = this.getSpeedIndicator();

    controls.innerHTML = `
      <div class="control-panel">
        <div class="drag-handle" id="drag-handle">≡ Timer Panel</div>
        <div class="timer-info">
          <div class="time-display">${timeDisplay}</div>
          <div class="frequency-counter">Count: <span id="frequency-count">${this.counter}</span></div>
          ${this.randomMode ? '<div class="random-freq">Random: <span id="current-freq">' + this.currentRandomFreq + '</span>/5s</div>' : ''}
          <div class="speed-indicator" id="speed-indicator">${speedIndicator}</div>
          ${this.infiniteMode ? '<div class="infinite-indicator">🔄 Infinite Mode</div>' : ''}
        </div>
        <div class="control-buttons">
          <button id="start-btn" class="control-btn start-btn">Start</button>
          <button id="pause-btn" class="control-btn pause-btn" disabled>Pause</button>
          <button id="end-btn" class="control-btn end-btn" disabled>End</button>
        </div>
        <div class="orgasm-button-container">
          <button id="orgasm-btn" class="control-btn orgasm-btn" disabled>I want to orgasm now!</button>
        </div>
      </div>
    `;

    document.body.appendChild(controls);
    this.attachControlListeners();
    this.makeDraggable(controls);
  }

  getSpeedIndicator() {
    if (this.isInStop) {
      return '<span class="speed-stop">⏸️ Stop</span>';
    }

    const currentFreq = this.randomMode ? this.currentRandomFreq : this.frequency;
    const isFaster = currentFreq > this.previousFreq;
    return isFaster ?
      '<span class="speed-fast">🔥 Fast</span>' :
      '<span class="speed-slow">🐌 Slow</span>';
  }

  updateSpeedIndicator() {
    const speedElement = document.getElementById('speed-indicator');
    if (speedElement) {
      speedElement.innerHTML = this.getSpeedIndicator();
    }
  }

  showTimerOverlay() {
    // This method is now replaced by showControlButtons
    this.showControlButtons();
  }

  updateTimerDisplay() {
    const timeElement = document.getElementById('timer-seconds');
    if (timeElement) {
      if (this.infiniteMode) {
        timeElement.textContent = '∞';
      } else {
        const remainingSeconds = this.timeLimit * 60 - this.elapsedTime;
        timeElement.textContent = remainingSeconds;
      }
    }
  }

  updateFrequencyDisplay(count) {
    const countElement = document.getElementById('frequency-count');

    if (countElement) {
      countElement.textContent = count;
    }
  }

  showOverMessage() {
    const overMessage = document.createElement('div');
    overMessage.className = 'video-timer-over';
    overMessage.innerHTML = '<div class="over-text">Over!</div>';

    document.body.appendChild(overMessage);

    // Remove after 3 seconds
    setTimeout(() => {
      if (overMessage.parentNode) {
        overMessage.parentNode.removeChild(overMessage);
      }
    }, 3000);
  }

  attachControlListeners() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const endBtn = document.getElementById('end-btn');
    const orgasmBtn = document.getElementById('orgasm-btn');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (this.isPaused) {
          this.resumeTimer();
        } else {
          this.startTimer();
        }
        this.updateButtonStates();
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.pauseTimer();
        this.updateButtonStates();
      });
    }

    if (endBtn) {
      endBtn.addEventListener('click', () => {
        this.stopTimer();
        this.updateButtonStates();
      });
    }

    if (orgasmBtn) {
      orgasmBtn.addEventListener('click', () => {
        console.log('Orgasm button clicked - activating orgasm mode');
        this.activateOrgasmMode();
        this.updateButtonStates();

        // Ensure audio plays after a short delay (after orgasm mode setup)
        setTimeout(() => {
          if (this.orgasmAudio && this.orgasmAudio.paused) {
            console.log('Attempting to play audio after button click');
            this.orgasmAudio.play().catch(e => {
              console.error('Audio play after click failed:', e);
            });
          }
        }, 100);
      });
    }
  }

  updateButtonStates() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const endBtn = document.getElementById('end-btn');
    const orgasmBtn = document.getElementById('orgasm-btn');

    if (startBtn && pauseBtn && endBtn && orgasmBtn) {
      if (!this.isActive) {
        // Timer not started
        startBtn.disabled = false;
        startBtn.textContent = 'Start';
        pauseBtn.disabled = true;
        endBtn.disabled = true;
        orgasmBtn.disabled = true;
      } else if (this.isPaused) {
        // Timer paused
        startBtn.disabled = false;
        startBtn.textContent = 'Resume';
        pauseBtn.disabled = true;
        endBtn.disabled = false;
        orgasmBtn.disabled = false;
      } else {
        // Timer running
        startBtn.disabled = true;
        startBtn.textContent = 'Start';
        pauseBtn.disabled = false;
        endBtn.disabled = false;
        orgasmBtn.disabled = false;
      }
    }
  }

  makeDraggable(element) {
    const dragHandle = element.querySelector('#drag-handle');

    dragHandle.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      const rect = element.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;

      document.addEventListener('mousemove', this.handleDrag.bind(this));
      document.addEventListener('mouseup', this.stopDrag.bind(this));

      e.preventDefault();
    });
  }

  handleDrag(e) {
    if (!this.isDragging) return;

    const controls = document.getElementById('video-timer-controls');
    if (!controls) return;

    const newX = e.clientX - this.dragOffset.x;
    const newY = e.clientY - this.dragOffset.y;

    // Keep within viewport bounds
    const maxX = window.innerWidth - controls.offsetWidth;
    const maxY = window.innerHeight - controls.offsetHeight;

    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));

    controls.style.left = boundedX + 'px';
    controls.style.top = boundedY + 'px';
    controls.style.right = 'auto';
  }

  stopDrag() {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.handleDrag.bind(this));
    document.removeEventListener('mouseup', this.stopDrag.bind(this));
  }

  activateOrgasmMode() {
    this.isOrgasmMode = true;

    // Clear all existing intervals
    if (this.frequencyInterval) {
      clearInterval(this.frequencyInterval);
    }
    if (this.randomFrequencyInterval) {
      clearTimeout(this.randomFrequencyInterval);
    }
    if (this.stopInterval) {
      clearInterval(this.stopInterval);
    }

    // End any current stop
    if (this.isInStop) {
      this.isInStop = false;
      this.stopCountdown = 0;
    }

    // Start playing MP3 repeatedly
    this.playOrgasmAudio();

    // Set to highest frequency (12/5s) and start interval
    this.currentRandomFreq = 12;
    this.direction = 'up';

    const intervalMs = 5000 / 12; // Highest frequency

    this.frequencyInterval = setInterval(() => {
      if (!this.isPaused) {
        if (this.direction === 'up') {
          this.counter++;
        } else {
          this.counter--;
        }

        // Play count sound
        this.playCountSound();

        this.updateFrequencyDisplay(this.counter);

        // Alternate direction each cycle
        this.direction = this.direction === 'up' ? 'down' : 'up';
      }
    }, intervalMs);

    // Update display to show orgasm mode
    this.updateCurrentFreqDisplay();
    this.updateSpeedIndicator();
  }

  playOrgasmAudio() {
    try {
      // Stop any existing audio first
      this.stopOrgasmAudio();

      console.log('Starting orgasm audio playback...');

      // Try multiple approaches for audio loading
      const audioUrl = chrome.runtime.getURL('(黑沼爽子)你们要的骂人合集^_^  配音  杂鱼  日语_02428a3698743917f63d8166d3c68a24.mp3');
      console.log('Audio URL:', audioUrl);

      // Method 1: Direct Audio element
      this.orgasmAudio = new Audio();
      this.orgasmAudio.crossOrigin = 'anonymous';
      this.orgasmAudio.loop = true;
      this.orgasmAudio.volume = 1.0;
      this.orgasmAudio.preload = 'auto';

      // Add comprehensive event listeners
      this.orgasmAudio.addEventListener('loadstart', () => console.log('Audio load started'));
      this.orgasmAudio.addEventListener('canplay', () => {
        console.log('Audio can play - attempting playback');
        this.orgasmAudio.play().catch(e => console.error('Canplay auto-play failed:', e));
      });
      this.orgasmAudio.addEventListener('canplaythrough', () => console.log('Audio can play through'));
      this.orgasmAudio.addEventListener('loadeddata', () => console.log('Audio data loaded'));
      this.orgasmAudio.addEventListener('loadedmetadata', () => console.log('Audio metadata loaded'));
      this.orgasmAudio.addEventListener('playing', () => console.log('Audio is NOW PLAYING!'));
      this.orgasmAudio.addEventListener('pause', () => console.log('Audio paused'));
      this.orgasmAudio.addEventListener('ended', () => console.log('Audio ended'));
      this.orgasmAudio.addEventListener('error', (e) => {
        console.error('Audio error event:', e);
        console.error('Audio error details:', this.orgasmAudio.error);
        if (this.orgasmAudio.error) {
          console.error('Error code:', this.orgasmAudio.error.code);
          switch(this.orgasmAudio.error.code) {
            case 1: console.error('MEDIA_ERR_ABORTED'); break;
            case 2: console.error('MEDIA_ERR_NETWORK'); break;
            case 3: console.error('MEDIA_ERR_DECODE'); break;
            case 4: console.error('MEDIA_ERR_SRC_NOT_SUPPORTED'); break;
          }
        }
      });

      // Set source and load
      this.orgasmAudio.src = audioUrl;
      this.orgasmAudio.load();

      // Immediate play attempt (user clicked button = user gesture)
      console.log('Attempting immediate play...');
      this.orgasmAudio.play().then(() => {
        console.log('✅ Audio playback started successfully!');
      }).catch(error => {
        console.error('❌ Audio playback failed:', error);

        // Try alternative: fetch and create blob URL
        console.log('Trying blob URL approach...');
        fetch(audioUrl)
          .then(response => response.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            console.log('Created blob URL:', blobUrl);
            this.orgasmAudio.src = blobUrl;
            return this.orgasmAudio.play();
          })
          .then(() => {
            console.log('✅ Blob URL audio playback started!');
          })
          .catch(err => {
            console.error('❌ Blob URL approach also failed:', err);
          });
      });

    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  }

  stopOrgasmAudio() {
    if (this.orgasmAudio) {
      this.orgasmAudio.pause();
      this.orgasmAudio.currentTime = 0;
      // Remove from DOM if it was added
      if (this.orgasmAudio.parentNode) {
        this.orgasmAudio.parentNode.removeChild(this.orgasmAudio);
      }
      this.orgasmAudio = null;
      console.log('Orgasm audio stopped and removed');
    }
  }

  hideTimerOverlay() {
    const controls = document.getElementById('video-timer-controls');
    if (controls && controls.parentNode) {
      controls.parentNode.removeChild(controls);
    }
  }

  updateSettings(settings) {
    this.timeLimit = settings.timeLimit || this.timeLimit;
    this.frequency = settings.frequency || this.frequency;
    this.transparency = settings.transparency || this.transparency;
    this.randomMode = settings.randomMode || this.randomMode;
    this.infiniteMode = settings.infiniteMode || this.infiniteMode;
    this.volume = settings.volume !== undefined ? settings.volume : this.volume;

    // Update panel transparency
    const controls = document.getElementById('video-timer-controls');
    if (controls) {
      controls.style.opacity = this.transparency;
    }

    // Restart timer with new settings if active
    if (this.isActive) {
      this.stopTimer();
      this.startTimer();
    }
  }
}

// Initialize the extension
const videoTimerExtension = new VideoTimerExtension();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateSettings') {
    videoTimerExtension.updateSettings(request.settings);
    sendResponse({success: true});
  }
});