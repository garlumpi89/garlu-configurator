
let port=null,demoMode=false,currentPage=0,validationIssues=[],suppressTopValidation=false,isConnected=false;
const $=(id)=>document.getElementById(id);
const templates={
 default:{pages:[{cc:[11,1,21,7]},{cc:[22,23,24,25]},{cc:[26,27,28,29]},{cc:[30,31,0,1]}]},
 ableton:{pages:[{cc:[7,10,91,93]},{cc:[14,15,16,17]},{cc:[20,21,22,23]},{cc:[24,25,26,27]}]},
 synth:{pages:[{cc:[74,71,73,72]},{cc:[1,11,5,65]},{cc:[20,21,22,23]},{cc:[24,25,26,27]}]},
 orchestral:{pages:[{cc:[11,1,2,21]},{cc:[22,23,24,25]},{cc:[26,27,28,29]},{cc:[30,31,0,1]}]}
};
const config={device:"GARLU_FADER_MINI",fw:"demo",screenLayout:"standard",highResolution:false,oledBrightness:70,ringBrightness:70,pages:JSON.parse(JSON.stringify(templates.default.pages))};
const brightMap={low:25,medium:70,high:100};
function normalizePercent(v){if(typeof v==="string"&&v in brightMap)return brightMap[v];const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):70}

function toast(m){const e=$("toast");if(!e)return;e.textContent=m;e.classList.remove("hidden");setTimeout(()=>e.classList.add("hidden"),2200)}
function showApp(){$("welcome").classList.add("hidden");$("app").classList.remove("hidden")}
function deviceDisplayName(d){return {GARLU_FADER_MINI:"GARLU Fader Mini"}[d]||d||"Unknown GARLU device"}
function normalizeRing(v){return normalizePercent(v)}
function normalizeOled(v){return normalizePercent(v)}
function updateDeviceLabels(){const n=deviceDisplayName(config.device),fw=config.fw?`FW ${config.fw}`:"FW —";const el=$("deviceInfo");if(el)el.innerHTML=`<span class="device-name-line">${n}</span><span class="device-fw-line">${fw}</span>`}
function showConnectionWarning(message="Connect to GARLU before updating the device."){const el=$("connectionWarning");if(!el)return;el.textContent=message;el.classList.remove("hidden");clearTimeout(window.__garluConnectionWarningTimer);window.__garluConnectionWarningTimer=setTimeout(()=>el.classList.add("hidden"),5200)}
function hideConnectionWarning(){const el=$("connectionWarning");if(el)el.classList.add("hidden")}

function setConnected(label="GARLU connected",connected=true){
  isConnected=connected;
  const btn=$("connectBtn"),dot=$("statusDot");
  $("connectionStatus").textContent=label;
  dot.classList.toggle("connected",connected);
  dot.classList.remove("disconnected");
  btn.classList.toggle("connected",connected);
  btn.classList.remove("disconnected");
  btn.textContent=connected?"GARLU connected":"Connect to GARLU";
  const pill=document.querySelector(".device-pill");if(pill)pill.classList.remove("disconnected-compact");updateDeviceLabels();
  if(connected)hideConnectionWarning();
}
function setDisconnected(red=false,idle=false){
  isConnected=false;
  if(red) demoMode=false;
  if(port&&port.close){try{port.close()}catch(e){}}
  port=null;
  const btn=$("connectBtn"),dot=$("statusDot");
  $("connectionStatus").textContent=idle?"GARLU FADER":(red?"GARLU disconnected":"Not connected");
  dot.classList.remove("connected");
  dot.classList.toggle("disconnected",red);
  btn.classList.remove("connected");
  btn.classList.toggle("disconnected",red);
  btn.textContent=red?"GARLU disconnected":"Connect to GARLU";
const pill=document.querySelector(".device-pill");
if(pill){
  pill.classList.toggle("disconnected-compact",red);
  pill.classList.toggle("idle-state",idle);
}
}
function toggleConnection(){
  if(isConnected){
    demoMode=false;
    setDisconnected(true);
    toast("GARLU disconnected");
    return;
  }
  connectDevice();
}

