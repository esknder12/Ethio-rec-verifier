/**
 * DEMO ONLY — the offline stand-in for `services/receiptService.ts`.
 *
 * Called only when DEMO_MODE is enabled. See ./README.md.
 */
import { AppError, NotFoundError } from "../utils/errorHandler.js";
import { DEMO_RECEIPTS, findDemoReceipt } from "./fixtures.js";
import type { DemoReceipt } from "./fixtures.js";
import type { ReceiptData } from "../types/serviceTypes.js";

/** CBE branch receipts come back as PDFs, which the demo catalog does not cover. */
const CBE_PDF_ID = /^[A-Z0-9]{12}(\d{8}|&\d{8})$/;

export const isDemoModeEnabled = (): boolean => {
  const raw = (process.env.DEMO_MODE ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
};

/**
 * Resolve a receipt ID to a synthetic payload.
 *
 * Throws instead of returning undefined so the caller surfaces a real HTTP
 * status, exactly as a live upstream failure would.
 */
export const getDemoReceiptData = async (
  receiptId: string,
): Promise<ReceiptData> => {
  const demo = findDemoReceipt(receiptId);

  if (demo) {
    return demo.build();
  }

  if (CBE_PDF_ID.test(receiptId)) {
    throw new AppError(
      `Demo mode cannot verify CBE PDF receipt '${receiptId}'. ` +
        "The offline catalog covers Telebirr, BOA, Amhara Bank and CBE mobile only — " +
        "use a real receipt ID with DEMO_MODE disabled to test the PDF path.",
      501,
    );
  }

  throw new NotFoundError(
    `Receipt '${receiptId}' is not in the demo catalog. ` +
      `Try one of: ${DEMO_RECEIPTS.map((r) => r.id).join(", ")}`,
  );
};

/** Safe-to-expose catalog metadata for the dashboard. */
export const listDemoReceipts = () =>
  DEMO_RECEIPTS.map(({ id, provider, title, expectation, note, values }) => ({
    id,
    provider,
    title,
    expectation,
    note,
    values,
  }));

export type { DemoReceipt };
