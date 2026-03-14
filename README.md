# 🗺️ LILA APM — Telemetry Visualizer

> **Live Demo:** [https://lila-apm-production.up.railway.app](https://lila-apm-production.up.railway.app)
> **Repo:** [https://github.com/luvxen/LILA-APM](https://github.com/luvxen/LILA-APM)

A fast, lightweight, browser-based telemetry visualizer built for the LILA APM assignment. It ingests raw `.parquet` and `.nakama-0` telemetry data, processes it on the server, and renders player journeys, heatmaps, and event zones as interactive, animated overlays on game minimaps — all at a smooth 60FPS.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
  - [System Diagram](#system-diagram)
  - [Backend — Python / Flask](#backend--python--flask)
  - [Frontend — Vanilla JS / HTML5 Canvas](#frontend--vanilla-js--html5-canvas)
  - [Data Pipeline](#data-pipeline)
  - [File Structure](#file-structure)
- [Tech Stack & Design Rationale](#tech-stack--design-rationale)
- [Setup & Running Locally](#setup--running-locally)
- [Usage Guide](#usage-guide)
- [Testing](#testing)
- [Deployment (Railway)](#deployment-railway)
- [Known Limitations & Future Work](#known-limitations--future-work)

---

## Overview

LILA APM is a **telemetry analysis and playback tool** designed for Level Designers and Game Analysts. Given raw match telemetry files, it lets you:

- Upload and parse raw `.parquet` / `.nakama-0` files directly in the browser.
- Visualize player paths and heatmaps overlaid on game minimaps.
- Animate player movement across a match timeline with a scrubber.
- Separate and independently toggle **human player** vs **bot** data.
- Filter data to any time window within a match using **Relative Time** slicing.

The core design philosophy is: **heavy data work belongs on the server, lightweight rendering belongs in the browser.** Python's Pandas handles gigabytes of Parquet data efficiently; the browser's Canvas API renders the results at native speed.

---

## Features

| Feature | Description |
|---|---|
| **Parquet & Nakama Ingestion** | Upload raw `.parquet` or `.nakama-0` files via the UI. The backend parses, sanitizes, and groups them into a clean JSON database. |
| **Interactive Minimap Overlay** | Player paths, heatmaps, and event zones are drawn on an HTML5 Canvas layered over the game's minimap image. |
| **Animated Timeline Scrubber** | Scrubs through match time, animating cumulative player paths up to the selected timestamp. |
| **Relative Time Filtering** | Slice the match to any time range (e.g., 0–5 min). The scrubber is locked until a valid time slice is set, preventing accidental unfiltered loads. |
| **Bot / Human Toggle** | Explicit, separated toggles for bots and human players. Level Designers can isolate human heatmaps or bot pathing independently. |
| **Multi-Map Support** | Supports multiple maps (`Lockdown`, `AmbroseValley`) via the Match Selector. |
| **Zero External JS Deps** | The frontend uses no JavaScript frameworks — pure Vanilla JS and Canvas API. |

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────┐
│                     Browser (Client)                │
│                                                     │
│  ┌──────────────┐     ┌────────────────────────┐   │
│  │  Upload UI   │────▶│  Canvas Renderer (JS)  │   │
│  │  (HTML/CSS)  │     │  - Player paths        │   │
│  └──────┬───────┘     │  - Heatmaps            │   │
│         │             │  - Event zones         │   │
│         │             └──────────┬─────────────┘   │
└─────────┼────────────────────────┼─────────────────┘
          │ HTTP POST              │ HTTP GET
          │ (raw files)            │ (JSON DB)
          ▼                        ▼
┌─────────────────────────────────────────────────────┐
│                  Flask Server (app.py)              │
│                                                     │
│  ┌──────────────┐     ┌────────────────────────┐   │
│  │  /upload     │────▶│     parser.py          │   │
│  │  endpoint    │     │  - Reads .parquet /    │   │
│  └──────────────┘     │    .nakama-0 files     │   │
│                       │  - Sanitizes data      │   │
│  ┌──────────────┐     │  - Groups by Map/Match │   │
│  │  /api/*      │◀────│  - Writes JSON DB      │   │
│  │  endpoints   │     └────────────────────────┘   │
│  └──────┬───────┘                                  │
└─────────┼───────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│   player_data/      │  ← Static JSON database (grouped telemetry)
│   (JSON files)      │
└─────────────────────┘
```

---

### Backend — Python / Flask

**`app.py`** — The main application server.

- Serves the static frontend from the `public/` directory.
- Exposes REST API endpoints for:
  - `POST /upload` — Accepts raw telemetry file uploads and pipes them through `parser.py`.
  - `GET /api/maps` — Returns available maps and matches from the compiled JSON database.
  - `GET /api/data/<map>/<match>` — Returns the processed player event data for a specific map/match combination.
- Runs on port `8000` by default.

**`parser.py`** — The data ingestion and sanitization pipeline.

This is the most critical backend module. It:

1. **Reads** raw `.parquet` files using `pandas.read_parquet()`. For `.nakama-0` files (a binary Nakama game server log format), it handles the custom deserialization.
2. **Sanitizes** the data: forces `elapsed_ms` columns to correct integer/float downcasts, drops malformed rows, normalises coordinate spaces to match the minimap dimensions.
3. **Separates** event types — player position events, kill events, death events, etc. are explicitly split into distinct data streams to prevent visual and logical cross-contamination.
4. **Groups** data hierarchically by `Map → Match → Player`, creating a clean, nested JSON structure.
5. **Writes** the result to `player_data/` as static JSON files, which are then served by Flask.

**`debug.py`** — A standalone debugging utility that can run the parser in isolation and dump diagnostics to stdout. Useful for verifying raw file ingestion without spinning up the full server.

---

### Frontend — Vanilla JS / HTML5 Canvas

Located in `public/`, the frontend is entirely framework-free.

**UI Panels:**

- **Data Pipeline Card** — File picker for uploading `.parquet`/`.nakama-0` files. Shows upload/parse status feedback.
- **Match Selectors** — Dropdowns to pick the target `Map` and `Match` from the compiled database. "Load Context" triggers a fetch of the relevant JSON data.
- **Relative Time Filter** — Two number inputs (start/end minutes). The timeline scrubber is locked and non-interactive until a valid range is entered — this is a deliberate design constraint ("Scrubber Validation") to prevent accidental full-match renders.
- **Toggle Controls** — Separate, clearly labelled checkboxes for Bot visibility and Human player visibility.

**Canvas Renderer:**

The minimap overlay is rendered on an HTML5 `<canvas>` element. The renderer:

- Loads the appropriate minimap image as a background layer.
- Transforms raw world-space coordinates from the JSON data into canvas pixel space using pre-calibrated scale/offset matrices per map.
- Draws **animated player paths** by interpolating positions along recorded coordinate arrays up to the current scrubber timestamp.
- Renders a **heatmap** layer by accumulating position density into a grid and applying a colour gradient (cool → hot).
- Draws **event zone markers** (kill zones, objective zones) as distinct visual overlays.
- Targets 60FPS via `requestAnimationFrame`.

---

### Data Pipeline

The full data flow from raw files to rendered canvas:

```
Raw Files (.parquet / .nakama-0)
        │
        ▼
  parser.py (Pandas)
  ├── Read & deserialise
  ├── Sanitise + downcast types
  ├── Separate event types
  └── Group by Map → Match → Player
        │
        ▼
  player_data/*.json  (Static JSON DB)
        │
        ▼
  Flask /api endpoints
        │
        ▼
  Browser JS (fetch)
        │
        ▼
  Canvas Renderer
  ├── Coordinate transform
  ├── Path animation (scrubber-driven)
  ├── Heatmap accumulation
  └── Event zone overlays
```

---

### File Structure

```
LILA-APM/
│
├── app.py                  # Flask server, API endpoints
├── parser.py               # Data ingestion and sanitisation pipeline
├── debug.py                # Standalone debug/diagnostic runner
├── debug_draw.html         # Debug HTML for visually inspecting parsed output
│
├── requirements.txt        # Python dependencies (Flask, Pandas, PyArrow, etc.)
│
├── player_data/            # Output directory — compiled JSON telemetry database
│   └── *.json              # Per-map/match grouped player event data
│
├── public/                 # Static frontend assets served by Flask
│   ├── index.html          # Main application UI
│   ├── *.css               # Styles
│   └── *.js                # Canvas renderer and UI logic
│
├── test_filters.py         # Python unit tests for data filter logic
├── test_filters.js         # JS unit tests for frontend filter logic
├── test_frontend.py        # Integration/frontend tests
│
├── ARCHITECTURE.md         # High-level architecture notes
├── architecture_doc.md     # Detailed architecture documentation
└── INSIGHTS.md             # PM/design insight notes
```

---

## Tech Stack & Design Rationale

| Layer | Technology | Why |
|---|---|---|
| **Backend** | Python 3.9+, Flask | Fast Parquet ingestion via Pandas/PyArrow; simple REST API surface |
| **Data Processing** | Pandas + PyArrow | Industry-standard for columnar Parquet data; handles millions of rows efficiently |
| **Frontend** | Vanilla HTML5, CSS, JS | No framework overhead; direct Canvas API access for maximum render performance |
| **Rendering** | HTML5 Canvas API | Low-level rasterisation; handles tens of thousands of path points at 60FPS |
| **Hosting** | Railway | Zero-config Python deployment; automatic HTTPS; GitHub-connected CI/CD |

**Why not process data in the browser (WASM/JS)?**
Handling millions of raw Parquet data points in JavaScript — even with WASM — creates significant memory and CPU overhead. Delegating ingestion to Pandas on the server keeps the client lightweight, ensures consistent data quality, and allows the browser to focus purely on rendering the pre-processed output.

---

## Setup & Running Locally

### Prerequisites

- Python 3.9+
- pip

### 1. Clone the Repository

```bash
git clone https://github.com/luvxen/LILA-APM.git
cd LILA-APM
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Server

```bash
python3 app.py
```

The server starts at `http://localhost:8000`.

---

## Usage Guide

1. Open `http://localhost:8000` in your browser.
2. In the **Data Pipeline** card, click `Choose Files` and select your `.parquet` or `.nakama-0` telemetry files.
3. Click **"Upload & Parse to DB"**. Wait for the status indicator to turn green: *"Database connected."*
4. Use the **Match Selectors** to choose a map (`Lockdown`, `AmbroseValley`) and click **"Load Context"**.
5. Enter a **Relative Time Filter** range (e.g., `0` to `5` minutes) — this unlocks the scrubber.
6. Use the scrubber to animate player movement across the selected time window.
7. Use the **Bot / Human toggles** to isolate or combine player populations in the visualisation.

---

## Testing

The project includes three test modules:

| File | Scope |
|---|---|
| `test_filters.py` | Unit tests for Python-side data filter and grouping logic in `parser.py` |
| `test_filters.js` | Unit tests for the JavaScript filter and coordinate transform logic |
| `test_frontend.py` | Integration tests covering the Flask endpoints and frontend rendering pipeline |

Run Python tests:
```bash
python3 -m pytest test_filters.py test_frontend.py -v
```

---

## Deployment (Railway)

The application is deployed on [Railway](https://railway.app).

- **Live URL:** https://lila-apm-production.up.railway.app
- Railway auto-detects the Python project, installs `requirements.txt`, and runs `app.py`.
- Any push to the `main` branch triggers an automatic redeploy.

To deploy your own instance:
1. Fork this repository.
2. Create a new Railway project → **Deploy from GitHub repo** → select your fork.
3. Railway will build and deploy automatically.
4. Under **Settings → Networking**, click **Generate Domain** to get a public URL.

---

## Known Limitations & Future Work

- **No persistent storage** — uploaded files and the compiled JSON database are ephemeral on Railway's free/hobby tier. A future iteration could integrate a persistent volume or object storage (e.g., S3) for the `player_data/` directory.
- **Single-user sessions** — concurrent uploads from multiple users could cause race conditions on the shared `player_data/` directory. A per-session temp directory would resolve this.
- **Map support** — currently limited to `Lockdown` and `AmbroseValley`. Adding new maps requires registering minimap images and coordinate calibration matrices.
- **No authentication** — the upload endpoint is open. A simple API key or session token would be appropriate for shared deployments.

---

## Author

**luvxen** — [github.com/luvxen](https://github.com/luvxen)
