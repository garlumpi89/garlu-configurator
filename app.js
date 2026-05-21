
let port=null,demoMode=false,currentPage=0,validationIssues=[],suppressTopValidation=false,isConnected=false;
const $=(id)=>document.getElementById(id);

const templates={
  default:{pages:[{cc:[11,1,21,7]},{cc:[22,23,24,25]},{cc:[26,27,28,29]},{cc:[30,31,0,1]}]},
  ableton:{pages:[{cc:[7,10,91,93]},{cc:[14,15,16,17]},{cc:[20,21,22,23]},{cc:[24,25,26,27]}]},
  synth:{pages:[{cc:[74,71,73,72]},{cc:[1,11,5,65]},{cc:[20,21,22,23]},{cc:[24,25,26,27]}]},
  orchestral:{pages:[{cc:[11,1,2,21]},{cc:[22,23,24,25]},{cc:[26,27,28,29]},{cc:[30,31,0,1]}]}
};

const config={
  device:"GARLU_FADER_MINI",
  fw:"demo",
  screenLayout:"standard",
  highResolution:false,
  oledBrightness:70,
  ringBrightness:70,
  pages:JSON.parse(JSON.stringify(templates.default.pages))
};

const brightMap={low:25,medium:70,high:100};

function toast(message){
  const el=$("toast");
  if(!el)return;
  el.textContent=message;
  el.classList.remove("hidden");
  setTimeout(()=>el.classList.add("hidden"),2200);
}

function showApp(){
  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");
}

function deviceDisplayName(device){
  return {GARLU_FADER_MINI:"GARLU Fader Mini"}[device]||device||"Unknown GARLU device";
}

function normalizePercent(value){
  if(typeof value==="string"&&value in brightMap)return brightMap[value];
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):70;
}
function normalizeRing(value){return normalizePercent(value);}
function normalizeOled(value){return normalizePercent(value);}

function updateDeviceLabels(){
  const el=$("deviceInfo");
  if(!el)return;
  const name=deviceDisplayName(config.device);
  const fw=config.fw?`FW ${config.fw}`:"FW —";
  el.innerHTML=`<span class="device-name-line">${name}</span><span class="device-fw-line">${fw}</span>`;
}

function setDevicePillState(state){
  const pill=document.querySelector(".device-pill");
  if(!pill)return;
  pill.classList.toggle("idle-state",state==="idle");
  pill.classList.toggle("disconnected-compact",state==="disconnected");
}

function showConnectionWarning(message="Connect to GARLU before updating the device."){
  const el=$("connectionWarning");
  if(!el)return;
  el.textContent=message;
  el.classList.remove("hidden");
  clearTimeout(window.__garluConnectionWarningTimer);
  window.__garluConnectionWarningTimer=setTimeout(()=>el.classList.add("hidden"),5200);
}

function hideConnectionWarning(){
  const el=$("connectionWarning");
  if(el)el.classList.add("hidden");
}

function setConnected(label="GARLU connected",connected=true){
  isConnected=connected;
  const btn=$("connectBtn");
  const dot=$("statusDot");
  $("connectionStatus").textContent=label;
  dot.classList.toggle("connected",connected);
  dot.classList.remove("disconnected");
  btn.classList.toggle("connected",connected);
  btn.classList.remove("disconnected");
  btn.textContent=connected?"GARLU connected":"Connect to GARLU";
  setDevicePillState(connected?"connected":"idle");
  updateDeviceLabels();
  if(connected)hideConnectionWarning();
}

function setDisconnected(red=false,idle=false){
  isConnected=false;
  if(red)demoMode=false;
  if(port&&port.close){try{port.close();}catch(e){}}
  port=null;
  const btn=$("connectBtn");
  const dot=$("statusDot");
  $("connectionStatus").textContent=idle?"GARLU FADER":(red?"GARLU disconnected":"Not connected");
  dot.classList.remove("connected");
  dot.classList.toggle("disconnected",red);
  btn.classList.remove("connected");
  btn.classList.toggle("disconnected",red);
  btn.textContent=red?"GARLU disconnected":"Connect to GARLU";
  setDevicePillState(idle?"idle":(red?"disconnected":"normal"));
}

