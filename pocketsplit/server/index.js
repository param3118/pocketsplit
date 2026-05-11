const express = require('express');
const cors = require('cors');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes/index');
const { getDb } = require('./db/database');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

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