# ScoreBuddy – Projektkontext und Leitfaden für die weitere Umsetzung

Stand: 9. August 2026

Diese Datei ist die zentrale technische Projektnotiz für spätere Arbeiten. Sie beschreibt den aktuell geprüften Stand des Repositories, bekannte Risiken, den vorgesehenen Betrieb auf dem NAS und eine sinnvolle Reihenfolge für die weitere Umsetzung.

## V2-Redesign (Branch `staging`)

Im Branch `staging` wird die bestehende Anwendung optisch vollständig als modernes, von iOS-Liquid-Glass inspiriertes Interface überarbeitet. Der Branch ist bewusst vom automatisch auf dem NAS aktualisierten Branch `main` getrennt.

Geändert werden die Darstellung, oberflächennahe Komfortfunktionen und gezielte abwärtskompatible Fehlerkorrekturen:

- neue App-Kopfzeile mit ScoreBuddy-Marke
- helles und dunkles Glas-Design mit dynamischer Hintergrundtiefe
- reduzierte, textbasierte Navigation und Werkzeugleiste ohne dekorative Emoji-Icons
- kontrastreicher Light Mode mit klar hervorgehobenen Karten, Eingaben und aktiven Zuständen
- weicher Dark Mode in Navy-/Graphit-Tönen statt nahezu schwarzer beziehungsweise stark violetter Flächen
- neue schwebende Hauptnavigation
- modernisierte Karten, Spielstände, Punkt-Eingaben und Auswahllisten
- einheitliche Darstellung von Rangliste, Historie, Regelwerk und Modalen
- optimierte Touch-Ziele, Safe-Area-Abstände, Fokusdarstellung und reduzierte Animationen auf Wunsch des Betriebssystems
- synchronisierte Browser-Theme-Farbe und aussagekräftigere Beschriftungen
- optionaler Fokusmodus für laufende Spiele mit reduzierter Navigation, größeren Eingaben und sitzungsweiser Wiederherstellung
- bestmögliches Display-Wachhalten und Hochformat-Sperren über Browser-APIs; auf nicht unterstützten iPhones blockiert ein eigener Querformat-Hinweis die Spieleingabe
- Ergebnisansicht mit direkter Revanche sowie einer vorausgefüllten Spielanpassung, über die Teilnehmer, Teams, Reihenfolge, Wertung und Spielmodus vor dem nächsten Start geändert werden können
- erweitertes Statistik-Dashboard mit Gesamtpartien, Anzahl gewerteter Spiele, aktiven Spielern, meistgespieltem Spiel, sortierbarer Bestenliste und filterbarer Historie inklusive Teilnehmer- und Rundenzahl

Bewusst unverändert bleiben:

- alle vorhandenen API-Routen und die Umschaltung zwischen lokalem Browser-Speicher und NAS-API
- die verwendeten State-Schlüssel
- `gamesConfig.js` und alle hinterlegten Spiele/Regeln
- SQLite-Tabelle, JSON-Strukturen und bestehender Datenbankpfad
- IDs, Spielhistorie, Spielerstatistiken, aktive Partien und laufende Partien
- Docker-/NAS-Startkommando und Portbelegung

Damit ist für V2 keine Datenmigration und kein Frontend-Build erforderlich. Die produktive `/app/scoreboard.db` bleibt unverändert. Vor einem späteren Merge nach `main` muss trotzdem eine Sicherung dieser Datei erstellt werden. Solange V2 nur auf dem Branch `staging` liegt, zieht die Produktivinstanz weiterhin `main` und bleibt unverändert. Die separate Staging-Instanz verwendet dagegen bewusst eine eigene, derzeit leere Datenbank unter `/data/scoreboard.db`.

### Fehlerkorrekturen im V2-Stand

