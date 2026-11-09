import http from 'node:http';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 3001;
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://aicsrepo.github.io')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestCounts = new Map();

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const isAllowedOrigin =
    !origin ||
    ALLOWED_ORIGINS.has(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };

  if (origin && isAllowedOrigin) headers['Access-Control-Allow-Origin'] = origin;

  if (!isAllowedOrigin) {
    res.writeHead(403, headers);
    res.end(JSON.stringify({ error: 'Origin not allowed.' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/chat') {
    res.writeHead(404, headers);
    res.end(JSON.stringify({ error: 'Not found.' }));
    return;
  }

  const clientIp = req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const requestWindow = requestCounts.get(clientIp);
  if (!requestWindow || now - requestWindow.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(clientIp, { startedAt: now, count: 1 });
  } else if (requestWindow.count >= MAX_REQUESTS_PER_WINDOW) {
    res.writeHead(429, { ...headers, 'Retry-After': '60' });
    res.end(JSON.stringify({ error: 'Too many requests. Please try again in a minute.' }));
    return;
  } else {
    requestWindow.count += 1;
  }

  if (OLLAMA_BASE_URL === 'https://ollama.com' && !OLLAMA_API_KEY) {
    res.writeHead(503, headers);
    res.end(JSON.stringify({ error: 'The hosted AI service is not configured.' }));
    return;
  }

  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > 16_000) {
        res.writeHead(413, headers);
        res.end(JSON.stringify({ error: 'Request too large.' }));
        return;
      }
    }

    const { message, context = {} } = JSON.parse(body);
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      res.writeHead(400, headers);
      res.end(JSON.stringify({ error: 'Enter a message under 4000 characters.' }));
      return;
    }

    const ollamaHeaders = { 'Content-Type': 'application/json' };
    if (OLLAMA_API_KEY) {
      ollamaHeaders.Authorization = `Bearer ${OLLAMA_API_KEY}`;
    }

    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: ollamaHeaders,
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are a concise, helpful assistant built into a scientific calculator. Explain math clearly. The calculator itself is responsible for exact calculations.',
          },
          {
            role: 'user',
            content: `${message.trim()}\n\nCalculator context: angle mode ${context.angleMode || 'deg'}; precision ${context.precision || 12}; latest result ${context.latest?.display || 'none'}.`,
          },
        ],
      }),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama returned HTTP ${ollamaResponse.status}.`);
    }

    const result = await ollamaResponse.json();
    res.writeHead(200, headers);
    res.end(JSON.stringify({ answer: result.message?.content || 'Llama returned an empty response.' }));
  } catch (error) {
    console.error('AI request failed:', error);
    res.writeHead(502, headers);
    res.end(JSON.stringify({ error: 'Could not get a response from the AI provider.' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AI server listening at http://${HOST}:${PORT}`);
});