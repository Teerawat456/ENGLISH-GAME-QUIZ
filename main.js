/* ===============================
   GLOBAL STATE
================================ */
let playerHP, playerATK;
let playerMaxHP;
let enemyHP, enemyATK;
let score = 0;
let questionPool = [];
let currentDifficulty = "";

// Boss BGM state
let bossBGM = [];
let _bossBGMIndex = -1;
let _wasPageBgmPlaying = false;
// Boss rage state
let bossRage = false;
let _bossRageTimer = null;

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
      const next = ds.style.display === 'flex' ? 'none' : 'flex';
      ds.style.display = next;
      try { localStorage.setItem('difficultyOpen', next === 'flex' ? '1' : '0'); } catch (e) {}
    };
    // keyboard (enter/space) to toggle
    origPanel.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); origPanel.click(); } });
  }

  // Boss mode
  if (ui.bossBtn) ui.bossBtn.onclick = startBossMode;
  // keyboard for boss card
  const bossPanel = document.getElementById('boss-panel');
  if (bossPanel) bossPanel.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ui.bossBtn && ui.bossBtn.click(); } });
  // Back to lobby button (menu)
  try {
    const back = document.getElementById('back-lobby-btn');
    if (back) {
      back.addEventListener('click', (ev) => { ev.preventDefault(); try { resetGame(); } catch (e) {} });
    }
  } catch (e) {}

  // restore difficulty panel open state if user left it open
  try {
    const ds = document.getElementById('difficulty-select');
    if (ds) {
      const was = localStorage.getItem('difficultyOpen');
      if (was === '1') ds.style.display = 'flex';
    }
  } catch (e) {}
});

/* ===============================
   START ORIGINAL MODE
================================ */
function startOriginalMode(diff) {
  let pool;

  if (diff === "Easy") {
    playerMaxHP = 150; playerHP = playerMaxHP; playerATK = 18;
    enemyHP = 100; enemyATK = 10;
    pool = easyQuestions;
  }
  else if (diff === "Normal") {
    playerMaxHP = 150; playerHP = playerMaxHP; playerATK = 15;
    enemyHP = 120; enemyATK = 20;
    pool = normalQuestions;
  }
  else if (diff === "Hard") {
    playerMaxHP = 150; playerHP = playerMaxHP; playerATK = 12;
    enemyHP = 150; enemyATK = 28;
    pool = hardQuestions;
  }
  else if (diff === "Lunatic") {
    playerMaxHP = 150; playerHP = playerMaxHP; playerATK = 10;
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
  playerMaxHP = 300;
  playerHP = playerMaxHP;
  playerATK = 500;
  enemyHP = 37000;
  enemyATK = 125;

  // reset boss rage state when starting boss mode
  bossRage = false;
  if (_bossRageTimer) { clearTimeout(_bossRageTimer); _bossRageTimer = null; }
  try { if (ui && ui.combatStatus) ui.combatStatus.style.display = 'none'; if (ui && ui.bossTopBar) ui.bossTopBar.classList.remove('rage'); } catch(e) {}

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
  // animate transition to game UI
  try { showGameUI(); } catch (e) { ui.lobby.style.display = "none"; ui.gameUI.style.display = "block"; }

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
      try {
        if (ui.bossTopBar) {
          ui.bossTopBar.style.display = 'block';
          ui.bossTopBar.dataset.max = enemyHP;
          try { ui.bossTopBar.dataset.phase = 0; } catch(e) {}
          // create visual phase ticks for boss top bar
          try { createBossPhaseTicks(parseInt(enemyHP) || 37000); } catch(e) {}
        }
      } catch (e) {}
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

  ui.playerHPBar.dataset.max = playerMaxHP;
  ui.enemyHPBar.dataset.max = enemyHP;

  // combat-status HUD intentionally left hidden to avoid duplicate HP displays

  updateHP();
  updateScore();
  ui.log.textContent = "";

  askQuestion();
}

/* ===============================
   UI TRANSITIONS
================================ */
function showGameUI() {
  const dur = 260;
  try {
    if (ui.lobby) { ui.lobby.classList.add('fade'); ui.lobby.classList.remove('fade-in'); ui.lobby.classList.add('fade-out'); }
    setTimeout(() => {
      try { if (ui.lobby) ui.lobby.style.display = 'none'; if (ui.gameUI) { ui.gameUI.style.display = 'block'; ui.gameUI.classList.add('fade','fade-in'); ui.gameUI.classList.remove('fade-out'); ui.gameUI.scrollIntoView({behavior:'auto'}); } } catch (e) {}
    }, dur);
  } catch (e) {}
}

function showLobbyUI() {
  const dur = 240;
  try {
    if (ui.gameUI) { ui.gameUI.classList.add('fade'); ui.gameUI.classList.remove('fade-in'); ui.gameUI.classList.add('fade-out'); }
    setTimeout(() => {
      try { if (ui.gameUI) ui.gameUI.style.display = 'none'; if (ui.lobby) { ui.lobby.style.display = ''; ui.lobby.classList.add('fade','fade-in'); ui.lobby.classList.remove('fade-out'); ui.lobby.scrollIntoView({behavior:'auto'}); } } catch (e) {}
    }, dur);
  } catch (e) {}
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
    // Restore 15% of max HP on correct answer
    try {
      const heal = Math.round((playerMaxHP || 0) * 0.15);
      playerHP = Math.min((playerHP || 0) + heal, playerMaxHP || playerHP || 0);
      ui.log.textContent = `✅ ถูกต้อง! โจมตี ${playerATK} • ฟื้นฟู HP +${heal}`;
    } catch (e) {
      ui.log.textContent = `✅ ถูกต้อง! โจมตี ${playerATK}`;
    }
  } else {
    // Wrong answer handling
    if (currentDifficulty === 'Boss') {
      // If boss is already enraged -> instant death
      if (bossRage) {
        playerHP = 0;
        ui.log.textContent = `❌ ผิด! ตายทันที!`;
        try { if (ui && ui.combatStatus) { ui.combatStatus.style.display = 'block'; ui.combatStatus.textContent = 'BOSS RAGE! ตอบผิด = ตายทันที!'; } if (ui && ui.bossTopBar) ui.bossTopBar.classList.add('rage'); } catch(e) {}
      } else {
        // normal damage (no heal)
        playerHP -= enemyATK;
        ui.log.textContent = `❌ ผิด! โดนโจมตี ${enemyATK}`;
      }
    } else {
      // non-boss modes: normal damage
      playerHP -= enemyATK;
      ui.log.textContent = `❌ ผิด! โดนโจมตี ${enemyATK}`;
    }
  }

  clampHP();
  updateHP();
  updateScore();

  // Boss may enter Rage on its turn (random 15%) — attempt after resolving this turn
  try { if (currentDifficulty === 'Boss' && enemyHP > 0 && playerHP > 0) attemptBossRage(); } catch(e) {}

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
          // expose current phase index on boss top bar for segmented UI
          try { if (ui && ui.bossTopBar) ui.bossTopBar.dataset.phase = idx; } catch(e) {}
          // update phase ticks visual state
          try { const maxVal = parseInt(ui.bossTopBar && ui.bossTopBar.dataset && ui.bossTopBar.dataset.max) || eMax; updateBossPhaseTicks(enemyHP, maxVal); } catch(e) {}
          // boss-player-hp element removed from DOM; single player HP shown in player-hp-bar
        } catch (e) {}
      }
    } catch (e) {}
  } catch (e) {}
}