- Wizard zeigt nach dem Speichern zuverlässig die nächste Runde an und beendet die Eingabe nach `floor(60 / Spielerzahl)` Runden.
- Wizard zeigt die Person an, die links vom aktuellen Geber mit der Ansage beginnt und den ersten Stich eröffnet. Das Eingabefenster sortiert die Spieler automatisch in dieser Ansagereihenfolge.
- Startperson und Geber können im Wizard-Eingabefenster manuell korrigiert werden. Da beide Rollen zusammenhängen, setzt die Wahl der Startperson automatisch die vorherige Person in der Reihenfolge als Geber.
- Wizard verhindert doppelte Übermittlungen, Dezimal-/Negativwerte und eine falsche Summe der tatsächlich gemachten Stiche. Die Summe der Ansagen darf entsprechend der verwendeten Spielvariante der Rundenzahl entsprechen.
- Wizard-Entwürfe werden verzögert gespeichert; während eines geöffneten Modals überschreibt der Live-Abgleich keine laufende Eingabe.
- Spiele mit `winCondition: "lowest"` markieren im laufenden Spiel und in Gleichständen den tatsächlich niedrigsten Wert als besten Spielstand.
- Neue abgeschlossene Partien speichern zusätzlich optionale `winnerPartyIds`. Alte Partien bleiben kompatibel und werden über exakte Namen statt unsicherer Teiltreffer ausgewertet.
- Beim Löschen einer historischen Partie werden auch negative Punkte mathematisch korrekt zurückgerechnet.
- Die Bestenliste kann nach dem tatsächlich gespeicherten Spielnamen gefiltert werden (z. B. ein Custom-Spiel „Rome“). Gesamtpunkte bleiben in der spielübergreifenden Ansicht verborgen und werden nur innerhalb eines konkret ausgewählten Spiels angezeigt und sortierbar, weil nur dort dieselbe Wertungslogik verglichen wird.
- API-Fehler und beschädigtes JSON werden kontrolliert behandelt; ein fehlgeschlagener Abruf ersetzt den letzten gültigen Frontend-State nicht mehr durch leere Daten.
- Die vier regelmäßigen Ladevorgänge laufen parallel. Das SQLite-Schema und der Datenbankpfad wurden nicht verändert.
- Der Live-Abgleich rendert Seiten nur noch bei tatsächlich geänderten Daten, pausiert bei Texteingaben, offenen Modalen und unsichtbaren Browser-Tabs und verhindert überlappende Aktualisierungen. Beginnt während eines Ladevorgangs ein Speichervorgang, wird die möglicherweise veraltete Ladeantwort verworfen.
- Die Plus-/Minus-Schalter der Punktefelder verhindern auf Touch-Geräten den Fokuswechsel zum Button. Dadurch bleibt das Zahlenfeld aktiv und die iOS-Zahlentastatur beim Umschalten des Vorzeichens geöffnet.

## 1. Ziel und Einsatz

ScoreBuddy ist eine mobile, deutschsprachige Web-App für Spieleabende. Sie verwaltet Spieler, laufende beziehungsweise pausierte Partien, Spielergebnisse, Ranglisten und Spielregeln. Die Anwendung soll im lokalen Netz auf einem Ugreen NAS DXP4800 GT in Docker laufen und von Smartphones oder anderen Geräten im Browser verwendet werden.

Vom Besitzer bestätigter Betriebszustand:

- Docker läuft bereits auf dem NAS.
- Die Anwendung läuft über eine auf dem NAS hinterlegte Compose-Konfiguration; diese Datei ist derzeit nicht im Repository eingecheckt.
- Der Container verwendet `node:18-alpine`, bind-mountet sein Arbeitsverzeichnis nach `/app`, veröffentlicht Port `8085` auf Container-Port `3000` und läuft mit `restart: unless-stopped`.
- Beim Containerstart installiert das Startkommando Git, führt je nach Zustand `git init`/`git fetch`/`git reset` oder `git pull` aus und startet anschließend `node server.js`.
- Ein Push in das Repository stößt nach Aussage des Besitzers bereits ein automatisches Update der laufenden Anwendung an. Da die Compose-Konfiguration selbst nur **beim Containerstart** pullt, muss der dafür nötige Neustart oder Recreate durch einen zusätzlichen NAS-Dienst, Webhook oder Updater ausgelöst werden.
- Änderungen an `main` können dadurch unmittelbar die NAS-Instanz betreffen. Vor einem Push sollten deshalb mindestens Syntax, Kernabläufe und Datenkompatibilität geprüft werden.

### Separat bereitgestellte Staging-Instanz

Am 9. August 2026 wurde auf dem NAS eine vollständig von Produktion getrennte Staging-Instanz eingerichtet und geprüft:

| Eigenschaft | Produktion | Staging |
| --- | --- | --- |
| Git-Branch | `main` | `staging` |
| Container | `game-scoreboard-db` | `game-scoreboard-staging` |
| NAS-Verzeichnis | `/volume2/docker/scoreboard-server` | `/volume2/docker/scoreboard-staging` |
| Port | `8085` | `8086` |
| Datenbank | `/volume2/docker/scoreboard-server/scoreboard.db` | `/volume2/docker/scoreboard-staging/data/scoreboard.db` |

