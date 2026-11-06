# ANIVISION — Final Project

A single-page Vanilla HTML/CSS/JavaScript assistant powered by Google's Gemini API through a private Node.js + Express backend.

## Features

- Gemini text chat with recent conversation context.
- Browser voice input and spoken AI responses.
- Optional wake phrase **“Hey Anyman”** while the page is open and microphone listening is enabled.
- Image upload with Gemini visual analysis and visible-object identification.
- Live camera preview; capture a frame to identify visible objects with Gemini.
- Single-page navigation, responsive layout, dark/light theme.
- API key stays on the backend in `backend/.env`.

## Requirements

- Node.js 18 or newer (Node.js 20 LTS recommended).
- Internet connection and a Gemini API key with access to the model in your API URL.
- A modern browser. Camera and microphone require `localhost` or HTTPS and user permission.

## Install and run (Windows / VS Code)

1. Extract the project ZIP.
2. Open the `ANIVISION` folder in VS Code.
3. Open a terminal and enter the backend folder:

   ```powershell
   cd backend
   ```

4. This project already includes `package.json`, so npm is initialized. If you ever create a new empty backend folder, run `npm init -y` once.
5. Install the required backend packages:

   ```powershell
   npm install express dotenv
   ```

6. Open `backend/.env` and paste your key after `GEMINI_API_KEY=`. Keep the Gemini URL in `GEMINI_API_URL=`. Paste the exact complete `generateContent` URL supplied for your Gemini model.
7. Start ANIVISION:

   ```powershell
   npm start
   ```

8. Open **http://localhost:5000** in Chrome or Edge.

No npm packages are needed in the frontend. It uses plain HTML, CSS and JavaScript.

## Gemini URL format

The backend uses Gemini's native `generateContent` REST format (not OpenAI-compatible chat completions). `GEMINI_API_URL` must be the complete HTTPS endpoint ending in `:generateContent`, including the model name. The backend adds the API key securely as a query parameter. Never put the key in the URL saved in frontend files, screenshots, GitHub, or chat messages.

Paste the exact endpoint Google AI Studio gives you into `GEMINI_API_URL`. The selected model must support text and image input.

## Voice and camera notes

- Click **Enable “Hey Anyman”** once to grant microphone permission and start wake-word listening. Keep the ANIVISION tab open. Say “Hey Anyman” to return to the chat. Browser speech recognition support varies; Chrome/Edge are recommended.
- This is not an always-on background wake-word service. Browsers may pause recognition when the tab is backgrounded or the device sleeps.
- Use **Live Camera → Start camera → Capture & identify**. Camera frames are analyzed when you press the capture button; this is not continuous object tracking.
- Use the speaker buttons to hear AI responses. Available voices depend on the operating system and browser.

## GitHub and Render

- After `npm install` creates `backend/package-lock.json`, commit and push the `ANIVISION` folder, including `backend/package.json` and `backend/package-lock.json`.
- Do **not** commit `backend/.env`; it is excluded by `.gitignore`.
- On Render, create a **Web Service** from the GitHub repository. Set the root directory to `ANIVISION/backend` if the repository contains a parent folder, build command `npm install`, and start command `npm start`.
- Add `GEMINI_API_KEY` and `GEMINI_API_URL` as Render environment variables. Render supplies `PORT` automatically; the app reads it.
- Use the Render HTTPS URL for camera and microphone permissions.

## Database

MongoDB/Mongoose is intentionally not included: this version has no accounts, saved cloud profiles, or database-backed data. Adding Mongoose without a database feature would add setup and failure points without helping the requested assistant.
