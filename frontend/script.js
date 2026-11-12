'use strict';

const $ = (id) => document.getElementById(id);
const views = ['chat', 'vision', 'camera', 'settings'];
const state = {
  history: [],
  imageData: null,
  cameraStream: null,
  recognition: null,
  wakeListening: false,
  busy: false,
  lastVision: '',
  lastCamera: '',
  speechLanguage: localStorage.getItem('ani-speech-language') || 'en-IN',
  activeSpeechButton: null
};

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3200);
}

function setView(name) {
  views.forEach((view) => $('view-' + view).classList.toggle('active', view === name));
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === name);
  });
  $('pageTitle').textContent = {
    chat: 'AI Chat',
    vision: 'Image Analysis',
    camera: 'Live Camera',
    settings: 'Settings'
  }[name] || 'ANIVISION';
}

document.querySelectorAll('.nav-btn').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

document.querySelectorAll('.suggestion').forEach((button) => {
  button.addEventListener('click', () => {
    $('chatInput').value = button.dataset.prompt;
    sendMessage();
  });
});

$('themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('ani-theme', document.body.classList.contains('light') ? 'light' : 'dark');
});
if (localStorage.getItem('ani-theme') === 'light') document.body.classList.add('light');

$('speechLanguage').value = state.speechLanguage;
$('speechLanguage').addEventListener('change', (event) => {
  state.speechLanguage = event.target.value;
  localStorage.setItem('ani-speech-language', state.speechLanguage);
  if (state.wakeListening) {
    stopWake();
    startWake();
  }
});

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The server returned an unreadable response.');
  }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function refreshStatus() {
  try {
    const health = await api('/api/health');
    const config = await api('/api/config');
    const configured = Boolean(config.geminiConfigured);

    $('apiDot').classList.toggle('online', configured);
    $('apiLabel').textContent = configured ? 'ANIVISION connected' : 'AI API not configured';
    $('topStatus').textContent = configured ? 'ANIVISION ready' : 'API key required';
    $('topStatus').previousElementSibling.classList.toggle('online', configured);
    $('backendState').textContent = health.ok ? 'Online' : 'Offline';
    $('aiState').textContent = configured ? 'Configured' : 'Not configured';
    $('aiState').style.color = configured ? '#55d8a4' : '#e5b45d';
  } catch (error) {
    $('apiLabel').textContent = 'Backend unavailable';
    $('topStatus').textContent = 'Offline';
    $('backendState').textContent = 'Offline';
    $('aiState').textContent = 'Unavailable';
  }

  $('recognitionState').textContent =
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) ? 'Supported' : 'Not supported';
  $('speechState').textContent = 'speechSynthesis' in window ? 'Supported' : 'Not supported';
}

function resetSpeechButton(button) {
  if (!button) return;
  button.classList.remove('is-speaking');
  button.textContent = button.dataset.defaultLabel || '🔊 Listen';
  button.setAttribute('aria-pressed', 'false');
  if (state.activeSpeechButton === button) state.activeSpeechButton = null;
}

function stopSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  resetSpeechButton(state.activeSpeechButton);
}

function speakText(text, button) {
  if (!('speechSynthesis' in window)) {
    toast('Speech output is not supported in this browser.');
    return;
  }
  if (!text || !text.trim()) return;

  if (state.activeSpeechButton === button && window.speechSynthesis.speaking) {
    stopSpeech();
    return;
  }

  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.speechLanguage;
  utterance.rate = 1;
  state.activeSpeechButton = button;

  if (button) {
    button.dataset.defaultLabel ||= button.textContent;
    button.textContent = '■ Stop';
    button.classList.add('is-speaking');
    button.setAttribute('aria-pressed', 'true');
  }

  utterance.onend = () => resetSpeechButton(button);
  utterance.onerror = () => resetSpeechButton(button);
  window.speechSynthesis.speak(utterance);
}

function addMessage(role, text) {
  $('welcomePanel').hidden = true;
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
    speak.addEventListener('click', () => speakText(text, speak));
    tools.appendChild(speak);
    content.appendChild(tools);
  }

  row.append(avatar, content);
  $('chatMessages').appendChild(row);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
}

function setBusy(value) {
  state.busy = value;
  $('sendBtn').disabled = value;
  $('sendBtn').textContent = value ? '…' : '➤';
}

