# Ethiopian Payment Receipt Verifier

Verify payment receipts from Telebirr, CBE, Bank of Abyssinia and Amhara Bank
against your expected transaction details. Useful for automating payment
verification in e-commerce platforms, subscription services, or any system that
accepts Ethiopian digital payments.

Clone it or integrate the code into your project and start using it immediately.
Comes with a small web dashboard for manual checks and batch runs.

## Currently Supported Banks and Wallets

**✓ Telebirr** | **✓ CBE (Commercial Bank of Ethiopia)** | **✓ BOA (Bank of Abyssinia)** | **✓ Amhara Bank**

**More coming soon!**

## Performance Features

- **Parallel Batch Processing**: Verify up to 10 receipts simultaneously using concurrent processing
- **High-Performance HTTP Client**: Powered by `undici` with connection pooling and HTTP pipelining
- **Smart Connection Management**: Reuses TCP connections with 60s keep-alive for faster requests
- **Configurable Concurrency**: Adjust batch size and parallel processing limits in `config/performance.config.js`
- **Automatic Timeouts**: 15-second timeouts prevent hanging on unresponsive services

**Performance Impact**: ~10-15x faster batch processing compared to sequential verification.

## Setup

```bash
git clone https://github.com/esknder12/Ethio-rec-verifier.git
cd Ethio-rec-verifier
npm install
cp example.env .env   # then edit .env with YOUR expected values
npm start
```

`npm start` compiles TypeScript and boots the server on port 5000. Open
<http://localhost:5000> for the dashboard.

`example.env` documents every variable. **Ensure that all expected data matches
the receipt exactly in format and content.**

### Telebirr Configuration

```env
PROXY=proxy-host:proxy-port:proxy-username:proxy-password

TELEBIRR_EXPECTED_AMOUNT=100
TELEBIRR_EXPECTED_RECIPIENT_ACCOUNT=1000123456789
TELEBIRR_EXPECTED_RECIPIENT_NAME=Abrham Yalew
TELEBIRR_EXPECTED_PAYMENT_YEAR=2025
TELEBIRR_EXPECTED_PAYMENT_MONTH=12
TELEBIRR_EXPECTED_STATUS=Completed
```

**`PROXY` is only used when the request body includes `"proxy": true` for Telebirr verification.**

### CBE Receipt Configuration

```env
CBE_EXPECTED_AMOUNT=40
CBE_EXPECTED_RECIPIENT_ACCOUNT=1****1234
CBE_EXPECTED_RECIPIENT_NAME=ABRHAM YALEW
CBE_EXPECTED_PAYMENT_YEAR=2025
CBE_EXPECTED_PAYMENT_MONTH=12
```

CBE has two receipt formats, both supported: branch receipts (PDF, served from
`apps.cbe.com.et`) and mobile receipts (JSON, identified by a `-` before the
last eight digits).

### BOA (Bank of Abyssinia) Configuration

```env
BOA_EXPECTED_AMOUNT=200
BOA_EXPECTED_RECIPIENT_ACCOUNT=1******95
BOA_EXPECTED_RECIPIENT_NAME=TEWODROS HULGIZIE TEMESGEN
BOA_EXPECTED_PAYMENT_YEAR=25
BOA_EXPECTED_PAYMENT_MONTH=10
```

BOA dates are `MM/DD/YY`, so `BOA_EXPECTED_PAYMENT_YEAR` is two digits.

### Amhara Bank Configuration

```env
AB_EXPECTED_AMOUNT=25
AB_EXPECTED_RECIPIENT_ACCOUNT=ETB1251800010003
AB_EXPECTED_RECIPIENT_NAME=Abrham Yalew
AB_EXPECTED_PAYMENT_YEAR=2026
AB_EXPECTED_PAYMENT_MONTH=01
```

### Server Configuration

```env
PORT=5000
DEMO_MODE=false            # never enable in production — see "Demo mode"
TRUST_PROXY=1              # hops to trust for client IP detection
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=300         # requests per window
RATE_LIMIT_WINDOW_MS=900000
```

## Dashboard

With the server running, open <http://localhost:5000>. It supports single and
batch verification, per-field check selection, and shows the raw JSON response.
It is a thin client over the same public API — nothing it does is unavailable
over HTTP.

## Demo mode

Because the verifier depends on live bank endpoints, it cannot be exercised
offline. Setting `DEMO_MODE=true` swaps the **network call** for a synthetic
payload while leaving every parser, validator and controller untouched, so the
whole pipeline still runs — including the mismatch messages.

