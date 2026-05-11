const express = require('express');
const cors = require('cors');
const { errorHandler } = require('../server/middleware/errorHandler');
const routes = require('../server/routes/index');
const { getDb } = require('../server/db/database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize DB on each request (standard for Vercel Serverless)
app.use(async (req, res, next) => {
  try {
    await getDb();
    next();
  } catch (err) {
    next(err);
  }
});

// API Routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

module.exports = app;
