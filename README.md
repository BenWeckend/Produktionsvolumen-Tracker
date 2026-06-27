# Fenster

Das Ziel ist für ein Fensterbauunternehmen einen Tracker zu bauen, welcher die Anzahl an produzierten Fenster loggt.

Idee:
Es gibt einen Buzzer der equivalent zu der Enter-Taste ist. Wenn dieser Gedrückt wird, zählt ein Zähler für den Tag hoch. Es sollen aber auch die folgenden weiteren Sachen angezeigt werden:
- Produktionsvolumen gestern
- Produktionsvolumen die letzten 30 tage
- Diagramm von Anzahl an Produzierten Fenster der letzten 7 tage & 30 Tage
- Balkendiagramm für Produktionsvolumen pro Stunde

Logik:
- Via html, css und javascript mit der Node.js Laufzeitumgebung die Applikation bauen
- Mit Chart.js die Visualisierungen
- In einer SQLite Datenbank alle Daten speichern
- Einen seperaten Button erstellen wo eine Analyse der Daten als pdf generiert wird und die Daten jeweils als .xml nochmal seperat gespeichert werden. 
    - Für die letzten 30 Tage
    - Für die letzten 90 Tage
    - Für alle Daten

*Windows Bringup: (Branch: WinDev_portable)*
- Der Auftrag war eine Windows Version zu erstellen, welche ganz einfach mit doppelklick ohne Terminal & Befehl aufgerufen werden kann.
- Dazu soll der Zielcomputer zu keinem Zeitpunkt (auch beim Setup) mit dem Internet verbungen sein. 😅
    - Aufgrunddessen musste das Project mit Portable Node.js realisiert werden. Die Skripte für das Setup sind unter Button/setup/ zu finden.
    - Mit einem doppelklick auf start.bat wird automatisch die App gestartet und  localhost:3000 im Browser ausgeführt.

*Linux Bringup: (Branch: main)*
```
# 1. PM2 global installieren
npm install -g pm2

# 2. Server starten
pm2 start server.js --name fenster

# 3. Status prüfen
pm2 status

# 4. Logs anzeigen (optional)
pm2 logs fenster

# 5. Autostart einrichten
pm2 save
pm2 startup
# > Den angezeigten Befehl (z.B. "sudo env ...") kopieren und ausführen

# 6. Server dauerhaft laufen lassen. Terminal kann geschlossen werden!
```

**Verwaltung:**
```
pm2 restart fenster    # Server neu starten (z.B. nach Code-Änderung)
pm2 stop fenster       # Server stoppen
pm2 delete fenster     # Server komplett entfernen
pm2 reload fenster     # Zero-Downtime-Reload (bei Clustermodus)
```

**Logs & Monitoring:**
```
pm2 logs fenster       # Live-Logs anzeigen
pm2 monit              # CPU/Memory-Überwachung
pm2 list               # Alle laufenden Prozesse
```


<img width="1920" height="1080" alt="Bildschirmfoto vom 2026-06-16 09-46-47" src="https://github.com/user-attachments/assets/472baa4d-dce7-4485-83bf-fcecfd97bb45" />