async function sendMessage(text) {
  if (state.busy) return;
  const message = (text ?? $('chatInput').value).trim();
  if (!message) return;

  stopSpeech();
  $('chatInput').value = '';
  addMessage('user', message);
  state.history.push({ role: 'user', content: message });
  setBusy(true);

  const pending = document.createElement('div');
  pending.className = 'message assistant';
  pending.innerHTML = '<div class="avatar">AI</div><div class="bubble">Thinking…</div>';
  $('chatMessages').appendChild(pending);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;

  try {
    const result = await api('/api/chat', {
      message,
      history: state.history.slice(-12, -1)
    });
    pending.remove();
    addMessage('assistant', result.text);
    state.history.push({ role: 'assistant', content: result.text });
    if (state.history.length > 40) state.history = state.history.slice(-40);
  } catch (error) {
    pending.remove();
    addMessage('assistant', `I couldn't complete that request. ${error.message}`);
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

$('sendBtn').addEventListener('click', () => sendMessage());
$('chatInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
$('chatInput').addEventListener('input', (event) => {
  event.target.style.height = 'auto';
  event.target.style.height = Math.min(event.target.scrollHeight, 130) + 'px';
});

function makeRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = state.speechLanguage;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

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
  $('wakeBtn').classList.add('listening');
  $('wakeBtn').innerHTML = '<span class="pulse-dot"></span> Listening for “Hey Anyman” · Stop';

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (!event.results[i].isFinal) continue;
      const heard = event.results[i][0].transcript.trim();
      const match = heard.match(/hey\s+(?:anyvision|anivision|anyman|aniket)/i);
      if (!match) continue;

      setView('chat');
      const rest = heard.slice(match[0].length).trim().replace(/^[,.:;\s]+/, '');
      toast('Hey Anyman is listening.');
      if (rest) sendMessage(rest);
      else $('chatInput').focus();
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      stopWake();
      toast('Microphone permission was denied. Allow it in browser settings.');
    } else if (event.error !== 'no-speech') {
      toast(`Voice error: ${event.error}`);
    }
  };

  recognition.onend = () => {
    if (state.wakeListening) {
      try { recognition.start(); } catch { /* Browser is restarting recognition. */ }
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
    state.recognition.stop();
    state.recognition = null;
  }
  $('wakeBtn').classList.remove('listening');
  $('wakeBtn').innerHTML = '<span class="pulse-dot"></span> Enable “Hey Anyman”';
}

$('wakeBtn').addEventListener('click', () => {
  state.wakeListening ? stopWake() : startWake();
});

$('voiceInputBtn').addEventListener('click', () => {
  const recognition = makeRecognition();
  if (!recognition) {
    toast('Speech recognition is not supported in this browser.');
    return;
  }
  recognition.onresult = (event) => {
    const spokenText = event.results[0][0].transcript;
    $('chatInput').value = spokenText;
    sendMessage(spokenText);
  };
  recognition.onerror = (event) => toast(`Microphone error: ${event.error}`);
  try {
    recognition.start();
    toast('Listening… speak now.');
  } catch {
    toast('Microphone is already active.');
  }
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function optimizeImage(file) {
  const data = await fileToDataUrl(file);
  const image = new Image();
  image.src = data;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

$('imageInput').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    toast('Please choose a JPG, PNG or WebP image.');
    return;
  }
  if (file.size > 7 * 1024 * 1024) {
    toast('Image must be smaller than 7 MB.');
    return;
  }

  try {
    state.imageData = await optimizeImage(file);
    $('imagePreview').src = state.imageData;
    $('previewWrap').hidden = false;
    $('dropZone').hidden = true;
    $('analyzeBtn').disabled = false;
    $('visionResult').textContent = 'Image ready for analysis. Select Analyze image.';
    $('visionTag').textContent = 'READY';
  } catch {
    toast('Could not read this image.');
  }
});

function clearImage() {
  $('imageInput').value = '';
  state.imageData = null;
  $('previewWrap').hidden = true;
  $('dropZone').hidden = false;
  $('analyzeBtn').disabled = true;
  $('visionTag').textContent = 'WAITING';
}
$('removeImageBtn').addEventListener('click', clearImage);

async function analyzeImage(data, prompt, target, tag, speakButton) {
  target.textContent = 'ANIVISION is examining the image…';
  tag.textContent = 'ANALYZING';
  speakButton.disabled = true;

  try {
    const result = await api('/api/vision', {
      image: data,
      prompt: prompt || 'Identify the main object or objects visible in this image. Start with a short line: “Detected: [object name(s)]”. Then describe visible details.'
    });
    target.textContent = result.text;
    tag.textContent = 'COMPLETE';
    speakButton.disabled = false;
    return result.text;
  } catch (error) {
    target.textContent = error.message;
    tag.textContent = 'ERROR';
    toast(error.message);
    return '';
  }
}

$('analyzeBtn').addEventListener('click', async () => {
  if (!state.imageData) return;
  stopSpeech();
  state.lastVision = await analyzeImage(
    state.imageData,
    $('visionPrompt').value,
    $('visionResult'),
    $('visionTag'),
    $('speakVisionBtn')
  );
});

$('speakVisionBtn').dataset.defaultLabel = '🔊 Listen to result';
$('speakVisionBtn').addEventListener('click', () => {
  speakText(state.lastVision, $('speakVisionBtn'));
});

async function startCamera() {
  if (state.cameraStream) return;
  const video = $('cameraVideo');
  $('cameraError').textContent = '';

  if (!navigator.mediaDevices?.getUserMedia) {
    $('cameraError').textContent = 'Camera needs HTTPS or localhost, and a supported browser.';
    toast('Camera access is unavailable in this page context.');
    return;
  }

  $('startCameraBtn').disabled = true;
  try {
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = state.cameraStream;
    video.muted = true;
    await new Promise((resolve) => {
      if (video.readyState >= 2) return resolve();
      video.onloadedmetadata = resolve;
    });
    await video.play();

    $('cameraPlaceholder').hidden = true;
    $('cameraLive').hidden = false;
    $('captureBtn').disabled = false;
    $('stopCameraBtn').disabled = false;
    toast('Camera started.');
  } catch (error) {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((track) => track.stop());
      state.cameraStream = null;
    }
    video.srcObject = null;
    $('cameraPlaceholder').hidden = false;
    $('cameraLive').hidden = true;
    $('startCameraBtn').disabled = false;

    const messages = {
      NotAllowedError: 'Camera permission was blocked. Allow camera access for this site.',
      NotFoundError: 'No camera was found on this device.',
      NotReadableError: 'The camera may be in use by another app. Close other apps using it.',
      OverconstrainedError: 'The selected camera settings are not supported by this device.',
      SecurityError: 'Camera access is blocked by the browser security settings.'
    };
    $('cameraError').textContent = messages[error.name] || `Camera error: ${error.message}`;
    toast($('cameraError').textContent);
  }
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
  }
  const video = $('cameraVideo');
  video.pause();
  video.srcObject = null;
  $('cameraPlaceholder').hidden = false;
  $('cameraLive').hidden = true;
  $('startCameraBtn').disabled = false;
  $('captureBtn').disabled = true;
  $('stopCameraBtn').disabled = true;
}

$('startCameraBtn').addEventListener('click', startCamera);
$('stopCameraBtn').addEventListener('click', stopCamera);

$('captureBtn').addEventListener('click', async () => {
  const video = $('cameraVideo');
  if (!state.cameraStream || video.readyState < 2 || !video.videoWidth) {
    toast('Camera is not ready yet.');
    return;
  }

  stopSpeech();
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1600 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);

  const context = canvas.getContext('2d');
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = canvas.toDataURL('image/jpeg', 0.82);
  state.lastCamera = await analyzeImage(
    imageData,
    'Identify the main object or objects visible in this camera image. Start with “Detected: [object name(s)]”. Then describe the visible details.',
    $('cameraResult'),
    $('cameraTag'),
    $('speakCameraBtn')
  );
});

$('speakCameraBtn').dataset.defaultLabel = '🔊 Listen to result';
$('speakCameraBtn').addEventListener('click', () => {
  speakText(state.lastCamera, $('speakCameraBtn'));
});

$('refreshStatusBtn').addEventListener('click', refreshStatus);

window.addEventListener('pagehide', () => {
  stopSpeech();
  stopWake();
  stopCamera();
});

refreshStatus();
