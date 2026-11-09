# AiCS

AiCS is a browser-based scientific calculator with graphing, calculation history, study notes, reference pages, themes, and an offline math assistant.

**Try it:** https://aicsrepo.github.io/AiCS/

## Run locally

Requirements: Node.js 18 or newer and npm.

```bash
git clone https://github.com/aicsrepo/AiCS.git
cd AiCS
npm ci
npm run dev
```

For local AI, open a second terminal and run `node server.js`. The backend expects Ollama at `http://127.0.0.1:11434` and defaults to `llama3.2:latest`; set `OLLAMA_MODEL` if your installed model uses a different name.

## Deploy the public AI assistant

The calculator frontend is served by GitHub Pages. Its hosted AI endpoint runs separately on Render and uses Ollama Cloud; the Ollama API key must never be placed in frontend code or committed to the repository.

1. Create an API key in [Ollama settings](https://ollama.com/settings/keys).
2. In Render, create a Blueprint from this repository and use the included `render.yaml`. Set `OLLAMA_API_KEY` in the Render service's environment settings, then deploy. The configured cloud model is `gemma4:31b`.
3. Copy the Render service URL (for example, `https://aics-ai.onrender.com`). In GitHub, open **Settings → Secrets and variables → Actions → Variables** and create `AICS_AI_API_URL` with that URL (no trailing slash).
4. Push to `main` or run the **Deploy to GitHub Pages** workflow. The site build uses that variable as its AI API endpoint.

The Render free web service may sleep when idle and take about a minute to wake. Ollama Cloud usage is subject to your account's plan and limits. The backend only allows the GitHub Pages origin and local development origins, and limits each client IP to 20 chat requests per minute.
