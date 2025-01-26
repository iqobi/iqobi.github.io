document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date();
    const todayId = today.toISOString().slice(0,10).replace(/-/g, '');
    
    let puzzle;
    try {
        const response = await fetch('puzzles.json');
        const puzzles = await response.json();
        puzzle = puzzles.find(p => p.id === todayId);
    } catch (error) {
        console.error('Error loading puzzles:', error);
        return;
    }

    if (!puzzle) {
        alert('No puzzle available for today');
        return;
    }

    const state = {
        grid: JSON.parse(JSON.stringify(puzzle.initial_grid)),
        elapsedTime: 0,
        isRevealed: false,
        isCompleted: false,
        selectedCell: null,
        timerId: null
    };

    // Load from localStorage
    const savedState = localStorage.getItem(todayId);
    if (savedState) {
        Object.assign(state, JSON.parse(savedState));
    }

    const gridEl = document.getElementById('grid');
    const timerEl = document.getElementById('timer');
    const overlayEl = document.getElementById('overlay');
    const revealBtn = document.getElementById('reveal-btn');

    function updateTimerDisplay() {
        const minutes = Math.floor(state.elapsedTime / 60);
        const seconds = state.elapsedTime % 60;
        timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function startTimer() {
        if (!state.timerId) {
            state.timerId = setInterval(() => {
                state.elapsedTime++;
                updateTimerDisplay();
                saveState();
            }, 1000);
        }
    }

    function stopTimer() {
        clearInterval(state.timerId);
        state.timerId = null;
    }

    function saveState() {
        localStorage.setItem(todayId, JSON.stringify(state));
    }

    function checkSolution() {
        const solution = puzzle.solution_grid;
        const isCorrect = state.grid.every((row, i) =>
            row.every((cell, j) => cell === solution[i][j])
        );
        
        if (isCorrect) {
            state.isCompleted = true;
            stopTimer();
            saveState();
        }
        return isCorrect;
    }

    function renderGrid() {
        gridEl.innerHTML = '';
        
        // Create grid cells
        puzzle.initial_grid.forEach((row, i) => {
            row.forEach((cell, j) => {
                const cellEl = document.createElement('div');
                cellEl.className = 'cell' + (cell !== null ? ' initial' : '');
                cellEl.textContent = state.grid[i][j] || '';
                if (!cell && !state.isCompleted) {
                    cellEl.addEventListener('click', () => {
                        state.selectedCell = state.selectedCell?.row === i && state.selectedCell?.col === j 
                            ? null 
                            : { row: i, col: j };
                        renderGrid();
                    });
                }
                if (state.selectedCell?.row === i && state.selectedCell?.col === j) {
                    cellEl.classList.add('selected');
                }
                gridEl.appendChild(cellEl);
            });
        });

        // Add constraints
        puzzle.constraints.horizontal.forEach((row, i) => {
            row.forEach((constraint, j) => {
                if (constraint) {
                    const el = document.createElement('div');
                    el.className = 'constraint';
                    el.style.left = `${(j + 1) * 68 - 12}px`;
                    el.style.top = `${i * 68 + 30}px`;
                    el.textContent = constraint === 'right' ? '→' : '←';
                    gridEl.appendChild(el);
                }
            });
        });

        puzzle.constraints.vertical.forEach((row, i) => {
            row.forEach((constraint, j) => {
                if (constraint) {
                    const el = document.createElement('div');
                    el.className = 'constraint';
                    el.style.left = `${j * 68 + 30}px`;
                    el.style.top = `${(i + 1) * 68 - 12}px`;
                    el.textContent = constraint === 'down' ? '↓' : '↑';
                    gridEl.appendChild(el);
                }
            });
        });
    }

    document.querySelectorAll('.number-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!state.selectedCell || state.isCompleted) return;
            
            const number = parseInt(btn.dataset.number);
            const { row, col } = state.selectedCell;
            state.grid[row][col] = number;
            state.selectedCell = null;
            
            if (!state.isRevealed) {
                state.isRevealed = true;
                overlayEl.style.display = 'none';
                startTimer();
            }
            
            checkSolution();
            renderGrid();
            saveState();
        });
    });

    document.querySelector('.clear-btn').addEventListener('click', () => {
        if (!state.selectedCell || state.isCompleted) return;
        
        const { row, col } = state.selectedCell;
        state.grid[row][col] = null;
        state.selectedCell = null;
        renderGrid();
        saveState();
    });

    revealBtn.addEventListener('click', () => {
        state.isRevealed = true;
        overlayEl.style.display = 'none';
        startTimer();
        saveState();
    });

    // Initial render
    overlayEl.style.display = state.isRevealed ? 'none' : 'flex';
    if (state.isCompleted) {
        state.grid = puzzle.solution_grid;
        stopTimer();
    }
    updateTimerDisplay();
    renderGrid();
});