
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
// 2. CLEAN TEXT SYSTEM
// ==========================================

function cleanAssistantText(value) {
  if (typeof value !== 'string') return '';

  return value
    // Remove markdown code blocks.
    .replace(/```[\s\S]*?```/g, ' ')

    // Convert markdown links to their visible text.
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    // Remove URLs.
    .replace(/https?:\/\/\S+/gi, ' ')

    // Remove markdown headings and quote markers.
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*>\s*/gm, '')

    // Remove markdown bullet characters.
    .replace(/^\s*[-+*]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')

    // Remove bold, italic and inline code markers.
    .replace(/[*_`~]/g, '')

    // Keep normal readable letters, numbers and punctuation.
    .replace(/[^\p{L}\p{N}\s.,?!।]/gu, ' ')

    // Remove excessive punctuation.
    .replace(/[.,?!।]{2,}/g, '.')

    // Normalize whitespace.
    .replace(/\s+/g, ' ')
    .trim()

    // Make English text lowercase.
    .toLocaleLowerCase('en-IN');
}

// ==========================================
// 3. ANIVISION PROJECT INFORMATION
// ==========================================

const PROJECT_INFO = {

  founder:
    'aniket singh is the founder, maker and developer of anivision. he created this project with his team as a science exhibition project.',

  biography:
    'aniket singh is the founder and developer of anivision. he is associated with gyan bharati school, naveen nagar, nawada, bihar, india. he developed anivision with his team for a school science exhibition. the project reflects an interest in artificial intelligence, software development, computer vision and interactive technology.',

  purpose:
    'anivision was developed by aniket singh and his team as a science exhibition project for gyan bharati school, located in naveen nagar, nawada, bihar, india. the main purpose of this project is to demonstrate how artificial intelligence can be used in everyday life through an interactive personal assistant. it brings ai-powered conversations, voice interaction and image understanding together in one application. the project aims to make technology more interactive, accessible and easier to understand. it also demonstrates the practical connection between software development and artificial intelligence.',

  identity:
    'anivision is a personal ai voice and vision assistant developed by aniket singh and his team. it is a science exhibition project associated with gyan bharati school, naveen nagar, nawada, bihar, india. it combines ai conversations, voice interaction and image analysis.',

  school:
    'anivision was developed as a science exhibition project associated with gyan bharati school, naveen nagar, nawada, bihar, india.',

  features:
    'anivision includes ai-powered conversations, voice input, speech output, image analysis and live camera-based object recognition. its goal is to demonstrate how ai can understand questions and help users interact with visual information.'
};

// ==========================================
// 4. PERSONAL KNOWLEDGE RECOGNITION
// ==========================================

function normalizeQuestion(message) {
  return message
    .toLocaleLowerCase('en-IN')
    .replace(/[?!.,;:'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getProjectAnswer(message) {

  const q = normalizeQuestion(message);

  const has = (patterns) =>
    patterns.some(pattern => pattern.test(q));

  const containsHindi = (...words) =>
    words.some(word => q.includes(word));

  // ----------------------------------------
  // FOUNDER, CREATOR, MAKER AND DEVELOPER
  // ----------------------------------------

  const founderQuestion = has([
    /\bfounder\b/,
    /\bcreator\b/,
    /\bmaker\b/,
    /\bdeveloper\b/,
    /\bwho made you\b/,
    /\bwho made anivision\b/,
    /\bwho created you\b/,
    /\bwho created anivision\b/,
    /\bwho built you\b/,
    /\bwho built anivision\b/,
    /\bwho developed you\b/,
    /\bwho developed anivision\b/,
    /\bdeveloper of anivision\b/,
    /\bfounder of anivision\b/,
    /\bcreator of anivision\b/,
    /\bmaker of anivision\b/,
    /\bwho is the founder\b/,
    /\bwho is your founder\b/,
    /\bwho is your developer\b/,
    /\bwho is your maker\b/,
    /\bwho is your creator\b/,
    /\bwho owns anivision\b/,
    /\bowner of anivision\b/,
    /\bmade by whom\b/,
    /\bcreated by whom\b/,
    /\bdeveloped by whom\b/
  ]) || containsHindi(
    'किसने बनाया',
    'किसने बनाया है',
    'किसने विकसित किया',
    'किसने बनाया था',
    'संस्थापक कौन',
    'डेवलपर कौन',
    'निर्माता कौन',
    'मेकर कौन',
    'किसने बनाया तुम्हें',
    'तुम्हें किसने बनाया'
  ) || has([
    /founder kaun/,
    /developer kaun/,
    /maker kaun/,
    /kisne banaya/,
    /kisne develop kiya/,
    /kisne create kiya/,
    /kisne banayi/,
    /kaun banaya/,
    /kaun hai tumhara founder/,
    /kaun hai tumhara developer/,
    /banane wala kaun/,
    /banaya kisne/
  ]);

  if (founderQuestion) {
    return PROJECT_INFO.biography;
  }

  // ----------------------------------------
  // TELL ME MORE ABOUT FOUNDER
  // ----------------------------------------

  if (has([
    /\babout the founder\b/,
    /\btell me about the founder\b/,
    /\btell me more about the founder\b/,
    /\bmore about the founder\b/,
    /\bfounder biography\b/,
    /\bfounder background\b/,
    /\bfounder profile\b/,
    /\bwho is aniket singh\b/,
    /\btell me about aniket\b/,
    /\bmore about aniket\b/,
    /\baniket singh biography\b/,
    /\baniket singh profile\b/
  ]) || containsHindi(
    'संस्थापक के बारे में',
    'डेवलपर के बारे में',
    'अनिकेत सिंह के बारे में',
    'अनिकेत के बारे में'
  ) || has([
    /founder ke bare mein/,
    /founder ke baare mein/,
    /founder ki information/,
    /founder ki biography/,
    /aniket ke bare mein/,
    /aniket ke baare mein/
  ])) {
    return PROJECT_INFO.biography;
  }

  // ----------------------------------------
  // PROJECT PURPOSE AND REASON
  // ----------------------------------------

  if (has([
    /\bwhy was this project made\b/,
    /\bwhy was anivision made\b/,
    /\bwhy was anivision created\b/,
    /\bwhy did you create this\b/,
    /\bwhy did aniket create this\b/,
    /\bwhy did aniket make anivision\b/,
    /\bwhy this project\b/,
    /\bwhat is the purpose\b/,
    /\bwhat is the main purpose\b/,
    /\bwhat is the aim\b/,
    /\bwhat is the objective\b/,
    /\bmain objective\b/,
    /\bproject purpose\b/,
    /\bproject reason\b/,
    /\bwhy did you build this\b/,
    /\bwhy have you built this\b/,
    /\bwhy are you made\b/,
    /\bscience exhibition\b/,
    /\bschool exhibition\b/,
    /\bwhy anivision\b/,
    /\bwhat problem does anivision solve\b/
  ]) || containsHindi(
    'क्यों बनाया',
    'क्यों बनाई',
    'क्यों बनाया गया',
    'क्यों बनाई गई',
    'किस उद्देश्य से',
    'क्या उद्देश्य है',
    'मुख्य उद्देश्य',
    'बनाने का कारण',
    'प्रोजेक्ट क्यों',
    'विज्ञान प्रदर्शनी',
    'साइंस एग्जिबिशन',
    'क्यों बनाया गया है'
  ) || has([
    /project kyun banaya/,
    /project kyu banaya/,
    /anivision kyun banaya/,
    /anivision kyu banaya/,
    /project ka maksad/,
    /project ka uddeshya/,
    /banane ka karan/,
    /banane ki wajah/,
    /kisliye banaya/,
    /science exhibition ke liye/
  ])) {
    return PROJECT_INFO.purpose;
  }

  // ----------------------------------------
  // FOUNDER EDUCATION AND SCHOOL
  // ----------------------------------------

  if (has([
    /\bfounder education\b/,
    /\bwhere does the founder study\b/,
    /\bwhich school does the founder attend\b/,
    /\bwhich school does aniket attend\b/,
    /\baniket school\b/,
    /\bschool of aniket\b/,
    /\bfounder school\b/,
    /\bwhich school made anivision\b/
  ]) || containsHindi(
    'किस स्कूल में',
    'कौन से स्कूल',
    'कौन सा स्कूल',
    'किस विद्यालय',
    'अनिकेत कहां पढ़ता',
    'अनिकेत किस स्कूल'
  ) || has([
    /founder kahan padhta/,
    /founder kaha padhta/,
    /founder ki education/,
    /aniket kahan padhta/,
    /aniket kaha padhta/,
    /school ka naam/
  ])) {
    return PROJECT_INFO.school;
  }

  // ----------------------------------------
  // PROJECT LOCATION
  // ----------------------------------------

  if (has([
    /\bwhere is anivision from\b/,
    /\bwhere was anivision developed\b/,
    /\bwhere is the project located\b/,
    /\bwhere is the school located\b/,
    /\bproject location\b/,
    /\bwhich city is anivision from\b/,
    /\bwhere is naveen nagar\b/,
    /\bwhere is nawada\b/,
    /\bwhere is bihar\b/
  ]) || containsHindi(
    'कहां स्थित',
    'कहाँ स्थित',
    'कहां बना',
    'कहाँ बना',
    'किस जगह',
    'किस स्थान',
    'किस जिले',
    'नवादा कहां',
    'नवादा कहाँ',
    'नवीन नगर कहां',
    'नवीन नगर कहाँ'
  ) || has([
    /project kahan ka hai/,
    /project kaha ka hai/,
    /anivision kahan ka hai/,
    /anivision kaha ka hai/,
    /nawada kahan hai/,
    /nawada kaha hai/,
    /naveen nagar kahan hai/,
    /school kahan hai/
  ])) {
    return PROJECT_INFO.school;
  }

  // ----------------------------------------
  // PROJECT IDENTITY
  // ----------------------------------------

  if (has([
    /\bwhat is anivision\b/,
    /\bwhat is ani vision\b/,
    /\babout anivision\b/,
    /\babout this project\b/,
    /\bdescribe anivision\b/,
    /\bintroduce anivision\b/,
    /\bexplain this project\b/,
    /\bwhat are you\b/,
    /\bwho are you\b/,
    /\bintroduce yourself\b/
  ]) || containsHindi(
    'अनिविजन क्या है',
    'अनिविज़न क्या है',
    'यह प्रोजेक्ट क्या है',
    'तुम कौन हो',
    'अपना परिचय'
  ) || has([
    /anivision kya hai/,
    /anivision kya hota hai/,
    /ye project kya hai/,
    /yeh project kya hai/
  ])) {
    return PROJECT_INFO.identity;
  }

  // ----------------------------------------
  // PROJECT FEATURES
  // ----------------------------------------

  if (has([
    /\bfeatures\b/,
    /\bwhat can anivision do\b/,
    /\bwhat does anivision do\b/,
    /\bcapabilities\b/,
    /\bfunctions of anivision\b/,
    /\bwhat are your features\b/,
    /\bwhat can you do\b/
  ]) || containsHindi(
    'क्या कर सकते हो',
    'क्या कर सकता है',
    'फीचर्स बताओ',
    'क्या विशेषताएं',
    'क्या क्या कर सकते'
  ) || has([
    /anivision ke features/,
    /anivision kya kar sakta/,
    /anivision kya kya karta/
  ])) {
    return PROJECT_INFO.features;
  }

  // ----------------------------------------
  // FOUNDER NAME ONLY
  // ----------------------------------------

  if (has([
    /\baniket singh\b/,
    /\bfounder name\b/,
    /\byour founder name\b/
  ]) || containsHindi(
    'अनिकेत सिंह',
    'संस्थापक का नाम',
    'डेवलपर का नाम'
  )) {
    return PROJECT_INFO.founder;
  }

  // No matching personal knowledge.
  return null;
}

// ==========================================
// 5. GEMINI API REQUEST
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
            maxOutputTokens: 1400,
            temperature: 0.5
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

      const rawText = (
        payload?.candidates?.[0]?.content?.parts || []
      )
        .map(part => part.text || '')
        .join('\n')
        .trim();

      if (!rawText) {
        throw Object.assign(
          new Error('Gemini returned an empty response.'),
          { status: 502 }
        );
      }

      console.log('[GEMINI SUCCESS] Response received.');

      return cleanAssistantText(rawText);

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
// 6. HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {

  res.json({
    ok: true,
    service: 'ANIVISION backend'
  });

});

// ==========================================
// 7. CONFIGURATION CHECK
// ==========================================

app.get('/api/config', (req, res) => {

  res.json({
    geminiConfigured: configured()
  });

});

// ==========================================
// 8. AI CHAT + CUSTOM KNOWLEDGE
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

    // Check ANIVISION's own knowledge first.
    const projectAnswer = getProjectAnswer(message);

    if (projectAnswer) {

      console.log('[ANIVISION KNOWLEDGE] Custom answer found.');

      return res.json({
        text: cleanAssistantText(projectAnswer),
        source: 'anivision_knowledge'
      });

    }

    // Unknown questions are sent to Gemini.
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

      'Reply in the same language as the user, including Hindi, Hinglish or English. ' +

      'IMPORTANT TEXT RULES: ' +

      'Write all English words in lowercase only. ' +

      'Never use uppercase English letters. ' +

      'Do not use markdown formatting, headings, hashtags, asterisks, decorative symbols, emojis or unnecessary special characters. ' +

      'Use simple natural sentences and normal spaces. ' +

      'Use as few punctuation marks as possible. ' +

      'Do not spell out individual uppercase letters. ' +

      'Make every answer easy for a text-to-speech voice to read aloud. ' +

      'Do not invent personal information about the founder. ' +

      'If you do not know something, clearly say you do not know. ' +

      'For questions about ANIVISION, its founder, developer, creator, maker or purpose, use only the established project information. ' +

      'The founder and developer is Aniket Singh. ' +

      'ANIVISION was developed by Aniket Singh with his team as a science exhibition project associated with Gyan Bharati School, Naveen Nagar, Nawada, Bihar, India.';

    const text = await callGemini(contents, instruction);

    res.json({
      text: cleanAssistantText(text),
      source: 'gemini'
    });

  } catch (error) {
    next(error);
  }

});

// ==========================================
// 9. IMAGE VISION
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

      'Explain visible details and answer the user prompt. ' +

      'Never guess when an object is unclear. ' +

      'Only describe what is visible. ' +

      'Write all English words in lowercase. ' +

      'Never use uppercase English letters. ' +

      'Do not use markdown, asterisks, hashtags, emojis or unnecessary symbols. ' +

      'Use simple sentences suitable for text-to-speech reading. ' +

      'Use minimum punctuation.';

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

    res.json({
      text: cleanAssistantText(text)
    });

  } catch (error) {
    next(error);
  }

});

// ==========================================
// 10. FRONTEND
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
// 11. GLOBAL ERROR HANDLER
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
// 12. START SERVER
// ==========================================

app.listen(PORT, '0.0.0.0', () => {

  console.log('\n================================');
  console.log('ANIVISION SERVER STARTED');
  console.log(`URL: http://localhost:${PORT}`);
  console.log(
    `Gemini configured: ${configured() ? 'YES' : 'NO'}`
  );
  console.log('Custom Knowledge System: ACTIVE');
  console.log('Lowercase Text System: ACTIVE');
  console.log('Clean Response System: ACTIVE');
  console.log('Founder Knowledge: ACTIVE');
  console.log('================================\n');

});
