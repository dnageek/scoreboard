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
const boardCardsContainer = document.getElementById('board-cards');
const addBoardBtn = document.getElementById('add-board-btn');
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
let isAuthenticated = false;
let savedBoards = {}; // Store multiple board credentials
let currentBoardId = null;
let changingPasswordForBoardId = null;
let isSyncing = false;
let offlineMode = false;
let pendingSync = false;
// Pagination state
let currentPage = 1;
const itemsPerPage = 10;

// History management - much higher limit with compression
const MAX_HISTORY_ENTRIES = 10000; // Keep max 10,000 history entries

// Function to trim history to prevent payload size issues
function trimHistory() {
    if (history.length > MAX_HISTORY_ENTRIES) {
        // Sort by timestamp to ensure we keep the most recent entries
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        // Keep only the most recent entries
        history = history
            .slice(0, MAX_HISTORY_ENTRIES)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        console.log(`History trimmed to ${MAX_HISTORY_ENTRIES} entries`);
    }
}

// Statistics state
let statsVisible = true;
let currentStatsFilter = 'all';
let charts = {};
// Always use relative path for API URL to work across devices
const API_URL = '/api';

let clientIdCounter = 0;

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

function generateClientId(prefix = 'id') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${prefix}-${window.crypto.randomUUID()}`;
    }

    clientIdCounter += 1;
    return `${prefix}-${Date.now()}-${clientIdCounter}`;
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
        runIncrementalSync(() => boardRequest('/reasons/reorder', {
            method: 'PUT',
            body: { reasons }
        }));
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

            // Load saved boards
            loadSavedBoards();

            // Clear legacy password storage and use the server's HttpOnly session cookie instead
            syncId = getCookie('scoreBoardSyncId');
            const legacyPassword = getCookie('scoreBoardPassword') || sessionStorage.getItem('scoreBoardPassword');
            removeCookie('scoreBoardPassword');
            sessionStorage.removeItem('scoreBoardPassword');

            if (syncId && legacyPassword) {
                loadBoardWithCredentials(syncId, legacyPassword);
            } else if (syncId) {
                loadBoardFromSession(syncId);
            } else {
                // Fall back to session storage (for backward compatibility)
                syncId = sessionStorage.getItem('scoreBoardSyncId');

                if (syncId) {
                    // Migrate the board ID from sessionStorage to a non-sensitive cookie
                    setCookie('scoreBoardSyncId', syncId);
                    sessionStorage.removeItem('scoreBoardSyncId');

                    loadBoardFromSession(syncId);
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
            boardList.innerHTML = '';
            const errorMessage = document.createElement('p');
            errorMessage.textContent = `Error connecting to server: ${err.message}`;
            boardList.appendChild(errorMessage);
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

        const boardIdElement = document.createElement('div');
        boardIdElement.className = 'board-id';
        boardIdElement.textContent = board.syncId;

        const lastUpdatedElement = document.createElement('div');
        lastUpdatedElement.className = 'last-updated';
        lastUpdatedElement.textContent = `Last updated: ${formattedDate}`;

        boardItem.append(boardIdElement, lastUpdatedElement);
        
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
    const rememberMe = document.getElementById('remember-login')?.checked ?? true;

    if (!newId || !newPass) {
        alert('Please enter both a board ID and password');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/scoreboard`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                syncId: newId,
                password: newPass,
                remember: rememberMe,
                currentScore: 0,
                reasons: [],
                history: []
            })
        });

        if (response.ok) {
            // Save credentials and show board
            syncId = newId;
            isAuthenticated = true;
            currentBoardId = newId;

            // Store only non-sensitive board selection data in readable cookies
            setCookie('scoreBoardSyncId', syncId);
            
            // Add to saved boards with initial score
            addBoardToSaved(newId, 0);

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

function applyLoadedBoardData(boardId, data) {
    // Save board session state. The actual auth token is an HttpOnly cookie set by the server.
    syncId = boardId;
    isAuthenticated = true;
    currentBoardId = boardId;

    // Store only non-sensitive board selection data in readable cookies
    setCookie('scoreBoardSyncId', syncId);
    removeCookie('scoreBoardPassword');
    sessionStorage.removeItem('scoreBoardPassword');

    // Add to saved boards with current score
    addBoardToSaved(boardId, data.currentScore);

    // Update data
    currentScore = typeof data.currentScore === 'number' ? data.currentScore : 0;
    reasons = Array.isArray(data.reasons) ? data.reasons : [];
    history = Array.isArray(data.history) ? data.history : [];

    // Trim history if it's too large
    trimHistory();

    if (history.length > 0) {
        recalculateHistoryState();
    }

    // Ensure all reasons have a type
    ensureReasonTypes();

    // Update UI
    renderReasonCards();
    renderHistory();
    updateScoreDisplay();
    renderStatistics();
    showScoreBoardPage();
}

async function loadBoardFromSession(boardId) {
    try {
        const dataResponse = await fetch(`${API_URL}/scoreboard/${boardId}`, {
            credentials: 'same-origin'
        });

        if (dataResponse.ok) {
            const data = await dataResponse.json();
            applyLoadedBoardData(boardId, data);
            return true;
        }

        isAuthenticated = false;
        if (dataResponse.status === 401) {
            showLoginPage();
            loadAvailableBoards();
            return false;
        }

        const errorData = await dataResponse.json();
        alert(`Error loading board: ${errorData.message}`);
        return false;
    } catch (err) {
        alert(`Error loading board: ${err.message}`);
        return false;
    }
}

// Load a board with the given credentials
async function loadBoardWithCredentials(boardId, boardPass) {
    try {
        const rememberMe = document.getElementById('remember-login')?.checked ?? true;

        // First verify the password
        const verifyResponse = await fetch(`${API_URL}/scoreboard/verify`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                syncId: boardId,
                password: boardPass,
                remember: rememberMe
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

        await loadBoardFromSession(boardId);
    } catch (err) {
        alert(`Error loading board: ${err.message}`);
    }
}

// Logout from the current board
async function logout() {
    const boardIdToClear = syncId;
    if (boardIdToClear && isAuthenticated) {
        fetch(`${API_URL}/scoreboard/${boardIdToClear}/session`, {
            method: 'DELETE',
            credentials: 'same-origin'
        }).catch(err => console.warn('Failed to clear server session:', err));
    }

    // Clear current board credentials from cookies and session storage
    syncId = null;
    isAuthenticated = false;
    currentBoardId = null;
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
        const response = await fetch(`${API_URL}/scoreboard/${syncId}`, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: deletePassword })
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
async function boardRequest(path, options = {}) {
    if (!syncId || !isAuthenticated) {
        throw new Error('Board session is missing');
    }

    const headers = {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
    };
    const config = {
        ...options,
        credentials: 'same-origin',
        headers
    };

    if (options.body && typeof options.body !== 'string') {
        config.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_URL}/scoreboard/${syncId}${path}`, config);
    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            if (errorData.message) {
                message = errorData.message;
            }
        }

        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('content-type');
    return contentType && contentType.includes('application/json') ? response.json() : null;
}

async function syncWithServer() {
    // If not ready to sync, just mark that sync is needed
    if (!syncId || !isAuthenticated) return;

    if (offlineMode) {
        const serverAvailable = await checkServerAvailability();
        if (!serverAvailable) {
            setTimeout(syncWithServer, 60000);
            return;
        }
        offlineMode = false;
    }
    
    // If already syncing, mark that another sync is pending
    if (isSyncing) {
        pendingSync = true;
        return;
    }

    try {
        isSyncing = true;
        pendingSync = false;
        updateSyncStatus('Syncing...');

        // Capture current state to avoid race conditions
        const dataToSync = {
            syncId,
            currentScore,
            reasons: [...reasons],
            history: [...history]
        };
        
        // Validate data can be serialized to JSON
        try {
            JSON.stringify(dataToSync);
        } catch (jsonError) {
            console.error('JSON serialization error:', jsonError);
            console.error('Data that failed to serialize:', dataToSync);
            updateSyncStatus(`Data error: ${jsonError.message}`);
            return;
        }

        // Add retry logic
        let retries = 3;
        let success = false;
        let errorMsg = '';

        while (retries > 0 && !success) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                // Log the data being sent for debugging
                console.log('Sending sync data:', {
                    syncId: dataToSync.syncId,
                    currentScore: dataToSync.currentScore,
                    reasonsCount: dataToSync.reasons.length,
                    historyCount: dataToSync.history.length
                });
                
                const response = await fetch(`${API_URL}/scoreboard`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dataToSync),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (response.ok) {
                    success = true;
                    offlineMode = false;
                    updateSyncStatus('Synced');
                    setTimeout(() => updateSyncStatus(''), 3000);
                } else {
                    // Check if response is JSON before parsing
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMsg = errorData.message;
                    } else {
                        // Server returned HTML error page (likely 500 error)
                        errorMsg = `Server error (${response.status}): ${response.statusText}`;
                        console.warn('Server returned non-JSON response:', await response.text());
                    }
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
        
        // If there was a pending sync request, trigger it now
        if (pendingSync) {
            setTimeout(syncWithServer, 100); // Small delay to avoid tight loop
        }
    }
}

function updateSyncStatus(message) {
    if (syncStatusElement) {
        syncStatusElement.textContent = message;
    }
}

function createIcon(className) {
    const icon = document.createElement('i');
    icon.className = className;
    icon.setAttribute('aria-hidden', 'true');
    return icon;
}

async function runIncrementalSync(action, successMessage = 'Synced') {
    if (!syncId || !isAuthenticated) return false;

    if (offlineMode) {
        pendingSync = true;
        setTimeout(syncWithServer, 1000);
        return false;
    }

    if (isSyncing) {
        pendingSync = true;
        return false;
    }

    try {
        isSyncing = true;
        pendingSync = false;
        updateSyncStatus('Syncing...');
        await action();
        offlineMode = false;
        updateSyncStatus(successMessage);
        setTimeout(() => updateSyncStatus(''), 3000);
        return true;
    } catch (err) {
        if (err.message.includes('Failed to fetch') || err.name === 'AbortError') {
            offlineMode = true;
            updateSyncStatus('Cannot connect to server. Try again later.');
        } else {
            updateSyncStatus(`Sync error: ${err.message}. Will retry full sync.`);
        }
        pendingSync = true;
        setTimeout(syncWithServer, 1000);
        return false;
    } finally {
        isSyncing = false;
        if (pendingSync) {
            setTimeout(syncWithServer, 100);
        }
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

        const reasonText = document.createElement('p');
        reasonText.textContent = reason.text;

        const cardActions = document.createElement('div');
        cardActions.className = 'card-actions';

        // Determine what button to show based on the reason type
        const actionButton = document.createElement('button');
        actionButton.dataset.id = reason.id;
        if (reason.type === REASON_TYPE.ADD) {
            actionButton.className = 'action-btn add-btn';
            actionButton.appendChild(createIcon('fas fa-plus'));
            actionButton.appendChild(document.createTextNode(` Add ${reason.score}`));
        } else if (reason.type === REASON_TYPE.SUBTRACT) {
            actionButton.className = 'action-btn subtract-btn';
            actionButton.appendChild(createIcon('fas fa-minus'));
            actionButton.appendChild(document.createTextNode(` Subtract ${reason.score}`));
        }

        const editButton = document.createElement('button');
        editButton.className = 'edit-btn';
        editButton.dataset.id = reason.id;
        editButton.appendChild(createIcon('fas fa-edit'));

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-reason-btn';
        deleteButton.dataset.id = reason.id;
        deleteButton.appendChild(createIcon('fas fa-trash'));

        if (actionButton.className) {
            cardActions.appendChild(actionButton);
        }
        cardActions.append(editButton, deleteButton);
        card.append(reasonText, cardActions);

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

    document.querySelectorAll('.delete-reason-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const reasonId = button.dataset.id;
            deleteReason(reasonId);
        });
    });

    // Prevent button clicks from starting drag operations
    document.querySelectorAll('.action-btn, .edit-btn, .delete-reason-btn').forEach(button => {
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

        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(entry.timestamp);

        const reasonCell = document.createElement('td');
        reasonCell.textContent = entry.reason;

        const changeCell = document.createElement('td');
        changeCell.className = entry.scoreChange > 0 ? 'positive' : 'negative';
        changeCell.textContent = `${entry.scoreChange > 0 ? '+' : ''}${entry.scoreChange}`;

        const newScoreCell = document.createElement('td');
        newScoreCell.textContent = entry.newScore;

        const actionsCell = document.createElement('td');
        const undoButton = document.createElement('button');
        undoButton.className = 'undo-btn';
        undoButton.dataset.index = globalIndex;
        undoButton.appendChild(createIcon('fas fa-undo'));
        undoButton.appendChild(document.createTextNode(' Undo'));
        actionsCell.appendChild(undoButton);

        row.append(dateCell, reasonCell, changeCell, newScoreCell, actionsCell);
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
    
    // Update score in saved boards
    if (currentBoardId && savedBoards[currentBoardId]) {
        savedBoards[currentBoardId].currentScore = currentScore;
        savedBoards[currentBoardId].lastAccessed = new Date().toISOString();
        saveBoardsToStorage();
        updateBoardCards();
    }
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

function reconcileEntrySync(localEntryId, result) {
    if (!result) return;

    if (result.entry) {
        const entryIndex = history.findIndex(entry => entry.id === localEntryId);
        if (entryIndex !== -1) {
            history[entryIndex] = result.entry;
        }
    }

    if (typeof result.currentScore === 'number') {
        currentScore = result.currentScore;
    }

    if (history.length > 0) {
        recalculateHistoryState();
    }

    updateScoreDisplay();
    renderHistory();
    renderStatistics();
}

function isManualResetEntry(entry) {
    return entry.reason === 'Manual reset' && entry.reasonId === null && typeof entry.newScore === 'number';
}

function recalculateHistoryState() {
    const sortedHistory = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (sortedHistory.length === 0) {
        history = [];
        currentScore = 0;
        return;
    }

    let runningScore = 0;

    history = sortedHistory.map(entry => {
        const normalizedEntry = { ...entry };

        if (isManualResetEntry(normalizedEntry)) {
            normalizedEntry.scoreChange = normalizedEntry.newScore - runningScore;
            runningScore = normalizedEntry.newScore;
        } else {
            runningScore += normalizedEntry.scoreChange;
            normalizedEntry.newScore = runningScore;
        }

        return normalizedEntry;
    });

    currentScore = runningScore;
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
        id: generateClientId('reason'),
        text,
        score,  // Store positive value
        type    // Store the explicitly selected type
    };

    reasons.push(newReason);
    renderReasonCards();

    // Clear inputs
    newReasonText.value = '';
    newReasonScore.value = '';

    // Auto-select the newly added reason
    selectReason(newReason.id);

    runIncrementalSync(() => boardRequest('/reasons', {
        method: 'POST',
        body: { reason: newReason }
    }));
}

// This function is no longer needed as we're now using updateScoreByReasonId
// function updateScore(isAddition) { ... }

// New function to update score by reason ID
function updateScoreByReasonId(reasonId, isAddition) {
    const reason = reasons.find(r => r.id === reasonId);
    if (!reason) return;

    if (history.length > 0) {
        recalculateHistoryState();
    }

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
    const newEntry = {
        id: generateClientId('entry'),
        timestamp: new Date().toISOString(),
        reason: reason.text,
        scoreChange,
        newScore: currentScore,
        reasonId: reason.id
    };
    history.push(newEntry);
    
    // Trim history to prevent payload size issues
    trimHistory();

    // Reset to first page to show the new entry
    currentPage = 1;
    updateScoreDisplay();
    renderHistory();
    renderStatistics();

    runIncrementalSync(async () => {
        const result = await boardRequest('/entries', {
            method: 'POST',
            body: {
                entry: newEntry,
                currentScore
            }
        });
        reconcileEntrySync(newEntry.id, result);
    });
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

    renderReasonCards();
    closeModal();

    runIncrementalSync(() => boardRequest(`/reasons/${editingReasonId}`, {
        method: 'PUT',
        body: {
            text,
            score,
            type
        }
    }));
}

function deleteReason(reasonId) {
    const reason = reasons.find(r => r.id === reasonId);
    if (!reason) return;

    const confirmed = confirm(`Remove "${reason.text}" from your score cards?`);
    if (!confirmed) return;

    reasons = reasons.filter(r => r.id !== reasonId);

    if (selectedReason === reasonId) {
        selectedReason = null;
    }

    renderReasonCards();

    runIncrementalSync(() => boardRequest(`/reasons/${reasonId}`, {
        method: 'DELETE'
    }));
}

// Handle undo action
function handleUndo(event) {
    const index = parseInt(event.currentTarget.dataset.index);
    const entry = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[index];
    
    if (!entry) return;
    
    // Remove this entry from history
    const entryIndex = history.findIndex(h => h.id === entry.id);
    if (entryIndex !== -1) {
        history.splice(entryIndex, 1);
    }

    recalculateHistoryState();
    
    // Check if we need to go to previous page (if current page becomes empty)
    const totalPages = Math.ceil(history.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    
    // Update UI and sync with server
    updateScoreDisplay();
    renderHistory();
    renderStatistics();

    runIncrementalSync(async () => {
        const result = await boardRequest(`/entries/${entry.id}`, {
            method: 'DELETE',
            body: { currentScore }
        });
        if (result) {
            if (Array.isArray(result.history)) {
                history = result.history;
            }
            if (typeof result.currentScore === 'number') {
                currentScore = result.currentScore;
            }
            if (!Array.isArray(result.history)) {
                recalculateHistoryState();
            }
            updateScoreDisplay();
            renderHistory();
            renderStatistics();
        }
    });
}

// Reset the score to a specific value
function resetScore() {
    const newScore = parseInt(resetScoreValue.value);
    
    if (isNaN(newScore)) {
        alert('Please enter a valid score value');
        return;
    }

    if (history.length > 0) {
        recalculateHistoryState();
    }
    
    // Calculate the score change
    const scoreChange = newScore - currentScore;
    
    // Update the current score
    currentScore = newScore;
    
    // Add to history
    const resetEntry = {
        id: generateClientId('entry'),
        timestamp: new Date().toISOString(),
        reason: 'Manual reset',
        scoreChange,
        newScore: currentScore,
        reasonId: null
    };
    history.push(resetEntry);
    
    // Trim history to prevent payload size issues
    trimHistory();
    
    // Update UI and sync with server
    // Reset to first page to show the new entry
    currentPage = 1;
    updateScoreDisplay();
    renderHistory();
    renderStatistics();
    
    // Clear the input
    resetScoreValue.value = '';

    runIncrementalSync(async () => {
        const result = await boardRequest('/entries', {
            method: 'POST',
            body: {
                entry: resetEntry,
                currentScore
            }
        });
        reconcileEntrySync(resetEntry.id, result);
    });
}


// Event Listeners - Login Page
createBoardBtn.addEventListener('click', createNewBoard);
accessBoardBtn.addEventListener('click', accessExistingBoard);
logoutBtn.addEventListener('click', logout);
deleteBoardBtn.addEventListener('click', showDeleteConfirmation);
confirmDeleteBtn.addEventListener('click', deleteBoard);
cancelDeleteBtn.addEventListener('click', closeDeleteConfirmation);
closeDeleteBtn.addEventListener('click', closeDeleteConfirmation);
// changePasswordBtn removed - now handled per-board
confirmChangePasswordBtn.addEventListener('click', changePassword);
cancelChangePasswordBtn.addEventListener('click', closeChangePasswordModal);
closePasswordBtn.addEventListener('click', closeChangePasswordModal);

// Function to randomly select a card (only positive cards)
function selectRandomCard() {
    // Remove any existing highlights
    document.querySelectorAll('.reason-card').forEach(card => {
        card.classList.remove('highlighted');
    });

    // Get only positive reason cards (add-card class)
    const positiveCards = document.querySelectorAll('.reason-card.add-card');

    // If no positive cards, show alert
    if (positiveCards.length === 0) {
        alert('No positive reason cards to select. Add some positive reasons first!');
        return;
    }

    // Select a random positive card
    const randomIndex = Math.floor(Math.random() * positiveCards.length);
    const selectedCard = positiveCards[randomIndex];

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

// Multi-board event listeners
addBoardBtn.addEventListener('click', () => {
    showLoginPage();
});

// Show change password modal for specific board
function showChangePasswordModal(boardId) {
    changingPasswordForBoardId = boardId;
    
    // Reset form fields
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';

    // Update modal title to show which board
    const modalTitle = changePasswordModal.querySelector('h3');
    if (modalTitle) {
        modalTitle.replaceChildren(
            createIcon('fas fa-key'),
            document.createTextNode(` Change Password for "${boardId}"`)
        );
    }

    // Show the modal
    changePasswordModal.style.display = 'block';
}

// Close change password modal
function closeChangePasswordModal() {
    changePasswordModal.style.display = 'none';
    changingPasswordForBoardId = null;
}

// Change the board password
async function changePassword() {
    if (!changingPasswordForBoardId) {
        alert('No board selected for password change');
        return;
    }
    
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
        updateSyncStatus(`Changing password for ${changingPasswordForBoardId}...`);

        const response = await fetch(`${API_URL}/scoreboard/${changingPasswordForBoardId}/password`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword,
                newPassword,
                remember: document.getElementById('remember-login')?.checked ?? true
            })
        });

        if (response.ok) {
            // If this is the currently active board, update global password too
            if (changingPasswordForBoardId === currentBoardId) {
                isAuthenticated = true;
                removeCookie('scoreBoardPassword');
                sessionStorage.removeItem('scoreBoardPassword');
            }

            alert(`Password changed successfully for "${changingPasswordForBoardId}"`);
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
    
    const sortedHistory = [...filteredHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const positiveChanges = sortedHistory.filter(entry => entry.scoreChange > 0);
    const negativeChanges = sortedHistory.filter(entry => entry.scoreChange < 0);
    
    // Calculate average daily change
    const totalChange = sortedHistory.reduce((sum, entry) => sum + entry.scoreChange, 0);
    const firstEntry = new Date(sortedHistory[0].timestamp);
    const lastEntry = new Date(sortedHistory[sortedHistory.length - 1].timestamp);
    const daysDiff = Math.max(1, Math.ceil((lastEntry - firstEntry) / (1000 * 60 * 60 * 24)));
    const avgDailyChange = totalChange / daysDiff;
    
    // Calculate win/loss ratio
    const winRate = sortedHistory.length > 0 ? (positiveChanges.length / sortedHistory.length) * 100 : 0;
    
    // Calculate score range
    const scores = sortedHistory.map(entry => entry.newScore);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;
    
    return {
        totalEntries: sortedHistory.length,
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
    if (charts.scoreTrend) {
        charts.scoreTrend.destroy();
        charts.scoreTrend = null;
    }
    
    if (filteredHistory.length === 0) {
        showNoDataMessage('score-trend-chart');
        return;
    }

    const canvas = prepareChartCanvas('score-trend-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
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
    if (charts.activity) {
        charts.activity.destroy();
        charts.activity = null;
    }
    
    if (filteredHistory.length === 0) {
        showNoDataMessage('activity-chart');
        return;
    }

    const canvas = prepareChartCanvas('activity-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Group by date and separate positive/negative activities
    const activityByDate = {};
    filteredHistory.forEach(entry => {
        const date = new Date(entry.timestamp).toDateString();
        if (!activityByDate[date]) {
            activityByDate[date] = { positive: 0, negative: 0 };
        }
        
        if (entry.scoreChange > 0) {
            activityByDate[date].positive += 1;
        } else if (entry.scoreChange < 0) {
            activityByDate[date].negative += 1;
        }
    });
    
    const labels = Object.keys(activityByDate).sort((a, b) => new Date(a) - new Date(b));
    const positiveData = labels.map(date => activityByDate[date].positive);
    const negativeData = labels.map(date => activityByDate[date].negative);
    
    charts.activity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(date => new Date(date).toLocaleDateString()),
            datasets: [
                {
                    label: 'Positive Activities',
                    data: positiveData,
                    backgroundColor: 'rgba(46, 204, 113, 0.8)',
                    borderColor: 'rgb(46, 204, 113)',
                    borderWidth: 2
                },
                {
                    label: 'Negative Activities',
                    data: negativeData,
                    backgroundColor: 'rgba(231, 76, 60, 0.8)',
                    borderColor: 'rgb(231, 76, 60)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        afterLabel: function(context) {
                            const datasetIndex = context.datasetIndex;
                            const dataIndex = context.dataIndex;
                            const positiveCount = positiveData[dataIndex];
                            const negativeCount = negativeData[dataIndex];
                            const total = positiveCount + negativeCount;
                            return `Total: ${total} activities`;
                        }
                    }
                }
            }
        }
    });
}

function renderReasonUsageChart(filteredHistory) {
    // Clean up existing charts
    if (charts.positiveReasons) {
        charts.positiveReasons.destroy();
        charts.positiveReasons = null;
    }
    if (charts.negativeReasons) {
        charts.negativeReasons.destroy();
        charts.negativeReasons = null;
    }
    
    if (filteredHistory.length === 0) {
        showNoDataMessage('positive-reason-chart');
        showNoDataMessage('negative-reason-chart');
        return;
    }
    
    // Separate positive and negative score changes
    const positiveEntries = filteredHistory.filter(entry => entry.scoreChange > 0);
    const negativeEntries = filteredHistory.filter(entry => entry.scoreChange < 0);
    
    // Render positive reasons chart
    renderPositiveReasonChart(positiveEntries);
    
    // Render negative reasons chart
    renderNegativeReasonChart(negativeEntries);
}

function renderPositiveReasonChart(positiveEntries) {
    if (positiveEntries.length === 0) {
        showNoDataMessage('positive-reason-chart');
        return;
    }

    const canvas = prepareChartCanvas('positive-reason-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Group by reason
    const reasonCounts = {};
    positiveEntries.forEach(entry => {
        reasonCounts[entry.reason] = (reasonCounts[entry.reason] || 0) + 1;
    });
    
    const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const labels = sortedReasons.map(item => item[0]);
    const data = sortedReasons.map(item => item[1]);
    
    const positiveColors = [
        'rgba(46, 204, 113, 0.8)',   // Green
        'rgba(39, 174, 96, 0.8)',    // Dark green
        'rgba(26, 188, 156, 0.8)',   // Turquoise
        'rgba(22, 160, 133, 0.8)',   // Dark turquoise
        'rgba(52, 152, 219, 0.8)',   // Blue
        'rgba(41, 128, 185, 0.8)',   // Dark blue
        'rgba(155, 89, 182, 0.8)',   // Purple
        'rgba(142, 68, 173, 0.8)'    // Dark purple
    ];
    
    charts.positiveReasons = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: positiveColors,
                borderColor: positiveColors.map(color => color.replace('0.8', '1')),
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
                        boxWidth: 10,
                        padding: 8,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function renderNegativeReasonChart(negativeEntries) {
    if (negativeEntries.length === 0) {
        showNoDataMessage('negative-reason-chart');
        return;
    }

    const canvas = prepareChartCanvas('negative-reason-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Group by reason
    const reasonCounts = {};
    negativeEntries.forEach(entry => {
        reasonCounts[entry.reason] = (reasonCounts[entry.reason] || 0) + 1;
    });
    
    const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const labels = sortedReasons.map(item => item[0]);
    const data = sortedReasons.map(item => item[1]);
    
    const negativeColors = [
        'rgba(231, 76, 60, 0.8)',    // Red
        'rgba(192, 57, 43, 0.8)',    // Dark red
        'rgba(230, 126, 34, 0.8)',   // Orange
        'rgba(211, 84, 0, 0.8)',     // Dark orange
        'rgba(243, 156, 18, 0.8)',   // Yellow
        'rgba(212, 172, 13, 0.8)',   // Dark yellow
        'rgba(149, 165, 166, 0.8)',  // Gray
        'rgba(127, 140, 141, 0.8)'   // Dark gray
    ];
    
    charts.negativeReasons = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: negativeColors,
                borderColor: negativeColors.map(color => color.replace('0.8', '1')),
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
                        boxWidth: 10,
                        padding: 8,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}


function prepareChartCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const wrapper = canvas.parentElement;
    canvas.style.display = '';

    const existingMessage = wrapper.querySelector('.no-data-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    return canvas;
}

function showNoDataMessage(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const wrapper = canvas.parentElement;
    canvas.style.display = 'none';

    let message = wrapper.querySelector('.no-data-message');
    if (!message) {
        message = document.createElement('div');
        message.className = 'no-data-message';
        message.appendChild(createIcon('fas fa-chart-line'));

        const text = document.createElement('p');
        text.textContent = 'No data available for the selected time period';
        message.appendChild(text);
        wrapper.appendChild(message);
    }
}

function renderStatistics() {
    if (!statsVisible) return;
    
    const filteredHistory = filterHistoryByTimeRange(currentStatsFilter);
    
    updateStatsSummary(filteredHistory);
    renderScoreTrendChart(filteredHistory);
    renderActivityChart(filteredHistory);
    renderReasonUsageChart(filteredHistory);
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

// Multi-board management functions
function loadSavedBoards() {
    const saved = getCookie('savedBoards');
    if (saved) {
        try {
            savedBoards = JSON.parse(saved);
            if (!savedBoards || typeof savedBoards !== 'object' || Array.isArray(savedBoards)) {
                savedBoards = {};
            }
            Object.entries(savedBoards).forEach(([boardId, board]) => {
                if (!board || typeof board !== 'object') {
                    delete savedBoards[boardId];
                    return;
                }
                delete board.password;
            });
            saveBoardsToStorage();
        } catch (e) {
            savedBoards = {};
        }
    }
    updateBoardCards();
}

function saveBoardsToStorage() {
    setCookie('savedBoards', JSON.stringify(savedBoards));
}

function addBoardToSaved(boardId, score = 0) {
    // Generate a color for the board based on board ID
    const colors = [
        '#4a6fa5', '#e74c3c', '#2ecc71', '#f39c12', 
        '#9b59b6', '#1abc9c', '#34495e', '#e67e22'
    ];
    const colorIndex = boardId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    
    savedBoards[boardId] = {
        lastAccessed: new Date().toISOString(),
        currentScore: score,
        color: colors[colorIndex]
    };
    saveBoardsToStorage();
    updateBoardCards();
}

function updateBoardCards() {
    if (!boardCardsContainer) return;
    
    boardCardsContainer.innerHTML = '';
    
    if (Object.keys(savedBoards).length === 0) {
        boardCardsContainer.innerHTML = '<p class="no-boards">No saved boards yet. Add your first board!</p>';
        return;
    }
    
    Object.entries(savedBoards).forEach(([boardId, boardData]) => {
        const card = document.createElement('div');
        card.className = `board-card ${boardId === currentBoardId ? 'active' : ''}`;
        const color = /^#[0-9A-Fa-f]{6}$/.test(boardData.color) ? boardData.color : '#4a6fa5';
        card.style.borderLeftColor = color;
        
        const lastAccessed = new Date(boardData.lastAccessed);
        const timeAgo = getTimeAgo(lastAccessed);

        const header = document.createElement('div');
        header.className = 'board-card-header';

        const icon = document.createElement('div');
        icon.className = 'board-icon';
        icon.style.backgroundColor = color;
        icon.appendChild(createIcon('fas fa-clipboard-list'));

        const info = document.createElement('div');
        info.className = 'board-info';
        const name = document.createElement('h4');
        name.className = 'board-name';
        name.textContent = boardId;
        const score = document.createElement('p');
        score.className = 'board-score';
        score.textContent = `Score: ${boardData.currentScore || 0}`;
        info.append(name, score);

        const actions = document.createElement('div');
        actions.className = 'board-actions';

        const settingsButton = document.createElement('button');
        settingsButton.className = 'board-action-btn board-settings-btn';
        settingsButton.dataset.board = boardId;
        settingsButton.title = 'Change password';
        settingsButton.appendChild(createIcon('fas fa-cog'));

        const removeButton = document.createElement('button');
        removeButton.className = 'board-action-btn board-remove-btn';
        removeButton.dataset.board = boardId;
        removeButton.title = 'Remove from saved boards';
        removeButton.appendChild(createIcon('fas fa-times'));

        actions.append(settingsButton, removeButton);
        header.append(icon, info, actions);

        const footer = document.createElement('div');
        footer.className = 'board-card-footer';
        const lastAccessedElement = document.createElement('span');
        lastAccessedElement.className = 'last-accessed';
        lastAccessedElement.textContent = `Last accessed: ${timeAgo}`;
        footer.appendChild(lastAccessedElement);

        card.append(header, footer);
        
        // Add click event to switch boards
        card.addEventListener('click', (e) => {
            if (e.target.closest('.board-remove-btn')) {
                removeBoardFromSaved(boardId);
                return;
            }
            if (e.target.closest('.board-settings-btn')) {
                showChangePasswordModal(boardId);
                return;
            }
            switchToBoard(boardId);
        });
        
        boardCardsContainer.appendChild(card);
    });
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function removeBoardFromSaved(boardId) {
    if (confirm(`Remove "${boardId}" from saved boards?`)) {
        delete savedBoards[boardId];
        saveBoardsToStorage();
        updateBoardCards();
        
        // If removing current board, clear current session
        if (boardId === currentBoardId) {
            logout();
        }
    }
}

function switchToBoard(boardId) {
    if (!savedBoards[boardId]) return;

    loadBoardFromSession(boardId).then(loaded => {
        if (!loaded) {
            existingBoardId.value = boardId;
            existingBoardPassword.focus();
        }
    });
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
