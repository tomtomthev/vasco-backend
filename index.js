console.log('--- V5: DEPLOYMENT FORCED. THIS MUST APPEAR. ---');
require('dotenv').config();
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('CHAT_OPENAI_KEY:', process.env.CHAT_OPENAI_KEY ? 'Set' : 'Not set');
console.log('BUDGET_OPENAI_KEY:', process.env.BUDGET_OPENAI_KEY ? 'Set' : 'Not set');

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');

const app = express();

app.use(cors());
app.use(express.json());

// --- Sanity Checks ---
if (!process.env.CHAT_OPENAI_KEY) {
  console.error('FATAL ERROR: CHAT_OPENAI_KEY environment variable is not set.');
  process.exit(1);
}

if (!process.env.BUDGET_OPENAI_KEY) {
  console.error('FATAL ERROR: BUDGET_OPENAI_KEY environment variable is not set.');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not set.');
  process.exit(1);
}

// --- OpenAI Client Initialization ---
const chatOpenAI = new OpenAI({
  apiKey: process.env.CHAT_OPENAI_KEY,
});
const budgetOpenAI = new OpenAI({
  apiKey: process.env.BUDGET_OPENAI_KEY,
});
console.log('OpenAI clients initialized successfully with V4 SDK.');

// Root route to confirm the server is running
app.get('/', (req, res) => {
  res.send('Vasco backend is online and ready.');
});

// Dedicated health check endpoint for the platform
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.post('/api/chat', authenticateToken, async (req, res) => {
  const { message, conversationHistory = [] } = req.body;

  const systemPrompt = `You are VASCO, a friendly and knowledgeable travel assistant with a passion for helping expats and travelers. Your personality traits include:
- You're enthusiastic and positive, always excited to share travel tips
- You speak in a casual, friendly tone but remain professional
- You're knowledgeable about local customs, hidden gems, and practical travel advice
- You have a good sense of humor and use emojis occasionally to make conversations more engaging
- You're particularly helpful with expat-specific concerns like housing, visas, and local integration

Guidelines for responses:
- Keep responses concise but informative (max 2-3 sentences)
- Prioritize practical, actionable advice
- When suggesting places or activities, include brief explanations of why they're worth visiting (also add precise price or estimate)
- If you're unsure about something, be honest about it
- Always consider safety and local regulations in your advice
- Use your knowledge to provide context-specific recommendations
- You can use expressions such as 'Hi expat', "Greetings, fellow explorer!", "Hello, savvy adventurer!"
- Remember previous context from the conversation to provide more relevant and contextual responses

Remember to maintain this personality consistently throughout the conversation.`;

  // Add logging to verify the prompt
  console.log('System Prompt:', systemPrompt);
  console.log('User Message:', message);
  console.log('Conversation History Length:', conversationHistory.length);
  console.log('Conversation History:', conversationHistory);

  try {
    // Build messages array with system prompt, conversation history, and current message
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (last 3 exchanges)
    if (conversationHistory && conversationHistory.length > 0) {
      // Take only the last 3 exchanges (6 messages: 3 user + 3 assistant)
      const recentHistory = conversationHistory.slice(-6);
      console.log('Recent History (last 3 exchanges):', recentHistory);
      messages.push(...recentHistory);
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    console.log('Final messages array sent to OpenAI:', messages);

    const completion = await chatOpenAI.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 300,
    });
    const reply = completion.choices[0].message.content;
    // Log the response
    console.log('AI Response:', reply);
    res.json({ reply });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'OpenAI error' });
  }
});

