// --- CONFIGURAÇÕES E CONSTANTES ---
const PIECES = {
    EMPTY: 0,
    WHITE: 1,
    BLACK: 2,
    WHITE_KING: 3,
    BLACK_KING: 4
};

const INITIAL_BOARD = [
    [0, 2, 0, 2, 0, 2, 0, 2],
    [2, 0, 2, 0, 2, 0, 2, 0],
    [0, 2, 0, 2, 0, 2, 0, 2],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0]
];

const LESSONS = [
    { id: 'intro', unit: 1, title: 'O Tabuleiro', icon: 'chess-board', xp: 10, content: 'O jogo de Damas é jogado em um tabuleiro de 8x8 casas. As jogadas acontecem exclusivamente nas casas escuras.' },
    { id: 'mov-1', unit: 1, title: 'Movimentação', icon: 'arrow-up-right', xp: 20, content: 'As peças comuns andam uma casa para frente nas diagonais. Tente mover suas peças em direção ao campo adversário!' },
    { id: 'cap-1', unit: 2, title: 'Captura Simples', icon: 'skull', xp: 30, content: 'Se houver uma peça inimiga adjacente e a casa seguinte estiver vazia, você deve saltar sobre ela para capturá-la.' },
    { id: 'cap-mult', unit: 2, title: 'Capturas Múltiplas', icon: 'bolt', xp: 50, content: 'Nas Damas Brasileiras, se após uma captura você puder realizar outra, a captura continua na mesma jogada!' },
    { id: 'king', unit: 3, title: 'A Dama', icon: 'crown', xp: 40, content: 'Ao chegar na última linha do adversário, sua peça vira Dama! Ela pode andar e capturar por várias casas na diagonal.' }
];

// --- ESTADO DO SISTEMA ---
let state = {
    screen: 'learn',
    user: {
        xp: 0,
        streak: 1,
        level: 1,
        lastLogin: null,
        completedLessons: [],
        unlockedUnits: [1]
    },
    game: {
        board: [],
        turn: PIECES.WHITE,
        selectedSquare: null,
        possibleMoves: [],
        isAITurn: false,
        difficulty: 'Aprendiz'
    }
};

// --- LOGICA DE REGRAS ---
const isCoordIn = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const isOpen = (board, r, c) => isCoordIn(r, c) && board[r][c] === PIECES.EMPTY;

function getValidMoves(board, player) {
    const moves = [];
    const captures = [];
    const getPlayerColor = (p) => (p === PIECES.WHITE || p === PIECES.WHITE_KING) ? PIECES.WHITE : PIECES.BLACK;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece !== PIECES.EMPTY && getPlayerColor(piece) === player) {
                const pieceCaptures = getCapturesForPiece(board, r, c);
                if (pieceCaptures.length > 0) captures.push(...pieceCaptures);
            }
        }
    }

    if (captures.length > 0) {
        const maxLen = Math.max(...captures.map(c => c.sequence.length));
        return captures.filter(c => c.sequence.length === maxLen);
    }

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece !== PIECES.EMPTY && getPlayerColor(piece) === player) {
                moves.push(...getNormalMovesForPiece(board, r, c));
            }
        }
    }
    return moves;
}

function getNormalMovesForPiece(board, r, c) {
    const piece = board[r][c];
    const moves = [];
    const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

    if (piece === PIECES.WHITE) {
        [[-1, -1], [-1, 1]].forEach(d => {
            const nr = r + d[0], nc = c + d[1];
            if (isOpen(board, nr, nc)) moves.push({ from: [r, c], to: [nr, nc], sequence: [] });
        });
    } else if (piece === PIECES.BLACK) {
        [[1, -1], [1, 1]].forEach(d => {
            const nr = r + d[0], nc = c + d[1];
            if (isOpen(board, nr, nc)) moves.push({ from: [r, c], to: [nr, nc], sequence: [] });
        });
    } else {
        dirs.forEach(d => {
            let nr = r + d[0], nc = c + d[1];
            while (isOpen(board, nr, nc)) {
                moves.push({ from: [r, c], to: [nr, nc], sequence: [] });
                nr += d[0]; nc += d[1];
            }
        });
    }
    return moves;
}

