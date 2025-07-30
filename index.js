console.log('--- V5: DEPLOYMENT FORCED. THIS MUST APPEAR. ---');
require('dotenv').config();
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// --- Sanity Checks ---
if (!process.env.OPENAI_API_KEY) {
  console.error('FATAL ERROR: OPENAI_API_KEY environment variable is not set.');
  process.exit(1); // Exit if the API key is missing
}

// --- OpenAI Client Initialization ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('OpenAI client initialized successfully with V4 SDK.');

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
    
    const completion = await openai.chat.completions.create({
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

app.post('/api/login', (req, res) => {
  // For demo: always returns a token for a fake user
  const user = { id: 'user123' };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`VASCO backend running on port ${PORT}`));