function toggleConnection(){
  if(isConnected){
    demoMode=false;
    setDisconnected(true,false);
    toast("GARLU disconnected");
    return;
  }
  connectDevice();
}

function outputEl(){return $("output");}
function warningsEl(){return $("jsonWarnings");}

function setJsonWarnings(messages=[]){
  const el=warningsEl();
  const text=$("jsonWarningsText");
  if(!el)return;
  if(!messages.length){
    el.classList.add("hidden");
    if(text)text.textContent="";
    return;
  }
  const message=messages.map(m=>`• ${m}`).join("\n");
  el.classList.remove("hidden");
  if(text)text.textContent=message;
  else el.textContent=message;
}

function setOutputText(text,error=false){
  const out=outputEl();
  if(!out)return;
  out.classList.toggle("output-error",error);
  out.value=text;
  if(!error)setJsonWarnings([]);
}

function maxAllowedCC(candidate=config){
  return candidate.highResolution===true?31:127;
}

function validateConfig(candidate){
  const issues=[];
  const layouts=["standard","performance"];
  const oled=normalizeOled(candidate.oledBrightness);
  const ring=normalizeRing(candidate.ringBrightness);

  if(typeof candidate.highResolution!=="boolean"){
    issues.push({type:"field",field:"highResolution",message:`highResolution must be true or false. Current value: ${JSON.stringify(candidate.highResolution)}.`});
  }
  if(!layouts.includes(candidate.screenLayout)){
    issues.push({type:"field",field:"screenLayout",message:`screenLayout must be "standard" or "performance". Current value: ${JSON.stringify(candidate.screenLayout)}.`});
  }
  if(!Number.isFinite(oled)||oled<0||oled>100){
    issues.push({type:"field",field:"oledBrightness",message:`oledBrightness must be between 0 and 100. Current value: ${JSON.stringify(candidate.oledBrightness)}.`});
  }
  if(!Number.isFinite(ring)||ring<0||ring>100){
    issues.push({type:"field",field:"ringBrightness",message:`ringBrightness must be between 0 and 100. Current value: ${JSON.stringify(candidate.ringBrightness)}.`});
  }
  if(!candidate.pages||!Array.isArray(candidate.pages)||candidate.pages.length!==4){
    issues.push({type:"structure",message:"Expected exactly 4 pages."});
    return issues;
  }

  const max=maxAllowedCC(candidate);
  candidate.pages.forEach((page,pageIndex)=>{
    if(!page.cc||!Array.isArray(page.cc)||page.cc.length!==4){
      issues.push({type:"structure",page:pageIndex,message:`Page ${pageIndex+1}: expected exactly 4 CC values.`});
      return;
    }
    page.cc.forEach((value,faderIndex)=>{
      if(typeof value!=="number"||!Number.isFinite(value)){
        issues.push({type:"cc",page:pageIndex,fader:faderIndex,value,message:`Page ${pageIndex+1} · Fader ${faderIndex+1}: CC value must be numeric.`});
        return;
      }
      if(!Number.isInteger(value)){
        issues.push({type:"cc",page:pageIndex,fader:faderIndex,value,message:`Page ${pageIndex+1} · Fader ${faderIndex+1}: CC value must be an integer.`});
      }
      if(value<0||value>max){
        issues.push({type:"cc",page:pageIndex,fader:faderIndex,value,max,message:`Page ${pageIndex+1} · Fader ${faderIndex+1}: CC value ${value} exceeds maximum allowed value (${max}).`});
      }
    });
  });
  return issues;
}

function setValidationIssues(issues){
  validationIssues=issues;
  const panel=$("validationPanel");
  if(!issues.length||suppressTopValidation){
    panel.classList.add("hidden");
  }else{
    panel.classList.remove("hidden");
    $("validationSummary").textContent=issues.length===1?issues[0].message:`${issues[0].message} + ${issues.length-1} more issue(s).`;
  }
  updateValidationHighlights();
}

