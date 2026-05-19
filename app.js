let port;
let demoMode = false;
let currentPage = 0;
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

function deviceDisplayName(device) {
  const map = { GARLU_FADER_MINI: "GARLU Fader Mini" };
  return map[device] || device || "Unknown GARLU device";
}

function updateDeviceLabels(connectedLabel = null) {
  const name = deviceDisplayName(config.device);
  const fw = config.fw ? `FW ${config.fw}` : "FW —";
  $("deviceInfo").innerHTML = `<span class="device-name-line">${name}</span><span class="device-fw-line">${fw}</span>`;
  if (connectedLabel) $("connectionStatus").textContent = connectedLabel;
}

function setConnected(label, connected = true) {
  $("connectionStatus").textContent = label;
  $("statusDot").classList.toggle("connected", connected);
  $("connectBtn").classList.toggle("connected", connected);
  $("connectBtn").textContent = connected ? "GARLU connected" : "Connect to GARLU";
  updateDeviceLabels();
}

function syncResolutionFields() {
  config.highResolution = $("resolutionMode").value === "enhanced";
}

function maxAllowedCC(candidate = config) {
  return candidate.highResolution === true ? 31 : 127;
}

function validateConfig(candidate) {
  const issues = [];
  const validLayouts = ["standard", "performance"];
  const validBrightness = ["low", "medium", "high"];

  if (typeof candidate.highResolution !== "boolean") issues.push({ type: "field", field: "highResolution", message: `highResolution must be true or false. Current value: ${JSON.stringify(candidate.highResolution)}.` });
  if (!validLayouts.includes(candidate.screenLayout)) issues.push({ type: "field", field: "screenLayout", message: `screenLayout must be "standard" or "performance". Current value: ${JSON.stringify(candidate.screenLayout)}.` });
  if (!validBrightness.includes(candidate.oledBrightness)) issues.push({ type: "field", field: "oledBrightness", message: `oledBrightness must be "low", "medium" or "high". Current value: ${JSON.stringify(candidate.oledBrightness)}.` });
  if (!validBrightness.includes(candidate.ringBrightness)) issues.push({ type: "field", field: "ringBrightness", message: `ringBrightness must be "low", "medium" or "high". Current value: ${JSON.stringify(candidate.ringBrightness)}.` });

  if (!candidate.pages || !Array.isArray(candidate.pages) || candidate.pages.length !== 4) {
    issues.push({ type: "structure", message: "Expected exactly 4 pages." });
    return issues;
  }

  const maxCC = maxAllowedCC(candidate);

  candidate.pages.forEach((page, pageIndex) => {
    if (!page.cc || !Array.isArray(page.cc) || page.cc.length !== 4) {
      issues.push({ type: "structure", page: pageIndex, message: `Page ${pageIndex + 1}: expected exactly 4 CC values.` });
      return;
    }

    page.cc.forEach((value, faderIndex) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        issues.push({ type: "cc", page: pageIndex, fader: faderIndex, value, message: `Page ${pageIndex + 1} · Fader ${faderIndex + 1}: CC value must be numeric.` });
        return;
      }
      if (!Number.isInteger(value)) issues.push({ type: "cc", page: pageIndex, fader: faderIndex, value, message: `Page ${pageIndex + 1} · Fader ${faderIndex + 1}: CC value must be an integer.` });
      if (value < 0 || value > maxCC) issues.push({ type: "cc", page: pageIndex, fader: faderIndex, value, max: maxCC, message: `Page ${pageIndex + 1} · Fader ${faderIndex + 1}: CC value ${value} exceeds maximum allowed value (${maxCC}).` });
    });
  });

  return issues;
}