function outputEl(){return $("output")}
function warningsEl(){return $("jsonWarnings")}
function setJsonWarnings(messages=[]){const el=warningsEl(),text=$("jsonWarningsText");if(!el)return;if(!messages.length){el.classList.add("hidden");if(text)text.textContent="";return}el.classList.remove("hidden");const msg=messages.map(m=>`• ${m}`).join("\n");if(text)text.textContent=msg;else el.textContent=msg}
function setOutputText(t,err=false){const o=outputEl();if(!o)return;o.classList.toggle("output-error",err);o.value=t;if(!err)setJsonWarnings([])}
function maxAllowedCC(c=config){return c.highResolution===true?31:127}
function validateConfig(c){
  const issues=[],layouts=["standard","performance"],bright=["low","medium","high"];
  if(typeof c.highResolution!=="boolean")issues.push({type:"field",field:"highResolution",message:`highResolution must be true or false. Current value: ${JSON.stringify(c.highResolution)}.`});
  if(!layouts.includes(c.screenLayout))issues.push({type:"field",field:"screenLayout",message:`screenLayout must be "standard" or "performance". Current value: ${JSON.stringify(c.screenLayout)}.`});
  const ob=normalizeOled(c.oledBrightness);if(!Number.isFinite(ob)||ob<0||ob>100)issues.push({type:"field",field:"oledBrightness",message:`oledBrightness must be between 0 and 100. Current value: ${JSON.stringify(c.oledBrightness)}.`});
  const rb=normalizeRing(c.ringBrightness);if(!Number.isFinite(rb)||rb<0||rb>100)issues.push({type:"field",field:"ringBrightness",message:`ringBrightness must be between 0 and 100. Current value: ${JSON.stringify(c.ringBrightness)}.`});
  if(!c.pages||!Array.isArray(c.pages)||c.pages.length!==4){issues.push({type:"structure",message:"Expected exactly 4 pages."});return issues}
  const max=maxAllowedCC(c);
  c.pages.forEach((p,pi)=>{if(!p.cc||!Array.isArray(p.cc)||p.cc.length!==4){issues.push({type:"structure",page:pi,message:`Page ${pi+1}: expected exactly 4 CC values.`});return}
    p.cc.forEach((v,fi)=>{if(typeof v!=="number"||!Number.isFinite(v)){issues.push({type:"cc",page:pi,fader:fi,value:v,message:`Page ${pi+1} · Fader ${fi+1}: CC value must be numeric.`});return}
      if(!Number.isInteger(v))issues.push({type:"cc",page:pi,fader:fi,value:v,message:`Page ${pi+1} · Fader ${fi+1}: CC value must be an integer.`});
      if(v<0||v>max)issues.push({type:"cc",page:pi,fader:fi,value:v,max,message:`Page ${pi+1} · Fader ${fi+1}: CC value ${v} exceeds maximum allowed value (${max}).`})
    })
  });
  return issues;
}
function setValidationIssues(issues){
  validationIssues=issues;
  const p=$("validationPanel");
  if(!issues.length||suppressTopValidation){p.classList.add("hidden")}
  else{p.classList.remove("hidden");$("validationSummary").textContent=issues.length===1?issues[0].message:`${issues[0].message} + ${issues.length-1} more issue(s).`}
  updateValidationHighlights();
}
function updateValidationHighlights(){
  for(let i=0;i<4;i++){const c=$(`card${i}`),h=$(`hint${i}`);if(c)c.classList.remove("invalid");if(h)h.textContent="MIDI CC"}
  const rs=$("resolutionSetting"),rh=$("resolutionHint");if(rs)rs.classList.remove("invalid");if(rh){rh.textContent="";rh.classList.remove("invalid-text")}
  validationIssues.filter(x=>x.type==="cc"&&x.page===currentPage).forEach(x=>{const c=$(`card${x.fader}`),h=$(`hint${x.fader}`);if(c)c.classList.add("invalid");if(h)h.textContent=x.max!==undefined?`MAX ${x.max} EXCEEDED`:"INVALID CC"});
  if(validationIssues.find(x=>x.field==="highResolution")&&rs&&rh){rs.classList.add("invalid");rh.textContent="Invalid value in imported JSON";rh.classList.add("invalid-text")}
}
function labelForSelectValue(id,value){
  const labels={screenLayout:{standard:"Standard Layout",performance:"Performance Layout"},resolutionMode:{midi1:"MIDI 1.0 (7-bit)",enhanced:"Enhanced MIDI 1.0 (14-bit)"},oledBrightness:{low:"Low",medium:"Medium",high:"High"}};
  return labels[id]?.[value]||value;
}
function syncCustomSelects(){
  document.querySelectorAll(".custom-select").forEach(wrap=>{
    const id=wrap.dataset.select,select=$(id),txt=wrap.querySelector(".custom-select-trigger span");
    if(!select||!txt)return;
    txt.textContent=labelForSelectValue(id,select.value);
    wrap.querySelectorAll(".custom-select-menu button").forEach(b=>b.classList.toggle("active",b.dataset.value===select.value));
  });
}
function initCustomSelects(){
  document.querySelectorAll(".custom-select").forEach(wrap=>{
    const id=wrap.dataset.select,select=$(id),trigger=wrap.querySelector(".custom-select-trigger");
    if(!select||!trigger)return;
    trigger.onclick=e=>{e.stopPropagation();document.querySelectorAll(".custom-select.open").forEach(o=>{if(o!==wrap)o.classList.remove("open")});wrap.classList.toggle("open")};
    wrap.querySelectorAll(".custom-select-menu button").forEach(b=>{b.onclick=e=>{e.stopPropagation();select.value=b.dataset.value;select.dispatchEvent(new Event("change",{bubbles:true}));wrap.classList.remove("open");syncCustomSelects()}});
  });
  document.addEventListener("click",()=>document.querySelectorAll(".custom-select.open").forEach(w=>w.classList.remove("open")));
}
function updateOledSlider(){
  const s=$("oledBrightness"),v=$("oledBrightnessValue");
  if(!s)return;
  const val=normalizeOled(config.oledBrightness);
  s.value=val;
  s.style.setProperty("--ring-fill",`${val}%`);
  if(v)v.textContent=`${val}%`;
}%`);if(v)v.textContent=`${val}%`}
function updateRingSlider(){
  const s=$("ringBrightness"),v=$("ringBrightnessValue");
  if(!s)return;
  const val=normalizeRing(config.ringBrightness);
  s.value=val;
  s.style.setProperty("--ring-fill",`${val}%`);
  if(v)v.textContent=`${val}%`;
}%`);if(v)v.textContent=`${val}%`}
function updateUiFromConfig(){
  $("screenLayout").value=["standard","performance"].includes(config.screenLayout)?config.screenLayout:"standard";
  $("resolutionMode").value=config.highResolution===true?"enhanced":"midi1";
  $("oledBrightness").value=["low","medium","high"].includes(config.oledBrightness)?config.oledBrightness:70;
  config.ringBrightness=normalizeRing(config.ringBrightness);updateRingSlider();
  for(let i=0;i<4;i++){const input=$(`cc${i}`);input.max=maxAllowedCC();input.min=0;input.value=config.pages[currentPage]?.cc?.[i]??""}
  updateDeviceLabels();updateValidationHighlights();syncCustomSelects();
}
function updateConfigFromUi(){
  suppressTopValidation=false;
  config.screenLayout=$("screenLayout").value;
  config.highResolution=$("resolutionMode").value==="enhanced";
  config.oledBrightness=normalizeOled($("oledBrightness").value);updateOledSlider();
  config.ringBrightness=normalizeRing($("ringBrightness").value);updateRingSlider();
  for(let i=0;i<4;i++){const raw=$(`cc${i}`).value;config.pages[currentPage].cc[i]=raw===""?0:Number(raw)}
  setValidationIssues(validateConfig(config));
}
function configForDevice(){updateConfigFromUi();if(validationIssues.length)return null;return{device:"GARLU_FADER_MINI",screenLayout:config.screenLayout,highResolution:config.highResolution,oledBrightness:config.oledBrightness,ringBrightness:config.ringBrightness,pages:config.pages}}
function sampleConfig(){return{_allowedValues:{screenLayout:["standard","performance"],highResolution:[false,true],oledBrightness:"0-100",ringBrightness:"0-100",ccRange:"0-127 when highResolution=false; 0-31 when highResolution=true"},device:"GARLU_FADER_MINI",screenLayout:"standard",highResolution:false,oledBrightness:70,ringBrightness:70,pages:JSON.parse(JSON.stringify(templates.default.pages))}}
function downloadJson(fn,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fn;a.click();URL.revokeObjectURL(url)}
async function writeLine(line){const w=port.writable.getWriter();await w.write(new TextEncoder().encode(line+"\n"));w.releaseLock()}
async function readLine(){const r=port.readable.getReader();let text="";while(true){const{value,done}=await r.read();if(done)break;text+=new TextDecoder().decode(value);if(text.includes("\n"))break}r.releaseLock();return text.trim()}
async function readDeviceConfig(){await writeLine("GET_CONFIG");const response=await readLine();setOutputText(response);Object.assign(config,JSON.parse(response));setValidationIssues(validateConfig(config));updateUiFromConfig()}
function connectAsTestMode(msg="GARLU connected"){demoMode=true;showApp();config.device="GARLU_FADER_MINI";config.fw=config.fw||"demo";setConnected("GARLU connected",true);updateUiFromConfig();toast(msg)}
async function connectDevice(){if(!("serial"in navigator)){connectAsTestMode("Test connection active");return}try{port=await navigator.serial.requestPort();await port.open({baudRate:115200});demoMode=false;showApp();$("connectBtn").classList.remove("connected","disconnected");$("connectBtn").textContent="Reading GARLU...";toast("Reading device configuration...");await Promise.race([readDeviceConfig(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),1200))]);setConnected("GARLU connected",true);toast(`${deviceDisplayName(config.device)} connected`)}catch(e){connectAsTestMode("GARLU connected in test mode")}}
function startDemoMode(){demoMode=true;showApp();config.device="GARLU_FADER_MINI";config.fw="demo";setDisconnected(false);$("connectionStatus").textContent="GARLU FADER";document.querySelector(".device-pill")?.classList.add("idle-state");updateUiFromConfig();toast("Demo mode active")}
function importConfigFromRawText(rawText,label="JSON"){
  suppressTopValidation=true;
  try{
    const p=JSON.parse(rawText);if(!p.pages||p.pages.length!==4)throw new Error("Invalid pages");
    config.device=p.device||"GARLU_FADER_MINI";config.fw=p.fw||config.fw||"imported";config.screenLayout=p.screenLayout;config.highResolution=p.highResolution;config.oledBrightness=p.oledBrightness;config.ringBrightness=p.ringBrightness;config.pages=JSON.parse(JSON.stringify(p.pages));
    currentPage=0;document.querySelectorAll(".page").forEach(b=>b.classList.remove("active"));document.querySelector('.page[data-page="0"]').classList.add("active");
    const issues=validateConfig(config);setValidationIssues(issues);updateUiFromConfig();
    if(issues.length){setJsonWarnings(issues.map(i=>i.message));setOutputText(rawText,true);toast(`${label} has warnings`);return false}
    setJsonWarnings([]);setOutputText(JSON.stringify(config,null,2));suppressTopValidation=false;setValidationIssues([]);toast(`${label} applied`);return true
  }catch{const m="Invalid JSON syntax or GARLU structure. Check commas, quotes and boolean values.";setValidationIssues([{type:"structure",message:m}]);setJsonWarnings([m]);setOutputText(rawText,true);toast("Invalid JSON");return false}
}
function getLocalTemplates(){try{return JSON.parse(localStorage.getItem("garluLocalTemplates")||"[]")}catch{return[]}}
function saveLocalTemplates(items){localStorage.setItem("garluLocalTemplates",JSON.stringify(items))}
function applyTemplatePages(pages,msg="Template applied"){updateConfigFromUi();config.pages=JSON.parse(JSON.stringify(pages));setValidationIssues(validateConfig(config));updateUiFromConfig();setOutputText(JSON.stringify(config,null,2));toast(msg)}
function renderLocalTemplates(){const grid=$("templateGrid");if(!grid)return;grid.querySelectorAll(".template.local-template").forEach(x=>x.remove());getLocalTemplates().forEach((t,i)=>{const b=document.createElement("button");b.className="template local-template";b.dataset.localTemplate=String(i);b.innerHTML=`<strong>${t.name||"Local template"}</strong><span>${t.description||"Stored locally in this browser."}</span>`;b.onclick=()=>applyTemplatePages(t.pages,"Local template applied");grid.appendChild(b)})}