function updateValidationHighlights(){
  for(let i=0;i<4;i++){
    const card=$(`card${i}`);
    const hint=$(`hint${i}`);
    if(card)card.classList.remove("invalid");
    if(hint)hint.textContent="MIDI CC";
  }
  const resolutionSetting=$("resolutionSetting");
  const resolutionHint=$("resolutionHint");
  if(resolutionSetting)resolutionSetting.classList.remove("invalid");
  if(resolutionHint){
    resolutionHint.textContent="";
    resolutionHint.classList.remove("invalid-text");
  }
  validationIssues.filter(issue=>issue.type==="cc"&&issue.page===currentPage).forEach(issue=>{
    const card=$(`card${issue.fader}`);
    const hint=$(`hint${issue.fader}`);
    if(card)card.classList.add("invalid");
    if(hint)hint.textContent=issue.max!==undefined?`MAX ${issue.max} EXCEEDED`:"INVALID CC";
  });
  if(validationIssues.find(issue=>issue.field==="highResolution")&&resolutionSetting&&resolutionHint){
    resolutionSetting.classList.add("invalid");
    resolutionHint.textContent="Invalid value in imported JSON";
    resolutionHint.classList.add("invalid-text");
  }
}

function labelForSelectValue(id,value){
  const labels={
    screenLayout:{standard:"Standard Layout",performance:"Performance Layout"},
    resolutionMode:{midi1:"MIDI 1.0 (7-bit)",enhanced:"Enhanced MIDI 1.0 (14-bit)"}
  };
  return labels[id]?.[value]||value;
}

function syncCustomSelects(){
  document.querySelectorAll(".custom-select").forEach(wrap=>{
    const id=wrap.dataset.select;
    const select=$(id);
    const triggerText=wrap.querySelector(".custom-select-trigger span");
    if(!select||!triggerText)return;
    triggerText.textContent=labelForSelectValue(id,select.value);
    wrap.querySelectorAll(".custom-select-menu button").forEach(button=>{
      button.classList.toggle("active",button.dataset.value===select.value);
    });
  });
}

function initCustomSelects(){
  document.querySelectorAll(".custom-select").forEach(wrap=>{
    const id=wrap.dataset.select;
    const select=$(id);
    const trigger=wrap.querySelector(".custom-select-trigger");
    if(!select||!trigger)return;
    trigger.onclick=(event)=>{
      event.stopPropagation();
      document.querySelectorAll(".custom-select.open").forEach(other=>{
        if(other!==wrap)other.classList.remove("open");
      });
      wrap.classList.toggle("open");
    };
    wrap.querySelectorAll(".custom-select-menu button").forEach(button=>{
      button.onclick=(event)=>{
        event.stopPropagation();
        select.value=button.dataset.value;
        select.dispatchEvent(new Event("change",{bubbles:true}));
        wrap.classList.remove("open");
        syncCustomSelects();
      };
    });
  });
  document.addEventListener("click",()=>{
    document.querySelectorAll(".custom-select.open").forEach(wrap=>wrap.classList.remove("open"));
  });
}

function updateOledSlider(){
  const slider=$("oledBrightness");
  const value=$("oledBrightnessValue");
  if(!slider)return;
  const val=normalizeOled(config.oledBrightness);
  slider.value=val;
  slider.style.setProperty("--ring-fill",`${val}%`);
  if(value)value.textContent=`${val}%`;
}

function updateRingSlider(){
  const slider=$("ringBrightness");
  const value=$("ringBrightnessValue");
  if(!slider)return;
  const val=normalizeRing(config.ringBrightness);
  slider.value=val;
  slider.style.setProperty("--ring-fill",`${val}%`);
  if(value)value.textContent=`${val}%`;
}

function updateUiFromConfig(){
  $("screenLayout").value=["standard","performance"].includes(config.screenLayout)?config.screenLayout:"standard";
  $("resolutionMode").value=config.highResolution===true?"enhanced":"midi1";
  config.oledBrightness=normalizeOled(config.oledBrightness);
  config.ringBrightness=normalizeRing(config.ringBrightness);
  updateOledSlider();
  updateRingSlider();

  for(let i=0;i<4;i++){
    const input=$(`cc${i}`);
    input.max=maxAllowedCC();
    input.min=0;
    input.value=config.pages[currentPage]?.cc?.[i]??"";
  }
  updateDeviceLabels();
  updateValidationHighlights();
  syncCustomSelects();
}

