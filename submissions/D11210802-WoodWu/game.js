const COLS = 10;
const ROWS = 20;
const BLOCK = 36;
const DROP_INTERVAL = 700;
const LINE_SCORES = [0, 100, 300, 500, 800];

const COLORS = {
  I: "#5ee7ff",
  J: "#5b7cfa",
  L: "#ff9f43",
  O: "#ffd644",
  S: "#2df27e",
  T: "#d16bff",
  Z: "#ff4d6d"
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]]
};

const TEXT = {
  pause: "\u66ab\u505c",
  resume: "\u7e7c\u7e8c",
  start: "\u958b\u59cb",
  gameOver: "\u904a\u6232\u7d50\u675f",
  score: "\u5206\u6578",
  paused: "\u5df2\u66ab\u505c",
  pausedBody: "\u6309\u7e7c\u7e8c\u56de\u5230\u904a\u6232\u3002",
  helpTitle: "\u64cd\u4f5c\u8aaa\u660e",
  helpBody: "\u2190 \u2192\uff1a\u5de6\u53f3\u79fb\u52d5<br>\u2191\uff1a\u65cb\u8f49<br>\u2193\uff1a\u52a0\u901f\u4e0b\u843d<br>\u7a7a\u767d\u9375\uff1a\u76f4\u63a5\u843d\u4e0b<br>\u624b\u6a5f\u53ef\u4f7f\u7528\u4e0b\u65b9\u89f8\u63a7\u6309\u9215\u3002",
  crit: "\u66b4\u64ca"
};

const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.querySelector("#next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const helpButton = document.querySelector("#helpButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const effectsLayer = document.querySelector("#effectsLayer");

let board = createBoard();
let activePiece = null;
let nextPiece = null;
let score = 0;
let running = false;
let paused = false;
let lastTime = 0;
let dropCounter = 0;
let animationId = 0;
let audioCtx = null;
let clearEffects = [];

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(""));
}

function cloneShape(shape) {
  return shape.map(row => [...row]);
}

function createPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const shape = cloneShape(SHAPES[type]);
  return {
    type,
    shape,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0
  };
}

function setScore(nextScore) {
  score = nextScore;
  scoreEl.textContent = String(score);
}

function ensureAudio() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtor();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function startGame() {
  ensureAudio();
  board = createBoard();
  activePiece = createPiece();
  nextPiece = createPiece();
  clearEffects = [];
  setScore(0);
  running = true;
  paused = false;
  lastTime = 0;
  dropCounter = 0;
  pauseButton.disabled = false;
  pauseButton.textContent = TEXT.pause;
  overlay.classList.remove("is-visible");
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(update);
}

function showOverlay(title, html, buttonText) {
  overlayTitle.textContent = title;
  overlayText.innerHTML = html;
  startButton.textContent = buttonText;
  overlay.classList.add("is-visible");
}

function endGame() {
  running = false;
  paused = false;
  activePiece = null;
  nextPiece = null;
  pauseButton.disabled = true;
  pauseButton.textContent = TEXT.pause;
  showOverlay(TEXT.gameOver, `${TEXT.score} ${score}`, TEXT.start);
}

function togglePause() {
  if (!running || !activePiece) return;

  paused = !paused;
  pauseButton.textContent = paused ? TEXT.resume : TEXT.pause;
  if (paused) {
    showOverlay(TEXT.paused, TEXT.pausedBody, TEXT.resume);
  } else {
    overlay.classList.remove("is-visible");
  }

  if (!paused) {
    lastTime = performance.now();
  }
}

function showHelp() {
  if (running && !paused) {
    paused = true;
    pauseButton.textContent = TEXT.resume;
  }

  showOverlay(TEXT.helpTitle, TEXT.helpBody, running ? TEXT.resume : TEXT.start);
}

function update(time = 0) {
  if (!running) {
    draw(performance.now());
    return;
  }

  if (!paused) {
    if (!lastTime) {
      lastTime = time;
    }
    const delta = clamp(time - lastTime, 0, 1000);
    lastTime = time;
    dropCounter += delta;

    if (dropCounter >= DROP_INTERVAL) {
      softDrop();
      dropCounter = 0;
    }
  }

  draw(time);
  animationId = requestAnimationFrame(update);
}

function draw(time = performance.now()) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#05080c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawLockedCells();
  drawNextPiece();

  if (activePiece) {
    drawMatrix(activePiece.shape, activePiece.x, activePiece.y, COLORS[activePiece.type]);
  }

  try {
    drawClearEffects(time);
  } catch (error) {
    clearEffects = [];
  }
}

function drawGrid() {
  ctx.strokeStyle = "#223142";
  ctx.lineWidth = 1;

  for (let x = 0; x <= COLS; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK + 0.5, 0);
    ctx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
    ctx.stroke();
  }

  for (let y = 0; y <= ROWS; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK + 0.5);
    ctx.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
    ctx.stroke();
  }
}

