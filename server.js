import http from 'node:http';

const HOST = '127.0.0.1';
const PORT = 3001;
const MODEL = 'llama3.2';

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const isLocalOrigin =
    !origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (origin && isLocalOrigin) headers['Access-Control-Allow-Origin'] = origin;

  if (!isLocalOrigin) {
    res.writeHead(403, headers);
    res.end(JSON.stringify({ error: 'Local development origin only.' }));
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

  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16_000) throw new Error('Request too large.');
    }

    const { message, context = {} } = JSON.parse(body);
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      res.writeHead(400, headers);
      res.end(JSON.stringify({ error: 'Enter a message under 4000 characters.' }));
      return;
    }

    const ollamaResponse = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    console.error('Local AI error:', error);
    res.writeHead(502, headers);
    res.end(JSON.stringify({ error: 'Could not reach Ollama. Check that it is running and the Llama model is installed.' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Local AI server listening at http://${HOST}:${PORT}`);
});