// Budget API endpoint
app.post('/api/budget', authenticateToken, async (req, res) => {
  const { city, country, profile } = req.body;

  console.log('Budget request:', { city, country, profile });

  if (!city || !country || !profile) {
    return res.status(400).json({ error: 'Missing required fields: city, country, profile' });
  }

  const budgetPrompt = `You are a budget expert for expatriates. Provide accurate monthly budget data for ${profile.toLowerCase()} living in ${city}, ${country}. Rely upon livingcost.org and numbeo.com for data.

IMPORTANT: Use CURRENT exchange rates from reliable sources (like xe.com, oanda.com, or current market rates). Do NOT use outdated or estimated rates.

Return ONLY a JSON object with this exact structure (no other text):
{
    "localCurrency": "CURRENCY_CODE",
    "currencySymbol": "CURRENCY_SYMBOL",
    "exchangeRate": EXCHANGE_RATE_TO_USD,
    "categories": [
        {
            "name": "Housing",
            "subElements": [
                {"name": "Monthly rent", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Utilities (water, gas, electricity)", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Internet / Wi-Fi", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "TV / Streaming subscription", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Home insurance", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Security deposit", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Real estate agent fees", "amountUSD": NUMBER, "amountLocal": NUMBER}
            ]
        },
        {
            "name": "Daily Life",
            "subElements": [
                {"name": "Groceries", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Hygiene products", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Clothing / footwear", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Local SIM or eSIM", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Restaurants", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Social outings / nightlife", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Cloud subscription (Google, Apple, etc.)", "amountUSD": NUMBER, "amountLocal": NUMBER}
            ]
        },
        {
            "name": "Transport",
            "subElements": [
                {"name": "Public transport pass", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Single tickets (bus, metro, train)", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Car rental", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Fuel", "amountUSD": NUMBER, "amountLocal": NUMBER}
            ]
        },
        {
            "name": "Health",
            "subElements": [
                {"name": "Local or international health insurance", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Medical consultations", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Dental care", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Hospitalization", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Vaccines", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Mental health / therapy", "amountUSD": NUMBER, "amountLocal": NUMBER}
            ]
        },
        {
            "name": "Administrative",
            "subElements": [
                {"name": "Visa / residence permit", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Local bank fees", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Exchange rate / conversion fee", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "International transfer fees", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Multi-currency card", "amountUSD": NUMBER, "amountLocal": NUMBER}
            ]
        },
        {
            "name": "Leisure & Wellness",
            "subElements": [
                {"name": "Gym membership", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Entertainment (cinema, museums, concerts)", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Travel / excursions", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Classes (yoga, dance, sport)", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Cultural activities / social clubs", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Music streaming (Spotify, Deezer…)", "amountUSD": NUMBER, "amountLocal": NUMBER},
                {"name": "Hairdresser / beauty treatments", "amountUSD": NUMBER, "amountLocal": NUMBER}
            ]
        }
    ]
}

Important:
- Use realistic prices for ${city}, ${country}
- Adjust for ${profile.toLowerCase()} profile (solo=1x, couple=1.6x, family=2.5x, business=2x)
- Use CURRENT exchange rates (as of today) - check real-time rates for accuracy
- Use local currency code (EUR, GBP, JPY, INR, BRL, MXN, AED, CNY, etc.)
- Include the actual currency symbol (€, £, ¥, ₹, R$, د.إ, ¥, etc.)
- Calculate amountLocal = amountUSD * exchangeRate for each item
- For China, use CNY currency code and ¥ symbol
- For accurate exchange rates, use current market rates (not outdated rates)
- Return ONLY the JSON, no explanations`;

  try {
    const completion = await budgetOpenAI.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a budget expert. Provide accurate, realistic budget data in JSON format only.' },
        { role: 'user', content: budgetPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const response = completion.choices[0].message.content;
    console.log('Budget API Response:', response);

    // Clean the JSON response
    const cleanJSON = response.trim()
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      const budgetData = JSON.parse(cleanJSON);
      res.json(budgetData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      res.status(500).json({ error: 'Invalid JSON response from OpenAI' });
    }

  } catch (err) {
    console.error('Budget API error:', err);
    res.status(500).json({ error: 'Budget calculation failed' });
  }
});

app.post('/api/login', (req, res) => {
  // For demo: always returns a token for a fake user
  const user = { id: 'user123' };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`VASCO backend running on port ${PORT}`));
