require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '30mb' }));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const APP_PASSWORD = process.env.APP_PASSWORD; // opcional: protege tu app de uso ajeno
const GEMINI_MODEL = 'gemini-flash-latest'; // alias que Google actualiza solo al modelo Flash vigente

if (!GEMINI_API_KEY) {
  console.warn('ADVERTENCIA: no se definió GEMINI_API_KEY en el .env. /api/chat fallará hasta que la configures.');
}

// ---------- Autenticación simple opcional ----------
// Si defines APP_PASSWORD en .env, todas las rutas /api/* exigen el header:
//   Authorization: Bearer <APP_PASSWORD>
// Esto evita que cualquiera que encuentre tu dominio consuma tu cuota de la API.
app.use('/api', (req, res, next) => {
  if (!APP_PASSWORD) return next();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token !== APP_PASSWORD) return res.status(401).json({ error: 'No autorizado' });
  next();
});

// Convierte el formato de mensajes de Fly (compatible con Claude) al formato que espera Gemini
function toGeminiContents(messages){
  return messages.map(m => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (typeof m.content === 'string'){
      return { role, parts: [{ text: m.content }] };
    }
    const parts = (m.content || []).map(block => {
      if (block.type === 'text') return { text: block.text };
      if (block.type === 'image') return { inlineData: { mimeType: block.source.media_type, data: block.source.data } };
      if (block.type === 'document') return { inlineData: { mimeType: block.source.media_type || 'application/pdf', data: block.source.data } };
      return { text: '' };
    });
    return { role, parts };
  });
}

// ---------- Chat: proxy seguro hacia Google Gemini (gratis) ----------
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system, tools, maxOutputTokens } = req.body;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'El servidor no tiene configurada GEMINI_API_KEY.' });
    }

    const body = {
      contents: toGeminiContents(messages || []),
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: { maxOutputTokens: maxOutputTokens || 8192 },
    };
    if (tools) body.tools = [{ google_search: {} }];

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify(body),
      }
    );
    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message || 'Error de la API de Gemini.' });
    }

    const candidate = data.candidates && data.candidates[0];
    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';

    const sources = [];
    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    chunks.forEach(c => {
      if (c.web) sources.push({ url: c.web.uri, title: c.web.title });
    });

    res.json({ content: [{ type: 'text', text }], sources });
  } catch (err) {
    console.error('Error en /api/chat:', err);
    res.status(500).json({ error: 'Error interno al contactar la IA.' });
  }
});

// ---------- Chat en streaming: la respuesta llega en pedazos, como ChatGPT/Claude ----------
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { messages, system, tools, maxOutputTokens } = req.body;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'El servidor no tiene configurada GEMINI_API_KEY.' });
    }

    const body = {
      contents: toGeminiContents(messages || []),
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: { maxOutputTokens: maxOutputTokens || 8192 },
    };
    if (tools) body.tools = [{ google_search: {} }];

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify(body),
      }
    );

    if (!upstream.ok || !upstream.body) {
      let message = 'Error de la API de Gemini.';
      try { const errData = await upstream.json(); message = errData.error?.message || message; } catch (e) {}
      return res.status(upstream.status || 500).json({ error: message });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const sources = [];
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // línea incompleta, se completa en el próximo chunk
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const obj = JSON.parse(jsonStr);
          const candidate = obj.candidates && obj.candidates[0];
          const parts = candidate?.content?.parts || [];
          const textPiece = parts.map(p => p.text || '').join('');
          if (textPiece) res.write(textPiece);
          const chunks = candidate?.groundingMetadata?.groundingChunks || [];
          chunks.forEach(c => { if (c.web) sources.push({ url: c.web.uri, title: c.web.title }); });
        } catch (e) { /* línea SSE parcial, se ignora */ }
      }
    }
    res.write('\n\n<<<SOURCES>>>' + JSON.stringify(sources));
    res.end();
  } catch (err) {
    console.error('Error en /api/chat/stream:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno al contactar la IA.' });
    else res.end();
  }
});

