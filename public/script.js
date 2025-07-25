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
const changePasswordBtn = document.getElementById('change-password-btn');
const changePasswordModal = document.getElementById('change-password-modal');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const confirmChangePasswordBtn = document.getElementById('confirm-change-password');
const cancelChangePasswordBtn = document.getElementById('cancel-change-password');
const closePasswordBtn = document.querySelector('.close-password');
const randomCardBtn = document.getElementById('random-card-btn');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfoElement = document.getElementById('page-info');
const pageNumbersContainer = document.getElementById('page-numbers');
const entriesInfoElement = document.getElementById('entries-info');

// Statistics DOM elements
const toggleStatsBtn = document.getElementById('toggle-stats');
const statsTimeFilter = document.getElementById('stats-time-filter');
const statisticsContent = document.getElementById('statistics-content');
const totalEntriesElement = document.getElementById('total-entries');
const avgDailyChangeElement = document.getElementById('avg-daily-change');
const winLossRatioElement = document.getElementById('win-loss-ratio');
const scoreRangeElement = document.getElementById('score-range');

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
// Pagination state
let currentPage = 1;
const itemsPerPage = 10;

// Statistics state
let statsVisible = true;
let currentStatsFilter = 'all';
let charts = {};
// Always use relative path for API URL to work across devices
const API_URL = '/api';

// Constants for reason types
const REASON_TYPE = {
    ADD: 'add',
    SUBTRACT: 'subtract'
};

// Fix for older data without type property
function ensureReasonTypes() {
    reasons.forEach(reason => {
        if (!reason.hasOwnProperty('type')) {
            // For backward compatibility, determine type based on score
            reason.type = reason.score < 0 ? REASON_TYPE.SUBTRACT : REASON_TYPE.ADD;
            // Make sure score is positive
            reason.score = Math.abs(reason.score);
        }
    });
}

