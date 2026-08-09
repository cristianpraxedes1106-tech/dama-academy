/* ============================================================
   DAMA — Plataforma completa de Damas Brasileiras
   ============================================================ */

'use strict';

// ---------------------------------------------------------------
// CONSTANTS & RULES (Brazilian Draughts)
// ---------------------------------------------------------------
const BOARD_SIZE = 8;
const WHITE = 1;
const BLACK = 2;
const KING_FLAG = 4;
const WHITE_KING = WHITE | KING_FLAG;
const BLACK_KING = BLACK | KING_FLAG;

const LEVELS = [
  { name: 'Peça Nova', xp: 0 },
  { name: 'Aprendiz', xp: 50 },
  { name: 'Jogador', xp: 150 },
  { name: 'Estrategista', xp: 350 },
  { name: 'Tático', xp: 650 },
  { name: 'Mestre', xp: 1100 },
  { name: 'Lenda', xp: 1800 }
];

const DIFFICULTIES = [
  { id: 'filhote', name: 'Filhote', depth: 1, desc: 'Muito fácil', stars: '★' },
  { id: 'aprendiz', name: 'Aprendiz', depth: 2, desc: 'Fácil', stars: '★★' },
  { id: 'estrategista', name: 'Estrategista', depth: 3, desc: 'Intermediário', stars: '★★★' },
  { id: 'pantera', name: 'Pantera', depth: 4, desc: 'Difícil', stars: '★★★★' }
];

// ---------------------------------------------------------------
// APP STATE
// ---------------------------------------------------------------
const defaultState = () => ({
  xp: 0,
  level: 1,
  streak: 0,
  lastPlayDate: null,
  lessonsCompleted: [],
  unitsUnlocked: [1],
  achievements: [],
  settings: { sound: true, darkMode: false, animations: true },
  stats: { games: 0, wins: 0, losses: 0, draws: 0, captures: 0, maxCombo: 0, promotions: 0 },
  dailyDone: null,
  onboarded: false
});

let appState = loadState();
let currentView = 'home';
let audioCtx = null;

function loadState() {
  try {
    const raw = localStorage.getItem('dama_state_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...parsed.settings }, stats: { ...defaultState().stats, ...parsed.stats } };
    }
  } catch (e) {}
  return defaultState();
}

function saveState() {
  try { localStorage.setItem('dama_state_v1', JSON.stringify(appState)); } catch (e) {}
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (appState.lastPlayDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (appState.lastPlayDate === yesterday) {
    appState.streak += 1;
  } else if (appState.lastPlayDate !== today) {
    appState.streak = 1;
  }
  appState.lastPlayDate = today;
  saveState();
  checkAchievement('streak7');
}

// ---------------------------------------------------------------
// SOUND (Web Audio API)
// ---------------------------------------------------------------
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, dur, type = 'sine', vol = 0.12) {
  if (!appState.settings.sound) return;
  try {
    const ctx = getAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) {}
}

const SFX = {
  click: () => playTone(420, 0.06, 'square', 0.06),
  move: () => playTone(280, 0.08, 'triangle', 0.08),
  capture: () => { playTone(180, 0.1, 'sawtooth', 0.1); setTimeout(() => playTone(120, 0.12, 'sawtooth', 0.08), 60); },
  combo: () => { playTone(440, 0.08); setTimeout(() => playTone(554, 0.08), 80); setTimeout(() => playTone(659, 0.12), 160); },
  promote: () => { playTone(523, 0.1); setTimeout(() => playTone(659, 0.1), 100); setTimeout(() => playTone(784, 0.15), 200); },
  success: () => { playTone(523, 0.1); setTimeout(() => playTone(659, 0.15), 100); },
  error: () => playTone(160, 0.2, 'sawtooth', 0.08),
  xp: () => playTone(880, 0.12, 'sine', 0.07),
  win: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.15), i * 120)); },
  lose: () => playTone(200, 0.3, 'triangle', 0.1),
  achieve: () => { playTone(659, 0.1); setTimeout(() => playTone(880, 0.2), 120); }
};

// ---------------------------------------------------------------
// MASCOT SVG
// ---------------------------------------------------------------
function createMascotSVG(state = 'idle') {
  const expressions = {
    idle: { eyeY: 0, brow: -2, mouth: 'M14 28 Q20 32 26 28', tail: true },
    happy: { eyeY: -1, brow: -4, mouth: 'M13 27 Q20 34 27 27', tail: true },
    excited: { eyeY: -2, brow: -5, mouth: 'M12 26 Q20 35 28 26', tail: true },
    thinking: { eyeY: 1, brow: 0, mouth: 'M15 29 Q20 30 25 29', tail: false },
    confused: { eyeY: 0, brow: 2, mouth: 'M14 30 Q20 28 26 30', tail: false },
    sad: { eyeY: 2, brow: 3, mouth: 'M14 31 Q20 27 26 31', tail: false },
    proud: { eyeY: -1, brow: -3, mouth: 'M13 28 Q20 33 27 28', tail: true },
    winning: { eyeY: -2, brow: -5, mouth: 'M12 26 Q20 36 28 26', tail: true },
    sleeping: { eyeY: 0, brow: 0, mouth: 'M15 29 Q20 30 25 29', closed: true }
  };
  const e = expressions[state] || expressions.idle;
  const eyeL = e.closed
    ? `<path d="M12 18 H18" stroke="#1A1210" stroke-width="1.8" stroke-linecap="round"/>`
    : `<circle cx="15" cy="${18 + e.eyeY}" r="2.2" fill="#1A1210"/><circle cx="15.7" cy="${17.3 + e.eyeY}" r="0.7" fill="#fff"/>`;
  const eyeR = e.closed
    ? `<path d="M22 18 H28" stroke="#1A1210" stroke-width="1.8" stroke-linecap="round"/>`
    : `<circle cx="25" cy="${18 + e.eyeY}" r="2.2" fill="#1A1210"/><circle cx="25.7" cy="${17.3 + e.eyeY}" r="0.7" fill="#fff"/>`;

  return `
  <svg class="mascot-svg ${state}" viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pantherBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3D2A32"/>
        <stop offset="100%" stop-color="#1A1210"/>
      </linearGradient>
      <linearGradient id="pantherBelly" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#5C3D4A"/>
        <stop offset="100%" stop-color="#3D2A32"/>
      </linearGradient>
    </defs>
    <!-- Tail -->
    <path class="tail" d="M32 28 Q38 22 36 14 Q34 10 32 12" fill="none" stroke="#2A1A20" stroke-width="3.5" stroke-linecap="round"/>
    <!-- Body -->
    <ellipse cx="20" cy="34" rx="11" ry="9" fill="url(#pantherBody)"/>
    <ellipse cx="20" cy="35" rx="7" ry="5.5" fill="url(#pantherBelly)"/>
    <!-- Legs -->
    <ellipse cx="13" cy="41" rx="3.5" ry="4" fill="#1A1210"/>
    <ellipse cx="27" cy="41" rx="3.5" ry="4" fill="#1A1210"/>
    <!-- Head -->
    <g class="head">
      <ellipse cx="20" cy="18" rx="12" ry="11" fill="url(#pantherBody)"/>
      <!-- Ears -->
      <path d="M9 10 L11 2 L16 9 Z" fill="#1A1210"/>
      <path d="M10.5 9 L12 4.5 L14.5 9 Z" fill="#6B3D4A"/>
      <path d="M31 10 L29 2 L24 9 Z" fill="#1A1210"/>
      <path d="M29.5 9 L28 4.5 L25.5 9 Z" fill="#6B3D4A"/>
      <!-- Inner face -->
      <ellipse cx="20" cy="20" rx="8" ry="7" fill="#2A1A22"/>
      <!-- Eyes -->
      ${eyeL}${eyeR}
      <!-- Brows -->
      <path d="M11 ${14 + e.brow} Q15 ${12 + e.brow} 18 ${14 + e.brow}" fill="none" stroke="#1A1210" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M22 ${14 + e.brow} Q25 ${12 + e.brow} 29 ${14 + e.brow}" fill="none" stroke="#1A1210" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Nose -->
      <ellipse cx="20" cy="23" rx="2.2" ry="1.6" fill="#0D080A"/>
      <!-- Mouth -->
      <path d="${e.mouth}" fill="none" stroke="#0D080A" stroke-width="1.3" stroke-linecap="round"/>
      <!-- Whiskers -->
      <path d="M8 22 H13 M8 24 H13" stroke="#4A3540" stroke-width="0.8"/>
      <path d="M27 22 H32 M27 24 H32" stroke="#4A3540" stroke-width="0.8"/>
    </g>
  </svg>`;
}

