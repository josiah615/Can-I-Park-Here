import { analyze } from "./lib/parking.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; };
const svgIcon = (id) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "i"); s.setAttribute("aria-hidden", "true"); const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "#" + id); s.append(u); return s; };
const store = {
  get(k) { try { return localStorage.getItem("cpih_" + k) || ""; } catch (_) { return ""; } },
  set(k, v) { try { v ? localStorage.setItem("cpih_" + k, v) : localStorage.removeItem("cpih_" + k); } catch (_) {} }
};
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// ---------------------------------------------------------------- Mode
// "server": deployed on Vercel with ANTHROPIC_API_KEY set (no key needed in the browser)
// "key":    static copy (e.g. GitHub Pages); the viewer pastes their own key
let mode = "detecting";
async function detectMode() {
  try {
    const r = await fetch("./api/health", { cache: "no-store" });
    const j = r.ok ? await r.json() : null;
    mode = j && j.ok && j.configured ? "server" : "key";
  } catch (_) { mode = "key"; }
  paintKeyBox();
}

// ---------------------------------------------------------------- Photo
const SAMPLE_SRC = "assets/sample-sign.png";
const SAMPLE_ALT = $("preview").alt;
let photo = { blob: null, sample: true };

async function loadSampleBlob() {
  if (photo.sample && !photo.blob) { const r = await fetch(SAMPLE_SRC); photo.blob = await r.blob(); }
  return photo.blob;
}
function usePhoto(file) {
  if (!file || !/^image\//.test(file.type)) { setStatus("That file isn't an image. Choose a photo of the sign.", true); return; }
  photo = { blob: file, sample: false };
  const url = URL.createObjectURL(file);
  const img = $("preview");
  img.onload = () => { img.width = img.naturalWidth; img.height = img.naturalHeight; };
  img.src = url; img.alt = "Your photo of the parking signs";
  $("shotTag").textContent = "Your photo";
  $("useSample").hidden = false;
  setStatus("");
}
function useSample() {
  photo = { blob: null, sample: true };
  const img = $("preview"); img.src = SAMPLE_SRC; img.alt = SAMPLE_ALT; img.width = 840; img.height = 1240;
  $("shotTag").textContent = "Sample sign";
  $("useSample").hidden = true;
}
$("camera").addEventListener("change", (e) => { usePhoto(e.target.files[0]); e.target.value = ""; });
$("library").addEventListener("change", (e) => { usePhoto(e.target.files[0]); e.target.value = ""; });
$("useSample").addEventListener("click", useSample);
const drop = $("drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("dragging"); });
drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("dragging"); usePhoto(e.dataTransfer.files[0]); });
document.addEventListener("paste", (e) => {
  const f = Array.from((e.clipboardData && e.clipboardData.files) || []).find((x) => /^image\//.test(x.type));
  if (f) { e.preventDefault(); usePhoto(f); }
});

/** Downscale to ≤1600px JPEG: faster upload, fits the server's size limit, enough detail for sign text. */
function toUploadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve({ mediaType: "image/jpeg", data: c.toDataURL("image/jpeg", 0.86).split(",")[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(Object.assign(new Error("image"), { code: "image" })); };
    img.src = url;
  });
}

// ---------------------------------------------------------------- Plan (time handling)
const promptFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const uiFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });
const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());

