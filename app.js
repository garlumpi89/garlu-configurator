
let port=null,demoMode=false,currentPage=0,validationIssues=[],suppressTopValidation=false,isConnected=false,serialReaderActive=false;
const $=(id)=>document.getElementById(id);

function makePage(cc, labels=["","","",""], values=[63,63,63,63]){return {cc,min:[0,0,0,0],max:[127,127,127,127],labels,values};}
const presets={
  default:{name:"Default",pages:[makePage([11,1,21,7],["Expr","Mod","Ctrl21","Vol"]),makePage([22,23,24,25]),makePage([26,27,28,29]),makePage([30,31,0,1])]},
  liveMixer:{name:"Live-style Mixer",pages:[makePage([7,10,91,93],["Volume","Pan","Send A","Send B"]),makePage([14,15,16,17],["Ch5","Ch6","Ch7","Ch8"]),makePage([20,21,22,23]),makePage([24,25,26,27])]},
  liveMacros:{name:"Live-style Macros",pages:[makePage([14,15,16,17],["Macro 1","Macro 2","Macro 3","Macro 4"]),makePage([18,19,20,21],["Macro 5","Macro 6","Macro 7","Macro 8"]),makePage([22,23,24,25]),makePage([26,27,28,29])]},
  smartControls:{name:"Smart Controls",pages:[makePage([20,21,22,23],["Smart 1","Smart 2","Smart 3","Smart 4"]),makePage([24,25,26,27]),makePage([28,29,30,31]),makePage([32,33,34,35])]},
  quickControls:{name:"Quick Controls",pages:[makePage([16,17,18,19],["Quick 1","Quick 2","Quick 3","Quick 4"]),makePage([20,21,22,23]),makePage([24,25,26,27]),makePage([28,29,30,31])]},
  samplerExpression:{name:"Sampler Expression",pages:[makePage([11,1,2,21],["Expr","Dyn","Breath","Vibrato"]),makePage([7,10,64,91],["Volume","Pan","Sustain","Reverb"]),makePage([22,23,24,25]),makePage([26,27,28,29])]},
  synth:{name:"Synth Control",pages:[makePage([74,71,73,72],["Cutoff","Reso","Attack","Release"]),makePage([1,11,5,65],["Mod","Expr","Porta","Sustain"]),makePage([20,21,22,23]),makePage([24,25,26,27])]},
  orchestral:{name:"Orchestral",pages:[makePage([11,1,2,21],["Expr","Dyn","Breath","Vibrato"]),makePage([7,10,91,93],["Volume","Pan","Room","Reverb"]),makePage([22,23,24,25]),makePage([26,27,28,29])]},
  djFx:{name:"DJ FX",pages:[makePage([74,91,92,93],["Filter","Reverb","Tremolo","Chorus"]),makePage([20,21,22,23],["FX 1","FX 2","FX 3","FX 4"]),makePage([24,25,26,27]),makePage([28,29,30,31])]}
};