function getCapturesForPiece(board, r, c, visited = []) {
    const piece = board[r][c];
    const player = (piece === PIECES.WHITE || piece === PIECES.WHITE_KING) ? PIECES.WHITE : PIECES.BLACK;
    const opponent = player === PIECES.WHITE ? PIECES.BLACK : PIECES.WHITE;
    const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    let results = [];
    const getPieceColor = (p) => (p === PIECES.WHITE || p === PIECES.WHITE_KING) ? PIECES.WHITE : PIECES.BLACK;

    dirs.forEach(d => {
        if (piece === PIECES.WHITE || piece === PIECES.BLACK) {
            const mr = r + d[0], mc = c + d[1];
            const tr = r + d[0] * 2, tc = c + d[1] * 2;
            
            if (isCoordIn(mr, mc) && isCoordIn(tr, tc)) {
                const target = board[mr][mc];
                if (target !== PIECES.EMPTY && getPieceColor(target) === opponent && board[tr][tc] === PIECES.EMPTY) {
                    if (!visited.some(v => v[0] === mr && v[1] === mc)) {
                        const nextBoard = board.map(row => [...row]);
                        nextBoard[tr][tc] = piece;
                        nextBoard[r][c] = PIECES.EMPTY;
                        nextBoard[mr][mc] = PIECES.EMPTY;
                        
                        const deeper = getCapturesForPiece(nextBoard, tr, tc, [...visited, [mr, mc]]);
                        if (deeper.length > 0) {
                            deeper.forEach(sub => results.push({ from: [r, c], to: sub.to, sequence: [[mr, mc], ...sub.sequence] }));
                        } else {
                            results.push({ from: [r, c], to: [tr, tc], sequence: [[mr, mc]] });
                        }
                    }
                }
            }
        }
    });

    return results;
}

function applyMove(board, move) {
    const nb = board.map(row => [...row]);
    let piece = nb[move.from[0]][move.from[1]];
    
    if (piece === PIECES.WHITE && move.to[0] === 0) piece = PIECES.WHITE_KING;
    if (piece === PIECES.BLACK && move.to[0] === 7) piece = PIECES.BLACK_KING;

    nb[move.to[0]][move.to[1]] = piece;
    nb[move.from[0]][move.from[1]] = PIECES.EMPTY;
    
    if (move.sequence && move.sequence.length > 0) {
        move.sequence.forEach(cap => { nb[cap[0]][cap[1]] = PIECES.EMPTY; });
    }
    return nb;
}

// --- RENDERIZAÇÃO E TELAS ---
const Screens = {
    learn: () => {
        const html = `
            <div class="unit-card">
                <h2>Unidade 1</h2>
                <p>Fundamentos das Damas Brasileiras</p>
            </div>
            <div class="path-container">
                ${LESSONS.map((l, index) => {
                    const isCompleted = state.user.completedLessons.includes(l.id);
                    const isAvailable = index === 0 || state.user.completedLessons.includes(LESSONS[index - 1].id);
                    const statusClass = isCompleted ? 'completed' : (isAvailable ? 'available' : 'locked');
                    
                    return `
                        <div class="node-wrapper">
                            <div class="lesson-node ${statusClass}" onclick="startLesson('${l.id}')">
                                <i class="fas fa-${l.icon}"></i>
                            </div>
                            <div class="lesson-label">${l.title}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        document.getElementById('screen-container').innerHTML = html;
    },
    play: () => {
        const html = `
            <div class="play-header">
                <h3>Jogar vs Pantera</h3>
                <select id="diff-select" onchange="state.game.difficulty = this.value">
                    <option>Filhote</option>
                    <option selected>Aprendiz</option>
                    <option>Estrategista</option>
                    <option>Pantera</option>
                </select>
            </div>
            <div class="board-wrapper">
                <div id="board" class="board"></div>
            </div>
            <div class="game-controls">
                <button class="btn-primary" onclick="initGame()">Reiniciar Partida</button>
            </div>
        `;
        document.getElementById('screen-container').innerHTML = html;
        initGame();
    },
    academy: () => {
        const html = `
            <div class="info-card">
                <i class="fas fa-graduation-cap" style="font-size: 3rem; color: var(--primary); margin-bottom: 10px;"></i>
                <h2>Academia de Estratégias</h2>
                <p style="margin-top: 10px; color: var(--text-muted);">
                    Em breve! Aqui você aprenderá conceitos avançados como Controle do Centro, Bloqueios e Aberturas Clássicas.
                </p>
            </div>
        `;
        document.getElementById('screen-container').innerHTML = html;
    },
    profile: () => {
        const html = `
            <div class="profile-card">
                <div class="panther-avatar">🐆</div>
                <h2>Jogador Dama Academy</h2>
                <div class="stats-grid">
                    <div class="stat-box"><strong>${state.user.xp}</strong><span>XP Total</span></div>
                    <div class="stat-box"><strong>${state.user.level}</strong><span>Nível</span></div>
                    <div class="stat-box"><strong>${state.user.streak}🔥</strong><span>Sequência</span></div>
                </div>
                <button class="btn-primary" style="margin-top: 25px; width:100%" onclick="resetProgress()">Resetar Progresso</button>
            </div>
        `;
        document.getElementById('screen-container').innerHTML = html;
    }
};

