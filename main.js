/* ===============================
   GLOBAL STATE
================================ */
let playerHP, playerATK;
let enemyHP, enemyATK;
let score = 0;
let questionPool = [];
let currentDifficulty = "";

// Boss BGM state
let bossBGM = [];
let _bossBGMIndex = -1;
let _wasPageBgmPlaying = false;

/* ===============================
   UI ELEMENTS
================================ */
const ui = {};

/* ===============================
   DOM READY
================================ */
document.addEventListener("DOMContentLoaded", () => {
  // populate UI refs now DOM is ready
  ui.gameUI = document.getElementById('game-ui');
  ui.lobby = document.getElementById('lobby-wrap');
  ui.playerHPBar = document.getElementById('player-hp-bar');
  ui.enemyHPBar = document.getElementById('enemy-hp-bar');
  ui.bossTopBar = document.getElementById('boss-top-bar');
  ui.bossTopFill = document.querySelector('#boss-top-bar .hp-bar-fill');
  ui.bossTopText = document.querySelector('#boss-top-bar .hp-bar-text');
  ui.combatStatus = document.getElementById('combat-status');
  ui.questionText = document.getElementById('question-text');
  ui.answerButtons = document.getElementById('answerButtons') || document.getElementById('choices');
  ui.scoreText = document.getElementById('score');
  ui.log = document.getElementById('log');
  ui.bossBtn = document.getElementById('boss-mode-btn');

  if (ui.gameUI) ui.gameUI.style.display = "none";

  // Original mode buttons
  document.querySelectorAll("#difficulty-select button").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      startOriginalMode(btn.dataset.diff);
    };
  });

  // Toggle difficulty selection when clicking the Original panel
  const origPanel = document.getElementById('original-panel');
  if (origPanel) {
    origPanel.onclick = function(e) {
      // don't toggle when clicking a difficulty button
      if (e.target && e.target.closest && e.target.closest('#difficulty-select')) return;
      const ds = document.getElementById('difficulty-select');
      if (!ds) return;
      ds.style.display = ds.style.display === 'flex' ? 'none' : 'flex';
    };
  }

  // Boss mode
  if (ui.bossBtn) ui.bossBtn.onclick = startBossMode;
  // Back to lobby button (menu)
  try {
    const back = document.getElementById('back-lobby-btn');
    if (back) {
      back.addEventListener('click', (ev) => { ev.preventDefault(); try { resetGame(); } catch (e) {} });
    }
  } catch (e) {}
});

/* ===============================
   START ORIGINAL MODE
================================ */
function startOriginalMode(diff) {
  let pool;

  if (diff === "Easy") {
    playerHP = 150; playerATK = 18;
    enemyHP = 100; enemyATK = 10;
    pool = easyQuestions;
  }
  else if (diff === "Normal") {
    playerHP = 150; playerATK = 15;
    enemyHP = 120; enemyATK = 20;
    pool = normalQuestions;
  }
  else if (diff === "Hard") {
    playerHP = 150; playerATK = 12;
    enemyHP = 150; enemyATK = 28;
    pool = hardQuestions;
  }
  else if (diff === "Lunatic") {
    playerHP = 150; playerATK = 10;
    enemyHP = 180; enemyATK = 50;
    pool = lunaticQuestions;
  }

  if (!pool || pool.length === 0) {
    alert("❌ ไม่พบคำถามของโหมดนี้");
    return;
  }

  currentDifficulty = diff;
  startGame(pool);
}

/* ===============================
   START BOSS MODE
================================ */
function startBossMode() {
  playerHP = 300;
  playerATK = 125;
  enemyHP = 37000;
  enemyATK = 125;

  currentDifficulty = "Boss";

  if (!lunaticQuestions || lunaticQuestions.length === 0) {
    alert("❌ lunaticQuestions ไม่ถูกโหลด");
    return;
  }

  startGame(lunaticQuestions);
}

