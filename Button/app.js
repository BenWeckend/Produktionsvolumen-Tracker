// ----------------------- KERNLOGIK (localStorage mit Zeitstempel) -----------------------
const STORAGE_KEY = "events";

// Alle Ereignisse laden (jedes = { t: ISO string mit Uhrzeit })
function getEvents() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch(e) { return []; }
}

function saveEvents(eventsArray) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsArray));
}

// ----- LOKALE DATUMSFUNKTIONEN (wichtig für korrekte Tageszählung / Zeitzone) -----
function getLocalDateString(date) {
    // Gibt YYYY-MM-DD im lokalen Datum zurück (z.B. "2026-06-15")
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Für ein gegebenes Event (timestamp) das lokale Datum als YYYY-MM-DD
function getEventLocalDate(event) {
    const dt = new Date(event.t);
    return getLocalDateString(dt);
}

// Zählt Events für ein bestimmtes lokales Datum (YYYY-MM-DD)
function countDay(dateStr) {
    const events = getEvents();
    return events.filter(ev => getEventLocalDate(ev) === dateStr).length;
}

// Hilfsfunktion: aktuelle lokale Datum-Strings
function todayLocalStr() {
    return getLocalDateString(new Date());
}

function yesterdayLocalStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
}

// 30-Tage Summe (lokale Tage)
function totalLast30Days() {
    let total = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dayKey = getLocalDateString(d);
        total += countDay(dayKey);
    }
    return total;
}

// ---------- Diagramm Daten: wöchentlich & monatlich ----------
function buildWeekData() {
    const labels = [];
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        labels.push(d.toLocaleDateString("de", { weekday: "short", day: "numeric" }));
        const dayKey = getLocalDateString(d);
        data.push(countDay(dayKey));
    }
    return { labels, data };
}

function buildMonthData() {
    const labels = [];
    const data = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        labels.push(d.getDate());  // Tag des Monats
        const dayKey = getLocalDateString(d);
        data.push(countDay(dayKey));
    }
    return { labels, data };
}

// ********** NEU: Stündliche Daten für HEUTE (Balkendiagramm) **********
function getHourlyCountsToday() {
    // returns array mit 24 elementen (stunde 0..23)
    const hourly = new Array(24).fill(0);
    const events = getEvents();
    const todayStr = todayLocalStr();
    
    for (const ev of events) {
        const evDateStr = getEventLocalDate(ev);
        if (evDateStr === todayStr) {
            const hour = new Date(ev.t).getHours();  // lokale Stunde (0-23)
            if (hour >= 0 && hour < 24) hourly[hour]++;
        }
    }
    return hourly;
}

// ********** LOG: letzte 10 Aktionen mit Zeit & Datum **********
function getLastActions(maxCount = 12) {
    const events = getEvents();
    // absteigend sortieren (neueste zuerst)
    const sorted = [...events].sort((a,b) => new Date(b.t) - new Date(a.t));
    return sorted.slice(0, maxCount);
}

