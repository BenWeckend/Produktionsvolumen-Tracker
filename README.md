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