function arrival() {
  const later = document.querySelector('input[name="arrive"]:checked').value === "later";
  if (later) { const d = new Date($("when").value); if (!isNaN(d)) return d; }
  return new Date();
}
function plan() {
  const a = arrival();
  const stay = document.querySelector('input[name="stay"]:checked').value;
  let until, stayLabel;
  if (stay === "overnight") {
    until = new Date(a); until.setHours(8, 0, 0, 0);
    if (a.getHours() >= 8) until.setDate(until.getDate() + 1);
    stayLabel = "overnight";
  } else {
    const m = Number(stay);
    until = new Date(a.getTime() + m * 60000);
    stayLabel = m < 60 ? m + " minutes" : m / 60 + (m === 60 ? " hour" : " hours");
  }
  return {
    arrivalText: promptFmt.format(a), untilText: promptFmt.format(until), stayLabel,
    notes: $("notes").value.trim(), ui: { arrival: uiFmt.format(a), until: uiFmt.format(until) }
  };
}
function paintArrive() {
  const later = document.querySelector('input[name="arrive"]:checked').value === "later";
  $("laterWrap").hidden = !later;
  if (later && !$("when").value) { const d = new Date(Date.now() + 3600000); d.setMinutes(0, 0, 0); $("when").value = toLocalInput(d); }
  const p = plan();
  $("arriveText").textContent = "Parking from " + p.ui.arrival + " until " + p.ui.until + ".";
}
document.querySelectorAll('input[name="arrive"], input[name="stay"]').forEach((r) => r.addEventListener("change", paintArrive));
$("when").addEventListener("input", paintArrive);
setInterval(() => { if (document.querySelector('input[name="arrive"]:checked').value === "now") paintArrive(); }, 30000);
paintArrive();

// ---------------------------------------------------------------- Rendering
const WORD = { yes: "YES", limited: "YES, BUT", no: "NO", unclear: "CAN'T TELL" };

function plateSymbol(verdict) {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 80 80"); s.setAttribute("class", "plate-symbol"); s.setAttribute("aria-hidden", "true");
  const color = verdict === "no" ? "var(--plate-red)" : verdict === "unclear" ? "var(--plate-gray)" : "var(--plate-green)";
  const ring = document.createElementNS(ns, "circle");
  Object.entries({ cx: 40, cy: 40, r: 34, fill: "none", stroke: color, "stroke-width": 7 }).forEach(([k, v]) => ring.setAttribute(k, v));
  const t = document.createElementNS(ns, "text");
  Object.entries({ x: 40, y: 55, "text-anchor": "middle", "font-size": 42, "font-weight": 900, fill: verdict === "unclear" ? color : "var(--plate-ink)" }).forEach(([k, v]) => t.setAttribute(k, v));
  t.style.fontFamily = "var(--font)";
  t.textContent = verdict === "unclear" ? "?" : "P";
  s.append(ring, t);
  if (verdict === "no") {
    const l = document.createElementNS(ns, "line");
    Object.entries({ x1: 16, y1: 16, x2: 64, y2: 64, stroke: color, "stroke-width": 7, "stroke-linecap": "round" }).forEach(([k, v]) => l.setAttribute(k, v));
    s.append(l);
  }
  return s;
}

function confidenceWord(c) { return c >= 0.85 ? "High" : c >= 0.6 ? "Medium" : "Low"; }

function render(r, { example = false, announce = false } = {}) {
  const out = $("result"); out.innerHTML = "";
  const v = WORD[r.verdict] ? r.verdict : "unclear";

  const plate = el("div", "plate " + v + " entering");
  plate.append(plateSymbol(v), el("p", "plate-word", WORD[v]), el("p", "plate-head", r.headline));
  if (r.moveBy && v === "limited") {
    const mv = el("p", "plate-move"); mv.append(el("span", null, "MOVE BY"), el("b", null, r.moveBy)); plate.append(mv);
  }
  out.append(plate);
  requestAnimationFrame(() => requestAnimationFrame(() => plate.classList.remove("entering")));

  const meta = el("p", "meta");
  const conf = el("span"); conf.append("Confidence: ", el("b", null, confidenceWord(r.confidence) + " (" + Math.round(r.confidence * 100) + "%)"));
  meta.append(conf);
  if (example) meta.append(el("span", null, "Example answer for the sample sign, arriving Monday at 1:50 PM for 3 hours"));
  out.append(meta);

  if (r.retakeTip) {
    const c = el("div", "callout tip"); c.append(svgIcon("i-retake"), el("p", null, r.retakeTip)); out.append(c);
  }
  r.warnings.forEach((w) => { const c = el("div", "callout"); c.append(svgIcon("i-alert"), el("p", null, w)); out.append(c); });

  if (r.rules.length) {
    const sec = el("div"); sec.style.display = "grid"; sec.style.gap = "12px";
    sec.append(el("h3", null, "What the signs say"));
    const ul = el("ul", "rules");
    r.rules.forEach((rule) => {
      const li = el("li", "rule " + (rule.applies ? "on" : "off"));
      const mark = el("span", "mark"); mark.append(svgIcon(rule.applies ? "i-bang" : "i-check"));
      li.append(mark, el("span", "state", rule.applies ? "Affects your stay" : "Doesn't affect your stay"), el("span", "t", rule.text));
      if (rule.why) li.append(el("span", "w", rule.why));
      ul.append(li);
    });
    sec.append(ul); out.append(sec);
  }
  if (announce) {
    $("ans-h").focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 899px)").matches) $("answer").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
  }
}

