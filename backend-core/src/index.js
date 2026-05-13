require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');

const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve Widget SDK
const widgetPath = process.env.WIDGET_DIST_PATH || path.join(__dirname, '../../widget-sdk/dist');
app.use('/widget', express.static(widgetPath));

// Routes
app.use('/api', routes);

// Database Connection
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sass_agentic';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Backend Core (Node.js) running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
