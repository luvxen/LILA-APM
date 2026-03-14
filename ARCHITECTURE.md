# LILA APM: Architecture & Tradeoffs

## Tech Stack
- **Backend**: Python (Flask, Pandas, PyArrow)
- **Frontend**: Plain HTML, CSS, JavaScript (Vanilla Canvas API)

### Why this stack?
**Performance & Simplicity.** 
Parsing Parquet files natively in the browser is heavy and often requires complex WebAssembly wrappers (`duckdb-wasm` or `parquet-wasm`). By using a lightweight Python Flask backend, we can leverage `pandas`, which is the industry standard for fast, reliable dataframe operations. 

Once the data is processed, the frontend needs to render thousands of points per frame to animate player journeys. A bloated framework like React creates unnecessary VDOM overhead for this specific Canvas-heavy use case. Vanilla JS Canvas provides the exact low-level draw access required to maintain 60FPS while scrubbing a timeline of 50,000+ points.

## Data Flow
1. **Upload**: User selects Parquet/Nakama files via the UI. The FormData is POSTed to the Flask server.
2. **Ingestion & DB Generation**: The server delegates to `parser.py`. This script reads all files, maps messy schema variations (filling missing columns, deriving dates, strictly enforcing elapsed ms timestamps), and aggregates them into a **Unified Database**.
3. **Storage**: The unified DB is saved locally as static JSON files grouped by Map (`AmbroseValley.json`, `GrandRift.json`).
4. **Client Initialization**: The frontend fetches these JSON representations.
5. **Client Rendering**: When a user applies selectors or a relative time slice, the frontend filters the JSON array in memory. The Canvas loop reads from this filtered array to draw paths, points, and composite heatmaps.

## Coordinate Mapping Approach
The core translation happens in the `worldToMinimap(x, z)` function in `app.js`.
The raw telemetry provides `x` and `y` (actually `z` depth in Unreal/Unity engines) as absolute world coordinates.
The minimaps are 1024x1024 flat images.
Using the provided README constants, we map them linearly:
1. Shift the world origin subtracting the specified offset: `u = (worldX - mapOriginX) / configScale`.
2. Convert that localized unit to map pixels: `pixelX = u * 1024`.
3. Invert the Z/Y axis since Canvas draws Y downwards, whereas 3D engines typically draw Z upwards: `pixelY = (1 - v) * 1024`.

## Assumptions & Ambiguities
- **Timestamp (`ts`)**: The raw files contained `datetime64[ms]` objects that PyArrow attempted to read, but they represented elapsed match milliseconds rather than absolute Unix Epochs. The parser explicitly casts these to standard `int64` to prevent timezone/epoch math errors.
- **Missing Columns**: Some files omitted `x`, `y`, or `is_bot`. The parser intelligently fills these with defaults (`0.0` or `False`) to ensure the pipeline doesn't crash on patchy data.

## Major Tradeoffs
| Tradeoff | Decision | Rationale |
| :--- | :--- | :--- |
| **Backend Processing vs WASM** | Used a Python backend instead of in-browser WASM. | Python's `pandas` is universally reliable for Parquet. In-browser Parquet parsing is brittle and requires heavy downloads for the user. |
| **Vanilla Canvas vs WebGL/Three.js** | Used 2D Canvas Context. | WebGL is significantly faster for 100k+ points, but 2D Canvas is fast enough for per-match filtering (usually <10,000 points) and vastly simpler to implement heatmaps on using `globalCompositeOperation`. |
| **JSON Delivery vs API Endpoints** | Pre-compiled unified JSON files served statically. | Delivering static JSON chunks per map is faster and more cacheable than querying a live database for every scrubber movement. |

## What I'd Do With More Time
1. **WebGL Renderer**: For a true production app rendering millions of points across months of data, I would swap the 2D Canvas for `PixiJS` or raw WebGL.
2. **True Database**: Instead of writing unified JSON files, I would spin up a `ClickHouse` instance to store the parsed Parquet data, allowing for sub-millisecond SQL queries on massive datasets directly from the frontend.
3. **Scrubber Interpolation**: Currently, the scrubber jumps strictly between logged timestamps. I would add linear interpolation (`lerp`) to smoothly animate player icons between known positional timestamps.
