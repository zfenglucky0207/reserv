# Payment Proof OCR Integration Guide

This document outlines the OCR system for automatically extracting bank details from payment proof images.

## Components

1. **Frontend**: `components/payments/scanning-overlay.tsx` - Loading overlay shown during OCR scan
2. **Backend**: `app/api/payments/[id]/scan/route.ts` - API endpoint to trigger OCR scan
3. **OCR Script**: `ocr_scan.py` - Python script that extracts bank details from images

## Setup

### 1. Install Python Dependencies

```bash
# System dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y tesseract-ocr

# Python packages
pip install pillow pytesseract opencv-python numpy
```

### 2. Deploy OCR Service

**Option A: Separate Service (Recommended)**
- Deploy Python script as a service (Docker, Fly.io, Render, Cloud Run)
- Expose as HTTP endpoint that accepts image URL or image data
- Update API route to call this service

**Option B: Same Server**
- Only if you control the server runtime (not serverless like Vercel)
- Spawn Python process from Node.js API route

## Database Schema Requirements

To integrate this OCR system, your payment table should include:

```sql
-- Example schema (adjust column names to match your actual table)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_image_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS scan_status TEXT; -- 'pending' | 'done' | 'failed'
ALTER TABLE payments ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;
```

## Integration Steps

### 1. Update API Route

Edit `app/api/payments/[id]/scan/route.ts`:

1. Replace placeholder comments with actual payment table queries
2. Integrate OCR service call (Option A or B above)
3. Map OCR results to your payment table columns
4. Add proper error handling

### 2. Frontend Integration

When user uploads payment proof:

```tsx
// Example usage in your payment upload component
import { ScanningOverlay } from "@/components/payments/scanning-overlay"

function PaymentUpload() {
  const [scanning, setScanning] = useState(false)
  
  const handleUpload = async (imageFile: File) => {
    // 1. Upload image to Supabase Storage
    const imageUrl = await uploadToStorage(imageFile)
    
    // 2. Create/update payment record
    const payment = await createPayment({
      proof_image_url: imageUrl,
      // ... other fields
    })
    
    // 3. Trigger OCR scan
    setScanning(true)
    try {
      const response = await fetch(`/api/payments/${payment.id}/scan`, {
        method: "POST",
      })
      const result = await response.json()
      
      // 4. Prefill form fields with OCR results (if available)
      if (result.data) {
        setBankName(result.data.bank_name || "")
        setAccountNumber(result.data.account_number || "")
        setAccountName(result.data.account_name || "")
      }
    } catch (error) {
      // Handle error
    } finally {
      setScanning(false)
    }
  }
  
  return (
    <>
      <ScanningOverlay open={scanning} />
      {/* Your upload form */}
    </>
  )
}
```

### 3. UX Recommendations

**Always require confirmation:**
- Prefill fields with OCR results
- Show detected values: "We detected: Maybank · 1234567890 · JOHN TAN"
- Allow user to edit/correct
- If confidence is low, show "Couldn't confidently detect — please fill manually"

**Never auto-finalize:**
- Always require host/participant confirmation before marking as verified
- Store raw OCR text for debugging (but be mindful of privacy)

## Testing

```bash
# Test OCR script directly
python ocr_scan.py path/to/payment-proof.png
```

## Notes

- OCR is heuristic-based and may not be 100% accurate
- Always allow manual override/editing
- Consider storing raw OCR text for debugging
- Be mindful of privacy - don't log sensitive data unnecessarily

