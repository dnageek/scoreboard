const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection with options
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MongoDB URI is not defined in environment variables');
      console.log('Please create a .env file with your MongoDB Atlas connection string');
      console.log('Example: MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log('Connected to MongoDB Atlas successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Retry connection after 5 seconds
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Define schemas
const ReasonSchema = new mongoose.Schema({
  id: String,
  text: String,
  score: Number
});

const HistoryEntrySchema = new mongoose.Schema({
  id: String,
  timestamp: Date,
  reason: String,
  scoreChange: Number,
  newScore: Number,
  reasonId: String
});

const ScoreBoardSchema = new mongoose.Schema({
  syncId: {
    type: String,
    required: true,
    unique: true
  },
  currentScore: {
    type: Number,
    default: 0
  },
  reasons: [ReasonSchema],
  history: [HistoryEntrySchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create models
const ScoreBoard = mongoose.model('ScoreBoard', ScoreBoardSchema);

// API Routes
// Simple endpoint to check if server is available
app.get('/api/scoreboard/test-connection', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is available' });
});

// Get score board by syncId
app.get('/api/scoreboard/:syncId', async (req, res) => {
  // Skip the test-connection route
  if (req.params.syncId === 'test-connection') {
    return;
  }

  try {
    const scoreBoard = await ScoreBoard.findOne({ syncId: req.params.syncId });
    if (!scoreBoard) {
      return res.status(404).json({ message: 'Score board not found' });
    }
    res.json(scoreBoard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create or update score board
app.post('/api/scoreboard', async (req, res) => {
  try {
    const { syncId, currentScore, reasons, history } = req.body;
    
    // Find and update or create new
    const result = await ScoreBoard.findOneAndUpdate(
      { syncId },
      { 
        syncId,
        currentScore,
        reasons,
        history,
        lastUpdated: Date.now()
      },
      { new: true, upsert: true }
    );
    
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete score board
app.delete('/api/scoreboard/:syncId', async (req, res) => {
  try {
    const result = await ScoreBoard.deleteOne({ syncId: req.params.syncId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Score board not found' });
    }
    res.json({ message: 'Score board deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Serve the main HTML file for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});