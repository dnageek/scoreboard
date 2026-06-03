const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

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
const SESSION_COOKIE_PREFIX = 'scoreboard_session_';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BOARD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

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

function isValidSyncId(syncId) {
  return typeof syncId === 'string' && BOARD_ID_PATTERN.test(syncId);
}

function rejectInvalidSyncId(res) {
  return res.status(400).json({
    message: 'Board ID must be 1-64 characters and contain only letters, numbers, underscores, or hyphens'
  });
}

function publicBoardPayload(scoreBoard) {
  const board = scoreBoard.toObject ? scoreBoard.toObject() : { ...scoreBoard };
  delete board.password;
  delete board.sessionTokens;
  return board;
}

function parseCookies(req) {
  return (req.headers.cookie || '').split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index === -1) return cookies;

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) return cookies;

    try {
      cookies[name] = decodeURIComponent(value);
    } catch (err) {
      cookies[name] = value;
    }
    return cookies;
  }, {});
}

function sessionCookieName(syncId) {
  return `${SESSION_COOKIE_PREFIX}${Buffer.from(syncId).toString('base64url')}`;
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
  } else {
    res.setHeader('Set-Cookie', [existing, cookie]);
  }
}

function serializeCookie(name, value, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict'
  ];

  if (options.maxAge) {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function pruneExpiredSessions(scoreBoard) {
  const now = new Date();
  const originalLength = scoreBoard.sessionTokens ? scoreBoard.sessionTokens.length : 0;
  scoreBoard.sessionTokens = (scoreBoard.sessionTokens || []).filter(session => session.expiresAt > now);
  return scoreBoard.sessionTokens.length !== originalLength;
}

function hasValidSession(req, scoreBoard, syncId) {
  pruneExpiredSessions(scoreBoard);
  const token = parseCookies(req)[sessionCookieName(syncId)];
  if (!token) {
    return false;
  }

  const tokenHash = hashSessionToken(token);
  const now = new Date();
  return (scoreBoard.sessionTokens || []).some(session => (
    session.tokenHash === tokenHash && session.expiresAt > now
  ));
}

function issueSessionCookie(res, scoreBoard, syncId, remember = true) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  pruneExpiredSessions(scoreBoard);
  scoreBoard.sessionTokens.push({
    tokenHash: hashSessionToken(token),
    expiresAt,
    createdAt: new Date()
  });

  appendSetCookie(res, serializeCookie(sessionCookieName(syncId), token, {
    maxAge: remember ? SESSION_MAX_AGE_MS : null
  }));
}

function clearSessionCookie(res, syncId) {
  appendSetCookie(res, serializeCookie(sessionCookieName(syncId), '', { maxAge: -1000 }));
}

function cleanText(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeReason(reason) {
  if (!reason || typeof reason !== 'object') return null;

  const id = cleanText(reason.id, 80);
  const text = cleanText(reason.text, 300);
  const score = reason.score;
  const type = reason.type === 'subtract' ? 'subtract' : 'add';

  if (!id || !text || !isFiniteNumber(score) || score <= 0) {
    return null;
  }

  return { id, text, score, type };
}

function sanitizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const id = cleanText(entry.id, 80);
  const reason = cleanText(entry.reason, 500);
  const scoreChange = entry.scoreChange;
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
  const reasonId = entry.reasonId ? cleanText(entry.reasonId, 80) : null;

  if (!id || !reason || !isFiniteNumber(scoreChange) || Number.isNaN(timestamp.getTime())) {
    return null;
  }

  const sanitized = {
    id,
    timestamp,
    reason,
    scoreChange,
    reasonId
  };

  if (isFiniteNumber(entry.newScore)) {
    sanitized.newScore = entry.newScore;
  }

  return sanitized;
}

function isManualResetEntry(entry) {
  return entry.reason === 'Manual reset' && entry.reasonId === null && isFiniteNumber(entry.newScore);
}

function synchronizeBoardHistory(scoreBoard) {
  const sortedHistory = [...(scoreBoard.history || [])].sort((a, b) => (
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ));

  let runningScore = 0;
  scoreBoard.history = sortedHistory.map(entry => {
    const nextEntry = entry.toObject ? entry.toObject() : { ...entry };

    if (isManualResetEntry(nextEntry)) {
      nextEntry.scoreChange = nextEntry.newScore - runningScore;
      runningScore = nextEntry.newScore;
    } else {
      runningScore += nextEntry.scoreChange;
      nextEntry.newScore = runningScore;
    }

    return nextEntry;
  });

  scoreBoard.currentScore = runningScore;
}

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

