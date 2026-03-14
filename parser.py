import os
import glob
import json
import pandas as pd # type: ignore
import datetime
import typing

# --- Config ---
UPLOAD_DIR = "player_data"
STATIC_DIR = "public"
DATA_DIR = os.path.join(STATIC_DIR, "data")

os.makedirs(DATA_DIR, exist_ok=True)

def get_event_name(event_id):
    """Maps internal event IDs or string labels to human-readable names."""
    if isinstance(event_id, int):
        mapping = {
            0: 'Position', 6: 'Kill', 7: 'Death', 10: 'StormDeath', 
            11: 'BotStormDeath', 12: 'Loot', 15: 'BotPosition', 
            16: 'BotKill', 17: 'BotDeath'
        }
        return mapping.get(event_id, f"Unknown_{event_id}")

    name = str(event_id)
    # Standardize game engine string telemetry to Frontend terms
    if name == 'Killed': return 'Death'
    if name == 'BotKilled': return 'BotDeath'
    if name == 'StormKilled': return 'StormDeath'
    if name == 'BotStormKilled': return 'BotStormDeath'
    
    return name

def process_all_data():
    """
    Reads all `.parquet` and `.nakama-0` files in `UPLOAD_DIR`.
    Outputs a unified JSON grouping events by `Map Name` -> `Match ID`.
    """
    print(f"[Parser] Scanning {UPLOAD_DIR} for data files...")
    all_files = glob.glob(os.path.join(UPLOAD_DIR, "**", "*.parquet"), recursive=True) + \
                glob.glob(os.path.join(UPLOAD_DIR, "**", "*.nakama-0"), recursive=True)

    if not all_files:
        print("[Parser] No data files found.")
        return False

    # unified_db: MapName -> MatchID -> { date: str, events: [] }
    unified_db: typing.Any = {}
    total_events: int = 0

    for filepath in all_files:
        print(f"[Parser] Processing: {filepath}")
        try:
            df = pd.read_parquet(filepath)
        except Exception as e:
            print(f"[Parser] Error reading {filepath}: {e}")
            continue

        # Validate Schema
        required = ['match_id', 'user_id', 'ts', 'event']
        missing = [c for c in required if c not in df.columns]
        if missing:
            print(f"[Parser] Skip {filepath}: Missing {missing}")
            continue

        # Drop duplicate events
        initial_len = len(df)
        df = df.drop_duplicates()
        if len(df) < initial_len:
            print(f"[Parser] Dropped {initial_len - len(df)} duplicate events in {filepath}")

        # Fill missing columns gracefully
        if 'x' not in df.columns: df['x'] = 0.0
        if 'y' not in df.columns: df['y'] = 0.0
        if 'z' not in df.columns: df['z'] = 0.0
        if 'is_bot' not in df.columns: 
            # Human IDs are UUIDs (36 chars), Bot IDs are short numeric strings
            df['is_bot'] = df['user_id'].astype(str).str.len() < 30
        if 'map_id' not in df.columns: df['map_id'] = "UnknownMap"

        """
        The game engine logs 'ts' as Epoch Seconds. PyArrow incorrectly surfaces this 
        as datetime64[ms] treating the seconds as milliseconds.
        We extract the raw integer (Epoch Seconds) and multiply by 1000
        to output accurate absolute Milliseconds for the JS frontend Timeline UI.
        """
        df['ts_ms'] = df['ts'].astype('int64') * 1000

        # Group operations
        for (map_id, match_id), group in df.groupby(['map_id', 'match_id']):
            map_name = str(map_id)
            match_str = str(match_id)

            if map_name not in unified_db:
                unified_db[map_name] = {}

            if match_str not in unified_db[map_name]: # type: ignore
                # Build Date from the earliest epoch in this specific match
                min_ts_sec = int(group['ts_ms'].min() / 1000)
                dt = datetime.datetime.fromtimestamp(min_ts_sec, tz=datetime.timezone.utc)
                date_str = dt.strftime('%d %b %Y')

                unified_db[map_name][match_str] = { # type: ignore
                    "date": date_str,
                    "events": []
                }

            # Pre-sort this chunk
            group = group.sort_values(by='ts_ms')

            for _, row in group.iterrows():
                # Handle PyArrow byte string decoding
                ev_val = row['event']
                if isinstance(ev_val, bytes):
                    ev_val = ev_val.decode('utf-8')
                ev_str = get_event_name(ev_val)
                # [ UID, isBot, EventType, X, Z, TimestampMs ]
                unified_db[map_name][match_str]["events"].append([ # type: ignore
                    str(row['user_id']),
                    bool(row['is_bot']),
                    ev_str,
                    float(row['x']),
                    float(row['z']), # Horizontal depth coordinate uses Z
                    int(row['ts_ms'])
                ])
                total_events += 1 # type: ignore

    print(f"[Parser] Success! Parsed {total_events} raw events.")

    # Write per-map JSON files and a metadata index
    maps_found: typing.List[str] = []
    for map_name, matches in unified_db.items():
        maps_found.append(map_name)
        out_file = os.path.join(DATA_DIR, f"{map_name}.json")
        with open(out_file, 'w') as f:
            json.dump(matches, f)
        print(f"[Parser] Wrote {map_name}.json")

    meta_file = os.path.join(DATA_DIR, "meta.json")
    with open(meta_file, 'w') as f:
        json.dump({"maps": maps_found}, f)

    return True

if __name__ == "__main__":
    process_all_data()