```bash
DEMO_MODE=true npm start
```

Or set `DEMO_MODE=true` in `.env` and start normally. The server prints a
warning banner and the dashboard shows one too.

**Demo mode never verifies a real receipt.** It is a development aid; leave it
off in production. See [`demo/README.md`](demo/README.md) for the catalog of
sample receipts and their known gaps.

## Docker

Use Docker when you want reproducible deployment across machines (same Node
version, same dependencies, same build output).

### Build the image

```bash
docker build -t urv .
```

### Run the container

```bash
docker run -p 5000:5000 --env-file .env urv
```

- `-p 5000:5000` maps your host port `5000` to container port `5000`
- `--env-file .env` injects expected verification values at runtime

## API Usage

**POST** `http://localhost:5000/api/verify`

### 1. Verification

Supports both query-param based and path-based URLs, as well as standalone IDs.

**Option A: Using Receipt ID**

```json
{
  "receipt": "FT253183LQF089873510",
  "defaultVerification": true
}
```

**Option B: Using Full URL**

```json
{
  "receipt": "https://apps.cbe.com.et:100/BranchReceipt/FT25292FRPWD&89873710",
  "defaultVerification": true
}
```

**Option C: Telebirr With Proxy Enabled**

```json
{
  "receipt": "CJP9OSP9WZ",
  "defaultVerification": true,
  "proxy": true
}
```

### 2. Custom Field Verification

Select specific fields to verify for any receipt type:

```json
{
  "receipt": "FT253183LQF089873510",
  "defaultVerification": {
    "amount": true,
    "recipientName": true,
    "date": true,
    "accountNumber": true
  }
}
```

_Note: `status` verification is skipped for CBE and BOA receipts as it's not explicitly present._
_Note: `proxy` is Telebirr-only. If omitted or `false`, direct request mode is used._

### 3. Health Check

**GET** `http://localhost:5000/health`

```json
{
  "status": "ok",
  "demoMode": false,
  "rateLimitEnabled": true,
  "uptimeSeconds": 128
}
```

## Batch Receipt Verification

Verify multiple Telebirr, CBE, and BOA receipts in a single request.

**POST** `http://localhost:5000/api/verify/batch`

**Request:**

```json
{
  "receipt": ["CJP9OSP9WZ", "FT25284X11PS79328"],
  "defaultVerification": true,
  "proxy": true
}
```

_For batch requests, `proxy` must be a boolean when provided. Proxy is applied only for Telebirr items; other providers continue using direct mode._

**Response:**

```json
{
  "result": ["CJP9OSP9WZ", "FT25284X11PS79328"],
  "failed": [
    {
      "receiptId": "FT25284X11PS79329",
      "error": "Mismatch on recipientName. Expected: TEWODROS HULGIZIE TEMESGEN, Actual: TEWODROS HULGIZIE TEMES"
    }
  ],
  "summary": {
    "total": 3,
    "valid": 2,
    "invalid": 1
  }
}
```

## Config

### Verification Settings

Edit `config/verification.config.js` to change default verification fields and expected values.

### Performance Settings

Edit `config/performance.config.js` to tune batch processing:

```javascript
export default {
  batch: {
    maxBatchSize: 10,
    defaultConcurrency: 10,
    timeout: 60000,
  },
};
```

**Tuning Tips:**

- Increase `defaultConcurrency` (e.g., 20) for faster processing if your server can handle it
- Decrease it (e.g., 5) if you're hitting rate limits from bank services
- Adjust `maxBatchSize` based on your typical use case

## Responses

**Valid receipt:**

```json
{
  "message": "The receipt 'CJP9OSP9WZ' is a valid receipt."
}
```

**Mismatch found:**

```json
{
  "error": "Mismatch on amount. Expected: 100, Actual: 999.00"
}
```

## Fields You Can Verify

| Field           | What it checks                          |
| --------------- | --------------------------------------- |
| `amount`        | Payment amount matches                  |
| `status`        | Transaction status (Telebirr only)      |
| `recipientName` | Recipient name matches                  |
| `accountNumber` | Recipient account number                |
| `date`          | Payment happened in expected year/month |

## Project Structure

```
config/       expected values and tunables
controllers/  request handling, provider dispatch
demo/         offline synthetic fixtures (DEMO_MODE only)
routes/       express routers
services/     upstream HTTP client + batch processor
utils/        receipt ID/URL parsers, error types
validators/   per-provider field extraction and comparison
public/       dashboard (static, no build step)
```

## Licence

MIT — see [LICENCE](LICENCE).
