# Benutzer- und Rechtemodell

## First Run

Solange noch kein Master existiert, ist die normale Anwendung gesperrt. Für eine entfernte Einrichtung muss beim **ersten** Start ein zufälliges, nur temporär gesetztes `SCOREBUDDY_SETUP_TOKEN` vorhanden sein. Der Wert gehört ausschließlich in die Laufzeitumgebung oder ein Secret-Management, niemals in Git, Compose-Dateien oder Logs. Nach erfolgreicher Einrichtung muss die Variable entfernt und die Anwendung neu gestartet werden.

`ALLOW_LOCAL_SETUP=1` erlaubt alternativ eine Einrichtung über eine direkte Loopback-Verbindung. Diese Option ist nur für lokale Entwicklung vorgesehen und bleibt standardmäßig aus. Hinter einem Reverse Proxy darf sie nicht gesetzt werden.

Für HTTPS hinter einem vertrauenswürdigen Reverse Proxy:

- `TRUST_PROXY=1`, damit Express das weitergereichte HTTPS-Protokoll erkennt.
- `COOKIE_SECURE=1`, um Secure-Cookies unabhängig von der Request-Erkennung zu erzwingen.
- Optional `PUBLIC_BASE_URL=https://scorebuddy.example`, damit Einladungslinks nicht aus dem Request-Host abgeleitet werden.

Keine dieser Variablen enthält ein dauerhaftes Master-Passwort. Das Master-Passwort wird nur als scrypt-Hash mit zufälligem Salt in SQLite gespeichert.

## Rollen

- Ohne Sitzung sind nur Healthcheck, Anmeldung/First-Run, gültige Einladungen und die fünf State-Leseendpunkte mit explizitem `?preview=1` erreichbar.
- Benutzer dürfen alle fünf State-Blöcke lesen und ausschließlich ein bereits laufendes `currentGame` mit unveränderter Spiel-ID aktualisieren.
- Der Master darf Spieler, Spiele, Spieleabende, pausierte/laufende Spiele, Benutzer, Zuordnungen, Einladungen und Löschaktionen verwalten.
- Spieler benötigen kein Konto. Jedes Benutzerkonto einschließlich des Masters kann optional höchstens einem Spieler zugeordnet sein; ein Spieler kann höchstens ein Konto haben. Eine Zuordnung kann geändert oder gelöst werden, ohne die Rolle zu verändern.

## Einladungen

Der Master erzeugt eine Einladung direkt am Spieler. Der Link/QR enthält ein zufälliges 256-Bit-Token; SQLite speichert nur dessen SHA-256-Hash. Eine Einladung ist standardmäßig 24 Stunden gültig, einmal verwendbar und widerrufbar. Neue Einladungen, eine direkte Kontoerstellung oder eine spätere Verknüpfung widerrufen offene Einladungen für diesen Spieler. Benutzername und Spielerzuordnung werden über eindeutige SQLite-Indizes auch bei konkurrierenden Requests atomar geschützt.
