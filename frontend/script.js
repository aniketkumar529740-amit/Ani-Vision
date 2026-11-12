'use strict';

// ==========================================
// 1. ELEMENTS AND APP STATE
// ==========================================

const $ = (id) => document.getElementById(id);

const views = ['chat', 'vision', 'camera', 'settings'];

const state = {
  history: [],
  imageData: null,
  cameraStream: null,
  recognition: null,
  voiceRecognition: null,
  wakeListening: false,
  busy: false,
  lastVision: '',
  lastCamera: '',
  speechLanguage: localStorage.getItem('ani-speech-language') || 'en-IN',
  activeSpeechButton: null
};

// ==========================================
// 2. HELPERS
// ==========================================

function toast(message) {
  const el = $('toast');
  if (!el) return;

  el.textContent = message;
  el.classList.add('show');

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.classList.remove('show');
  }, 3200);
}

function cleanAssistantText(value) {
  return String(value ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanSpeechText(value) {
  return cleanAssistantText(value)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[^\p{L}\p{N}\s.,?!।:;'-]/gu, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// ==========================================
// 3. NAVIGATION
// ==========================================

function setView(name) {
  if (!views.includes(name)) return;

  views.forEach((view) => {
    const section = $('view-' + view);
    if (section) {
      section.classList.toggle('active', view === name);
    }
  });

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === name);
  });

  if ($('pageTitle')) {
    $('pageTitle').textContent = {
      chat: 'AI Chat',
      vision: 'Image Analysis',
      camera: 'Live Camera',
      settings: 'Settings'
    }[name];
  }
}

document.querySelectorAll('.nav-btn').forEach((button) => {
  button.addEventListener('click', () => {
    setView(button.dataset.view);
  });
});

document.querySelectorAll('.suggestion').forEach((button) => {
  button.addEventListener('click', () => {
    if (!$('chatInput')) return;

    $('chatInput').value = button.dataset.prompt || '';
    sendMessage();
  });
});

// ==========================================
// 4. THEME SETTINGS
// ==========================================

if ($('themeBtn')) {
  $('themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('light');

    localStorage.setItem(
      'ani-theme',
      document.body.classList.contains('light') ? 'light' : 'dark'
    );
  });
}

if (localStorage.getItem('ani-theme') === 'light') {
  document.body.classList.add('light');
}

// ==========================================
// 5. SPEECH LANGUAGE
// ==========================================

if ($('speechLanguage')) {
  $('speechLanguage').value = state.speechLanguage;

  $('speechLanguage').addEventListener('change', (event) => {
    state.speechLanguage = event.target.value;

    localStorage.setItem(
      'ani-speech-language',
      state.speechLanguage
    );

    if (state.wakeListening) {
      stopWake();
      startWake();
    }
  });
}

// ==========================================
// 6. BACKEND API
// ==========================================

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body
      ? { 'Content-Type': 'application/json' }
      : {},
    body: body ? JSON.stringify(body) : undefined
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error('The server returned an unreadable response.');
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

// ==========================================
// 7. BACKEND STATUS
// ==========================================

async function refreshStatus() {
  try {
    const health = await api('/api/health');
    const config = await api('/api/config');

    const configured = Boolean(config.geminiConfigured);

    if ($('apiDot')) {
      $('apiDot').classList.toggle('online', configured);
    }

    if ($('apiLabel')) {
      $('apiLabel').textContent = configured
        ? 'ANIVISION connected'
        : 'AI API not configured';
    }

    if ($('topStatus')) {
      $('topStatus').textContent = configured
        ? 'ANIVISION ready'
        : 'API key required';

      if ($('topStatus').previousElementSibling) {
        $('topStatus').previousElementSibling.classList.toggle(
          'online',
          configured
        );
      }
    }

    if ($('backendState')) {
      $('backendState').textContent = health.ok
        ? 'Online'
        : 'Offline';
    }

    if ($('aiState')) {
      $('aiState').textContent = configured
        ? 'Configured'
        : 'Not configured';

      $('aiState').style.color = configured
        ? '#55d8a4'
        : '#e5b45d';
    }
  } catch {
    if ($('apiLabel')) $('apiLabel').textContent = 'Backend unavailable';
    if ($('topStatus')) $('topStatus').textContent = 'Offline';
    if ($('backendState')) $('backendState').textContent = 'Offline';
    if ($('aiState')) $('aiState').textContent = 'Unavailable';
  }

  if ($('recognitionState')) {
    $('recognitionState').textContent =
      ('SpeechRecognition' in window ||
       'webkitSpeechRecognition' in window)
        ? 'Supported'
        : 'Not supported';
  }

  if ($('speechState')) {
    $('speechState').textContent =
      'speechSynthesis' in window
        ? 'Supported'
        : 'Not supported';
  }
}