// Drag and Drop functionality
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');

    // Create a ghost image
    const ghostElement = this.cloneNode(true);
    ghostElement.style.position = 'absolute';
    ghostElement.style.top = '-1000px';
    document.body.appendChild(ghostElement);
    e.dataTransfer.setDragImage(ghostElement, 0, 0);

    // Clean up ghost element after dragstart
    setTimeout(() => {
        document.body.removeChild(ghostElement);
    }, 0);

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragEnd() {
    this.classList.remove('dragging');
    draggedElement = null;
    document.querySelectorAll('.reason-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    reasonCardsContainer.classList.remove('drag-over');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault(); // Allows the drop
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (!draggedElement) return;

    // Get the target container
    const container = reasonCardsContainer;
    container.classList.remove('drag-over');

    // Get the dragged reason ID
    const reasonId = draggedElement.dataset.id;
    const dropTarget = e.target.closest('.reason-card');

    if (reasonId) {
        // Find the index of the dragged item and the drop target
        const draggedIndex = reasons.findIndex(r => r.id === reasonId);

        if (draggedIndex === -1) return;

        let dropIndex;

        if (dropTarget && dropTarget.dataset.id) {
            // If dropped on another card
            const dropTargetId = dropTarget.dataset.id;
            dropIndex = reasons.findIndex(r => r.id === dropTargetId);

            if (dropIndex === -1) return;
        } else {
            // If dropped directly on container (at the end)
            dropIndex = reasons.length - 1;
        }

        // Reorder the reasons array
        const [removed] = reasons.splice(draggedIndex, 1);
        reasons.splice(dropIndex, 0, removed);

        // Save and re-render
        syncWithServer();
        renderReasonCards();
    }

    return false;
}

// Cookie utility functions with configurable expiry
function setCookie(name, value, days = 30) {
    // If remember-me is not checked, don't set an expiry (session cookie)
    const rememberMe = document.getElementById('remember-login');
    const options = { sameSite: 'strict' };

    // Only set expiry if remember-me is checked
    if (rememberMe && rememberMe.checked) {
        options.expires = days;
    }

    Cookies.set(name, value, options);
}

function getCookie(name) {
    return Cookies.get(name);
}

function removeCookie(name) {
    Cookies.remove(name);
}

// Initialize the app
function init() {
    // Set initial UI state
    showLoginPage();

    // Check server availability first
    checkServerAvailability().then(serverAvailable => {
        if (serverAvailable) {
            // Set up container drag and drop event listeners
            reasonCardsContainer.addEventListener('dragover', handleDragOver);
            reasonCardsContainer.addEventListener('dragenter', handleDragEnter);
            reasonCardsContainer.addEventListener('dragleave', handleDragLeave);
            reasonCardsContainer.addEventListener('drop', handleDrop);

            // Check if we have stored credentials in cookies
            syncId = getCookie('scoreBoardSyncId');
            password = getCookie('scoreBoardPassword');

            if (syncId && password) {
                // Try to load the board using cookie data
                loadBoardWithCredentials(syncId, password);
            } else {
                // Fall back to session storage (for backward compatibility)
                syncId = sessionStorage.getItem('scoreBoardSyncId');
                password = sessionStorage.getItem('scoreBoardPassword');

                if (syncId && password) {
                    // Migrate from sessionStorage to cookies
                    setCookie('scoreBoardSyncId', syncId);
                    setCookie('scoreBoardPassword', password);
                    // Clear sessionStorage
                    sessionStorage.removeItem('scoreBoardSyncId');
                    sessionStorage.removeItem('scoreBoardPassword');

                    loadBoardWithCredentials(syncId, password);
                } else {
                    // Load available boards
                    loadAvailableBoards();
                }
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

            // Store credentials in cookies for persistent login
            setCookie('scoreBoardSyncId', syncId);
            setCookie('scoreBoardPassword', password);

            // Clear any old session storage (for backward compatibility)
            sessionStorage.removeItem('scoreBoardSyncId');
            sessionStorage.removeItem('scoreBoardPassword');

            // Reset data
            currentScore = 0;
            reasons = [];
            history = [];

            // Update UI
            renderReasonCards();
            renderHistory();
            updateScoreDisplay();
            renderStatistics();
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
    const rememberMe = document.getElementById('remember-login').checked;

    if (!boardId || !boardPass) {
        alert('Please enter both a board ID and password');
        return;
    }

    // Log persistence choice for debugging
    console.log('Keep me signed in:', rememberMe ? 'Yes (30 days)' : 'No (session only)');

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
            // Clear all credentials on failed login
            removeCookie('scoreBoardSyncId');
            removeCookie('scoreBoardPassword');
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

            // Store in cookies for persistent login
            setCookie('scoreBoardSyncId', syncId);
            setCookie('scoreBoardPassword', password);

            // Update data
            currentScore = data.currentScore;
            reasons = data.reasons;
            history = data.history;

            // Ensure all reasons have a type
            ensureReasonTypes();

            // Update UI
            renderReasonCards();
            renderHistory();
            updateScoreDisplay();
            renderStatistics();
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
    // Clear credentials from cookies and session storage
    syncId = null;
    password = null;
    removeCookie('scoreBoardSyncId');
    removeCookie('scoreBoardPassword');
    sessionStorage.removeItem('scoreBoardSyncId');
    sessionStorage.removeItem('scoreBoardPassword');

    // Show login page and refresh board list
    showLoginPage();
    loadAvailableBoards();
}

// Show delete confirmation modal
function showDeleteConfirmation() {
    // Reset password field
    document.getElementById('delete-password').value = '';
    deleteConfirmModal.style.display = 'block';
}

// Close delete confirmation modal
function closeDeleteConfirmation() {
    deleteConfirmModal.style.display = 'none';
}

// Delete the current board
async function deleteBoard() {
    const deletePassword = document.getElementById('delete-password').value.trim();

    if (!deletePassword) {
        alert('Please enter your password to confirm deletion');
        return;
    }

    try {
        // First verify the password
        const verifyResponse = await fetch(`${API_URL}/scoreboard/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                syncId,
                password: deletePassword
            })
        });

        if (!verifyResponse.ok) {
            alert('Incorrect password');
            return;
        }

        // Password verified, proceed with deletion
        const response = await fetch(`${API_URL}/scoreboard/${syncId}`, {
            method: 'DELETE',
            headers: {
                'X-Password': deletePassword
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
            return true;
        }
    } catch (err) {
        console.error('Server connection error:', err);
        offlineMode = true;
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
        card.className = `reason-card ${reason.type === REASON_TYPE.ADD ? 'add-card' : 'subtract-card'}`;
        card.dataset.id = reason.id;
        card.draggable = true; // Make the card draggable

        // Determine what button to show based on the reason type
        let actionButton = '';
        if (reason.type === REASON_TYPE.ADD) {
            actionButton = `<button class="action-btn add-btn" data-id="${reason.id}"><i class="fas fa-plus"></i> Add ${reason.score}</button>`;
        } else if (reason.type === REASON_TYPE.SUBTRACT) {
            actionButton = `<button class="action-btn subtract-btn" data-id="${reason.id}"><i class="fas fa-minus"></i> Subtract ${reason.score}</button>`;
        }

        card.innerHTML = `
            <p>${reason.text}</p>
            <div class="card-actions">
                ${actionButton}
                <button class="edit-btn" data-id="${reason.id}"><i class="fas fa-edit"></i></button>
            </div>
        `;

        // Add drag event listeners
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);

        reasonCardsContainer.appendChild(card);
    });

    // Add event listeners to the action buttons
    document.querySelectorAll('.add-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const reasonId = button.dataset.id;
            updateScoreByReasonId(reasonId, true);
        });
    });

    document.querySelectorAll('.subtract-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const reasonId = button.dataset.id;
            updateScoreByReasonId(reasonId, false);
        });
    });

    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const reasonId = button.dataset.id;
            openEditModal(reasonId);
        });
    });

    // Prevent button clicks from starting drag operations
    document.querySelectorAll('.action-btn, .edit-btn').forEach(button => {
        button.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    });
}

function renderHistory() {
    historyTable.innerHTML = '';
    
    if (history.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5">No history yet</td>';
        historyTable.appendChild(row);
        updatePaginationControls(0);
        return;
    }
    
    // Sort history from newest to oldest
    const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Calculate pagination
    const totalItems = sortedHistory.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Ensure current page is within valid range
    if (currentPage > totalPages) {
        currentPage = totalPages || 1;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }
    
    // Get items for current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = sortedHistory.slice(startIndex, endIndex);
    
    pageItems.forEach((entry, pageIndex) => {
        const globalIndex = startIndex + pageIndex;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(entry.timestamp)}</td>
            <td>${entry.reason}</td>
            <td class="${entry.scoreChange > 0 ? 'positive' : 'negative'}">${entry.scoreChange > 0 ? '+' : ''}${entry.scoreChange}</td>
            <td>${entry.newScore}</td>
            <td><button class="undo-btn" data-index="${globalIndex}"><i class="fas fa-undo"></i> Undo</button></td>
        `;
        historyTable.appendChild(row);
    });
    
    // Add event listeners to undo buttons
    document.querySelectorAll('.undo-btn').forEach(button => {
        button.addEventListener('click', handleUndo);
    });
    
    // Update pagination controls
    updatePaginationControls(totalPages);
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
    const type = document.getElementById('new-reason-type').value;

    if (!text || isNaN(score) || score <= 0) {
        alert('Please enter a reason and a positive score value');
        return;
    }

    // Validate type is one of the allowed values
    if (type !== REASON_TYPE.ADD && type !== REASON_TYPE.SUBTRACT) {
        alert('Invalid reason type');
        return;
    }

    const newReason = {
        id: Date.now().toString(),
        text,
        score,  // Store positive value
        type    // Store the explicitly selected type
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

// This function is no longer needed as we're now using updateScoreByReasonId
// function updateScore(isAddition) { ... }

// New function to update score by reason ID
function updateScoreByReasonId(reasonId, isAddition) {
    const reason = reasons.find(r => r.id === reasonId);
    if (!reason) return;

    // Apply score change based on reason type
    let scoreChange;

    // Add points (only if it's an add-type reason and we're adding)
    if (reason.type === REASON_TYPE.ADD && isAddition) {
        scoreChange = reason.score;
    }
    // Subtract points (only if it's a subtract-type reason and we're subtracting)
    else if (reason.type === REASON_TYPE.SUBTRACT && !isAddition) {
        scoreChange = -reason.score;
    }
    // Otherwise, invalid operation
    else {
        console.error('Invalid operation for reason type');
        return;
    }

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

    // Reset to first page to show the new entry
    currentPage = 1;
    syncWithServer();
    updateScoreDisplay();
    renderHistory();
    renderStatistics();
}

function openEditModal(reasonId) {
    const reason = reasons.find(r => r.id === reasonId);
    if (!reason) return;

    editingReasonId = reasonId;
    editReasonText.value = reason.text;
    editReasonScore.value = reason.score;
    document.getElementById('edit-reason-type').value = reason.type;
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
    const type = document.getElementById('edit-reason-type').value;

    if (!text || isNaN(score) || score <= 0) {
        alert('Please enter a reason and a positive score value');
        return;
    }

    // Validate type is one of the allowed values
    if (type !== REASON_TYPE.ADD && type !== REASON_TYPE.SUBTRACT) {
        alert('Invalid reason type');
        return;
    }

    const reasonIndex = reasons.findIndex(r => r.id === editingReasonId);
    if (reasonIndex === -1) return;

    reasons[reasonIndex] = {
        ...reasons[reasonIndex],
        text,
        score,  // Store positive value
        type    // Store the explicitly selected type
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
    
    // Check if we need to go to previous page (if current page becomes empty)
    const totalPages = Math.ceil(history.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    
    // Update UI and sync with server
    syncWithServer();
    updateScoreDisplay();
    renderHistory();
    renderStatistics();
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
    // Reset to first page to show the new entry
    currentPage = 1;
    syncWithServer();
    updateScoreDisplay();
    renderHistory();
    renderStatistics();
    
    // Clear the input
    resetScoreValue.value = '';
}


// Event Listeners - Login Page
createBoardBtn.addEventListener('click', createNewBoard);
accessBoardBtn.addEventListener('click', accessExistingBoard);
logoutBtn.addEventListener('click', logout);
deleteBoardBtn.addEventListener('click', showDeleteConfirmation);
confirmDeleteBtn.addEventListener('click', deleteBoard);
cancelDeleteBtn.addEventListener('click', closeDeleteConfirmation);
closeDeleteBtn.addEventListener('click', closeDeleteConfirmation);
changePasswordBtn.addEventListener('click', showChangePasswordModal);
confirmChangePasswordBtn.addEventListener('click', changePassword);
cancelChangePasswordBtn.addEventListener('click', closeChangePasswordModal);
closePasswordBtn.addEventListener('click', closeChangePasswordModal);

// Function to randomly select a card
function selectRandomCard() {
    // Remove any existing highlights
    document.querySelectorAll('.reason-card').forEach(card => {
        card.classList.remove('highlighted');
    });

    // Get all reason cards
    const cards = document.querySelectorAll('.reason-card');

    // If no cards, show alert
    if (cards.length === 0) {
        alert('No reason cards to select. Add some reasons first!');
        return;
    }

    // Select a random card
    const randomIndex = Math.floor(Math.random() * cards.length);
    const selectedCard = cards[randomIndex];

    // Add highlight class to the selected card
    selectedCard.classList.add('highlighted');

    // Scroll to the card if needed
    selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Automatically remove the highlight after 3 seconds
    setTimeout(() => {
        selectedCard.classList.remove('highlighted');
    }, 3000);
}

// Event Listeners - Score Board
// Remove the old score button listeners as they're no longer needed
// addScoreButton.addEventListener('click', () => updateScore(true));
// minusScoreButton.addEventListener('click', () => updateScore(false));
addReasonButton.addEventListener('click', addReason);
closeModalButton.addEventListener('click', closeModal);
saveEditButton.addEventListener('click', saveEdit);
resetScoreButton.addEventListener('click', resetScore);
randomCardBtn.addEventListener('click', selectRandomCard);
prevPageBtn.addEventListener('click', goToPreviousPage);
nextPageBtn.addEventListener('click', goToNextPage);

// Show change password modal
function showChangePasswordModal() {
    // Reset form fields
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';

    // Show the modal
    changePasswordModal.style.display = 'block';
}

// Close change password modal
function closeChangePasswordModal() {
    changePasswordModal.style.display = 'none';
}

// Change the board password
async function changePassword() {
    const currentPassword = currentPasswordInput.value.trim();
    const newPassword = newPasswordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    // Basic validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Please fill in all password fields');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New password and confirmation do not match');
        return;
    }

    try {
        updateSyncStatus('Changing password...');

        const response = await fetch(`${API_URL}/scoreboard/${syncId}/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });

        if (response.ok) {
            // Update stored password in cookies
            password = newPassword;
            setCookie('scoreBoardPassword', password);

            // Clear old session storage (for backward compatibility)
            sessionStorage.removeItem('scoreBoardPassword');

            alert('Password changed successfully');
            closeChangePasswordModal();
            updateSyncStatus('Password updated');
            setTimeout(() => updateSyncStatus(''), 3000);
        } else {
            const errorData = await response.json();
            alert(`Error: ${errorData.message}`);
        }
    } catch (err) {
        alert(`Error changing password: ${err.message}`);
    }
}

// Close modals if clicked outside
window.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeModal();
    }
    if (e.target === deleteConfirmModal) {
        closeDeleteConfirmation();
    }
    if (e.target === changePasswordModal) {
        closeChangePasswordModal();
    }
});

// Pagination Functions
function updatePaginationControls(totalPages) {
    const totalItems = history.length;
    const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    // Update entries info
    entriesInfoElement.textContent = `Showing ${startItem}-${endItem} of ${totalItems} entries`;
    
    // Update button states
    if (totalPages <= 1) {
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        pageInfoElement.textContent = totalPages === 0 ? 'No pages' : 'Page 1 of 1';
    } else {
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
        pageInfoElement.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    // Update page numbers
    renderPageNumbers(totalPages);
}

function goToPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderHistory();
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(history.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderHistory();
    }
}

function goToPage(pageNumber) {
    const totalPages = Math.ceil(history.length / itemsPerPage);
    if (pageNumber >= 1 && pageNumber <= totalPages) {
        currentPage = pageNumber;
        renderHistory();
    }
}

function renderPageNumbers(totalPages) {
    pageNumbersContainer.innerHTML = '';
    
    if (totalPages <= 1) {
        return;
    }
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Add first page and ellipsis if needed
    if (startPage > 1) {
        addPageNumber(1);
        if (startPage > 2) {
            addEllipsis();
        }
    }
    
    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
        addPageNumber(i);
    }
    
    // Add ellipsis and last page if needed
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            addEllipsis();
        }
        addPageNumber(totalPages);
    }
}

function addPageNumber(pageNum) {
    const pageButton = document.createElement('div');
    pageButton.className = `page-number ${pageNum === currentPage ? 'active' : ''}`;
    pageButton.textContent = pageNum;
    pageButton.addEventListener('click', () => goToPage(pageNum));
    pageNumbersContainer.appendChild(pageButton);
}

function addEllipsis() {
    const ellipsis = document.createElement('div');
    ellipsis.className = 'page-number ellipsis';
    ellipsis.textContent = '...';
    pageNumbersContainer.appendChild(ellipsis);
}

// Statistics Functions
function filterHistoryByTimeRange(days) {
    if (days === 'all') return history;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    return history.filter(entry => new Date(entry.timestamp) >= cutoffDate);
}

function calculateStatistics(filteredHistory) {
    if (filteredHistory.length === 0) {
        return {
            totalEntries: 0,
            avgDailyChange: 0,
            winLossRatio: 0,
            scoreRange: 0
        };
    }
    
    const positiveChanges = filteredHistory.filter(entry => entry.scoreChange > 0);
    const negativeChanges = filteredHistory.filter(entry => entry.scoreChange < 0);
    
    // Calculate average daily change
    const totalChange = filteredHistory.reduce((sum, entry) => sum + entry.scoreChange, 0);
    const firstEntry = new Date(filteredHistory[filteredHistory.length - 1].timestamp);
    const lastEntry = new Date(filteredHistory[0].timestamp);
    const daysDiff = Math.max(1, Math.ceil((lastEntry - firstEntry) / (1000 * 60 * 60 * 24)));
    const avgDailyChange = totalChange / daysDiff;
    
    // Calculate win/loss ratio
    const winRate = filteredHistory.length > 0 ? (positiveChanges.length / filteredHistory.length) * 100 : 0;
    
    // Calculate score range
    const scores = filteredHistory.map(entry => entry.newScore);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;
    
    return {
        totalEntries: filteredHistory.length,
        avgDailyChange: avgDailyChange,
        winLossRatio: winRate,
        scoreRange: scoreRange
    };
}

function updateStatsSummary(filteredHistory) {
    const stats = calculateStatistics(filteredHistory);
    
    totalEntriesElement.textContent = stats.totalEntries;
    avgDailyChangeElement.textContent = stats.avgDailyChange >= 0 ? 
        `+${stats.avgDailyChange.toFixed(1)}` : stats.avgDailyChange.toFixed(1);
    winLossRatioElement.textContent = `${stats.winLossRatio.toFixed(1)}%`;
    scoreRangeElement.textContent = stats.scoreRange;
    
    // Update color coding for average daily change
    if (stats.avgDailyChange > 0) {
        avgDailyChangeElement.style.color = 'var(--success-color)';
    } else if (stats.avgDailyChange < 0) {
        avgDailyChangeElement.style.color = 'var(--danger-color)';
    } else {
        avgDailyChangeElement.style.color = 'var(--secondary-color)';
    }
}

function renderScoreTrendChart(filteredHistory) {
    const ctx = document.getElementById('score-trend-chart').getContext('2d');
    
    if (charts.scoreTrend) {
        charts.scoreTrend.destroy();
    }
    
    if (filteredHistory.length === 0) {
        showNoDataMessage('score-trend-chart');
        return;
    }
    
    // Sort by timestamp and prepare data
    const sortedHistory = [...filteredHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const labels = sortedHistory.map(entry => new Date(entry.timestamp).toLocaleDateString());
    const data = sortedHistory.map(entry => entry.newScore);
    
    charts.scoreTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score',
                data: data,
                borderColor: 'rgb(74, 111, 165)',
                backgroundColor: 'rgba(74, 111, 165, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgb(74, 111, 165)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function renderActivityChart(filteredHistory) {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    
    if (charts.activity) {
        charts.activity.destroy();
    }
    
    if (filteredHistory.length === 0) {
        showNoDataMessage('activity-chart');
        return;
    }
    
    // Group by date
    const activityByDate = {};
    filteredHistory.forEach(entry => {
        const date = new Date(entry.timestamp).toDateString();
        activityByDate[date] = (activityByDate[date] || 0) + 1;
    });
    
    const labels = Object.keys(activityByDate).sort((a, b) => new Date(a) - new Date(b));
    const data = labels.map(date => activityByDate[date]);
    
    charts.activity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(date => new Date(date).toLocaleDateString()),
            datasets: [{
                label: 'Activities',
                data: data,
                backgroundColor: 'rgba(71, 184, 224, 0.8)',
                borderColor: 'rgb(71, 184, 224)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function renderReasonUsageChart(filteredHistory) {
    const ctx = document.getElementById('reason-usage-chart').getContext('2d');
    
    if (charts.reasonUsage) {
        charts.reasonUsage.destroy();
    }
    
    if (filteredHistory.length === 0) {
        showNoDataMessage('reason-usage-chart');
        return;
    }
    
    // Group by reason
    const reasonCounts = {};
    filteredHistory.forEach(entry => {
        reasonCounts[entry.reason] = (reasonCounts[entry.reason] || 0) + 1;
    });
    
    const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sortedReasons.map(item => item[0]);
    const data = sortedReasons.map(item => item[1]);
    
    const colors = [
        'rgba(74, 111, 165, 0.8)',
        'rgba(71, 184, 224, 0.8)',
        'rgba(46, 204, 113, 0.8)',
        'rgba(231, 76, 60, 0.8)',
        'rgba(243, 156, 18, 0.8)',
        'rgba(155, 89, 182, 0.8)',
        'rgba(52, 152, 219, 0.8)',
        'rgba(241, 196, 15, 0.8)',
        'rgba(230, 126, 34, 0.8)',
        'rgba(149, 165, 166, 0.8)'
    ];
    
    charts.reasonUsage = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(color => color.replace('0.8', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15
                    }
                }
            }
        }
    });
}

function renderScoreDistributionChart(filteredHistory) {
    const ctx = document.getElementById('score-distribution-chart').getContext('2d');
    
    if (charts.scoreDistribution) {
        charts.scoreDistribution.destroy();
    }
    
    if (filteredHistory.length === 0) {
        showNoDataMessage('score-distribution-chart');
        return;
    }
    
    // Group score changes into ranges
    const ranges = [
        { label: '-50+', min: -Infinity, max: -50, count: 0 },
        { label: '-49 to -21', min: -49, max: -21, count: 0 },
        { label: '-20 to -6', min: -20, max: -6, count: 0 },
        { label: '-5 to -1', min: -5, max: -1, count: 0 },
        { label: '0', min: 0, max: 0, count: 0 },
        { label: '1 to 5', min: 1, max: 5, count: 0 },
        { label: '6 to 20', min: 6, max: 20, count: 0 },
        { label: '21 to 49', min: 21, max: 49, count: 0 },
        { label: '50+', min: 50, max: Infinity, count: 0 }
    ];
    
    filteredHistory.forEach(entry => {
        const change = entry.scoreChange;
        for (let range of ranges) {
            if (change >= range.min && change <= range.max) {
                range.count++;
                break;
            }
        }
    });
    
    const labels = ranges.map(r => r.label);
    const data = ranges.map(r => r.count);
    const colors = ranges.map(r => {
        if (r.max <= 0) return 'rgba(231, 76, 60, 0.8)'; // Red for negative
        if (r.min === 0 && r.max === 0) return 'rgba(149, 165, 166, 0.8)'; // Gray for zero
        return 'rgba(46, 204, 113, 0.8)'; // Green for positive
    });
    
    charts.scoreDistribution = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequency',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(color => color.replace('0.8', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function showNoDataMessage(canvasId) {
    const canvas = document.getElementById(canvasId);
    const wrapper = canvas.parentElement;
    wrapper.innerHTML = `
        <div class="no-data-message">
            <i class="fas fa-chart-line"></i>
            <p>No data available for the selected time period</p>
        </div>
    `;
}

function renderStatistics() {
    if (!statsVisible) return;
    
    const filteredHistory = filterHistoryByTimeRange(currentStatsFilter);
    
    updateStatsSummary(filteredHistory);
    renderScoreTrendChart(filteredHistory);
    renderActivityChart(filteredHistory);
    renderReasonUsageChart(filteredHistory);
    renderScoreDistributionChart(filteredHistory);
}

function toggleStatistics() {
    statsVisible = !statsVisible;
    if (statsVisible) {
        statisticsContent.classList.remove('hidden');
        toggleStatsBtn.innerHTML = '<i class="fas fa-chart-bar"></i> Hide Charts';
        renderStatistics();
    } else {
        statisticsContent.classList.add('hidden');
        toggleStatsBtn.innerHTML = '<i class="fas fa-chart-bar"></i> Show Charts';
    }
}

// Event Listeners - Statistics
toggleStatsBtn.addEventListener('click', toggleStatistics);
statsTimeFilter.addEventListener('change', (e) => {
    currentStatsFilter = e.target.value;
    renderStatistics();
});

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);