const config={
  device:"GARLU_FADER_MINI",
  fw:"demo",
  screenLayout:"standard",
  highResolution:false,
  oledBrightness:70,
  ringBrightness:70,
  auxiliaryBanner:true,
  pages:JSON.parse(JSON.stringify(presets.default.pages))
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
function ensurePageShape(page){
  page.cc=Array.isArray(page.cc)?page.cc.slice(0,4):[0,0,0,0];
  while(page.cc.length<4)page.cc.push(0);
  page.min=Array.isArray(page.min)?page.min.slice(0,4):[0,0,0,0];
  page.max=Array.isArray(page.max)?page.max.slice(0,4):[127,127,127,127];
  page.labels=Array.isArray(page.labels)?page.labels.slice(0,4):["","","",""];
  page.values=Array.isArray(page.values)?page.values.slice(0,4):[63,63,63,63];
  while(page.min.length<4)page.min.push(0);
  while(page.max.length<4)page.max.push(127);
  while(page.labels.length<4)page.labels.push("");
  while(page.values.length<4)page.values.push(63);
  for(let i=0;i<4;i++){
    page.min[i]=Math.max(0,Math.min(127,Number(page.min[i]??0)));
    page.max[i]=Math.max(0,Math.min(127,Number(page.max[i]??127)));
    if(page.min[i]>page.max[i])page.max[i]=page.min[i];
    page.labels[i]=String(page.labels[i]??"").slice(0,12);
    page.values[i]=Math.max(0,Math.min(127,Number(page.values[i]??63)));
  }
  return page;
}
function ensureConfigShape(){
  if(!Array.isArray(config.pages))config.pages=JSON.parse(JSON.stringify(presets.default.pages));
  while(config.pages.length<4)config.pages.push(makePage([0,0,0,0]));
  config.pages=config.pages.slice(0,4).map(ensurePageShape);
}
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
  serialReaderActive=false;
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
  if(typeof candidate.auxiliaryBanner!=="boolean"){
    issues.push({type:"field",field:"auxiliaryBanner",message:`auxiliaryBanner must be true or false. Current value: ${JSON.stringify(candidate.auxiliaryBanner)}.`});
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
    ensurePageShape(page);
    if(!page.cc||!Array.isArray(page.cc)||page.cc.length!==4){
      issues.push({type:"structure",page:pageIndex,message:`Page ${pageIndex+1}: expected exactly 4 CC values.`});
      return;
    }
    const seen=new Map();
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
      if(value>=0&&value<=max&&Number.isInteger(value)){
        if(seen.has(value)){
          const first=seen.get(value);
          issues.push({type:"duplicate",page:pageIndex,fader:faderIndex,firstFader:first,value,message:`Page ${pageIndex+1}: CC ${value} is assigned to Fader ${first+1} and Fader ${faderIndex+1}.`});
        }else{
          seen.set(value,faderIndex);
        }
      }
    });
    (page.values||[]).forEach((value,faderIndex)=>{
      if(!Number.isFinite(value)||value<0||value>127){
        issues.push({type:"value",page:pageIndex,fader:faderIndex,message:`Page ${pageIndex+1} · Fader ${faderIndex+1}: fader value must be 0-127.`});
      }
    });
    page.min.forEach((minValue,faderIndex)=>{
      const maxValue=page.max[faderIndex];
      if(!Number.isInteger(minValue)||!Number.isInteger(maxValue)||minValue<0||maxValue>127||minValue>maxValue){
        issues.push({type:"range",page:pageIndex,fader:faderIndex,message:`Page ${pageIndex+1} · Fader ${faderIndex+1}: min/max range must be 0-127 and min ≤ max.`});
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
  validationIssues.filter(issue=>(issue.type==="cc"||issue.type==="duplicate"||issue.type==="range"||issue.type==="value")&&issue.page===currentPage).forEach(issue=>{
    const card=$(`card${issue.fader}`);
    const hint=$(`hint${issue.fader}`);
    if(card)card.classList.add("invalid");
    if(hint)hint.textContent=issue.type==="duplicate"?`DUPLICATE CC ${issue.value}`:(issue.type==="range"?"INVALID RANGE":(issue.max!==undefined?`MAX ${issue.max} EXCEEDED`:"INVALID CC"));
    if(issue.type==="duplicate"){
      const firstCard=$(`card${issue.firstFader}`);
      const firstHint=$(`hint${issue.firstFader}`);
      if(firstCard)firstCard.classList.add("invalid");
      if(firstHint)firstHint.textContent=`DUPLICATE CC ${issue.value}`;
    }
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
    resolutionMode:{midi1:"MIDI 1.0 (7-bit)",enhanced:"Enhanced MIDI 1.0 (14-bit)"},
    auxiliaryBanner:{on:"ON",off:"OFF"}
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
  ensureConfigShape();
  $("screenLayout").value=["standard","performance"].includes(config.screenLayout)?config.screenLayout:"standard";
  $("resolutionMode").value=config.highResolution===true?"enhanced":"midi1";
  if($("auxiliaryBanner")) $("auxiliaryBanner").value=config.auxiliaryBanner===false?"off":"on";
  config.oledBrightness=normalizeOled(config.oledBrightness);
  config.ringBrightness=normalizeRing(config.ringBrightness);
  updateOledSlider();
  updateRingSlider();

  for(let i=0;i<4;i++){
    const input=$(`cc${i}`);
    input.max=maxAllowedCC();
    input.min=0;
    input.value=config.pages[currentPage]?.cc?.[i]??"";
    const minInput=$(`min${i}`), maxInput=$(`max${i}`), labelInput=$(`label${i}`);
    if(minInput)minInput.value=config.pages[currentPage].min[i];
    if(maxInput)maxInput.value=config.pages[currentPage].max[i];
    if(labelInput){
      labelInput.value=config.pages[currentPage].labels[i]||"";
      labelInput.placeholder="-";
    }
    const visual=document.querySelector(`#card${i} .fader-visual`);
    const v=Number(config.pages[currentPage].values?.[i]??63);
    if(visual)visual.style.setProperty("--fader-value",`${100-(Math.max(0,Math.min(127,v))/127*100)}%`);
  }
  updateDeviceLabels();
  updateValidationHighlights();
  syncCustomSelects();
}

function updateConfigFromUi(){
  suppressTopValidation=false;
  ensureConfigShape();
  config.screenLayout=$("screenLayout").value;
  config.highResolution=$("resolutionMode").value==="enhanced";
  if($("auxiliaryBanner")) config.auxiliaryBanner=$("auxiliaryBanner").value!=="off";
  config.oledBrightness=normalizeOled($("oledBrightness").value);
  config.ringBrightness=normalizeRing($("ringBrightness").value);
  updateOledSlider();
  updateRingSlider();

  for(let i=0;i<4;i++){
    const raw=$(`cc${i}`).value;
    config.pages[currentPage].cc[i]=raw===""?0:Number(raw);
    const minRaw=$(`min${i}`)?.value;
    const maxRaw=$(`max${i}`)?.value;
    config.pages[currentPage].min[i]=minRaw===""?0:Number(minRaw);
    config.pages[currentPage].max[i]=maxRaw===""?127:Number(maxRaw);
    config.pages[currentPage].labels[i]=String($(`label${i}`)?.value||"").slice(0,12);
  }
  setValidationIssues(validateConfig(config));
}


function nextAvailableCC(page, max, preferred=0, excludeIndex=-1){
  const used=new Set((page.cc||[]).map((v,i)=>i===excludeIndex?null:v).filter(v=>Number.isInteger(v)&&v>=0&&v<=max));
  for(let offset=1;offset<=max+1;offset++){
    const candidate=(preferred+offset)%(max+1);
    if(!used.has(candidate))return candidate;
  }
  return preferred;
}

function autoFixDuplicateCCs(){
  updateConfigFromUi();
  const max=maxAllowedCC(config);
  const duplicates=validateConfig(config).filter(issue=>issue.type==="duplicate");
  if(!duplicates.length){
    toast("No duplicate CCs detected");
    return;
  }

  const issue=duplicates.find(i=>i.page===currentPage)||duplicates[0];
  const page=config.pages[issue.page];
  const choice=window.prompt(
    `Duplicate CC ${issue.value} on Page ${issue.page+1}. Which fader should be updated? (${issue.firstFader+1} or ${issue.fader+1})`,
    String(issue.fader+1)
  );
  if(choice===null)return;
  const selected=Number(choice)-1;
  if(selected!==issue.firstFader&&selected!==issue.fader){
    toast("Auto-fix cancelled: invalid fader selection");
    return;
  }

  page.cc[selected]=nextAvailableCC(page,max,issue.value,selected);
  currentPage=issue.page;
  document.querySelectorAll(".page").forEach(button=>button.classList.toggle("active",Number(button.dataset.page)===currentPage));
  setValidationIssues(validateConfig(config));
  updateUiFromConfig();
  setOutputText(JSON.stringify(configForDevice()||config,null,2));
  toast(`Fader ${selected+1} assigned to next available CC`);
}

function configForDevice(){
  updateConfigFromUi();
  ensureConfigShape();
  if(validationIssues.length)return null;
  return {
    device:"GARLU_FADER_MINI",
    screenLayout:config.screenLayout,
    highResolution:config.highResolution,
    oledBrightness:config.oledBrightness,
    ringBrightness:config.ringBrightness,
    auxiliaryBanner:config.auxiliaryBanner!==false,
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
      auxiliaryBanner:[true,false],
      ccRange:"0-127 when highResolution=false; 0-31 when highResolution=true"
    },
    device:"GARLU_FADER_MINI",
    screenLayout:"standard",
    highResolution:false,
    oledBrightness:70,
    ringBrightness:70,
    auxiliaryBanner:true,
    pages:JSON.parse(JSON.stringify(presets.default.pages))
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


async function handleDeviceLine(line){
  const trimmed=line.trim();
  if(!trimmed)return;

  if(trimmed==="REQUEST_CONFIG"){
    const payload=configForDevice();
    if(!payload){
      toast("Fix config issues before sending preset");
      return;
    }
    await writeLine("SET_CONFIG "+JSON.stringify(payload));
    toast("Preset sent to GARLU");
    return;
  }

  if(trimmed.startsWith("{")){
    setOutputText(trimmed);
    try{
      const parsed=JSON.parse(trimmed);
      if(parsed.device==="GARLU_FADER_MINI"&&parsed.pages){
        Object.assign(config,parsed);
        setValidationIssues(validateConfig(config));
        updateUiFromConfig();
      }
    }catch(error){}
  }
}

async function startSerialListener(){
  if(!port||!port.readable||serialReaderActive)return;
  serialReaderActive=true;
  const reader=port.readable.getReader();
  const decoder=new TextDecoder();
  let buffer="";
  try{
    while(serialReaderActive&&port){
      const {value,done}=await reader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      let index;
      while((index=buffer.indexOf("\n"))>=0){
        const line=buffer.slice(0,index);
        buffer=buffer.slice(index+1);
        await handleDeviceLine(line);
      }
    }
  }catch(error){
    if(serialReaderActive)console.warn("GARLU serial listener stopped",error);
  }finally{
    try{reader.releaseLock();}catch(error){}
    serialReaderActive=false;
  }
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
    startSerialListener();
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
    config.auxiliaryBanner=parsed.auxiliaryBanner!==false;
    config.pages=JSON.parse(JSON.stringify(parsed.pages));
    ensureConfigShape();

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

function getLocalPresets(){
  try{return JSON.parse(localStorage.getItem("garluLocalPresets")||"[]");}
  catch{return [];}
}

function saveLocalPresets(items){
  localStorage.setItem("garluLocalPresets",JSON.stringify(items));
}

function applyPresetPages(pages,message="Preset applied"){
  updateConfigFromUi();
  config.pages=JSON.parse(JSON.stringify(pages));
  setValidationIssues(validateConfig(config));
  updateUiFromConfig();
  setOutputText(JSON.stringify(config,null,2));
  toast(message);
}

function renderLocalPresets(){
  const grid=$("presetGrid");
  if(!grid)return;
  grid.querySelectorAll(".preset.local-preset").forEach(item=>item.remove());
  getLocalPresets().forEach((preset,index)=>{
    const button=document.createElement("button");
    button.className="preset local-preset";
    button.dataset.localPreset=String(index);
    button.innerHTML=`<strong>${preset.name||"Local preset"}</strong><span>${preset.description||"Stored locally in this browser."}</span>`;
    button.onclick=()=>applyPresetPages(preset.pages,"Local preset applied");
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
    setOutputText(JSON.stringify(payload,null,2));
    toast("GARLU update sent");
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

  ["screenLayout","resolutionMode","auxiliaryBanner","oledBrightness","ringBrightness","cc0","cc1","cc2","cc3"].forEach(id=>{
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

  document.querySelectorAll(".preset").forEach(button=>{
    const key=button.dataset.preset;
    if(presets[key]) button.onclick=()=>applyPresetPages(presets[key].pages,"Preset applied");
  });

  $("presetInput").addEventListener("click",event=>{event.target.value="";});
  $("presetInput").onchange=async event=>{
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
        auxiliaryBanner:parsed.auxiliaryBanner!==false,
        pages:parsed.pages
      };
      const issues=validateConfig(candidate);
      if(issues.length){
        setJsonWarnings(issues.map(issue=>issue.message));
        setOutputText(raw,true);
        toast("Preset has validation issues");
        return;
      }
      const items=getLocalPresets();
      items.push({
        name:parsed.name||file.name.replace(/\.json$/i,""),
        description:parsed.description||"Local user preset",
        pages:parsed.pages
      });
      saveLocalPresets(items);
      renderLocalPresets();
      setOutputText(JSON.stringify(parsed,null,2));
      toast("Local preset added");
    }catch(error){
      setJsonWarnings(["Invalid JSON syntax. Check commas, quotes and boolean values."]);
      setOutputText(raw,true);
      toast("Invalid preset JSON");
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

  const autoFix=$("autoFixBtn");
  if(autoFix)autoFix.onclick=autoFixDuplicateCCs;

  const closeWarnings=$("jsonWarningsClose");
  if(closeWarnings)closeWarnings.onclick=()=>setJsonWarnings([]);

  initCustomSelects();
  renderLocalPresets();
  updateUiFromConfig();
  setDisconnected(false,true);
}

document.addEventListener("DOMContentLoaded",init);
