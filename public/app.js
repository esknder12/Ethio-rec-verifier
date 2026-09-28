/**
 * Ethio Rec Verifier — site behaviour.
 * Talks to the same-origin API only, so it works behind any proxy.
 */

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------------
   dom refs
   ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------
   nav
   ------------------------------------------------------------------ */

const initNav = () => {
  const nav = $("nav");
  const toggle = $("navToggle");
  const drawer = $("navDrawer");
  const announce = $("announce");

  const onScroll = () => {
    nav.classList.toggle("is-stuck", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  toggle.addEventListener("click", () => {
    const open = drawer.hidden;
    drawer.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  });

  for (const link of $$("a", drawer)) {
    link.addEventListener("click", () => {
      drawer.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  $("announceClose").addEventListener("click", () => {
    announce.remove();
    // Keep the sticky offset correct now that the bar is gone.
    document.documentElement.style.scrollPaddingTop = "76px";
  });

  $("year").textContent = String(new Date().getFullYear());
};

/* ------------------------------------------------------------------
   marquee
   ------------------------------------------------------------------ */

const PROVIDERS = [
  { name: "Telebirr", mark: "T", cls: "pm-telebirr" },
  { name: "CBE", mark: "CBE", cls: "pm-cbe" },
  { name: "Bank of Abyssinia", mark: "BOA", cls: "pm-boa" },
  { name: "Amhara Bank", mark: "AB", cls: "pm-ab" },
  { name: "Telebirr", mark: "T", cls: "pm-telebirr" },
  { name: "CBE", mark: "CBE", cls: "pm-cbe" },
];

const initMarquee = () => {
  const track = $("marqueeTrack");

  // Two identical runs, so the -50% keyframe loops seamlessly.
  for (let pass = 0; pass < 2; pass++) {
    for (const p of PROVIDERS) {
      const item = document.createElement("span");
      item.className = "mq-item";

      const mark = document.createElement("span");
      mark.className = `mq-mark ${p.cls}`;
      mark.textContent = p.mark;

      const name = document.createElement("span");
      name.className = "mq-name";
      name.textContent = p.name;

      item.append(mark, name);
      track.appendChild(item);
    }
  }
};

/* ------------------------------------------------------------------
   counters
   ------------------------------------------------------------------ */

const initCounters = () => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nodes = $$(".count");

  const run = (el) => {
    const to = Number(el.dataset.to ?? 0);
    if (reduce) {
      el.textContent = String(to);
      return;
    }

    const duration = 900;
    const start = performance.now();

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (!("IntersectionObserver" in window)) {
    nodes.forEach(run);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          run(entry.target);
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.6 },
  );

  nodes.forEach((el) => io.observe(el));
};

/* ------------------------------------------------------------------
   code samples
   ------------------------------------------------------------------ */

const FILENAMES = {
  curl: "terminal",
  node: "verify-payment.mjs",
  python: "verify_payment.py",
  php: "verify-payment.php",
};

const initCode = () => {
  const tabs = $$(".code-tab");
  const panes = $$(".code-pane");
  const filename = $("codeFilename");
  const copyBtn = $("copyBtn");

  // Show the visitor's own origin so the samples are copy-pasteable.
  for (const el of $$(".t-url")) el.textContent = window.location.origin;

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      for (const t of tabs) t.classList.toggle("is-active", t === tab);
      for (const p of panes) {
        p.classList.toggle("is-active", p.dataset.pane === tab.dataset.tab);
      }
      filename.textContent = FILENAMES[tab.dataset.tab] ?? "";
    });
  }

  copyBtn.addEventListener("click", async () => {
    const code = document.querySelector(".code-pane.is-active code");
    if (!code) return;

    const text = code.innerText.replace(
      /http:\/\/localhost:5000/g,
      window.location.origin,
    );

    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied";
    } catch {
      copyBtn.textContent = "Press ⌘C";
    }
    setTimeout(() => (copyBtn.textContent = "Copy"), 1600);
  });
};

/* ------------------------------------------------------------------
   verifier
   ------------------------------------------------------------------ */

const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
};

const addResult = (receiptId, ok, message) => {
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

  resultsEl.appendChild(box);
};

const resetResults = (message) => {
  clear(resultsEl);
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = message;
  resultsEl.appendChild(p);
  summaryEl.hidden = true;
  summaryEl.replaceChildren();
  rawWrap.hidden = true;
};

const addSummaryChip = (label, kind) => {
  const chip = document.createElement("span");
  chip.className = `pill ${kind}`;
  chip.textContent = label;
  summaryEl.appendChild(chip);
};

const buildVerification = () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  if (mode === "all") return true;

  const flags = {};
  for (const box of $$("input[type=checkbox]", fieldChecks)) {
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
  return payload;
};

