const PAGE = {
    margin: 44,
    width: 595.28,
    height: 841.89
};

const COLORS = {
    ink: "#172033",
    muted: "#5f6f85",
    line: "#d9e2ef",
    panel: "#f5f7fb",
    primary: "#276ef1",
    green: "#1f9d68",
    orange: "#d8842f",
    dark: "#0f1726"
};

function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatNumber(value, digits = 0) {
    const number = Number(value || 0);
    return number.toLocaleString("de-DE", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function niceLabel(value) {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
}

function ensureSpace(doc, height) {
    if (doc.y + height > PAGE.height - PAGE.margin) {
        doc.addPage();
    }
}

function sectionTitle(doc, title) {
    ensureSpace(doc, 36);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.ink).text(title);
    doc.moveTo(PAGE.margin, doc.y + 4)
        .lineTo(PAGE.width - PAGE.margin, doc.y + 4)
        .strokeColor(COLORS.line)
        .lineWidth(1)
        .stroke();
    doc.moveDown(0.8);
}

function drawMetricCards(doc, metrics) {
    const gap = 12;
    const width = (PAGE.width - PAGE.margin * 2 - gap * 3) / 4;
    const height = 72;
    const y = doc.y;

    metrics.forEach((metric, index) => {
        const x = PAGE.margin + index * (width + gap);
        doc.roundedRect(x, y, width, height, 8).fillAndStroke(COLORS.panel, "#e3eaf4");
        doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted)
            .text(metric.label.toUpperCase(), x + 12, y + 14, { width: width - 24 });
        doc.font("Helvetica-Bold").fontSize(18).fillColor(metric.color || COLORS.ink)
            .text(metric.value, x + 12, y + 34, { width: width - 24 });
    });

    doc.y = y + height + 18;
}

function drawTable(doc, columns, rows, options = {}) {
    if (!rows.length) {
        doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text("Keine Daten im gewaehlten Zeitraum.");
        doc.moveDown();
        return;
    }

    const rowHeight = options.rowHeight || 20;
    const tableWidth = PAGE.width - PAGE.margin * 2;
    const widths = columns.map(column => column.width || tableWidth / columns.length);
    const headerY = doc.y;

    ensureSpace(doc, rowHeight * Math.min(rows.length + 1, 8));
    doc.rect(PAGE.margin, headerY, tableWidth, rowHeight).fill(COLORS.dark);
    let x = PAGE.margin;
    columns.forEach((column, index) => {
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff")
            .text(column.label, x + 6, headerY + 6, { width: widths[index] - 12, ellipsis: true });
        x += widths[index];
    });

    doc.y = headerY + rowHeight;
    rows.forEach((row, rowIndex) => {
        ensureSpace(doc, rowHeight + 8);
        const y = doc.y;
        if (rowIndex % 2 === 0) {
            doc.rect(PAGE.margin, y, tableWidth, rowHeight).fill("#fafbfd");
        }

        x = PAGE.margin;
        columns.forEach((column, index) => {
            doc.font("Helvetica").fontSize(8).fillColor(COLORS.ink)
                .text(niceLabel(row[column.key]), x + 6, y + 6, { width: widths[index] - 12, ellipsis: true });
            x += widths[index];
        });

        doc.y = y + rowHeight;
    });

    doc.moveDown(0.8);
}

function chartBounds(doc, title, height = 180) {
    ensureSpace(doc, height + 44);
    const x = PAGE.margin;
    const y = doc.y;
    const width = PAGE.width - PAGE.margin * 2;

    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink).text(title, x, y);
    const top = y + 24;
    doc.roundedRect(x, top, width, height, 8).fillAndStroke("#ffffff", "#e3eaf4");
    doc.y = top + height + 14;

    return { x: x + 36, y: top + 18, width: width - 56, height: height - 42 };
}

