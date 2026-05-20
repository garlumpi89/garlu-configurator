
let port=null,demoMode=false,currentPage=0,validationIssues=[];
const $=(id)=>document.getElementById(id);
const templates={
 default:{pages:[{cc:[11,1,21,7]},{cc:[22,23,24,25]},{cc:[26,27,28,29]},{cc:[30,31,0,1]}]},
 ableton:{pages:[{cc:[7,10,91,93]},{cc:[14,15,16,17]},{cc:[20,21,22,23]},{cc:[24,25,26,27]}]},
 synth:{pages:[{cc:[74,71,73,72]},{cc:[1,11,5,65]},{cc:[20,21,22,23]},{cc:[24,25,26,27]}]},
 orchestral:{pages:[{cc:[11,1,2,21]},{cc:[22,23,24,25]},{cc:[26,27,28,29]},{cc:[30,31,0,1]}]}
};
const config={device:"GARLU_FADER_MINI",fw:"demo",screenLayout:"standard",highResolution:false,oledBrightness:"medium",ringBrightness:"medium",pages:JSON.parse(JSON.stringify(templates.default.pages))};
function toast(m){const e=$("toast");if(!e)return;e.textContent=m;e.classList.remove("hidden");setTimeout(()=>e.classList.add("hidden"),2200)}
function showApp(){$("welcome").classList.add("hidden");$("app").classList.remove("hidden")}
function deviceDisplayName(d){return {GARLU_FADER_MINI:"GARLU Fader Mini"}[d]||d||"Unknown GARLU device"}
function updateDeviceLabels(){const n=deviceDisplayName(config.device),fw=config.fw?`FW ${config.fw}`:"FW —";const el=$("deviceInfo");if(el)el.innerHTML=`<span class="device-name-line">${n}</span><span class="device-fw-line">${fw}</span>`}
function setConnected(label="GARLU connected",connected=true){$("connectionStatus").textContent=label;$("statusDot").classList.toggle("connected",connected);$("connectBtn").classList.toggle("connected",connected);$("connectBtn").textContent=connected?"GARLU connected":"Connect to GARLU";updateDeviceLabels()}
function setDisconnected(){if($("connectionStatus"))$("connectionStatus").textContent="Not connected";if($("statusDot"))$("statusDot").classList.remove("connected");if($("connectBtn")){$("connectBtn").classList.remove("connected");$("connectBtn").textContent="Connect to GARLU"}}
function outputEl(){return $("output")}
function setJsonWarnings(messages=[]){const el=jsonWarnings();if(!el)return;if(!messages.length){el.classList.add("hidden");el.textContent="";return}el.classList.remove("hidden");el.textContent=messages.map(m=>`• ${m}`).join("\n")}function setOutputText(t,err=false){const o=outputEl();if(!o)return;o.classList.toggle("output-error",err);o.value=t;if(!err)setJsonWarnings([])}
function maxAllowedCC(c=config){return c.highResolution===true?31:127}
function validateConfig(c){const issues=[],layouts=["standard","performance"],bright=["low","medium","high"];if(typeof c.highResolution!=="boolean")issues.push({type:"field",field:"highResolution",message:`highResolution must be true or false. Current value: ${JSON.stringify(c.highResolution)}.`});if(!layouts.includes(c.screenLayout))issues.push({type:"field",field:"screenLayout",message:`screenLayout must be "standard" or "performance". Current value: ${JSON.stringify(c.screenLayout)}.`});if(!bright.includes(c.oledBrightness))issues.push({type:"field",field:"oledBrightness",message:`oledBrightness must be "low", "medium" or "high". Current value: ${JSON.stringify(c.oledBrightness)}.`});if(!bright.includes(c.ringBrightness))issues.push({type:"field",field:"ringBrightness",message:`ringBrightness must be "low", "medium" or "high". Current value: ${JSON.stringify(c.ringBrightness)}.`});if(!c.pages||!Array.isArray(c.pages)||c.pages.length!==4){issues.push({type:"structure",message:"Expected exactly 4 pages."});return issues}const max=maxAllowedCC(c);c.pages.forEach((p,pi)=>{if(!p.cc||!Array.isArray(p.cc)||p.cc.length!==4){issues.push({type:"structure",page:pi,message:`Page ${pi+1}: expected exactly 4 CC values.`});return}p.cc.forEach((v,fi)=>{if(typeof v!=="number"||!Number.isFinite(v)){issues.push({type:"cc",page:pi,fader:fi,value:v,message:`Page ${pi+1} · Fader ${fi+1}: CC value must be numeric.`});return}if(!Number.isInteger(v))issues.push({type:"cc",page:pi,fader:fi,value:v,message:`Page ${pi+1} · Fader ${fi+1}: CC value must be an integer.`});if(v<0||v>max)issues.push({type:"cc",page:pi,fader:fi,value:v,max,message:`Page ${pi+1} · Fader ${fi+1}: CC value ${v} exceeds maximum allowed value (${max}).`})})});return issues}
function setValidationIssues(issues){validationIssues=issues;const p=$("validationPanel");if(!issues.length)p.classList.add("hidden");else{p.classList.remove("hidden");$("validationSummary").textContent=issues.length===1?issues[0].message:`${issues[0].message} + ${issues.length-1} more issue(s).`}updateValidationHighlights()}
function updateValidationHighlights(){for(let i=0;i<4;i++){const c=$(`card${i}`),h=$(`hint${i}`);if(c)c.classList.remove("invalid");if(h)h.textContent="MIDI CC"}const rs=$("resolutionSetting"),rh=$("resolutionHint");if(rs)rs.classList.remove("invalid");if(rh){rh.textContent="";rh.classList.remove("invalid-text")}validationIssues.filter(x=>x.type==="cc"&&x.page===currentPage).forEach(x=>{const c=$(`card${x.fader}`),h=$(`hint${x.fader}`);if(c)c.classList.add("invalid");if(h)h.textContent=x.max!==undefined?`MAX ${x.max} EXCEEDED`:"INVALID CC"});if(validationIssues.find(x=>x.field==="highResolution")&&rs&&rh){rs.classList.add("invalid");rh.textContent="Invalid value in imported JSON";rh.classList.add("invalid-text")}}
function syncSegmentedControls(){document.querySelectorAll(".segmented").forEach(g=>{const target=$(g.dataset.target);if(!target)return;g.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.value===target.value))})}
function updateUiFromConfig(){$("screenLayout").value=["standard","performance"].includes(config.screenLayout)?config.screenLayout:"standard";$("resolutionMode").value=config.highResolution===true?"enhanced":"midi1";$("oledBrightness").value=["low","medium","high"].includes(config.oledBrightness)?config.oledBrightness:"medium";$("ringBrightness").value=["low","medium","high"].includes(config.ringBrightness)?config.ringBrightness:"medium";for(let i=0;i<4;i++){const input=$(`cc${i}`);input.max=maxAllowedCC();input.min=0;input.value=config.pages[currentPage]?.cc?.[i]??""}updateDeviceLabels();updateValidationHighlights();syncSegmentedControls()}
function updateConfigFromUi(){config.screenLayout=$("screenLayout").value;config.highResolution=$("resolutionMode").value==="enhanced";config.oledBrightness=$("oledBrightness").value;config.ringBrightness=$("ringBrightness").value;for(let i=0;i<4;i++){const raw=$(`cc${i}`).value;config.pages[currentPage].cc[i]=raw===""?0:Number(raw)}setValidationIssues(validateConfig(config))}
function configForDevice(){updateConfigFromUi();if(validationIssues.length)return null;return{device:"GARLU_FADER_MINI",screenLayout:config.screenLayout,highResolution:config.highResolution,oledBrightness:config.oledBrightness,ringBrightness:config.ringBrightness,pages:config.pages}}
function sampleConfig(){return{_allowedValues:{screenLayout:["standard","performance"],highResolution:[false,true],oledBrightness:["low","medium","high"],ringBrightness:["low","medium","high"],ccRange:"0-127 when highResolution=false; 0-31 when highResolution=true"},device:"GARLU_FADER_MINI",screenLayout:"standard",highResolution:false,oledBrightness:"medium",ringBrightness:"medium",pages:JSON.parse(JSON.stringify(templates.default.pages))}}
function downloadJson(fn,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fn;a.click();URL.revokeObjectURL(url)}
async function writeLine(line){const w=port.writable.getWriter();await w.write(new TextEncoder().encode(line+"\n"));w.releaseLock()}
async function readLine(){const r=port.readable.getReader();let text="";while(true){const{value,done}=await r.read();if(done)break;text+=new TextDecoder().decode(value);if(text.includes("\n"))break}r.releaseLock();return text.trim()}
async function readDeviceConfig(){await writeLine("GET_CONFIG");const response=await readLine();setOutputText(response);Object.assign(config,JSON.parse(response));setValidationIssues(validateConfig(config));updateUiFromConfig()}
function connectAsTestMode(msg="GARLU connected"){demoMode=true;showApp();config.device="GARLU_FADER_MINI";config.fw=config.fw||"demo";setConnected("GARLU connected",true);updateUiFromConfig();toast(msg)}
async function connectDevice(){if(!("serial"in navigator)){connectAsTestMode("Test connection active");return}try{port=await navigator.serial.requestPort();await port.open({baudRate:115200});demoMode=false;showApp();$("connectBtn").classList.remove("connected");$("connectBtn").textContent="Reading GARLU...";toast("Reading device configuration...");await Promise.race([readDeviceConfig(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),1200))]);setConnected("GARLU connected",true);toast(`${deviceDisplayName(config.device)} connected`)}catch(e){connectAsTestMode("GARLU connected in test mode")}}
function startDemoMode(){demoMode=true;showApp();config.device="GARLU_FADER_MINI";config.fw="demo";setDisconnected();$("connectionStatus").textContent="Demo mode";updateUiFromConfig();toast("Demo mode active")}
function importConfigFromRawText(rawText,label="JSON"){try{const p=JSON.parse(rawText);if(!p.pages||p.pages.length!==4)throw new Error("Invalid pages");config.device=p.device||"GARLU_FADER_MINI";config.fw=p.fw||config.fw||"imported";config.screenLayout=p.screenLayout;config.highResolution=p.highResolution;config.oledBrightness=p.oledBrightness;config.ringBrightness=p.ringBrightness;config.pages=JSON.parse(JSON.stringify(p.pages));currentPage=0;document.querySelectorAll(".page").forEach(b=>b.classList.remove("active"));document.querySelector('.page[data-page="0"]').classList.add("active");const issues=validateConfig(config);setValidationIssues(issues);updateUiFromConfig();if(issues.length){setJsonWarnings(issues.map(i=>i.message));setOutputText(rawText,true);toast(`${label} has warnings`);return false}setOutputText(JSON.stringify(config,null,2));toast(`${label} applied`);return true}catch{const m="Invalid JSON syntax or GARLU structure. Check commas, quotes and boolean values.";setValidationIssues([{type:"structure",message:m}]);setJsonWarnings([m]);setOutputText(rawText,true);toast("Invalid JSON");return false}}
function getLocalTemplates(){try{return JSON.parse(localStorage.getItem("garluLocalTemplates")||"[]")}catch{return[]}}
function saveLocalTemplates(items){localStorage.setItem("garluLocalTemplates",JSON.stringify(items))}
function applyTemplatePages(pages,msg="Template applied"){updateConfigFromUi();config.pages=JSON.parse(JSON.stringify(pages));setValidationIssues(validateConfig(config));updateUiFromConfig();setOutputText(JSON.stringify(config,null,2));document.getElementById("assignments").scrollIntoView({behavior:"smooth",block:"start"});toast(msg)}
function renderLocalTemplates(){const grid=$("templateGrid");if(!grid)return;grid.querySelectorAll(".template.local-template").forEach(x=>x.remove());getLocalTemplates().forEach((t,i)=>{const b=document.createElement("button");b.className="template local-template";b.dataset.localTemplate=String(i);b.innerHTML=`<strong>${t.name||"Local template"}</strong><span>${t.description||"Stored locally in this browser."}</span>`;b.onclick=()=>applyTemplatePages(t.pages,"Local template applied");grid.appendChild(b)})}

