const express = require('express');
const cors = require('cors');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./middleware/logger');
const routes = require('./routes/index');
const { getDb } = require('./db/database');
const { seed } = require('./db/seed');

const app = express();
app.use(logger);
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoints
app.get('/health', async (req, res) => {
  try {
    const db = await getDb();
    await db.execute("SELECT 1");
    res.json({
      status: "ok",
      service: "PocketSplit API",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      service: "PocketSplit API",
      database: "disconnected",
      error: err.message
    });
  }
});

app.get('/ready', (req, res) => {
  res.json({ status: "ready" });
});

// API Routes
app.use('/api', routes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'UP', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Error handler
app.use(errorHandler);

async function start() {
  try {
    await getDb(); // Initialize DB
    await seed();  // Seed demo data if needed

    app.listen(PORT, () => {
      console.log(`\n🚀 PocketSplit API running at http://localhost:${PORT}`);
      console.log(`📊 API Base: http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();