// ==========================================
// 8. TEXT TO SPEECH
// ==========================================

function resetSpeechButton(button) {
  if (!button) return;

  button.classList.remove('is-speaking');
  button.textContent = button.dataset.defaultLabel || '🔊 Listen';
  button.setAttribute('aria-pressed', 'false');

  if (state.activeSpeechButton === button) {
    state.activeSpeechButton = null;
  }
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  resetSpeechButton(state.activeSpeechButton);
}

function speakText(text, button) {
  if (!('speechSynthesis' in window)) {
    toast('Speech output is not supported in this browser.');
    return;
  }

  const speechText = cleanSpeechText(text);

  if (!speechText) {
    toast('There is no text available to read.');
    return;
  }

  if (
    state.activeSpeechButton === button &&
    window.speechSynthesis.speaking
  ) {
    stopSpeech();
    return;
  }

  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(speechText);

  utterance.lang = state.speechLanguage;
  utterance.rate = 1;
  utterance.pitch = 1;

  state.activeSpeechButton = button;

  if (button) {
    button.dataset.defaultLabel ||= button.textContent;
    button.textContent = '■ Stop';
    button.classList.add('is-speaking');
    button.setAttribute('aria-pressed', 'true');
  }

  utterance.onend = () => resetSpeechButton(button);

  utterance.onerror = () => {
    resetSpeechButton(button);
    toast('Could not play speech. Please try again.');
  };

  window.speechSynthesis.speak(utterance);
}

// ==========================================
// 9. CHAT MESSAGE DISPLAY
// ==========================================

function addMessage(role, value) {
  const messages = $('chatMessages');
  if (!messages) return;

  if ($('welcomePanel')) {
    $('welcomePanel').hidden = true;
  }

  const text = role === 'assistant'
    ? cleanAssistantText(value)
    : String(value ?? '');

  const row = document.createElement('div');
  row.className = 'message ' + role;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'assistant' ? 'AI' : 'YOU';

  const content = document.createElement('div');

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  content.appendChild(bubble);

  if (role === 'assistant') {
    const tools = document.createElement('div');
    tools.className = 'message-tools';

    const speak = document.createElement('button');
    speak.className = 'speak-btn';
    speak.textContent = '🔊 Listen';
    speak.dataset.defaultLabel = '🔊 Listen';

    speak.addEventListener('click', () => {
      speakText(text, speak);
    });

    tools.appendChild(speak);
    content.appendChild(tools);
  }

  row.append(avatar, content);
  messages.appendChild(row);

  messages.scrollTop = messages.scrollHeight;
}

// ==========================================
// 10. CHAT LOADING STATE
// ==========================================

function setBusy(value) {
  state.busy = value;

  if ($('sendBtn')) {
    $('sendBtn').disabled = value;
    $('sendBtn').textContent = value ? '…' : '➤';
  }
}

// ==========================================
// 11. SEND CHAT MESSAGE
// ==========================================

async function sendMessage(text) {
  if (state.busy) return;

  const input = $('chatInput');

  const message = (
    text !== undefined
      ? text
      : input?.value || ''
  ).trim();

  if (!message) return;

  stopSpeech();

  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }

  addMessage('user', message);

  state.history.push({
    role: 'user',
    content: message
  });

  setBusy(true);

  const pending = document.createElement('div');
  pending.className = 'message assistant';

  const pendingAvatar = document.createElement('div');
  pendingAvatar.className = 'avatar';
  pendingAvatar.textContent = 'AI';

  const pendingBubble = document.createElement('div');
  pendingBubble.className = 'bubble';
  pendingBubble.textContent = 'Thinking…';

  pending.append(pendingAvatar, pendingBubble);

  $('chatMessages').appendChild(pending);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;

  try {
    const result = await api('/api/chat', {
      message,
      history: state.history.slice(-12, -1)
    });

    pending.remove();

    const answer = cleanAssistantText(result.text);

    addMessage('assistant', answer);

    state.history.push({
      role: 'assistant',
      content: answer
    });

    if (state.history.length > 40) {
      state.history = state.history.slice(-40);
    }
  } catch (error) {
    pending.remove();

    addMessage(
      'assistant',
      `I couldn't complete that request. ${error.message}`
    );

    toast(error.message);
  } finally {
    setBusy(false);
  }
}