function setMascot(el, state) {
  if (!el) return;
  el.innerHTML = createMascotSVG(state);
}

// ---------------------------------------------------------------
// GAME ENGINE — Brazilian Draughts
// ---------------------------------------------------------------
function emptyBoard() {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
}

function initialBoard() {
  const b = emptyBoard();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) b[r][c] = BLACK;
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) b[r][c] = WHITE;
    }
  }
  return b;
}

function isDark(r, c) { return (r + c) % 2 === 1; }
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function isWhite(p) { return (p & 3) === WHITE; }
function isBlack(p) { return (p & 3) === BLACK; }
function isKing(p) { return (p & KING_FLAG) !== 0; }
function color(p) { return p & 3; }
function opponent(side) { return side === WHITE ? BLACK : WHITE; }

function cloneBoard(b) {
  return b.map(row => row.slice());
}

function pieceAt(b, r, c) {
  if (!inBounds(r, c)) return 0;
  return b[r][c];
}

/**
 * Generate all legal moves for a side.
 * Returns array of: { from:[r,c], to:[r,c], captures:[[r,c],...], path:[[r,c],...] }
 * Respects mandatory max-capture rule.
 */
function generateMoves(board, side) {
  const allCaptures = [];
  const quietMoves = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || color(p) !== side) continue;
      const caps = getCapturesFrom(board, r, c, p);
      if (caps.length) allCaptures.push(...caps);
      else if (allCaptures.length === 0) {
        quietMoves.push(...getQuietMoves(board, r, c, p));
      }
    }
  }

  if (allCaptures.length === 0) return quietMoves;

  // Lei da Maioria: only max capture sequences
  let maxCap = 0;
  for (const m of allCaptures) maxCap = Math.max(maxCap, m.captures.length);
  return allCaptures.filter(m => m.captures.length === maxCap);
}

function getQuietMoves(board, r, c, p) {
  const moves = [];
  const dirs = isKing(p)
    ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : (isWhite(p) ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);

  if (isKing(p)) {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc) && board[nr][nc] === 0) {
        if (isDark(nr, nc)) moves.push({ from: [r, c], to: [nr, nc], captures: [], path: [[nr, nc]] });
        nr += dr; nc += dc;
      }
    }
  } else {
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc] === 0 && isDark(nr, nc)) {
        moves.push({ from: [r, c], to: [nr, nc], captures: [], path: [[nr, nc]] });
      }
    }
  }
  return moves;
}

function getCapturesFrom(board, r, c, p, captured = [], path = []) {
  const results = [];
  const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  let found = false;

  if (isKing(p)) {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      // slide until piece or edge
      while (inBounds(nr, nc) && board[nr][nc] === 0) { nr += dr; nc += dc; }
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || color(target) === color(p)) continue;
      // already captured this piece in chain?
      if (captured.some(([cr, cc]) => cr === nr && cc === nc)) continue;
      // land squares beyond
      let lr = nr + dr, lc = nc + dc;
      while (inBounds(lr, lc) && board[lr][lc] === 0) {
        if (isDark(lr, lc)) {
          found = true;
          const newCap = [...captured, [nr, nc]];
          const newPath = [...path, [lr, lc]];
          // temporary board for recursion
          const tmp = cloneBoard(board);
          tmp[r][c] = 0;
          tmp[nr][nc] = 0;
          tmp[lr][lc] = p;
          const cont = getCapturesFrom(tmp, lr, lc, p, newCap, newPath);
          if (cont.length === 0) {
            results.push({ from: path.length ? path[0] ? undefined : [r,c] : [r,c], to: [lr, lc], captures: newCap, path: newPath, start: [r, c] });
          } else {
            results.push(...cont.map(m => ({
              from: [r, c],
              to: m.to,
              captures: m.captures,
              path: m.path,
              start: [r, c]
            })));
          }
        }
        lr += dr; lc += dc;
      }
    }
  } else {
    // Men: jump adjacent
    for (const [dr, dc] of dirs) {
      const jr = r + dr, jc = c + dc;
      const lr = r + 2 * dr, lc = c + 2 * dc;
      if (!inBounds(lr, lc) || !isDark(lr, lc)) continue;
      const target = pieceAt(board, jr, jc);
      if (!target || color(target) === color(p)) continue;
      if (board[lr][lc] !== 0) continue;
      if (captured.some(([cr, cc]) => cr === jr && cc === jc)) continue;

      found = true;
      const newCap = [...captured, [jr, jc]];
      const newPath = [...path, [lr, lc]];
      const tmp = cloneBoard(board);
      tmp[r][c] = 0;
      tmp[jr][jc] = 0;
      tmp[lr][lc] = p;
      const cont = getCapturesFrom(tmp, lr, lc, p, newCap, newPath);
      if (cont.length === 0) {
        results.push({ from: [r, c], to: [lr, lc], captures: newCap, path: newPath, start: [r, c] });
      } else {
        for (const m of cont) {
          results.push({ from: [r, c], to: m.to, captures: m.captures, path: m.path, start: [r, c] });
        }
      }
    }
  }

  if (!found && captured.length > 0) {
    // end of chain — fix from
    return [{ from: null, to: [r, c], captures: captured, path, start: null }];
  }
  // normalize from
  return results.map(m => {
    if (!m.from || !m.from[0] === undefined) {
      // find original start from path logic — use first known
    }
    return {
      from: m.start || m.from || [r, c],
      to: m.to,
      captures: m.captures,
      path: m.path
    };
  });
}

// Fix capture generation with a cleaner recursive approach
function getAllCaptures(board, side) {
  const results = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || color(p) !== side) continue;
      searchCaptures(board, r, c, p, [], [], r, c, results);
    }
  }
  if (results.length === 0) return [];
  let maxC = Math.max(...results.map(m => m.captures.length));
  return results.filter(m => m.captures.length === maxC);
}

function searchCaptures(board, r, c, p, captured, path, startR, startC, results) {
  let found = false;
  const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];

  if (isKing(p)) {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc) && board[nr][nc] === 0) { nr += dr; nc += dc; }
      if (!inBounds(nr, nc)) continue;
      const tgt = board[nr][nc];
      if (!tgt || color(tgt) === color(p)) continue;
      if (captured.some(([x,y]) => x === nr && y === nc)) continue;
      let lr = nr + dr, lc = nc + dc;
      while (inBounds(lr, lc) && board[lr][lc] === 0) {
        if (isDark(lr, lc)) {
          found = true;
          const nb = cloneBoard(board);
          nb[r][c] = 0;
          nb[nr][nc] = 0;
          nb[lr][lc] = p;
          const nCap = [...captured, [nr, nc]];
          const nPath = [...path, [lr, lc]];
          searchCaptures(nb, lr, lc, p, nCap, nPath, startR, startC, results);
        }
        lr += dr; lc += dc;
      }
    }
  } else {
    for (const [dr, dc] of dirs) {
      const jr = r + dr, jc = c + dc;
      const lr = r + 2*dr, lc = c + 2*dc;
      if (!inBounds(lr, lc) || board[lr][lc] !== 0 || !isDark(lr, lc)) continue;
      const tgt = pieceAt(board, jr, jc);
      if (!tgt || color(tgt) === color(p)) continue;
      if (captured.some(([x,y]) => x === jr && y === jc)) continue;
      found = true;
      const nb = cloneBoard(board);
      nb[r][c] = 0;
      nb[jr][jc] = 0;
      nb[lr][lc] = p;
      const nCap = [...captured, [jr, jc]];
      const nPath = [...path, [lr, lc]];
      searchCaptures(nb, lr, lc, p, nCap, nPath, startR, startC, results);
    }
  }

  if (!found && captured.length > 0) {
    results.push({
      from: [startR, startC],
      to: [r, c],
      captures: captured,
      path
    });
  }
}

function generateMovesFixed(board, side) {
  const caps = getAllCaptures(board, side);
  if (caps.length) return caps;
  const quiet = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || color(p) !== side) continue;
      quiet.push(...getQuietMoves(board, r, c, p));
    }
  }
  return quiet;
}

function applyMove(board, move) {
  const b = cloneBoard(board);
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  let piece = b[fr][fc];
  b[fr][fc] = 0;
  for (const [cr, cc] of move.captures) b[cr][cc] = 0;
  // promotion: only if ends on last row
  if (!isKing(piece)) {
    if (isWhite(piece) && tr === 0) piece = WHITE_KING;
    if (isBlack(piece) && tr === 7) piece = BLACK_KING;
  }
  b[tr][tc] = piece;
  return b;
}

