// ----------------------- KERNLOGIK (localStorage mit Zeitstempel) -----------------------
const STORAGE_KEY = "events";
const LOG_KEY = "action_log";

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

function getActionLog() {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch(e) { return []; }
}

function saveActionLog(logArray) {
    const trimmed = logArray.slice(0, 50);
    localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
}

function addToActionLog(type, details = {}) {
    const log = getActionLog();
    log.unshift({
        type: type,
        timestamp: new Date().toISOString(),
        ...details
    });
    saveActionLog(log);
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getEventLocalDate(event) {
    const dt = new Date(event.t);
    return getLocalDateString(dt);
}

function countDay(dateStr) {
    const events = getEvents();
    return events.filter(ev => getEventLocalDate(ev) === dateStr).length;
}

function todayLocalStr() {
    return getLocalDateString(new Date());
}

function yesterdayLocalStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
}

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
        labels.push(d.getDate());
        const dayKey = getLocalDateString(d);
        data.push(countDay(dayKey));
    }
    return { labels, data };
}

function getHourlyCountsToday() {
    const hourly = new Array(24).fill(0);
    const events = getEvents();
    const todayStr = todayLocalStr();
    
    for (const ev of events) {
        const evDateStr = getEventLocalDate(ev);
        if (evDateStr === todayStr) {
            const hour = new Date(ev.t).getHours();
            if (hour >= 0 && hour < 24) hourly[hour]++;
        }
    }
    return hourly;
}

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
        const day = evDate.getDate();
        const month = evDate.getMonth() + 1;
        return `${day}.${month}. ${timePart}`;
    }
}

function getRelativeTime(isoString) {
    const evDate = new Date(isoString);
    const diffSeconds = Math.floor((new Date() - evDate) / 1000);
    
    if (diffSeconds < 60) return ` (gerade eben)`;
    if (diffSeconds < 3600) return ` (vor ${Math.floor(diffSeconds/60)} min)`;
    if (diffSeconds < 86400) return ` (vor ${Math.floor(diffSeconds/3600)} h)`;
    return ` (vor ${Math.floor(diffSeconds/86400)} Tagen)`;
}

let weekChart = null;
let monthChart = null;
let hourlyChart = null;