function updateScore() {
  ui.scoreText.textContent = score;
}

// Attempt to enter boss rage on boss turn (15% chance). Only when not already enraged.
function attemptBossRage() {
  try {
    if (currentDifficulty !== 'Boss' || bossRage) return;
    if (enemyHP <= 0) return;
    const roll = Math.random();
    if (roll < 0.15) {
      bossRage = true;
      try {
        if (ui && ui.combatStatus) { ui.combatStatus.style.display = 'block'; ui.combatStatus.textContent = 'BOSS RAGE! ตอบผิด = ตายทันที!'; }
        if (ui && ui.bossTopBar) ui.bossTopBar.classList.add('rage');
      } catch (e) {}
      _bossRageTimer = setTimeout(() => {
        try { bossRage = false; _bossRageTimer = null; if (ui && ui.combatStatus) ui.combatStatus.style.display = 'none'; if (ui && ui.bossTopBar) ui.bossTopBar.classList.remove('rage'); } catch(e) {}
      }, 10000);
    }
  } catch (e) {}
}

function disableChoices() {
  document.querySelectorAll("#answerButtons button")
    .forEach(b => b.disabled = true);
}

function clampHP() {
  playerHP = Math.max(0, playerHP);
  enemyHP = Math.max(0, enemyHP);
}

// Create phase tick markers inside the boss top bar.
// thresholdsPercent is array of percentages (from left) where next phase starts (e.g. 75,50,25).
function createBossPhaseTicks(maxHP) {
  try {
    if (!ui || !ui.bossTopBar) return;
    const container = ui.bossTopBar.querySelector('.phase-ticks');
    if (!container) return;
    container.innerHTML = '';
    // Next-phase thresholds: when HP falls to 75%,50%,25% the boss advances phases
    const thresholds = [75,50,25];
    thresholds.forEach(pct => {
      const t = document.createElement('div');
      t.className = 'tick';
      t.dataset.threshold = pct; // percent remaining
      t.style.left = pct + '%';
      container.appendChild(t);
    });
  } catch (e) {}
}

function updateBossPhaseTicks(currentHP, maxHP) {
  try {
    if (!ui || !ui.bossTopBar) return;
    const container = ui.bossTopBar.querySelector('.phase-ticks');
    if (!container) return;
    const ticks = Array.from(container.querySelectorAll('.tick'));
    ticks.forEach(t => {
      const pct = parseFloat(t.dataset.threshold) || 0;
      const thresholdVal = Math.round((pct/100) * maxHP);
      // mark passed when enemy HP is <= thresholdVal
      if (currentHP <= thresholdVal) t.classList.add('passed'); else t.classList.remove('passed');
    });
  } catch (e) {}
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
    // animate back to lobby
    try { if (ui && ui.gameUI) ui.gameUI.classList.remove('centered-ui'); } catch (e) {}
    try { showLobbyUI(); } catch (e) { if (ui && ui.gameUI) { ui.gameUI.style.display = 'none'; } if (ui && ui.lobby) ui.lobby.style.display = ''; }
  } catch (e) {}

  // reset runtime state
  try {
    playerHP = 0; enemyHP = 0; score = 0; questionPool = [];
    currentDifficulty = "";
    bossRage = false;
    if (_bossRageTimer) { clearTimeout(_bossRageTimer); _bossRageTimer = null; }
    try { if (ui && ui.combatStatus) ui.combatStatus.style.display = 'none'; if (ui && ui.bossTopBar) ui.bossTopBar.classList.remove('rage'); } catch(e) {}
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