function drawAxes(doc, bounds, maxValue) {
    doc.strokeColor("#d6deeb").lineWidth(1);
    doc.moveTo(bounds.x, bounds.y).lineTo(bounds.x, bounds.y + bounds.height).stroke();
    doc.moveTo(bounds.x, bounds.y + bounds.height).lineTo(bounds.x + bounds.width, bounds.y + bounds.height).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted);
    doc.text(formatNumber(maxValue), bounds.x - 32, bounds.y - 3, { width: 26, align: "right" });
    doc.text("0", bounds.x - 32, bounds.y + bounds.height - 4, { width: 26, align: "right" });
}

function drawLineChart(doc, title, rows, color = COLORS.primary) {
    const bounds = chartBounds(doc, title);
    if (!rows.length) return;

    const maxValue = Math.max(1, ...rows.map(row => Number(row.count || 0)));
    drawAxes(doc, bounds, maxValue);

    const points = rows.map((row, index) => {
        const ratioX = rows.length === 1 ? 0 : index / (rows.length - 1);
        const ratioY = Number(row.count || 0) / maxValue;
        return {
            x: bounds.x + ratioX * bounds.width,
            y: bounds.y + bounds.height - ratioY * bounds.height
        };
    });

    doc.save();
    doc.strokeColor(color).lineWidth(2);
    points.forEach((point, index) => {
        if (index === 0) doc.moveTo(point.x, point.y);
        else doc.lineTo(point.x, point.y);
    });
    doc.stroke();

    points.filter((_, index) => rows.length <= 45 || index % Math.ceil(rows.length / 45) === 0)
        .forEach(point => doc.circle(point.x, point.y, 2).fill(color));
    doc.restore();

    doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted);
    doc.text(niceLabel(rows[0].label), bounds.x, bounds.y + bounds.height + 7, { width: 110 });
    doc.text(niceLabel(rows[rows.length - 1].label), bounds.x + bounds.width - 110, bounds.y + bounds.height + 7, { width: 110, align: "right" });
}

function drawBarChart(doc, title, rows, color = COLORS.primary) {
    const bounds = chartBounds(doc, title);
    if (!rows.length) return;

    const maxValue = Math.max(1, ...rows.map(row => Number(row.count || 0)));
    drawAxes(doc, bounds, maxValue);

    const gap = 4;
    const barWidth = Math.max(4, (bounds.width - gap * (rows.length - 1)) / rows.length);
    rows.forEach((row, index) => {
        const value = Number(row.count || 0);
        const barHeight = (value / maxValue) * bounds.height;
        const x = bounds.x + index * (barWidth + gap);
        const y = bounds.y + bounds.height - barHeight;
        doc.rect(x, y, barWidth, barHeight).fill(color);
    });

    doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted);
    rows.forEach((row, index) => {
        if (rows.length > 16 && index % Math.ceil(rows.length / 12) !== 0) return;
        const x = bounds.x + index * (barWidth + gap);
        doc.text(niceLabel(row.label), x - 8, bounds.y + bounds.height + 7, { width: barWidth + 16, align: "center" });
    });
}

function buildInterpretation(data) {
    const temporal = data.temporal || {};
    const byDay = temporal.byDay || [];
    const byHour = temporal.byHour || [];
    const byWeekday = temporal.byWeekday || [];

    if (!data.rowCount) return ["Im gewaehlten Zeitraum wurden keine Fenster-Events gefunden."];

    const bestDay = byDay.reduce((best, row) => Number(row.count) > Number(best.count || 0) ? row : best, {});
    const bestHour = byHour.reduce((best, row) => Number(row.count) > Number(best.count || 0) ? row : best, {});
    const bestWeekday = byWeekday.reduce((best, row) => Number(row.count) > Number(best.count || 0) ? row : best, {});
    const weekdayLabels = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

    const lines = [
        `Im gewaehlten Zeitraum wurden insgesamt ${formatNumber(data.rowCount)} Fenster-Events erfasst.`,
        byDay.length
            ? `Der staerkste Tag war ${bestDay.label} mit ${formatNumber(bestDay.count)} Events.`
            : "Es liegen keine auswertbaren Tageswerte vor.",
        byHour.length
            ? `Die hoechste Stundenhaeufigkeit liegt um ${bestHour.label}:00 Uhr.`
            : "Eine Stundenverteilung konnte nicht berechnet werden."
    ];

    if (bestWeekday.weekday !== undefined) {
        lines.push(`Der auffaelligste Wochentag ist ${weekdayLabels[Number(bestWeekday.weekday)]} mit ${formatNumber(bestWeekday.count)} Events.`);
    }

    return lines;
}

