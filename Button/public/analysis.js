const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: "#1e2438",
            titleColor: "#e0eaff",
            bodyColor: "#cfdeef"
        }
    },
    scales: {
        x: { ticks: { color: "#9aaec0", maxRotation: 45, autoSkip: true, maxTicksLimit: 16 } },
        y: { ticks: { color: "#9aaec0", beginAtZero: true } }
    }
};

const weekdayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const charts = [];

function setStatus(message, isError = false) {
    const status = document.getElementById("analysisStatus");
    status.hidden = false;
    status.classList.toggle("error", isError);
    status.innerHTML = isError
        ? `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(message)}`
        : message;
}

function showContent() {
    document.getElementById("analysisStatus").hidden = true;
    document.getElementById("analysisContent").hidden = false;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function updateSummary(data) {
    const temporal = data.temporal || {};
    const dayCount = temporal.byDay ? temporal.byDay.length : 0;
    const avg = dayCount > 0 ? data.rowCount / dayCount : 0;

    document.getElementById("analysisTotal").innerText = data.rowCount || 0;
    document.getElementById("analysisDays").innerText = dayCount;
    document.getElementById("analysisAvg").innerText = avg.toFixed(1);
    document.getElementById("analysisColumns").innerText = data.columns.length;

    const range = temporal.range || {};
    document.getElementById("analysisMeta").innerHTML = `
        <span><i class="fas fa-database"></i> Tabelle: ${escapeHtml(data.tableName)}</span>
        <span><i class="fas fa-clock"></i> Zeitspalte: ${escapeHtml(temporal.column || "keine erkannt")}</span>
        <span><i class="fas fa-calendar"></i> Zeitraum: ${escapeHtml(formatDateTime(range.start))} - ${escapeHtml(formatDateTime(range.end))}</span>
    `;
}

function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const chart = new Chart(canvas, config);
    charts.push(chart);
    return chart;
}

function renderLineChart(canvasId, labels, values, label, color) {
    createChart(canvasId, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label,
                data: values,
                borderColor: color,
                backgroundColor: `${color}22`,
                fill: true,
                tension: 0.25,
                pointRadius: labels.length > 60 ? 0 : 2,
                pointHoverRadius: 5
            }]
        },
        options: chartDefaults
    });
}

function renderBarChart(canvasId, labels, values, label, color) {
    createChart(canvasId, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label,
                data: values,
                backgroundColor: color,
                borderColor: "#d0e2ff",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: chartDefaults
    });
}

function renderTemporalCharts(temporal) {
    if (!temporal) {
        setStatus("Keine Zeitspalte erkannt. Zeitliche Auswertungen koennen nicht erzeugt werden.", true);
        return;
    }

    renderLineChart(
        "dailyChart",
        temporal.byDay.map(row => row.label),
        temporal.byDay.map(row => row.count),
        "Events pro Tag",
        "#4f9eff"
    );

    renderLineChart(
        "cumulativeChart",
        temporal.cumulativeByDay.map(row => row.label),
        temporal.cumulativeByDay.map(row => row.count),
        "Kumulierte Events",
        "#78d6a3"
    );

    const hourMap = Object.fromEntries(temporal.byHour.map(row => [Number(row.label), row.count]));
    renderBarChart(
        "hourChart",
        Array.from({ length: 24 }, (_, hour) => `${hour}:00`),
        Array.from({ length: 24 }, (_, hour) => hourMap[hour] || 0),
        "Events pro Stunde",
        "rgba(79, 158, 255, 0.65)"
    );

    const weekdayMap = Object.fromEntries(temporal.byWeekday.map(row => [Number(row.weekday), row.count]));
    renderBarChart(
        "weekdayChart",
        weekdayLabels,
        weekdayLabels.map((_, index) => weekdayMap[index] || 0),
        "Events pro Wochentag",
        "rgba(120, 214, 163, 0.65)"
    );

    renderBarChart(
        "monthAnalysisChart",
        temporal.byMonth.map(row => row.label),
        temporal.byMonth.map(row => row.count),
        "Events pro Monat",
        "rgba(224, 165, 107, 0.7)"
    );
}

function renderDynamicCharts(data) {
    const host = document.getElementById("dynamicCharts");
    host.innerHTML = "";

    data.categoricalDistributions.forEach((distribution, index) => {
        const canvasId = `categoryChart${index}`;
        host.insertAdjacentHTML("beforeend", `
            <div class="chart-card">
                <div class="card-title"><i class="fas fa-tags"></i> ${escapeHtml(distribution.column)}</div>
                <div class="chart-wrapper medium-chart">
                    <canvas id="${canvasId}"></canvas>
                </div>
            </div>
        `);

        renderBarChart(
            canvasId,
            distribution.values.map(row => row.label),
            distribution.values.map(row => row.count),
            distribution.column,
            "rgba(136, 170, 255, 0.7)"
        );
    });

    data.numericSummaries.forEach(summary => {
        host.insertAdjacentHTML("beforeend", `
            <div class="chart-card summary-card">
                <div class="card-title"><i class="fas fa-calculator"></i> ${escapeHtml(summary.column)}</div>
                <div class="summary-grid">
                    <span>Min</span><strong>${Number(summary.min).toFixed(2)}</strong>
                    <span>Max</span><strong>${Number(summary.max).toFixed(2)}</strong>
                    <span>Avg</span><strong>${Number(summary.avg).toFixed(2)}</strong>
                    <span>Werte</span><strong>${summary.count}</strong>
                </div>
            </div>
        `);
    });
}

function renderTables(data) {
    document.getElementById("columnsTable").innerHTML = data.columns.map(column => `
        <tr>
            <td>${escapeHtml(column.name)}</td>
            <td>${escapeHtml(column.type)}</td>
            <td>${column.required ? "Ja" : "Nein"}</td>
            <td>${column.primaryKey ? "Ja" : "Nein"}</td>
        </tr>
    `).join("");

    const latestHead = document.getElementById("latestHead");
    const latestRows = document.getElementById("latestRows");
    const columns = data.columns.map(column => column.name);

    latestHead.innerHTML = `<tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
    latestRows.innerHTML = data.latestRows.map(row => `
        <tr>
            ${columns.map(column => `<td>${escapeHtml(row[column])}</td>`).join("")}
        </tr>
    `).join("");
}

async function loadAnalysis() {
    try {
        const response = await fetch("/api/analysis/window-events");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Analyse konnte nicht geladen werden.");

        if (!data.rowCount) {
            setStatus("Die Tabelle Window_events ist leer. Sobald echte Events vorhanden sind, erscheinen hier Auswertungen.", true);
            return;
        }

        updateSummary(data);
        showContent();
        renderTemporalCharts(data.temporal);
        renderDynamicCharts(data);
        renderTables(data);
    } catch (error) {
        console.error("Analyse-Fehler:", error);
        setStatus(error.message, true);
    }
}

window.addEventListener("resize", () => {
    charts.forEach(chart => chart.resize());
});

loadAnalysis();