const tourSteps = [
  {
    selector: "#connectBtn",
    label: "STEP 1",
    title: "Connect to GARLU",
    text: "Connect the device. The configurator will auto-read the current setup."
  },
  {
    selector: "#assignments",
    label: "STEP 2",
    title: "Edit the CC values",
    text: "Select a page and assign MIDI CC numbers to Fader 1–4."
  },
  {
    selector: "#templates",
    label: "OPTIONAL",
    title: "Use templates",
    text: "Load a predefined template or add your own local template."
  },
  {
    selector: "#backup",
    label: "OPTIONAL",
    title: "Import or export JSON",
    text: "Back up your configuration or edit advanced settings with JSON."
  },
  {
    selector: "#saveBtn",
    label: "FINAL STEP",
    title: "Update GARLU",
    text: "Send your final configuration to the device."
  }
];

let currentTourStep = 0;

function placeTourStep() {
  const overlay = $("tourOverlay");
  const spot = $("tourSpotlight");
  const card = $("tourCard");
  if (!overlay || !spot || !card) return;

  const step = tourSteps[currentTourStep];
  const target = document.querySelector(step.selector);
  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "center" });

  setTimeout(() => {
    const rect = target.getBoundingClientRect();
    const pad = 10;

    spot.style.left = `${Math.max(8, rect.left - pad)}px`;
    spot.style.top = `${Math.max(8, rect.top - pad)}px`;
    spot.style.width = `${Math.min(window.innerWidth - 16, rect.width + pad * 2)}px`;
    spot.style.height = `${Math.min(window.innerHeight - 16, rect.height + pad * 2)}px`;

    $("tourStepLabel").textContent = step.label;
    $("tourTitle").textContent = step.title;
    $("tourText").textContent = step.text;
    $("tourNextBtn").textContent = currentTourStep === tourSteps.length - 1 ? "Finish" : "Next";

    const cardWidth = Math.min(360, window.innerWidth - 32);
    let left = rect.right + 22;
    let top = rect.top;

    if (left + cardWidth > window.innerWidth - 16) {
      left = Math.max(16, rect.left - cardWidth - 22);
    }

    if (left < 16) {
      left = 16;
      top = Math.min(window.innerHeight - 220, rect.bottom + 18);
    }

    top = Math.max(16, Math.min(top, window.innerHeight - 240));

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }, 280);
}