/* ===============================
   START GAME (COMMON)
================================ */
function startGame(pool) {
  score = 0;
  questionPool = [...pool];
  ui.lobby.style.display = "none";
  ui.gameUI.style.display = "block";

  // If boss mode, start boss BGM; else ensure boss BGM stopped and page BGM plays
  try {
    if (currentDifficulty === 'Boss') {
      // pause page bgm if playing
      const pageBgm = document.getElementById('bgm');
      if (pageBgm) {
        _wasPageBgmPlaying = !pageBgm.paused;
        try { pageBgm.pause(); } catch (e) {}
      }
      ensureBossBGM();
      playBossPhase(0);
      try { if (ui.bossTopBar) { ui.bossTopBar.style.display = 'block'; ui.bossTopBar.dataset.max = enemyHP; } } catch (e) {}
      // hide small enemy HP box during boss mode
      try { const eb = ui.enemyHPBar && ui.enemyHPBar.closest ? ui.enemyHPBar.closest('.hp-box') : null; if (eb) eb.style.display = 'none'; } catch (e) {}
    } else {
      // not boss: stop boss bgm and play page bgm
      stopBossBGM();
      try { if (ui.bossTopBar) ui.bossTopBar.style.display = 'none'; } catch (e) {}
      // show small enemy HP box for non-boss modes
      try { const eb = ui.enemyHPBar && ui.enemyHPBar.closest ? ui.enemyHPBar.closest('.hp-box') : null; if (eb) eb.style.display = ''; } catch (e) {}
      try { const pageBgm = document.getElementById('bgm'); if (pageBgm) pageBgm.play().catch(()=>{}); } catch (e) {}
    }
  } catch (e) {}
  // center the game UI with the nightmare style
  try { ui.gameUI.classList.add('centered-ui'); } catch (e) {}

  ui.playerHPBar.dataset.max = playerHP;
  ui.enemyHPBar.dataset.max = enemyHP;

  // combat-status HUD intentionally left hidden to avoid duplicate HP displays

  updateHP();
  updateScore();
  ui.log.textContent = "";

  askQuestion();
}

/* ===============================
   QUESTION SYSTEM
================================ */
function askQuestion() {
  if (questionPool.length === 0) {
    questionPool = [...(
      currentDifficulty === "Easy" ? easyQuestions :
      currentDifficulty === "Normal" ? normalQuestions :
      currentDifficulty === "Hard" ? hardQuestions :
      lunaticQuestions
    )];
  }

  const q = questionPool.splice(
    Math.floor(Math.random() * questionPool.length), 1
  )[0];

  ui.questionText.textContent = "❓ " + q.question;
  if (ui.answerButtons) ui.answerButtons.innerHTML = "";

  shuffle(q.choices).forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.className = "btn";
    btn.onclick = () => checkAnswer(choice, q.correct);
    if (ui.answerButtons) ui.answerButtons.appendChild(btn);
  });
}

/* ===============================
   CHECK ANSWER
================================ */
function checkAnswer(choice, correct) {
  disableChoices();

  if (choice === correct) {
    enemyHP -= playerATK;
    score += scoreByDifficulty();
    ui.log.textContent = `✅ ถูกต้อง! โจมตี ${playerATK}`;
  } else {
    playerHP -= enemyATK;
    ui.log.textContent = `❌ ผิด! โดนโจมตี ${enemyATK}`;
  }

  clampHP();
  updateHP();
  updateScore();

  if (playerHP <= 0 || enemyHP <= 0) {
    endGame();
  } else {
    setTimeout(askQuestion, 900);
  }
}

/* ===============================
   END GAME
================================ */
function endGame() {
  if (ui.answerButtons) ui.answerButtons.innerHTML = "";
  if (ui.questionText) ui.questionText.textContent = playerHP > 0 ? "🎉 YOU WIN!" : "💀 GAME OVER";
}

/* ===============================
   UI HELPERS
================================ */
function updateHP() {
  try {
    const pFill = ui.playerHPBar.querySelector('.hp-bar-fill');
    const eFill = ui.enemyHPBar.querySelector('.hp-bar-fill');
    if (pFill) pFill.style.width = (playerHP / ui.playerHPBar.dataset.max) * 100 + "%";
    if (eFill) eFill.style.width = (enemyHP / ui.enemyHPBar.dataset.max) * 100 + "%";
    const pText = ui.playerHPBar.querySelector('.hp-bar-text');
    const eText = ui.enemyHPBar.querySelector('.hp-bar-text');
    if (pText) pText.textContent = `${playerHP} / ${ui.playerHPBar.dataset.max}`;
    if (eText) eText.textContent = `${enemyHP} / ${ui.enemyHPBar.dataset.max}`;
    // Do not update the compact combat-status HUD to avoid duplicate HP text
    // Boss phase music switching every 25% lost
    try {
      if (currentDifficulty === 'Boss' && ui.enemyHPBar && ui.enemyHPBar.dataset.max) {
        const eMax = parseInt(ui.enemyHPBar.dataset.max) || 1;
        const lostPercent = Math.round(((eMax - Math.max(0, enemyHP)) / eMax) * 100);
        const idx = Math.min(3, Math.floor(lostPercent / 25));
        playBossPhase(idx);
        // no lower-phase info (we use the large top bar)
        // update large boss top bar and phase label if present
        try {
          if (ui.bossTopBar && ui.bossTopFill && ui.bossTopText) {
            const maxVal = parseInt(ui.bossTopBar.dataset.max) || eMax;
            const pct = Math.max(0, Math.min(100, Math.round((enemyHP / maxVal) * 100)));
            ui.bossTopFill.style.width = pct + "%";
            ui.bossTopText.textContent = `${enemyHP} / ${maxVal} (${pct}%)`;
          }
          const topPhase = document.getElementById('boss-phase-top');
          if (topPhase) topPhase.textContent = `${idx+1}/4`;
          // boss-player-hp element removed from DOM; single player HP shown in player-hp-bar
        } catch (e) {}
      }
    } catch (e) {}
  } catch (e) {}
}

