
'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 5000);

const FRONTEND = path.join(__dirname, '..', 'frontend');
const MAX_IMAGE_CHARS = 9 * 1024 * 1024;

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_API_URL = (process.env.GEMINI_API_URL || '').trim();

const REQUEST_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.AI_TIMEOUT_MS || 60000)
);

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(express.json({ limit: '10mb' }));

// ==========================================
// 1. GEMINI CONFIGURATION
// ==========================================

function configured() {
  return Boolean(GEMINI_API_KEY && GEMINI_API_URL);
}

function geminiEndpoint() {
  if (!configured()) {
    throw Object.assign(
      new Error('Gemini API key or URL is missing in backend/.env'),
      { status: 503 }
    );
  }

  let endpoint;

  try {
    endpoint = new URL(GEMINI_API_URL);
  } catch {
    throw Object.assign(
      new Error('Invalid GEMINI_API_URL'),
      { status: 500 }
    );
  }

  if (endpoint.protocol !== 'https:') {
    throw Object.assign(
      new Error('Gemini API must use HTTPS'),
      { status: 500 }
    );
  }

  endpoint.searchParams.set('key', GEMINI_API_KEY);

  return endpoint;
}

// ==========================================
// 2. ANIVISION PERSONAL KNOWLEDGE SYSTEM
// ==========================================

