// DOM Elements
const currentScoreElement = document.getElementById('current-score');
const addScoreButton = document.getElementById('add-score');
const minusScoreButton = document.getElementById('minus-score');
const reasonCardsContainer = document.getElementById('reason-cards');
const newReasonText = document.getElementById('new-reason-text');
const newReasonScore = document.getElementById('new-reason-score');
const addReasonButton = document.getElementById('add-reason');
const historyTable = document.getElementById('history-table').querySelector('tbody');
const editModal = document.getElementById('edit-modal');
const closeModalButton = document.querySelector('.close');
const editReasonText = document.getElementById('edit-reason-text');
const editReasonScore = document.getElementById('edit-reason-score');
const saveEditButton = document.getElementById('save-edit');
const syncStatusElement = document.getElementById('sync-status');
const resetScoreValue = document.getElementById('reset-score-value');
const resetScoreButton = document.getElementById('reset-score-btn');
const toggleOfflineButton = document.getElementById('toggle-offline');

// App State
let currentScore = 0;
let reasons = [];
let history = [];
let selectedReason = null;
let editingReasonId = null;
let syncId = null;
let isSyncing = false;
let offlineMode = false;
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '/api'  // Use relative path when on same domain
    : 'http://localhost:3000/api';  // Use absolute path for development

// Initialize the app
function init() {
    // Generate or retrieve syncId
    syncId = sessionStorage.getItem('scoreBoardSyncId');
    if (!syncId) {
        syncId = generateSyncId();
        sessionStorage.setItem('scoreBoardSyncId', syncId);
    }
    
    // Display the sync ID to the user
    document.getElementById('sync-id').textContent = syncId;
    
    // Check if the server is available and load data
    checkServerAvailability();
    
    // Set up sync interval (every 30 seconds)
    setInterval(syncWithServer, 30000);
}

// Check if server is available
async function checkServerAvailability() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_URL}/scoreboard/test-connection`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            offlineMode = false;
            toggleOfflineButton.innerHTML = '<i class="fas fa-wifi"></i> Go Offline';
            loadFromServer(); // Load data from server
        }
    } catch (err) {
        offlineMode = true;
        toggleOfflineButton.innerHTML = '<i class="fas fa-wifi"></i> Go Online';
        updateSyncStatus('Server unavailable - cannot load your data');
    }
}

function generateSyncId() {
    return Math.random().toString(36).substring(2, 10);
}

// Server Sync Functions
async function syncWithServer() {
    if (isSyncing || !syncId || offlineMode) return;

    try {
        isSyncing = true;
        updateSyncStatus('Syncing...');

        // Add retry logic
        let retries = 3;
        let success = false;
        let errorMsg = '';

        while (retries > 0 && !success) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(`${API_URL}/scoreboard`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        syncId,
                        currentScore,
                        reasons,
                        history
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (response.ok) {
                    success = true;
                    offlineMode = false;
                    updateSyncStatus('Synced');
                    setTimeout(() => updateSyncStatus(''), 3000);
                } else {
                    const errorData = await response.json();
                    errorMsg = errorData.message;
                    throw new Error(errorMsg);
                }
            } catch (innerErr) {
                retries--;
                if (retries === 0) {
                    throw innerErr;
                }
                // Wait 2 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    } catch (err) {
        // If it's a network error, switch to offline mode
        if (err.message.includes('Failed to fetch') || err.name === 'AbortError') {
            offlineMode = true;
            updateSyncStatus('Cannot connect to server. Try again later.');
        } else {
            updateSyncStatus(`Sync error: ${err.message}. Will retry later.`);
        }
        // Schedule another sync attempt in 60 seconds
        setTimeout(syncWithServer, 60000);
    } finally {
        isSyncing = false;
    }
}

async function loadFromServer() {
    if (!syncId || offlineMode) return;

    try {
        updateSyncStatus('Loading...');

        // Add retry logic
        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(`${API_URL}/scoreboard/${syncId}`, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (response.ok) {
                    success = true;
                    const data = await response.json();
                    
                    // Update data from server
                    currentScore = data.currentScore;
                    reasons = data.reasons;
                    history = data.history;
                    
                    renderReasonCards();
                    renderHistory();
                    updateScoreDisplay();
                    
                    updateSyncStatus('Loaded from cloud');
                    setTimeout(() => updateSyncStatus(''), 3000);
                } else if (response.status === 404) {
                    success = true;
                    // No data on server yet, will be created on next sync
                    updateSyncStatus('New scoreboard created');
                    setTimeout(() => updateSyncStatus(''), 3000);
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.message);
                }
            } catch (innerErr) {
                retries--;
                if (retries === 0) {
                    throw innerErr;
                }
                // Wait 2 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    } catch (err) {
        // If it's a network error, switch to offline mode
        if (err.message.includes('Failed to fetch') || err.name === 'AbortError') {
            offlineMode = true;
            updateSyncStatus('Offline mode - cannot load your data');
        } else {
            updateSyncStatus(`Load error: ${err.message}`);
        }
    }
}

function updateSyncStatus(message) {
    syncStatusElement.textContent = message;
}

// Render Functions
function renderReasonCards() {
    reasonCardsContainer.innerHTML = '';
    
    if (reasons.length === 0) {
        reasonCardsContainer.innerHTML = '<p>No reasons added yet. Add your first reason below!</p>';
        return;
    }
    
    reasons.forEach(reason => {
        const card = document.createElement('div');
        card.className = `reason-card ${selectedReason === reason.id ? 'selected' : ''}`;
        card.dataset.id = reason.id;
        
        card.innerHTML = `
            <p>${reason.text}</p>
            <p class="score-value">${reason.score > 0 ? '+' : ''}${reason.score}</p>
            <button class="edit-btn"><i class="fas fa-edit"></i></button>
        `;
        
        card.addEventListener('click', () => selectReason(reason.id));
        card.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(reason.id);
        });
        
        reasonCardsContainer.appendChild(card);
    });
}

function renderHistory() {
    historyTable.innerHTML = '';
    
    if (history.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5">No history yet</td>';
        historyTable.appendChild(row);
        return;
    }
    
    // Sort history from newest to oldest
    const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedHistory.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(entry.timestamp)}</td>
            <td>${entry.reason}</td>
            <td class="${entry.scoreChange > 0 ? 'positive' : 'negative'}">${entry.scoreChange > 0 ? '+' : ''}${entry.scoreChange}</td>
            <td>${entry.newScore}</td>
            <td><button class="undo-btn" data-index="${index}"><i class="fas fa-undo"></i> Undo</button></td>
        `;
        historyTable.appendChild(row);
    });
    
    // Add event listeners to undo buttons
    document.querySelectorAll('.undo-btn').forEach(button => {
        button.addEventListener('click', handleUndo);
    });
}