// ---------- Generación de imágenes: Gemini mejora el prompt, Pollinations (Flux) genera la imagen ----------
// Pollinations es gratuito, no requiere clave, y no tiene límite diario. No es oficial de Google,
// así que su disponibilidad puede variar; si falla, el endpoint devuelve un error claro.
app.post('/api/image', async (req, res) => {
  try {
    const { prompt, width, height, seed } = req.body;
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Falta describir la imagen.' });

    let enhancedPrompt = prompt.trim();
    if (GEMINI_API_KEY) {
      try {
        const enhanceBody = {
          contents: [{
            role: 'user',
            parts: [{ text:
              'Reescribe la siguiente petición de imagen como UN SOLO prompt detallado en inglés para un ' +
              'generador de imágenes fotorrealista. Añade iluminación, lente/cámara, composición y detalle ' +
              'hiperrealista, pero sin cambiar ni añadir elementos que el usuario no pidió. Responde solo con ' +
              'el prompt final, sin comillas ni explicaciones.\n\nPetición: ' + prompt
            }],
          }],
          generationConfig: { maxOutputTokens: 220 },
        };
        const er = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY }, body: JSON.stringify(enhanceBody) }
        );
        const ed = await er.json();
        const text = ed.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
        if (text) enhancedPrompt = text;
      } catch (e) {
        console.error('No se pudo mejorar el prompt, se usa el original:', e);
      }
    }

    const w = Math.min(Math.max(width || 1024, 256), 2048);
    const h = Math.min(Math.max(height || 1024, 256), 2048);
    const seedVal = seed || Math.floor(Math.random() * 1e9);

    const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}` +
      `?width=${w}&height=${h}&seed=${seedVal}&model=flux&nologo=true&enhance=true`;

    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) {
      return res.status(502).json({ error: 'El servicio de imágenes no respondió. Intenta de nuevo en unos segundos.' });
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());

    res.json({
      image: buf.toString('base64'),
      mimeType: 'image/jpeg',
      enhancedPrompt,
      seed: seedVal,
      width: w,
      height: h,
    });
  } catch (err) {
    console.error('Error en /api/image:', err);
    res.status(500).json({ error: 'Error interno al generar la imagen.' });
  }
});


app.get('/api/conversations', (req, res) => {
  const rows = db.prepare('SELECT * FROM conversations ORDER BY pinned DESC, updated_at DESC').all();
  res.json(rows.map(r => ({ ...r, pinned: !!r.pinned, messages: JSON.parse(r.messages_json) })));
});

app.post('/api/conversations', (req, res) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO conversations (id, title, pinned, messages_json, updated_at) VALUES (?, ?, 0, ?, ?)')
    .run(id, req.body.title || null, JSON.stringify(req.body.messages || []), now);
  res.json({ id, title: req.body.title || null, pinned: false, messages: req.body.messages || [], updated_at: now });
});

app.put('/api/conversations/:id', (req, res) => {
  const { title, pinned, messages } = req.body;
  const now = Date.now();
  const existing = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE conversations SET title = ?, pinned = ?, messages_json = ?, updated_at = ? WHERE id = ?')
    .run(
      title !== undefined ? title : existing.title,
      pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned,
      messages !== undefined ? JSON.stringify(messages) : existing.messages_json,
      now,
      req.params.id
    );
  res.json({ ok: true });
});

app.delete('/api/conversations/:id', (req, res) => {
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Memoria ----------
app.get('/api/memory', (req, res) => {
  const rows = db.prepare('SELECT * FROM memory_notes ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/memory', (req, res) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO memory_notes (id, note, created_at) VALUES (?, ?, ?)').run(id, req.body.note, now);
  res.json({ id, note: req.body.note, created_at: now });
});

app.delete('/api/memory/:id', (req, res) => {
  db.prepare('DELETE FROM memory_notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Configuración (tema, memoria activada) ----------
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

app.put('/api/settings', (req, res) => {
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  Object.entries(req.body || {}).forEach(([k, v]) => upsert.run(k, String(v)));
  res.json({ ok: true });
});

// ---------- Archivos estáticos (el frontend) ----------
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Fly escuchando en http://localhost:${PORT}`);
});