const SessionTokenSchema = new mongoose.Schema({
  tokenHash: String,
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
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
  sessionTokens: [SessionTokenSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create models
const ScoreBoard = mongoose.model('ScoreBoard', ScoreBoardSchema);

async function getAuthorizedBoard(syncId, providedPassword, req) {
  if (!isValidSyncId(syncId)) {
    return { status: 400, message: 'Invalid board ID' };
  }

  const scoreBoard = await ScoreBoard.findOne({ syncId });
  if (!scoreBoard) {
    return { status: 404, message: 'Score board not found' };
  }

  if (req && hasValidSession(req, scoreBoard, syncId)) {
    if (pruneExpiredSessions(scoreBoard)) {
      await scoreBoard.save();
    }
    return { scoreBoard };
  }

  if (!providedPassword || typeof providedPassword !== 'string') {
    return { status: 401, message: 'Password required' };
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
    const { currentPassword, newPassword, remember = true } = req.body;
    const { syncId } = req.params;

    if (!isValidSyncId(syncId)) {
      return rejectInvalidSyncId(res);
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Passwords must be text values' });
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
    scoreBoard.sessionTokens = [];
    issueSessionCookie(res, scoreBoard, syncId, remember);
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
    const { syncId, password, remember = true } = req.body;

    if (!isValidSyncId(syncId)) {
      return rejectInvalidSyncId(res);
    }
    if (typeof password !== 'string') {
      return res.status(400).json({ message: 'Password is required' });
    }
    
    const scoreBoard = await ScoreBoard.findOne({ syncId });
    if (!scoreBoard) {
      return res.status(404).json({ message: 'Score board not found' });
    }
    
    const passwordMatch = await bcrypt.compare(password, scoreBoard.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    issueSessionCookie(res, scoreBoard, syncId, remember);
    await scoreBoard.save();
    
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
    if (!isValidSyncId(req.params.syncId)) {
      return rejectInvalidSyncId(res);
    }

    const scoreBoard = await ScoreBoard.findOne({ syncId: req.params.syncId });
    if (!scoreBoard) {
      return res.status(404).json({ message: 'Score board not found' });
    }

    if (hasValidSession(req, scoreBoard, req.params.syncId)) {
      if (pruneExpiredSessions(scoreBoard)) {
        await scoreBoard.save();
      }
      return res.json(publicBoardPayload(scoreBoard));
    }
    
    // Check if password is provided in the headers
    const providedPassword = req.headers['x-password'];
    if (!providedPassword) {
      return res.status(401).json({ message: 'Password required' });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(providedPassword, scoreBoard.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    // Password verified, return full data
    res.json(publicBoardPayload(scoreBoard));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create or update score board
app.post('/api/scoreboard', async (req, res) => {
  try {
    const { syncId, password, currentScore, reasons, history, remember = true } = req.body;

    if (!isValidSyncId(syncId)) {
      return rejectInvalidSyncId(res);
    }

    const sanitizedCurrentScore = isFiniteNumber(currentScore) ? currentScore : 0;
    const sanitizedReasons = Array.isArray(reasons) ? reasons.map(sanitizeReason) : [];
    const sanitizedHistory = Array.isArray(history) ? history.map(sanitizeHistoryEntry) : [];

    if (sanitizedReasons.some(reason => !reason) || sanitizedHistory.some(entry => !entry)) {
      return res.status(400).json({ message: 'Score board data is invalid' });
    }
    
    // Check if this is an update or a new board
    const existingBoard = await ScoreBoard.findOne({ syncId });
    
    if (existingBoard) {
      // This is an update - verify password
      const providedPassword = req.headers['x-password'];
      const sessionAuthorized = hasValidSession(req, existingBoard, syncId);
      if ((!providedPassword || typeof providedPassword !== 'string') && !sessionAuthorized) {
        return res.status(401).json({ message: 'Password required for updates' });
      }
      
      if (!sessionAuthorized) {
        const passwordMatch = await bcrypt.compare(providedPassword, existingBoard.password);
        if (!passwordMatch) {
          return res.status(401).json({ message: 'Invalid password' });
        }
      }
      
      // Password verified, update the board
      const result = await ScoreBoard.findOneAndUpdate(
        { syncId },
        { 
          syncId,
          currentScore: sanitizedCurrentScore,
          reasons: sanitizedReasons,
          history: sanitizedHistory,
          lastUpdated: Date.now()
        },
        { new: true, runValidators: true }
      );
      
      res.status(200).json(publicBoardPayload(result));
    } else {
      // This is a new board creation - hash the password
      if (typeof password !== 'string' || !password) {
        return res.status(400).json({ message: 'Password is required for new boards' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create new board
      const newBoard = new ScoreBoard({
        syncId,
        password: hashedPassword,
        currentScore: sanitizedCurrentScore,
        reasons: sanitizedReasons,
        history: sanitizedHistory,
        lastUpdated: Date.now()
      });

      issueSessionCookie(res, newBoard, syncId, remember);
      
      const result = await newBoard.save();
      res.status(201).json(publicBoardPayload(result));
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/api/scoreboard/:syncId/reasons', async (req, res) => {
  try {
    const { syncId } = req.params;
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password'], req);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const reason = sanitizeReason(req.body.reason);
    if (!reason) {
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
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password'], req);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const { reasons } = req.body;
    if (!Array.isArray(reasons)) {
      return res.status(400).json({ message: 'A reordered reasons array is required' });
    }
    const sanitizedReasons = reasons.map(sanitizeReason);
    if (sanitizedReasons.some(reason => !reason)) {
      return res.status(400).json({ message: 'Every reordered reason must be valid' });
    }

    authResult.scoreBoard.reasons = sanitizedReasons;
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
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password'], req);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const updatedReason = sanitizeReason({ ...req.body, id: reasonId });
    const reason = authResult.scoreBoard.reasons.find(entry => entry.id === reasonId);
    if (!reason) {
      return res.status(404).json({ message: 'Reason not found' });
    }
    if (!updatedReason) {
      return res.status(400).json({ message: 'A valid reason update is required' });
    }

    reason.text = updatedReason.text;
    reason.score = updatedReason.score;
    reason.type = updatedReason.type;
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
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password'], req);
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
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password'], req);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const sanitizedEntry = sanitizeHistoryEntry(req.body.entry);
    const targetScore = req.body.currentScore;
    if (!sanitizedEntry || !isFiniteNumber(targetScore)) {
      return res.status(400).json({ message: 'A valid history entry and current score are required' });
    }

    const isResetEntry = sanitizedEntry.reason === 'Manual reset' && sanitizedEntry.reasonId === null;
    const previousScore = authResult.scoreBoard.currentScore;
    const entryToStore = { ...sanitizedEntry };

    if (isResetEntry) {
      entryToStore.scoreChange = targetScore - previousScore;
      entryToStore.newScore = targetScore;
      authResult.scoreBoard.currentScore = targetScore;
    } else {
      authResult.scoreBoard.currentScore += entryToStore.scoreChange;
      entryToStore.newScore = authResult.scoreBoard.currentScore;
    }

    authResult.scoreBoard.history.push(entryToStore);
    authResult.scoreBoard.lastUpdated = Date.now();
    await authResult.scoreBoard.save();

    res.status(201).json({ entry: entryToStore, currentScore: authResult.scoreBoard.currentScore });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/scoreboard/:syncId/entries/:entryId', async (req, res) => {
  try {
    const { syncId, entryId } = req.params;
    const authResult = await getAuthorizedBoard(syncId, req.headers['x-password'], req);
    if (!authResult.scoreBoard) {
      return res.status(authResult.status).json({ message: authResult.message });
    }

    const entryIndex = authResult.scoreBoard.history.findIndex(entry => entry.id === entryId);
    if (entryIndex === -1) {
      return res.status(404).json({ message: 'History entry not found' });
    }

    authResult.scoreBoard.history.splice(entryIndex, 1);
    synchronizeBoardHistory(authResult.scoreBoard);
    authResult.scoreBoard.lastUpdated = Date.now();
    await authResult.scoreBoard.save();

    res.json({
      message: 'History entry deleted successfully',
      currentScore: authResult.scoreBoard.currentScore,
      history: authResult.scoreBoard.history
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/scoreboard/:syncId/session', async (req, res) => {
  try {
    const { syncId } = req.params;
    if (!isValidSyncId(syncId)) {
      return rejectInvalidSyncId(res);
    }

    const scoreBoard = await ScoreBoard.findOne({ syncId });
    if (!scoreBoard) {
      clearSessionCookie(res, syncId);
      return res.json({ message: 'Session cleared' });
    }

    const token = parseCookies(req)[sessionCookieName(syncId)];
    if (token) {
      const tokenHash = hashSessionToken(token);
      scoreBoard.sessionTokens = (scoreBoard.sessionTokens || []).filter(session => session.tokenHash !== tokenHash);
      await scoreBoard.save();
    }

    clearSessionCookie(res, syncId);
    res.json({ message: 'Session cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete score board
app.delete('/api/scoreboard/:syncId', async (req, res) => {
  try {
    if (!isValidSyncId(req.params.syncId)) {
      return rejectInvalidSyncId(res);
    }

    // Find the board first to verify password
    const scoreBoard = await ScoreBoard.findOne({ syncId: req.params.syncId });
    if (!scoreBoard) {
      return res.status(404).json({ message: 'Score board not found' });
    }
    
    // Verify password
    const providedPassword = req.body.password || req.headers['x-password'];
    if (!providedPassword || typeof providedPassword !== 'string') {
      return res.status(401).json({ message: 'Password required for deletion' });
    }
    
    const passwordMatch = await bcrypt.compare(providedPassword, scoreBoard.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    // Password verified, delete the board
    await ScoreBoard.deleteOne({ syncId: req.params.syncId });
    clearSessionCookie(res, req.params.syncId);
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
