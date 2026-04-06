const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');

// Try to load compression module
let compression;
try {
  compression = require('compression');
} catch (err) {
  console.warn('Compression module not found, proceeding without compression');
}

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Enable compression for all responses if available
if (compression) {
  app.use(compression());
}

// Configure CORS to allow requests from any origin
app.use(cors({
  origin: '*',  // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Password']
}));
app.use(express.json({ limit: '50mb' })); // Large limit for extensive histories
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
  score: Number,
  type: {
    type: String,
    enum: ['add', 'subtract'],
    default: 'add'
  }
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
  password: {
    type: String,
    required: true
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

async function getAuthorizedBoard(syncId, providedPassword) {
  if (!providedPassword) {
    return { status: 401, message: 'Password required' };
  }

  const scoreBoard = await ScoreBoard.findOne({ syncId });
  if (!scoreBoard) {
    return { status: 404, message: 'Score board not found' };
  }

  const passwordMatch = await bcrypt.compare(providedPassword, scoreBoard.password);
  if (!passwordMatch) {
    return { status: 401, message: 'Invalid password' };
  }

  return { scoreBoard };
}

// API Routes
// Change password for a board
app.put('/api/scoreboard/:syncId/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { syncId } = req.params;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    // Find the board
    const scoreBoard = await ScoreBoard.findOne({ syncId });
    if (!scoreBoard) {
      return res.status(404).json({ message: 'Score board not found' });
    }

    // Verify the current password
    const passwordMatch = await bcrypt.compare(currentPassword, scoreBoard.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash the new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    scoreBoard.password = hashedPassword;
    await scoreBoard.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).json({ message: err.message });
  }
});

// Simple endpoint to check if server is available
app.get('/api/scoreboard/test-connection', (req, res) => {
  // Set explicit CORS headers to ensure browsers accept the response
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  res.status(200).json({ status: 'ok', message: 'Server is available' });
});

// Get all available boards (without sensitive data)
app.get('/api/scoreboards', async (req, res) => {
  try {
    // Add artificial delay to prevent race conditions in the UI
    await new Promise(resolve => setTimeout(resolve, 500));

    const boards = await ScoreBoard.find({}, 'syncId lastUpdated');
    res.json(boards);
  } catch (err) {
    console.error('Error fetching scoreboards:', err);
    res.status(500).json({ message: err.message });
  }
});

