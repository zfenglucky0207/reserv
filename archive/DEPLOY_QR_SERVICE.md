# Quick Start: Deploy QR Service to Render

## Why Render Instead of Vercel?

Vercel's Python runtime has **limited support for native dependencies** (OpenCV, Tesseract). Render provides Docker support, making it perfect for this use case.

## 🚀 Deploy in 5 Minutes

### Step 1: Push to GitHub

Ensure your code is pushed to GitHub (including the new files):
- `api/qr_service.py`
- `api/requirements.txt`
- `qr_autofill.py`
- `Dockerfile`

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Render will auto-detect `render.yaml`:
   - **Name**: `qr-autofill-service`
   - **Runtime**: Docker (auto-detected)
   - **Build Command**: (auto)
   - **Start Command**: (auto)
5. Click **"Create Web Service"**
6. Wait 5-10 minutes for build to complete

### Step 3: Get Your Service URL

After deployment, Render provides a URL like:
```
https://qr-autofill-service.onrender.com
```

### Step 4: Configure Next.js

Add to your **Vercel environment variables**:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   ```
   QR_SERVICE_URL=https://qr-autofill-service.onrender.com
   ```
3. Redeploy your Next.js app

### Step 5: Test

```bash
# Test the service directly
curl -X POST https://qr-autofill-service.onrender.com/api/qr/process \
  -F "image=@/path/to/qr_screenshot.png"

# Or test via Next.js API
curl -X POST https://your-nextjs-app.vercel.app/api/qr/process \
  -F "image=@/path/to/qr_screenshot.png"
```

## 📁 Files Created

- `api/qr_service.py` - Flask microservice
- `api/requirements.txt` - Python dependencies
- `Dockerfile` - Docker container config
- `render.yaml` - Render deployment config
- `app/api/qr/process/route.ts` - Next.js API proxy

## 🏗️ Architecture

```
User Uploads QR Image
       ↓
Next.js Frontend
       ↓
/app/api/qr/process (Next.js API Route on Vercel)
       ↓
QR_SERVICE_URL (Flask Service on Render)
       ↓
Returns: { full_name, qr_payload, qr_crop_base64 }
```

## 🔧 Local Development

```bash
# Terminal 1: Run Flask service
cd api
pip install -r requirements.txt
python qr_service.py
# Service runs on http://localhost:5000

# Terminal 2: Run Next.js (with env var)
QR_SERVICE_URL=http://localhost:5000 npm run dev
# Next.js runs on http://localhost:3000
```

## 💰 Cost

- **Render Free Tier**: 750 hours/month (enough for small projects)
- **Vercel**: Free tier (Next.js hosting)
- **Total**: $0/month for small projects

## 🐛 Troubleshooting

### Build fails on Render

Check Dockerfile logs in Render dashboard. Common issues:
- Missing system dependencies (already included in Dockerfile)
- Python version mismatch (using 3.11 in Dockerfile)

### Service timeout

Render free tier has 30s timeout. Optimize image size or upgrade to paid tier.

### Tesseract not found

The Dockerfile already installs Tesseract. If issues persist, check build logs.

## 📝 Next Steps

1. Deploy to Render ✅
2. Add `QR_SERVICE_URL` to Vercel env vars ✅
3. Integrate QR upload in frontend (create upload component)
4. Test end-to-end flow

---

**Need help?** Check `QR_VERCEL_DEPLOYMENT.md` for detailed troubleshooting.