function drawLockedCells() {
  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) {
        drawCell(x, y, COLORS[type]);
      }
    });
  });
}

function drawMatrix(matrix, offsetX, offsetY, color) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(offsetX + x, offsetY + y, color);
      }
    });
  });
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) return;

  const previewBlock = 13;
  const matrix = nextPiece.shape;
  const width = matrix[0].length * previewBlock;
  const height = matrix.length * previewBlock;
  const offsetX = Math.floor((nextCanvas.width - width) / 2);
  const offsetY = Math.floor((nextCanvas.height - height) / 2);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const px = offsetX + x * previewBlock;
      const py = offsetY + y * previewBlock;
      nextCtx.fillStyle = COLORS[nextPiece.type];
      nextCtx.fillRect(px + 1, py + 1, previewBlock - 2, previewBlock - 2);
      nextCtx.fillStyle = "rgba(255, 255, 255, 0.2)";
      nextCtx.fillRect(px + 3, py + 3, previewBlock - 6, 3);
    });
  });
}

function drawCell(x, y, color) {
  const px = x * BLOCK;
  const py = y * BLOCK;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(px + 4, py + 4, BLOCK - 8, 5);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.32)";
  ctx.strokeRect(px + 1.5, py + 1.5, BLOCK - 3, BLOCK - 3);
}

function drawClearEffects(time) {
  clearEffects = clearEffects.filter(effect => {
    if (!Array.isArray(effect.rows) || effect.rows.length === 0) return false;
    if (!Number.isFinite(effect.start) || !Number.isFinite(effect.duration) || effect.duration <= 0) return false;

    const progress = clamp01((time - effect.start) / effect.duration);
    if (progress >= 1) return false;

    const alpha = clamp01(1 - progress);
    const sweep = canvas.width * progress;
    ctx.save();
    try {
      ctx.globalCompositeOperation = "lighter";

      effect.rows.forEach(row => {
        const y = row * BLOCK;
        const height = BLOCK;
        const gradient = ctx.createLinearGradient(0, y, canvas.width, y);
        gradient.addColorStop(0, `rgba(0, 229, 255, ${0.08 * alpha})`);
        gradient.addColorStop(0.42, `rgba(255, 43, 214, ${0.18 * alpha})`);
        gradient.addColorStop(0.5, `rgba(255, 248, 77, ${0.9 * alpha})`);
        gradient.addColorStop(0.58, `rgba(45, 242, 126, ${0.2 * alpha})`);
        gradient.addColorStop(1, `rgba(0, 229, 255, ${0.05 * alpha})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, y, canvas.width, height);

        ctx.strokeStyle = `rgba(0, 229, 255, ${0.85 * alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y + height / 2);
        ctx.lineTo(canvas.width, y + height / 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * alpha})`;
        ctx.fillRect(Math.max(0, sweep - 18), y, 36, height);
      });

      for (let i = 0; i < effect.rows.length * 9; i += 1) {
        const x = (effect.seed * (i + 7) * 37 + progress * 420) % canvas.width;
        const row = effect.rows[i % effect.rows.length];
        const y = row * BLOCK + ((effect.seed + i * 11) % BLOCK);
        ctx.fillStyle = `rgba(255, 43, 214, ${0.45 * alpha})`;
        ctx.fillRect(x, y, 10, 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${0.5 * alpha})`;
        ctx.fillRect(canvas.width - x, y + 7, 14, 2);
      }
    } finally {
      ctx.restore();
    }
    return true;
  });
}

function canMove(piece, offsetX, offsetY, shape = piece.shape) {
  return shape.every((row, y) =>
    row.every((value, x) => {
      if (!value) return true;
      const nextX = piece.x + x + offsetX;
      const nextY = piece.y + y + offsetY;
      const inside = nextX >= 0 && nextX < COLS && nextY >= 0 && nextY < ROWS;
      return inside && !board[nextY][nextX];
    })
  );
}

function moveHorizontal(direction) {
  if (!running || paused || !activePiece) return;
  if (canMove(activePiece, direction, 0)) {
    activePiece.x += direction;
    draw();
  }
}

function softDrop() {
  if (!running || paused || !activePiece) return;
  if (canMove(activePiece, 0, 1)) {
    activePiece.y += 1;
  } else {
    lockPiece();
  }
  draw();
}

function hardDrop() {
  if (!running || paused || !activePiece) return;
  while (canMove(activePiece, 0, 1)) {
    activePiece.y += 1;
  }
  lockPiece();
  draw();
}

function rotateActivePiece() {
  if (!running || paused || !activePiece || activePiece.type === "O") return;

  const rotated = rotate(activePiece.shape);
  const originalX = activePiece.x;
  const shifts = [0, -1, 1, -2, 2];

  for (const shift of shifts) {
    activePiece.x = originalX + shift;
    if (canMove(activePiece, 0, 0, rotated)) {
      activePiece.shape = rotated;
      draw();
      return;
    }
  }

  activePiece.x = originalX;
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());
}

function lockPiece() {
  activePiece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        board[activePiece.y + y][activePiece.x + x] = activePiece.type;
      }
    });
  });

  const result = clearLines();
  if (result.cleared > 0) {
    triggerLineClearEffects(result.rows, result.scoreGain);
  }

  activePiece = nextPiece || createPiece();
  activePiece.x = Math.floor((COLS - activePiece.shape[0].length) / 2);
  activePiece.y = 0;
  nextPiece = createPiece();

  if (!canMove(activePiece, 0, 0)) {
    endGame();
  }
}