function updateScoreDisplay() {
    currentScoreElement.textContent = currentScore;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

// Action Functions
function selectReason(id) {
    selectedReason = selectedReason === id ? null : id;
    renderReasonCards();
}

function addReason() {
    const text = newReasonText.value.trim();
    const score = parseInt(newReasonScore.value);
    
    if (!text || isNaN(score)) {
        alert('Please enter both a reason and a valid score');
        return;
    }
    
    const newReason = {
        id: Date.now().toString(),
        text,
        score
    };
    
    reasons.push(newReason);
    syncWithServer();
    renderReasonCards();
    
    // Clear inputs
    newReasonText.value = '';
    newReasonScore.value = '';
    
    // Auto-select the newly added reason
    selectReason(newReason.id);
}

function updateScore(isAddition) {
    if (!selectedReason) {
        alert('Please select a reason first');
        return;
    }
    
    const reason = reasons.find(r => r.id === selectedReason);
    if (!reason) return;
    
    const scoreChange = isAddition ? reason.score : -reason.score;
    currentScore += scoreChange;
    
    // Add to history with unique ID
    history.push({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        reason: reason.text,
        scoreChange,
        newScore: currentScore,
        reasonId: reason.id
    });
    
    syncWithServer();
    updateScoreDisplay();
    renderHistory();
}

function openEditModal(reasonId) {
    const reason = reasons.find(r => r.id === reasonId);
    if (!reason) return;
    
    editingReasonId = reasonId;
    editReasonText.value = reason.text;
    editReasonScore.value = reason.score;
    editModal.style.display = 'block';
}

function closeModal() {
    editModal.style.display = 'none';
    editingReasonId = null;
}

function saveEdit() {
    if (!editingReasonId) return;
    
    const text = editReasonText.value.trim();
    const score = parseInt(editReasonScore.value);
    
    if (!text || isNaN(score)) {
        alert('Please enter both a reason and a valid score');
        return;
    }
    
    const reasonIndex = reasons.findIndex(r => r.id === editingReasonId);
    if (reasonIndex === -1) return;
    
    reasons[reasonIndex] = {
        ...reasons[reasonIndex],
        text,
        score
    };
    
    syncWithServer();
    renderReasonCards();
    closeModal();
}

// Handle undo action
function handleUndo(event) {
    const index = parseInt(event.currentTarget.dataset.index);
    const entry = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[index];
    
    if (!entry) return;
    
    // Reverse the score change
    currentScore -= entry.scoreChange;
    
    // Remove this entry from history
    const entryIndex = history.findIndex(h => h.id === entry.id);
    if (entryIndex !== -1) {
        history.splice(entryIndex, 1);
    }
    
    // Update UI and sync with server
    syncWithServer();
    updateScoreDisplay();
    renderHistory();
}

// Reset the score to a specific value
function resetScore() {
    const newScore = parseInt(resetScoreValue.value);
    
    if (isNaN(newScore)) {
        alert('Please enter a valid score value');
        return;
    }
    
    // Calculate the score change
    const scoreChange = newScore - currentScore;
    
    // Update the current score
    currentScore = newScore;
    
    // Add to history
    history.push({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        reason: 'Manual reset',
        scoreChange,
        newScore: currentScore,
        reasonId: null
    });
    
    // Update UI and sync with server
    syncWithServer();
    updateScoreDisplay();
    renderHistory();
    
    // Clear the input
    resetScoreValue.value = '';
}

// Toggle offline mode
function toggleOfflineMode() {
    offlineMode = !offlineMode;
    
    if (offlineMode) {
        updateSyncStatus('Offline mode enabled - changes will not be saved');
        toggleOfflineButton.innerHTML = '<i class="fas fa-wifi"></i> Go Online';
    } else {
        updateSyncStatus('Online mode enabled - syncing with server');
        toggleOfflineButton.innerHTML = '<i class="fas fa-wifi"></i> Go Offline';
        // Trigger immediate sync
        syncWithServer();
    }
}

// Event Listeners
addScoreButton.addEventListener('click', () => updateScore(true));
minusScoreButton.addEventListener('click', () => updateScore(false));
addReasonButton.addEventListener('click', addReason);
closeModalButton.addEventListener('click', closeModal);
saveEditButton.addEventListener('click', saveEdit);
resetScoreButton.addEventListener('click', resetScore);
toggleOfflineButton.addEventListener('click', toggleOfflineMode);

// Close modal if clicked outside
window.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeModal();
    }
});

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);