async function saveEditedJsonFile() {
  const raw = outputEl().value;
  const valid = importConfigFromRawText(raw, "JSON changes");
  if (!valid) return;

  const filename = "garlu-config-edited.json";

  try {
    if ("showSaveFilePicker" in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: "JSON file",
          accept: { "application/json": [".json"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([JSON.stringify(configForDevice(), null, 2)], { type: "application/json" }));
      await writable.close();
      toast("JSON file saved");
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") return;
  }

  downloadJson(filename, configForDevice());
  toast("JSON file downloaded");
}


function init(){
  const wc=$("welcomeConnectBtn"),cb=$("connectBtn"),db=$("demoBtn");if(wc)wc.onclick=connectDevice;if(cb)cb.onclick=toggleConnection;if(db)db.onclick=startDemoMode;
  $("saveBtn").onclick=async()=>{if((!isConnected&&!demoMode)||$("connectBtn").classList.contains("disconnected")){showConnectionWarning("Connect to GARLU before updating the device.");toast("Connect to GARLU first");return}const payload=configForDevice();if(!payload){toast("Fix configuration issues first");return}if(demoMode){Object.assign(config,payload);setOutputText(JSON.stringify(config,null,2));toast("Demo configuration updated");return}if(!port){showConnectionWarning();return}await writeLine("SET_CONFIG "+JSON.stringify(payload));const res=await readLine();setOutputText(res);toast("GARLU updated")};
  document.querySelectorAll(".page").forEach(b=>b.onclick=()=>{updateConfigFromUi();document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentPage=Number(b.dataset.page);updateUiFromConfig()});
  document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");if(b.dataset.scroll==="assignments"){window.scrollTo({top:0,behavior:"smooth"});return}document.getElementById(b.dataset.scroll).scrollIntoView({behavior:"smooth",block:"start"})});
  ["screenLayout","resolutionMode","oledBrightness","ringBrightness","cc0","cc1","cc2","cc3"].forEach(id=>$(id).addEventListener("change",()=>{updateConfigFromUi();updateUiFromConfig()}));
  $("oledBrightness").addEventListener("input",()=>{config.oledBrightness=normalizeOled($("oledBrightness").value);updateOledSlider()});$("ringBrightness").addEventListener("input",()=>{config.ringBrightness=normalizeRing($("ringBrightness").value);updateRingSlider()});
  document.querySelectorAll(".template").forEach(b=>b.onclick=()=>applyTemplatePages(templates[b.dataset.template].pages,"Template applied"));
  $("templateInput").addEventListener("click",e=>e.target.value="");
  $("templateInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;const raw=await f.text();try{const p=JSON.parse(raw),candidate={device:p.device||"GARLU_FADER_MINI",screenLayout:p.screenLayout||"standard",highResolution:Boolean(p.highResolution),oledBrightness:p.oledBrightness??70,ringBrightness:p.ringBrightness??70,pages:p.pages},issues=validateConfig(candidate);if(issues.length){setJsonWarnings(issues.map(i=>i.message));setOutputText(raw,true);toast("Template has validation issues");return}const items=getLocalTemplates();items.push({name:p.name||f.name.replace(/\.json$/i,""),description:p.description||"Local user template",pages:p.pages});saveLocalTemplates(items);renderLocalTemplates();setOutputText(JSON.stringify(p,null,2));toast("Local template added")}catch{setJsonWarnings(["Invalid JSON syntax. Check commas, quotes and boolean values."]);setOutputText(raw,true);toast("Invalid template JSON")}finally{e.target.value=""}};
  $("exportBtn").onclick=()=>{const payload=configForDevice();if(!payload){toast("Fix configuration issues before export");return}downloadJson("garlu-config.json",payload);toast("JSON exported")};
  $("sampleBtn").onclick=()=>{downloadJson("garlu-config-example.json",sampleConfig());toast("Example downloaded")};
  $("importInput").addEventListener("click",e=>e.target.value="");
  $("importInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;const raw=await f.text();importConfigFromRawText(raw,"JSON");e.target.value=""};
  $("applyJsonBtn").onclick=saveEditedJsonFile;
  const jwc=$("jsonWarningsClose");if(jwc)jwc.onclick=()=>setJsonWarnings([]);
  initCustomSelects();renderLocalTemplates();updateUiFromConfig();setDisconnected(false,true);
}
document.addEventListener("DOMContentLoaded",init);
