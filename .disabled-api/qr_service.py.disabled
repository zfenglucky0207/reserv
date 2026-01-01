"""
Flask microservice for QR code detection and name extraction.
Deployable on Vercel as a serverless function.

API Endpoints:
  POST /api/qr/process
    - Accepts: multipart/form-data with 'image' file
    - Returns: JSON with { ok, full_name, qr_payload, qr_crop_base64, debug }
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import os
import tempfile
from typing import Optional, Dict, Any

# Import the QR processing function
# In Docker: qr_autofill.py is copied to same directory (/app)
# For local dev: add parent directory to path
import sys
from pathlib import Path

# Add project root to Python path (for local development)
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from qr_autofill import process_qr_screenshot, QRAutofillResult

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js frontend

# Max file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024


@app.route("/api/qr/process", methods=["POST"])
def process_qr():
    """
    Process QR screenshot: detect QR, crop, extract name.
    
    Request:
      - Content-Type: multipart/form-data
      - Field: 'image' (file)
    
    Response:
      {
        "ok": bool,
        "full_name": str | null,
        "qr_payload": str | null,
        "qr_crop_base64": str | null,  // Base64 encoded image
        "debug": dict
      }
    """
    try:
        # Check if file is in request
        if "image" not in request.files:
            return jsonify({
                "ok": False,
                "error": "No image file provided",
                "full_name": None,
                "qr_payload": None,
                "qr_crop_base64": None,
                "debug": {"reason": "missing_file"}
            }), 400

        file = request.files["image"]
        
        if file.filename == "":
            return jsonify({
                "ok": False,
                "error": "Empty file",
                "full_name": None,
                "qr_payload": None,
                "qr_crop_base64": None,
                "debug": {"reason": "empty_file"}
            }), 400

        # Read file into memory
        file_content = file.read()
        
        if len(file_content) > MAX_FILE_SIZE:
            return jsonify({
                "ok": False,
                "error": f"File too large (max {MAX_FILE_SIZE} bytes)",
                "full_name": None,
                "qr_payload": None,
                "qr_crop_base64": None,
                "debug": {"reason": "file_too_large"}
            }), 400

        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_input:
            tmp_input.write(file_content)
            tmp_input_path = tmp_input.name

        # Create output path
        tmp_output_path = tmp_input_path.replace(".png", "_crop.png")

        try:
            # Process QR screenshot
            result: QRAutofillResult = process_qr_screenshot(
                tmp_input_path,
                tmp_output_path
            )

            # Read cropped QR image if it exists
            qr_crop_base64 = None
            if result.ok and result.qr_crop_path and os.path.exists(result.qr_crop_path):
                with open(result.qr_crop_path, "rb") as f:
                    qr_crop_data = f.read()
                    qr_crop_base64 = base64.b64encode(qr_crop_data).decode("utf-8")

            # Return result
            response = {
                "ok": result.ok,
                "full_name": result.full_name,
                "qr_payload": result.qr_payload,
                "qr_crop_base64": qr_crop_base64,
                "debug": result.debug
            }

            return jsonify(response), 200

        finally:
            # Cleanup temporary files
            try:
                if os.path.exists(tmp_input_path):
                    os.unlink(tmp_input_path)
            except Exception:
                pass

            try:
                if os.path.exists(tmp_output_path):
                    os.unlink(tmp_output_path)
            except Exception:
                pass

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[QR Service] Error: {error_trace}")
        
        return jsonify({
            "ok": False,
            "error": str(e),
            "full_name": None,
            "qr_payload": None,
            "qr_crop_base64": None,
            "debug": {"error": str(e), "traceback": error_trace}
        }), 500


@app.route("/api/qr/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "qr-autofill",
        "version": "1.0.0"
    }), 200


# Vercel serverless function handler
def handler(request):
    """Vercel serverless function entry point."""
    return app(request.environ, request.start_response)


if __name__ == "__main__":
    # For production (Render/Railway): use PORT env var
    # For local development: default to 5000
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)

