const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const overlay = document.querySelector("#overlay");
const messageEl = document.querySelector("#message");
const startBtn = document.querySelector("#start");
const restartBtn = document.querySelector("#restart");
const muteBtn = document.querySelector("#mute");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_HEIGHT = 108;
const PIPE_WIDTH = 74;
const PIPE_GAP = 186;
const PIPE_SPACING = 232;
const PIPE_SPEED = 2.65;
const GRAVITY = 0.42;
const FLAP_POWER = -7.35;
const BIRD_X = 118;

const bestKey = "flappy-bird-best-score";

let best = Number(localStorage.getItem(bestKey) || 0);
let lastTime = 0;
let state = "ready";
let muted = false;
let audio;

const game = {
  frame: 0,
  score: 0,
  groundX: 0,
  clouds: [],
  pipes: [],
  bird: {
    x: BIRD_X,
    y: 312,
    radius: 19,
    velocity: 0,
    rotation: 0,
    wing: 0,
  },
};

function resetGame() {
  game.frame = 0;
  game.score = 0;
  game.groundX = 0;
  game.clouds = [
    { x: 52, y: 118, scale: 0.95, speed: 0.22 },
    { x: 260, y: 74, scale: 0.72, speed: 0.18 },
    { x: 348, y: 206, scale: 1.05, speed: 0.16 },
  ];
  game.pipes = [];
  game.bird.y = 312;
  game.bird.velocity = 0;
  game.bird.rotation = 0;
  game.bird.wing = 0;

  for (let i = 0; i < 4; i += 1) {
    game.pipes.push(makePipe(WIDTH + 220 + i * PIPE_SPACING));
  }

  updateScore();
}

function makePipe(x) {
  const minTop = 96;
  const maxTop = HEIGHT - GROUND_HEIGHT - PIPE_GAP - 104;
  const gapY = minTop + Math.random() * (maxTop - minTop);
  return {
    x,
    gapY,
    passed: false,
    wobble: Math.random() * Math.PI * 2,
  };
}

function startGame() {
  if (state !== "playing") {
    resetGame();
    state = "playing";
    overlay.classList.add("hidden");
  }
  flap();
}

function flap() {
  if (state === "playing") {
    game.bird.velocity = FLAP_POWER;
    game.bird.wing = 1;
    beep(520, 0.045, "triangle", 0.05);
  }
}

function gameOver() {
  if (state !== "playing") return;
  state = "over";
  best = Math.max(best, game.score);
  localStorage.setItem(bestKey, String(best));
  updateScore();
  messageEl.textContent = `Score ${game.score}. Tap, click, or press Space to try again.`;
  startBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
  beep(160, 0.16, "sawtooth", 0.04);
}

function updateScore() {
  scoreEl.textContent = String(game.score);
  bestEl.textContent = String(best);
}

function ensureAudio() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audio.state === "suspended") {
    audio.resume();
  }
}

function beep(frequency, duration, type, volume) {
  if (muted) return;
  try {
    ensureAudio();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  } catch {
    muted = true;
  }
}

function tick(delta) {
  if (state !== "playing") {
    game.frame += delta * 0.45;
    draw();
    return;
  }

  game.frame += delta;
  game.groundX = (game.groundX - PIPE_SPEED * delta) % 48;

  for (const cloud of game.clouds) {
    cloud.x -= cloud.speed * delta;
    if (cloud.x < -150) {
      cloud.x = WIDTH + 80 + Math.random() * 120;
      cloud.y = 60 + Math.random() * 170;
    }
  }

  game.bird.velocity += GRAVITY * delta;
  game.bird.y += game.bird.velocity * delta;
  game.bird.rotation = Math.max(-0.55, Math.min(1.25, game.bird.velocity * 0.085));
  game.bird.wing = Math.max(0, game.bird.wing - 0.09 * delta);

  for (const pipe of game.pipes) {
    pipe.x -= PIPE_SPEED * delta;
    if (!pipe.passed && pipe.x + PIPE_WIDTH < game.bird.x - game.bird.radius) {
      pipe.passed = true;
      game.score += 1;
      updateScore();
      beep(790, 0.06, "square", 0.035);
    }
  }

  if (game.pipes[0].x < -PIPE_WIDTH - 16) {
    const last = game.pipes.at(-1);
    game.pipes.shift();
    game.pipes.push(makePipe(last.x + PIPE_SPACING));
  }

  if (collides()) {
    gameOver();
  }

  draw();
}

function collides() {
  const bird = game.bird;
  if (bird.y - bird.radius < 0 || bird.y + bird.radius > HEIGHT - GROUND_HEIGHT + 4) {
    return true;
  }

  for (const pipe of game.pipes) {
    const nearX = bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + PIPE_WIDTH;
    const outsideGap = bird.y - bird.radius < pipe.gapY || bird.y + bird.radius > pipe.gapY + PIPE_GAP;
    if (nearX && outsideGap) {
      return true;
    }
  }

  return false;
}

