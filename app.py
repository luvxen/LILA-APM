import os
import subprocess
from flask import Flask, send_from_directory, request, jsonify # type: ignore

app = Flask(__name__, static_folder='public')

UPLOAD_FOLDER = 'player_data'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def serve_index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('public', path)

@app.route('/upload', methods=['POST'])
def upload_files():
    if 'files' not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({"error": "No selected files"}), 400

    target_dir = os.path.join(UPLOAD_FOLDER, 'UploadedBatch')
    os.makedirs(target_dir, exist_ok=True)

    saved_count = 0
    for f in files:
        if f and (f.filename.endswith('.parquet') or f.filename.endswith('.nakama-0')):
            safe_name = os.path.basename(f.filename) # Mitigate dict traversal
            f.save(os.path.join(target_dir, safe_name))
            saved_count += 1

    if saved_count > 0:
        # Trigger the unified parser script
        try:
            print(f"[Server] Triggering parser.py for {saved_count} new files...")
            proc = subprocess.run(['python3', 'parser.py'], capture_output=True, text=True, check=True)
            print(proc.stdout)
            return jsonify({"success": True, "message": "Unified database updated successfully."})
        except subprocess.CalledProcessError as e:
            print(f"[Server] Parser Failed: {e.stderr}")
            return jsonify({"error": "Failed to parse files. See server logs."}), 500

    return jsonify({"error": "No valid parquet files found."}), 400


if __name__ == '__main__':
    print("Starting LILA APM Backend on http://localhost:8000")
    app.run(host='0.0.0.0', port=8000, debug=True)