Die Staging-Konfiguration liegt im Repository als `docker-compose.staging.yml`; auf dem NAS liegt sie als `/volume2/docker/scoreboard-staging/docker-compose.yml`. Code (`./app:/app`) und Daten (`./data:/data`) sind dort separat eingebunden. Der Container setzt `DB_PATH=/data/scoreboard.db`, besitzt einen Healthcheck und eine begrenzte Log-Rotation.

Bestätigter Zustand bei der Einrichtung:

- Staging lief als `healthy` mit Commit `7b31018` vom Branch `staging`.
- `http://100.113.89.85:8086/api/players` war über Tailscale erreichbar und lieferte erwartungsgemäß `[]`.
- Die produktive Instanz auf Port `8085` blieb durchgehend aktiv und lieferte weiterhin die vorhandenen Spieler.
- Ein Containerstart aktualisiert Staging mit `git fetch` und `git reset --hard origin/staging`. Ein automatischer Neustart unmittelbar nach jedem Push ist für Staging noch nicht separat nachgewiesen oder eingerichtet.
- Produktive Daten dürfen nicht nach Staging kopiert werden, sofern dies nicht ausdrücklich für einen Test gewünscht und zuvor abgesichert wurde.

## 2. Aktueller technischer Aufbau

Die Anwendung ist bewusst klein und ohne Frontend-Framework aufgebaut:

- Frontend: HTML, CSS und Vanilla JavaScript mit ES-Modulen
- Backend: Node.js mit Express
- Datenbank: SQLite
- Server-Port: fest auf `3000` eingestellt
- Bind-Adresse: `0.0.0.0`, damit die App im LAN erreichbar ist
- Sprache und Datumsdarstellung: Deutsch / `de-DE`

Wichtige Dateien:

| Datei | Aufgabe |
| --- | --- |
| `index.html` | Grundgerüst, Navigation, Seitencontainer und Modalfenster |
| `style.css` | Komplettes responsives Layout inklusive Dark Mode |
| `app.js` | Hauptlogik und UI; derzeit etwa 2.500 Zeilen |
| `api.js` | Umschaltung zwischen Browser-Speicher und HTTP-API |
| `state.js` | Zentraler Frontend-State und Laden aller Datensätze |
| `gamesConfig.js` | Vorgefertigte Spiele, Regeln und Endbedingungen |
| `config.js` | Nicht eingebundener älterer State-/Cabo-Entwurf; derzeit nur Referenz |
| `icon.png` | Apple-Touch-Icon |
| `server.js` | Express-Server, statische Dateien und SQLite-Endpunkte |
| `.gitignore` | Schließt Abhängigkeiten, SQLite-Laufzeitdateien und lokale Dateien aus |
| `PROJECT_CONTEXT.md` | Architektur, Risiken, Deploymentwissen und Roadmap |

Es gibt aktuell keine sichtbare `package.json`, Lock-Datei, Dockerfile, Tests, README, CI-Konfiguration oder Datenbankmigrationen im Repository. Für Staging existiert `docker-compose.staging.yml`.

Die Browserdateien bleiben bewusst im Projektstamm, damit die bestehende Entwicklung mit VS Code Live Server ohne Buildschritt funktioniert. Express blockiert den direkten Abruf von `server.js` und den SQLite-Laufzeitdateien, bevor es die übrigen Dateien statisch ausliefert.

### Aktuelle NAS-Compose-Logik

Die vom Besitzer übermittelte Konfiguration entspricht in normalisierter Form diesem Ablauf:

```yaml
services:
  scoreboard:
    image: node:18-alpine
    container_name: game-scoreboard-db
    working_dir: /app
    volumes:
      - .:/app
    ports:
      - "8085:3000"
    command: >
      sh -c "
      apk add --no-cache git &&
      git config --global --add safe.directory /app &&
      mkdir -p data &&
      if [ ! -d '.git' ]; then
        git init &&
        git remote add origin https://github.com/F-Hartwig/my-game-scoreboard.git &&
        git fetch --all &&
        git reset --hard origin/main &&
        npm install express sqlite3;
      else
        git pull https://github.com/F-Hartwig/my-game-scoreboard.git main;
      fi &&
      node server.js
      "
    restart: unless-stopped
```

Die Einrückung in der tatsächlich auf dem NAS gespeicherten Datei muss natürlich gültiges YAML sein; die Chat-Darstellung hatte die Listeneinträge optisch anders eingerückt.

Auswirkungen des Bind-Mounts:

