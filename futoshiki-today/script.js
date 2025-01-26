/**************************************************************
  Web version of the Futoshiki Today iOS app
  - Loads puzzles from remote JSON
  - Matches iOS app's functionality and appearance
  - Includes sharing and local storage features
****************************************************************/

// Constants
const GRID_SIZE = 4;
const PUZZLE_URL = 'https://www.iqobi.com/futoshiki-today/puzzles.json';
const STORAGE_KEY = 'futoshikiTodayState';
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a'
];
let konamiIndex = 0;

// Add new constant for completed puzzles storage
const COMPLETED_PUZZLES_KEY = 'futoshikiCompletedPuzzles';

// Game state
let gameState = {
  grid: [],
  initialGrid: [],
  solutionGrid: [],
  constraints: {},
  selectedCell: null,
  startTime: null,
  isComplete: false,
  moves: [],
  puzzleId: null
};

// Initialize the game
async function init() {
  try {
    // Try to restore saved state
    const savedState = loadGameState();
    if (savedState) {
      gameState = savedState;
      setupUI();
      if (!gameState.isComplete) {
        startTimer();
      }
      return;
    }

    // Fetch puzzles from remote URL
    const response = await fetch(PUZZLE_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch puzzles');
    }
    const puzzles = await response.json();
    
    // Get today's puzzle
    const todayPuzzle = getTodayPuzzle(puzzles);
    if (!todayPuzzle) {
      document.getElementById('title-today').textContent = 'No puzzle found for today';
      return;
    }

    // Initialize game state
    gameState = createInitialState(todayPuzzle);
    
    // Set up UI
    setupUI();
    
  } catch (error) {
    console.error('Failed to initialize puzzle:', error);
    document.getElementById('title-today').textContent = 'Failed to load puzzle';
  }
}

// Get today's puzzle from the puzzle list
function getTodayPuzzle(puzzles) {
  const today = new Date();
  const dateString = today.getFullYear() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');
    
  return puzzles.find(puzzle => puzzle.id === dateString);
}

// Create initial game state from puzzle data
function createInitialState(puzzle) {
  return {
    grid: puzzle.initial_grid.map(row => [...row]),
    initialGrid: puzzle.initial_grid.map(row => [...row]),
    solutionGrid: puzzle.solution_grid.map(row => [...row]),
    constraints: {
      horizontal: puzzle.constraints.horizontal.map(row => [...row]),
      vertical: puzzle.constraints.vertical.map(row => [...row])
    },
    selectedCell: null,
    startTime: new Date(),
    isComplete: false,
    moves: [],
    puzzleId: puzzle.id
  };
}

// Set up the UI elements
function setupUI() {
  createGrid();
  setupToolbar();
  setupEventListeners();
  
  // Update title
  document.getElementById('title-today').textContent = 'Today';
  
  // Show/hide reveal overlay
  const revealOverlay = document.getElementById('reveal-overlay');
  if (gameState.moves.length > 0 || gameState.isComplete) {
    revealOverlay.classList.add('hidden');
  } else {
    revealOverlay.classList.remove('hidden');
  }
}