// ==========================================
// 12. CHAT EVENTS
// ==========================================

if ($('sendBtn')) {
  $('sendBtn').addEventListener('click', () => {
    sendMessage();
  });
}

if ($('chatInput')) {
  $('chatInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  $('chatInput').addEventListener('input', (event) => {
    event.target.style.height = 'auto';

    event.target.style.height =
      Math.min(event.target.scrollHeight, 130) + 'px';
  });
}

// ==========================================
// 13. SPEECH RECOGNITION
// ==========================================

function makeRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();

  recognition.lang = state.speechLanguage;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  return recognition;
}

// ==========================================
// 14. WAKE WORD LISTENER
// ==========================================

function startWake() {
  if (state.wakeListening) return;

  const recognition = makeRecognition();

  if (!recognition) {
    toast('Speech recognition is not supported. Try Chrome or Edge.');
    return;
  }

  recognition.continuous = true;

  state.recognition = recognition;
  state.wakeListening = true;

  if ($('wakeBtn')) {
    $('wakeBtn').classList.add('listening');

    $('wakeBtn').innerHTML =
      '<span class="pulse-dot"></span> Listening for “Hey Anyman” · Stop';
  }

  recognition.onresult = (event) => {
    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      if (!event.results[i].isFinal) continue;

      const heard = event.results[i][0].transcript.trim();

      const match = heard.match(
        /hey\s+(?:anyvision|anivision|anyman|aniket)/i
      );

      if (!match) continue;

      setView('chat');

      const rest = heard
        .slice(match[0].length)
        .trim()
        .replace(/^[,.:;\s]+/, '');

      toast('Hey Anyman is listening.');

      if (rest) {
        sendMessage(rest);
      } else if ($('chatInput')) {
        $('chatInput').focus();
      }
    }
  };

  recognition.onerror = (event) => {
    if (
      event.error === 'not-allowed' ||
      event.error === 'service-not-allowed'
    ) {
      stopWake();
      toast('Microphone permission was denied. Allow it in browser settings.');
    } else if (event.error !== 'no-speech') {
      toast(`Voice error: ${event.error}`);
    }
  };

  recognition.onend = () => {
    if (state.wakeListening && state.recognition === recognition) {
      try {
        recognition.start();
      } catch {
        // Browser may still be restarting recognition.
      }
    }
  };

  try {
    recognition.start();
  } catch {
    stopWake();
    toast('Could not start microphone. Please try again.');
  }
}

function stopWake() {
  state.wakeListening = false;

  if (state.recognition) {
    state.recognition.onend = null;

    try {
      state.recognition.stop();
    } catch {
      // Already stopped.
    }

    state.recognition = null;
  }

  if ($('wakeBtn')) {
    $('wakeBtn').classList.remove('listening');

    $('wakeBtn').innerHTML =
      '<span class="pulse-dot"></span> Enable “Hey Anyman”';
  }
}

// ==========================================
// 15. WAKE WORD BUTTON
// ==========================================

if ($('wakeBtn')) {
  $('wakeBtn').addEventListener('click', () => {
    if (state.wakeListening) {
      stopWake();
    } else {
      startWake();
    }
  });
}

// ==========================================
// 16. ONE-TIME VOICE INPUT
// ==========================================

if ($('voiceInputBtn')) {
  $('voiceInputBtn').addEventListener('click', () => {
    if (state.voiceRecognition) {
      try {
        state.voiceRecognition.stop();
      } catch {
        // Already stopped.
      }

      state.voiceRecognition = null;
    }

    const recognition = makeRecognition();

    if (!recognition) {
      toast('Speech recognition is not supported in this browser.');
      return;
    }

    state.voiceRecognition = recognition;

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript.trim();

      if ($('chatInput')) {
        $('chatInput').value = spokenText;
      }

      state.voiceRecognition = null;
      sendMessage(spokenText);
    };

    recognition.onerror = (event) => {
      state.voiceRecognition = null;
      toast(`Microphone error: ${event.error}`);
    };

    recognition.onend = () => {
      state.voiceRecognition = null;
    };

    try {
      recognition.start();
      toast('Listening… speak now.');
    } catch {
      state.voiceRecognition = null;
      toast('Microphone is already active. Please try again.');
    }
  });
}

// ==========================================
// 17. IMAGE FILE TO DATA URL
// ==========================================

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () => reject(
      new Error('Could not read the selected image.')
    );

    reader.readAsDataURL(file);
  });
}

// ==========================================
// 18. IMAGE OPTIMIZATION
// ==========================================

