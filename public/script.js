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

            // Ensure all reasons have a type
            ensureReasonTypes();
            
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

// Event Listeners - Score Board
// Remove the old score button listeners as they're no longer needed
// addScoreButton.addEventListener('click', () => updateScore(true));
// minusScoreButton.addEventListener('click', () => updateScore(false));
addReasonButton.addEventListener('click', addReason);
closeModalButton.addEventListener('click', closeModal);
saveEditButton.addEventListener('click', saveEdit);
resetScoreButton.addEventListener('click', resetScore);

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
            // Update stored password
            password = newPassword;
            sessionStorage.setItem('scoreBoardPassword', password);

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

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);