- Der Inhalt des NAS-Verzeichnisses, in dem Compose ausgeführt wird, ist direkt `/app`.
- `scoreboard.db` liegt mit dem aktuellen `server.js` in diesem gemounteten Verzeichnis und überlebt dadurch Container-Neustarts und Imagewechsel. Die Persistenz ist also aktuell vorhanden, solange dieses NAS-Verzeichnis erhalten bleibt.
- Der erstellte Ordner `/app/data` wird vom Server noch nicht verwendet.
- Quellcode, Git-Metadaten, installierte `node_modules` und Datenbank teilen sich dasselbe Hostverzeichnis.
- Das Deployment baut kein unveränderliches Image; der laufende Container aktualisiert stattdessen den bind-gemounteten Arbeitsbaum.

## 3. Funktionsumfang

Der geprüfte Stand enthält unter anderem:

- Spieler anlegen, umbenennen, favorisieren und löschen
- Gewertete und ungewertete Partien
- Einzelspieler und temporär zusammengestellte Teams
- Rundenmodus und flexibler Einzelpunkte-Modus
- Laufende Partien pausieren, fortsetzen und verwerfen
- Historie, Rangliste, Spielerprofile und Revanche
- Dark Mode
- Startspieler-Auswahl, Geber-Rotation, Timer und Würfel
- Spezielle Wizard-Rundeneingabe mit Ansage und Stichzahl
- Automatische Spielgrenzen und Sonderregeln
- Live-Abgleich des Zustands alle zwei Sekunden

Vordefinierte Spiele:

- Custom-Spiel
- Cabo
- Skyjo
- Skyjo Action
- Canasta
- Flip 7
- Wizard
- Codenames ist als Regelwerk hinterlegt, aber für den Spielstart ausgeblendet.

Die in `gamesConfig.js` hinterlegten Regeln sind fachlicher Inhalt und wurden bei dieser technischen Prüfung nicht gegen offizielle Spielanleitungen verifiziert.

## 4. Datenmodell und API

SQLite enthält derzeit nur eine generische Key-Value-Tabelle:

```sql
CREATE TABLE IF NOT EXISTS state (
    id TEXT PRIMARY KEY,
    json_data TEXT
);
```

Verwendete Schlüssel:

- `players`: Array aller Spieler und aggregierter Statistiken
- `games`: Array der abgeschlossenen Partien
- `activeGames`: Array pausierter Partien
- `currentGame`: aktuell laufende Partie oder `null`

Vorhandene Routen:

| Methode | Route | Inhalt |
| --- | --- | --- |
| GET/POST | `/api/players` | Spielerliste |
| GET/POST | `/api/games` | abgeschlossene Spiele |
| GET/POST | `/api/activeGames` | pausierte Spiele |
| GET/POST | `/api/currentGame` | laufendes Spiel |

Jeder Schreibvorgang ersetzt den vollständigen JSON-Wert eines Schlüssels. Es gibt derzeit keine serverseitige Schema-Prüfung, Versionierung, Authentifizierung oder Konflikterkennung.

Wichtige Struktur einer Partie:

```text
game
├── id, gameTypeId, name, mode, rated, date
├── rules
├── winner, optional winnerPartyIds[] (erst nach Abschluss)
└── players[]
    ├── id, name
    ├── isTeam, playerIds[]
    ├── rounds[]
    └── total
```

IDs werden momentan über `Date.now()` erzeugt.

## 5. Offline- und Online-Verhalten

`api.js` entscheidet anhand des Hostnamens:

- Bei `localhost` oder `127.0.0.1` wird ausschließlich `localStorage` verwendet.
- Bei allen anderen Hostnamen wird `/api/...` aufgerufen.

Folgen:

- Ein lokal im Browser über `localhost:3000` geöffneter Express-Server testet nicht die SQLite-API, sondern nur den Offline-Modus.
- Für einen echten lokalen Backend-Test muss entweder die Umschaltung geändert oder die App über einen anderen Hostnamen beziehungsweise eine LAN-IP geöffnet werden.
- Offline- und NAS-Daten sind vollständig voneinander getrennt.

Diese implizite Hostnamenlogik sollte später durch eine bewusste Konfiguration ersetzt werden, zum Beispiel einen klaren Entwicklungsmodus oder einen expliziten Fallback.

## 6. Wichtigste Risiken vor weiteren Features

### Priorität 0 – Daten und Sicherheit