// Verify password for a board
app.post('/api/scoreboard/verify', async (req, res) => {
  try {
    const { syncId, password } = req.body;
    
    const scoreBoard = await ScoreBoard.findOne({ syncId });
    if (!scoreBoard) {
      return res.status(404).json({ message: 'Score board not found' });
    }
    
    const passwordMatch = await bcrypt.compare(password, scoreBoard.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    res.json({ message: 'Password verified', success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get score board by syncId with password verification
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
    
    // Check if password is provided in the headers
    const providedPassword = req.headers['x-password'];
    if (!providedPassword) {
      // Return only public info if no password provided
      return res.json({
        syncId: scoreBoard.syncId,
        lastUpdated: scoreBoard.lastUpdated,
        protected: true
      });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(providedPassword, scoreBoard.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    // Password verified, return full data
    res.json(scoreBoard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create or update score board
app.post('/api/scoreboard', async (req, res) => {
  try {
    const { syncId, password, currentScore, reasons, history } = req.body;
    
    // Check if this is an update or a new board
    const existingBoard = await ScoreBoard.findOne({ syncId });
    
    if (existingBoard) {
      // This is an update - verify password
      const providedPassword = req.headers['x-password'];
      if (!providedPassword) {
        return res.status(401).json({ message: 'Password required for updates' });
      }
      
      const passwordMatch = await bcrypt.compare(providedPassword, existingBoard.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid password' });
      }
      
      // Password verified, update the board
      const result = await ScoreBoard.findOneAndUpdate(
        { syncId },
        { 
          syncId,
          currentScore,
          reasons,
          history,
          lastUpdated: Date.now()
        },
        { new: true }
      );
      
      res.status(200).json(result);
    } else {
      // This is a new board creation - hash the password
      if (!password) {
        return res.status(400).json({ message: 'Password is required for new boards' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create new board
      const newBoard = new ScoreBoard({
        syncId,
        password: hashedPassword,
        currentScore,
        reasons,
        history,
        lastUpdated: Date.now()
      });
      
      const result = await newBoard.save();
      res.status(201).json(result);
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/api/scoreboard/:syncId/reasons', async (req, res) => {
  try {
    const { syncId } = req.params;
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password']);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const { reason } = req.body;
    if (!reason || !reason.id || !reason.text || typeof reason.score !== 'number') {
      return res.status(400).json({ message: 'A valid reason is required' });
    }

    authResult.scoreBoard.reasons.push(reason);
    authResult.scoreBoard.lastUpdated = Date.now();
    await authResult.scoreBoard.save();

    res.status(201).json({ reason });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/scoreboard/:syncId/reasons/reorder', async (req, res) => {
  try {
    const { syncId } = req.params;
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password']);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const { reasons } = req.body;
    if (!Array.isArray(reasons)) {
      return res.status(400).json({ message: 'A reordered reasons array is required' });
    }

    authResult.scoreBoard.reasons = reasons;
    authResult.scoreBoard.lastUpdated = Date.now();
    await authResult.scoreBoard.save();

    res.json({ reasons: authResult.scoreBoard.reasons });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/scoreboard/:syncId/reasons/:reasonId', async (req, res) => {
  try {
    const { syncId, reasonId } = req.params;
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password']);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const { text, score, type } = req.body;
    const reason = authResult.scoreBoard.reasons.find(entry => entry.id === reasonId);
    if (!reason) {
      return res.status(404).json({ message: 'Reason not found' });
    }

    reason.text = text;
    reason.score = score;
    reason.type = type;
    authResult.scoreBoard.lastUpdated = Date.now();
    await authResult.scoreBoard.save();

    res.json({ reason });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/scoreboard/:syncId/reasons/:reasonId', async (req, res) => {
  try {
    const { syncId, reasonId } = req.params;
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password']);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const reasonIndex = authResult.scoreBoard.reasons.findIndex(entry => entry.id === reasonId);
    if (reasonIndex === -1) {
      return res.status(404).json({ message: 'Reason not found' });
    }

    authResult.scoreBoard.reasons.splice(reasonIndex, 1);
    authResult.scoreBoard.lastUpdated = Date.now();
    await authResult.scoreBoard.save();

    res.json({ message: 'Reason deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/scoreboard/:syncId/entries', async (req, res) => {
  try {
    const { syncId } = req.params;
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password']);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const { entry, currentScore } = req.body;
    if (!entry || !entry.id || typeof currentScore !== 'number') {
      return res.status(400).json({ message: 'A valid history entry and current score are required' });
    }

    authResult.scoreBoard.currentScore = currentScore;
    authResult.scoreBoard.history.push(entry);
    authResult.scoreBoard.lastUpdated = Date.now();
    await authResult.scoreBoard.save();

    res.status(201).json({ entry, currentScore: authResult.scoreBoard.currentScore });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/scoreboard/:syncId/entries/:entryId', async (req, res) => {
  try {
    const { syncId, entryId } = req.params;
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password']);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const { currentScore } = req.body;
    if (typeof currentScore !== 'number') {
      return res.status(400).json({ message: 'A valid current score is required' });
    }

    const entryIndex = authResult.scoreBoard.history.findIndex(entry => entry.id === entryId);
    if (entryIndex === -1) {
      return res.status(404).json({ message: 'History entry not found' });
    }

    authResult.scoreBoard.history.splice(entryIndex, 1);
    authResult.scoreBoard.currentScore = currentScore;
    authResult.scoreBoard.lastUpdated = Date.now();
    await authResult.scoreBoard.save();

    res.json({ message: 'History entry deleted successfully', currentScore });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete score board
app.delete('/api/scoreboard/:syncId', async (req, res) => {
  try {
    // Find the board first to verify password
    const scoreBoard = await ScoreBoard.findOne({ syncId: req.params.syncId });
    if (!scoreBoard) {
      return res.status(404).json({ message: 'Score board not found' });
    }
    
    // Verify password
    const providedPassword = req.headers['x-password'];
    if (!providedPassword) {
      return res.status(401).json({ message: 'Password required for deletion' });
    }
    
    const passwordMatch = await bcrypt.compare(providedPassword, scoreBoard.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    // Password verified, delete the board
    const result = await ScoreBoard.deleteOne({ syncId: req.params.syncId });
    res.json({ message: 'Score board deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Serve static files in development mode directly from the root directory
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname)));
}

// Serve the main HTML file for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