const setBusy = (busy) => {
  verifyBtn.disabled = busy;
  if (runAllBtn) runAllBtn.disabled = busy;
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
    resetResults("Enter at least one receipt ID or URL.");
    return;
  }

  const verification = buildVerification();
  if (typeof verification === "object" && Object.keys(verification).length === 0) {
    resetResults(
      "Pick at least one field to check, or switch to “All configured”.",
    );
    return;
  }

  const body = { defaultVerification: verification };
  if (proxyToggle.checked) body.proxy = true;

  clear(resultsEl);
  summaryEl.hidden = true;
  summaryEl.replaceChildren();
  rawWrap.hidden = true;
  setBusy(true);

  try {
    if (lines.length === 1) {
      const payload = await postJson("/api/verify", {
        ...body,
        receipt: lines[0],
      });

      if (payload.error) {
        addResult(lines[0], false, payload.error);
      } else {
        addResult(lines[0], true, payload.message ?? "Valid receipt.");
      }
      rawWrap.hidden = false;
      rawOut.textContent = JSON.stringify(payload, null, 2);
    } else {
      const payload = await postJson("/api/verify/batch", {
        ...body,
        receipt: lines,
      });

      for (const item of payload.result ?? []) {
        addResult(item, true, "Valid receipt.");
      }
      for (const item of payload.failed ?? []) {
        addResult(item.receiptId, false, item.error);
      }

      if (payload.summary) {
        summaryEl.hidden = false;
        addSummaryChip(`total ${payload.summary.total}`, "pill-muted");
        addSummaryChip(`valid ${payload.summary.valid}`, "pill-live");
        if (payload.summary.invalid > 0) {
          addSummaryChip(`invalid ${payload.summary.invalid}`, "pill-demo");
        }
      }

      rawWrap.hidden = false;
      rawOut.textContent = JSON.stringify(payload, null, 2);
    }
  } catch (err) {
    addResult("Request failed", false, err.message);
  } finally {
    setBusy(false);
  }
};

/* ------------------------------------------------------------------
   demo catalog
   ------------------------------------------------------------------ */

const renderCatalog = (receipts) => {
  clear(catalogBody);

  for (const r of receipts) {
    const tr = document.createElement("tr");

    const idTd = document.createElement("td");
    const idBtn = document.createElement("button");
    idBtn.type = "button";
    idBtn.className = "catalog-id";
    idBtn.textContent = r.id;
    idBtn.title = "Load this receipt";
    idBtn.addEventListener("click", () => {
      receiptInput.value = r.id;
      receiptInput.focus();
      receiptInput.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    idTd.appendChild(idBtn);

    const cells = [
      r.provider,
      r.values.amount,
      r.values.recipientName,
      r.values.date,
    ].map((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      return td;
    });

    const expTd = document.createElement("td");
    const tag = document.createElement("span");
    tag.className = `tag ${r.expectation === "pass" ? "tag-pass" : "tag-fail"}`;
    tag.textContent = r.expectation;
    tag.title = r.note;
    expTd.appendChild(tag);

    tr.append(idTd, ...cells, expTd);
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
    $("demoBanner").hidden = false;

    const pill = document.createElement("span");
    pill.className = "pill pill-demo";
    pill.textContent = "demo mode";
    document.querySelector(".nav-actions").appendChild(pill);
  } catch {
    /* the demo catalog is optional */
  }
};

const loadHealth = async () => {
  const pill = $("pillHealth");
  try {
    const res = await fetch("/health");
    const data = await res.json();
    const ok = data.status === "ok";

    pill.className = `pill ${ok ? "pill-live" : "pill-muted"}`;
    pill.innerHTML = `<span class="pulse" aria-hidden="true"></span>${
      ok ? "api online" : "api degraded"
    }`;
  } catch {
    pill.className = "pill pill-muted";
    pill.textContent = "api unreachable";
  }
};

/* ------------------------------------------------------------------
   wiring
   ------------------------------------------------------------------ */

const initVerifier = () => {
  for (const radio of $$('input[name="mode"]')) {
    radio.addEventListener("change", () => {
      fieldChecks.hidden = radio.value !== "custom" || !radio.checked;
    });
  }

  verifyBtn.addEventListener("click", verify);

  clearBtn.addEventListener("click", () => {
    receiptInput.value = "";
    resetResults("No verification run yet.");
  });

  runAllBtn?.addEventListener("click", () => {
    if (demoReceipts.length === 0) return;
    receiptInput.value = demoReceipts.map((r) => r.id).join("\n");
    verify();
  });

  receiptInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") verify();
  });
};

initNav();
initMarquee();
initCounters();
initCode();
initVerifier();
loadHealth();
loadDemo();