1. **Persistenz im Container ist noch nicht vollständig getrennt.**
   Die Datenbank liegt aktuell neben `server.js`. Der bestehende Bind-Mount `.:/app` sorgt zwar dafür, dass sie momentan auf dem NAS erhalten bleibt, vermischt aber Code, Abhängigkeiten und Nutzdaten. Der Pfad sollte über `DB_PATH` oder `DATA_DIR` konfigurierbar sein und auf ein separates dauerhaft eingebundenes NAS-Verzeichnis wie `/data` zeigen. Vor der Umstellung muss die bestehende produktive `/app/scoreboard.db` gesichert und gezielt migriert werden.

2. **Stored-XSS durch Namen und andere Benutzereingaben.**
   Spieler- und Spielnamen werden an vielen Stellen ungefiltert in `innerHTML` und sogar in HTML-Attribute eingesetzt. Ein Name mit HTML oder Anführungszeichen kann das DOM verändern und JavaScript ausführen. Dynamische Texte müssen über `textContent`/DOM-APIs ausgegeben oder zuverlässig escaped werden. Die fest im Quellcode enthaltenen Regeltexte dürfen separat als bewusst erlaubtes HTML behandelt werden.

3. **Keine Zugriffskontrolle.**
   Jeder Client, der den Server erreicht, kann alle Zustände lesen und überschreiben. Das ist nur in einem vollständig vertrauenswürdigen LAN vertretbar. Bei Zugriff über das Internet, Reverse Proxy, VPN-Freigaben oder Gäste-WLAN sind mindestens HTTPS und Authentifizierung beziehungsweise eine vorgeschaltete Zugriffskontrolle nötig.

4. **Mehrere zusammengehörige Schreibvorgänge sind nicht atomar.**
   Beim Beenden einer Partie werden `players`, `activeGames`, `games` und `currentGame` nacheinander gespeichert. Scheitert einer dieser Requests, sind Statistiken und Historie inkonsistent. Dafür sollte es eine einzige serverseitige Aktion mit SQLite-Transaktion geben.

Bereits entschärft: Die SQLite-Datei wurde zuvor durch `express.static(__dirname)` potenziell öffentlich ausgeliefert. Eine vorgeschaltete Sperrliste beantwortet Abrufe von `server.js`, der Datenbank sowie deren `-shm`-/`-wal`-Dateien nun mit HTTP 404. Eine spätere saubere Trennung in ein öffentliches Verzeichnis bleibt für den NAS-Betrieb sinnvoll, darf aber nicht ohne Anpassung des lokalen Live-Server-Workflows erfolgen.

### Priorität 1 – Zuverlässigkeit

1. **Mehrere Browser können Änderungen gegenseitig überschreiben.**
   Jeder Client lädt komplette Arrays und speichert sie wieder vollständig. Zwei fast gleichzeitige Änderungen basieren möglicherweise auf unterschiedlichen Ständen; der letzte POST gewinnt. Benötigt werden mindestens Versionsnummern/optimistische Sperren, besser fachliche API-Aktionen oder Transaktionen.

2. **API-Fehler sind noch nicht überall in der Oberfläche sichtbar.**
   HTTP-Status und JSON-Fehler werden inzwischen erkannt, und fehlgeschlagene Abrufe ersetzen den letzten gültigen State nicht mehr. Viele Schreibaktionen protokollieren einen Fehlschlag aber weiterhin nur in der Browser-Konsole. Für kritische Aktionen fehlen noch ein sichtbarer Fehlerzustand und ein sauberer Wiederholungsablauf.

3. **Beschädigtes SQLite-JSON muss weiterhin administrativ repariert werden.**
   Der Server fängt den Parse-Fehler inzwischen ab und antwortet kontrolliert mit HTTP 500, kann den beschädigten Datensatz aber nicht selbst wiederherstellen.

4. **Die Historie wächst als ein einzelner JSON-Block.**
   Express verwendet standardmäßig ein relativ kleines JSON-Body-Limit. Mit wachsender Historie werden Requests langsam und können irgendwann abgewiesen werden. Mittelfristig sollten Partien als einzelne Datensätze gespeichert oder das Limit kontrolliert angepasst werden.

5. **SQLite ist nicht für Containerbetrieb abgestimmt.**
   WAL-Modus, `busy_timeout`, kontrolliertes Schließen bei `SIGTERM` und ein Backup-/Restore-Prozess fehlen.

6. **Polling erzeugt unnötige Last und Konfliktpotenzial.**
   Pro geöffnetem Gerät werden alle zwei Sekunden vier GET-Requests ausgeführt, also ungefähr 120 Requests pro Minute. Sie laufen inzwischen parallel und pausieren während Modaleingaben. Sinnvolle weitere Verbesserungen sind das Pausieren bei unsichtbarem Browser-Tab und ein längeres oder adaptives Intervall. Später wären ein zusammengefasster State-Endpunkt, Server-Sent Events oder WebSockets denkbar.

