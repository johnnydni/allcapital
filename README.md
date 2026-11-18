# All Capital

Das Zuhause der privaten Finanzen. macOS-Desktop-App auf Basis von Tauri 2 (Rust) und React/TypeScript.

## Entwickeln

```bash
npm install
npm run tauri dev      # App starten (benötigt Rust und Xcode Command Line Tools)
npm run dev            # nur die Oberfläche im Browser, mit flüchtigen Vorschau-Daten
```

## Web-Vorschau (GitHub Pages)

```bash
npm run build:preview
```

Baut nur die Oberfläche mit flüchtigen Beispieldaten nach `dist-preview`. Der Workflow `.github/workflows/pages.yml` veröffentlicht sie auf GitHub Pages. Die Vorschau enthält kein Backend: keine Speicherung, keine Verschlüsselung, nur eine grobe Ersatz-Schätzung.

## Prüfen

```bash
npm run build                    # Typprüfung + Frontend-Build
cd src-tauri && cargo test       # Backend-Tests
```

## macOS-Build

```bash
npm run tauri build
```

Für die Weitergabe an andere muss das Ergebnis mit einer Apple Developer ID signiert und notarisiert werden.

## Aufbau

- `src/` – Oberfläche. Alle Maße leiten sich vom Figma-Frame (1728 × 1117) ab, siehe `src/styles.css`.
- `src/lib/api.ts` – einzige Schnittstelle zum Backend.
- `src/assets/` – aus der Figma-Datei exportierte Grafiken.
- `src-tauri/src/profiles.rs` – lokale Profile, Argon2id-Passwort-Hashing, atomare Speicherung.
- `src-tauri/src/vault.rs` – verschlüsselter Datentresor je Profil (XChaCha20-Poly1305).
- `src-tauri/src/vehicles.rs` – Fahrzeuge, Validierung und die Wert-Faustformel.
- `src-tauri/src/properties.rs` – Immobilien und die lineare AfA nach § 7 Abs. 4 EStG (nur vermietete Objekte).
- `src-tauri/src/devices.rs` – Tech-Geräte und ihre Wert-Faustformel.
- `src-tauri/src/commands.rs` – alle vom Webview erreichbaren Befehle, Sitzung, Login-Drosselung.

## Sicherheit

- Local-first: keine Server, keine Netzwerkzugriffe aus der Oberfläche (strikte CSP).
- Passwörter verlassen das Rust-Backend nie und werden nur als Argon2id-Hash gespeichert.
- Vermögensdaten liegen ausschließlich im verschlüsselten Tresor (`vault-<id>.bin`). Der Schlüssel wird aus dem Passwort abgeleitet und existiert nur im Arbeitsspeicher, solange das Profil entsperrt ist. Ohne Passwort gibt es keine Wiederherstellung.
- Die Profildatei (`profiles.json`, nur für den Besitzer lesbar) ist nicht verschlüsselt und enthält Name, E-Mail und Onboarding-Antworten – keine Finanzdaten.

## Wertschätzung

Die Schätzung in `vehicles.rs` ist eine Faustformel (Kaufpreis, Alter, Zustand, Laufleistung) und liefert eine Spanne. Sie ist als Platzhalter gedacht, bis ein Dienst mit echten Marktdaten angebunden ist; die Oberfläche spricht nur mit dem Befehl `estimate_vehicle`.