// Create the puzzle grid
function createGrid() {
  const container = document.getElementById('puzzle-container');
  container.innerHTML = '';

  for (let row = 0; row < GRID_SIZE; row++) {
    const gridRow = document.createElement('div');
    gridRow.className = 'grid-row';

    for (let col = 0; col < GRID_SIZE; col++) {
      // Create cell
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      
      // Add value if exists
      const value = gameState.grid[row][col];
      if (value) {
        cell.textContent = value;
        if (gameState.initialGrid[row][col]) {
          cell.classList.add('initial');
        }
      }
      
      gridRow.appendChild(cell);

      // Add horizontal constraint if exists
      if (col < GRID_SIZE - 1) {
        const hConstraint = gameState.constraints.horizontal[row][col];
        if (hConstraint) {
          const constraintDiv = document.createElement('div');
          constraintDiv.className = 'constraint horizontal';
          constraintDiv.textContent = hConstraint === 'left' ? '<' : '>';
          gridRow.appendChild(constraintDiv);
        } else {
          const spacer = document.createElement('div');
          spacer.className = 'constraint horizontal';
          gridRow.appendChild(spacer);
        }
      }
    }
    
    container.appendChild(gridRow);

    // Add vertical constraints row if not last row
    if (row < GRID_SIZE - 1) {
      const constraintRow = document.createElement('div');
      constraintRow.className = 'constraint-row';
      
      for (let col = 0; col < GRID_SIZE; col++) {
        // Add vertical constraint or spacer
        const constraintDiv = document.createElement('div');
        constraintDiv.className = 'constraint vertical';
        const vConstraint = gameState.constraints.vertical[row][col];
        if (vConstraint) {
          constraintDiv.textContent = vConstraint === 'up' ? '∧' : '∨';
        }
        constraintRow.appendChild(constraintDiv);
        
        // Add horizontal spacer between vertical constraints
        if (col < GRID_SIZE - 1) {
          const spacer = document.createElement('div');
          spacer.className = 'constraint-spacer';
          constraintRow.appendChild(spacer);
        }
      }
      
      container.appendChild(constraintRow);
    }
  }

  // Restore selected cell if exists
  if (gameState.selectedCell) {
    const cell = document.querySelector(
      `.cell[data-row="${gameState.selectedCell.row}"][data-col="${gameState.selectedCell.col}"]`
    );
    if (cell) cell.classList.add('selected');
  }
}

// Set up the number toolbar
function setupToolbar() {
  const toolbar = document.getElementById('number-toolbar');
  toolbar.innerHTML = '';
  
  if (gameState.isComplete) {
    const shareButton = document.createElement('button');
    shareButton.className = 'share-button';
    shareButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>Share with friends';
    shareButton.onclick = showShareModal;
    toolbar.appendChild(shareButton);
  } else {
    // Add number buttons 1-4
    for (let i = 1; i <= 4; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      button.className = 'number-button';
      button.dataset.number = i;
      toolbar.appendChild(button);
    }
    
    // Add erase button
    const eraseButton = document.createElement('button');
    eraseButton.innerHTML = '&times;';
    eraseButton.className = 'number-button erase';
    toolbar.appendChild(eraseButton);
  }
}

// Set up event listeners
function setupEventListeners() {
  document.getElementById('puzzle-container').addEventListener('click', handleCellClick);
  document.getElementById('number-toolbar').addEventListener('click', handleNumberClick);
  document.getElementById('show-rules-btn').addEventListener('click', showRules);
  document.getElementById('close-rules-btn').addEventListener('click', hideRules);
  document.getElementById('reveal-btn').addEventListener('click', handleReveal);
  document.getElementById('copy-share-btn')?.addEventListener('click', copyShareText);
  document.getElementById('close-share-btn')?.addEventListener('click', hideShareModal);
  
  // Add Konami code listener
  document.addEventListener('keydown', handleKonamiCode);
  
  // Dev modal listeners
  document.getElementById('close-dev-modal-btn').addEventListener('click', hideDevModal);
  document.getElementById('load-date-btn').addEventListener('click', loadSelectedDate);
  document.getElementById('dev-reset-btn').addEventListener('click', () => {
    resetPuzzle();
    hideDevModal();
  });
  
  // Set max date to today
  const dateInput = document.getElementById('puzzle-date');
  const today = new Date();
  dateInput.max = today.toISOString().split('T')[0];
}

// Handle cell click
function handleCellClick(event) {
  const cell = event.target.closest('.cell');
  if (!cell || cell.classList.contains('initial')) return;
  
  // Remove previous selection
  document.querySelector('.cell.selected')?.classList.remove('selected');
  
  // Select new cell
  cell.classList.add('selected');
  gameState.selectedCell = {
    row: parseInt(cell.dataset.row),
    col: parseInt(cell.dataset.col)
  };
}

