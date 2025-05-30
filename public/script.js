// DOM Elements - Login Page
const loginPage = document.getElementById('login-page');
const scoreBoardPage = document.getElementById('scoreboard-page');
const newBoardId = document.getElementById('new-board-id');
const newBoardPassword = document.getElementById('new-board-password');
const createBoardBtn = document.getElementById('create-board-btn');
const existingBoardId = document.getElementById('existing-board-id');
const existingBoardPassword = document.getElementById('existing-board-password');
const accessBoardBtn = document.getElementById('access-board-btn');
const boardList = document.getElementById('board-list');
const logoutBtn = document.getElementById('logout-btn');
const deleteBoardBtn = document.getElementById('delete-board-btn');
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const closeDeleteBtn = document.querySelector('.close-delete');

// DOM Elements - Score Board
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
let password = null;
let isSyncing = false;
let offlineMode = false;
// Always use relative path for API URL to work across devices
const API_URL = '/api';

// Initialize the app
function init() {
    // Set initial UI state
    showLoginPage();

    // Check server availability first
    checkServerAvailability().then(serverAvailable => {
        if (serverAvailable) {
            // Check if we have a stored syncId and password
            syncId = sessionStorage.getItem('scoreBoardSyncId');
            password = sessionStorage.getItem('scoreBoardPassword');

            if (syncId && password) {
                // Try to load the board
                loadBoardWithCredentials(syncId, password);
            } else {
                // Load available boards
                loadAvailableBoards();
            }
        } else {
            boardList.innerHTML = '<p>Cannot connect to server. Please check your connection and try again.</p>';
        }
    });

    // Log debug info to help troubleshoot
    console.log('App initialized, hostname:', window.location.hostname);
    console.log('API URL:', API_URL);
}

// Show the login page
function showLoginPage() {
    loginPage.classList.add('active');
    scoreBoardPage.classList.remove('active');
}

// Show the score board page
function showScoreBoardPage() {
    loginPage.classList.remove('active');
    scoreBoardPage.classList.add('active');
    
    // Display the sync ID
    document.getElementById('sync-id').textContent = syncId;
}

// Load available boards from server
async function loadAvailableBoards() {
    try {
        // Show loading message
        boardList.innerHTML = '<p class="loading">Loading available boards...</p>';

        // Add timeout to the fetch operation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${API_URL}/scoreboards`, {
            signal: controller.signal,
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
            const boards = await response.json();
            renderBoardList(boards);
        } else {
            boardList.innerHTML = '<p>Error loading boards. Please try again later.</p>';
        }
    } catch (err) {
        console.error('Failed to load boards:', err);
        if (err.name === 'AbortError') {
            boardList.innerHTML = '<p>Request timed out. The server might be slow or unreachable.</p>';
        } else {
            boardList.innerHTML = `<p>Error connecting to server: ${err.message}</p>`;
        }

        // Add a retry button
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn-primary';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', loadAvailableBoards);
        boardList.appendChild(retryBtn);
    }
}

// Render the list of available boards
function renderBoardList(boards) {
    if (!Array.isArray(boards) || boards.length === 0) {
        boardList.innerHTML = '<p>No boards available. Create your first board!</p>';
        return;
    }

    boardList.innerHTML = '';
    console.log(`Rendering ${boards.length} boards`);
    
    boards.forEach(board => {
        const boardItem = document.createElement('div');
        boardItem.className = 'board-item';
        
        // Format the date
        const lastUpdated = new Date(board.lastUpdated);
        const formattedDate = `${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString()}`;
        
        boardItem.innerHTML = `
            <div class="board-id">${board.syncId}</div>
            <div class="last-updated">Last updated: ${formattedDate}</div>
        `;
        
        // Click to fill in the board ID in the login form
        boardItem.addEventListener('click', () => {
            existingBoardId.value = board.syncId;
            existingBoardPassword.focus();
        });
        
        boardList.appendChild(boardItem);
    });
}

// Create a new board
async function createNewBoard() {
    const newId = newBoardId.value.trim();
    const newPass = newBoardPassword.value.trim();
    
    if (!newId || !newPass) {
        alert('Please enter both a board ID and password');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/scoreboard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                syncId: newId,
                password: newPass,
                currentScore: 0,
                reasons: [],
                history: []
            })
        });
        
        if (response.ok) {
            // Save credentials and show board
            syncId = newId;
            password = newPass;
            sessionStorage.setItem('scoreBoardSyncId', syncId);
            sessionStorage.setItem('scoreBoardPassword', password);
            
            // Reset data
            currentScore = 0;
            reasons = [];
            history = [];
            
            // Update UI
            renderReasonCards();
            renderHistory();
            updateScoreDisplay();
            showScoreBoardPage();
        } else {
            const errorData = await response.json();
            alert(`Error creating board: ${errorData.message}`);
        }
    } catch (err) {
        alert(`Error creating board: ${err.message}`);
    }
}

