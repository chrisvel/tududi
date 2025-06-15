// Simple test to verify Express backend works
const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Express backend is working!' });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Try: curl http://localhost:${PORT}/api/health`);
});