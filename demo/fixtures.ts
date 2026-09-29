/**
 * DEMO ONLY — synthetic upstream payloads.
 *
 * See ./README.md. Nothing here is real bank data, and none of it is used
 * unless DEMO_MODE=true.
 *
 * Each `payload` is shaped exactly like the response the real bank endpoint
 * returns, because the parsers and validators run unmodified against it.
 */
import type { ReceiptData } from "../types/serviceTypes.js";

export type DemoProvider = "telebirr" | "cbeMb" | "boa" | "amharaBank";

export type DemoReceipt = {
  /** The receipt ID after parsing — this is the key `receiptService` looks up. */
  id: string;
  provider: DemoProvider;
  /** Human label for the dashboard. */
  title: string;
  /** What a successful run looks like when using the sample `example.env` values. */
  expectation: "pass" | "fail";
  /** Why the sample outcome happens. */
  note: string;
  /** The values the synthetic receipt actually contains. */
  values: {
    amount: string;
    recipientName: string;
    accountNumber: string;
    date: string;
    status?: string;
  };
  build: () => ReceiptData;
};

/**
 * Telebirr renders a server-side HTML page. The validator scrapes:
 *   - `#paid_reference_number` -> "<account> <name>"
 *   - the table containing a "Settled Amount" header
 *   - the table containing a "Transaction status" header
 * The payment date column is parsed as `DD-MM-YYYY HH:mm:ss`.
 */
const telebirrHtml = (r: {
  accountNumber: string;
  recipientName: string;
  amount: string;
  date: string;
  status: string;
}): string => `<!DOCTYPE html>
<html>
  <head><title>telebirr Transaction Receipt</title></head>
  <body>
    <div class="banner">telebirr Transaction Receipt</div>
    <div id="paid_reference_number">${r.accountNumber} ${r.recipientName}</div>
    <table class="invoice">
      <tr>
        <td>Settled Amount</td>
        <td>Payment date</td>
      </tr>
      <tr>
        <td>${r.amount} Birr</td>
        <td>${r.date}</td>
      </tr>
    </table>
    <table class="status">
      <tr>
        <td>Transaction status</td>
        <td>${r.status}</td>
      </tr>
    </table>
  </body>
</html>`;

export const DEMO_RECEIPTS: DemoReceipt[] = [
  {
    id: "CJP9OSP9WZ",
    provider: "telebirr",
    title: "Telebirr — matching receipt",
    expectation: "pass",
    note: "Every field agrees with the sample expected values.",
    values: {
      amount: "100.00",
      recipientName: "Abrham Yalew",
      accountNumber: "1000123456789",
      date: "15-12-2025 10:30:00",
      status: "Completed",
    },
    build: () =>
      telebirrHtml({
        accountNumber: "1000123456789",
        recipientName: "Abrham Yalew",
        amount: "100.00",
        date: "15-12-2025 10:30:00",
        status: "Completed",
      }),
  },
  {
    id: "CJP9OSP9WX",
    provider: "telebirr",
    title: "Telebirr — amount mismatch",
    expectation: "fail",
    note: "Receipt says 999.00 Birr, expected is 100. Watch the amount check fire.",
    values: {
      amount: "999.00",
      recipientName: "Abrham Yalew",
      accountNumber: "1000123456789",
      date: "15-12-2025 10:30:00",
      status: "Completed",
    },
    build: () =>
      telebirrHtml({
        accountNumber: "1000123456789",
        recipientName: "Abrham Yalew",
        amount: "999.00",
        date: "15-12-2025 10:30:00",
        status: "Completed",
      }),
  },
  {
    id: "FT25284X11PS79328",
    provider: "boa",
    title: "BOA — matching receipt",
    expectation: "pass",
    note: "Transaction date is parsed as MM/DD/YY.",
    values: {
      amount: "200",
      recipientName: "TEWODROS HULGIZIE TEMESGEN",
      accountNumber: "1******95",
      date: "10/10/25 14:22:31",
    },
    build: () => ({
      "Transaction Date": "10/10/25 14:22:31",
      "Transferred Amount": 200,
      "Receiver's Name": "TEWODROS HULGIZIE TEMESGEN",
      "Receiver's Account": "1******95",
    }),
  },
  {
    id: "FT25284X11PS79329",
    provider: "boa",
    title: "BOA — recipient mismatch",
    expectation: "fail",
    note: "Money went to a different account holder.",
    values: {
      amount: "200",
      recipientName: "TEWODROS HULGIZIE TEMES",
      accountNumber: "1******95",
      date: "10/10/25 14:22:31",
    },
    build: () => ({
      "Transaction Date": "10/10/25 14:22:31",
      "Transferred Amount": 200,
      "Receiver's Name": "TEWODROS HULGIZIE TEMES",
      "Receiver's Account": "1******95",
    }),
  },
  {
    id: "AMH123456789",
    provider: "amharaBank",
    title: "Amhara Bank — matching receipt",
    expectation: "pass",
    note: "bookingDate is YYYYMMDD; status must be \"Auth\".",
    values: {
      amount: "25",
      recipientName: "Abrham Yalew",
      accountNumber: "ETB1251800010003",
      date: "20260115",
      status: "Auth",
    },
    build: () => ({
      status: "Auth",
      bookingDate: "20260115",
      amount: "25",
      creditorName: "Abrham Yalew",
      creditAccountId: "ETB1251800010003",
    }),
  },
  {
    id: "FT253183LQF0-89873510",
    provider: "cbeMb",
    title: "CBE (mobile) — matching receipt",
    expectation: "pass",
    note: "JSON path. Same validator as the PDF path, so comparison logic is covered.",
    values: {
      amount: "40",
      recipientName: "ABRHAM YALEW",
      accountNumber: "1****1234",
      date: "12/15/2025",
    },
    build: () => ({
      id: "FT253183LQF0-89873510",
      debitAmount: "40.00",
      amountDebited: "40.00",
      creditAccountNo: "1****1234",
      creditAccountHolder: "ABRHAM YALEW",
      dateTimes: ["2025-12-15T10:30:00"],
    }),
  },
];

export const findDemoReceipt = (id: string): DemoReceipt | undefined =>
  DEMO_RECEIPTS.find((entry) => entry.id === id);