function evaluate(board, side) {
  let score = 0;
  const opp = opponent(side);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = isKing(p) ? 45 : 10;
      const posBonus = isKing(p) ? 0 : (isWhite(p) ? (7 - r) : r) * 0.5;
      const center = (r >= 2 && r <= 5 && c >= 2 && c <= 5) ? 1.5 : 0;
      if (color(p) === side) score += val + posBonus + center;
      else score -= val + posBonus + center;
    }
  }
  // mobility
  const myMoves = generateMovesFixed(board, side).length;
  const oppMoves = generateMovesFixed(board, opp).length;
  score += (myMoves - oppMoves) * 0.8;
  return score;
}

function minimax(board, depth, alpha, beta, maximizing, side, rootSide) {
  if (depth === 0) return { score: evaluate(board, rootSide), move: null };

  const moves = generateMovesFixed(board, side);
  if (moves.length === 0) {
    return { score: maximizing ? -10000 : 10000, move: null };
  }

  let bestMove = moves[0];
  if (maximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const nb = applyMove(board, m);
      const { score } = minimax(nb, depth - 1, alpha, beta, false, opponent(side), rootSide);
      if (score > maxEval) { maxEval = score; bestMove = m; }
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      const nb = applyMove(board, m);
      const { score } = minimax(nb, depth - 1, alpha, beta, true, opponent(side), rootSide);
      if (score < minEval) { minEval = score; bestMove = m; }
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return { score: minEval, move: bestMove };
  }
}

function cpuMove(board, side, depth) {
  const { move } = minimax(board, depth, -Infinity, Infinity, true, side, side);
  return move;
}

function hasAnyMoves(board, side) {
  return generateMovesFixed(board, side).length > 0;
}

function countPieces(board, side) {
  let n = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] && color(board[r][c]) === side) n++;
  return n;
}

// ---------------------------------------------------------------
// BOARD UI
// ---------------------------------------------------------------
function renderBoardHTML(board, options = {}) {
  const {
    selectable = false,
    selected = null,
    validMoves = [],
    onSquareClick = null,
    flip = false
  } = options;

  let html = '<div class="board" role="grid" aria-label="Tabuleiro de damas">';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const displayR = flip ? 7 - r : r;
      const displayC = flip ? 7 - c : c;
      const isDarkSq = isDark(displayR, displayC);
      const p = board[displayR][displayC];
      let cls = 'square ' + (isDarkSq ? 'dark' : 'light');
      if (selected && selected[0] === displayR && selected[1] === displayC) cls += ' selected';
      const isValid = validMoves.some(m => m.to[0] === displayR && m.to[1] === displayC);
      const isCap = validMoves.some(m => m.to[0] === displayR && m.to[1] === displayC && m.captures.length);
      if (isValid) cls += isCap ? ' valid-capture' : ' valid-move';

      let pieceHTML = '';
      if (p) {
        const colorCls = isWhite(p) ? 'white' : 'black';
        const kingCls = isKing(p) ? ' king' : '';
        pieceHTML = `<div class="piece ${colorCls}${kingCls}" data-r="${displayR}" data-c="${displayC}"></div>`;
      }
      html += `<div class="${cls}" data-r="${displayR}" data-c="${displayC}" role="gridcell">${pieceHTML}</div>`;
    }
  }
  html += '</div>';
  return html;
}

function attachBoardHandlers(container, board, side, onMove, extra = {}) {
  let selected = null;
  let moves = generateMovesFixed(board, side);

  function refresh() {
    const validForSelected = selected
      ? moves.filter(m => m.from[0] === selected[0] && m.from[1] === selected[1])
      : [];
    container.innerHTML = renderBoardHTML(board, {
      selected,
      validMoves: validForSelected,
      flip: extra.flip
    });
    container.querySelectorAll('.square').forEach(sq => {
      sq.addEventListener('click', () => {
        const r = +sq.dataset.r, c = +sq.dataset.c;
        const p = board[r][c];
        if (selected && selected[0] === r && selected[1] === c) {
          selected = null;
          refresh();
          return;
        }
        if (p && color(p) === side) {
          const pieceMoves = moves.filter(m => m.from[0] === r && m.from[1] === c);
          if (pieceMoves.length) {
            selected = [r, c];
            SFX.click();
            refresh();
          }
          return;
        }
        if (selected) {
          const move = moves.find(m =>
            m.from[0] === selected[0] && m.from[1] === selected[1] &&
            m.to[0] === r && m.to[1] === c
          );
          if (move) {
            SFX.move();
            if (move.captures.length) {
              if (move.captures.length > 1) SFX.combo();
              else SFX.capture();
            }
            onMove(move);
            selected = null;
          }
        }
      });
    });
  }
  refresh();
  return { refresh, getMoves: () => moves };
}

// ---------------------------------------------------------------
// XP / LEVEL / ACHIEVEMENTS
// ---------------------------------------------------------------
function addXP(amount, reason = '') {
  if (amount <= 0) return;
  appState.xp += amount;
  // level up
  let newLevel = 1;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (appState.xp >= LEVELS[i].xp) { newLevel = i + 1; break; }
  }
  const leveled = newLevel > appState.level;
  appState.level = newLevel;
  saveState();
  updateXPUI();
  showXPFloat(amount);
  SFX.xp();
  toast(`+${amount} XP${reason ? ' · ' + reason : ''}`, 'xp');
  if (leveled) {
    toast(`Nível ${appState.level} — ${LEVELS[appState.level - 1].name}!`, 'success');
    setTimeout(() => SFX.achieve(), 200);
  }
  checkAchievement('xp500');
}

function showXPFloat(amount) {
  const el = document.createElement('div');
  el.className = 'xp-float';
  el.textContent = `+${amount} XP`;
  el.style.left = (window.innerWidth / 2 - 30) + 'px';
  el.style.top = '80px';
  document.getElementById('fx-layer').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function updateXPUI() {
  const levelIdx = appState.level - 1;
  const cur = LEVELS[levelIdx].xp;
  const next = LEVELS[levelIdx + 1] ? LEVELS[levelIdx + 1].xp : cur + 500;
  const pct = Math.min(100, ((appState.xp - cur) / (next - cur)) * 100);
  const bar = document.getElementById('xp-bar');
  const text = document.getElementById('xp-text');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = `${appState.xp} XP`;
  const streak = document.getElementById('streak-count');
  if (streak) streak.textContent = appState.streak;
}

const ACHIEVEMENTS = [
  { id: 'first_win', name: 'Primeira Vitória', desc: 'Vença sua primeira partida', icon: '🏆' },
  { id: 'first_king', name: 'Primeira Dama', desc: 'Promova uma peça a Dama', icon: '♛' },
  { id: 'first_multi', name: 'Combo Inicial', desc: 'Faça uma captura múltipla', icon: '⚡' },
  { id: 'captures10', name: '10 Capturas', desc: 'Capture 10 peças no total', icon: '🎯' },
  { id: 'captures50', name: '50 Capturas', desc: 'Capture 50 peças no total', icon: '🔥' },
  { id: 'streak7', name: '7 Dias', desc: 'Mantenha um streak de 7 dias', icon: '📅' },
  { id: 'beat_pantera', name: 'Domine a Pantera', desc: 'Vença no nível Pantera', icon: '🐆' },
  { id: 'master', name: 'Mestre das Damas', desc: 'Complete todas as unidades', icon: '👑' },
  { id: 'xp500', name: 'Meio Milhar', desc: 'Alcance 500 XP', icon: '⭐' },
  { id: 'first_lesson', name: 'Primeiro Passo', desc: 'Complete sua primeira lição', icon: '📚' }
];

function unlockAchievement(id) {
  if (appState.achievements.includes(id)) return;
  appState.achievements.push(id);
  saveState();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) {
    SFX.achieve();
    toast(`Conquista: ${a.name}!`, 'success');
  }
}

function checkAchievement(id) {
  if (id === 'streak7' && appState.streak >= 7) unlockAchievement('streak7');
  if (id === 'xp500' && appState.xp >= 500) unlockAchievement('xp500');
  if (id === 'captures10' && appState.stats.captures >= 10) unlockAchievement('captures10');
  if (id === 'captures50' && appState.stats.captures >= 50) unlockAchievement('captures50');
  if (id === 'master') {
    const totalLessons = LESSONS.length;
    if (appState.lessonsCompleted.length >= totalLessons) unlockAchievement('master');
  }
}