async function optimizeImage(file) {
  const data = await fileToDataUrl(file);

  const image = new Image();
  image.src = data;

  await new Promise((resolve, reject) => {
    image.onload = resolve;

    image.onerror = () => reject(
      new Error('Could not load this image.')
    );
  });

  const scale = Math.min(
    1,
    1600 / Math.max(image.width, image.height)
  );

  const canvas = document.createElement('canvas');

  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Image processing is not supported.');
  }

  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL('image/jpeg', 0.82);
}

// ==========================================
// 19. IMAGE FILE SELECTION
// ==========================================

if ($('imageInput')) {
  $('imageInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      toast('Please choose a JPG, PNG or WebP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 7 * 1024 * 1024) {
      toast('Image must be smaller than 7 MB.');
      event.target.value = '';
      return;
    }

    try {
      state.imageData = await optimizeImage(file);

      $('imagePreview').src = state.imageData;
      $('previewWrap').hidden = false;
      $('dropZone').hidden = true;
      $('analyzeBtn').disabled = false;

      $('visionResult').textContent =
        'Image ready for analysis. Select Analyze image.';

      $('visionTag').textContent = 'READY';
    } catch (error) {
      state.imageData = null;
      toast(error.message || 'Could not read this image.');
    }
  });
}

// ==========================================
// 20. CLEAR SELECTED IMAGE
// ==========================================

function clearImage() {
  if ($('imageInput')) {
    $('imageInput').value = '';
  }

  state.imageData = null;

  if ($('previewWrap')) {
    $('previewWrap').hidden = true;
  }

  if ($('dropZone')) {
    $('dropZone').hidden = false;
  }

  if ($('analyzeBtn')) {
    $('analyzeBtn').disabled = true;
  }

  if ($('visionTag')) {
    $('visionTag').textContent = 'WAITING';
  }

  if ($('visionResult')) {
    $('visionResult').textContent = '';
  }

  state.lastVision = '';
}

if ($('removeImageBtn')) {
  $('removeImageBtn').addEventListener('click', clearImage);
}

// ==========================================
// 21. IMAGE ANALYSIS
// ==========================================

async function analyzeImage(data, prompt, target, tag, speakButton) {
  if (!data) {
    toast('Please select an image first.');
    return '';
  }

  target.textContent = 'ANIVISION is examining the image…';
  tag.textContent = 'ANALYZING';

  if (speakButton) {
    speakButton.disabled = true;
  }

  try {
    const result = await api('/api/vision', {
      image: data,

      prompt: prompt ||
        'Identify the main objects visible in this image. ' +
        'Start with a short line: Detected: followed by the object names. ' +
        'Then describe visible details.'
    });

    const answer = cleanAssistantText(result.text || '');

    target.textContent = answer || 'No analysis result was returned.';
    tag.textContent = 'COMPLETE';

    if (speakButton) {
      speakButton.disabled = !answer;
    }

    return answer;
  } catch (error) {
    target.textContent = error.message;
    tag.textContent = 'ERROR';

    if (speakButton) {
      speakButton.disabled = true;
    }

    toast(error.message);
    return '';
  }
}

// ==========================================
// 22. ANALYZE UPLOADED IMAGE
// ==========================================

if ($('analyzeBtn')) {
  $('analyzeBtn').addEventListener('click', async () => {
    if (!state.imageData) {
      toast('Please select an image first.');
      return;
    }

    stopSpeech();

    $('analyzeBtn').disabled = true;

    try {
      state.lastVision = await analyzeImage(
        state.imageData,
        $('visionPrompt')?.value || '',
        $('visionResult'),
        $('visionTag'),
        $('speakVisionBtn')
      );
    } finally {
      $('analyzeBtn').disabled = false;
    }
  });
}

// ==========================================
// 23. SPEAK IMAGE RESULT
// ==========================================

if ($('speakVisionBtn')) {
  $('speakVisionBtn').dataset.defaultLabel =
    '🔊 Listen to result';

  $('speakVisionBtn').addEventListener('click', () => {
    speakText(state.lastVision, $('speakVisionBtn'));
  });
}

// ==========================================
// 24. START LIVE CAMERA
// ==========================================

