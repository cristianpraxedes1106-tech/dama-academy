/**
 * DAMA ACADEMY - PREMIUM CORE
 * Reescrito para suportar animações, som procedural e mascote SVG.
 */

// --- MOTOR DE ÁUDIO PROCEDURAL (Sem arquivos externos) ---
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    play(type) {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(10, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(); osc.stop(now + 0.1);
        } else if (type === 'success') {
            osc.type = 'triangle';
            [523.25, 659.25, 783.99].forEach((f, i) => {
                const o = this.ctx.createOscillator();
                o.connect(gain);
                o.frequency.setValueAtTime(f, now + i * 0.1);
                gain.gain.setValueAtTime(0.1, now + i * 0.1);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.2);
                o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
            });
        } else if (type === 'move') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(300, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start(); osc.stop(now + 0.05);
        }
    }
};

// --- COMPONENTE DO MASCOTE (SVG Dinâmico) ---
const Mascot = {
    render(state = 'idle') {
        const isExcited = state === 'excited' ? 'mascot-excited' : '';
        return `
            <div class="mascot-wrapper ${isExcited}">
                <svg class="mascot-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="70" r="25" fill="#2d3436"/>
                    <g class="panther-head">
                        <path d="M25,40 Q25,20 50,20 Q75,20 75,40 Q75,65 50,65 Q25,65 25,40" fill="#2d3436"/>
                        <path class="panther-ear" d="M28,25 L15,10 L35,22 Z" fill="#2d3436"/>
                        <path class="panther-ear" d="M72,25 L85,10 L65,22 Z" fill="#2d3436"/>
                        <g class="panther-eyes">
                            <circle class="panther-eye" cx="40" cy="42" r="6" fill="white"/>
                            <circle cx="40" cy="42" r="3" fill="black"/>
                            <circle class="panther-eye" cx="60" cy="42" r="6" fill="white"/>
                            <circle cx="60" cy="42" r="3" fill="black"/>
                        </g>
                        <circle cx="50" cy="52" r="4" fill="#1a1a1a"/>
                        <path d="M48,55 Q50,58 52,55" fill="none" stroke="white" stroke-width="1"/>
                    </g>
                </svg>
            </div>
        `;
    }
};

// --- CONFIGURAÇÃO DE JOGO ---
const PIECES = { E: 0, W: 1, B: 2, WK: 3, BK: 4 };
const INITIAL_BOARD = [
    [0, 2, 0, 2, 0, 2, 0, 2], [2, 0, 2, 0, 2, 0, 2, 0], [0, 2, 0, 2, 0, 2, 0, 2],
    [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0], [0, 1, 0, 1, 0, 1, 0, 1], [1, 0, 1, 0, 1, 0, 1, 0]
];

let appState = {
    screen: 'learn',
    user: { xp: 0, streak: 1, completed: [] },
    game: { board: [], turn: PIECES.W, selected: null, hints: [] }
};

// --- LOGICA DAS TELAS ---
const Screens = {
    learn: () => {
        const lessons = [
            { id: 1, t: 'Fundamentos', i: '🚀' },
            { id: 2, t: 'Captura', i: '⚔️' },
            { id: 3, t: 'A Dama', i: '👑' },
            { id: 4, t: 'Estratégia', i: '🧠' },
            { id: 5, t: 'Finais', i: '🏆' }
        ];

        const html = `
            <div class="learning-path">
                ${lessons.map(l => `
                    <div class="path-node">
                        <div class="node-circle ${appState.user.completed.includes(l.id) ? 'completed' : (l.id === appState.user.completed.length + 1 ? 'available' : 'locked')}" 
                             onclick="startLesson(${l.id})">
                            ${l.id <= appState.user.completed.length ? '✓' : l.i}
                        </div>
                        <div class="node-label">${l.t}</div>
                    </div>
                `).join('')}
            </div>
        `;
        renderScreen(html);
    },
    play: () => {
        const html = `
            <div style="padding:20px; text-align:center;">
                <h2 style="margin-bottom:20px;">DESAFIO DA PANTERA</h2>
                <div class="board-container">
                    <div id="main-board" class="board"></div>
                </div>
                <div style="margin-top:30px;">
                    <button class="btn-primary" onclick="initGame()">REINICIAR PARTIDA</button>
                </div>
            </div>
        `;
        renderScreen(html);
        initGame();
    },
    profile: () => {
        const html = `
            <div style="padding:40px; text-align:center;">
                ${Mascot.render('excited')}
                <h2 style="margin:20px 0;">MESTRE DAS DAMAS</h2>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <div class="stat-pill xp">✨ ${appState.user.xp} XP</div>
                    <div class="stat-pill streak">🔥 ${appState.user.streak} DIAS</div>
                </div>
                <button class="btn-primary" style="margin-top:40px; background:#e74c3c; box-shadow:0 6px 0 #c0392b;" onclick="resetApp()">RESETAR PROGRESSO</button>
            </div>
        `;
        renderScreen(html);
    }
};

// --- MOTOR DE JOGO ---
function initGame() {
    appState.game.board = INITIAL_BOARD.map(r => [...r]);
    appState.game.turn = PIECES.W;
    drawBoard();
}