function createWindowEventsReportPdf(doc, data, period) {
    const temporal = data.temporal || {};
    const byDay = temporal.byDay || [];
    const byMonth = temporal.byMonth || [];
    const byHour = temporal.byHour || [];
    const byWeekday = temporal.byWeekday || [];
    const activeDays = byDay.length;
    const avgPerDay = activeDays ? data.rowCount / activeDays : 0;
    const range = temporal.range || {};
    const reportRange = period.label || `${period.startDate || "Start"} bis ${period.endDate || "Ende"}`;

    doc.info.Title = "Fenster Auswertung";
    doc.font("Helvetica-Bold").fontSize(24).fillColor(COLORS.ink)
        .text("Fenster Auswertung", PAGE.margin, PAGE.margin);
    doc.font("Helvetica").fontSize(11).fillColor(COLORS.muted)
        .text(`Zeitraum: ${reportRange}`, PAGE.margin, doc.y + 8)
        .text(`Erstellt am: ${formatDateTime(new Date().toISOString())}`)
        .text(`Datenquelle: ${data.tableName} / ${data.timestampColumn || "keine Zeitspalte"}`);

    doc.moveDown(1.6);
    drawMetricCards(doc, [
        { label: "Events", value: formatNumber(data.rowCount), color: COLORS.primary },
        { label: "Aktive Tage", value: formatNumber(activeDays), color: COLORS.green },
        { label: "Durchschnitt/Tag", value: formatNumber(avgPerDay, 1), color: COLORS.orange },
        { label: "Zeitspanne", value: activeDays ? `${activeDays} T.` : "0 T.", color: COLORS.ink }
    ]);

    sectionTitle(doc, "Zusammenfassung");
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.ink)
        .text(`Erfasster Datenbereich im Report: ${formatDateTime(range.start)} bis ${formatDateTime(range.end)}.`)
        .text(`Die Zeitfilterung wurde serverseitig ueber die Spalte "${data.timestampColumn || "-"}" angewendet.`);

    sectionTitle(doc, "Interpretation");
    buildInterpretation(data).forEach(line => {
        doc.font("Helvetica").fontSize(10).fillColor(COLORS.ink).text(`- ${line}`, { paragraphGap: 4 });
    });

    sectionTitle(doc, "Diagramme");
    drawLineChart(doc, "Events pro Tag", byDay, COLORS.primary);
    drawLineChart(doc, "Kumulierte Events", temporal.cumulativeByDay || [], COLORS.green);
    drawBarChart(doc, "Events pro Stunde", byHour.map(row => ({ label: `${row.label}:00`, count: row.count })), COLORS.primary);

    doc.addPage();
    sectionTitle(doc, "Weitere Verteilungen");
    drawBarChart(doc, "Events pro Monat", byMonth, COLORS.orange);
    drawBarChart(doc, "Events pro Wochentag", byWeekday.map(row => ({
        label: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][Number(row.weekday)],
        count: row.count
    })), COLORS.green);

    sectionTitle(doc, "Aggregierte Tabellen");
    drawTable(doc, [
        { label: "Tag", key: "label", width: 180 },
        { label: "Events", key: "count", width: 90 }
    ], byDay.slice(-18));

    drawTable(doc, [
        { label: "Monat", key: "label", width: 180 },
        { label: "Events", key: "count", width: 90 }
    ], byMonth);

    sectionTitle(doc, "Letzte Events im Zeitraum");
    drawTable(doc, data.columns.map(column => ({
        label: column.name,
        key: column.name,
        width: (PAGE.width - PAGE.margin * 2) / Math.max(1, data.columns.length)
    })), data.latestRows.slice(0, 20), { rowHeight: 22 });

    doc.end();
}

module.exports = {
    createWindowEventsReportPdf
};
