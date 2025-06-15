const express = require('express');
const cors = require('cors');
const app = express();

// Basic CORS - allow all for testing
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Basic server working' });
});

const PORT = 3002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal test server running on port ${PORT}`);
});