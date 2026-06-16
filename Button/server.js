const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { createWindowEventsReportPdf } = require("./report");

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 3000);
let server = null;

app.use(express.json());
app.use("/vendor/chartjs", express.static(path.join(__dirname, "node_modules", "chart.js", "dist")));
app.use(express.static(path.join(__dirname, "public")));

const bundledDbFile = ["Fenster.db", "fenster.db"]
    .map(fileName => path.join(__dirname, fileName))
    .find(filePath => fs.existsSync(filePath)) || path.join(__dirname, "fenster.db");
const dbFile = process.env.FENSTER_DB_PATH
    ? path.resolve(process.env.FENSTER_DB_PATH)
    : bundledDbFile;
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
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

function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

function isValidDateOnly(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function resolveAnalysisPeriod(input = {}) {
    const preset = input.preset || input.range || "all";
    const today = new Date();
    let startDate = input.startDate;
    let endDate = input.endDate;
    let label = "Alle Daten";

    if (preset === "week") {
        const day = today.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        startDate = localDateString(addDays(today, mondayOffset));
        endDate = localDateString(today);
        label = "Diese Woche";
    } else if (preset === "month") {
        startDate = localDateString(new Date(today.getFullYear(), today.getMonth(), 1));
        endDate = localDateString(today);
        label = "Dieser Monat";
    } else if (preset === "year") {
        startDate = localDateString(new Date(today.getFullYear(), 0, 1));
        endDate = localDateString(today);
        label = "Dieses Jahr";
    } else if (preset === "all") {
        startDate = null;
        endDate = null;
    } else if (preset === "custom") {
        label = `${startDate || "Start"} bis ${endDate || "Ende"}`;
    } else {
        throw new Error("Unbekannte Zeitraum-Option.");
    }

    if (preset !== "all") {
        if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
            throw new Error("Bitte gueltige Start- und Enddaten im Format YYYY-MM-DD angeben.");
        }
        if (startDate > endDate) {
            throw new Error("Das Startdatum darf nicht nach dem Enddatum liegen.");
        }
    }

    return { preset, startDate, endDate, label };
}

function buildDateWhere(timestampColumn, period = {}) {
    if (!timestampColumn) {
        return { where: "1 = 1", params: {} };
    }

    const col = quoteIdentifier(timestampColumn.name);
    const clauses = [`${col} IS NOT NULL`, `datetime(${col}) IS NOT NULL`];
    const params = {};

    if (period.startDate) {
        clauses.push(`DATE(${col}) >= @startDate`);
        params.startDate = period.startDate;
    }
    if (period.endDate) {
        clauses.push(`DATE(${col}) <= @endDate`);
        params.endDate = period.endDate;
    }

    return { where: clauses.join(" AND "), params };
}

function buildTemporalAnalysis(tableName, timestampColumn, period = {}) {
    if (!timestampColumn) return null;

    const table = quoteIdentifier(tableName);
    const col = quoteIdentifier(timestampColumn.name);
    const { where, params } = buildDateWhere(timestampColumn, period);

    const byDay = db.prepare(`
        SELECT DATE(${col}) AS label, COUNT(*) AS count
        FROM ${table}
        WHERE ${where}
        GROUP BY DATE(${col})
        ORDER BY label
    `).all(params);

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
            WHERE ${where}
        `).get(params),
        byDay,
        cumulativeByDay,
        byMonth: db.prepare(`
            SELECT strftime('%Y-%m', ${col}) AS label, COUNT(*) AS count
            FROM ${table}
            WHERE ${where}
            GROUP BY strftime('%Y-%m', ${col})
            ORDER BY label
        `).all(params),
        byHour: db.prepare(`
            SELECT strftime('%H', ${col}) AS label, COUNT(*) AS count
            FROM ${table}
            WHERE ${where}
            GROUP BY strftime('%H', ${col})
            ORDER BY label
        `).all(params),
        byWeekday: db.prepare(`
            SELECT strftime('%w', ${col}) AS weekday, COUNT(*) AS count
            FROM ${table}
            WHERE ${where}
            GROUP BY strftime('%w', ${col})
            ORDER BY weekday
        `).all(params)
    };
}

function buildCategoricalDistributions(tableName, columns, timestampColumn, period = {}) {
    const table = quoteIdentifier(tableName);
    const timestampName = timestampColumn ? timestampColumn.name : null;
    const { where, params } = buildDateWhere(timestampColumn, period);

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
            const distinct = db.prepare(`SELECT COUNT(DISTINCT ${col}) AS count FROM ${table} WHERE ${col} IS NOT NULL AND ${where}`).get(params).count;
            if (distinct === 0 || distinct > 30) return null;

            return {
                column: column.name,
                values: db.prepare(`
                    SELECT CAST(${col} AS TEXT) AS label, COUNT(*) AS count
                    FROM ${table}
                    WHERE ${col} IS NOT NULL AND ${where}
                    GROUP BY ${col}
                    ORDER BY count DESC, label
                    LIMIT 20
                `).all(params)
            };
        })
        .filter(Boolean);
}

function buildNumericSummaries(tableName, columns, timestampColumn, period = {}) {
    const table = quoteIdentifier(tableName);
    const { where, params } = buildDateWhere(timestampColumn, period);

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
                    WHERE ${col} IS NOT NULL AND ${where}
                `).get(params)
            };
        });
}

