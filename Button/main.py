#!/usr/bin/env python3
"""
Simuliere realistische Fenster-Produktionsdaten für die letzten 6 Monate.
Fügt Einträge in die Tabelle window_events ein.
Läuft neben der bestehenden server.js – verwendet dieselbe Datenbank.
"""

import sqlite3
import random
import math
from datetime import datetime, timedelta
import os

DB_PATH = "fenster.db"  # Pfad zur Datenbank (gleiches Verzeichnis)

# ----------------------------------------
# Konfiguration
# ----------------------------------------
END_DATE = datetime(2026, 6, 28, 16, 00, 0)   # Heute 17:40 Uhr
START_DATE = END_DATE - timedelta(days=180)   # ca. 6 Monate

# Durchschnittliche Fenster pro Tag (realistisch)
BASE_DAILY_AVG = 12          # Grunddurchschnitt
WEEKEND_FACTOR = 0.4         # am Wochenende nur 40%
NOISE_AMPLITUDE = 0.4        # zufällige Schwankung

# Tageszeit-Verteilung: Wahrscheinlichkeiten pro Stunde (0-23)
#   Hohe Produktion am Vormittag, Nachmittag, weniger abends
HOUR_WEIGHTS = [
    0.2,  # 0 Uhr
    0.1,  # 1
    0.1,  # 2
    0.1,  # 3
    0.1,  # 4
    0.3,  # 5
    0.8,  # 6
    2.0,  # 7
    3.0,  # 8
    4.0,  # 9
    5.0,  # 10
    5.5,  # 11
    6.0,  # 12
    6.5,  # 13
    6.0,  # 14
    5.5,  # 15
    5.0,  # 16
    4.5,  # 17
    4.0,  # 18
    3.0,  # 19
    2.0,  # 20
    1.5,  # 21
    1.0,  # 22
    0.5   # 23
]

# Normieren der Stundengewichte
total_weight = sum(HOUR_WEIGHTS)
HOUR_PROBS = [w / total_weight for w in HOUR_WEIGHTS]

# ----------------------------------------
# Datenbankverbindung
# ----------------------------------------
def get_db_connection():
    """Stellt Verbindung zur SQLite-Datenbank her."""
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Datenbank {DB_PATH} nicht gefunden. "
                                "Bitte starte zuerst den Server (server.js), "
                                "damit die Tabelle erstellt wird.")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ----------------------------------------
# Hilfsfunktionen
# ----------------------------------------
def is_weekend(date):
    """Gibt True zurück, wenn das Datum auf ein Wochenende fällt (Samstag oder Sonntag)."""
    return date.weekday() >= 5  # 5=Samstag, 6=Sonntag

def daily_target(date):
    """
    Berechnet die erwartete Anzahl Fenster für einen Tag.
    Berücksichtigt Wochentag, saisonale Schwankungen und Rauschen.
    """
    # Basis: Durchschnitt
    base = BASE_DAILY_AVG
    
    # Wochenend-Faktor
    if is_weekend(date):
        base *= WEEKEND_FACTOR
    
    # Saisonale Schwankung: z.B. im Winter weniger, im Sommer mehr (nicht zu stark)
    # Wir simulieren eine leichte Sinus-Schwingung über das Jahr (hier grob)
    month_factor = 0.8 + 0.2 * math.sin((date.month - 1) * 2 * math.pi / 12)
    base *= month_factor
    
    # Zufällige Schwankung (log-normal-ähnlich, aber einfach mit Multiplikation)
    noise = 1.0 + random.uniform(-NOISE_AMPLITUDE, NOISE_AMPLITUDE)
    base *= noise
    
    # Mindestens 0 (kann bei starkem Rauschen negativ werden)
    base = max(0, base)
    
    # Auf ganze Zahl runden (Poisson-ähnlich)
    # Wir nehmen den ganzzahligen Anteil plus eine Bernoulli-Entscheidung für den Rest
    integer_part = int(base)
    fractional_part = base - integer_part
    if random.random() < fractional_part:
        integer_part += 1
    
    return integer_part

def generate_timestamps_for_day(date, count):
    """
    Erzeugt eine Liste von ISO-Zeitstempeln (lokal) für einen gegebenen Tag und Anzahl.
    Die Zeitstempel werden gemäß der Tageszeit-Verteilung verteilt.
    """
    if count <= 0:
        return []
    
    # Wähle zufällige Stunden basierend auf der Verteilung
    # Da wir mehrere Ereignisse pro Tag haben, ziehen wir count-mal aus der Stunden-Verteilung
    hours = random.choices(range(24), weights=HOUR_PROBS, k=count)
    
    timestamps = []
    for h in hours:
        # Minute gleichmäßig verteilt (0-59)
        minute = random.randint(0, 59)
        # Sekunde zufällig (0-59)
        second = random.randint(0, 59)
        dt = datetime(date.year, date.month, date.day, h, minute, second)
        # Format als ISO-String (ohne Zeitzone, da 'localtime' in SQLite)
        timestamps.append(dt.isoformat(' '))
    
    return timestamps

# ----------------------------------------
# Hauptfunktion
# ----------------------------------------
def main():
    print("Starte Simulation für Fenster-Produktionsdaten...")
    print(f"Zeitraum: {START_DATE.strftime('%Y-%m-%d')} bis {END_DATE.strftime('%Y-%m-%d %H:%M')}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Optional: Vorhandene Daten löschen? (Frage)
    answer = input("Sollen vorhandene Einträge gelöscht werden? (j/n): ")
    if answer.lower() == 'j':
        cursor.execute("DELETE FROM window_events")
        conn.commit()
        print("Vorhandene Daten gelöscht.")
    
    total_inserted = 0
    current_date = START_DATE
    day_count = 0
    
    while current_date <= END_DATE:
        # Ziel für diesen Tag
        target = daily_target(current_date)
        # Zeitstempel generieren
        timestamps = generate_timestamps_for_day(current_date, target)
        
        # Einfügen in die Datenbank
        for ts in timestamps:
            cursor.execute(
                "INSERT INTO window_events (created_at) VALUES (?)",
                (ts,)
            )
            total_inserted += 1
        
        day_count += 1
        if day_count % 30 == 0:
            print(f"Tag {day_count}: {current_date.strftime('%Y-%m-%d')} -> {target} Einträge (kumuliert {total_inserted})")
        
        current_date += timedelta(days=1)
    
    conn.commit()
    conn.close()
    
    print(f"\nFertig! {total_inserted} Fenster-Einträge wurden in den letzten 6 Monaten simuliert.")
    print("Du kannst jetzt den Server starten und das Dashboard mit realistischen Daten sehen.")

if __name__ == "__main__":
    main()
