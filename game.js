// Game State
let timer = 240; // 4 minutes in seconds
let timerInterval;
let strikes = 0;
const MAX_STRIKES = 3;

let gameActive = true;

// Modules state
let modules = {
    wires: { solved: false },
    symbols: { solved: false },
    keypad: { solved: false }
};

// --- DATA & GENERATION --- //

// Wires Module
const wireColorsPool = [
    { id: 'red', hex: '#f85149' },
    { id: 'blue', hex: '#58a6ff' },
    { id: 'white', hex: '#f0f6fc' },
    { id: 'yellow', hex: '#e3b341' },
    { id: 'green', hex: '#3fb950' }
];
let currentWires = [];
let correctWireIndex = -1;

// Symbols Module
const symbolsPool = ['🔥', '💧', '⚡', '🧊'];
let accessId = '';
let currentSymbols = [];
let expectedSymbolSequence = [];
let currentSymbolProgress = 0;

// Keypad Module
let currentGate = '';
let expectedCode = '';
let currentInput = '';

// Audio context (optional, simple beeps)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(frequency, type, duration) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    oscillator.stop(audioCtx.currentTime + duration);
}

// --- INITIALIZATION --- //

function initGame() {
    generateFlightData();
    generateWires();
    generateSymbols();
    
    updateDisplay();
    startTimer();
}

function generateFlightData() {
    // Random ID (ID-XXX)
    const accessDigits = Math.floor(Math.random() * 900) + 100;
    accessId = `ID-${accessDigits}`;
    document.getElementById('access-id').innerText = accessId;

    // Random Sector (A, B, C, D) + (1-9)
    const gates = ['A', 'B', 'C', 'D'];
    const randomGateLetter = gates[Math.floor(Math.random() * gates.length)];
    const randomGateNum = Math.floor(Math.random() * 9) + 1;
    currentGate = `${randomGateLetter}${randomGateNum}`;
    document.getElementById('sector-id').innerText = currentGate;

    // Set expected Keypad Code based on Manual Rules
    if (randomGateLetter === 'A' || randomGateLetter === 'B') {
        expectedCode = '1969';
    } else if (randomGateLetter === 'C') {
        expectedCode = '8848';
    } else if (randomGateLetter === 'D') {
        expectedCode = '0366';
    }
}

// --- WIRES MODULE --- //

function generateWires() {
    // Pick 4 random colors
    let shuffledColors = [...wireColorsPool].sort(() => 0.5 - Math.random());
    currentWires = shuffledColors.slice(0, 4);

    const container = document.getElementById('wires-container');
    container.innerHTML = '';

    currentWires.forEach((wire, index) => {
        const row = document.createElement('div');
        row.className = 'wire-row';
        row.innerHTML = `<div class="wire-block" style="background-color: ${wire.hex}" onclick="cutWire(${index}, this)"></div>`;
        container.appendChild(row);
    });

    determineCorrectWire();
}

function determineCorrectWire() {
    const hasColor = (color) => currentWires.filter(w => w.id === color).length;
    
    // Rule 1: Exactly 1 Red and 1 Green -> Cut Green
    if (hasColor('red') === 1 && hasColor('green') === 1) {
        correctWireIndex = currentWires.findIndex(w => w.id === 'green');
    }
    // Rule 2: Last is White -> Cut White
    else if (currentWires[3].id === 'white') {
        correctWireIndex = 3;
    }
    // Rule 3: Any Yellow -> Cut First
    else if (hasColor('yellow') > 0) {
        correctWireIndex = 0;
    }
    // Rule 4: Otherwise -> Cut Blue
    else {
        // If there's no blue, fallback to last
        const blueIdx = currentWires.findIndex(w => w.id === 'blue');
        correctWireIndex = blueIdx !== -1 ? blueIdx : 3; 
    }
}

window.cutWire = function(index, element) {
    if (!gameActive || modules.wires.solved) return;

    element.classList.add('wire-cut');
    
    if (index === correctWireIndex) {
        solveModule('wires');
        playBeep(800, 'sine', 0.3);
    } else {
        addStrike();
        playBeep(200, 'sawtooth', 0.5);
    }
};

// --- SYMBOLS MODULE --- //