function drawBoard() {
    const b = document.getElementById('main-board');
    if (!b) return;
    b.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = `sq ${(r + c) % 2 === 0 ? 'l' : 'd'}`;
            if (appState.game.selected && appState.game.selected[0] === r && appState.game.selected[1] === c) sq.classList.add('selected');
            
            const pType = appState.game.board[r][c];
            if (pType !== PIECES.E) {
                const p = document.createElement('div');
                const isWhite = pType === PIECES.W || pType === PIECES.WK;
                const isKing = pType === PIECES.WK || pType === PIECES.BK;
                p.className = `piece ${isWhite ? 'white' : 'black'} ${isKing ? 'king' : ''}`;
                sq.appendChild(p);
            }

            if (appState.game.hints.some(h => h[0] === r && h[1] === c)) {
                const dot = document.createElement('div');
                dot.className = 'hint-dot';
                sq.appendChild(dot);
            }

            sq.onclick = () => handleSqClick(r, c);
            b.appendChild(sq);
        }
    }
}

function handleSqClick(r, c) {
    AudioEngine.play('click');
    const piece = appState.game.board[r][c];
    
    // Se clicar numa peça própria
    if ((appState.game.turn === PIECES.W && (piece === PIECES.W || piece === PIECES.WK))) {
        appState.game.selected = [r, c];
        appState.game.hints = getValidMoves(r, c);
    } else if (appState.game.selected) {
        // Tentar mover
        if (appState.game.hints.some(h => h[0] === r && h[1] === c)) {
            executeMove(appState.game.selected, [r, c]);
        } else {
            appState.game.selected = null;
            appState.game.hints = [];
        }
    }
    drawBoard();
}

function executeMove(from, to) {
    const board = appState.game.board;
    let piece = board[from[0]][from[1]];
    
    // Captura
    if (Math.abs(from[0] - to[0]) === 2) {
        const midR = (from[0] + to[0]) / 2;
        const midC = (from[1] + to[1]) / 2;
        board[midR][midC] = PIECES.E;
        AudioEngine.play('success');
    } else {
        AudioEngine.play('move');
    }

    // Promoção
    if (piece === PIECES.W && to[0] === 0) piece = PIECES.WK;
    
    board[to[0]][to[1]] = piece;
    board[from[0]][from[1]] = PIECES.E;
    
    appState.game.selected = null;
    appState.game.hints = [];
    appState.game.turn = PIECES.B;
    
    setTimeout(aiMove, 600);
}

function aiMove() {
    // IA Simples para o demo
    const board = appState.game.board;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === PIECES.B) {
                const targets = [[r+1, c+1], [r+1, c-1]];
                for (let t of targets) {
                    if (t[0] < 8 && t[1] >= 0 && t[1] < 8 && board[t[0]][t[1]] === PIECES.E) {
                        board[t[0]][t[1]] = PIECES.B;
                        board[r][c] = PIECES.E;
                        appState.game.turn = PIECES.W;
                        AudioEngine.play('move');
                        drawBoard();
                        return;
                    }
                }
            }
        }
    }
}

function getValidMoves(r, c) {
    // Lógica simplificada de movimento para o demo
    const moves = [];
    const dirs = [[-1, -1], [-1, 1]];
    dirs.forEach(d => {
        const nr = r + d[0], nc = c + d[1];
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (appState.game.board[nr][nc] === PIECES.E) moves.push([nr, nc]);
            // Captura
            else if (appState.game.board[nr][nc] === PIECES.B) {
                const rr = nr + d[0], cc = nc + d[1];
                if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && appState.game.board[rr][cc] === PIECES.E) moves.push([rr, cc]);
            }
        }
    });
    return moves;
}

// --- UTILITÁRIOS ---
function renderScreen(html) {
    const container = document.getElementById('screen-container');
    container.style.opacity = 0;
    setTimeout(() => {
        container.innerHTML = html;
        container.style.opacity = 1;
    }, 150);
}

function startLesson(id) {
    if (id > appState.user.completed.length + 1) return;
    AudioEngine.play('success');
    const overlay = document.getElementById('feedback-overlay');
    document.getElementById('mascot-container-feedback').innerHTML = Mascot.render('excited');
    document.getElementById('xp-gain-val').innerText = id * 15;
    overlay.classList.remove('hidden');
    
    document.getElementById('feedback-btn').onclick = () => {
        if (!appState.user.completed.includes(id)) appState.user.completed.push(id);
        appState.user.xp += id * 15;
        saveData();
        overlay.classList.add('hidden');
        updateHeader();
        Screens.learn();
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    };
}

function updateHeader() {
    document.getElementById('xp-val').innerText = appState.user.xp;
    document.getElementById('streak-val').innerText = appState.user.streak;
}

function saveData() { localStorage.setItem('dama_v2', JSON.stringify(appState.user)); }
function loadData() {
    const d = localStorage.getItem('dama_v2');
    if (d) { appState.user = JSON.parse(d); updateHeader(); }
}

function resetApp() {
    localStorage.clear();
    location.reload();
}

// --- INIT ---
document.querySelectorAll('.nav-item').forEach(nav => {
    nav.onclick = () => {
        AudioEngine.play('click');
        document.querySelector('.nav-item.active').classList.remove('active');
        nav.classList.add('active');
        Screens[nav.dataset.screen]();
    };
});

document.getElementById('toggle-theme').onclick = () => {
    document.body.classList.toggle('theme-dark');
};

window.onload = () => {
    loadData();
    Screens.learn();
};