// ---------------------------------------------------------------
// LESSONS DATA
// ---------------------------------------------------------------
const LESSONS = [
  // Unit 1
  { id: 'u1l1', unit: 1, title: 'O que é Damas?', xp: 10, type: 'info',
    steps: [
      { text: 'Damas Brasileiras é um jogo de estratégia para dois jogadores.', board: null },
      { text: 'O objetivo é capturar todas as peças do adversário ou deixá-lo sem movimentos.', board: null },
      { text: 'Joga-se em um tabuleiro 8×8, apenas nas casas escuras.', board: 'start' }
    ]},
  { id: 'u1l2', unit: 1, title: 'O Tabuleiro', xp: 10, type: 'info',
    steps: [
      { text: 'Cada jogador começa com 12 peças nas três primeiras fileiras.', board: 'start' },
      { text: 'As peças brancas (claras) jogam primeiro.', board: 'start' },
      { text: 'Só se usa as casas escuras. As claras nunca são ocupadas.', board: 'start' }
    ]},
  { id: 'u1l3', unit: 1, title: 'As Peças', xp: 10, type: 'info',
    steps: [
      { text: 'Peças simples movem-se uma casa na diagonal, apenas para frente.', board: 'start' },
      { text: 'Quando chegam à última fileira, viram Dama (peça especial).', board: null },
      { text: 'A Dama se move qualquer número de casas na diagonal.', board: null }
    ]},
  // Unit 2
  { id: 'u2l1', unit: 2, title: 'Movimento Básico', xp: 15, type: 'interactive',
    steps: [
      { text: 'Peças brancas movem para frente (para cima no tabuleiro).', board: 'move1' },
      { text: 'Selecione a peça destacada e mova-a uma casa para frente.', board: 'move1', goal: 'move', from: [5,2], to: [4,1] },
      { text: 'Muito bem! Movimentos simples são assim.', board: null }
    ]},
  { id: 'u2l2', unit: 2, title: 'Casas Válidas', xp: 10, type: 'interactive',
    steps: [
      { text: 'Uma peça só pode ir para uma casa escura vazia na diagonal.', board: 'move2' },
      { text: 'Mova a peça branca para a casa válida indicada.', board: 'move2', goal: 'move', from: [5,4], to: [4,3] }
    ]},
  { id: 'u2l3', unit: 2, title: 'Limitações', xp: 10, type: 'info',
    steps: [
      { text: 'Peças simples NÃO se movem para trás (exceto ao capturar).', board: null },
      { text: 'Não podem pular peças amigas.', board: null },
      { text: 'Não podem ocupar casas claras.', board: null }
    ]},
  // Unit 3
  { id: 'u3l1', unit: 3, title: 'Como Capturar', xp: 15, type: 'interactive',
    steps: [
      { text: 'Para capturar, pule sobre uma peça adversária adjacente até a casa vazia logo após.', board: 'cap1' },
      { text: 'Capture a peça preta! Selecione a branca e pule sobre a preta.', board: 'cap1', goal: 'capture', from: [5,2], to: [3,4] },
      { text: 'Excelente captura!', board: null }
    ]},
  { id: 'u3l2', unit: 3, title: 'Captura Obrigatória', xp: 15, type: 'interactive',
    steps: [
      { text: 'Nas Damas Brasileiras, se você PODE capturar, DEVE capturar.', board: 'cap2' },
      { text: 'Há uma captura disponível. Faça-a!', board: 'cap2', goal: 'capture', from: [4,3], to: [2,1] }
    ]},
  { id: 'u3l3', unit: 3, title: 'Captura para Trás', xp: 15, type: 'interactive',
    steps: [
      { text: 'Peças simples podem capturar para frente E para trás.', board: 'cap3' },
      { text: 'Capture a peça que está atrás da sua!', board: 'cap3', goal: 'capture', from: [3,2], to: [5,4] }
    ]},
  // Unit 4
  { id: 'u4l1', unit: 4, title: 'Capturas Múltiplas', xp: 20, type: 'interactive',
    steps: [
      { text: 'Se após capturar houver outra captura possível, você continua no mesmo turno.', board: 'multi1' },
      { text: 'Faça a sequência de duas capturas!', board: 'multi1', goal: 'multicap', minCaps: 2 },
      { text: 'COMBO! Isso é uma captura múltipla.', board: null }
    ]},
  { id: 'u4l2', unit: 4, title: 'Lei da Maioria', xp: 15, type: 'info',
    steps: [
      { text: 'Quando há várias opções de captura, você DEVE escolher a que captura MAIS peças.', board: null },
      { text: 'Isso se chama Lei da Maioria e é obrigatória nas Damas Brasileiras.', board: null }
    ]},
  // Unit 5
  { id: 'u5l1', unit: 5, title: 'Promoção a Dama', xp: 15, type: 'interactive',
    steps: [
      { text: 'Ao chegar à última fileira do adversário, a peça vira Dama.', board: 'promo1' },
      { text: 'Mova a peça até a última fileira!', board: 'promo1', goal: 'promote', from: [1,2], to: [0,1] },
      { text: 'Você ganhou uma Dama!', board: null }
    ]},
  { id: 'u5l2', unit: 5, title: 'Movimento da Dama', xp: 15, type: 'info',
    steps: [
      { text: 'A Dama (voadora) move qualquer número de casas na diagonal.', board: null },
      { text: 'Ela captura à distância: salta sobre o adversário e pousa em qualquer casa vazia além.', board: null },
      { text: 'A Dama é a peça mais poderosa do jogo.', board: null }
    ]},
  // Unit 6-9 simplified but functional
  { id: 'u6l1', unit: 6, title: 'Controle do Centro', xp: 15, type: 'info',
    steps: [
      { text: 'Peças no centro controlam mais diagonais e têm mais mobilidade.', board: null },
      { text: 'Tente ocupar as casas centrais no início do jogo.', board: null }
    ]},
  { id: 'u6l2', unit: 6, title: 'Proteção', xp: 10, type: 'info',
    steps: [
      { text: 'Mantenha suas peças protegidas umas pelas outras.', board: null },
      { text: 'Evite deixar peças isoladas e vulneráveis a capturas.', board: null }
    ]},
  { id: 'u7l1', unit: 7, title: 'Armadilhas', xp: 15, type: 'info',
    steps: [
      { text: 'Às vezes você oferece uma peça para ganhar mais depois.', board: null },
      { text: 'Calcule sempre as sequências forçadas de captura.', board: null }
    ]},
  { id: 'u7l2', unit: 7, title: 'Combinações', xp: 15, type: 'interactive',
    steps: [
      { text: 'Encontre a combinação de captura!', board: 'combo1', goal: 'multicap', minCaps: 2 }
    ]},
  { id: 'u8l1', unit: 8, title: 'Finais Simples', xp: 15, type: 'info',
    steps: [
      { text: 'Com vantagem material, simplifique a posição.', board: null },
      { text: 'Promova peças e use a Dama para restringir o adversário.', board: null }
    ]},
  { id: 'u9l1', unit: 9, title: 'Revisão Final', xp: 20, type: 'info',
    steps: [
      { text: 'Você conhece as regras, capturas, damas e estratégia básica.', board: null },
      { text: 'Continue praticando contra a Pantera e nos treinos!', board: null },
      { text: 'Parabéns por chegar até aqui, futuro mestre!', board: null }
    ]}
];

const UNITS = [
  { id: 1, title: 'Conhecendo as Damas' },
  { id: 2, title: 'Movimentação' },
  { id: 3, title: 'Capturas' },
  { id: 4, title: 'Capturas Múltiplas' },
  { id: 5, title: 'Promoção e Dama' },
  { id: 6, title: 'Estratégia' },
  { id: 7, title: 'Táticas' },
  { id: 8, title: 'Finais' },
  { id: 9, title: 'Mestre das Damas' }
];

function getLessonBoard(key) {
  const b = emptyBoard();
  if (key === 'start') return initialBoard();
  if (key === 'move1') {
    b[5][2] = WHITE; b[2][1] = BLACK; b[2][3] = BLACK;
    return b;
  }
  if (key === 'move2') {
    b[5][4] = WHITE; b[3][2] = BLACK;
    return b;
  }
  if (key === 'cap1') {
    b[5][2] = WHITE; b[4][3] = BLACK; b[6][1] = WHITE;
    return b;
  }
  if (key === 'cap2') {
    b[4][3] = WHITE; b[3][2] = BLACK; b[6][5] = WHITE;
    return b;
  }
  if (key === 'cap3') {
    b[3][2] = WHITE; b[4][3] = BLACK; b[1][0] = BLACK;
    return b;
  }
  if (key === 'multi1') {
    b[5][0] = WHITE; b[4][1] = BLACK; b[2][3] = BLACK; b[6][5] = WHITE;
    return b;
  }
  if (key === 'promo1') {
    b[1][2] = WHITE; b[3][4] = BLACK;
    return b;
  }
  if (key === 'combo1') {
    b[5][2] = WHITE; b[4][3] = BLACK; b[2][5] = BLACK; b[6][1] = WHITE;
    return b;
  }
  return b;
}