function getProjectAnswer(message) {

  const q = message
    .toLowerCase()
    .trim()
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ');

  const matches = (patterns) =>
    patterns.some(pattern => pattern.test(q));

  // ----------------------------------------
  // FOUNDER NAME
  // ----------------------------------------

  if (matches([
    /\bfounder\b/,
    /\bcreator\b/,
    /\bwho made you\b/,
    /\bwho created you\b/,
    /\bwho built you\b/,
    /\bwho developed you\b/,
    /\bdeveloper of anivision\b/,
    /\bowner of anivision\b/,
    /\bmade anivision\b/,
    /\bcreated anivision\b/,
    /founder kaun/,
    /kisne banaya/,
    /kaun banaya/
  ])) {
    return 'The founder and creator of ANI-VISION 2.0 is Aniket Singh.';
  }

  // ----------------------------------------
  // FOUNDER BIOGRAPHY
  // ----------------------------------------

  if (matches([
    /\babout the founder\b/,
    /\btell me about the founder\b/,
    /\bmore about the founder\b/,
    /\bfounder biography\b/,
    /\bfounder background\b/,
    /\bwho is aniket singh\b/,
    /\baniket singh profile\b/,
    /\baniket singh biography\b/,
    /founder ke bare mein/,
    /founder ki information/
  ])) {
    return 'Aniket Singh is the founder and developer of ANI-VISION 2.0. He is from Nawada district, Bihar, India, and studies at Gyan Bharati School, Naveen Nagar, Nawada. He developed this project as a school project through his interest in technology and software development.';
  }

  // ----------------------------------------
  // FOUNDER EDUCATION
  // ----------------------------------------

  if (matches([
    /\bfounder education\b/,
    /\bwhere does the founder study\b/,
    /\bwhich school does the founder attend\b/,
    /\bfounder school\b/,
    /\baniket school\b/,
    /\baniket studies\b/,
    /\beducation of aniket\b/,
    /founder kahan padhta/,
    /founder ki education/
  ])) {
    return 'Aniket Singh, the founder of ANI-VISION 2.0, studies at Gyan Bharati School, Naveen Nagar, Nawada, Bihar.';
  }

  // ----------------------------------------
  // FOUNDER LOCATION
  // ----------------------------------------

  if (matches([
    /\bwhere is the founder from\b/,
    /\bwhere does the founder live\b/,
    /\bfounder location\b/,
    /\bfounder hometown\b/,
    /\baniket location\b/,
    /\baniket singh from where\b/,
    /founder kahan rehta/,
    /founder kahan se hai/
  ])) {
    return 'The founder, Aniket Singh, is from Nawada district in Bihar, India.';
  }

  // ----------------------------------------
  // FOUNDER DEVELOPMENT JOURNEY
  // ----------------------------------------

  if (matches([
    /\bfounder journey\b/,
    /\bdeveloper journey\b/,
    /\bhow did the founder learn coding\b/,
    /\bhow did aniket learn development\b/,
    /\bhow was anivision developed\b/,
    /\bfounder hard work\b/,
    /\baniket development journey\b/,
    /coding kaise sikha/,
    /development kaise sikha/,
    /founder ki journey/
  ])) {
    return 'Aniket Singh developed his skills step by step through continuous learning and hard work. He first learned frontend development, then moved towards backend development, and gradually learned full-stack development. He also learned Git and GitHub to understand version control and software project management. ANI-VISION 2.0 is one of his school projects.';
  }

  // ----------------------------------------
  // FRONTEND KNOWLEDGE
  // ----------------------------------------

  if (matches([
    /\bfrontend\b/,
    /\bfront end\b/,
    /\bfrontend development\b/,
    /\bfrontend skills\b/
  ])) {
    return 'The founder, Aniket Singh, learned frontend development as the first stage of his software development journey. Frontend development focuses on the visual interface and user experience of a website or application.';
  }

  // ----------------------------------------
  // BACKEND KNOWLEDGE
  // ----------------------------------------

  if (matches([
    /\bbackend\b/,
    /\bback end\b/,
    /\bbackend development\b/,
    /\bbackend skills\b/
  ])) {
    return 'After learning frontend development, Aniket Singh moved towards backend development. Backend development handles server-side logic, API communication and application functionality.';
  }

  // ----------------------------------------
  // FULL STACK KNOWLEDGE
  // ----------------------------------------

  if (matches([
    /\bfull stack\b/,
    /\bfullstack\b/,
    /\bfull stack developer\b/,
    /\bfull stack development\b/
  ])) {
    return 'Aniket Singh has learned both frontend and backend development and has progressed towards full-stack development. Full-stack development combines the user interface with server-side functionality.';
  }

  // ----------------------------------------
  // GIT AND GITHUB
  // ----------------------------------------

  if (matches([
    /\bgit\b/,
    /\bgithub\b/,
    /\bversion control\b/
  ])) {
    return 'The founder, Aniket Singh, has also learned Git and GitHub. These technologies help developers track code changes, manage project versions and collaborate on software projects.';
  }

  // ----------------------------------------
  // SCHOOL INFORMATION
  // ----------------------------------------

  if (matches([
    /\bschool\b/,
    /\bwhich school\b/,
    /\bschool name\b/,
    /\bschool project\b/,
    /\bproject belongs to which school\b/,
    /kis school/,
    /kaun sa school/
  ])) {
    return 'ANI-VISION 2.0 is a school project of Gyan Bharati School, Naveen Nagar, Nawada, Bihar, India.';
  }

  // ----------------------------------------
  // PROJECT LOCATION
  // ----------------------------------------

  if (matches([
    /\bnawada\b/,
    /\bnaveen nagar\b/,
    /\bbihar\b/,
    /\bindia\b/,
    /\bproject location\b/,
    /\bwhere is this project from\b/,
    /\bwhere is the school located\b/
  ])) {
    return 'ANI-VISION 2.0 is associated with Gyan Bharati School, Naveen Nagar, Nawada district, Bihar, India.';
  }

  // ----------------------------------------
  // PROJECT AIM AND PURPOSE
  // ----------------------------------------

  if (matches([
    /\baim\b/,
    /\bpurpose\b/,
    /\bobjective\b/,
    /\bgoal\b/,
    /\bwhy was this project made\b/,
    /\bwhy was anivision created\b/,
    /\bwhy did you create this\b/,
    /\bwhy this project\b/,
    /\bwhat is the aim\b/,
    /\bwhat is the purpose\b/,
    /project kyun banaya/,
    /project ka maksad/,
    /project ka uddeshya/
  ])) {
    return 'The aim of ANI-VISION 2.0 is to demonstrate the practical use of Artificial Intelligence through an interactive AI workspace. It combines AI-powered conversations and image understanding in one application. It was developed as a school project of Gyan Bharati School, Naveen Nagar, Nawada, Bihar.';
  }

  // ----------------------------------------
  // PROJECT IDENTITY
  // ----------------------------------------

  if (matches([
    /\bwhat is anivision\b/,
    /\bwhat is anivision 2\.0\b/,
    /\babout anivision\b/,
    /\babout this project\b/,
    /\bdescribe anivision\b/,
    /\bintroduce anivision\b/,
    /\bexplain this project\b/,
    /anivision kya hai/
  ])) {
    return 'ANI-VISION 2.0 is a personal AI workspace and school project created by Aniket Singh. It combines an AI chat assistant with image understanding capabilities. The project is associated with Gyan Bharati School, Naveen Nagar, Nawada, Bihar, India.';
  }

  // ----------------------------------------
  // PROJECT FEATURES
  // ----------------------------------------

  if (matches([
    /\bfeatures\b/,
    /\bwhat can anivision do\b/,
    /\bwhat does anivision do\b/,
    /\bcapabilities\b/,
    /\bfunctions of anivision\b/,
    /anivision ke features/
  ])) {
    return 'ANI-VISION 2.0 currently includes AI-powered chat and image analysis. Users can communicate with the AI assistant and upload images to understand their visible contents.';
  }

  // ----------------------------------------
  // PROJECT CREATOR AND SCHOOL COMBINATION
  // ----------------------------------------

  if (matches([
    /\bwho developed this school project\b/,
    /\bwho made this school project\b/,
    /\bproject developer\b/,
    /\bproject created by\b/
  ])) {
    return 'ANI-VISION 2.0 was created by Aniket Singh as a school project associated with Gyan Bharati School, Naveen Nagar, Nawada, Bihar, India.';
  }

  // No matching knowledge: use Gemini
  return null;
}