function generateSymbols() {
    currentSymbols = [...symbolsPool].sort(() => 0.5 - Math.random());
    
    const container = document.getElementById('symbols-container');
    container.innerHTML = '';

    currentSymbols.forEach((symbol) => {
        const btn = document.createElement('button');
        btn.className = 'symbol-btn';
        btn.innerText = symbol;
        btn.onclick = () => pressSymbol(symbol, btn);
        container.appendChild(btn);
    });

    // Determine expected sequence based on Manual Rule
    const lastDigit = parseInt(accessId.slice(-1));
    if (lastDigit % 2 === 0) { // EVEN
        expectedSymbolSequence = ['🔥', '💧', '⚡', '🧊'];
    } else { // ODD
        expectedSymbolSequence = ['🧊', '⚡', '🔥', '💧'];
    }
}

window.pressSymbol = function(symbol, element) {
    if (!gameActive || modules.symbols.solved) return;

    if (symbol === expectedSymbolSequence[currentSymbolProgress]) {
        element.classList.add('pressed');
        currentSymbolProgress++;
        playBeep(600 + (currentSymbolProgress * 100), 'sine', 0.1);

        if (currentSymbolProgress === expectedSymbolSequence.length) {
            solveModule('symbols');
        }
    } else {
        addStrike();
        playBeep(200, 'sawtooth', 0.5);
        // Reset sequence
        currentSymbolProgress = 0;
        document.querySelectorAll('.symbol-btn').forEach(btn => btn.classList.remove('pressed'));
    }
}

// --- KEYPAD MODULE --- //

window.pressKey = function(key) {
    if (!gameActive || modules.keypad.solved) return;

    if (key === 'C') {
        currentInput = '';
    } else {
        if (currentInput.length < 4) {
            currentInput += key;
            playBeep(500, 'sine', 0.1);
        }
    }
    updateKeypadDisplay();
}

window.submitCode = function() {
    if (!gameActive || modules.keypad.solved) return;

    if (currentInput === expectedCode) {
        solveModule('keypad');
        playBeep(800, 'sine', 0.4);
    } else {
        addStrike();
        playBeep(200, 'sawtooth', 0.5);
        currentInput = '';
        updateKeypadDisplay();
    }
}

function updateKeypadDisplay() {
    const display = document.getElementById('keypad-display');
    if (modules.keypad.solved) {
        display.innerText = 'BIEN';
        display.style.color = 'var(--term-green)';
    } else {
        display.innerText = currentInput.padEnd(4, '-');
    }
}


// --- CORE LOGIC --- //

function solveModule(moduleId) {
    modules[moduleId].solved = true;
    document.getElementById(`status-${moduleId}`).innerText = '🟢';
    
    // Check win condition
    if (Object.values(modules).every(m => m.solved)) {
        winGame();
    }
}

function addStrike() {
    strikes++;
    document.getElementById('strikes').innerText = `${strikes} / ${MAX_STRIKES}`;
    
    // Flash screen red
    document.body.style.backgroundColor = 'var(--term-red)';
    setTimeout(() => {
        document.body.style.backgroundColor = 'var(--term-bg)';
    }, 150);

    if (strikes >= MAX_STRIKES) {
        loseGame("Demasiados errores.");
    }
}

function updateDisplay() {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    document.getElementById('timer').innerText = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startTimer() {
    timerInterval = setInterval(() => {
        timer--;
        updateDisplay();

        if (timer <= 0) {
            loseGame("Se acabó el tiempo.");
        }
    }, 1000);
}

function loseGame(reason) {
    gameActive = false;
    clearInterval(timerInterval);
    const screen = document.getElementById('game-over-screen');
    const msg = document.getElementById('game-over-msg');
    
    screen.classList.remove('hidden');
    msg.innerText = `${reason} Bóveda sellada permanentemente.`;
}

function winGame() {
    gameActive = false;
    clearInterval(timerInterval);
    
    const screen = document.getElementById('game-over-screen');
    const title = document.getElementById('game-over-title');
    const msg = document.getElementById('game-over-msg');
    
    screen.classList.remove('hidden');
    
    // THE SURPRISE TWIST
    title.innerText = "¡BÓVEDA ABIERTA!";
    title.classList.add('win-title');
    msg.innerText = "Desbloqueando y extrayendo el contenido...";
    
    // Revelar el premio después de unos segundos de "extracción"
    setTimeout(() => {
        title.innerText = "¡SORPRESA!";
        msg.innerHTML = "¡LA VERDADERA RECOMPENSA SON UNOS<br><strong style='font-size:1.5rem; color:var(--term-green);'>PASAJES A CHILE!</strong> 🇨🇱✈️<br>¡Preparen sus maletas!";
    }, 3500);
}

// Start
window.onload = initGame;