class PopupManager {
  constructor() {
    this.init();
  }

  init() {
    this.loadSettings();
    this.attachEventListeners();
  }

  loadSettings() {
    chrome.storage.sync.get(['timeLimit', 'frequency', 'transparency', 'randomMode', 'infiniteMode', 'volume'], (result) => {
      const timeLimitInput = document.getElementById('timeLimit');
      const frequencyInput = document.getElementById('frequency');
      const transparencyInput = document.getElementById('transparency');
      const randomModeInput = document.getElementById('randomMode');
      const infiniteModeInput = document.getElementById('infiniteMode');
      const volumeInput = document.getElementById('volume');

      if (timeLimitInput) {
        timeLimitInput.value = result.timeLimit || 5;
      }

      if (frequencyInput) {
        frequencyInput.value = result.frequency || 5;
      }

      if (transparencyInput) {
        transparencyInput.value = result.transparency || 0.9;
        this.updateTransparencyDisplay(result.transparency || 0.9);
      }

      if (volumeInput) {
        volumeInput.value = result.volume || 1.0;
        this.updateVolumeDisplay(result.volume || 1.0);
      }

      if (randomModeInput) {
        randomModeInput.checked = result.randomMode || false;
        this.toggleFrequencyGroup(result.randomMode || false);
      }

      if (infiniteModeInput) {
        infiniteModeInput.checked = result.infiniteMode || false;
        this.toggleTimeLimitGroup(result.infiniteMode || false);
      }
    });
  }

  attachEventListeners() {
    const saveButton = document.getElementById('saveSettings');
    const resetButton = document.getElementById('resetSettings');
    const transparencyInput = document.getElementById('transparency');
    const volumeInput = document.getElementById('volume');
    const randomModeInput = document.getElementById('randomMode');
    const infiniteModeInput = document.getElementById('infiniteMode');

    if (saveButton) {
      saveButton.addEventListener('click', this.saveSettings.bind(this));
    }

    if (resetButton) {
      resetButton.addEventListener('click', this.resetSettings.bind(this));
    }

    if (transparencyInput) {
      transparencyInput.addEventListener('input', (e) => {
        this.updateTransparencyDisplay(parseFloat(e.target.value));
      });
    }

    if (volumeInput) {
      volumeInput.addEventListener('input', (e) => {
        this.updateVolumeDisplay(parseFloat(e.target.value));
      });
    }

    if (randomModeInput) {
      randomModeInput.addEventListener('change', (e) => {
        this.toggleFrequencyGroup(e.target.checked);
      });
    }

    if (infiniteModeInput) {
      infiniteModeInput.addEventListener('change', (e) => {
        this.toggleTimeLimitGroup(e.target.checked);
      });
    }

    // Auto-save on input change
    const inputs = document.querySelectorAll('input[type="number"], input[type="range"], input[type="checkbox"]');
    inputs.forEach(input => {
      input.addEventListener('change', this.validateAndSave.bind(this));
    });
  }

  toggleFrequencyGroup(isRandomMode) {
    const manualFreqGroup = document.getElementById('manualFreqGroup');
    if (manualFreqGroup) {
      manualFreqGroup.style.display = isRandomMode ? 'none' : 'block';
    }
  }

  toggleTimeLimitGroup(isInfiniteMode) {
    const timeLimitGroup = document.getElementById('timeLimitGroup');
    if (timeLimitGroup) {
      timeLimitGroup.style.display = isInfiniteMode ? 'none' : 'block';
    }
  }

  updateTransparencyDisplay(value) {
    const transparencyValue = document.getElementById('transparencyValue');
    if (transparencyValue) {
      transparencyValue.textContent = Math.round(value * 100) + '%';
    }
  }

  updateVolumeDisplay(value) {
    const volumeValue = document.getElementById('volumeValue');
    if (volumeValue) {
      volumeValue.textContent = Math.round(value * 100) + '%';
    }
  }

  validateAndSave() {
    const timeLimitInput = document.getElementById('timeLimit');
    const frequencyInput = document.getElementById('frequency');
    const randomModeInput = document.getElementById('randomMode');
    const infiniteModeInput = document.getElementById('infiniteMode');

    if (!randomModeInput.checked && !infiniteModeInput.checked && !this.validateInputs(timeLimitInput, frequencyInput)) {
      return;
    }

    this.saveSettings();
  }

  validateInputs(timeLimitInput, frequencyInput) {
    const timeLimit = parseInt(timeLimitInput.value);
    const frequency = parseInt(frequencyInput.value);

    // Validate time limit
    if (timeLimit < 1 || timeLimit > 60) {
      this.showStatus('Time limit must be between 1 and 60 minutes', 'error');
      timeLimitInput.focus();
      return false;
    }

    // Validate frequency
    if (frequency < 1 || frequency > 20) {
      this.showStatus('Frequency must be between 1 and 20 times per 5 seconds', 'error');
      frequencyInput.focus();
      return false;
    }

    return true;
  }

  saveSettings() {
    const timeLimitInput = document.getElementById('timeLimit');
    const frequencyInput = document.getElementById('frequency');
    const transparencyInput = document.getElementById('transparency');
    const volumeInput = document.getElementById('volume');
    const randomModeInput = document.getElementById('randomMode');
    const infiniteModeInput = document.getElementById('infiniteMode');

    if (!randomModeInput.checked && !infiniteModeInput.checked && !this.validateInputs(timeLimitInput, frequencyInput)) {
      return;
    }

    const settings = {
      timeLimit: parseInt(timeLimitInput.value),
      frequency: parseInt(frequencyInput.value),
      transparency: parseFloat(transparencyInput.value),
      volume: parseFloat(volumeInput.value),
      randomMode: randomModeInput.checked,
      infiniteMode: infiniteModeInput.checked
    };

    // Save to storage
    chrome.storage.sync.set(settings, () => {
      this.showStatus('Settings saved successfully!', 'success');

      // Send message to content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateSettings',
            settings: settings
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Content script not ready yet, settings will apply on next page load');
            }
          });
        }
      });
    });
  }

  resetSettings() {
    const defaultSettings = {
      timeLimit: 5,
      frequency: 5,
      transparency: 0.9,
      volume: 1.0,
      randomMode: false,
      infiniteMode: false
    };

    document.getElementById('timeLimit').value = defaultSettings.timeLimit;
    document.getElementById('frequency').value = defaultSettings.frequency;
    document.getElementById('transparency').value = defaultSettings.transparency;
    document.getElementById('volume').value = defaultSettings.volume;
    document.getElementById('randomMode').checked = defaultSettings.randomMode;
    document.getElementById('infiniteMode').checked = defaultSettings.infiniteMode;

    this.updateTransparencyDisplay(defaultSettings.transparency);
    this.updateVolumeDisplay(defaultSettings.volume);
    this.toggleFrequencyGroup(defaultSettings.randomMode);
    this.toggleTimeLimitGroup(defaultSettings.infiniteMode);

    chrome.storage.sync.set(defaultSettings, () => {
      this.showStatus('Settings reset to defaults', 'success');

      // Send message to content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateSettings',
            settings: defaultSettings
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Content script not ready yet, settings will apply on next page load');
            }
          });
        }
      });
    });
  }

  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-message ${type}`;

      // Clear status after 3 seconds
      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status-message';
      }, 3000);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});