function clearLines() {
  const clearedRows = board
    .map((row, y) => (row.every(Boolean) ? y : -1))
    .filter(y => y >= 0);

  if (clearedRows.length === 0) {
    return {
      cleared: 0,
      rows: [],
      scoreGain: 0
    };
  }

  board = board.filter((_, y) => !clearedRows.includes(y));
  while (board.length < ROWS) {
    board.unshift(Array(COLS).fill(""));
  }

  const cleared = clearedRows.length;
  const scoreGain = LINE_SCORES[cleared] || 0;
  if (scoreGain > 0) {
    setScore(score + scoreGain);
  }

  return {
    cleared,
    rows: clearedRows,
    scoreGain
  };
}

function triggerLineClearEffects(rows, scoreGain) {
  const safeRows = rows.filter(row => Number.isInteger(row) && row >= 0 && row < ROWS);
  if (safeRows.length === 0) return;

  clearEffects.push({
    rows: safeRows,
    start: performance.now(),
    duration: 680,
    seed: Math.random() * 1000
  });
  showScoreBurst(scoreGain, safeRows.length);
  playLineClearSound(safeRows.length);
}

function showScoreBurst(scoreGain, cleared) {
  const burst = document.createElement("div");
  burst.className = "score-burst";
  burst.textContent = cleared >= 2 ? `${TEXT.crit} ${scoreGain}!!` : `+${scoreGain}`;
  effectsLayer.appendChild(burst);
  window.setTimeout(() => burst.remove(), 1120);
}

function playLineClearSound(cleared) {
  const context = ensureAudio();
  if (!context) return;

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42 + cleared * 0.07);
  master.connect(context.destination);

  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(900 + cleared * 260, now);
  filter.frequency.exponentialRampToValueAtTime(5200 + cleared * 520, now + 0.24);
  filter.Q.setValueAtTime(6, now);
  filter.connect(master);

  const notes = [220, 330, 440, 660].slice(0, Math.max(1, cleared));
  notes.forEach((freq, index) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = index % 2 ? "square" : "sawtooth";
    osc.frequency.setValueAtTime(freq * (1 + cleared * 0.08), now + index * 0.045);
    osc.frequency.exponentialRampToValueAtTime(freq * 2.8, now + 0.22 + index * 0.035);
    gain.gain.setValueAtTime(0.0001, now + index * 0.045);
    gain.gain.exponentialRampToValueAtTime(0.14, now + index * 0.045 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25 + index * 0.04);
    osc.connect(gain);
    gain.connect(filter);
    osc.start(now + index * 0.045);
    osc.stop(now + 0.36 + index * 0.05);
  });

  const noiseBuffer = context.createBuffer(1, context.sampleRate * 0.18, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const noise = context.createBufferSource();
  const noiseGain = context.createGain();
  noise.buffer = noiseBuffer;
  noiseGain.gain.setValueAtTime(0.11 + cleared * 0.025, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  noise.connect(noiseGain);
  noiseGain.connect(filter);
  noise.start(now);
}

function runCommand(command) {
  ensureAudio();
  if (command === "left") moveHorizontal(-1);
  if (command === "right") moveHorizontal(1);
  if (command === "rotate") rotateActivePiece();
  if (command === "down") softDrop();
  if (command === "drop") hardDrop();
}

document.addEventListener("keydown", event => {
  const keyMap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "rotate",
    ArrowDown: "down",
    " ": "drop"
  };

  const command = keyMap[event.key];
  if (command) {
    event.preventDefault();
    runCommand(command);
  }
});

document.querySelectorAll("[data-command]").forEach(button => {
  button.addEventListener("click", () => {
    runCommand(button.dataset.command);
  });
});

startButton.addEventListener("click", () => {
  ensureAudio();
  if (paused) {
    togglePause();
  } else {
    startGame();
  }
});
helpButton.addEventListener("click", showHelp);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", startGame);

draw();