function getWindowEventsAnalysis(period = {}) {
    const tableName = findTableName("Window_events") || findTableName("window_events");
    if (!tableName) {
        const error = new Error("Tabelle Window_events wurde in fenster.db nicht gefunden.");
        error.statusCode = 404;
        error.code = "TABLE_NOT_FOUND";
        throw error;
    }

    const table = quoteIdentifier(tableName);
    const columns = getTableColumns(tableName);
    if (columns.length === 0) {
        const error = new Error(`Tabelle ${tableName} enthaelt keine lesbaren Spalten.`);
        error.statusCode = 500;
        error.code = "NO_COLUMNS";
        throw error;
    }

    const timestampColumn = pickTimestampColumn(columns);
    if ((period.startDate || period.endDate) && !timestampColumn) {
        const error = new Error("Keine Zeitstempelspalte in Window_events erkannt. Zeitraumfilterung ist nicht moeglich.");
        error.statusCode = 400;
        error.code = "TIMESTAMP_COLUMN_NOT_FOUND";
        throw error;
    }

    const orderColumn = timestampColumn ? quoteIdentifier(timestampColumn.name) : "rowid";
    const { where, params } = buildDateWhere(timestampColumn, period);
    const rowCount = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get(params).count;

    return {
        tableName,
        period,
        rowCount,
        timestampColumn: timestampColumn ? timestampColumn.name : null,
        columns: columns.map(column => ({
            name: column.name,
            type: column.type || "UNKNOWN",
            required: Boolean(column.notnull),
            primaryKey: Boolean(column.pk)
        })),
        temporal: buildTemporalAnalysis(tableName, timestampColumn, period),
        categoricalDistributions: buildCategoricalDistributions(tableName, columns, timestampColumn, period),
        numericSummaries: buildNumericSummaries(tableName, columns, timestampColumn, period),
        latestRows: db.prepare(`
            SELECT *
            FROM ${table}
            WHERE ${where}
            ORDER BY ${orderColumn} DESC
            LIMIT 20
        `).all(params)
    };
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
        const period = resolveAnalysisPeriod(req.query);
        res.json(getWindowEventsAnalysis(period));
    } catch (error) {
        console.error("Analyse-Fehler:", error);
        res.status(error.statusCode || 500).json({
            error: "Analyse konnte nicht aus der Datenbank geladen werden.",
            detail: error.message,
            code: error.code || "ANALYSIS_FAILED"
        });
    }
});

app.post("/api/reports/window-events/pdf", (req, res) => {
    try {
        const period = resolveAnalysisPeriod(req.body || {});
        const analysis = getWindowEventsAnalysis(period);

        if (!analysis.rowCount) {
            return res.status(404).json({
                error: "Im gewaehlten Zeitraum wurden keine Daten gefunden.",
                code: "EMPTY_PERIOD"
            });
        }

        const safeRange = `${period.startDate || "alle"}_${period.endDate || "daten"}`.replace(/[^a-zA-Z0-9_-]/g, "-");
        const fileName = `fenster-auswertung-${safeRange}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

        const doc = new PDFDocument({
            size: "A4",
            margin: 44,
            info: {
                Title: "Fenster Auswertung",
                Author: "Fenster Dashboard"
            }
        });
        doc.pipe(res);
        createWindowEventsReportPdf(doc, analysis, period);
    } catch (error) {
        console.error("PDF-Report-Fehler:", error);
        if (!res.headersSent) {
            res.status(error.statusCode || 500).json({
                error: "PDF-Auswertung konnte nicht erstellt werden.",
                detail: error.message,
                code: error.code || "PDF_REPORT_FAILED"
            });
        }
    }
});

function startServer(options = {}) {
    const port = options.port ?? DEFAULT_PORT;
    const host = options.host || "127.0.0.1";

    if (server) {
        const address = server.address();
        return Promise.resolve({
            server,
            host,
            port: typeof address === "object" && address ? address.port : port
        });
    }

    return new Promise((resolve, reject) => {
        const instance = app.listen(port, host, () => {
            server = instance;
            const address = instance.address();
            const actualPort = typeof address === "object" && address ? address.port : port;
            console.log(`Server laeuft auf http://${host}:${actualPort}`);
            resolve({ server: instance, host, port: actualPort });
        });

        instance.once("error", reject);
    });
}

function closeDatabase() {
    if (db.open) {
        db.close();
    }
}

function stopServer() {
    return new Promise((resolve, reject) => {
        if (!server) {
            closeDatabase();
            resolve();
            return;
        }

        const runningServer = server;
        server = null;
        runningServer.close(error => {
            closeDatabase();
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

if (require.main === module) {
    startServer().catch(error => {
        console.error("Server konnte nicht gestartet werden:", error);
        process.exit(1);
    });
}

module.exports = {
    app,
    startServer,
    stopServer,
    dbFile
};