function setupChartResize(chart) {
    if (!chart) return;
    const resizeObserver = new ResizeObserver(() => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
    if (chart.canvas && chart.canvas.parentElement) {
        resizeObserver.observe(chart.canvas.parentElement);
    }
}

function updateCounters() {
    document.getElementById("todayCount").innerText = countDay(todayLocalStr());
    document.getElementById("yesterdayCount").innerText = countDay(yesterdayLocalStr());
    document.getElementById("monthTotal").innerText = totalLast30Days();
}

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
                borderColor: "#4f9eff",
                backgroundColor: "rgba(79,158,255,0.04)",
                tension: 0.3,
                pointBackgroundColor: "#bdd4ff",
                pointBorderColor: "#ffffff",
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false }, 
                tooltip: { backgroundColor: "#1e2438", titleColor: "#e0eaff", bodyColor: "#cfdeef" } 
            },
            scales: { 
                x: { ticks: { color: "#9aaec0", maxRotation: 45 } }, 
                y: { ticks: { color: "#9aaec0", stepSize: 1, beginAtZero: true } } 
            }
        }
    });
    setupChartResize(weekChart);
    
    monthChart = new Chart(document.getElementById("monthChart"), {
        type: "line",
        data: {
            labels: monthData.labels,
            datasets: [{
                label: "Fenster (30 Tage)",
                data: monthData.data,
                borderColor: "#88aaff",
                backgroundColor: "rgba(136,170,255,0.02)",
                tension: 0.2,
                pointRadius: 1.8,
                pointBackgroundColor: "#b8ceff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: "#1e2438" } },
            scales: { 
                x: { ticks: { color: "#9aaec0", maxRotation: 45, autoSkip: true, maxTicksLimit: 15 } }, 
                y: { ticks: { color: "#9aaec0", stepSize: 1, beginAtZero: true } } 
            }
        }
    });
    setupChartResize(monthChart);
}

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
                backgroundColor: "rgba(79, 158, 255, 0.65)",
                borderColor: "#d0e2ff",
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.75,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw} Fenster` }, backgroundColor: "#1e2438" }
            },
            scales: {
                x: { 
                    ticks: { color: "#9aaec0", maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } 
                },
                y: { ticks: { color: "#9aaec0", stepSize: 1, beginAtZero: true } }
            }
        }
    });
    setupChartResize(hourlyChart);
}

function renderActionLog() {
    const actionLog = getActionLog();
    const logContainer = document.getElementById("actionLogList");
    if (!logContainer) return;
    
    if (actionLog.length === 0) {
        logContainer.innerHTML = `<li style="justify-content: center; gap: 8px;"><i class="fas fa-info-circle"></i> Noch keine Aktionen – drücke [ENTER] oder Button</li>`;
        return;
    }
    
    const itemsHtml = actionLog.map(entry => {
        const timeLabel = formatLogTime(entry.timestamp);
        const relativeTime = getRelativeTime(entry.timestamp);
        
        if (entry.type === "add") {
            return `<li>
                        <i class="fas fa-window-maximize log-icon"></i>
                        <span class="log-time">${timeLabel}</span>
                        <span class="log-text">
                            <i class="fas fa-plus-circle" style="color:#7cb5ff;"></i> 
                            Fenster produziert ${relativeTime}
                        </span>
                    </li>`;
        } else if (entry.type === "undo") {
            const undoText = entry.count ? `${entry.count} Fenster rückgängig` : "Fenster rückgängig";
            return `<li>
                        <i class="fas fa-undo-alt log-undo-icon"></i>
                        <span class="log-time">${timeLabel}</span>
                        <span class="log-text">
                            <i class="fas fa-trash-alt" style="color:#e0a56b;"></i> 
                            UNDO: ${undoText} ${relativeTime}
                        </span>
                    </li>`;
        }
        return "";
    }).join('');
    
    logContainer.innerHTML = itemsHtml;
}

function fullUpdate() {
    updateCounters();
    renderWeeklyMonthlyCharts();
    renderHourlyBarChart();
    renderActionLog();
}

function addWindow() {
    const events = getEvents();
    const newEvent = { t: new Date().toISOString() };
    events.push(newEvent);
    saveEvents(events);
    addToActionLog("add", { count: 1 });
    fullUpdate();
    
    const btn = document.getElementById("addBtn");
    btn.style.transform = "scale(0.97)";
    setTimeout(() => { btn.style.transform = ""; }, 120);
}

function undoLastWindow() {
    const events = getEvents();
    if (events.length === 0) {
        const undoBtn = document.getElementById("undoBtn");
        undoBtn.style.transform = "scale(0.95)";
        undoBtn.style.borderColor = "#b54747";
        setTimeout(() => { 
            undoBtn.style.transform = ""; 
            undoBtn.style.borderColor = "#4f6b8a";
        }, 200);
        return;
    }
    
    const removedEvent = events.pop();
    saveEvents(events);
    addToActionLog("undo", { count: 1, removedTimestamp: removedEvent.t });
    fullUpdate();
    
    const undoBtn = document.getElementById("undoBtn");
    undoBtn.style.transform = "scale(0.97)";
    setTimeout(() => { undoBtn.style.transform = ""; }, 120);
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        addWindow();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoLastWindow();
    }
});

document.getElementById("addBtn").addEventListener("click", addWindow);
document.getElementById("undoBtn").addEventListener("click", undoLastWindow);

window.addEventListener('resize', () => {
    if (weekChart) weekChart.resize();
    if (monthChart) monthChart.resize();
    if (hourlyChart) hourlyChart.resize();
});

fullUpdate();

window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === LOG_KEY) {
        fullUpdate();
    }
});

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) fullUpdate();
});

console.log("🪟 FENSTER SYSTEM AKTIV | Dunkles, analytisches Layout | Today-Zahl hervorgehoben");