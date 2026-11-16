# All Capital

Das Zuhause der privaten Finanzen. macOS-Desktop-App auf Basis von Tauri 2 (Rust) und React/TypeScript.

## Entwickeln

```bash
npm install
npm run tauri dev      # App starten (benötigt Rust und Xcode Command Line Tools)
npm run dev            # nur die Oberfläche im Browser, mit flüchtigen Vorschau-Daten
```

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
- `src-tauri/src/profiles.rs` – lokale Profile, Argon2id-Passwort-Hashing, atomare Speicherung.
- `src-tauri/src/commands.rs` – alle vom Webview erreichbaren Befehle, Sitzung, Login-Drosselung.

## Sicherheit

- Local-first: keine Server, keine Netzwerkzugriffe aus der Oberfläche (strikte CSP).
- Passwörter verlassen das Rust-Backend nie und werden nur als Argon2id-Hash gespeichert.
- Die Profildatei (`profiles.json`, nur für den Besitzer lesbar) ist noch nicht verschlüsselt. Finanzdaten gehören nicht dorthin, sondern in die geplante verschlüsselte Datenbank.
