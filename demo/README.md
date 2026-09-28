# Demo mode (offline, synthetic data)

**Nothing in this directory performs real verification.** It exists so the API and
the dashboard can be exercised without network access to the bank endpoints.

## What it does

When `DEMO_MODE=true`, `services/receiptService.ts` short-circuits at the *network
boundary* only. Every request for a receipt ID in the catalog below returns a
synthetic payload shaped exactly like the real upstream response.

Everything downstream still runs for real:

- `utils/receiptParser.ts` — URL / ID parsing
- the provider validator in `validators/` — cheerio scraping, field extraction,
  comparison against your `expectedData`, mismatch messages
- `controllers/` — request validation, status codes, batch fan-out and concurrency

So a demo result tells you the *pipeline* works. It says nothing about whether a
real receipt is genuine. Demo mode is off unless you explicitly enable it.

## Enabling

```env
DEMO_MODE=true
```

The server prints a loud warning at startup, and the dashboard shows a banner.

## Catalog

| Receipt ID | Provider | Result | Notes |
| --- | --- | --- | --- |
| `CJP9OSP9WZ` | Telebirr | passes | Matches the sample `.env` values |
| `CJP9OSP9WX` | Telebirr | fails | Amount is 999, not the expected 100 |
| `FT25284X11PS79328` | BOA | passes | |
| `FT25284X11PS79329` | BOA | fails | Recipient name differs |
| `AMH123456789` | Amhara Bank | passes | |
| `FT253183LQF0-89873510` | CBE (mobile) | passes | JSON API path |

"Passes" assumes you are using the sample values in `example.env`. If you set your
own expected values, these receipts will legitimately fail — which is itself a
useful way to confirm the comparison logic is running.

## Known gap: CBE legacy PDF receipts

CBE branch receipts served from `apps.cbe.com.et` are PDFs, and the demo
catalog does **not** include one. Asking for a PDF-style CBE ID in demo mode
returns `501 Not Implemented` with an explanatory message rather than a fake result.

Two reasons:

1. A PDF fixture has to be a genuine, well-formed PDF for the real `pdf-parse`
   extraction path to be exercised at all. Hand-built PDFs that only *look*
   right end up testing nothing, or worse, failing for unrelated reasons.
2. The PDF path's real risk is in text extraction and layout assumptions, which a
   synthetic fixture cannot validate anyway.

Test that path against a real CBE receipt. The CBE mobile JSON path
(`FT253183LQF0-89873510`) is covered and shares the same validator.

## Adding a fixture

Add an entry to the array in `fixtures.ts`. The `payload` must match what the
provider actually returns — the validators and parsers do not know they are in
demo mode, so a badly shaped payload will fail exactly as a real bad response would.