function setValidationIssues(issues) {
  validationIssues = issues;
  const panel = $("validationPanel");

  if (!issues.length) panel.classList.add("hidden");
  else {
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

  $("resolutionSetting").classList.remove("invalid");
  $("resolutionHint").textContent = "";
  $("resolutionHint").classList.remove("invalid-text");

  validationIssues.filter((issue) => issue.type === "cc" && issue.page === currentPage).forEach((issue) => {
    $(`card${issue.fader}`).classList.add("invalid");
    $(`hint${issue.fader}`).textContent = issue.max !== undefined ? `MAX ${issue.max} EXCEEDED` : "INVALID CC";
  });

  const resolutionIssue = validationIssues.find((issue) => issue.field === "highResolution");
  if (resolutionIssue) {
    $("resolutionSetting").classList.add("invalid");
    $("resolutionHint").textContent = "Invalid value in imported JSON";
    $("resolutionHint").classList.add("invalid-text");
  }
}

function updateUiFromConfig() {
  $("screenLayout").value = ["standard", "performance"].includes(config.screenLayout) ? config.screenLayout : "standard";
  $("resolutionMode").value = config.highResolution === true ? "enhanced" : "midi1";
  $("oledBrightness").value = ["low", "medium", "high"].includes(config.oledBrightness) ? config.oledBrightness : "medium";
  $("ringBrightness").value = ["low", "medium", "high"].includes(config.ringBrightness) ? config.ringBrightness : "medium";
  updateDeviceLabels();

  for (let i = 0; i < 4; i++) {
    const input = $(`cc${i}`);
    input.max = maxAllowedCC();
    input.min = 0;
    input.value = config.pages[currentPage]?.cc?.[i] ?? "";
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

function configForDevice() {
  updateConfigFromUi();
  if (validationIssues.length) return null;

  return {
    device: "GARLU_FADER_MINI",
    screenLayout: config.screenLayout,
    highResolution: config.highResolution,
    oledBrightness: config.oledBrightness,
    ringBrightness: config.ringBrightness,
    pages: config.pages
  };
}

function sampleConfig() {
  return {
    _allowedValues: {
      screenLayout: ["standard", "performance"],
      highResolution: [false, true],
      oledBrightness: ["low", "medium", "high"],
      ringBrightness: ["low", "medium", "high"],
      ccRange: "0-127 when highResolution=false; 0-31 when highResolution=true"
    },
    device: "GARLU_FADER_MINI",
    screenLayout: "standard",
    highResolution: false,
    oledBrightness: "medium",
    ringBrightness: "medium",
    pages: [
      { cc: [11, 1, 21, 7] },
      { cc: [22, 23, 24, 25] },
      { cc: [26, 27, 28, 29] },
      { cc: [30, 31, 0, 1] }
    ]
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function writeLine(line) {
  const writer = port.writable.getWriter();
  await writer.write(new TextEncoder().encode(line + "\\n"));
  writer.releaseLock();
}

async function readLine() {
  const reader = port.readable.getReader();
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    text += new TextDecoder().decode(value);
    if (text.includes("\\n")) break;
  }
  reader.releaseLock();
  return text.trim();
}

async function readDeviceConfig() {
  await writeLine("GET_CONFIG");
  const response = await readLine();
  output.textContent = response;
  const parsed = JSON.parse(response);
  Object.assign(config, parsed);
  setValidationIssues(validateConfig(config));
  updateUiFromConfig();
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
  $("connectBtn").classList.remove("connected");
  $("connectBtn").textContent = "Reading GARLU...";
  toast("Reading device configuration...");

  try {
    await readDeviceConfig();
    setConnected("GARLU connected", true);
    toast(`${deviceDisplayName(config.device)} connected`);
  } catch (error) {
    setConnected("GARLU connected", true);
    toast("Connected, but config read failed");
  }
}

$("welcomeConnectBtn").onclick = connectDevice;
$("connectBtn").onclick = connectDevice;

$("demoBtn").onclick = () => {
  demoMode = true;
  showApp();
  config.fw = "demo";
  setConnected("Demo mode", true);
  toast("Demo mode active");
  updateUiFromConfig();
};

$("saveBtn").onclick = async () => {
  const payload = configForDevice();

  if (!payload) {
    toast("Fix configuration issues first");
    return;
  }

  if (demoMode) {
    Object.assign(config, payload);
    output.textContent = JSON.stringify(config, null, 2);
    toast("Demo configuration updated");
    return;
  }

  if (!port) return alert("Connect GARLU first.");
  await writeLine("SET_CONFIG " + JSON.stringify(payload));
  const response = await readLine();
  output.textContent = response;
  toast("GARLU configured");
};

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
    document.getElementById(button.dataset.scroll).scrollIntoView({ behavior: "smooth", block: "start" });
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
    output.textContent = JSON.stringify(config, null, 2);
    document.getElementById("assignments").scrollIntoView({ behavior: "smooth", block: "start" });
    toast("Template applied");
  };
});

$("exportBtn").onclick = () => {
  const payload = configForDevice();
  if (!payload) {
    toast("Fix configuration issues before export");
    return;
  }
  downloadJson("garlu-config.json", payload);
  toast("JSON exported");
};

$("sampleBtn").onclick = () => {
  downloadJson("garlu-config-example.json", sampleConfig());
  toast("Example downloaded");
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

    config.device = parsed.device || "GARLU_FADER_MINI";
    config.fw = parsed.fw || config.fw || "imported";
    config.screenLayout = parsed.screenLayout;
    config.highResolution = parsed.highResolution;
    config.oledBrightness = parsed.oledBrightness;
    config.ringBrightness = parsed.ringBrightness;
    config.pages = JSON.parse(JSON.stringify(parsed.pages));

    currentPage = 0;
    document.querySelectorAll(".page").forEach((b) => b.classList.remove("active"));
    document.querySelector('.page[data-page="0"]').classList.add("active");

    const issues = validateConfig(config);
    setValidationIssues(issues);
    updateUiFromConfig();
    output.textContent = JSON.stringify(config, null, 2);
    document.getElementById("assignments").scrollIntoView({ behavior: "smooth", block: "start" });

    toast(issues.length ? "Imported with warnings" : "JSON imported");
  } catch {
    setValidationIssues([{ type: "structure", message: "Invalid JSON syntax or GARLU structure. Check commas, quotes and boolean values." }]);
    alert("Invalid JSON. Example: highResolution must be true or false, not fal.");
  } finally {
    event.target.value = "";
  }
};

updateUiFromConfig();