// Handle number click
function handleNumberClick(event) {
  const button = event.target.closest('button');
  if (!button || !gameState.selectedCell) return;
  
  const {row, col} = gameState.selectedCell;
  const value = button.classList.contains('erase') ? null : parseInt(button.dataset.number);
  
  // Record move
  if (value === null) {
    gameState.moves.push('🔙');
  } else if (value === gameState.solutionGrid[row][col]) {
    gameState.moves.push('✅');
  } else {
    gameState.moves.push('❌');
  }
  
  // Update cell
  gameState.grid[row][col] = value;
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  cell.textContent = value || '';
  
  // Save state
  saveGameState();
  
  // Check if puzzle is complete
  checkCompletion();
}

// Handle reveal button click
function handleReveal() {
  document.getElementById('reveal-overlay').classList.add('hidden');
  if (!gameState.isComplete) {
    startTimer();
  }
}

// Check if puzzle is complete
function checkCompletion() {
  const isComplete = gameState.grid.every((row, i) => 
    row.every((cell, j) => cell === gameState.solutionGrid[i][j])
  );
  
  if (isComplete && !gameState.isComplete) {
    gameState.isComplete = true;
    handleCompletion();
  }
}

// Timer functionality
let timerInterval;

function startTimer() {
  if (!gameState.startTime) {
    gameState.startTime = new Date();
  }
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function updateTimer() {
  const timeSpent = Math.floor((new Date() - gameState.startTime) / 1000);
  document.getElementById('timer-label').textContent = formatTime(timeSpent);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Share functionality
function showShareModal() {
  const modal = document.getElementById('share-modal');
  const shareText = document.getElementById('share-text');
  shareText.textContent = generateShareText();
  modal.classList.remove('hidden');
}

function hideShareModal() {
  document.getElementById('share-modal').classList.add('hidden');
  // Ensure grid shows complete solution
  if (gameState.isComplete) {
    gameState.grid = gameState.solutionGrid.map(row => [...row]);
    createGrid();
  }
}

function copyShareText() {
  const shareText = generateShareText();
  navigator.clipboard.writeText(shareText)
    .then(() => {
      const copyBtn = document.getElementById('copy-share-btn');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    });
}

function generateShareText() {
  const timeSpent = Math.floor((new Date() - gameState.startTime) / 1000);
  const date = new Date(parseInt(gameState.puzzleId.slice(0, 4)),
                       parseInt(gameState.puzzleId.slice(4, 6)) - 1,
                       parseInt(gameState.puzzleId.slice(6, 8)));
  
  return `Futoshiki ${date.toLocaleDateString()}: ${formatTime(timeSpent)}\n` +
         `${gameState.moves.join('')}\n` +
         `📲 www.futoshiki.today`;
}

// Rules modal
function showRules() {
  document.getElementById('rules-modal').classList.remove('hidden');
}

function hideRules() {
  document.getElementById('rules-modal').classList.add('hidden');
}

// Local storage
function saveGameState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
}

function loadGameState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  
  const state = JSON.parse(saved);
  const today = new Date();
  const todayString = today.getFullYear() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');
  
  // Only restore if it's today's puzzle
  if (state.puzzleId === todayString) {
    state.startTime = new Date(state.startTime);
    // If puzzle is complete, show solution grid
    if (state.isComplete) {
      state.grid = state.solutionGrid.map(row => [...row]);
    }
    return state;
  }
  
  return null;
}

// Update handleKonamiCode to show modal instead of direct reset
function handleKonamiCode(event) {
  if (event.key.toLowerCase() === KONAMI_CODE[konamiIndex].toLowerCase()) {
    konamiIndex++;
    
    if (konamiIndex === KONAMI_CODE.length) {
      showDevModal();
      konamiIndex = 0;
    }
  } else {
    konamiIndex = 0;
  }
}

// Add new functions for dev modal
function showDevModal() {
  const modal = document.getElementById('dev-modal');
  const dateInput = document.getElementById('puzzle-date');
  dateInput.value = new Date().toISOString().split('T')[0];
  modal.classList.remove('hidden');
}

function hideDevModal() {
  document.getElementById('dev-modal').classList.add('hidden');
}

