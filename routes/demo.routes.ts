import { Router } from "express";
import { isDemoModeEnabled, listDemoReceipts } from "../demo/offlineTransport.js";

const router = Router();

/**
 * Lists the synthetic receipts available when DEMO_MODE is on.
 * Returns 404 when demo mode is off, so it is invisible in production.
 */
router.get("/receipts", (_req, res) => {
  if (!isDemoModeEnabled()) {
    return res.status(404).json({ error: "Not found" });
  }

  return res.status(200).json({
    demoMode: true,
    receipts: listDemoReceipts(),
  });
});

export default router;
