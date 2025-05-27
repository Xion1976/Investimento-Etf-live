const express = require('express');
const path = require('path');
const dbModule = require('./database');
const db = dbModule.getDb();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configurazione Simulazione (Valori del tuo progetto) ---
const initialCapital = 10000;
const targetValue = 15000;
const simulationMonths = 5;
const simulationDays = simulationMonths * (365.25 / 12); // ~152.1875 giorni

const secondsInADay = 24 * 60 * 60;

const targetDailyRate = Math.pow(targetValue / initialCapital, 1 / simulationDays) - 1;
const targetPerSecondRate = Math.pow(1 + targetDailyRate, 1 / secondsInADay) - 1;

const noiseFactor = 0.000005; 

let etfState = {
    currentValue: initialCapital,
    simulatedDayCounter: 0,
    lastUpdatedTimestamp: Date.now() 
};

// --- Funzioni per il Database ---
function loadEtfStateFromDb() {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM etf_state ORDER BY id DESC LIMIT 1", [], (err, row) => {
            if (err) {
                console.error("Errore nel caricamento stato dal DB:", err.message);
                reject(err);
            } else if (row) {
                etfState = {
                    currentValue: row.currentValue,
                    simulatedDayCounter: row.simulatedDayCounter,
                    lastUpdatedTimestamp: row.lastUpdatedTimestamp
                };
                console.log("Stato ETF caricato dal database:", etfState);
                resolve(true);
            } else {
                console.log("Nessuno stato trovato nel database, inizializzo.");
                saveEtfStateToDb(initialCapital, 0, Date.now()).then(() => {
                    etfState = { currentValue: initialCapital, simulatedDayCounter: 0, lastUpdatedTimestamp: Date.now() };
                    resolve(false); 
                }).catch(reject);
            }
        });
    });
}

function saveEtfStateToDb(value, dayCounter, timestamp) {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO etf_state (currentValue, simulatedDayCounter, lastUpdatedTimestamp) VALUES (?, ?, ?)",
            [value, dayCounter, timestamp],
            function(err) {
                if (err) {
                    console.error("Errore nel salvataggio stato nel DB:", err.message);
                    reject(err);
                } else {
                    console.log(`Stato ETF salvato. Nuovo ID: ${this.lastID}`);
                    resolve(true);
                }
            }
        );
    });
}

// --- Logica di Simulazione Server-Side (Il cuore H24) ---
async function advanceSimulation() {
    const currentTime = Date.now();
    const timeElapsedSeconds = (currentTime - etfState.lastUpdatedTimestamp) / 1000;

    if (timeElapsedSeconds <= 0) {
        return;
    }

    const growthFactor = Math.pow(1 + targetPerSecondRate, timeElapsedSeconds);

    let totalNoise = 0;
    for (let i = 0; i < timeElapsedSeconds; i++) {
        totalNoise += (Math.random() * 2 - 1) * noiseFactor;
    }
    const noiseEffect = (1 + totalNoise); 

    let newCurrentValue = etfState.currentValue * growthFactor * noiseEffect;
    if (newCurrentValue < 0.01) newCurrentValue = 0.01;

    let newSimulatedDayCounter = etfState.simulatedDayCounter + (timeElapsedSeconds / secondsInADay);

    etfState.currentValue = newCurrentValue;
    etfState.simulatedDayCounter = newSimulatedDayCounter;
    etfState.lastUpdatedTimestamp = currentTime;

    console.log(`Simulazione avanzata. Nuovo valore: €${etfState.currentValue.toFixed(2)}, Giorno: ${Math.floor(etfState.simulatedDayCounter)}`);

    await saveEtfStateToDb(etfState.currentValue, etfState.simulatedDayCounter, etfState.lastUpdatedTimestamp);

    if (etfState.currentValue >= targetValue) {
        console.log("Obiettivo raggiunto! Simulazione terminata.");
        clearInterval(global.simulationInterval); 
    } else if (etfState.simulatedDayCounter >= simulationDays) {
        console.log("Tempo scaduto! Obiettivo non raggiunto.");
        clearInterval(global.simulationInterval); 
    }
}

// --- Rotte API ---
// Serve i file statici dalla cartella 'public'
app.use(express.static(path.join(__dirname, 'public')));

// API per ottenere lo stato attuale dell'investimento
app.get('/api/status', (req, res) => {
    res.json(etfState);
});

// Avvia il server e la simulazione
async function startServer() {
    await loadEtfStateFromDb(); 

    global.simulationInterval = setInterval(advanceSimulation, 60 * 1000); // Ogni 60 secondi

    app.listen(PORT, () => {
        console.log(`Server Express in ascolto sulla porta ${PORT}`);
        console.log(`Per visualizzare la dashboard: http://localhost:${PORT}`);
    });
}

startServer();

