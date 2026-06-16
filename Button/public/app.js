// ----------------------- API-KOMMUNIKATION -----------------------

async function loadDashboard() {
    try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) throw new Error("Fehler beim Laden des Dashboards");
        const data = await response.json();
        updateUI(data);
    } catch (error) {
        console.error("Dashboard-Fehler:", error);
    }
}

function updateUI(data) {
    updateCounters(data);
    renderWeeklyMonthlyCharts(data);
    renderHourlyBarChart(data);
    renderActionLog(data.actionLog);
}

// ----------------------- ZEITHELFER (für Log) -----------------------

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

// ----------------------- CHART-VARIABLEN & RESIZE -----------------------

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

// ----------------------- UI-UPDATE-FUNKTIONEN -----------------------

function updateCounters(data) {
    document.getElementById("todayCount").innerText = data.today || 0;
    document.getElementById("weekTotal").innerText = data.weekTotal || 0;
    document.getElementById("monthTotal").innerText = data.monthTotal || 0;
    document.getElementById("yearTotal").innerText = data.yearTotal || 0;
}

function renderWeeklyMonthlyCharts(data) {
    // ---- 7-Tage-Trend ----
    const today = new Date();
    const weekLabels = [];
    const weekCounts = [];
    const weekMap = {};
    if (data.weekTrend) {
        data.weekTrend.forEach(item => {
            weekMap[item.day] = item.count;
        });
    }
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const label = d.toLocaleDateString("de", { weekday: "short", day: "numeric" });
        weekLabels.push(label);
        const dayKey = getLocalDateString(d);
        weekCounts.push(weekMap[dayKey] || 0);
    }

    if (weekChart) weekChart.destroy();
    weekChart = new Chart(document.getElementById("weekChart"), {
        type: "line",
        data: {
            labels: weekLabels,
            datasets: [{
                label: "Fenster pro Tag",
                data: weekCounts,
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

    // ---- 30-Tage-Trend ----
    const monthLabels = [];
    const monthCounts = [];
    const monthMap = {};
    if (data.monthTrend) {
        data.monthTrend.forEach(item => {
            monthMap[item.day] = item.count;
        });
    }
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        monthLabels.push(d.getDate());
        const dayKey = getLocalDateString(d);
        monthCounts.push(monthMap[dayKey] || 0);
    }

    if (monthChart) monthChart.destroy();
    monthChart = new Chart(document.getElementById("monthChart"), {
        type: "line",
        data: {
            labels: monthLabels,
            datasets: [{
                label: "Fenster (30 Tage)",
                data: monthCounts,
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

function renderHourlyBarChart(data) {
    const hourly = new Array(24).fill(0);
    if (data.hourly) {
        data.hourly.forEach(item => {
            const hour = parseInt(item.hour, 10);
            if (!isNaN(hour) && hour >= 0 && hour < 24) {
                hourly[hour] = item.count;
            }
        });
    }

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
                data: hourly,
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

function renderActionLog(actionLog) {
    const logContainer = document.getElementById("actionLogList");
    if (!logContainer) return;

    if (!actionLog || actionLog.length === 0) {
        logContainer.innerHTML = `<li style="justify-content: center; gap: 8px;"><i class="fas fa-info-circle"></i> Noch keine Aktionen</li>`;
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
            return `<li>
                        <i class="fas fa-undo-alt log-undo-icon"></i>
                        <span class="log-time">${timeLabel}</span>
                        <span class="log-text">
                            <i class="fas fa-trash-alt" style="color:#e0a56b;"></i> 
                            UNDO: Fenster rückgängig ${relativeTime}
                        </span>
                    </li>`;
        }
        return "";
    }).join('');

    logContainer.innerHTML = itemsHtml;
}

// ----------------------- AKTIONEN (API-Aufrufe) -----------------------

async function addWindow() {
    try {
        const btn = document.getElementById("addBtn");
        btn.style.transform = "scale(0.97)";
        setTimeout(() => { btn.style.transform = ""; }, 120);
        
        await fetch("/api/window", { method: "POST" });
        await loadDashboard();
    } catch (error) {
        console.error("Fehler beim Hinzufügen:", error);
    }
}

async function undoWindow() {
    try {
        const undoBtn = document.getElementById("undoBtn");
        undoBtn.style.transform = "scale(0.97)";
        setTimeout(() => { undoBtn.style.transform = ""; }, 120);
        
        await fetch("/api/window/last", { method: "DELETE" });
        await loadDashboard();
    } catch (error) {
        console.error("Fehler beim Rückgängig:", error);
    }
}

// ----------------------- EVENT-LISTENER -----------------------

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        addWindow();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoWindow();
    }
});

document.getElementById("addBtn").addEventListener("click", addWindow);
document.getElementById("undoBtn").addEventListener("click", undoWindow);

// ----------------------- CHART-RESIZE BEI FENSTERGRÖSSE -----------------------

window.addEventListener('resize', () => {
    if (weekChart) weekChart.resize();
    if (monthChart) monthChart.resize();
    if (hourlyChart) hourlyChart.resize();
});

// ----------------------- INIT & AUTO-UPDATE (alle 1 Stunden) -----------------------

loadDashboard();
setInterval(loadDashboard, 3600000);

console.log("🪟 FENSTER SYSTEM AKTIV | Server-API mit UNDO-Log | Auto-Update alle 1h");