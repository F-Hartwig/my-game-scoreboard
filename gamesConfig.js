export const PREDEFINED_GAMES = [
    {
        id: "custom",
        name: "Custom-Spiel (Klassisch)",
        description: "Freies Spiel ohne automatische Endbedingungen oder Sonderregeln.",
        defaultMode: "round",
        rules: {
            winCondition: "highest",
            endTriggerPoints: null,
            exactMatchRule: null,
            descriptionLong: "" // Bleibt leer -> Kein Regeln-Button im Spiel
        }
    },
    {
        id: "cabo",
        name: "Cabo",
        description: "Es gewinnt, wer die wenigsten Punkte hat. Spiel endet ab 101 Punkten. Bei genau 100 Punkten fällt man auf 50 zurück!",
        defaultMode: "round",
        rules: {
            winCondition: "lowest", 
            endTriggerPoints: 101,
            exactMatchRule: {
                target: 100,
                resetTo: 50
            },
            descriptionLong: `
                <div style="font-family: inherit; line-height: 1.5; font-size: 13px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">📦 Kartenverteilung (52 Karten)</strong>
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>Werte 0 und 13:</strong> Jeweils nur 2-mal im Deck.</li>
                        <li><strong>Werte 1 bis 12:</strong> Jeweils genau 4-mal im Deck.</li>
                    </ul>

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">⚙️ Sonderfunktionen beim Nachziehen (Vom Stapel)</strong>
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>7 oder 8 (Spähen / Peek):</strong> Du darfst verdeckt eine deiner eigenen Karten anschauen.</li>
                        <li><strong>9 oder 10 (Linsen / Spy):</strong> Du darfst verdeckt eine Karte eines Mitspielers anschauen.</li>
                        <li><strong>11 oder 12 (Tauschen / Swap):</strong> Du darfst eine deiner Karten blind/wissend mit einer Karte eines Mitspielers tauschen.</li>
                    </ul>

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">🔄 Spielablauf & Rundenstart</strong>
                    Jeder Spieler erhält 4 Karten verdeckt nebeneinander. Man darf sich zu Beginn einmalig <strong>nur zwei Karten</strong> merken.
                    <br><strong>Wer fängt an?</strong> Der jüngste Spieler (oder der Gewinner der letzten Runde) beginnt. Danach geht es im Uhrzeigersinn weiter.
                    <br><br>Wenn du am Zug bist, musst du eine von drei Aktionen wählen:
                    <ol style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>Karte vom Nachziehstapel ziehen:</strong> Nutzen (Sonderfunktion aktivieren und ablegen) ODER gegen eine/mehrere eigene Karten austauschen.</li>
                        <li><strong>Oberste Karte vom Ablagestapel ziehen:</strong> Gegen eine oder mehrere eigene Karten austauschen (Sonderfunktionen gelten hierbei nicht).</li>
                        <li><strong>„CABO“ rufen:</strong> Wenn du glaubst, die wenigsten Punkte zu haben. Du setzt aus. Alle anderen haben noch genau einen letzten Zug.</li>
                    </ol>

                    <strong style="color: var(--warning); font-size: 15px; display: block; margin-bottom: 6px;">⚔️ Die Kamikaze-Regel (Kamikaze / Kamikaze-Run)</strong>
                    Schafft es ein Spieler, eine Runde mit dem maximal schwersten Blatt zu beenden (beide 13er und zwei 12er auf der Hand zu halten), hat er den Kamikaze-Run geschafft!
                    <br><strong>Auswirkung:</strong> Der Kamikaze-Spieler erhält für diese Runde <strong>0 Punkte</strong>, während <strong>allen Mitspielern sofort 50 Strafpunkte</strong> auf ihr Konto addiert werden!
                    <br><br>

                    <strong style="color: var(--danger); font-size: 15px; display: block; margin-bottom: 6px;">🏳️ Spielende & Sonderregeln</strong>
                    Sobald ein Spieler nach der Abrechnung einer Runde die Grenze von <strong>100 Punkten überschreitet</strong> (ab 101 Punkten), endet das gesamte Spiel für alle. Es gewinnt der Spieler mit den insgesamt **wenigsten Punkten**.
                    <br><br>
                    <strong>Die 100-Punkte-Punktlandung:</strong>
                    Erreicht ein Spieler am Ende einer Runde durch eine exakte Punktlandung <strong>haargenau 100 Punkte</strong>, wird er belohnt: Seine Gesamtpunktzahl fällt im Scorebuddy automatisch auf <strong>50 Punkte</strong> zurück!
                </div>
            `
        }
    },
    {
        id: "skyjo",
        name: "Skyjo",
        description: "Ziel ist die niedrigste Punktzahl. Ein Drilling in einer vertikalen Spalte zieht die Karten ab. Spiel endet, sobald jemand 100 Punkte erreicht.",
        defaultMode: "round",
        rules: {
            winCondition: "lowest",
            endTriggerPoints: 100, 
            exactMatchRule: null,
            descriptionLong: `
                <div style="font-family: inherit; line-height: 1.5; font-size: 13px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">📦 Kartenverteilung (150 Karten)</strong>
                    Das Deck besteht aus folgenden Zahlenwerten:
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>Wert -2:</strong> Kommt 5-mal vor.</li>
                        <li><strong>Wert 0:</strong> Kommt 15-mal vor.</li>
                        <li><strong>Werte -1 sowie 1 bis 12:</strong> Kommen jeweils genau 10-mal vor.</li>
                    </ul>

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">🔄 Spielaufbau & Rundenstart</strong>
                    Jeder Spieler erhält 12 verdeckte Karten und legt sie in einem <strong>3x4 Raster</strong> (3 Zeilen, 4 Spalten) vor sich aus. 
                    Zu Beginn deckt jeder Spieler <strong>2 beliebige Karten</strong> auf. 
                    <br><strong>Wer fängt an?</strong> In der ersten Runde beginnt der Spieler mit der höchsten Augensumme der beiden offenen Karten. In Folgerunden startet immer die Person, die die vorherige Runde beendet hat.
                    <br><br>

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">🎮 Spielablauf (Dein Zug)</strong>
                    Wenn du am Zug bist, entscheidest du dich für eine der beiden Optionen:
                    <ol style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>Vom Ablagestapel ziehen:</strong> Du musst diese offene Karte gegen eine deiner 12 Karten austauschen (egal ob offen oder verdeckt). Die getauschte Karte kommt offen auf den Ablagestapel.</li>
                        <li><strong>Vom Nachziehstapel ziehen:</strong> Schaue die Karte an. Entweder du tauschst sie gegen eine eigene Karte aus ODER du legst sie direkt auf den Ablagestapel ab und <strong>musst</strong> dafür eine deiner noch verdeckten Karten umdrehen.</li>
                    </ol>

                    <strong style="color: var(--success); font-size: 15px; display: block; margin-bottom: 6px;">💎 Die Drillings-Sonderregel (Spalten aufräumen)</strong>
                    Schaffst du es während deines Zugs oder beim finalen Aufdecken, <strong>drei identische Zahlenwerte in einer vertikalen Spalte</strong> zu sammeln, werden diese sofort komplett auf den Ablagestapel geworfen! Dadurch verlierst du lästige hohe Karten und deine Punktzahl sinkt drastisch.
                    <br><br>

                    <strong style="color: var(--warning); font-size: 15px; display: block; margin-bottom: 6px;">⚡ Rundenende & Die Verdopplungs-Falle</strong>
                    Sobald ein Spieler seine <strong>letzte verdeckte Karte aufdeckt</strong>, leitet er das Rundenende ein. Jeder andere Spieler hat noch genau <strong>einen letzten Zug</strong>. Danach decken alle verbleibenden Spieler ihre Karten auf und zählen zusammen.
                    <br><br>
                    <span style="color: var(--danger); font-weight: bold;">⚠️ Achtung Strafe:</span> Der Spieler, der die Runde beendet hat, <strong>MUSS</strong> die strikt kleinste Punktzahl dieser Runde haben (Gleichstand reicht nicht!). Hat ein anderer Spieler weniger oder gleich viele Punkte, werden die <strong>positiven Punkte</strong> des Beenders für diese Runde als Strafe <strong>verdoppelt</strong>!
                    <br><br>

                    <strong style="color: var(--danger); font-size: 15px; display: block; margin-bottom: 6px;">🏳️ Spielende</strong>
                    Das Gesamtmatch endet sofort nach der Rundenwertung, bei der mindestens ein Spieler <strong>100 Punkte oder mehr</strong> erreicht hat. Es gewinnt die Person mit der insgesamt niedrigsten Gesamtpunktzahl im Scorebuddy.
                </div>
            `
        }
    },
    {
        id: "skyjo_action",
        name: "Skyjo Action",
        description: "Der taktische Nachfolger mit Aktions- und Sternenkarten. Ziel bleibt die niedrigste Punktzahl. Spiel endet ab 100 Punkten.",
        defaultMode: "round",
        rules: {
            winCondition: "lowest",
            endTriggerPoints: 100,
            exactMatchRule: null,
            descriptionLong: `
                <div style="font-family: inherit; line-height: 1.5; font-size: 13px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">📦 Was ist neu? (Zusatzkarten)</strong>
                    Neben den normalen Zahlenwerten (-2 bis 12) enthält das Spiel zwei mächtige neue Kartentypen:
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>Aktionskarten (Orange):</strong> Werden auf der Hand gesammelt und erlauben taktische Sonderzüge (z.B. Karten klauen, öfter ziehen, Spalten verschieben oder Karten von Mitspielern anschauen).</li>
                        <li><strong>Sternenkarten (Joker):</strong> Können als Sonderwerte im Raster platziert werden und nehmen flexibel den Wert einer beliebigen Karte in ihrer Zeile oder Spalte an, um Drillinge/Viererreihen spielend leicht zu vervollständigen.</li>
                    </ul>

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">🔄 Spielaufbau & Start</strong>
                    Wie beim Klassiker erhält jeder Spieler 12 verdeckte Karten im <strong>3x4 Raster</strong>. Zusätzlich bekommt jeder Spieler <strong>1 Aktionskarte verdeckt auf die Hand</strong>. 
                    Zu Beginn deckt jeder wieder 2 Karten in seinem Raster auf. Es beginnt die Person mit der höchsten Augensumme.
                    <br><br>

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">🎮 Erweiterter Spielablauf (Dein Zug)</strong>
                    Wenn du am Zug bist, darfst du <strong>vor deiner Hauptaktion</strong> genau 1 Aktionskarte von deiner Hand ausspielen, um ihren Effekt zu nutzen. Danach folgt dein regulärer Zug:
                    <ol style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>Vom Ablagestapel ziehen:</strong> Normaler Tausch gegen eine Rasterkarte.</li>
                        <li><strong>Vom Nachziehstapel ziehen:</strong> Karte ansehen, tauschen ODER ablegen und eine verdeckte Rasterkarte umdrehen.</li>
                        <li><strong>NEU: Vom Aktionskartenstapel ziehen:</strong> Du darfst die gezogene Aktionskarte entweder sofort ausspielen ODER sie verdeckt auf die Hand nehmen (maximal 3 Handkarten erlaubt). Dafür musst du jedoch <strong>keine</strong> Karte in deinem Raster verändern!</li>
                    </ol>

                    <strong style="color: var(--success); font-size: 15px; display: block; margin-bottom: 6px;">💎 Reihen aufräumen (Drillinge & Viererreihen)</strong>
                    Wie gewohnt wird eine vertikale Spalte komplett gelöscht, wenn 3 identische Werte untereinander liegen. 
                    <br><strong>NEU: Horizontale Reihen!</strong> Schafft man es, eine komplette waagerechte Reihe aus 4 identischen Werten zu bilden, wird auch diese sofort auf den Ablagestapel geworfen! Sternenkarten (Joker) helfen dir dabei aktiv.
                    <br><br>

                    <strong style="color: var(--warning); font-size: 15px; display: block; margin-bottom: 6px;">⚡ Rundenende & Die Verdopplungs-Falle</strong>
                    Sobald ein Spieler seine letzte verdeckte Karte aufdeckt (Aktionskarten auf der Hand zählen nicht fürs Ende!), haben alle anderen noch genau 1 Zug. Danach wird abgerechnet.
                    <br><br>
                    <span style="color: var(--danger); font-weight: bold;">⚠️ Die Beender-Strafe:</span> Wer die Runde beendet, muss auch hier die absolut kleinste Punktzahl erzielen. Hat jemand anderes weniger oder gleich viele Punkte, werden die positiven Punkte des Beenders für diese Runde als Strafe <strong>verdoppelt</strong>. Ungenutzte Aktionskarten auf der Hand zählen am Ende übrigens als <strong>+2 Strafpunkte</strong> pro Karte!
                    <br><br>

                    <strong style="color: var(--danger); font-size: 15px; display: block; margin-bottom: 6px;">🏳️ Spielende</strong>
                    Das Gesamtmatch endet nach der Rundenwertung, bei der ein Spieler <strong>100 Punkte oder mehr</strong> erreicht. Gewonnen hat die Person mit der niedrigsten Gesamtpunktzahl im Scorebuddy.
                </div>
            `
        }
    },
    {
        id: "canasta",
        name: "Canasta",
        description: "Taktisches Kartenspiel für 2 bis 4 Spieler (im Team oder Solo). Ziel ist es, durch Meldungen und Canastas (7 Karten) als erstes 5000 Punkte zu erreichen.",
        defaultMode: "round",
        rules: {
            winCondition: "highest",
            endTriggerPoints: 5000,
            exactMatchRule: null,
            descriptionLong: `
                <div style="font-family: inherit; line-height: 1.5; font-size: 13px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">👥 Team vs. 👤 Solo-Modus</strong>
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>Teamspiel (4 Spieler):</strong> Partner teilen sich die Punkte im Scorebuddy. Jedes Teammitglied erhält 11 Handkarten.</li>
                        <li><strong>Solo-Modus (2 oder 3 Spieler):</strong> Jeder kämpft für sich allein! Beim Spiel zu zweit erhält jeder stolze <strong>15 Handkarten</strong>.</li>
                    </ul>

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">📦 Karten & Basiswerte (108 Karten)</strong>
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>Joker:</strong> 50 Punkte · <strong>Asse und 2er:</strong> 20 Punkte (2er sind ebenfalls Wilde Karten).</li>
                        <li><strong>Könige, Damen, Buben, 10, 9, 8:</strong> 10 Punkte.</li>
                        <li><strong>7, 6, 5, 4 und schwarze 3er:</strong> 5 Punkte.</li>
                    </ul>

                    <strong style="color: var(--success); font-size: 15px; display: block; margin-bottom: 6px;">🔥 Das Herzstück: Canasta-Wertung (Hausregeln)</strong>
                    <ul style="margin-left: 16px; margin-bottom: 6px; padding-left: 0;">
                        <li><strong>Reiner Canasta (Rot):</strong> 7 natürliche Karten ohne Joker/2er.</li>
                        <ul style="margin-left: 16px; padding-left: 0;">
                            <li>🚀 Mit einmal ausgelegt: <strong>+600 Bonuspunkte</strong></li>
                            <li>⏳ In mehreren Runden aufgebaut: <strong>+500 Bonuspunkte</strong></li>
                        </ul>
                        <li style="margin-top: 6px;"><strong>Unreiner Canasta (Schwarz):</strong> 7 Karten, gemischt mit Wilden Karten.</li>
                        <ul style="margin-left: 16px; padding-left: 0;">
                            <li>🚀 Mit einmal ausgelegt: <strong>+400 Bonuspunkte</strong></li>
                            <li>⏳ In mehreren Zügen aufgebaut: <strong>+300 Bonuspunkte</strong></li>
                        </ul>
                    </ul>

                    <strong style="color: var(--warning); font-size: 15px; display: block; margin-bottom: 6px;">🛡️ Das erste Auslegen (Erstmeldung)</strong>
                    Basierend auf dem Kontostand gilt ein Mindestwert für das erste Auslegen einer Runde:
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li>Bei Minus-Gesamtpunkten: <strong>15 Punkte</strong> · 0 bis 1495 Punkte: <strong>50 Punkte</strong>.</li>
                        <li>1500 bis 2995 Punkte: <strong>90 Punkte</strong> · 3000 bis 4995 Punkte: <strong>120 Punkte</strong>.</li>
                    </ul>

                    <strong style="color: var(--danger); font-size: 15px; display: block; margin-bottom: 6px;">⚡ Rundenende & Handspiel</strong>
                    Eine Runde endet, wenn ein Spieler alle Karten ablegt.
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>Normales Ausmachen:</strong> Das Team hat bereits Meldungen ausliegen. Bonus: <strong>+100 Punkte</strong>.</li>
                        <li><strong>Handspiel (Verdeckt ausmachen):</strong> Ein Spieler legt seine komplette Hand auf einen Schlag verdeckt ab und macht aus, ohne dass sein Team vorher ausgelegt hatte. Bonus: phänomenale <strong>+1500 Punkte</strong> (die reguläre Canasta-Wertung fällt hierbei extra weg!).</li>
                    </ul>
                    Nach dem Ausmachen zählen alle Parteien die Kartenwerte auf dem Tisch zusammen, während verbleibende Handkarten als Minuspunkte abgezogen werden.
                </div>
            `
        }
    },
    {
        id: "codenames",
        name: "Codenames",
        description: "Ein Teamspiel, bei dem Geheimagenten anhand von Hinweisen gefunden werden müssen. Benötigt keine Punkteerfassung.",
        hideFromSelection: true, // HIERMIT WIRD ES BEIM STARTEN VERSTECKT
        defaultMode: "single",
        rules: {
            winCondition: "highest",
            endTriggerPoints: null,
            exactMatchRule: null,
            descriptionLong: `
                <div style="font-family: inherit; line-height: 1.5; font-size: 13px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">🕵️‍♂️ Ablauf & Ziel</strong>
                    Zwei Teams (Blau vs. Rot) treten gegeneinander an. Jedes Team bestimmt einen Geheimdienstchef. 
                    Auf dem Tisch liegen 25 Wortkarten aus. Die Chefs geben ihren Teams abwechselnd einen Hinweis, der aus **einem einzigen Wort** und **einer Zahl** besteht (z.B. "Tier: 3").
                    <br><br>
                    <strong>Das Ziel:</strong> Das eigene Team muss alle Agenten der eigenen Farbe finden, bevor das gegnerische Team es tut – und ohne jemals den gefährlichen Attentäter aufzudecken, was zum sofortigen Spielverlust führt!
                </div>
            `
        }
    }
];