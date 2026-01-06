# QR Detection Service - Vercel Deployment Guide

This guide covers deploying the QR autofill Python service as a Flask microservice on Vercel.

## ⚠️ Important Limitations

**Vercel Python runtime has limitations with native dependencies:**
- OpenCV, Tesseract OCR, and pyzbar require system libraries
- Vercel serverless functions have limited native dependency support
- Binary sizes are restricted (50MB unzipped limit)

**Recommended Alternatives:**
- **Render** (Free tier, Docker support) - ✅ Best for this use case
- **Railway** (Good Python/Docker support)
- **Fly.io** (Excellent Docker support)
- **Google Cloud Run** (Docker, pay-per-use)

## Option 1: Deploy to Render (Recommended)

### Step 1: Create Render Service

1. Go to [render.com](https://render.com)
2. Create new **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Name**: `qr-autofill-service`
   - **Runtime**: `Docker`
   - **Build Command**: (auto-detected from Dockerfile)
   - **Start Command**: (auto-detected)

### Step 2: Create Dockerfile

```dockerfile
# Dockerfile (create in project root)
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libzbar0 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY api/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY api/qr_service.py .
COPY qr_autofill.py .

# Expose port
EXPOSE 5000

# Run Flask app
CMD ["python", "qr_service.py"]
```

### Step 3: Update Flask App for Production

Update `api/qr_service.py`:

```python
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
```

### Step 4: Get Service URL

After deployment, Render provides a URL like:
```
https://qr-autofill-service.onrender.com
```

---

## Option 2: Deploy to Vercel (With Limitations)

⚠️ **This approach may not work reliably due to native dependency constraints.**

### Step 1: Update vercel.json

Ensure `vercel.json` is configured correctly (already created).

### Step 2: Create Python Function Wrapper

Since Vercel doesn't directly support Flask routes, create a serverless function:

**`api/qr/process.py`** (Vercel Python function):

```python
from http.server import BaseHTTPRequestHandler
import json
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from qr_service import app

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Parse request
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        # Call Flask app
        # Note: This is a simplified wrapper - Flask integration needs proper WSGI adapter
        with app.test_request_context(
            path=self.path,
            method='POST',
            data=body,
            headers=dict(self.headers)
        ):
            response = app.full_dispatch_request()
        
        # Send response
        self.send_response(response.status_code)
        for header, value in response.headers:
            self.send_header(header, value)
        self.end_headers()
        self.wfile.write(response.data)
```

### Step 3: Alternative - Use Vercel Edge Functions (No Native Deps)

For Vercel, consider using **external OCR APIs** instead:
- Google Cloud Vision API
- AWS Textract
- Azure Computer Vision
- Cloudinary OCR

---

## Option 3: Hybrid Approach (Recommended for Vercel)

Deploy Python service separately (Render/Railway) and call from Next.js API route.

### Step 1: Deploy Python Service

Use Option 1 (Render) to deploy the Flask service.

### Step 2: Create Next.js API Route

**`app/api/qr/process/route.ts`**:

```typescript
import { NextRequest, NextResponse } from "next/server"

const QR_SERVICE_URL = process.env.QR_SERVICE_URL || "https://your-service.onrender.com"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get("image") as File

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      )
    }

    // Forward to Python service
    const serviceFormData = new FormData()
    serviceFormData.append("image", image)

    const response = await fetch(`${QR_SERVICE_URL}/api/qr/process`, {
      method: "POST",
      body: serviceFormData,
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error || "QR service failed" },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[QR API] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to process QR" },
      { status: 500 }
    )
  }
}
```

### Step 3: Add Environment Variable

**`.env.local`**:
```
QR_SERVICE_URL=https://your-qr-service.onrender.com
```

**`.env.production`** (Vercel dashboard):
```
QR_SERVICE_URL=https://your-qr-service.onrender.com
```

---

## Testing Locally

### Test Flask Service Locally

```bash
# Install dependencies
pip install -r api/requirements.txt

# Install system dependencies (macOS)
brew install tesseract
# Or Ubuntu: sudo apt-get install tesseract-ocr libzbar0

# Run Flask app
cd api
python qr_service.py

# Test with curl
curl -X POST http://localhost:5000/api/qr/process \
  -F "image=@/path/to/qr_screenshot.png"
```

### Test Next.js API Route

```bash
# Start Next.js dev server
npm run dev

# Test (from another terminal)
curl -X POST http://localhost:3000/api/qr/process \
  -F "image=@/path/to/qr_screenshot.png"
```

---

## Frontend Integration

Update your frontend to call the Next.js API:

```typescript
const handleQRUpload = async (file: File) => {
  const formData = new FormData()
  formData.append("image", file)

  const response = await fetch("/api/qr/process", {
    method: "POST",
    body: formData,
  })

  const result = await response.json()

  if (result.ok && result.full_name) {
    // Autofill host name
    setHostNameInput(result.full_name)
    
    // Display QR crop preview if needed
    if (result.qr_crop_base64) {
      const qrCropUrl = `data:image/png;base64,${result.qr_crop_base64}`
      setQRCropPreview(qrCropUrl)
    }
  }
}
```

---

## Troubleshooting

### Vercel Build Fails

If Vercel can't build native dependencies:
- Use **Render/Railway** instead (recommended)
- Or switch to cloud OCR APIs (Google Vision, AWS Textract)

### Service Timeout

- Increase timeout on Render (free tier: 30s, paid: longer)
- Optimize image size before sending
- Consider async processing with webhooks

### Tesseract Not Found

Ensure system dependencies are installed in Dockerfile:
```dockerfile
RUN apt-get update && apt-get install -y tesseract-ocr libzbar0
```

---

## Recommended Architecture

```
┌─────────────┐
│  Next.js    │
│  (Vercel)   │
└──────┬──────┘
       │
       │ POST /api/qr/process
       │
       ▼
┌─────────────────┐
│  Next.js API    │
│  Route          │
│  (Vercel)       │
└──────┬──────────┘
       │
       │ Forward to Python service
       │
       ▼
┌─────────────────┐
│  Flask Service  │
│  (Render)       │
│  - QR Detection │
│  - OCR          │
└─────────────────┘
```

This hybrid approach:
- ✅ Keeps Next.js on Vercel (optimal)
- ✅ Runs Python service on Render (native deps work)
- ✅ Simple API integration
- ✅ Cost-effective (Render free tier)

