# Fenster Dashboard

Das Projekt enthaelt eine lokale Node.js/Express-Dashboard-App im Ordner `Button`.
Die Weboberflaeche wird aus `Button/public` ausgeliefert, die API und SQLite-Logik liegen in `Button/server.js`.
Fuer den Desktop-Betrieb startet Electron denselben lokalen Server automatisch auf einem freien Port und oeffnet das Dashboard im App-Fenster. Diese Variante ist pragmatisch, weil die bestehende API- und Dashboard-Logik unveraendert weiterverwendet wird.

## Lokal als Node.js-App starten

```bash
cd Button
npm install
npm start
```

Danach ist das Dashboard unter `http://127.0.0.1:3000` erreichbar.

## Electron-App lokal testen

```bash
cd Button
npm install
npm run dev
```

Falls native Module nach einem Electron- oder Node-Wechsel neu gebaut werden muessen:

```bash
cd Button
npm run rebuild:electron
```

## Windows-Build erzeugen

```bash
cd Button
npm install
npm run build
```

Die Windows-Artefakte werden in `Button/dist` erzeugt. Konfiguriert sind ein portables `.exe` und ein NSIS-Installer. Fuer einen entpackten Testordner kann stattdessen `npm run build:dir` genutzt werden.

`electron-builder` baut native Module wie `better-sqlite3` fuer Electron um. Wenn danach wieder der reine Node.js-Server gestartet werden soll, kann das lokale Native-Modul wieder fuer Node gebaut werden:

```bash
cd Button
npm run rebuild:node
```

## Datenbank

Im lokalen Node.js-Betrieb nutzt die App standardmaessig `Button/fenster.db`.
In der Electron-App wird beim ersten Start eine Kopie der mitgelieferten Datenbank in den beschreibbaren Electron-Datenordner gelegt:

```text
%APPDATA%\Fenster Dashboard\fenster.db
```

Der Pfad kann fuer Spezialfaelle ueber die Umgebungsvariable `FENSTER_DB_PATH` ueberschrieben werden. Dadurch schreibt die gepackte App nicht in das Installationsverzeichnis und bleibt ohne absolute Projektpfade lauffaehig.

## Projektidee

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

## Bisheriger PM2-Betrieb

**Bringup:**
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
