const sqlite3 = require('sqlite3').verbose();
const DB_PATH = './simulazione_etf.db'; // Il file del database verrà creato qui

let db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Errore nell\'apertura del database', err.message);
    } else {
        console.log('Connesso al database SQLite.');
        db.run(`CREATE TABLE IF NOT EXISTS etf_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            currentValue REAL,
            simulatedDayCounter REAL,
            lastUpdatedTimestamp INTEGER
        )`);
        console.log('Tabella etf_state verificata/creata.');
    }
});

function getDb() {
    return db;
}

module.exports = { getDb };