// Add function to save completed puzzle
function saveCompletedPuzzle() {
  const completedPuzzles = loadCompletedPuzzles();
  const timeSpent = Math.floor((new Date() - gameState.startTime) / 1000);
  
  completedPuzzles[gameState.puzzleId] = {
    date: new Date().toISOString(),
    time: timeSpent,
    moves: gameState.moves
  };
  
  localStorage.setItem(COMPLETED_PUZZLES_KEY, JSON.stringify(completedPuzzles));
}

// Add function to load completed puzzles
function loadCompletedPuzzles() {
  const saved = localStorage.getItem(COMPLETED_PUZZLES_KEY);
  return saved ? JSON.parse(saved) : {};
}

// Update handleCompletion function to save completed puzzle
function handleCompletion() {
  // Stop timer
  stopTimer();
  clearInterval(timerInterval);
  timerInterval = null;

  // Show solution grid
  gameState.grid = gameState.solutionGrid.map(row => [...row]);
  
  // Save completion
  saveCompletedPuzzle();
  
  // Update the display
  createGrid();
  setupToolbar(); // Switch to share button
  saveGameState();
}

// Update loadSelectedDate function to check if puzzle was already completed
async function loadSelectedDate() {
  const dateInput = document.getElementById('puzzle-date');
  const selectedDate = new Date(dateInput.value);
  const dateString = selectedDate.getFullYear() +
    String(selectedDate.getMonth() + 1).padStart(2, '0') +
    String(selectedDate.getDate()).padStart(2, '0');

  try {
    // Fetch puzzles
    const response = await fetch(PUZZLE_URL);
    if (!response.ok) throw new Error('Failed to fetch puzzles');
    const puzzles = await response.json();
    
    // Find selected puzzle
    const puzzle = puzzles.find(p => p.id === dateString);
    if (!puzzle) {
      alert('No puzzle found for selected date');
      return;
    }

    // Initialize new game state
    gameState = createInitialState(puzzle);
    
    // Check if puzzle was already completed
    const completedPuzzles = loadCompletedPuzzles();
    const completion = completedPuzzles[dateString];
    if (completion) {
      gameState.isComplete = true;
      gameState.grid = gameState.solutionGrid.map(row => [...row]);
      gameState.moves = completion.moves;
      gameState.startTime = new Date(new Date() - completion.time * 1000);
    }
    
    // Reset UI
    setupUI();
    if (!gameState.isComplete) {
      startTimer();
    }
    
    // Save state
    saveGameState();
    
    // Hide modal
    hideDevModal();
    
    // Show confirmation
    const message = document.createElement('div');
    message.textContent = `📅 Loaded puzzle for ${selectedDate.toLocaleDateString()}`;
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: var(--accent-color);
      color: white;
      padding: 16px 32px;
      border-radius: 25px;
      font-weight: bold;
      animation: fadeOut 1s ease-in-out forwards;
      z-index: 1000;
    `;
    
    document.body.appendChild(message);
    setTimeout(() => message.remove(), 1000);
    
  } catch (error) {
    console.error('Failed to load puzzle:', error);
    alert('Failed to load puzzle for selected date');
  }
}

// Add new function to reset the puzzle
function resetPuzzle() {
  // Reset the grid to initial state
  gameState.grid = gameState.initialGrid.map(row => [...row]);
  gameState.isComplete = false;
  gameState.selectedCell = null;
  gameState.startTime = new Date();
  gameState.moves = [];
  
  // Reset UI
  setupUI();
  
  // Start timer
  stopTimer();
  startTimer();
  
  // Save the reset state
  saveGameState();
  
  // Show a brief message
  const message = document.createElement('div');
  message.textContent = '🔄 Puzzle Reset!';
  message.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--accent-color);
    color: white;
    padding: 16px 32px;
    border-radius: 25px;
    font-weight: bold;
    animation: fadeOut 1s ease-in-out forwards;
    z-index: 1000;
  `;
  
  document.body.appendChild(message);
  setTimeout(() => message.remove(), 1000);
}

// Add to the CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(style);

// Initialize game when document is loaded
document.addEventListener('DOMContentLoaded', init);