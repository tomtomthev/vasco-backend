require('dotenv').config();
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set'); // Debug line
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set'); // Debug line

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

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

app.post('/api/chat', authenticateToken, (req, res) => {
  const { message } = req.body;
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
    
Remember to maintain this personality consistently throughout the conversation.`;

  // Add logging to verify the prompt
  console.log('System Prompt:', systemPrompt);
  console.log('User Message:', message);
  
  openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    max_tokens: 300,
  })
  .then(completion => {
    const reply = completion.data.choices[0].message.content;
    // Log the response
    console.log('AI Response:', reply);
    res.json({ reply });
  })
  .catch(err => {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'OpenAI error' });
  });
});

app.post('/api/login', (req, res) => {
  // For demo: always returns a token for a fake user
  const user = { id: 'user123' };
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`VASCO backend running on port ${PORT}`));