// Access an existing board
async function accessExistingBoard() {
    const boardId = existingBoardId.value.trim();
    const boardPass = existingBoardPassword.value.trim();
    
    if (!boardId || !boardPass) {
        alert('Please enter both a board ID and password');
        return;
    }
    
    loadBoardWithCredentials(boardId, boardPass);
}

// Load a board with the given credentials
async function loadBoardWithCredentials(boardId, boardPass) {
    try {
        // First verify the password
        const verifyResponse = await fetch(`${API_URL}/scoreboard/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                syncId: boardId,
                password: boardPass
            })
        });
        
        if (!verifyResponse.ok) {
            alert('Invalid board ID or password');
            // Clear session storage on failed login
            sessionStorage.removeItem('scoreBoardSyncId');
            sessionStorage.removeItem('scoreBoardPassword');
            showLoginPage();
            return;
        }
        
        // Password verified, now load the data
        const dataResponse = await fetch(`${API_URL}/scoreboard/${boardId}`, {
            headers: {
                'X-Password': boardPass
            }
        });
        
        if (dataResponse.ok) {
            const data = await dataResponse.json();
            
            // Save credentials
            syncId = boardId;
            password = boardPass;
            sessionStorage.setItem('scoreBoardSyncId', syncId);
            sessionStorage.setItem('scoreBoardPassword', password);
            
            // Update data
            currentScore = data.currentScore;
            reasons = data.reasons;
            history = data.history;
            
            // Update UI
            renderReasonCards();
            renderHistory();
            updateScoreDisplay();
            showScoreBoardPage();
        } else {
            const errorData = await dataResponse.json();
            alert(`Error loading board: ${errorData.message}`);
        }
    } catch (err) {
        alert(`Error loading board: ${err.message}`);
    }
}

// Logout from the current board
function logout() {
    // Clear credentials
    syncId = null;
    password = null;
    sessionStorage.removeItem('scoreBoardSyncId');
    sessionStorage.removeItem('scoreBoardPassword');
    
    // Show login page and refresh board list
    showLoginPage();
    loadAvailableBoards();
}

// Show delete confirmation modal
function showDeleteConfirmation() {
    deleteConfirmModal.style.display = 'block';
}

// Close delete confirmation modal
function closeDeleteConfirmation() {
    deleteConfirmModal.style.display = 'none';
}

// Delete the current board
async function deleteBoard() {
    try {
        const response = await fetch(`${API_URL}/scoreboard/${syncId}`, {
            method: 'DELETE',
            headers: {
                'X-Password': password
            }
        });
        
        if (response.ok) {
            alert('Board deleted successfully');
            logout();
        } else {
            const errorData = await response.json();
            alert(`Error deleting board: ${errorData.message}`);
        }
    } catch (err) {
        alert(`Error deleting board: ${err.message}`);
    } finally {
        closeDeleteConfirmation();
    }
}

// Check if server is available
async function checkServerAvailability() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_URL}/scoreboard/test-connection`, {
            method: 'GET',
            signal: controller.signal,
            // Prevent caching to ensure fresh response
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            offlineMode = false;
            toggleOfflineButton.innerHTML = '<i class="fas fa-wifi"></i> Go Offline';
            return true;
        }
    } catch (err) {
        console.error('Server connection error:', err);
        offlineMode = true;
        toggleOfflineButton.innerHTML = '<i class="fas fa-wifi"></i> Go Online';
        updateSyncStatus('Server unavailable - cannot load your data');
    }
    return false;
}

function generateSyncId() {
    return Math.random().toString(36).substring(2, 10);
}

// Server Sync Functions
async function syncWithServer() {
    if (isSyncing || !syncId || !password || offlineMode) return;

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
                        'Content-Type': 'application/json',
                        'X-Password': password
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

function updateSyncStatus(message) {
    if (syncStatusElement) {
        syncStatusElement.textContent = message;
    }
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

// Event Listeners - Login Page
createBoardBtn.addEventListener('click', createNewBoard);
accessBoardBtn.addEventListener('click', accessExistingBoard);
logoutBtn.addEventListener('click', logout);
deleteBoardBtn.addEventListener('click', showDeleteConfirmation);
confirmDeleteBtn.addEventListener('click', deleteBoard);
cancelDeleteBtn.addEventListener('click', closeDeleteConfirmation);
closeDeleteBtn.addEventListener('click', closeDeleteConfirmation);

// Event Listeners - Score Board
addScoreButton.addEventListener('click', () => updateScore(true));
minusScoreButton.addEventListener('click', () => updateScore(false));
addReasonButton.addEventListener('click', addReason);
closeModalButton.addEventListener('click', closeModal);
saveEditButton.addEventListener('click', saveEdit);
resetScoreButton.addEventListener('click', resetScore);
toggleOfflineButton.addEventListener('click', toggleOfflineMode);

// Close modals if clicked outside
window.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeModal();
    }
    if (e.target === deleteConfirmModal) {
        closeDeleteConfirmation();
    }
});

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);