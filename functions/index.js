// Gemini 代理 —— 金鑰只存在伺服器（Secret Manager），前端看不到。
// 只有帶著有效 Firebase 登入 token 的請求才會被處理。
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';

exports.gemini = onRequest(
  { secrets: [GEMINI_API_KEY], region: 'us-central1', cors: true, maxInstances: 10 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method-not-allowed' });
      return;
    }

    // 驗證呼叫者是已登入的使用者
    const authz = req.headers.authorization || '';
    const m = authz.match(/^Bearer (.+)$/);
    if (!m) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    try {
      await admin.auth().verifyIdToken(m[1]);
    } catch (e) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const { system, user, image, schema } = req.body || {};
    const parts = [];
    if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
    parts.push({ text: user });

    try {
      const gres = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY.value()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: schema,
              temperature: 0.3
            }
          })
        }
      );

      if (!gres.ok) {
        res.status(gres.status).json({ error: 'gemini-error', status: gres.status });
        return;
      }

      const j = await gres.json();
      const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      // 直接把解析後的 JSON 回給前端；若解析失敗回 502
      let payload;
      try { payload = JSON.parse(text); }
      catch (e) { res.status(502).json({ error: 'bad-ai-response' }); return; }
      res.json(payload);
    } catch (e) {
      console.error('gemini proxy error:', e);
      res.status(500).json({ error: 'server-error' });
    }
  }
);
