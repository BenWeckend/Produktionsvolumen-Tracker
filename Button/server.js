const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

const db = new Database(path.join(process.cwd(), "fenster.db"));

// --- Tabellen ---
db.exec(`
CREATE TABLE IF NOT EXISTS window_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS action_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    count INTEGER DEFAULT 1,
    removed_timestamp DATETIME
);
`);

db.exec(`
CREATE INDEX IF NOT EXISTS idx_created_at ON window_events(created_at);
CREATE INDEX IF NOT EXISTS idx_action_timestamp ON action_log(timestamp DESC);
`);

// --- Statements für window_events ---
const insertEvent = db.prepare(`
    INSERT INTO window_events(created_at)
    VALUES(datetime('now','localtime'))
`);

const deleteLastEvent = db.prepare(`
    DELETE FROM window_events
    WHERE id = ?
`);

const getMaxId = db.prepare(`
    SELECT MAX(id) AS id
    FROM window_events
`);

// --- Statements für action_log ---
const insertActionLog = db.prepare(`
    INSERT INTO action_log (type, timestamp, count, removed_timestamp)
    VALUES (?, datetime('now','localtime'), ?, ?)
`);

const getActionLog = db.prepare(`
    SELECT type, timestamp, count, removed_timestamp
    FROM action_log
    ORDER BY timestamp DESC
    LIMIT 50
`);

// --- Statements für Dashboard ---
const todayStmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM window_events
    WHERE DATE(created_at) = DATE('now','localtime')
`);

const yesterdayStmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM window_events
    WHERE DATE(created_at) = DATE('now','-1 day','localtime')
`);

const weekTrendStmt = db.prepare(`
    SELECT
        DATE(created_at) AS day,
        COUNT(*) AS count
    FROM window_events
    WHERE DATE(created_at) >= DATE('now','-7 day', 'localtime')
    GROUP BY DATE(created_at)
    ORDER BY day
`);

const weekTotalStmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM window_events
    WHERE DATE(created_at) >= DATE('now', '-6 days', 'weekday 1')
`);

const monthTotalStmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM window_events
    WHERE DATE(created_at) >= DATE('now','start of month','localtime')
`);

const yearTotalStmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM window_events
    WHERE DATE(created_at) >= DATE('now','start of year','localtime')
`);

const monthTrendStmt = db.prepare(`
    SELECT
        DATE(created_at) AS day,
        COUNT(*) AS count
    FROM window_events
    WHERE DATE(created_at) >= DATE('now','-30 day', 'localtime')
    GROUP BY DATE(created_at)
    ORDER BY day
`);

const hourlyStmt = db.prepare(`
    SELECT
        strftime('%H', created_at) AS hour,
        COUNT(*) AS count
    FROM window_events
    WHERE DATE(created_at) = DATE('now','localtime')
    GROUP BY hour
    ORDER BY hour
`);

// --- API-Endpunkte ---

// Fenster hinzufügen
app.post("/api/window", (req, res) => {
    insertEvent.run();
    
    // Log-Eintrag: ADD
    insertActionLog.run("add", 1, null);
    
    res.json({ success: true });
});

// Letztes Fenster rückgängig machen
app.delete("/api/window/last", (req, res) => {
    const max = getMaxId.get();
    
    let removedTimestamp = null;
    if (max.id) {
        // Hole den Timestamp des zu löschenden Events
        const getEventTimestamp = db.prepare(`
            SELECT created_at FROM window_events WHERE id = ?
        `);
        const event = getEventTimestamp.get(max.id);
        if (event) {
            removedTimestamp = event.created_at;
        }
        
        deleteLastEvent.run(max.id);
        
        // Log-Eintrag: UNDO
        insertActionLog.run("undo", 1, removedTimestamp);
    }
    
    res.json({ success: true });
});

// Dashboard-Daten
app.get("/api/dashboard", (req, res) => {
    res.json({
        today: todayStmt.get().count,
        yesterday: yesterdayStmt.get().count,
        weekTrend: weekTrendStmt.all(),
        monthTrend: monthTrendStmt.all(),
        hourly: hourlyStmt.all(),
        actionLog: getActionLog.all(),
        monthTotal: monthTotalStmt.get().count,
        yearTotal: yearTotalStmt.get().count,
        weekTotal: weekTotalStmt.get().count
    });
});

// --- Server starten ---
app.listen(PORT, () => {
    console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});