async function startCamera() {
  if (state.cameraStream) return;

  const video = $('cameraVideo');

  if (!video) {
    toast('Camera video element was not found.');
    return;
  }

  if ($('cameraError')) {
    $('cameraError').textContent = '';
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    const message =
      'Camera needs HTTPS or localhost, and a supported browser.';

    if ($('cameraError')) {
      $('cameraError').textContent = message;
    }

    toast(message);
    return;
  }

  $('startCameraBtn').disabled = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    state.cameraStream = stream;

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await new Promise((resolve, reject) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }

      video.onloadedmetadata = resolve;

      video.onerror = () => {
        reject(new Error('Could not load camera video.'));
      };
    });

    await video.play();

    $('cameraPlaceholder').hidden = true;
    $('cameraLive').hidden = false;

    $('captureBtn').disabled = false;
    $('stopCameraBtn').disabled = false;

    toast('Camera started.');
  } catch (error) {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((track) => {
        track.stop();
      });

      state.cameraStream = null;
    }

    video.srcObject = null;

    $('cameraPlaceholder').hidden = false;
    $('cameraLive').hidden = true;
    $('startCameraBtn').disabled = false;

    const messages = {
      NotAllowedError:
        'Camera permission was blocked. Allow camera access for this site.',

      NotFoundError:
        'No camera was found on this device.',

      NotReadableError:
        'The camera may be in use by another app. Close other apps using it.',

      OverconstrainedError:
        'The selected camera settings are not supported by this device.',

      SecurityError:
        'Camera access is blocked by the browser security settings.'
    };

    const message =
      messages[error.name] ||
      `Camera error: ${error.message}`;

    if ($('cameraError')) {
      $('cameraError').textContent = message;
    }

    toast(message);
  }
}

// ==========================================
// 25. STOP LIVE CAMERA
// ==========================================

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => {
      track.stop();
    });

    state.cameraStream = null;
  }

  const video = $('cameraVideo');

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if ($('cameraPlaceholder')) {
    $('cameraPlaceholder').hidden = false;
  }

  if ($('cameraLive')) {
    $('cameraLive').hidden = true;
  }

  if ($('startCameraBtn')) {
    $('startCameraBtn').disabled = false;
  }

  if ($('captureBtn')) {
    $('captureBtn').disabled = true;
  }

  if ($('stopCameraBtn')) {
    $('stopCameraBtn').disabled = true;
  }
}

// ==========================================
// 26. CAMERA BUTTONS
// ==========================================

if ($('startCameraBtn')) {
  $('startCameraBtn').addEventListener('click', startCamera);
}

if ($('stopCameraBtn')) {
  $('stopCameraBtn').addEventListener('click', stopCamera);
}

// ==========================================
// 27. MIRRORED CAMERA CAPTURE
// ==========================================

if ($('captureBtn')) {
  $('captureBtn').addEventListener('click', async () => {
    const video = $('cameraVideo');

    if (
      !state.cameraStream ||
      !video ||
      video.readyState < 2 ||
      !video.videoWidth
    ) {
      toast('Camera is not ready yet.');
      return;
    }

    stopSpeech();

    const canvas = document.createElement('canvas');

    const scale = Math.min(
      1,
      1600 / video.videoWidth
    );

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext('2d');

    if (!context) {
      toast('Could not capture the camera image.');
      return;
    }

    // Mirror the captured image horizontally.
    context.translate(canvas.width, 0);
    context.scale(-1, 1);

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = canvas.toDataURL('image/jpeg', 0.82);

    $('captureBtn').disabled = true;

    try {
      state.lastCamera = await analyzeImage(
        imageData,

        'Identify the main objects visible in this camera image. ' +
        'Start with Detected: followed by the object names. ' +
        'Then describe the visible details.',

        $('cameraResult'),
        $('cameraTag'),
        $('speakCameraBtn')
      );
    } finally {
      $('captureBtn').disabled = !state.cameraStream;
    }
  });
}

// ==========================================
// 28. SPEAK CAMERA RESULT
// ==========================================

if ($('speakCameraBtn')) {
  $('speakCameraBtn').dataset.defaultLabel =
    '🔊 Listen to result';

  $('speakCameraBtn').addEventListener('click', () => {
    speakText(state.lastCamera, $('speakCameraBtn'));
  });
}

// ==========================================
// 29. REFRESH STATUS BUTTON
// ==========================================

if ($('refreshStatusBtn')) {
  $('refreshStatusBtn').addEventListener('click', refreshStatus);
}

// ==========================================
// 30. CLEANUP WHEN PAGE CLOSES
// ==========================================

window.addEventListener('pagehide', () => {
  stopSpeech();
  stopWake();
  stopCamera();

  if (state.voiceRecognition) {
    try {
      state.voiceRecognition.stop();
    } catch {
      // Recognition may already be stopped.
    }

    state.voiceRecognition = null;
  }
});

// ==========================================
// 31. INITIALIZE APP
// ==========================================

refreshStatus();