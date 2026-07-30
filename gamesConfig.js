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
        description: "Der taktische Nachfolger mit Aktions- und Sternenkarten. Horizontale 4er-Reihen werden gelöscht. Sternenreihen bringen bis zu -15 Punkte!",
        defaultMode: "round",
        rules: {
            winCondition: "lowest",
            endTriggerPoints: 100,
            exactMatchRule: null,
            descriptionLong: `
                <div style="font-family: inherit; line-height: 1.5; font-size: 13px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">📦 Spielaufbau & Auslage</strong>
                    Neben dem normalen Zahlenstapel werden die die Aktionskarten gemischt und 4 Karten offen in der Mitte ausgelegt. 
                    Wird eine Karte genommen, füllt man sie sofort vom Nachziehstapel auf.
                    <br>Jeder Spieler legt 12 Karten verdeckt im <strong>3x4 Raster</strong> aus und deckt zu Beginn 2 Karten auf. Die höchste Augensumme beginnt.
                    <br><br>

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">🎮 Spielablauf (Dein Zug)</strong>
                    Wenn du am Zug bist, wählst du genau <strong>eine</strong> der folgenden drei Hauptaktionen:
                    <ol style="margin-left: 16px; margin-bottom: 12px; padding-left: 0; color: var(--text);">
                        <li style="margin-bottom: 4px;"><strong>Vom Ablagestapel ziehen:</strong> Offener Tausch gegen eine Rasterkarte.</li>
                        <li style="margin-bottom: 4px;"><strong>Vom Nachziehstapel ziehen:</strong> Karte ansehen, tauschen ODER ablegen und eine verdeckte Rasterkarte umdrehen.</li>
                        <li style="margin-bottom: 4px;"><strong>Vom Aktionskartenstapel ziehen ODER aus der Auslage wählen:</strong> Du darfst die Aktionskarte nutzen, um Spezialzüge (Karten klauen, Spalten verschieben etc.) auszuführen. Sie wird danach abgelegt.</li>
                    </ol>

                    <strong style="color: var(--success); font-size: 15px; display: block; margin-bottom: 6px;">⭐ Die Sternenkarten (Joker) & Runden-Minuspunkte</strong>
                    Sternenkarten zählen am Rundenende immer <strong>0 Punkte</strong>. Sie helfen beim Vervollständigen von normalen Zahlenreihen.
                    <br><br>
                    <span style="color: var(--success); font-weight: bold;">💎 Der reine Sternen-Bonus (Wichtig für den ScoreBuddy):</span>
                    Schaffst du es, Reihen oder Spalten <em>ausschließlich</em> mit Sternenkarten zu füllen, werden diese nicht einfach abgelegt, sondern am Rundenende wie folgt gewertet:
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0; color: var(--text);">
                        <li style="margin-bottom: 4px;"><strong>Komplette Spalte (3 Sternenkarten untereinander):</strong> Du erhältst sofort <strong>-10 Punkte</strong> für deine Rundenwertung!</li>
                        <li style="margin-bottom: 4px;"><strong>Komplette Reihe (4 Sternenkarten nebeneinander):</strong> Du erhältst sofort phänomenale <strong>-15 Punkte</strong> für deine Rundenwertung!</li>
                    </ul>

                    <strong style="color: var(--success); font-size: 15px; display: block; margin-bottom: 6px;">💎 Normales Reihen aufräumen (Zahlenkarten)</strong>
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0; color: var(--text);">
                        <li style="margin-bottom: 4px;"><strong>Vertikale Spalten:</strong> Wie gewohnt werden 3 identische Werte untereinander komplett gelöscht.</li>
                        <li style="margin-bottom: 4px;"><strong>Horizontale Reihen:</strong> Schaffst du es, eine komplette waagerechte Reihe aus <strong>4 identischen Werten</strong> zu bilden, wird auch diese komplett abgeräumt!</li>
                    </ul>

                    <strong style="color: var(--warning); font-size: 15px; display: block; margin-bottom: 6px;">⚡ Rundenende & Die Verdopplungs-Falle</strong>
                    Sobald ein Spieler seine letzte verdeckte Karte aufdeckt, haben alle anderen noch genau 1 Zug. Danach wird abgerechnet.
                    <br><br>
                    <span style="color: var(--danger); font-weight: bold;">⚠️ Die Beender-Strafe:</span> Wer die Runde beendet, muss die strikt kleinste Punktzahl dieser Runde erzielen (Gleichstand reicht nicht). Hat jemand anderes weniger oder gleich viele Punkte, werden die positiven Punkte des Beenders <strong>verdoppelt</strong>!
                    <br><br>
                    <span style="color: var(--danger); font-weight: bold;">⚠️ Aktionskarten-Malus:</span> Jede Aktionskarte, die am Rundenende noch ungenutzt offen vor dir liegt, bestraft dich mit satten <strong>+10 Strafpunkten</strong> auf dem Spielblock!
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
    },
        {
        id: "flip7",
        name: "Flip 7",
        description: "Push-your-Luck Kartenspiel! Wer 200 Punkte erreicht, gewinnt. Wer doppelte Zahlen zieht, geht in der Runde leer aus.",
        defaultMode: "round",
        rules: {
            winCondition: "highest",
            endTriggerPoints: 200,
            exactMatchRule: null,
            descriptionLong: `
                <div style="font-family: inherit; line-height: 1.5; font-size: 13px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">📦 Das Kartendeck (94 Karten)</strong>
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>79 Zahlenkarten (0–12):</strong> Die Zahl bestimmt die Häufigkeit im Deck (die 12 ist 12x vorhanden, die 11 ist 11x vorhanden ... bis zur 1 [1x]). Die <strong>0 ist genau 1-mal</strong> enthalten und 0 Punkte wert.</li>
                        <li><strong>9 Aktionskarten:</strong> Je 3x <em>Freeze</em>, <em>Second Chance</em> und <em>Flip Three</em>.</li>
                        <li><strong>6 Bonuskarten:</strong> +2, +4, +6, +8, +10 Punkte sowie 1x der x2-Multiplikator.</li>
                    </ul>

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">🔄 Spielablauf (Dein Zug)</strong>
                    Eine Person verteilt reihum offene Karten. Wenn du an der Reihe bist, wählst du:
                    <ol style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>NOCH EINE (Karte ziehen):</strong> Du erhältst eine weitere offene Karte.</li>
                        <li><strong>STOPP (Passen):</strong> Du steigst aus der Runde aus, sicherst deine Karten und wertest sie am Rundenende.</li>
                    </ol>

                    <strong style="color: var(--danger); font-size: 15px; display: block; margin-bottom: 6px;">💥 Verzockt!</strong>
                    Erhältst du eine Zahlenkarte, die du bereits vor dir ausliegen hast, hast du dich <strong>verzockt</strong>! Du fliegst sofort raus und bekommst <strong>0 Punkte</strong> für diese Runde.

                    <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">⚡ Aktionskarten (Effekte)</strong>
                    <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li><strong>FREEZE:</strong> Zwingt einen aktiven Mitspieler (oder dich selbst), sofort mit den aktuellen Karten auszustiegen (Punkte bleiben gesichert).</li>
                        <li><strong>SECOND CHANCE:</strong> Schützt dich vor dem nächsten Verzocken (Karte wird dann gemeinsam mit dem Doppelgänger abgeworfen).</li>
                        <li><strong>FLIP THREE:</strong> Bestimmt eine Person, die sofort die nächsten 3 Karten nacheinander ziehen muss.</li>
                    </ul>

                    <strong style="color: var(--success); font-size: 15px; display: block; margin-bottom: 6px;">🔥 Der Flip 7 Bonus (+15 Extrapunkte)</strong>
                    Schaffst du es, <strong>7 verschiedene Zahlenkarten</strong> auszulegen, ohne dich zu verzocken, ist dir ein <strong>Flip 7</strong> gelungen! Die Runde endet sofort für alle. Du erhältst zusätzlich <strong>+15 Extrapunkte</strong>.

                    <strong style="color: var(--warning); font-size: 15px; display: block; margin-bottom: 6px;">📊 Abrechnung einer Runde</strong>
                    <ol style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                        <li>Summe aller deiner Zahlenwerte bilden.</li>
                        <li>Falls du eine <strong>x2-Karte</strong> hast: Zahlenwerte verdoppeln!</li>
                        <li>Plus-Bonuskarten (+2 bis +10) hinzurechnen.</li>
                        <li>Falls Flip 7 gelungen ist: <strong>+15 Extrapunkte</strong> addieren (werden nicht verdoppelt!).</li>
                    </ol>

                    <strong style="color: var(--danger); font-size: 15px; display: block; margin-bottom: 6px;">🏆 Spielende & Gleichstand</strong>
                    Das Spiel endet am Ende einer Runde, wenn mindestens eine Person <strong>200 Punkte oder mehr</strong> erreicht hat. Es gewinnt die Person mit den meisten Punkten.
                    <br><br>
                    <strong>Gleichstand an der Spitze:</strong> Bei Gleichstand wird solange eine weitere Runde gespielt, bis eine Person eindeutig führt!
                </div>
            `
        }
    },
    {
    id: "wizard",
    name: "Wizard",
    description: "Vorhersagespiel: Schätze deine Stiche exakt ein! Bei Treffer gibt es 20 + 10 pro Stich, sonst 10 Miese pro Abweichung.",
    defaultMode: "round",
    rules: {
        winCondition: "highest",
        endTriggerPoints: null,
        exactMatchRule: null,
        descriptionLong: `
            <div style="font-family: inherit; line-height: 1.5; font-size: 13px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">📦 Das Deck (60 Karten)</strong>
                <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                    <li><strong>Zahlenkarten (1 bis 13):</strong> In 4 Farben (Rot, Gelb, Grün, Blau).</li>
                    <li><strong>4 Zauberer (Wizard):</strong> Höchste Karte im Spiel, gewinnt immer den Stich.</li>
                    <li><strong>4 Narren (Jester):</strong> Niedrigste Karte im Spiel, verliert immer den Stich.</li>
                </ul>

                <strong style="color: var(--primary); font-size: 15px; display: block; margin-bottom: 6px;">🔄 Rundenanzahl & Kartenvergabe</strong>
                In Runde 1 erhält jeder 1 Karte, in Runde 2 erhält jeder 2 Karten ... bis alle 60 Karten aufgebraucht sind (z. B. 20 Runden bei 3 Spielern, 15 Runden bei 4 Spielern, 12 Runden bei 5 Spielern, 10 Runden bei 6 Spielern).

                <strong style="color: var(--warning); font-size: 15px; display: block; margin-bottom: 6px;">🛡️ Die Geber-Regel (Keine aufgehende Summe)</strong>
                Die Summe aller gebotenen Stiche in einer Runde darf **niemals genau der Anzahl der Handkarten entsprechen**! Der Geber (letzte Person beim Ansagen) darf daher die Zahl nicht wählen, die die Summe genau aufgeben würde.

                <strong style="color: var(--success); font-size: 15px; display: block; margin-bottom: 6px;">📊 Punktewertung</strong>
                <ul style="margin-left: 16px; margin-bottom: 12px; padding-left: 0;">
                    <li><strong>Exakt richtig getippt:</strong> <span style="color:var(--success); font-weight:bold;">+20 Punkte</span> Sockel-Bonus + <span style="color:var(--success); font-weight:bold;">+10 Punkte</span> für jeden gemachten Stich.</li>
                    <li><strong>Falsch getippt:</strong> <span style="color:var(--danger); font-weight:bold;">-10 Punkte</span> für jeden Stich Abweichung (egal ob mehr oder weniger Stiche als angesagt!).</li>
                </ul>
            </div>
        `
    }
},

];