function updateConfigFromUi(){
  suppressTopValidation=false;
  config.screenLayout=$("screenLayout").value;
  config.highResolution=$("resolutionMode").value==="enhanced";
  config.oledBrightness=normalizeOled($("oledBrightness").value);
  config.ringBrightness=normalizeRing($("ringBrightness").value);
  updateOledSlider();
  updateRingSlider();

  for(let i=0;i<4;i++){
    const raw=$(`cc${i}`).value;
    config.pages[currentPage].cc[i]=raw===""?0:Number(raw);
  }
  setValidationIssues(validateConfig(config));
}

function configForDevice(){
  updateConfigFromUi();
  if(validationIssues.length)return null;
  return {
    device:"GARLU_FADER_MINI",
    screenLayout:config.screenLayout,
    highResolution:config.highResolution,
    oledBrightness:config.oledBrightness,
    ringBrightness:config.ringBrightness,
    pages:config.pages
  };
}

function sampleConfig(){
  return {
    _allowedValues:{
      screenLayout:["standard","performance"],
      highResolution:[false,true],
      oledBrightness:"0-100",
      ringBrightness:"0-100",
      ccRange:"0-127 when highResolution=false; 0-31 when highResolution=true"
    },
    device:"GARLU_FADER_MINI",
    screenLayout:"standard",
    highResolution:false,
    oledBrightness:70,
    ringBrightness:70,
    pages:JSON.parse(JSON.stringify(templates.default.pages))
  };
}

function downloadJson(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function writeLine(line){
  const writer=port.writable.getWriter();
  await writer.write(new TextEncoder().encode(line+"\n"));
  writer.releaseLock();
}

async function readLine(timeoutMs=0){
  const reader=port.readable.getReader();
  let text="";
  let timer=null;

  try{
    if(timeoutMs>0){
      timer=setTimeout(()=>{
        try{reader.cancel();}catch(error){}
      },timeoutMs);
    }

    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      text+=new TextDecoder().decode(value);
      if(text.includes("\n"))break;
    }
  }finally{
    if(timer)clearTimeout(timer);
    reader.releaseLock();
  }

  text=text.trim();
  if(!text)throw new Error("timeout");
  return text;
}

async function readDeviceConfig(){
  let response="";

  // FW v1.9 sends its current JSON automatically as soon as USB serial opens.
  // If an older FW does not do that, fall back to GET_CONFIG.
  try{
    response=await readLine(1200);
  }catch(error){
    await writeLine("GET_CONFIG");
    response=await readLine(1500);
  }

  if(!response.startsWith("{")){
    throw new Error("Invalid response from GARLU");
  }

  setOutputText(response);
  Object.assign(config,JSON.parse(response));
  setValidationIssues(validateConfig(config));
  updateUiFromConfig();
}

async function connectDevice(){
  if(!("serial" in navigator)){
    showConnectionWarning("Web Serial is not available in this browser. Use Chrome or Edge over HTTPS/localhost.");
    toast("Web Serial not available");
    return;
  }
  try{
    port=await navigator.serial.requestPort();
    await port.open({baudRate:115200});
    demoMode=false;
    showApp();
    $("connectBtn").classList.remove("connected","disconnected");
    $("connectBtn").textContent="Reading GARLU...";
    toast("Reading device configuration...");
    await readDeviceConfig();
    setConnected("GARLU connected",true);
    toast(`${deviceDisplayName(config.device)} connected`);
  }catch(error){
    try{if(port)await port.close();}catch(e){}
    port=null;
    setDisconnected(true,false);
    showConnectionWarning("Could not establish USB connection with GARLU. Check cable, permissions and firmware.");
    toast("GARLU connection failed");
  }
}