function updateScore() {
  ui.scoreText.textContent = score;
}

function disableChoices() {
  document.querySelectorAll("#answerButtons button")
    .forEach(b => b.disabled = true);
}

function clampHP() {
  playerHP = Math.max(0, playerHP);
  enemyHP = Math.max(0, enemyHP);
}

function scoreByDifficulty() {
  return {
    Easy: 2,
    Normal: 5,
    Hard: 8,
    Lunatic: 10,
    Boss: 20
  }[currentDifficulty] || 2;
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

/* ===============================
   BOSS BGM HELPERS
================================ */
function ensureBossBGM() {
  if (bossBGM && bossBGM.length) return;
  const files = [
    'audio/Able Phase 1.mp3',
    'audio/Able Phase 2.mp3',
    'audio/Able Phase 3.mp3',
    'audio/Able Last Phase.mp3'
  ];
  bossBGM = files.map(src => {
    try {
      const a = new Audio(src);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0.7;
      return a;
    } catch (e) { return null; }
  }).filter(Boolean);
  _bossBGMIndex = -1;
}

function playBossPhase(index) {
  try {
    ensureBossBGM();
    index = Math.max(0, Math.min(index, bossBGM.length - 1));
    if (_bossBGMIndex === index) return;
    // pause previous
    if (_bossBGMIndex >= 0 && bossBGM[_bossBGMIndex]) {
      try { bossBGM[_bossBGMIndex].pause(); bossBGM[_bossBGMIndex].currentTime = 0; } catch (e) {}
    }
    _bossBGMIndex = index;
    try { bossBGM[index].play().catch(()=>{}); } catch (e) {}
    // ensure page bgm paused
    try { const page = document.getElementById('bgm'); if (page && !page.paused) { _wasPageBgmPlaying = true; page.pause(); } } catch (e) {}
  } catch (e) {}
}

function stopBossBGM() {
  try {
    if (bossBGM && bossBGM.length) {
      bossBGM.forEach(a => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
    }
    _bossBGMIndex = -1;
    // resume page bgm if it was playing
    try { const page = document.getElementById('bgm'); if (page && _wasPageBgmPlaying) { page.play().catch(()=>{}); } _wasPageBgmPlaying = false; } catch (e) {}
  } catch (e) {}
}

/* ===============================
   RESET / BACK TO LOBBY
================================ */
function resetGame() {
  try {
    stopBossBGM();
  } catch (e) {}

  try {
    // stop page bgm briefly and reset position, then attempt to play for lobby
    const page = document.getElementById('bgm');
    if (page) { try { page.pause(); page.currentTime = 0; } catch (e) {} }
  } catch (e) {}

  try {
    if (ui && ui.gameUI) {
      ui.gameUI.style.display = 'none';
      ui.gameUI.classList.remove('centered-ui');
    }
    // restore lobby display to its original state (use empty string to avoid forcing layout)
    try { if (ui && ui.lobby) ui.lobby.style.display = ''; } catch (e) {}
  } catch (e) {}

  // reset runtime state
  try {
    playerHP = 0; enemyHP = 0; score = 0; questionPool = [];
    currentDifficulty = "";
    updateScore();
    if (ui && ui.answerButtons) ui.answerButtons.innerHTML = "";
    if (ui && ui.questionText) ui.questionText.textContent = "Question";
    if (ui && ui.log) ui.log.textContent = "";
    if (ui && ui.bossTopBar) ui.bossTopBar.style.display = 'none';
    // ensure small enemy hp box visible again
    try { const eb = ui.enemyHPBar && ui.enemyHPBar.closest ? ui.enemyHPBar.closest('.hp-box') : null; if (eb) eb.style.display = ''; } catch (e) {}
  } catch (e) {}

  // Do NOT autoplay lobby BGM — leave it paused per requirement
  try { const pageBgm = document.getElementById('bgm'); if (pageBgm) { try { pageBgm.pause(); pageBgm.currentTime = 0; } catch (e) {} } } catch (e) {}
}
