const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/vendor/chartjs", express.static(path.join(__dirname, "node_modules", "chart.js", "dist")));
app.use(express.static(path.join(__dirname, "public")));

const dbFile = ["Fenster.db", "fenster.db"]
    .map(fileName => path.join(__dirname, fileName))
    .find(filePath => fs.existsSync(filePath)) || path.join(__dirname, "fenster.db");
const db = new Database(dbFile);

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

function quoteIdentifier(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

function findTableName(preferredName) {
    const row = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND lower(name) = lower(?)
        LIMIT 1
    `).get(preferredName);
    return row ? row.name : null;
}

function getTableColumns(tableName) {
    return db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
}

function pickTimestampColumn(columns) {
    return columns.find(column => {
        const name = column.name.toLowerCase();
        const type = String(column.type || "").toLowerCase();
        return name.includes("time")
            || name.includes("date")
            || name.includes("created")
            || type.includes("date")
            || type.includes("time");
    });
}

function isNumericColumn(column) {
    const type = String(column.type || "").toUpperCase();
    return type.includes("INT") || type.includes("REAL") || type.includes("NUM") || type.includes("DEC") || type.includes("DOUBLE") || type.includes("FLOAT");
}

function buildTemporalAnalysis(tableName, timestampColumn) {
    if (!timestampColumn) return null;

    const table = quoteIdentifier(tableName);
    const col = quoteIdentifier(timestampColumn.name);
    const validDateWhere = `${col} IS NOT NULL AND datetime(${col}) IS NOT NULL`;

    const byDay = db.prepare(`
        SELECT DATE(${col}) AS label, COUNT(*) AS count
        FROM ${table}
        WHERE ${validDateWhere}
        GROUP BY DATE(${col})
        ORDER BY label
    `).all();

    let runningTotal = 0;
    const cumulativeByDay = byDay.map(row => {
        runningTotal += row.count;
        return { label: row.label, count: runningTotal };
    });

    return {
        column: timestampColumn.name,
        range: db.prepare(`
            SELECT
                MIN(datetime(${col})) AS start,
                MAX(datetime(${col})) AS end,
                COUNT(${col}) AS count
            FROM ${table}
            WHERE ${validDateWhere}
        `).get(),
        byDay,
        cumulativeByDay,
        byMonth: db.prepare(`
            SELECT strftime('%Y-%m', ${col}) AS label, COUNT(*) AS count
            FROM ${table}
            WHERE ${validDateWhere}
            GROUP BY strftime('%Y-%m', ${col})
            ORDER BY label
        `).all(),
        byHour: db.prepare(`
            SELECT strftime('%H', ${col}) AS label, COUNT(*) AS count
            FROM ${table}
            WHERE ${validDateWhere}
            GROUP BY strftime('%H', ${col})
            ORDER BY label
        `).all(),
        byWeekday: db.prepare(`
            SELECT strftime('%w', ${col}) AS weekday, COUNT(*) AS count
            FROM ${table}
            WHERE ${validDateWhere}
            GROUP BY strftime('%w', ${col})
            ORDER BY weekday
        `).all()
    };
}

function buildCategoricalDistributions(tableName, columns, timestampColumn) {
    const table = quoteIdentifier(tableName);
    const timestampName = timestampColumn ? timestampColumn.name : null;

    return columns
        .filter(column => column.name !== timestampName)
        .filter(column => {
            const name = column.name.toLowerCase();
            const type = String(column.type || "").toUpperCase();
            return !isNumericColumn(column)
                && !name.endsWith("id")
                && (type.includes("TEXT") || type === "" || type.includes("CHAR"));
        })
        .map(column => {
            const col = quoteIdentifier(column.name);
            const distinct = db.prepare(`SELECT COUNT(DISTINCT ${col}) AS count FROM ${table} WHERE ${col} IS NOT NULL`).get().count;
            if (distinct === 0 || distinct > 30) return null;

            return {
                column: column.name,
                values: db.prepare(`
                    SELECT CAST(${col} AS TEXT) AS label, COUNT(*) AS count
                    FROM ${table}
                    WHERE ${col} IS NOT NULL
                    GROUP BY ${col}
                    ORDER BY count DESC, label
                    LIMIT 20
                `).all()
            };
        })
        .filter(Boolean);
}

function buildNumericSummaries(tableName, columns) {
    const table = quoteIdentifier(tableName);

    return columns
        .filter(column => isNumericColumn(column) && column.name.toLowerCase() !== "id" && !column.name.toLowerCase().endsWith("_id"))
        .map(column => {
            const col = quoteIdentifier(column.name);
            return {
                column: column.name,
                ...db.prepare(`
                    SELECT
                        MIN(${col}) AS min,
                        MAX(${col}) AS max,
                        AVG(${col}) AS avg,
                        COUNT(${col}) AS count
                    FROM ${table}
                    WHERE ${col} IS NOT NULL
                `).get()
            };
        });
}

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

app.get("/api/analysis/window-events", (req, res) => {
    try {
        const tableName = findTableName("Window_events") || findTableName("window_events");
        if (!tableName) {
            return res.status(404).json({
                error: "Tabelle Window_events wurde in fenster.db nicht gefunden.",
                code: "TABLE_NOT_FOUND"
            });
        }

        const table = quoteIdentifier(tableName);
        const columns = getTableColumns(tableName);
        if (columns.length === 0) {
            return res.status(500).json({
                error: `Tabelle ${tableName} enthaelt keine lesbaren Spalten.`,
                code: "NO_COLUMNS"
            });
        }

        const timestampColumn = pickTimestampColumn(columns);
        const orderColumn = timestampColumn ? quoteIdentifier(timestampColumn.name) : "rowid";
        const totalRows = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;

        res.json({
            tableName,
            rowCount: totalRows,
            columns: columns.map(column => ({
                name: column.name,
                type: column.type || "UNKNOWN",
                required: Boolean(column.notnull),
                primaryKey: Boolean(column.pk)
            })),
            temporal: buildTemporalAnalysis(tableName, timestampColumn),
            categoricalDistributions: buildCategoricalDistributions(tableName, columns, timestampColumn),
            numericSummaries: buildNumericSummaries(tableName, columns),
            latestRows: db.prepare(`
                SELECT *
                FROM ${table}
                ORDER BY ${orderColumn} DESC
                LIMIT 20
            `).all()
        });
    } catch (error) {
        console.error("Analyse-Fehler:", error);
        res.status(500).json({
            error: "Analyse konnte nicht aus der Datenbank geladen werden.",
            detail: error.message,
            code: "ANALYSIS_FAILED"
        });
    }
});

// --- Server starten ---
app.listen(PORT, () => {
    console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});