// ==========================================
// 3. GEMINI API REQUEST
// ==========================================

async function callGemini(contents, systemInstruction) {

  const endpoint = geminiEndpoint();

  const MAX_ATTEMPTS = 4;
  const RETRY_DELAYS = [1500, 3000, 6000];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {

    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {

      const response = await fetch(endpoint, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },

          contents,

          generationConfig: {
            maxOutputTokens: 1400
          }
        }),

        signal: controller.signal
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {

        const message =
          payload?.error?.message || response.statusText;

        console.error(
          `[GEMINI] Attempt ${attempt}/${MAX_ATTEMPTS}`,
          response.status,
          message
        );

        if (
          response.status === 503 &&
          attempt < MAX_ATTEMPTS
        ) {
          await new Promise(resolve =>
            setTimeout(resolve, RETRY_DELAYS[attempt - 1])
          );

          continue;
        }

        throw Object.assign(
          new Error(`Gemini HTTP ${response.status}: ${message}`),
          {
            status:
              response.status === 503 ? 503 :
              response.status === 429 ? 429 : 502
          }
        );
      }

      const text = (
        payload?.candidates?.[0]?.content?.parts || []
      )
        .map(part => part.text || '')
        .join('\n')
        .trim();

      if (!text) {
        throw Object.assign(
          new Error('Gemini returned an empty response.'),
          { status: 502 }
        );
      }

      console.log('[GEMINI SUCCESS] Response received.');

      return text;

    } catch (error) {

      if (error.name === 'AbortError') {
        throw Object.assign(
          new Error('Gemini request timed out.'),
          { status: 504 }
        );
      }

      throw error;

    } finally {
      clearTimeout(timer);
    }
  }
}

// ==========================================
// 4. HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {

  res.json({
    ok: true,
    service: 'ANIVISION backend'
  });

});

// ==========================================
// 5. CONFIGURATION CHECK
// ==========================================

app.get('/api/config', (req, res) => {

  res.json({
    geminiConfigured: configured()
  });

});

// ==========================================
// 6. AI CHAT + CUSTOM KNOWLEDGE
// ==========================================

