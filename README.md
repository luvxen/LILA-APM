# LILA APM

A fast, lightweight, browser-based telemetry visualizer built for the LILA APM assignment. 
It ingests raw `.parquet` and `.nakama-0` telemetry data and plots player journeys, heatmaps, and event zones onto interactive minimaps.

## Features Based on PM Notes
- **Unified Parquet Database**: Upload raw files directly through the UI. `parser.py` automatically sanitizes the data and compiles it into a clean, grouped JSON database to be served statically.
- **Scrubber Validation**: The timeline limits interaction until a Relative Time slice is enforced.
- **Relative Time Filtering**: You can dynamically slice the match (e.g., 0 to 5 minutes) and view cumulative, animated player paths up to that exact timestamp.
- **Explicit Bot & Human Separation**: Toggles are distinctly separated so Level Designers can look *only* at human heatmaps, or *only* at bot pathing, as requested.

## Architecture & Tech Stack
- **Backend:** Python (Flask, Pandas)
- **Frontend:** Vanilla HTML5, CSS, JS Canvas
- **Why?** Handling millions of raw Parquet data points in JS/WASM causes huge overhead. Delegating data ingestion to a strong Pandas backend while rendering points directly on a low-level Canvas API ensures blistering 60FPS performance even when visualizing tens of thousands of aggregate paths.

Further details are available in `ARCHITECTURE.md` and `INSIGHTS.md`.

## Setup & Running Locally

### Prerequisites
- Python 3.9+
- pip

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Server
```bash
python3 app.py
```
*The server boots at `http://localhost:8000`.*

### 3. Usage
1. Open `http://localhost:8000` via your web browser.
2. In the "**Data Pipeline**" card, click `Choose Files` and select your `.parquet`/`.nakama-0` files.
3. Click "**Upload & Parse to DB**". Wait for the status text to turn green: "Database connected."
4. Use the "**Match Selectors**" to choose your map (`Lockdown`, `AmbroseValley`) and click "**Load Context**".
5. Input a **Relative Time Filter** (e.g., `0` to `5` minutes) to unlock the scrubber animation.

## Author Notes
This application underwent a complete architectural rewrite from the previous iteration, ensuring data structure guarantees (forcing elapsed MS downcasts and explicit Map/Match groupings) while decoupling confusing event types for better visual parity.