function importConfigFromRawText(rawText,label="JSON"){
  suppressTopValidation=true;
  try{
    const parsed=JSON.parse(rawText);
    if(!parsed.pages||parsed.pages.length!==4)throw new Error("Invalid pages");

    config.device=parsed.device||"GARLU_FADER_MINI";
    config.fw=parsed.fw||config.fw||"imported";
    config.screenLayout=parsed.screenLayout;
    config.highResolution=parsed.highResolution;
    config.oledBrightness=parsed.oledBrightness;
    config.ringBrightness=parsed.ringBrightness;
    config.pages=JSON.parse(JSON.stringify(parsed.pages));

    currentPage=0;
    document.querySelectorAll(".page").forEach(button=>button.classList.remove("active"));
    document.querySelector('.page[data-page="0"]').classList.add("active");

    const issues=validateConfig(config);
    setValidationIssues(issues);
    updateUiFromConfig();

    if(issues.length){
      setJsonWarnings(issues.map(issue=>issue.message));
      setOutputText(rawText,true);
      toast(`${label} has warnings`);
      return false;
    }

    setJsonWarnings([]);
    setOutputText(JSON.stringify(config,null,2));
    suppressTopValidation=false;
    setValidationIssues([]);
    toast(`${label} applied`);
    return true;
  }catch(error){
    const message="Invalid JSON syntax or GARLU structure. Check commas, quotes and boolean values.";
    setValidationIssues([{type:"structure",message}]);
    setJsonWarnings([message]);
    setOutputText(rawText,true);
    toast("Invalid JSON");
    return false;
  }
}

function getLocalTemplates(){
  try{return JSON.parse(localStorage.getItem("garluLocalTemplates")||"[]");}
  catch{return [];}
}

function saveLocalTemplates(items){
  localStorage.setItem("garluLocalTemplates",JSON.stringify(items));
}

function applyTemplatePages(pages,message="Template applied"){
  updateConfigFromUi();
  config.pages=JSON.parse(JSON.stringify(pages));
  setValidationIssues(validateConfig(config));
  updateUiFromConfig();
  setOutputText(JSON.stringify(config,null,2));
  toast(message);
}

function renderLocalTemplates(){
  const grid=$("templateGrid");
  if(!grid)return;
  grid.querySelectorAll(".template.local-template").forEach(item=>item.remove());
  getLocalTemplates().forEach((template,index)=>{
    const button=document.createElement("button");
    button.className="template local-template";
    button.dataset.localTemplate=String(index);
    button.innerHTML=`<strong>${template.name||"Local template"}</strong><span>${template.description||"Stored locally in this browser."}</span>`;
    button.onclick=()=>applyTemplatePages(template.pages,"Local template applied");
    grid.appendChild(button);
  });
}

async function saveEditedJsonFile(){
  const raw=outputEl().value;
  const valid=importConfigFromRawText(raw,"JSON changes");
  if(!valid)return;

  const filename="garlu-config-edited.json";
  try{
    if("showSaveFilePicker" in window){
      const handle=await window.showSaveFilePicker({
        suggestedName:filename,
        types:[{description:"JSON file",accept:{"application/json":[".json"]}}]
      });
      const writable=await handle.createWritable();
      await writable.write(new Blob([JSON.stringify(configForDevice(),null,2)],{type:"application/json"}));
      await writable.close();
      toast("JSON file saved");
      return;
    }
  }catch(error){
    if(error&&error.name==="AbortError")return;
  }
  downloadJson(filename,configForDevice());
  toast("JSON file downloaded");
}

function startDashboard(){
  connectDevice();
}