render({
  verdict: "limited",
  headline: "You can park, but the 2-hour limit ends before your 3-hour stay does.",
  moveBy: "3:50 PM Monday",
  confidence: 0.94,
  retakeTip: null,
  warnings: ["Staying past 2 AM puts you in the tow-away window."],
  rules: [
    { text: "2 hour parking, 8 AM – 6 PM, Monday through Saturday", applies: true, why: "Monday afternoon is inside the window, so you get 2 hours from 1:50 PM." },
    { text: "No parking 7 AM – 9 AM Tuesday, street cleaning", applies: false, why: "Street cleaning only runs Tuesday mornings." },
    { text: "Tow-away zone 2 AM – 6 AM daily", applies: false, why: "Your stay ends long before 2 AM." }
  ]
}, { example: true });

// ---------------------------------------------------------------- Check
function setStatus(msg, isError) { const s = $("status"); s.textContent = msg || ""; s.classList.toggle("err", !!isError); }
const ERRORS = {
  bad_key: "Anthropic rejected that API key. Check it at console.anthropic.com and save it again.",
  rate_limited: "Too many checks in a minute. Wait a moment, then press Check This Spot again.",
  network: "Couldn't reach the server. Check your connection and try again.",
  image: "That photo couldn't be opened. Try a JPG or PNG.",
  not_configured: "The server is missing its Anthropic API key. Add ANTHROPIC_API_KEY in Vercel's settings.",
  no_key: "Paste an Anthropic API key below to run a live check on this copy."
};

let busy = false;
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy || mode === "detecting") return;
  const key = store.get("key");
  if (mode === "key" && !key) { setStatus(ERRORS.no_key, true); $("apiKey").focus(); return; }

  busy = true;
  const go = $("go"); go.setAttribute("aria-busy", "true"); go.disabled = true;
  go.querySelector(".go-label").textContent = "Reading the Signs…";
  setStatus("");
  try {
    const p = plan();
    const image = await toUploadImage(await loadSampleBlob() || photo.blob);
    const body = { image, arrivalText: p.arrivalText, untilText: p.untilText, stayLabel: p.stayLabel, notes: p.notes };
    let result;
    if (mode === "server") {
      let r;
      try { r = await fetch("./api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
      catch (_) { throw Object.assign(new Error("network"), { code: "network" }); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j.error || "server"), { code: j.error, message: j.message });
      result = j;
    } else {
      const { image: img, ...planOnly } = body;
      result = await analyze({ apiKey: key, image: img, plan: planOnly, browser: true });
    }
    render(result, { announce: true });
  } catch (err) {
    setStatus(ERRORS[err.code] || err.message || "Something went wrong. Press Check This Spot again.", true);
  } finally {
    busy = false; go.removeAttribute("aria-busy"); go.disabled = false;
    go.querySelector(".go-label").textContent = "Check This Spot";
  }
});

// ---------------------------------------------------------------- Live-mode key box
function paintKeyBox() {
  const has = !!store.get("key");
  $("keybox").hidden = mode !== "key";
  $("keyEnter").hidden = has;
  $("keySaved").hidden = !has;
}
$("saveKey").addEventListener("click", () => {
  const v = $("apiKey").value.trim();
  if (!v) { setStatus("Paste your key first. It starts with sk-ant-.", true); $("apiKey").focus(); return; }
  store.set("key", v); $("apiKey").value = ""; paintKeyBox(); setStatus("Key saved. Press Check This Spot.");
});
$("forgetKey").addEventListener("click", () => { store.set("key", ""); paintKeyBox(); setStatus("Key removed from this browser."); });

detectMode();
