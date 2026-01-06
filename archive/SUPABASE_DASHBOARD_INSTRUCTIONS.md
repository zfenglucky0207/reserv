# Supabase Dashboard: Add OCR Columns to payment_proofs Table

Based on your `types/supabase.ts`, here's what to add in the Supabase Dashboard.

## Current Schema (from types/supabase.ts)

Your `payment_proofs` table already has:
- ✅ `ocr_status` (enum: 'pending' | 'success' | 'failed')
- ✅ `ocr_payload` (JSONB) - for storing full OCR results
- ✅ `ocr_confidence` (number) - confidence score

## Missing Columns (Add These)

You need to add these columns to support OCR extraction:

### 1. `proof_image_url` (TEXT)
- **Purpose**: Store the Supabase Storage URL of the uploaded payment proof image
- **Type**: `TEXT`
- **Nullable**: `YES` (allow null initially, set when image is uploaded)

### 2. `bank_name` (TEXT)
- **Purpose**: Extracted bank name from OCR (e.g., "Maybank", "CIMB")
- **Type**: `TEXT`
- **Nullable**: `YES`

### 3. `account_number` (TEXT)
- **Purpose**: Extracted account number from OCR
- **Type**: `TEXT`
- **Nullable**: `YES`

### 4. `account_name` (TEXT)
- **Purpose**: Extracted account holder name from OCR
- **Type**: `TEXT`
- **Nullable**: `YES`

### 5. `scanned_at` (TIMESTAMPTZ)
- **Purpose**: Timestamp when OCR scan was completed
- **Type**: `TIMESTAMPTZ` (timestamp with timezone)
- **Nullable**: `YES`

---

## How to Add in Supabase Dashboard

### Option A: SQL Editor (Recommended)

1. Go to **Supabase Dashboard → SQL Editor**
2. Create a new query
3. Paste this SQL:

```sql
-- Add OCR-related columns to payment_proofs table
ALTER TABLE public.payment_proofs 
ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

ALTER TABLE public.payment_proofs 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS account_name TEXT;

ALTER TABLE public.payment_proofs 
ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN public.payment_proofs.proof_image_url IS 'URL to the payment proof image in Supabase Storage';
COMMENT ON COLUMN public.payment_proofs.bank_name IS 'Bank name extracted from OCR (e.g., "Maybank", "CIMB")';
COMMENT ON COLUMN public.payment_proofs.account_number IS 'Account number extracted from OCR';
COMMENT ON COLUMN public.payment_proofs.account_name IS 'Account holder name extracted from OCR';
COMMENT ON COLUMN public.payment_proofs.scanned_at IS 'Timestamp when OCR scan was completed';
```

4. Click **Run** to execute

### Option B: Table Editor (Manual)

1. Go to **Supabase Dashboard → Table Editor**
2. Select `payment_proofs` table
3. Click **Add Column** for each column:

   **Column 1: proof_image_url**
   - Name: `proof_image_url`
   - Type: `text`
   - Nullable: ✅ Yes
   - Default: (leave empty)

   **Column 2: bank_name**
   - Name: `bank_name`
   - Type: `text`
   - Nullable: ✅ Yes
   - Default: (leave empty)

   **Column 3: account_number**
   - Name: `account_number`
   - Type: `text`
   - Nullable: ✅ Yes
   - Default: (leave empty)

   **Column 4: account_name**
   - Name: `account_name`
   - Type: `text`
   - Nullable: ✅ Yes
   - Default: (leave empty)

   **Column 5: scanned_at**
   - Name: `scanned_at`
   - Type: `timestamptz`
   - Nullable: ✅ Yes
   - Default: (leave empty)

4. Click **Save** after adding each column

---

## Verify Columns Were Added

After adding, verify in SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'payment_proofs'
  AND column_name IN ('proof_image_url', 'bank_name', 'account_number', 'account_name', 'scanned_at')
ORDER BY column_name;
```

You should see all 5 columns listed.

---

## After Adding Columns

1. **Regenerate TypeScript types** (if using Supabase CLI):
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts
   ```

2. **Update your code** - The API route (`app/api/payments/[id]/scan/route.ts`) is already updated to use these columns.

3. **Test the flow** - Upload a payment proof image and trigger the OCR scan.

---

## Notes

- All new columns are **nullable** to support existing records
- `ocr_status` enum already exists: `'pending' | 'success' | 'failed'`
- `ocr_payload` (JSONB) already exists for storing full OCR results including `raw_text` and `confidence_notes`
- `ocr_confidence` (number) already exists for storing confidence score (0-1)

