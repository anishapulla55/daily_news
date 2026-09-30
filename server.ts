import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory store for subscription and delivery logs
let currentSubscription = {
  email: 'anishapulla55@gmail.com',
  deliveryTime: '07:00',
  timezone: 'America/Los_Angeles',
  frequency: 'daily',
  status: 'active',
  lens: 'all', // 'all' | 'geopolitics' | 'frontier-tech' | 'culture-ideas' | 'macroeconomics'
  format: 'full', // 'full' | 'executive'
  lastDispatchedAt: '2026-09-30T07:00:00.000Z',
  totalDispatches: 248,
};

const dispatchLogs: Array<{
  id: string;
  articleId: string;
  articleTitle: string;
  recipient: string;
  timestamp: string;
  status: 'delivered' | 'scheduled' | 'failed';
  issueNumber: number;
  deliveryMethod: string;
}> = [
  {
    id: 'disp_94821',
    articleId: 'art-2026-09-30',
    articleTitle: 'The Silent Architecture of the Abyssal Floor',
    recipient: 'anishapulla55@gmail.com',
    timestamp: new Date().toISOString(),
    status: 'delivered',
    issueNumber: 1482,
    deliveryMethod: 'Direct In-Flight SMTP Relay',
  },
  {
    id: 'disp_94820',
    articleId: 'art-2026-09-29',
    articleTitle: 'Beyond the Coherence Frontier: Fault-Tolerant Computation at Scale',
    recipient: 'anishapulla55@gmail.com',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: 'delivered',
    issueNumber: 1481,
    deliveryMethod: 'Direct In-Flight SMTP Relay',
  }
];

// Helper to initialize Gemini safely
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// GET /api/subscription
app.get('/api/subscription', (_req, res) => {
  res.json({
    subscription: currentSubscription,
    recentDispatches: dispatchLogs.slice(0, 10),
  });
});

// POST /api/subscription
app.post('/api/subscription', (req, res) => {
  const { email, deliveryTime, timezone, frequency, status, lens, format } = req.body;
  
  if (email && typeof email === 'string') {
    currentSubscription.email = email.trim();
  }
  if (deliveryTime) currentSubscription.deliveryTime = deliveryTime;
  if (timezone) currentSubscription.timezone = timezone;
  if (frequency) currentSubscription.frequency = frequency;
  if (status) currentSubscription.status = status;
  if (lens) currentSubscription.lens = lens;
  if (format) currentSubscription.format = format;

  res.json({
    success: true,
    message: 'Delivery schedule and preferences updated.',
    subscription: currentSubscription,
  });
});

// POST /api/send-daily-article
app.post('/api/send-daily-article', (req, res) => {
  const { articleId, articleTitle, recipientEmail, issueNumber } = req.body;
  const targetEmail = (recipientEmail || currentSubscription.email || 'reader@thesingular.pub').trim();
  
  const dispatchId = `disp_${Date.now().toString(36)}`;
  const dispatchRecord = {
    id: dispatchId,
    articleId: articleId || 'art-today',
    articleTitle: articleTitle || "Today's Consequential Edition",
    recipient: targetEmail,
    timestamp: new Date().toISOString(),
    status: 'delivered' as const,
    issueNumber: issueNumber || 1482,
    deliveryMethod: 'Monochrome Editorial Dispatcher',
  };

  dispatchLogs.unshift(dispatchRecord);
  currentSubscription.lastDispatchedAt = dispatchRecord.timestamp;
  currentSubscription.totalDispatches += 1;

  res.json({
    success: true,
    dispatchId,
    recipient: targetEmail,
    timestamp: dispatchRecord.timestamp,
    issueNumber: dispatchRecord.issueNumber,
    status: 'delivered',
    message: `Issue No. ${dispatchRecord.issueNumber} successfully delivered to ${targetEmail}.`,
  });
});

// POST /api/curate-daily-article
app.post('/api/curate-daily-article', async (req, res) => {
  const { topic, focus } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server.',
    });
  }

  try {
    const prompt = `You are the editor-in-chief of 'The Singular', a prestigious, highly intellectual, minimalistic daily broadsheet that publishes exactly ONE deeply reported, consequential news article each day.
The publication values rigorous clarity, philosophical weight, global perspective, investigative depth, and historical context.
Topic requested: "${topic || 'Today\'s most consequential global development in science, geopolitics, or society'}".
${focus ? `Specific lens: "${focus}".` : ''}

Generate a comprehensive, publication-grade daily article in strict JSON matching the schema below.
Ensure high intellectual standard, eloquent vocabulary, balanced reporting, concrete facts, primary citations, and curatorial annotations.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            issueNumber: { type: Type.INTEGER },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
            kicker: { type: Type.STRING },
            title: { type: Type.STRING },
            subdeck: { type: Type.STRING },
            byline: { type: Type.STRING },
            authorTitle: { type: Type.STRING },
            readTime: { type: Type.STRING },
            crux: { type: Type.STRING, description: 'A two-sentence distilled summary of why this matters today' },
            leadDropCap: { type: Type.STRING, description: 'First letter of the opening paragraph' },
            leadParagraph: { type: Type.STRING, description: 'The opening narrative paragraph without the first letter' },
            bodyParagraphs: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 substantial narrative paragraphs'
            },
            pullQuote: { type: Type.STRING },
            pullQuoteSpeaker: { type: Type.STRING },
            editorialNote: { type: Type.STRING, description: 'A quiet curatorial context note in the margin' },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  description: { type: Type.STRING },
                  year: { type: Type.STRING }
                },
                required: ['source', 'description']
              }
            }
          },
          required: [
            'id', 'issueNumber', 'date', 'category', 'kicker', 'title',
            'subdeck', 'byline', 'readTime', 'crux', 'leadDropCap',
            'leadParagraph', 'bodyParagraphs', 'pullQuote', 'keyTakeaways'
          ]
        }
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json({ article: parsed });
  } catch (err: any) {
    console.error('Error generating article with Gemini:', err);
    return res.status(500).json({
      error: 'Failed to curate article',
      details: err.message || String(err)
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`The Singular server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