app.post('/api/chat', async (req, res, next) => {

  try {

    const message =
      typeof req.body?.message === 'string'
        ? req.body.message.trim().slice(0, 5000)
        : '';

    if (!message) {
      return res.status(400).json({
        error: 'Please enter a message.'
      });
    }

    // First check our custom knowledge
    const projectAnswer = getProjectAnswer(message);

    if (projectAnswer) {

      console.log('[ANIVISION KNOWLEDGE] Custom answer found.');

      return res.json({
        text: projectAnswer,
        source: 'anivision_knowledge'
      });

    }

    // If no matching information, use Gemini
    const history = Array.isArray(req.body.history)
      ? req.body.history.slice(-10)
      : [];

    const contents = history
      .filter(item =>
        item &&
        ['user', 'assistant', 'model'].includes(item.role) &&
        typeof item.content === 'string'
      )
      .map(item => ({
        role: item.role === 'assistant' ? 'model' : item.role,

        parts: [
          { text: item.content.slice(0, 2500) }
        ]
      }));

    contents.push({
      role: 'user',

      parts: [
        { text: message }
      ]
    });

    const instruction =
      'You are ANIVISION, a helpful personal AI assistant. ' +
      'Reply in the same language as the user (Hindi, Hinglish or English). ' +
      'Be clear, useful and honest. ' +
      'Do not invent personal information about the founder. ' +
      'If you do not know something, clearly say you do not know.';

    const text = await callGemini(contents, instruction);

    res.json({
      text,
      source: 'gemini'
    });

  } catch (error) {

    next(error);

  }

});

// ==========================================
// 7. IMAGE VISION
// ==========================================

app.post('/api/vision', async (req, res, next) => {

  try {

    const image = req.body?.image;

    if (
      typeof image !== 'string' ||
      image.length > MAX_IMAGE_CHARS
    ) {
      return res.status(413).json({
        error: 'Image is missing or too large. Choose an image under 7 MB.'
      });
    }

    const match = image.match(
      /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i
    );

    if (!match) {
      return res.status(400).json({
        error: 'Please provide a valid JPG, PNG or WebP image.'
      });
    }

    const mimeType = `image/${match[1].toLowerCase()}`;

    const prompt =
      typeof req.body.prompt === 'string'
        ? req.body.prompt.trim().slice(0, 1000)
        : '';

    const instruction =
      'You are ANIVISION, a careful visual AI assistant. ' +
      'Identify visible objects accurately. ' +
      'Start with Detected: followed by the main object names. ' +
      'Explain visible details and answer the user prompt. ' +
      'Never guess when an object is unclear. ' +
      'Only describe what is visible.';

    const contents = [
      {
        role: 'user',

        parts: [
          {
            text: prompt ||
              'Identify the main objects in this image and describe them.'
          },

          {
            inlineData: {
              mimeType,
              data: match[2]
            }
          }
        ]
      }
    ];

    const text = await callGemini(contents, instruction);

    res.json({ text });

  } catch (error) {

    next(error);

  }

});

// ==========================================
// 8. FRONTEND
// ==========================================

app.use(
  express.static(FRONTEND, {
    extensions: ['html']
  })
);

app.get('*', (req, res) => {

  res.sendFile(
    path.join(FRONTEND, 'index.html')
  );

});

// ==========================================
// 9. GLOBAL ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {

  const status =
    Number(error.status) ||
    (error.type === 'entity.too.large' ? 413 : 500);

  if (res.headersSent) {
    return next(error);
  }

  console.error('[SERVER ERROR]', error.message);

  res.status(status).json({

    error:
      status === 500 && !error.status
        ? 'Unexpected server error. Check backend terminal.'
        : error.message

  });

});

// ==========================================
// 10. START SERVER
// ==========================================

app.listen(PORT, '0.0.0.0', () => {

  console.log('\n================================');
  console.log('ANIVISION SERVER STARTED');
  console.log(`URL: http://localhost:${PORT}`);
  console.log(
    `Gemini configured: ${configured() ? 'YES' : 'NO'}`
  );
  console.log('Custom Knowledge System: ACTIVE');
  console.log('================================\n');

});
