# AiCS

AiCS is a browser-based scientific calculator with graphing, calculation history, study notes, reference pages, themes, and offline step-by-step calculation explanations.

**Try it:** https://aicsrepo.github.io/AiCS/

## Run locally

Requirements: Node.js 18 or newer and npm.

```bash
git clone https://github.com/aicsrepo/AiCS.git
cd AiCS
npm ci
npm run dev
```

The calculator shows the latest completed expression’s evaluation steps beside the keypad. Steps are computed locally by the same expression parser and angle-mode settings as the calculator; no AI service, API key, or separate backend is needed.