function startTutorialMode() {
  showApp();
  demoMode = true;
  config.device = "GARLU_FADER_MINI";
  config.fw = "demo";
  setDisconnected();
  $("connectionStatus").textContent = "Tutorial mode";
  updateUiFromConfig();

  currentTourStep = 0;
  $("tourOverlay").classList.remove("hidden");
  placeTourStep();
}

function closeTour() {
  const overlay = $("tourOverlay");
  if (overlay) overlay.classList.add("hidden");
}

function nextTourStep() {
  if (currentTourStep >= tourSteps.length - 1) {
    closeTour();
    return;
  }
  currentTourStep += 1;
  placeTourStep();
}

window.addEventListener("resize", () => {
  const overlay = $("tourOverlay");
  if (overlay && !overlay.classList.contains("hidden")) placeTourStep();
});


function init(){const wc=$("welcomeConnectBtn"),cb=$("connectBtn"),db=$("demoBtn");if(wc)wc.onclick=connectDevice;if(cb)cb.onclick=connectDevice;if(db)db.onclick=startDemoMode;const tb=$("tutorialBtn");if(tb)tb.onclick=startTutorialMode;const tn=$("tourNextBtn"),ts=$("tourSkipBtn");if(tn)tn.onclick=nextTourStep;if(ts)ts.onclick=closeTour;$("saveBtn").onclick=async()=>{const payload=configForDevice();if(!payload){toast("Fix configuration issues first");return}if(demoMode){Object.assign(config,payload);setOutputText(JSON.stringify(config,null,2));toast("Demo configuration updated");return}if(!port)return alert("Connect GARLU first.");await writeLine("SET_CONFIG "+JSON.stringify(payload));const res=await readLine();setOutputText(res);toast("GARLU configured")};document.querySelectorAll(".page").forEach(b=>b.onclick=()=>{updateConfigFromUi();document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentPage=Number(b.dataset.page);updateUiFromConfig()});document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");if(b.dataset.scroll==="assignments"){window.scrollTo({top:0,behavior:"smooth"});return}document.getElementById(b.dataset.scroll).scrollIntoView({behavior:"smooth",block:"start"})});["screenLayout","resolutionMode","oledBrightness","ringBrightness","cc0","cc1","cc2","cc3"].forEach(id=>$(id).addEventListener("change",()=>{updateConfigFromUi();updateUiFromConfig()}));document.querySelectorAll(".segmented").forEach(g=>g.querySelectorAll("button").forEach(b=>b.onclick=()=>{const t=$(g.dataset.target);if(!t)return;t.value=b.dataset.value;t.dispatchEvent(new Event("change",{bubbles:true}));syncSegmentedControls()}));document.querySelectorAll(".template").forEach(b=>b.onclick=()=>applyTemplatePages(templates[b.dataset.template].pages,"Template applied"));$("templateInput").addEventListener("click",e=>e.target.value="");$("templateInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;const raw=await f.text();try{const p=JSON.parse(raw),candidate={device:p.device||"GARLU_FADER_MINI",screenLayout:p.screenLayout||"standard",highResolution:Boolean(p.highResolution),oledBrightness:p.oledBrightness||"medium",ringBrightness:p.ringBrightness||"medium",pages:p.pages},issues=validateConfig(candidate);if(issues.length){setJsonWarnings(issues.map(i=>i.message));setOutputText(raw,true);toast("Template has validation issues");return}const items=getLocalTemplates();items.push({name:p.name||f.name.replace(/\.json$/i,""),description:p.description||"Local user template",pages:p.pages});saveLocalTemplates(items);renderLocalTemplates();setOutputText(JSON.stringify(p,null,2));toast("Local template added")}catch{setJsonWarnings(["Invalid JSON syntax. Check commas, quotes and boolean values."]);setOutputText(raw,true);toast("Invalid template JSON")}finally{e.target.value=""}};$("exportBtn").onclick=()=>{const payload=configForDevice();if(!payload){toast("Fix configuration issues before export");return}downloadJson("garlu-config.json",payload);toast("JSON exported")};$("sampleBtn").onclick=()=>{downloadJson("garlu-config-example.json",sampleConfig());toast("Example downloaded")};$("importInput").addEventListener("click",e=>e.target.value="");$("importInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;const raw=await f.text();importConfigFromRawText(raw,"JSON");document.getElementById("assignments").scrollIntoView({behavior:"smooth",block:"start"});e.target.value=""};$("applyJsonBtn").onclick=()=>importConfigFromRawText(output.value,"JSON changes");renderLocalTemplates();updateUiFromConfig();setDisconnected()}
document.addEventListener("DOMContentLoaded",init);