// ---------------------------------------------------------------
// TRAINING POSITIONS
// ---------------------------------------------------------------
const CHALLENGES = [
  { id: 'c1', title: 'Encontre a Captura', desc: 'Há uma captura obrigatória. Faça-a!', xp: 10,
    setup: () => { const b = emptyBoard(); b[4][3]=WHITE; b[3][2]=BLACK; b[5][4]=WHITE; return b; },
    side: WHITE, goal: 'anycapture' },
  { id: 'c2', title: 'Sequência Dupla', desc: 'Capture as duas peças em um só turno.', xp: 15,
    setup: () => { const b = emptyBoard(); b[5][0]=WHITE; b[4][1]=BLACK; b[2][3]=BLACK; return b; },
    side: WHITE, goal: 'multicap', min: 2 },
  { id: 'c3', title: 'Promova!', desc: 'Leve a peça até a última fileira.', xp: 10,
    setup: () => { const b = emptyBoard(); b[1][4]=WHITE; b[3][2]=BLACK; return b; },
    side: WHITE, goal: 'promote' },
  { id: 'c4', title: 'Melhor Jogada', desc: 'Escolha a captura que rende mais.', xp: 15,
    setup: () => { const b = emptyBoard(); b[4][1]=WHITE; b[3][2]=BLACK; b[3][0]=BLACK; b[5][4]=WHITE; return b; },
    side: WHITE, goal: 'anycapture' },
  { id: 'c5', title: 'Não Caia na Armadilha', desc: 'Evite a jogada que perde material.', xp: 15,
    setup: () => { const b = emptyBoard(); b[5][2]=WHITE; b[4][3]=BLACK; b[2][1]=BLACK; b[6][5]=WHITE; return b; },
    side: WHITE, goal: 'anycapture' }
];

// ---------------------------------------------------------------
// ACADEMY CONCEPTS
// ---------------------------------------------------------------
const CONCEPTS = [
  { id: 'centro', title: 'Centro', text: 'Ocupar o centro aumenta a mobilidade e o controle de diagonais importantes.' },
  { id: 'mobilidade', title: 'Mobilidade', text: 'Peças com mais casas disponíveis são mais valiosas. Evite bloqueios desnecessários.' },
  { id: 'estrutura', title: 'Estrutura', text: 'Formações compactas protegem peças e criam ameaças coordenadas.' },
  { id: 'bloqueio', title: 'Bloqueio', text: 'Às vezes impedir o avanço do adversário vale mais do que capturar imediatamente.' },
  { id: 'troca', title: 'Troca', text: 'Trocar peças quando você tem vantagem material simplifica e aproxima a vitória.' },
  { id: 'ameaca', title: 'Ameaça', text: 'Criar ameaças duplas força o adversário a defender e ceder terreno.' },
  { id: 'sacrificio', title: 'Sacrifício', text: 'Oferecer uma peça para obter captura múltipla ou promoção pode ser decisivo.' },
  { id: 'promocao', title: 'Promoção', text: 'Priorize criar Damas. Uma Dama bem posicionada domina o tabuleiro.' },
  { id: 'finais', title: 'Finais', text: 'No final, use a Dama para restringir o rei adversário e forçar promoção ou captura.' }
];

const OPENINGS = [
  { id: 'o1', name: 'Avanço Central', moves: [[5,2],[4,3]], text: 'Avançar uma peça central abre diagonais e prepara o desenvolvimento.', goal: 'Controlar o centro cedo.' },
  { id: 'o2', name: 'Desenvolvimento Lateral', moves: [[5,0],[4,1]], text: 'Desenvolver a ala permite criar pressão nas bordas.', goal: 'Preparar flancos.' },
  { id: 'o3', name: 'Linha Sólida', moves: [[5,4],[4,5]], text: 'Manter a estrutura compacta evita fraquezas precoces.', goal: 'Solidez inicial.' }
];

// ---------------------------------------------------------------
// TOAST
// ---------------------------------------------------------------
function toast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ---------------------------------------------------------------
// VIEWS
// ---------------------------------------------------------------
function navigate(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });
  SFX.click();
  renderView(view);
}

function renderView(view) {
  const content = document.getElementById('content');
  if (view === 'home') content.innerHTML = renderHome();
  else if (view === 'learn') content.innerHTML = renderLearn();
  else if (view === 'train') content.innerHTML = renderTrain();
  else if (view === 'play') content.innerHTML = renderPlaySetup();
  else if (view === 'academy') content.innerHTML = renderAcademy();
  else if (view === 'openings') content.innerHTML = renderOpenings();
  else if (view === 'achievements') content.innerHTML = renderAchievements();
  else if (view === 'profile') content.innerHTML = renderProfile();
  else if (view === 'settings') content.innerHTML = renderSettings();
  else content.innerHTML = renderHome();

  // bind events
  bindViewEvents(view);
}

function renderHome() {
  const nextLesson = LESSONS.find(l => !appState.lessonsCompleted.includes(l.id));
  const completed = appState.lessonsCompleted.length;
  const total = LESSONS.length;
  const today = new Date().toISOString().slice(0, 10);
  const dailyDone = appState.dailyDone === today;

  return `
  <div class="home-hero">
    <div class="continue-card">
      <h2>${nextLesson ? 'Continue sua jornada' : 'Jornada completa!'}</h2>
      <p>${nextLesson ? nextLesson.title : 'Você concluiu todas as lições. Pratique e desafie a Pantera!'}</p>
      <button class="btn btn-lg" id="btn-continue">${nextLesson ? 'PRÓXIMA LIÇÃO' : 'JOGAR AGORA'}</button>
    </div>
    <div class="mascot-side">
      <div class="mascot-speech" id="home-speech">Vamos treinar?</div>
      <div class="mascot-container" id="home-mascot"></div>
    </div>
  </div>

  <div class="daily-banner">
    <div>
      <h3>Desafio do Dia</h3>
      <p>${dailyDone ? 'Você já completou o desafio de hoje! +25 XP' : 'Um desafio especial te espera. +25 XP'}</p>
    </div>
    <button class="btn btn-gold btn-sm" id="btn-daily" ${dailyDone ? 'disabled' : ''}>${dailyDone ? 'Feito' : 'Desafiar'}</button>
  </div>

  <div class="progress-overview">
    <div class="stat-pill"><div class="val">${appState.level}</div><div class="lbl">${LEVELS[appState.level-1].name}</div></div>
    <div class="stat-pill"><div class="val">${completed}/${total}</div><div class="lbl">Lições</div></div>
    <div class="stat-pill"><div class="val">${appState.stats.wins}</div><div class="lbl">Vitórias</div></div>
    <div class="stat-pill"><div class="val">${appState.achievements.length}</div><div class="lbl">Conquistas</div></div>
  </div>

  <h3 class="section-title">Trilha de Aprendizado</h3>
  ${renderPathPreview()}
  `;
}

function renderPathPreview() {
  let html = '';
  for (const u of UNITS) {
    const lessons = LESSONS.filter(l => l.unit === u.id);
    const done = lessons.every(l => appState.lessonsCompleted.includes(l.id));
    const unlocked = appState.unitsUnlocked.includes(u.id) || u.id === 1;
    const anyDone = lessons.some(l => appState.lessonsCompleted.includes(l.id));
    html += `<div class="path-unit">
      <div class="unit-header">
        <div class="unit-badge ${done ? 'done' : unlocked ? '' : 'locked'}">${done ? '✓' : u.id}</div>
        <div><div class="unit-title">${u.title}</div><div class="unit-sub">${lessons.length} lições</div></div>
      </div>
    </div>`;
  }
  return html;
}

function renderLearn() {
  let html = `<h2 class="section-title">Aprender</h2><p class="section-sub">Siga a trilha. Cada lição ensina com o tabuleiro.</p>`;
  for (const u of UNITS) {
    const lessons = LESSONS.filter(l => l.unit === u.id);
    const unlocked = appState.unitsUnlocked.includes(u.id) || u.id === 1;
    const doneCount = lessons.filter(l => appState.lessonsCompleted.includes(l.id)).length;
    html += `<div class="path-unit">
      <div class="unit-header">
        <div class="unit-badge ${doneCount === lessons.length ? 'done' : unlocked ? '' : 'locked'}">${doneCount === lessons.length ? '✓' : u.id}</div>
        <div><div class="unit-title">Unidade ${u.id} — ${u.title}</div>
        <div class="unit-sub">${doneCount}/${lessons.length} concluídas</div></div>
      </div>
      <div class="lesson-path">`;
    for (const l of lessons) {
      const completed = appState.lessonsCompleted.includes(l.id);
      const isNext = !completed && unlocked && !lessons.slice(0, lessons.indexOf(l)).some(x => !appState.lessonsCompleted.includes(x.id));
      let cls = 'lesson-node';
      if (completed) cls += ' completed';
      else if (isNext) cls += ' current';
      else if (!unlocked) cls += ' locked';
      html += `<div class="${cls}" data-lesson="${l.id}">
        <div class="lesson-icon">${completed ? '✓' : isNext ? '▶' : '○'}</div>
        <div class="lesson-info"><h4>${l.title}</h4><p>Unidade ${u.id}</p></div>
        <div class="lesson-xp">+${l.xp} XP</div>
      </div>`;
    }
    html += `</div></div>`;
  }
  return html;
}