function draw() {
  drawSky();
  drawClouds();
  drawPipes();
  drawGround();
  drawBird();

  if (state === "ready") {
    drawReadyHint();
  }
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#6ad4ff");
  gradient.addColorStop(0.55, "#a7ecff");
  gradient.addColorStop(1, "#f8d36e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
  for (let i = 0; i < 8; i += 1) {
    const x = (i * 72 - (game.frame * 0.18) % 72) - 30;
    ctx.fillRect(x, 0, 18, HEIGHT - GROUND_HEIGHT);
  }
}

function drawClouds() {
  for (const cloud of game.clouds) {
    ctx.save();
    ctx.translate(cloud.x, cloud.y);
    ctx.scale(cloud.scale, cloud.scale);
    ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
    roundedBlob(0, 24, 116, 34, 17);
    circle(24, 21, 22);
    circle(52, 8, 28);
    circle(84, 20, 22);
    ctx.restore();
  }
}

function drawPipes() {
  for (const pipe of game.pipes) {
    const topHeight = pipe.gapY;
    const bottomY = pipe.gapY + PIPE_GAP;
    const bottomHeight = HEIGHT - GROUND_HEIGHT - bottomY;

    drawPipe(pipe.x, 0, topHeight, true);
    drawPipe(pipe.x, bottomY, bottomHeight, false);
  }
}

function drawPipe(x, y, height, top) {
  if (height <= 0) return;

  const capHeight = 30;
  const bodyX = x + 7;
  const bodyWidth = PIPE_WIDTH - 14;
  const capY = top ? y + height - capHeight : y;

  ctx.fillStyle = "#47bf4d";
  ctx.fillRect(bodyX, y, bodyWidth, height);

  const shine = ctx.createLinearGradient(bodyX, 0, bodyX + bodyWidth, 0);
  shine.addColorStop(0, "rgba(255,255,255,0.25)");
  shine.addColorStop(0.35, "rgba(255,255,255,0.05)");
  shine.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = shine;
  ctx.fillRect(bodyX, y, bodyWidth, height);

  ctx.fillStyle = "#2d8f33";
  ctx.fillRect(bodyX + bodyWidth - 8, y, 8, height);

  ctx.fillStyle = "#52d15a";
  ctx.fillRect(x, capY, PIPE_WIDTH, capHeight);
  ctx.fillStyle = "#2f9835";
  ctx.fillRect(x, capY + capHeight - 7, PIPE_WIDTH, 7);
  ctx.strokeStyle = "rgba(25, 48, 71, 0.34)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, capY + 1.5, PIPE_WIDTH - 3, capHeight - 3);
}

function drawGround() {
  const y = HEIGHT - GROUND_HEIGHT;
  ctx.fillStyle = "#eec65f";
  ctx.fillRect(0, y, WIDTH, GROUND_HEIGHT);
  ctx.fillStyle = "#d99a46";
  ctx.fillRect(0, y, WIDTH, 12);

  for (let x = game.groundX - 48; x < WIDTH + 48; x += 48) {
    ctx.fillStyle = "#f7dd83";
    ctx.fillRect(x, y + 16, 24, 10);
    ctx.fillStyle = "#ca8841";
    ctx.fillRect(x + 18, y + 54, 22, 8);
  }

  ctx.fillStyle = "#77c44f";
  ctx.fillRect(0, y - 16, WIDTH, 16);
  ctx.fillStyle = "#5aa63e";
  for (let x = game.groundX - 36; x < WIDTH + 36; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12, y - 16);
    ctx.lineTo(x + 24, y);
    ctx.fill();
  }
}

function drawBird() {
  const bird = game.bird;
  const bob = state === "ready" ? Math.sin(game.frame * 0.08) * 7 : 0;
  const wingLift = Math.sin(game.frame * 0.32) * 4 - bird.wing * 14;

  ctx.save();
  ctx.translate(bird.x, bird.y + bob);
  ctx.rotate(bird.rotation);

  ctx.fillStyle = "#f6c445";
  ellipse(-8, 2, 27, 21, 0);
  ctx.fillStyle = "#ffe56b";
  ellipse(-2, -2, 24, 19, 0);

  ctx.fillStyle = "#f39b38";
  ellipse(-13, 8 + wingLift, 17, 10, -0.45);
  ctx.strokeStyle = "#d67424";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-24, 10 + wingLift);
  ctx.quadraticCurveTo(-13, 19 + wingLift, 0, 8 + wingLift);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  circle(13, -10, 10);
  ctx.fillStyle = "#1b3047";
  circle(16, -9, 4);

  ctx.fillStyle = "#f46b35";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(40, 7);
  ctx.lineTo(18, 14);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#bb4d22";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 7);
  ctx.lineTo(37, 7);
  ctx.stroke();

  ctx.restore();
}

function drawReadyHint() {
  ctx.save();
  ctx.globalAlpha = 0.74;
  ctx.fillStyle = "#193047";
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Tap to flap", WIDTH / 2, 508);
  ctx.restore();
}

function roundedBlob(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function circle(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(x, y, radiusX, radiusY, rotation) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  ctx.fill();
}

function handlePrimaryAction(event) {
  event.preventDefault();
  ensureAudio();
  if (state === "playing") {
    flap();
  } else {
    startGame();
  }
}

function animate(time) {
  const delta = Math.min(2.2, (time - lastTime) / 16.666 || 1);
  lastTime = time;
  tick(delta);
  requestAnimationFrame(animate);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    handlePrimaryAction(event);
  }
});

canvas.addEventListener("pointerdown", handlePrimaryAction);
startBtn.addEventListener("click", handlePrimaryAction);
restartBtn.addEventListener("click", (event) => {
  event.preventDefault();
  resetGame();
  state = "ready";
  startBtn.textContent = "Start";
  messageEl.textContent = "Tap, click, or press Space to flap.";
  overlay.classList.remove("hidden");
});
muteBtn.addEventListener("click", () => {
  muted = !muted;
  muteBtn.textContent = muted ? "Sound Off" : "Sound On";
  muteBtn.setAttribute("aria-pressed", String(muted));
});

resetGame();
updateScore();
requestAnimationFrame(animate);