7. **Der aktuelle Container verwendet eine nicht mehr unterstützte Node-Version.**
   Node.js 18 ist seit dem 27. März 2025 End-of-Life und erhält keine regulären Sicherheitsupdates mehr. Vor dem Wechsel auf eine unterstützte LTS-Version muss insbesondere geprüft werden, ob das native `sqlite3`-Paket unter der neuen Node-/Alpine-Kombination sauber installiert und ausgeführt wird. Quelle: [offizielle Node.js-Versionsübersicht](https://nodejs.org/en/about/previous-releases).

### Priorität 2 – Wartbarkeit und Bedienung

- `app.js` bündelt UI, Spiellogik, Statistiken und Werkzeuge in einer sehr großen Datei.
- Es gibt kein festgehaltenes Datenformat mit einer `schemaVersion`; spätere Änderungen an gespeicherten Partien werden dadurch riskant.
- IDs über `Date.now()` können bei sehr schnellen oder verteilten Erstellungen kollidieren. `crypto.randomUUID()` ist robuster.
- Neue Partien speichern Gewinner über `winnerPartyIds`; alte Partien werden über exakte Namen kompatibel ausgewertet. Eine spätere Datenmigration könnte die IDs auch für alte Historieneinträge ergänzen.
- Das Löschen historischer Spiele rekonstruiert Statistiken durch Subtraktion. Stabiler wäre, Statistiken aus der Historie neu zu berechnen oder atomar serverseitig zu aktualisieren.
- In HTML-Regeltexten vorkommende Markdown-Zeichen wie `**Text**` werden nicht als Fettformatierung gerendert.
- Eine PWA-Manifestdatei und ein Service Worker fehlen; die App besitzt derzeit nur Icon- und Mobile-Viewport-Grundlagen.

### Priorität 2 – Aktuelles Deployment robuster machen

- `apk add --no-cache git` läuft bei jedem Start. Dadurch braucht sogar ein normaler Neustart Zugriff auf die Alpine-Paketserver und kann bei einem Netz- oder Repositoryfehler scheitern.
- Auch der Git-Pull liegt im Startpfad. Ist GitHub beim Neustart nicht erreichbar, startet die Anwendung nicht mit dem bereits vorhandenen Code weiter.
- `npm install express sqlite3` läuft nur, wenn noch kein `.git`-Ordner existiert. Die Bedingung prüft nicht, ob `node_modules` vollständig ist. Bei vorhandener Git-Arbeitskopie und fehlenden Modulen scheitert der Start.
- Bei späteren Änderungen an Abhängigkeiten wird im Update-Zweig überhaupt kein `npm install` beziehungsweise `npm ci` ausgeführt.
- Ohne eingecheckte `package.json` und Lock-Datei hängt die installierte Paketversion vom Zeitpunkt der ersten Einrichtung ab und lässt sich nicht reproduzieren.
- `git pull ... main` kann mit lokalen Änderungen oder auseinander gelaufener Historie kollidieren. Es gibt keinen geprüften Build, Healthcheck oder automatischen Rollback auf die vorherige Version.
- Der Standardbenutzer des `node`-Images ist in diesem Setup nicht explizit gesetzt; Startbefehl, Paketinstallation und Anwendung laufen daher voraussichtlich als Root.
- Das mutable Tag `node:18-alpine` bezeichnet nicht dauerhaft exakt denselben Image-Inhalt.
- Ein sauber gebautes, versioniertes Anwendungsimage wäre langfristig zuverlässiger. Der bestehende Pull-im-Container-Ablauf kann zunächst weiterlaufen, sollte aber nach Absicherung der Daten schrittweise ersetzt werden.

## 7. Empfohlene Umsetzungsreihenfolge

### Phase A – Reproduzierbarer und sicherer Grundbetrieb

1. Produktionsdatenbank auf dem NAS sichern und aktuellen Volume-Pfad dokumentieren.
2. `package.json` mit festgelegter Node-Version, Startskript und Abhängigkeiten ergänzen.
3. Lock-Datei einchecken.
4. Laufzeit auf eine unterstützte Node-LTS-Version aktualisieren und `sqlite3` dabei testen.
5. Die vorhandene `/app/scoreboard.db` nach Sicherung in ein separates persistentes `/data`-Volume migrieren und `DB_PATH=/data/scoreboard.db` setzen.
6. Health-Endpunkt, Docker-Healthcheck und sauberes `SIGTERM`-Handling ergänzen.
7. Den externen Trigger, der nach einem Push den Container neu startet, sowie dessen Fehler- und Rollbackverhalten dokumentieren.
8. Danach den Pull-im-Container-Ansatz durch ein gebautes und getestetes, versioniertes Image ersetzen.

Bereits erledigt:

- `PORT`, `HOST` und `DB_PATH` optional per Umgebungsvariable konfigurierbar gemacht; bestehende Standardwerte bleiben kompatibel
- direkten HTTP-Abruf von Servercode und SQLite-Laufzeitdateien blockiert
- doppelten Stylesheet-Import und doppelte globale Registrierungen entfernt
- `.gitignore` für Abhängigkeiten und SQLite-Laufzeitdateien ergänzt

### Phase B – Datenverlust und Angriffe verhindern

1. Benutzereingaben beim Rendern konsequent escapen.
2. Serverseitige Payload-Schemata und erlaubte Endpoint-Namen validieren.
3. Frontend-Fehlerbehandlung mit sichtbarem Offline-/Speicherfehler-Status einführen.
4. Partie-Abschluss, Pause/Fortsetzen und Historienlöschung als atomare Backend-Aktionen umsetzen.
5. Zugriffskonzept festlegen: nur vertrauenswürdiges LAN, VPN oder Authentifizierung am Reverse Proxy.
6. Regelmäßiges SQLite-Backup mit getesteter Wiederherstellung einrichten.

### Phase C – Datenmodell und Synchronisation

1. `schemaVersion` und Migrationen einführen.
2. Spiele einzeln statt als wachsendes Gesamtarray speichern.
3. Gewinner-IDs zusätzlich zum Anzeigenamen speichern.
4. Gleichzeitige Änderungen über Revisionen oder fachliche API-Kommandos absichern.
5. Live-Synchronisation effizienter und konfliktarm gestalten.

### Phase D – Qualität und Struktur

1. Tests für Punkteberechnung, Sonderregeln, Teams, Gleichstände, Wizard und Statistik-Rückrechnung schreiben.
2. Smoke-Test für API, Datenpersistenz und Neustart des Containers ergänzen.
3. `app.js` schrittweise nach Domänen aufteilen, zum Beispiel `players`, `games`, `stats`, `sync`, `tools` und `ui`.
4. Nicht verwendeten Altcode entfernen, sobald durch Tests abgesichert.
5. Optional PWA-Unterstützung ergänzen, wenn Installation auf Smartphones gewünscht ist.

## 8. NAS-/Docker-Checkliste

Vor jeder Änderung an Persistenz oder Deployment:

- Aktuell ist `/app/scoreboard.db` im bind-gemounteten Compose-Arbeitsverzeichnis zu erwarten; den tatsächlichen Pfad auf dem NAS vor Änderungen bestätigen.
- Datenbankdatei sichern und Wiederherstellung testen.
- `main` ist der in der Compose-Konfiguration gepullte Branch.
- Ermitteln und dokumentieren, welcher externe Mechanismus den Container nach einem Push neu startet.
- Prüfen, ob dieser Mechanismus nur bei erfolgreichem Build aktualisiert; die gezeigte Compose-Konfiguration enthält selbst keinen Build- oder Testschritt.
- Vorherige Image-Version für Rollback behalten.
- NAS-CPU-Architektur mit `uname -m` prüfen und Image passend oder multiarch bauen.
- Persistentes Verzeichnis mit Schreibrechten für den nicht privilegierten Container-Benutzer mounten.
- Port nur im benötigten Netzwerk veröffentlichen.
- Zeitzone `Europe/Berlin` setzen, sofern Datums-/Zeitfunktionen später serverseitig verwendet werden.
- `restart: unless-stopped` oder eine vergleichbare Restart-Policy verwenden.
- Healthcheck nicht nur auf einen statischen Abruf, sondern auf Server- und Datenbankbereitschaft ausrichten.
- Logs rotieren, damit der NAS-Speicher nicht unkontrolliert wächst.
- Keine produktive SQLite-Datei ins Git-Repository aufnehmen.

Ein künftiges Zielbild könnte folgende Laufzeitparameter verwenden:

```text
PORT=3000
HOST=0.0.0.0
DB_PATH=/data/scoreboard.db
TZ=Europe/Berlin
NODE_ENV=production
```

Diese Werte werden von der Staging-Instanz bereits verwendet. Die produktive Instanz nutzt weiterhin ihren bisherigen Aufbau.

## 9. Definition of Done für künftige Änderungen

Eine Änderung sollte vor dem Push möglichst folgende Punkte erfüllen:

- JavaScript-Syntaxprüfung erfolgreich
- Relevante automatisierte Tests erfolgreich
- App lädt auf Smartphone-Breite und Desktop
- Spieler anlegen/ändern/löschen funktioniert
- Spiel starten, Runde speichern, pausieren und fortsetzen funktioniert
- Spielabschluss aktualisiert Historie und Statistik konsistent
- Daten bleiben nach Container-Neustart erhalten
- Fehlerhafte API-Antwort führt nicht zum Überschreiben mit leeren Daten
- Keine neue ungefilterte Benutzereingabe in `innerHTML`
- Bestehende gespeicherte Daten bleiben kompatibel oder werden migriert
- Bei Änderungen an Deployment/Persistenz ist ein Rollback möglich

## 10. Bereits durchgeführte Prüfung

Bei der Erstellung dieser Notiz wurden alle eingecheckten Projektdateien und die letzten Commits statisch gesichtet. Die JavaScript-Dateien wurden mit dem in Codex gebündelten Node.js-Parser auf Syntax geprüft; die Prüfung war erfolgreich.

Nach dem Struktur-Cleanup wurden alle ES-Modul-Imports, HTML-Assetpfade und erwarteten Dateien geprüft. Der Root-Aufruf sowie `app.js`, `api.js` und `gamesConfig.js` wurden außerdem über einen lokalen statischen HTTP-Server wie bei VS Code Live Server erfolgreich mit HTTP 200 abgerufen. `git diff --check` meldet keine Formatierungsfehler. Ein vollständiger Express-Serverstart war lokal nicht möglich, weil `express` und `sqlite3` nicht als reproduzierbar installierbare Projektabhängigkeiten im Repository vorliegen.

Zusätzlich wurde die Staging-Compose-Datei lokal und auf dem NAS validiert. Der Containerstart, Healthcheck, Branch/Commit, die getrennte SQLite-Datei sowie der Zugriff auf die Staging-API vom NAS und über Tailscale wurden erfolgreich geprüft. Parallel wurde bestätigt, dass Produktion auf Port `8085` weiterläuft und vorhandene Daten ausliefert.

Noch nicht durchgeführt wurden:

- Installation oder Ausführung der nicht im Repository definierten npm-Abhängigkeiten
- Prüfung des extern eingerichteten Docker-Autodeployments
- vollständiger End-to-End-Bedientest aller Spielabläufe auf der Staging-Instanz
- schreibender Funktionstest mit vorhandenen Produktionsdaten; aus Sicherheitsgründen wurde die Produktivdatenbank nicht verändert oder nach Staging kopiert
- Fachliche Verifikation sämtlicher Spielregeln

## 11. Offene Entscheidungen

Diese Punkte sollten geklärt werden, bevor die jeweilige Arbeit beginnt:

1. Soll ScoreBuddy ausschließlich im vertrauenswürdigen Heimnetz laufen oder auch von außen erreichbar sein?
2. Ist die bestätigte produktive Datenbank `/volume2/docker/scoreboard-server/scoreboard.db` bereits in eine Backup-Routine aufgenommen und wurde die Wiederherstellung getestet?
3. Welcher Dienst übernimmt den Neustart beziehungsweise das Recreate für das automatische Update nach einem Push?
4. Soll `main` weiterhin direkt produktiv deployen oder soll ein Test-/Freigabeschritt vorgeschaltet werden?
5. Sollen mehrere Geräte gleichzeitig aktiv Punkte eintragen dürfen oder dient Live-Sync hauptsächlich der Anzeige?
6. Ist Smartphone-Installation als echte PWA gewünscht?

## 12. Leitplanken für spätere Bearbeitung

- Produktive Daten und Deployment-Einstellungen nicht ohne vorherige Sicherung verändern.
- Kleine, überprüfbare Schritte bevorzugen, weil Pushes automatisch ausgerollt werden.
- Bei Datenmodelländerungen immer Abwärtskompatibilität oder eine Migration vorsehen.
- Spielregeln und technische Spiellogik getrennt behandeln.
- Fest hinterlegte Regel-HTML-Inhalte dürfen als vertrauenswürdig gelten; Namen und sonstige Laufzeitdaten niemals.
- Neue Features erst nach Absicherung von Persistenz, statischer Dateiauslieferung und Fehlerbehandlung priorisieren.