function init(){
  const start=$("startBtn");
  const connect=$("connectBtn");

  if(start)start.onclick=startDashboard;
  if(connect)connect.onclick=toggleConnection;

  $("saveBtn").onclick=async()=>{
    if(!isConnected||$("connectBtn").classList.contains("disconnected")){
      showConnectionWarning("Connect to GARLU before updating the device.");
      toast("Connect to GARLU first");
      return;
    }
    const payload=configForDevice();
    if(!payload){
      toast("Fix configuration issues first");
      return;
    }
    if(!port){
      showConnectionWarning("Connect to GARLU before updating the device.");
      return;
    }
    await writeLine("SET_CONFIG "+JSON.stringify(payload));
    const response=await readLine(1500);
    setOutputText(response);
    toast("GARLU updated");
  };

  document.querySelectorAll(".page").forEach(button=>{
    button.onclick=()=>{
      updateConfigFromUi();
      document.querySelectorAll(".page").forEach(b=>b.classList.remove("active"));
      button.classList.add("active");
      currentPage=Number(button.dataset.page);
      updateUiFromConfig();
    };
  });

  document.querySelectorAll(".nav").forEach(button=>{
    button.onclick=()=>{
      document.querySelectorAll(".nav").forEach(b=>b.classList.remove("active"));
      button.classList.add("active");
      if(button.dataset.scroll==="assignments"){
        window.scrollTo({top:0,behavior:"smooth"});
        return;
      }
      document.getElementById(button.dataset.scroll).scrollIntoView({behavior:"smooth",block:"start"});
    };
  });

  ["screenLayout","resolutionMode","oledBrightness","ringBrightness","cc0","cc1","cc2","cc3"].forEach(id=>{
    const el=$(id);
    if(!el)return;
    el.addEventListener("change",()=>{
      updateConfigFromUi();
      updateUiFromConfig();
    });
  });

  $("oledBrightness").addEventListener("input",()=>{
    config.oledBrightness=normalizeOled($("oledBrightness").value);
    updateOledSlider();
  });

  $("ringBrightness").addEventListener("input",()=>{
    config.ringBrightness=normalizeRing($("ringBrightness").value);
    updateRingSlider();
  });

  document.querySelectorAll(".template").forEach(button=>{
    button.onclick=()=>applyTemplatePages(templates[button.dataset.template].pages,"Template applied");
  });

  $("templateInput").addEventListener("click",event=>{event.target.value="";});
  $("templateInput").onchange=async event=>{
    const file=event.target.files[0];
    if(!file)return;
    const raw=await file.text();
    try{
      const parsed=JSON.parse(raw);
      const candidate={
        device:parsed.device||"GARLU_FADER_MINI",
        screenLayout:parsed.screenLayout||"standard",
        highResolution:Boolean(parsed.highResolution),
        oledBrightness:parsed.oledBrightness??70,
        ringBrightness:parsed.ringBrightness??70,
        pages:parsed.pages
      };
      const issues=validateConfig(candidate);
      if(issues.length){
        setJsonWarnings(issues.map(issue=>issue.message));
        setOutputText(raw,true);
        toast("Template has validation issues");
        return;
      }
      const items=getLocalTemplates();
      items.push({
        name:parsed.name||file.name.replace(/\.json$/i,""),
        description:parsed.description||"Local user template",
        pages:parsed.pages
      });
      saveLocalTemplates(items);
      renderLocalTemplates();
      setOutputText(JSON.stringify(parsed,null,2));
      toast("Local template added");
    }catch(error){
      setJsonWarnings(["Invalid JSON syntax. Check commas, quotes and boolean values."]);
      setOutputText(raw,true);
      toast("Invalid template JSON");
    }finally{
      event.target.value="";
    }
  };

  $("exportBtn").onclick=()=>{
    const payload=configForDevice();
    if(!payload){
      toast("Fix configuration issues before export");
      return;
    }
    downloadJson("garlu-config.json",payload);
    toast("JSON exported");
  };

  $("sampleBtn").onclick=()=>{
    downloadJson("garlu-config-example.json",sampleConfig());
    toast("Example downloaded");
  };

  $("importInput").addEventListener("click",event=>{event.target.value="";});
  $("importInput").onchange=async event=>{
    const file=event.target.files[0];
    if(!file)return;
    const raw=await file.text();
    importConfigFromRawText(raw,"JSON");
    event.target.value="";
  };

  $("applyJsonBtn").onclick=saveEditedJsonFile;

  const closeWarnings=$("jsonWarningsClose");
  if(closeWarnings)closeWarnings.onclick=()=>setJsonWarnings([]);

  initCustomSelects();
  renderLocalTemplates();
  updateUiFromConfig();
  setDisconnected(false,true);
}

document.addEventListener("DOMContentLoaded",init);
