# QR Autofill Integration Guide

This module provides QR code detection and name extraction from QR code screenshots, designed to autofill host display names when hosts upload QR screenshots.

## Overview

The `qr_autofill.py` script:
- **Detects QR codes** in screenshots using `pyzbar`
- **Crops and enhances** the QR region for better preview
- **Extracts host name** from the top region using OCR (Tesseract)
- **Returns structured data** for autofilling `host_name` in the session editor

## Installation

### Python Dependencies

```bash
pip install opencv-python pyzbar pillow pytesseract numpy
```

### System Dependencies

**macOS:**
```bash
brew install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr libzbar0
```

## Usage

### Command Line

```bash
python qr_autofill.py <input_image> <output_crop_image>
```

**Example:**
```bash
python qr_autofill.py qr_screenshot.png qr_crop.png
```

**Output (JSON):**
```json
{
  "ok": true,
  "full_name": "LOO ZFENG",
  "qr_payload": "https://qr.example.com/...",
  "qr_crop_path": "qr_crop.png",
  "debug": {
    "bbox": [100, 200, 300, 300],
    "payload_present": true
  }
}
```

### Python API

```python
from qr_autofill import process_qr_screenshot

result = process_qr_screenshot("input.png", "output_crop.png")

if result.ok:
    print(f"Name: {result.full_name}")
    print(f"QR Payload: {result.qr_payload}")
else:
    print(f"Failed: {result.debug}")
```

## Integration Options

### Option 1: Microservice (Recommended for Production)

Run the Python script as a separate service:

1. **Create a FastAPI/Flask service** that exposes an endpoint:
   ```python
   # qr_service.py
   from fastapi import FastAPI, UploadFile, File
   from qr_autofill import process_qr_screenshot
   import tempfile
   import os

   app = FastAPI()

   @app.post("/qr/process")
   async def process_qr(file: UploadFile = File(...)):
       with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_input:
           tmp_input.write(await file.read())
           tmp_input_path = tmp_input.name
       
       tmp_output_path = tmp_input_path.replace(".png", "_crop.png")
       
       result = process_qr_screenshot(tmp_input_path, tmp_output_path)
       
       # Cleanup
       os.unlink(tmp_input_path)
       if os.path.exists(tmp_output_path):
           # Upload crop to storage and return URL
           # os.unlink(tmp_output_path)
           pass
       
       return result.__dict__
   ```

2. **Deploy** to Render/Fly/Cloud Run/Railway
3. **Call from Next.js API route**:
   ```typescript
   // app/api/qr/process/route.ts
   const response = await fetch(`${process.env.QR_SERVICE_URL}/qr/process`, {
     method: "POST",
     body: formData, // contains the uploaded image
   });
   ```

### Option 2: Serverless Function (Vercel)

For Vercel, you'll need to use a separate service (Option 1) because Vercel Functions don't support native binaries like Tesseract/pyzbar easily.

### Option 3: Local Development (Child Process)

**⚠️ Not recommended for production**, but useful for local testing:

```typescript
// app/api/qr/process/route.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('image') as File;
  
  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const inputPath = join(tmpdir(), `qr_input_${Date.now()}.png`);
  const outputPath = join(tmpdir(), `qr_crop_${Date.now()}.png`);

  try {
    await writeFile(inputPath, buffer);
    
    const { stdout } = await execAsync(
      `python3 qr_autofill.py "${inputPath}" "${outputPath}"`
    );
    
    const result = JSON.parse(stdout);
    
    // Read the cropped QR image
    const cropBuffer = await readFile(outputPath);
    
    // Upload crop to Supabase Storage, etc.
    
    return Response.json({
      ...result,
      qr_crop_base64: cropBuffer.toString('base64'), // or upload to storage
    });
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
```

## Frontend Integration

### 1. Upload QR Screenshot

When host uploads a QR screenshot in the session editor:

```typescript
// components/session-invite.tsx (example)
const handleQRUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/api/qr/process', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (result.ok && result.full_name) {
    // Autofill host name
    setHostNameInput(result.full_name);
    setIsHostNameEditing(true);
    
    // Show QR crop preview if needed
    if (result.qr_crop_url) {
      setQRCropPreview(result.qr_crop_url);
    }
  }
};
```

### 2. Display QR Crop Preview

If you want to show the cropped QR code:

```tsx
{/* In your upload UI */}
{qrCropPreview && (
  <div className="mt-4">
    <img 
      src={qrCropPreview} 
      alt="QR Code Preview" 
      className="w-48 h-48 object-contain border rounded"
    />
  </div>
)}
```

## Data Flow

```
1. Host uploads QR screenshot → Frontend
2. Frontend → POST /api/qr/process (with image)
3. API route → Python QR service (or child process)
4. Python script:
   - Detects QR code bbox
   - Crops + enhances QR region
   - OCRs top region for name
   - Returns { full_name, qr_crop_path, qr_payload }
5. API route → Uploads crop to Supabase Storage (optional)
6. API route → Returns { full_name, qr_crop_url } to frontend
7. Frontend → Autofills host_name input field
```

## Fields in Database

The extracted `full_name` should populate:
- `sessions.host_name` (when creating/updating a session)

## Error Handling

The script returns `ok: false` if:
- QR code not detected (but may still extract name from top region)
- Image cannot be read
- OCR fails

Always check `result.ok` and handle gracefully (e.g., show manual input option).

## Testing

```bash
# Test with a sample QR screenshot
python qr_autofill.py test_qr.png test_crop.png

# Should output JSON with:
# - ok: true/false
# - full_name: extracted name or null
# - qr_payload: decoded QR data or null
# - qr_crop_path: path to cropped image
```

## Notes

- **Name extraction** works best when the name is in the top 10-40% of the image
- **QR detection** uses pyzbar (fast and reliable)
- **Image enhancement** includes upscaling and sharpening for better preview
- **OCR accuracy** depends on image quality; results should be validated by user