// Formatiert einen Zeitstempel fürs Log: "Heute 14:32:05" oder "15.06. 09:12"
function formatLogTime(isoString) {
    const evDate = new Date(isoString);
    const now = new Date();
    const evLocalStr = getLocalDateString(evDate);
    const todayStr = getLocalDateString(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);
    
    const timePart = evDate.toLocaleTimeString("de", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    
    if (evLocalStr === todayStr) {
        return `Heute, ${timePart}`;
    } else if (evLocalStr === yesterdayStr) {
        return `Gestern, ${timePart}`;
    } else {
        // Datum kurz anzeigen
        const day = evDate.getDate();
        const month = evDate.getMonth() + 1;
        return `${day}.${month}. ${timePart}`;
    }
}

// ---------- Globale Chart-Referenzen ----------
let weekChart = null;
let monthChart = null;
let hourlyChart = null;

// Updaten der 3 Haupt-KPI's
function updateCounters() {
    document.getElementById("todayCount").innerText = countDay(todayLocalStr());
    document.getElementById("yesterdayCount").innerText = countDay(yesterdayLocalStr());
    document.getElementById("monthTotal").innerText = totalLast30Days();
}

// Wochen- & Monats-Charts rendern
function renderWeeklyMonthlyCharts() {
    const weekData = buildWeekData();
    const monthData = buildMonthData();
    
    if (weekChart) weekChart.destroy();
    if (monthChart) monthChart.destroy();
    
    weekChart = new Chart(document.getElementById("weekChart"), {
        type: "line",
        data: {
            labels: weekData.labels,
            datasets: [{
                label: "Fenster pro Tag",
                data: weekData.data,
                borderColor: "#00f5ff",
                backgroundColor: "rgba(0,245,255,0.05)",
                tension: 0.3,
                pointBackgroundColor: "#ff44ff",
                pointBorderColor: "#fff",
                pointRadius: 4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0a0f2a" } },
            scales: { x: { ticks: { color: "#bbf0ff" } }, y: { ticks: { color: "#bbf0ff" } } }
        }
    });
    
    monthChart = new Chart(document.getElementById("monthChart"), {
        type: "line",
        data: {
            labels: monthData.labels,
            datasets: [{
                label: "Fenster (30 Tage)",
                data: monthData.data,
                borderColor: "#ff66ff",
                backgroundColor: "rgba(255,0,255,0.02)",
                tension: 0.2,
                pointRadius: 1.8,
                pointBackgroundColor: "#00ffff"
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { color: "#aaffff" } }, y: { ticks: { color: "#aaffff" } } }
        }
    });
}

// Stündliches Balkendiagramm (heute)
function renderHourlyBarChart() {
    const hourlyCounts = getHourlyCountsToday();
    const labels = [];
    for (let i = 0; i < 24; i++) {
        labels.push(`${i}:00`);
    }
    
    if (hourlyChart) hourlyChart.destroy();
    const ctx = document.getElementById("hourlyChart").getContext("2d");
    hourlyChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Fenster pro Stunde",
                data: hourlyCounts,
                backgroundColor: "rgba(0, 245, 255, 0.6)",
                borderColor: "#ff44ff",
                borderWidth: 1.5,
                borderRadius: 6,
                barPercentage: 0.75,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw} Fenster` } }
            },
            scales: {
                x: { ticks: { color: "#00f5ff", maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } },
                y: { ticks: { color: "#00f5ff", stepSize: 1, beginAtZero: true } }
            }
        }
    });
}

// Log der letzten Aktionen rendern (mit Icons & Zeit)
function renderActionLog() {
    const lastEvents = getLastActions(12);
    const logContainer = document.getElementById("actionLogList");
    if (!logContainer) return;
    
    if (lastEvents.length === 0) {
        logContainer.innerHTML = `<li style="justify-content: center; gap: 8px;"><i class="fas fa-info-circle"></i> Noch keine Fenster – drücke [ENTER] oder Button</li>`;
        return;
    }
    
    const itemsHtml = lastEvents.map(ev => {
        const timeLabel = formatLogTime(ev.t);
        // zusätzlich: relative Zeit (vor x min) ist bonus
        let relative = "";
        const evDate = new Date(ev.t);
        const diffMinutes = Math.floor((new Date() - evDate) / 60000);
        if (diffMinutes < 60 && diffMinutes > 0) relative = ` (vor ${diffMinutes} min)`;
        else if (diffMinutes === 0) relative = ` (gerade eben)`;
        else if (diffMinutes >= 60 && diffMinutes < 1440) relative = ` (vor ${Math.floor(diffMinutes/60)}h)`;
        
        return `<li>
                    <i class="fas fa-window-maximize log-icon"></i>
                    <span class="log-time">${timeLabel}</span>
                    <span class="log-text">Fenster produziert <i class="fas fa-check-circle" style="color:#88ffaa;"></i> ${relative}</span>
                </li>`;
    }).join('');
    
    logContainer.innerHTML = itemsHtml;
}

// ---------- MASTER UPDATE: alles neu zeichnen ----------
function fullUpdate() {
    updateCounters();
    renderWeeklyMonthlyCharts();
    renderHourlyBarChart();
    renderActionLog();
}

// ---------- CORE OPERATIONEN ----------
function addWindow() {
    const events = getEvents();
    const newEvent = { t: new Date().toISOString() }; // voller Zeitstempel in UTC (wird lokal ausgewertet)
    events.push(newEvent);
    saveEvents(events);
    fullUpdate();
    // kleine haptische Rückmeldung via kurzem style-blitz
    const btn = document.getElementById("addBtn");
    btn.style.transform = "scale(0.97)";
    setTimeout(() => { btn.style.transform = ""; }, 120);
}

function undoLastWindow() {
    const events = getEvents();
    if (events.length === 0) return;
    events.pop();
    saveEvents(events);
    fullUpdate();
    const undoBtn = document.getElementById("undoBtn");
    undoBtn.style.transform = "scale(0.97)";
    setTimeout(() => { undoBtn.style.transform = ""; }, 120);
}

// Keyboard Support: ENTER fügt Fenster hinzu
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        addWindow();
    }
    // optional: Strg+Z für Undo (komfort)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoLastWindow();
    }
});

// Buttons verbinden
document.getElementById("addBtn").addEventListener("click", addWindow);
document.getElementById("undoBtn").addEventListener("click", undoLastWindow);

// Initialer Aufruf
fullUpdate();

// Bei localStorage-Änderungen in anderen Tabs ebenfalls aktualisieren
window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
        fullUpdate();
    }
});

// Aktualisierung beim Sichtbarkeitswechsel
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) fullUpdate();
});

console.log("🪟 FENSTER SYSTEM AKTIV | Lokale Zeitzonen-Auswertung | Stunden-BarChart + Log");