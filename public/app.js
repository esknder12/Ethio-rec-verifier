/**
 * Dashboard for the Ethiopian Receipt Verifier.
 * Talks to the same-origin API only, so it works behind any proxy.
 */

const $ = (id) => document.getElementById(id);

const receiptInput = $("receiptInput");
const verifyBtn = $("verifyBtn");
const clearBtn = $("clearBtn");
const runAllBtn = $("runAllBtn");
const proxyToggle = $("proxyToggle");
const fieldChecks = $("fieldChecks");
const resultsEl = $("results");
const summaryEl = $("summary");
const rawWrap = $("rawWrap");
const rawOut = $("rawOut");
const catalogCard = $("catalogCard");
const catalogBody = $("catalogBody");

let demoReceipts = [];

/* ---------------- rendering helpers ---------------- */

const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
};

const addResult = (parent, receiptId, ok, message) => {
  const box = document.createElement("div");
  box.className = `result ${ok ? "result-ok" : "result-bad"}`;

  const id = document.createElement("div");
  id.className = "result-id";
  id.textContent = receiptId;
  box.appendChild(id);

  if (message) {
    const msg = document.createElement("div");
    msg.className = "result-msg";
    msg.textContent = message;
    box.appendChild(msg);
  }

  parent.appendChild(box);
};

const addSummaryChip = (label, kind) => {
  const chip = document.createElement("span");
  chip.className = `pill ${kind}`;
  chip.textContent = label;
  summaryEl.appendChild(chip);
};

const showRaw = (payload) => {
  rawWrap.hidden = false;
  rawOut.textContent = JSON.stringify(payload, null, 2);
};

/* ---------------- request building ---------------- */

const buildVerification = () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  if (mode === "all") return true;

  const flags = {};
  for (const box of fieldChecks.querySelectorAll("input[type=checkbox]")) {
    if (box.checked) flags[box.value] = true;
  }
  return flags;
};

const postJson = async (url, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = { error: `Unexpected non-JSON response (HTTP ${res.status})` };
  }
  return { status: res.status, ok: res.ok, payload };
};

/* ---------------- verify ---------------- */

const renderSingle = (payload, receipt) => {
  if (payload.error) {
    addResult(resultsEl, receipt, false, payload.error);
    return;
  }
  addResult(resultsEl, receipt, true, payload.message ?? "Valid receipt.");
};

const renderBatch = (payload) => {
  for (const item of payload.result ?? []) {
    addResult(resultsEl, item, true, "Valid receipt.");
  }
  for (const item of payload.failed ?? []) {
    addResult(resultsEl, item.receiptId, false, item.error);
  }
};

const setBusy = (busy) => {
  verifyBtn.disabled = busy;
  runAllBtn.disabled = busy;
  verifyBtn.innerHTML = busy
    ? '<span class="spinner"></span>Verifying…'
    : "Verify";
};

const verify = async () => {
  const lines = receiptInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    clear(resultsEl);
    summaryEl.hidden = true;
    rawWrap.hidden = true;
    addResult(resultsEl, "Nothing to verify", false, "Enter at least one receipt ID or URL.");
    return;
  }

  const verification = buildVerification();

  if (typeof verification === "object" && Object.keys(verification).length === 0) {
    clear(resultsEl);
    summaryEl.hidden = true;
    rawWrap.hidden = true;
    addResult(
      resultsEl,
      "No fields selected",
      false,
      "Pick at least one field to check, or switch to “All configured fields”.",
    );
    return;
  }

  const body = { defaultVerification: verification };
  if (proxyToggle.checked) body.proxy = true;

  clear(resultsEl);
  summaryEl.hidden = true;
  rawWrap.hidden = true;
  setBusy(true);

  try {
    if (lines.length === 1) {
      const { payload } = await postJson("/api/verify", {
        ...body,
        receipt: lines[0],
      });
      renderSingle(payload, lines[0]);
      showRaw(payload);
    } else {
      const { payload } = await postJson("/api/verify/batch", {
        ...body,
        receipt: lines,
      });
      renderBatch(payload);
      showRaw(payload);

      if (payload.summary) {
        summaryEl.hidden = false;
        addSummaryChip(`total ${payload.summary.total}`, "pill-muted");
        addSummaryChip(`valid ${payload.summary.valid}`, "pill-ok");
        if (payload.summary.invalid > 0) {
          addSummaryChip(`invalid ${payload.summary.invalid}`, "pill-demo");
        }
      }
    }
  } catch (err) {
    addResult(resultsEl, "Request failed", false, err.message);
  } finally {
    setBusy(false);
  }
};

/* ---------------- demo catalog ---------------- */

const renderCatalog = (receipts) => {
  clear(catalogBody);

  for (const r of receipts) {
    const tr = document.createElement("tr");

    const idTd = document.createElement("td");
    const idBtn = document.createElement("button");
    idBtn.className = "catalog-id";
    idBtn.textContent = r.id;
    idBtn.title = "Load this receipt";
    idBtn.addEventListener("click", () => {
      receiptInput.value = r.id;
      receiptInput.focus();
    });
    idTd.appendChild(idBtn);

    const providerTd = document.createElement("td");
    providerTd.textContent = r.provider;

    const amountTd = document.createElement("td");
    amountTd.textContent = r.values.amount;

    const nameTd = document.createElement("td");
    nameTd.textContent = r.values.recipientName;

    const dateTd = document.createElement("td");
    dateTd.textContent = r.values.date;

    const expTd = document.createElement("td");
    const tag = document.createElement("span");
    tag.className = `tag ${r.expectation === "pass" ? "tag-pass" : "tag-fail"}`;
    tag.textContent = r.expectation;
    tag.title = r.note;
    expTd.appendChild(tag);

    tr.append(idTd, providerTd, amountTd, nameTd, dateTd, expTd);
    catalogBody.appendChild(tr);
  }
};

const loadDemo = async () => {
  try {
    const res = await fetch("/api/demo/receipts");
    if (!res.ok) return;
    const data = await res.json();
    demoReceipts = data.receipts ?? [];
    if (demoReceipts.length === 0) return;

    renderCatalog(demoReceipts);
    catalogCard.hidden = false;

    const pill = document.createElement("span");
    pill.className = "pill pill-demo";
    pill.textContent = "demo mode";
    $("statusPills").appendChild(pill);

    $("demoBanner").hidden = false;
  } catch {
    /* demo catalog is optional */
  }
};

const loadHealth = async () => {
  const pill = $("pillHealth");
  try {
    const res = await fetch("/health");
    const data = await res.json();
    pill.className = `pill ${data.status === "ok" ? "pill-ok" : "pill-muted"}`;
    pill.textContent = `api ${data.status}`;
  } catch {
    pill.className = "pill pill-muted";
    pill.textContent = "api unreachable";
  }
};

/* ---------------- wiring ---------------- */

for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.addEventListener("change", () => {
    fieldChecks.hidden = radio.value !== "custom" || !radio.checked;
  });
}

verifyBtn.addEventListener("click", verify);

clearBtn.addEventListener("click", () => {
  receiptInput.value = "";
  clear(resultsEl);
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = "No verification run yet.";
  resultsEl.appendChild(p);
  summaryEl.hidden = true;
  rawWrap.hidden = true;
});

runAllBtn.addEventListener("click", () => {
  if (demoReceipts.length === 0) return;
  receiptInput.value = demoReceipts.map((r) => r.id).join("\n");
  verify();
});

receiptInput.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") verify();
});

loadHealth();
loadDemo();
