let port;
let demoMode = false;
let currentPage = 0;
let lastImportedRawConfig = null;
let validationIssues = [];

const templates = {
  default: { pages: [{cc:[11,1,21,7]},{cc:[22,23,24,25]},{cc:[26,27,28,29]},{cc:[30,31,0,1]}] },
  ableton: { pages: [{cc:[7,10,91,93]},{cc:[14,15,16,17]},{cc:[20,21,22,23]},{cc:[24,25,26,27]}] },
  synth: { pages: [{cc:[74,71,73,72]},{cc:[1,11,5,65]},{cc:[20,21,22,23]},{cc:[24,25,26,27]}] },
  orchestral: { pages: [{cc:[11,1,2,21]},{cc:[22,23,24,25]},{cc:[26,27,28,29]},{cc:[30,31,0,1]}] }
};

const config = {
  device: "GARLU_FADER_MINI",
  fw: "demo",
  screenLayout: "standard",
  highResolution: false,
  oledBrightness: "medium",
  ringBrightness: "medium",
  pages: JSON.parse(JSON.stringify(templates.default.pages))
};

const $ = (id) => document.getElementById(id);
const output = $("output");

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2200);
}

function showApp() {
  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");
}

function setConnected(label, connected = true) {
  $("connectionStatus").textContent = label;
  $("statusDot").classList.toggle("connected", connected);
  $("fwInfo").textContent = `FW ${config.fw || "—"}`;
}

function syncResolutionFields() {
  config.highResolution = $("resolutionMode").value === "enhanced";
}

function maxAllowedCC() {
  return config.highResolution ? 31 : 127;
}

function validateConfig(candidate) {
  const issues = [];
  const maxCC = candidate.highResolution ? 31 : 127;

  if (!candidate.pages || !Array.isArray(candidate.pages) || candidate.pages.length !== 4) {
    issues.push({ type: "structure", message: "Expected exactly 4 pages." });
    return issues;
  }

  candidate.pages.forEach((page, pageIndex) => {
    if (!page.cc || !Array.isArray(page.cc) || page.cc.length !== 4) {
      issues.push({ type: "structure", page: pageIndex, message: `Page ${pageIndex + 1}: expected exactly 4 CC values.` });
      return;
    }

    page.cc.forEach((value, faderIndex) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        issues.push({
          type: "cc",
          page: pageIndex,
          fader: faderIndex,
          value,
          message: `Page ${pageIndex + 1} · Fader ${faderIndex + 1}: CC value must be numeric.`
        });
        return;
      }

      if (!Number.isInteger(value)) {
        issues.push({
          type: "cc",
          page: pageIndex,
          fader: faderIndex,
          value,
          message: `Page ${pageIndex + 1} · Fader ${faderIndex + 1}: CC value must be an integer.`
        });
      }

      if (value < 0 || value > maxCC) {
        issues.push({
          type: "cc",
          page: pageIndex,
          fader: faderIndex,
          value,
          max: maxCC,
          message: `Page ${pageIndex + 1} · Fader ${faderIndex + 1}: CC value ${value} exceeds maximum allowed value (${maxCC}).`
        });
      }
    });
  });

  return issues;
}

function setValidationIssues(issues) {
  validationIssues = issues;
  const panel = $("validationPanel");

  if (!issues.length) {
    panel.classList.add("hidden");
  } else {
    panel.classList.remove("hidden");
    const first = issues[0].message;
    $("validationSummary").textContent = issues.length === 1 ? first : `${first} + ${issues.length - 1} more issue(s).`;
  }

  updateValidationHighlights();
}

function updateValidationHighlights() {
  for (let i = 0; i < 4; i++) {
    $(`card${i}`).classList.remove("invalid");
    $(`hint${i}`).textContent = "MIDI CC";
  }

  const currentIssues = validationIssues.filter((issue) => issue.type === "cc" && issue.page === currentPage);

  currentIssues.forEach((issue) => {
    $(`card${issue.fader}`).classList.add("invalid");
    $(`hint${issue.fader}`).textContent = issue.max !== undefined ? `MAX ${issue.max} EXCEEDED` : "INVALID CC";
  });
}

function updateUiFromConfig() {
  $("screenLayout").value = config.screenLayout;
  $("resolutionMode").value = config.highResolution ? "enhanced" : "midi1";
  $("oledBrightness").value = config.oledBrightness;
  $("ringBrightness").value = config.ringBrightness;
  $("fwInfo").textContent = `FW ${config.fw || "—"}`;

  for (let i = 0; i < 4; i++) {
    const input = $(`cc${i}`);
    input.max = maxAllowedCC();
    input.min = 0;
    input.value = config.pages[currentPage].cc[i];
  }

  updateValidationHighlights();
}

function updateConfigFromUi() {
  config.screenLayout = $("screenLayout").value;
  syncResolutionFields();
  config.oledBrightness = $("oledBrightness").value;
  config.ringBrightness = $("ringBrightness").value;

  for (let i = 0; i < 4; i++) {
    const raw = $(`cc${i}`).value;
    config.pages[currentPage].cc[i] = raw === "" ? 0 : Number(raw);
  }

  setValidationIssues(validateConfig(config));
}