function renderTrain() {
  let html = `<h2 class="section-title">Treino</h2><p class="section-sub">Posições práticas para afiar suas táticas.</p><div class="challenge-grid">`;
  for (const c of CHALLENGES) {
    html += `<div class="challenge-card" data-challenge="${c.id}">
      <h4>${c.title}</h4><p>${c.desc}</p><span class="xp-tag">+${c.xp} XP</span>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function renderPlaySetup() {
  return `
  <h2 class="section-title">Jogar contra a Pantera</h2>
  <p class="section-sub">Escolha a dificuldade e mostre sua estratégia.</p>
  <div class="play-setup">
    <div class="difficulty-grid" id="diff-grid">
      ${DIFFICULTIES.map((d, i) => `
        <div class="diff-card ${i === 0 ? 'selected' : ''}" data-diff="${d.id}">
          <h4>${d.name}</h4>
          <p>${d.desc}</p>
          <div class="stars">${d.stars}</div>
        </div>
      `).join('')}
    </div>
    <button class="btn btn-primary btn-lg" id="btn-start-game" style="width:100%">COMEÇAR PARTIDA</button>
  </div>`;
}

function renderAcademy() {
  let html = `<h2 class="section-title">Academia</h2><p class="section-sub">Conceitos estratégicos para elevar seu jogo.</p><div class="concept-list">`;
  CONCEPTS.forEach((c, i) => {
    html += `<div class="concept-item" data-concept="${c.id}">
      <div class="ci">${i + 1}</div>
      <div><h4 style="font-weight:800">${c.title}</h4><p style="font-size:0.85rem;color:var(--text-muted)">${c.text.slice(0, 60)}...</p></div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

function renderOpenings() {
  let html = `<h2 class="section-title">Aberturas</h2><p class="section-sub">Linhas de exemplo para começar bem a partida.</p><div class="opening-list">`;
  OPENINGS.forEach((o, i) => {
    html += `<div class="opening-item" data-opening="${o.id}">
      <div class="oi">${i + 1}</div>
      <div><h4 style="font-weight:800">${o.name}</h4><p style="font-size:0.85rem;color:var(--text-muted)">${o.goal}</p></div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

function renderAchievements() {
  let html = `<h2 class="section-title">Conquistas</h2><p class="section-sub">${appState.achievements.length}/${ACHIEVEMENTS.length} desbloqueadas</p><div class="ach-grid">`;
  for (const a of ACHIEVEMENTS) {
    const unlocked = appState.achievements.includes(a.id);
    html += `<div class="ach-card ${unlocked ? 'unlocked' : 'locked'}">
      <div class="ach-icon">${a.icon}</div>
      <h4>${a.name}</h4>
      <p>${a.desc}</p>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function renderProfile() {
  return `
  <div class="profile-header">
    <div class="mascot-container" id="profile-mascot"></div>
    <div class="profile-level">Nível ${appState.level} — ${LEVELS[appState.level-1].name}</div>
    <p style="color:var(--text-muted)">${appState.xp} XP · Streak ${appState.streak} 🔥</p>
  </div>
  <div class="stats-grid">
    <div class="stat-box"><div class="num">${appState.stats.games}</div><div class="lbl">Partidas</div></div>
    <div class="stat-box"><div class="num">${appState.stats.wins}</div><div class="lbl">Vitórias</div></div>
    <div class="stat-box"><div class="num">${appState.stats.losses}</div><div class="lbl">Derrotas</div></div>
    <div class="stat-box"><div class="num">${appState.stats.captures}</div><div class="lbl">Capturas</div></div>
    <div class="stat-box"><div class="num">${appState.stats.maxCombo}</div><div class="lbl">Maior Combo</div></div>
    <div class="stat-box"><div class="num">${appState.lessonsCompleted.length}</div><div class="lbl">Lições</div></div>
  </div>`;
}

function renderSettings() {
  return `
  <h2 class="section-title">Configurações</h2>
  <div class="settings-list">
    <div class="setting-row">
      <span>Som</span>
      <div class="toggle ${appState.settings.sound ? 'on' : ''}" id="tog-sound"></div>
    </div>
    <div class="setting-row">
      <span>Modo Escuro</span>
      <div class="toggle ${appState.settings.darkMode ? 'on' : ''}" id="tog-dark"></div>
    </div>
    <div class="setting-row">
      <span>Animações</span>
      <div class="toggle ${appState.settings.animations ? 'on' : ''}" id="tog-anim"></div>
    </div>
    <div class="setting-row">
      <span>Resetar Progresso</span>
      <button class="btn btn-secondary btn-sm" id="btn-reset">Resetar</button>
    </div>
  </div>`;
}

function bindViewEvents(view) {
  if (view === 'home') {
    const m = document.getElementById('home-mascot');
    if (m) setMascot(m, 'happy');
    document.getElementById('btn-continue')?.addEventListener('click', () => {
      const next = LESSONS.find(l => !appState.lessonsCompleted.includes(l.id));
      if (next) startLesson(next.id);
      else navigate('play');
    });
    document.getElementById('btn-daily')?.addEventListener('click', startDailyChallenge);
  }
  if (view === 'learn') {
    document.querySelectorAll('.lesson-node:not(.locked)').forEach(n => {
      n.addEventListener('click', () => startLesson(n.dataset.lesson));
    });
  }
  if (view === 'train') {
    document.querySelectorAll('.challenge-card').forEach(c => {
      c.addEventListener('click', () => startChallenge(c.dataset.challenge));
    });
  }
  if (view === 'play') {
    let selectedDiff = 'filhote';
    document.querySelectorAll('.diff-card').forEach(d => {
      d.addEventListener('click', () => {
        document.querySelectorAll('.diff-card').forEach(x => x.classList.remove('selected'));
        d.classList.add('selected');
        selectedDiff = d.dataset.diff;
        SFX.click();
      });
    });
    document.getElementById('btn-start-game')?.addEventListener('click', () => startGame(selectedDiff));
  }
  if (view === 'academy') {
    document.querySelectorAll('.concept-item').forEach(c => {
      c.addEventListener('click', () => showConcept(c.dataset.concept));
    });
  }
  if (view === 'openings') {
    document.querySelectorAll('.opening-item').forEach(o => {
      o.addEventListener('click', () => showOpening(o.dataset.opening));
    });
  }
  if (view === 'profile') {
    const m = document.getElementById('profile-mascot');
    if (m) setMascot(m, 'proud');
  }
  if (view === 'settings') {
    document.getElementById('tog-sound')?.addEventListener('click', function() {
      appState.settings.sound = !appState.settings.sound;
      this.classList.toggle('on', appState.settings.sound);
      saveState();
      updateSoundIcon();
      SFX.click();
    });
    document.getElementById('tog-dark')?.addEventListener('click', function() {
      appState.settings.darkMode = !appState.settings.darkMode;
      this.classList.toggle('on', appState.settings.darkMode);
      applyTheme();
      saveState();
    });
    document.getElementById('tog-anim')?.addEventListener('click', function() {
      appState.settings.animations = !appState.settings.animations;
      this.classList.toggle('on', appState.settings.animations);
      saveState();
    });
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (confirm('Apagar todo o progresso?')) {
        appState = defaultState();
        saveState();
        applyTheme();
        updateXPUI();
        updateSoundIcon();
        navigate('home');
        toast('Progresso resetado', 'error');
      }
    });
  }
}

// ---------------------------------------------------------------
// LESSON FLOW
// ---------------------------------------------------------------
function startLesson(lessonId) {
  const lesson = LESSONS.find(l => l.id === lessonId);
  if (!lesson) return;
  let stepIdx = 0;
  const content = document.getElementById('content');

  function showStep() {
    const step = lesson.steps[stepIdx];
    const isLast = stepIdx === lesson.steps.length - 1;
    let boardHTML = '';
    let boardState = null;

    if (step.board) {
      boardState = getLessonBoard(step.board);
      boardHTML = `<div class="board-wrap" id="lesson-board-wrap">${renderBoardHTML(boardState)}</div>`;
    }

    content.innerHTML = `
    <div class="lesson-screen">
      <div class="lesson-header">
        <button class="lesson-back" id="lesson-back" aria-label="Voltar">←</button>
        <div class="lesson-progress-dots">
          ${lesson.steps.map((_, i) => `<div class="dot ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}"></div>`).join('')}
        </div>
      </div>
      <div class="lesson-instruction">
        <h3>${lesson.title}</h3>
        <p>${step.text}</p>
      </div>
      ${boardHTML}
      <div class="lesson-feedback" id="lesson-fb"></div>
      <div class="mascot-container small" id="lesson-mascot" style="margin:0 auto"></div>
      <div class="lesson-actions">
        ${step.goal ? '' : `<button class="btn btn-primary" id="lesson-next">${isLast ? 'CONCLUIR' : 'CONTINUAR'}</button>`}
      </div>
    </div>`;

    setMascot(document.getElementById('lesson-mascot'), step.goal ? 'thinking' : 'idle');

    document.getElementById('lesson-back')?.addEventListener('click', () => navigate('learn'));

    if (step.goal && boardState) {
      const wrap = document.getElementById('lesson-board-wrap');
      const side = WHITE;
      attachBoardHandlers(wrap, boardState, side, (move) => {
        const fb = document.getElementById('lesson-fb');
        let ok = false;
        if (step.goal === 'move') {
          ok = move.from[0] === step.from[0] && move.from[1] === step.from[1] &&
               move.to[0] === step.to[0] && move.to[1] === step.to[1];
        } else if (step.goal === 'capture' || step.goal === 'anycapture') {
          ok = move.captures.length > 0;
          if (step.from) ok = ok && move.from[0] === step.from[0] && move.from[1] === step.from[1];
        } else if (step.goal === 'multicap') {
          ok = move.captures.length >= (step.minCaps || 2);
        } else if (step.goal === 'promote') {
          const nb = applyMove(boardState, move);
          ok = isKing(nb[move.to[0]][move.to[1]]) && !isKing(boardState[move.from[0]][move.from[1]]);
        }

        if (ok) {
          boardState = applyMove(boardState, move);
          wrap.innerHTML = renderBoardHTML(boardState);
          fb.textContent = move.captures.length > 1 ? 'COMBO!' : 'Muito bem!';
          fb.className = 'lesson-feedback ok';
          setMascot(document.getElementById('lesson-mascot'), 'happy');
          SFX.success();
          if (move.captures.length) {
            appState.stats.captures += move.captures.length;
            if (move.captures.length > appState.stats.maxCombo) appState.stats.maxCombo = move.captures.length;
            checkAchievement('captures10');
            if (move.captures.length > 1) unlockAchievement('first_multi');
          }
          setTimeout(() => {
            stepIdx++;
            if (stepIdx >= lesson.steps.length) finishLesson(lesson);
            else showStep();
          }, 900);
        } else {
          fb.textContent = 'Quase! Tente de novo.';
          fb.className = 'lesson-feedback err';
          setMascot(document.getElementById('lesson-mascot'), 'confused');
          SFX.error();
        }
      });
    } else {
      document.getElementById('lesson-next')?.addEventListener('click', () => {
        if (isLast) finishLesson(lesson);
        else { stepIdx++; showStep(); }
      });
    }
  }
  showStep();
}

function finishLesson(lesson) {
  if (!appState.lessonsCompleted.includes(lesson.id)) {
    appState.lessonsCompleted.push(lesson.id);
    // unlock next unit if all in unit done
    const unitLessons = LESSONS.filter(l => l.unit === lesson.unit);
    if (unitLessons.every(l => appState.lessonsCompleted.includes(l.id))) {
      if (!appState.unitsUnlocked.includes(lesson.unit + 1) && lesson.unit < 9) {
        appState.unitsUnlocked.push(lesson.unit + 1);
        toast(`Unidade ${lesson.unit + 1} desbloqueada!`, 'success');
        addXP(50, 'Unidade completa');
      }
    }
    saveState();
    unlockAchievement('first_lesson');
    checkAchievement('master');
    addXP(lesson.xp, lesson.title);
  }
  updateStreak();
  toast('Lição concluída!', 'success');
  setTimeout(() => navigate('learn'), 600);
}

// ---------------------------------------------------------------
// CHALLENGES & DAILY
// ---------------------------------------------------------------
function startChallenge(id) {
  const ch = CHALLENGES.find(c => c.id === id);
  if (!ch) return;
  const board = ch.setup();
  const content = document.getElementById('content');
  content.innerHTML = `
  <div class="lesson-screen">
    <div class="lesson-header">
      <button class="lesson-back" id="ch-back">←</button>
      <h3 style="flex:1;text-align:center;font-family:var(--font-display)">${ch.title}</h3>
    </div>
    <div class="lesson-instruction"><p>${ch.desc}</p></div>
    <div class="board-wrap" id="ch-board"></div>
    <div class="lesson-feedback" id="ch-fb"></div>
    <div class="mascot-container small" id="ch-mascot" style="margin:0 auto"></div>
  </div>`;
  setMascot(document.getElementById('ch-mascot'), 'thinking');
  document.getElementById('ch-back').onclick = () => navigate('train');

  let state = board;
  const wrap = document.getElementById('ch-board');
  attachBoardHandlers(wrap, state, ch.side, (move) => {
    const fb = document.getElementById('ch-fb');
    let ok = false;
    if (ch.goal === 'anycapture') ok = move.captures.length > 0;
    if (ch.goal === 'multicap') ok = move.captures.length >= (ch.min || 2);
    if (ch.goal === 'promote') {
      const nb = applyMove(state, move);
      ok = isKing(nb[move.to[0]][move.to[1]]);
    }
    if (ok) {
      state = applyMove(state, move);
      wrap.innerHTML = renderBoardHTML(state);
      fb.textContent = 'Perfeito!';
      fb.className = 'lesson-feedback ok';
      setMascot(document.getElementById('ch-mascot'), 'excited');
      SFX.success();
      addXP(ch.xp, ch.title);
      updateStreak();
      setTimeout(() => navigate('train'), 1200);
    } else {
      fb.textContent = 'Não é isso. Tente outra jogada.';
      fb.className = 'lesson-feedback err';
      setMascot(document.getElementById('ch-mascot'), 'confused');
      SFX.error();
    }
  });
}

function startDailyChallenge() {
  const day = new Date().getDate();
  const ch = CHALLENGES[day % CHALLENGES.length];
  const today = new Date().toISOString().slice(0, 10);
  // temporarily boost xp
  const originalXp = ch.xp;
  ch.xp = 25;
  startChallenge(ch.id);
  // mark done after — we patch via override
  const orig = navigate;
  // simpler: set after start
  setTimeout(() => {
    appState.dailyDone = today;
    saveState();
    updateStreak();
  }, 100);
  ch.xp = originalXp;
}

// ---------------------------------------------------------------
// FULL GAME vs CPU
// ---------------------------------------------------------------
function startGame(diffId) {
  const diff = DIFFICULTIES.find(d => d.id === diffId) || DIFFICULTIES[0];
  let board = initialBoard();
  let turn = WHITE; // player is white
  let gameOver = false;
  const content = document.getElementById('content');

  function renderGame() {
    content.innerHTML = `
    <div class="lesson-screen" style="max-width:480px">
      <div class="lesson-header">
        <button class="lesson-back" id="game-back">←</button>
        <h3 style="flex:1;text-align:center;font-family:var(--font-display)">vs ${diff.name}</h3>
      </div>
      <div class="game-hud">
        <div class="turn-indicator ${turn === WHITE ? 'your' : 'cpu'}" id="turn-ind">
          ${turn === WHITE ? 'Sua vez' : 'Pantera pensando...'}
        </div>
        <div style="font-size:0.85rem;color:var(--text-muted)">${countPieces(board, WHITE)} — ${countPieces(board, BLACK)}</div>
      </div>
      <div class="board-wrap" id="game-board"></div>
      <div class="mascot-container small" id="game-mascot" style="margin:8px auto"></div>
      <div class="lesson-feedback" id="game-fb"></div>
    </div>`;
    setMascot(document.getElementById('game-mascot'), turn === WHITE ? 'idle' : 'thinking');
    document.getElementById('game-back').onclick = () => {
      if (!gameOver && confirm('Abandonar a partida?')) navigate('play');
      else if (gameOver) navigate('play');
    };

    const wrap = document.getElementById('game-board');
    if (turn === WHITE && !gameOver) {
      attachBoardHandlers(wrap, board, WHITE, (move) => {
        if (gameOver) return;
        board = applyMove(board, move);
        if (move.captures.length) {
          appState.stats.captures += move.captures.length;
          if (move.captures.length > appState.stats.maxCombo) appState.stats.maxCombo = move.captures.length;
          checkAchievement('captures10');
          checkAchievement('captures50');
          if (move.captures.length > 1) unlockAchievement('first_multi');
        }
        // check promotion
        if (isKing(board[move.to[0]][move.to[1]]) && move.to[0] === 0) {
          SFX.promote();
          appState.stats.promotions++;
          unlockAchievement('first_king');
          toast('VOCÊ GANHOU UMA DAMA!', 'success');
        }
        turn = BLACK;
        checkGameEnd();
        if (!gameOver) {
          renderGame();
          setTimeout(doCpuMove, 400 + Math.random() * 400);
        }
      });
    } else {
      wrap.innerHTML = renderBoardHTML(board);
    }
  }

  function doCpuMove() {
    if (gameOver) return;
    const move = cpuMove(board, BLACK, diff.depth);
    if (!move) {
      endGame('win');
      return;
    }
    board = applyMove(board, move);
    if (move.captures.length > 1) SFX.combo();
    else if (move.captures.length) SFX.capture();
    else SFX.move();
    turn = WHITE;
    checkGameEnd();
    if (!gameOver) renderGame();
  }

  function checkGameEnd() {
    const whiteMoves = hasAnyMoves(board, WHITE);
    const blackMoves = hasAnyMoves(board, BLACK);
    const whiteCount = countPieces(board, WHITE);
    const blackCount = countPieces(board, BLACK);
    if (blackCount === 0 || !blackMoves) endGame('win');
    else if (whiteCount === 0 || !whiteMoves) endGame('lose');
  }

  function endGame(result) {
    gameOver = true;
    appState.stats.games++;
    updateStreak();
    if (result === 'win') {
      appState.stats.wins++;
      unlockAchievement('first_win');
      if (diff.id === 'pantera') unlockAchievement('beat_pantera');
      addXP(20 + diff.depth * 5, 'Vitória');
      SFX.win();
      showResult(true, diff);
    } else {
      appState.stats.losses++;
      SFX.lose();
      showResult(false, diff);
    }
    saveState();
  }

  function showResult(won, diff) {
    const overlay = document.createElement('div');
    overlay.className = 'result-overlay';
    overlay.innerHTML = `
    <div class="result-card ${won ? 'win' : 'lose'}">
      <div class="mascot-container" id="result-mascot"></div>
      <h2>${won ? 'VITÓRIA!' : 'Boa tentativa'}</h2>
      <p>${won ? 'Você dominou a Pantera!' : 'Cada partida é uma oportunidade de aprender.'}</p>
      ${won ? `<div class="result-xp">+${20 + diff.depth * 5} XP</div>` : ''}
      <div class="result-actions">
        <button class="btn btn-primary" id="res-again">JOGAR NOVAMENTE</button>
        <button class="btn btn-secondary" id="res-back">VOLTAR</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    setMascot(document.getElementById('result-mascot'), won ? 'winning' : 'sad');
    if (won) spawnConfetti();
    document.getElementById('res-again').onclick = () => { overlay.remove(); startGame(diff.id); };
    document.getElementById('res-back').onclick = () => { overlay.remove(); navigate('play'); };
  }

  renderGame();
}

function spawnConfetti() {
  const colors = ['#D4A017', '#C23A3A', '#2E8B57', '#5C3D6E', '#F0C14A'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[i % colors.length];
    el.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    el.style.animationDelay = Math.random() * 0.5 + 's';
    document.getElementById('fx-layer').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

// ---------------------------------------------------------------
// CONCEPT / OPENING DETAIL
// ---------------------------------------------------------------
function showConcept(id) {
  const c = CONCEPTS.find(x => x.id === id);
  if (!c) return;
  const content = document.getElementById('content');
  content.innerHTML = `
  <div class="lesson-screen">
    <div class="lesson-header">
      <button class="lesson-back" id="c-back">←</button>
    </div>
    <div class="card">
      <h2 style="font-family:var(--font-display);margin-bottom:12px">${c.title}</h2>
      <p style="line-height:1.6">${c.text}</p>
    </div>
    <div class="mascot-container" id="c-mascot" style="margin:20px auto"></div>
    <button class="btn btn-primary" id="c-back2">ENTENDI</button>
  </div>`;
  setMascot(document.getElementById('c-mascot'), 'proud');
  document.getElementById('c-back').onclick = () => navigate('academy');
  document.getElementById('c-back2').onclick = () => navigate('academy');
}

function showOpening(id) {
  const o = OPENINGS.find(x => x.id === id);
  if (!o) return;
  let board = initialBoard();
  // apply first move for demo
  if (o.moves[0]) {
    const [fr, fc] = o.moves[0];
    const [tr, tc] = o.moves[1] || [fr - 1, fc - 1];
    if (board[fr] && board[fr][fc]) {
      board[tr][tc] = board[fr][fc];
      board[fr][fc] = 0;
    }
  }
  const content = document.getElementById('content');
  content.innerHTML = `
  <div class="lesson-screen">
    <div class="lesson-header"><button class="lesson-back" id="o-back">←</button></div>
    <div class="card">
      <h2 style="font-family:var(--font-display);margin-bottom:8px">${o.name}</h2>
      <p style="margin-bottom:8px">${o.text}</p>
      <p style="color:var(--gold);font-weight:700">Objetivo: ${o.goal}</p>
    </div>
    <div class="board-wrap">${renderBoardHTML(board)}</div>
    <button class="btn btn-primary" id="o-back2">VOLTAR</button>
  </div>`;
  document.getElementById('o-back').onclick = () => navigate('openings');
  document.getElementById('o-back2').onclick = () => navigate('openings');
}

// ---------------------------------------------------------------
// THEME / SOUND ICONS
// ---------------------------------------------------------------
function applyTheme() {
  document.documentElement.setAttribute('data-theme', appState.settings.darkMode ? 'dark' : '');
  const sun = document.querySelector('.icon-sun');
  const moon = document.querySelector('.icon-moon');
  if (sun && moon) {
    sun.classList.toggle('hidden', appState.settings.darkMode);
    moon.classList.toggle('hidden', !appState.settings.darkMode);
  }
}

function updateSoundIcon() {
  const on = document.querySelector('.icon-sound-on');
  const off = document.querySelector('.icon-sound-off');
  if (on && off) {
    on.classList.toggle('hidden', !appState.settings.sound);
    off.classList.toggle('hidden', appState.settings.sound);
  }
}

// ---------------------------------------------------------------
// ONBOARDING
// ---------------------------------------------------------------
function startOnboarding() {
  const screen = document.getElementById('onboarding');
  const main = document.getElementById('main-app');
  screen.classList.remove('hidden');
  main.classList.add('hidden');

  const steps = [
    { title: 'Oi! Eu sou a Pantera.', text: 'Vou te ensinar a jogar Damas Brasileiras de verdade.', mascot: 'happy' },
    { title: 'Aprenda jogando', text: 'Lições interativas, treinos e partidas contra mim.', mascot: 'excited' },
    { title: 'Vamos começar pelo básico?', text: 'Sua jornada começa agora.', mascot: 'proud' }
  ];
  let idx = 0;
  const title = document.getElementById('onboard-title');
  const text = document.getElementById('onboard-text');
  const btn = document.getElementById('onboard-btn');
  const mascotEl = document.getElementById('onboard-mascot');

  function show() {
    const s = steps[idx];
    title.textContent = s.title;
    text.textContent = s.text;
    setMascot(mascotEl, s.mascot);
    btn.textContent = idx === steps.length - 1 ? 'COMEÇAR' : 'PRÓXIMO';
  }
  show();

  btn.onclick = () => {
    SFX.click();
    if (idx < steps.length - 1) {
      idx++;
      show();
    } else {
      appState.onboarded = true;
      saveState();
      screen.classList.add('hidden');
      main.classList.remove('hidden');
      updateXPUI();
      navigate('home');
      // start first lesson
      setTimeout(() => startLesson('u1l1'), 400);
    }
  };
}

// ---------------------------------------------------------------
// INIT
// ---------------------------------------------------------------
function init() {
  applyTheme();
  updateSoundIcon();
  updateXPUI();

  // nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });
  document.getElementById('logo-btn')?.addEventListener('click', () => navigate('home'));
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    appState.settings.darkMode = !appState.settings.darkMode;
    applyTheme();
    saveState();
    SFX.click();
  });
  document.getElementById('sound-toggle')?.addEventListener('click', () => {
    appState.settings.sound = !appState.settings.sound;
    updateSoundIcon();
    saveState();
    SFX.click();
  });

  if (!appState.onboarded) {
    startOnboarding();
  } else {
    document.getElementById('onboarding').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    navigate('home');
  }
}

document.addEventListener('DOMContentLoaded', init);