// --- CONTROLE DE JOGO & TABULEIRO ---
function renderBoard() {
    const boardElement = document.getElementById('board');
    if (!boardElement) return;
    
    boardElement.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            
            const pieceType = state.game.board[r][c];
            if (pieceType !== PIECES.EMPTY) {
                const p = document.createElement('div');
                const isWhite = pieceType === PIECES.WHITE || pieceType === PIECES.WHITE_KING;
                const isKing = pieceType === PIECES.WHITE_KING || pieceType === PIECES.BLACK_KING;
                p.className = `piece ${isWhite ? 'white' : 'black'} ${isKing ? 'king' : ''}`;
                sq.appendChild(p);
            }

            if (state.game.selectedSquare && state.game.selectedSquare[0] === r && state.game.selectedSquare[1] === c) {
                sq.classList.add('selected');
            }

            const isPossible = state.game.possibleMoves.find(m => m.to[0] === r && m.to[1] === c);
            if (isPossible) {
                const hint = document.createElement('div');
                hint.className = 'move-hint';
                sq.appendChild(hint);
            }

            sq.onclick = () => handleSquareClick(r, c);
            boardElement.appendChild(sq);
        }
    }
}

function handleSquareClick(r, c) {
    if (state.game.isAITurn) return;

    const piece = state.game.board[r][c];
    const isPlayerPiece = (piece === PIECES.WHITE || piece === PIECES.WHITE_KING);

    if (isPlayerPiece) {
        state.game.selectedSquare = [r, c];
        const allMoves = getValidMoves(state.game.board, PIECES.WHITE);
        state.game.possibleMoves = allMoves.filter(m => m.from[0] === r && m.from[1] === c);
    } else {
        const move = state.game.possibleMoves.find(m => m.to[0] === r && m.to[1] === c);
        if (move) {
            executeMove(move);
            return;
        }
        state.game.selectedSquare = null;
        state.game.possibleMoves = [];
    }
    renderBoard();
}

function executeMove(move) {
    state.game.board = applyMove(state.game.board, move);
    state.game.selectedSquare = null;
    state.game.possibleMoves = [];
    state.game.turn = state.game.turn === PIECES.WHITE ? PIECES.BLACK : PIECES.WHITE;

    renderBoard();

    const nextMoves = getValidMoves(state.game.board, state.game.turn);
    if (nextMoves.length === 0) {
        showFeedback("Fim de Jogo", state.game.turn === PIECES.BLACK ? "Vitória! A Pantera está impressionada." : "A Pantera venceu. Tente novamente!", true);
        return;
    }

    if (state.game.turn === PIECES.BLACK) {
        state.game.isAITurn = true;
        setTimeout(makeAIMove, 600);
    }
}

function makeAIMove() {
    const moves = getValidMoves(state.game.board, PIECES.BLACK);
    if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        executeMove(randomMove);
    }
    state.game.isAITurn = false;
}

function initGame() {
    state.game.board = INITIAL_BOARD.map(row => [...row]);
    state.game.turn = PIECES.WHITE;
    state.game.isAITurn = false;
    state.game.selectedSquare = null;
    state.game.possibleMoves = [];
    renderBoard();
}

// --- FUNÇÕES DE INTERAÇÃO & PROGRESSO ---
window.startLesson = (id) => {
    const lesson = LESSONS.find(l => l.id === id);
    if (!lesson) return;
    
    showFeedback(lesson.title, lesson.content, false, () => {
        if (!state.user.completedLessons.includes(id)) {
            state.user.completedLessons.push(id);
            addXP(lesson.xp);
        }
        Screens.learn();
    });
};

function addXP(amount) {
    state.user.xp += amount;
    state.user.level = Math.floor(state.user.xp / 100) + 1;
    updateHeader();
    saveData();
    if (typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    }
}

function updateHeader() {
    document.getElementById('xp-val').innerText = state.user.xp;
    document.getElementById('streak-val').innerText = state.user.streak;
}

function showFeedback(title, msg, isGameEnd, onConfirm) {
    const overlay = document.getElementById('feedback-overlay');
    document.getElementById('feedback-title').innerText = title;
    document.getElementById('feedback-msg').innerText = msg;
    overlay.classList.remove('hidden');
    
    document.getElementById('feedback-btn').onclick = () => {
        overlay.classList.add('hidden');
        if (onConfirm) onConfirm();
        if (isGameEnd) Screens.learn();
    };
}

function saveData() {
    localStorage.setItem('dama_academy_data', JSON.stringify(state.user));
}

function loadData() {
    const saved = localStorage.getItem('dama_academy_data');
    if (saved) {
        state.user = { ...state.user, ...JSON.parse(saved) };
        updateHeader();
    }
}

window.resetProgress = () => {
    if (confirm("Deseja apagar todo o seu progresso?")) {
        localStorage.removeItem('dama_academy_data');
        location.reload();
    }
};

// --- NAVEGAÇÃO E INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", () => {
    loadData();
    Screens.learn();

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            btn.classList.add('active');
            state.screen = btn.dataset.screen;
            Screens[state.screen]();
        };
    });
});