function normalizedConfigForDevice() {
  updateConfigFromUi();
  if (validationIssues.length) {
    return null;
  }

  return {
    device: "GARLU_FADER_MINI",
    screenLayout: config.screenLayout,
    highResolution: config.highResolution,
    oledBrightness: config.oledBrightness,
    ringBrightness: config.ringBrightness,
    pages: config.pages
  };
}

function autoFixConfig() {
  const maxCC = maxAllowedCC();

  for (const page of config.pages) {
    page.cc = page.cc.map((value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return 0;
      return Math.max(0, Math.min(maxCC, Math.round(numeric)));
    });
  }

  setValidationIssues([]);
  updateUiFromConfig();
  output.textContent = JSON.stringify(config, null, 2);
  toast("Configuration fixed automatically");
}

async function writeLine(line) {
  const writer = port.writable.getWriter();
  await writer.write(new TextEncoder().encode(line + "\n"));
  writer.releaseLock();
}

async function readLine() {
  const reader = port.readable.getReader();
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    text += new TextDecoder().decode(value);
    if (text.includes("\n")) break;
  }
  reader.releaseLock();
  return text.trim();
}

async function connectDevice() {
  if (!("serial" in navigator)) {
    alert("Web Serial is not supported. Use Chrome or Edge desktop.");
    return;
  }
  port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  demoMode = false;
  showApp();
  setConnected("Device connected", true);
  toast("GARLU connected");
}

$("welcomeConnectBtn").onclick = connectDevice;
$("connectBtn").onclick = connectDevice;

$("demoBtn").onclick = () => {
  demoMode = true;
  showApp();
  setConnected("Demo mode", true);
  toast("Demo mode active");
  updateUiFromConfig();
};

$("readBtn").onclick = async () => {
  if (demoMode) {
    output.textContent = JSON.stringify(config, null, 2);
    toast("Demo config loaded");
    return;
  }
  if (!port) return alert("Connect device first.");
  await writeLine("GET_CONFIG");
  const response = await readLine();
  output.textContent = response;
  try {
    Object.assign(config, JSON.parse(response));
    setValidationIssues(validateConfig(config));
    updateUiFromConfig();
    toast("Configuration read");
  } catch {
    toast("Could not parse device response");
  }
};

$("saveBtn").onclick = async () => {
  const payload = normalizedConfigForDevice();

  if (!payload) {
    toast("Fix configuration issues first");
    return;
  }

  if (demoMode) {
    Object.assign(config, payload);
    output.textContent = JSON.stringify(config, null, 2);
    toast("Demo configuration saved");
    return;
  }

  if (!port) return alert("Connect device first.");
  await writeLine("SET_CONFIG " + JSON.stringify(payload));
  const response = await readLine();
  output.textContent = response;
  toast("Configuration sent");
};

$("autoFixBtn").onclick = autoFixConfig;

document.querySelectorAll(".page").forEach((button) => {
  button.onclick = () => {
    updateConfigFromUi();
    document.querySelectorAll(".page").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    currentPage = Number(button.dataset.page);
    updateUiFromConfig();
  };
});

document.querySelectorAll(".nav").forEach((button) => {
  button.onclick = () => {
    document.querySelectorAll(".nav").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active-view"));
    const view = button.dataset.view;
    $(`${view}View`).classList.add("active-view");
    $("viewTitle").textContent = view === "backup" ? "Import / Export" : view[0].toUpperCase() + view.slice(1);
  };
});

["screenLayout","resolutionMode","oledBrightness","ringBrightness","cc0","cc1","cc2","cc3"].forEach((id) => {
  $(id).addEventListener("change", () => {
    updateConfigFromUi();
    updateUiFromConfig();
  });
});

document.querySelectorAll(".template").forEach((button) => {
  button.onclick = () => {
    updateConfigFromUi();
    config.pages = JSON.parse(JSON.stringify(templates[button.dataset.template].pages));
    setValidationIssues(validateConfig(config));
    updateUiFromConfig();
    toast("Template applied");
  };
});

$("exportBtn").onclick = () => {
  const payload = normalizedConfigForDevice();
  if (!payload) {
    toast("Fix configuration issues before export");
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "garlu-config.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("JSON exported");
};

$("importInput").addEventListener("click", (event) => {
  event.target.value = "";
});

$("importInput").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed.pages || parsed.pages.length !== 4) throw new Error("Invalid pages");

    lastImportedRawConfig = JSON.parse(JSON.stringify(parsed));

    config.device = parsed.device || "GARLU_FADER_MINI";
    config.fw = parsed.fw || config.fw || "imported";
    config.screenLayout = parsed.screenLayout || "standard";
    config.highResolution = Boolean(parsed.highResolution);
    config.oledBrightness = parsed.oledBrightness || "medium";
    config.ringBrightness = parsed.ringBrightness || "medium";
    config.pages = JSON.parse(JSON.stringify(parsed.pages));

    currentPage = 0;
    document.querySelectorAll(".page").forEach((b) => b.classList.remove("active"));
    document.querySelector('.page[data-page="0"]').classList.add("active");

    const issues = validateConfig(config);
    setValidationIssues(issues);
    updateUiFromConfig();
    output.textContent = JSON.stringify(config, null, 2);

    if (issues.length) {
      toast("Imported with warnings");
    } else {
      toast("JSON imported");
    }
  } catch {
    alert("Invalid GARLU JSON file.");
  } finally {
    event.target.value = "";
  }
};

updateUiFromConfig();
