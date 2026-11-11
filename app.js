"use strict";
const STORAGE_KEY="fit-daily-state-v1";
const defaults={profile:{sex:"male",age:null,height:null,startWeight:null,targetWeight:null,availableMinutes:40,calorieTarget:null,healthConfirmed:false},records:[]};
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const num=v=>v===""?null:Number(v);
const safe=t=>String(t||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const localISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const today=()=>localISO(new Date());
const dateText=(value,options={month:"short",day:"numeric",weekday:"short"})=>new Date(value+"T12:00:00").toLocaleDateString("zh-CN",options);

function loadState(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(!saved||!Array.isArray(saved.records))return JSON.parse(JSON.stringify(defaults));
    return{profile:{...defaults.profile,...(saved.profile||{})},records:saved.records};
  }catch{return JSON.parse(JSON.stringify(defaults))}
}
let state=loadState();
let coachTarget={walk:0,pushups:0};
function autosize(el){if(!el.value||!el.scrollHeight){el.style.height="";return}el.style.height="auto";el.style.height=el.scrollHeight+"px"}
function autosizeAll(){$$(".meal-entry textarea,#notes").forEach(autosize)}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function sorted(dir="desc"){return [...state.records].sort((a,b)=>dir==="desc"?b.date.localeCompare(a.date):a.date.localeCompare(b.date))}
function flash(el,text){el.textContent=text;setTimeout(()=>{if(el.textContent===text)el.textContent=""},2200)}
function mealCalories(r){
  const parts=[r.breakfastCal,r.lunchCal,r.dinnerCal,r.snacksCal];
  if(parts.some(v=>v!=null&&v!==""))return parts.reduce((s,v)=>s+(Number(v)||0),0);
  return Number(r.totalCalories)||0;
}

function fillProfile(){
  const p=state.profile;
  ["sex","age","height","startWeight","targetWeight","availableMinutes"].forEach(id=>$("#"+id).value=p[id]??"");
  $("#profileCalorieTarget").value=p.calorieTarget??"";
  $("#healthConfirmed").checked=Boolean(p.healthConfirmed);
}
function fillRecord(date){
  const r=state.records.find(x=>x.date===date);
  const fields=["weight","sleep","steps","water","breakfast","breakfastCal","lunch","lunchCal","dinner","dinnerCal","snacks","snacksCal","walkMinutes","pushups","notes"];
  fields.forEach(id=>$("#"+id).value=r?.[id]??"");
  const radio=document.querySelector('input[name="condition"][value="'+(r?.condition||"good")+'"]');
  if(radio)radio.checked=true;
  $$(".ai-result").forEach(el=>{el.textContent="";el.classList.remove("error")});
  autosizeAll();
  renderRemaining();
  updateCalories();
}
function collectRecord(){
  const r={
    date:$("#recordDate").value,
    weight:num($("#weight").value),sleep:num($("#sleep").value),steps:num($("#steps").value),water:num($("#water").value),
    breakfast:$("#breakfast").value.trim(),breakfastCal:num($("#breakfastCal").value),
    lunch:$("#lunch").value.trim(),lunchCal:num($("#lunchCal").value),
    dinner:$("#dinner").value.trim(),dinnerCal:num($("#dinnerCal").value),
    snacks:$("#snacks").value.trim(),snacksCal:num($("#snacksCal").value),
    walkMinutes:num($("#walkMinutes").value),pushups:num($("#pushups").value),
    condition:document.querySelector('input[name="condition"]:checked')?.value||"good",
    notes:$("#notes").value.trim(),updatedAt:new Date().toISOString()
  };
  r.totalCalories=mealCalories(r);
  return r;
}

function calculateStreak(){
  const dates=[...new Set(state.records.map(r=>r.date))].sort().reverse();
  if(!dates.length)return 0;
  const cursor=new Date(today()+"T12:00:00");
  if(dates[0]!==localISO(cursor)){cursor.setDate(cursor.getDate()-1);if(dates[0]!==localISO(cursor))return 0}
  let count=0;
  for(const date of dates){if(date!==localISO(cursor))break;count++;cursor.setDate(cursor.getDate()-1)}
  return count;
}
function renderSummary(){
  const weighted=sorted().filter(r=>r.weight);
  const current=weighted[0]?.weight??state.profile.startWeight;
  const start=state.profile.startWeight;
  const target=state.profile.targetWeight;
  const change=current&&start?current-start:null;
  $("#currentWeight").textContent=current?current.toFixed(1):"--";
  $("#weightChange").textContent=change===null?"--":(change>0?"+":"")+change.toFixed(1);
  $("#weightChange").style.color=change!==null&&change<=0?"#1aa267":"#ff2442";
  $("#streak").textContent=calculateStreak();
  $("#startLabel").textContent="初始 "+(start?Number(start).toFixed(1):"--")+" kg";
  $("#targetLabel").textContent="目标 "+(target?Number(target).toFixed(1):"--")+" kg";
  if(current&&start&&target&&start!==target){
    const total=Math.abs(start-target);
    const done=Math.max(0,total-Math.abs(current-target));
    const percent=Math.min(100,Math.round(done/total*100));
    $("#progressText").textContent="已完成 "+percent+"%";
    $("#progressBar").style.width=percent+"%";
  }else{
    $("#progressText").textContent="完善资料后显示";
    $("#progressBar").style.width="0";
  }
}
function updateCalories(){
  const total=$$(".meal-cal").reduce((sum,input)=>sum+(Number(input.value)||0),0);
  const target=Number(state.profile.calorieTarget)||2100;
  const remaining=Math.max(0,target-total);
  const percent=Math.min(100,Math.round(total/target*100));
  $("#totalCalories").textContent=total;
  $("#calorieTarget").textContent=target;
  $("#calorieRemaining").textContent=remaining;
  $("#caloriePercent").textContent=percent+"%";
  $("#calorieBar").style.width=percent+"%";
}
function renderCoach(){
  const all=sorted();
  const latest=all.find(r=>r.date<today())||all[0];
  const weekday=new Date(today()+"T12:00:00").getDay();
  const max=Number(state.profile.availableMinutes)||40;
  const pain=latest?.condition==="pain";
  const tired=latest?.condition==="tired"||(latest?.sleep!=null&&latest.sleep<6);
  const strength=[1,3,5].includes(weekday);
  let walk=pain?15:tired?20:30;
  if(!pain&&!tired&&latest?.walkMinutes>=30)walk=35;
  walk=Math.min(walk,Math.max(10,max-5));
  let plans=[];
  if(weekday===0){
    plans=[["轻松走",Math.min(20,max)+"分钟，保持舒适节奏"],["恢复","小腿、髋部和肩背拉伸5分钟"]];
    $("#coachTitle").textContent="今天，慢一点也很好";
    $("#coachDuration").textContent="约"+Math.min(25,max)+"分钟";
  }else if(pain){
    plans=[["低强度散步",walk+"分钟，不追求速度"],["暂停力量","记录疼痛位置；持续或加重时就医"]];
    $("#coachTitle").textContent="今天先照顾好身体";
    $("#coachDuration").textContent="约"+walk+"分钟";
  }else{
    plans=[["快走",walk+"分钟，略喘但能说短句"],strength?["斜板俯卧撑","3组 × 6～10次，组间休息60秒"]:["舒展活动","肩背、髋部和小腿拉伸5分钟"]];
    $("#coachTitle").textContent=tired?"保持一点活动就很好":"今天，舒服地动一动";
    $("#coachDuration").textContent="约"+Math.min(max,walk+(strength?10:5))+"分钟";
  }
  coachTarget={walk:weekday===0?Math.min(20,max):walk,pushups:(!pain&&weekday!==0&&strength)?24:0};
  $("#coachPlans").innerHTML=plans.map(p=>'<div class="plan"><b>'+p[0]+'</b><span>'+p[1]+"</span></div>").join("");
}

function renderHistory(){
  const all=sorted(),list=$("#historyList");
  if(!all.length){list.innerHTML='<div class="empty">还没有记录，从今天开始就好。</div>';return}
  const feelings={good:"状态不错",tired:"有点累",pain:"身体疼痛"};
  list.innerHTML=all.map(r=>{
    const meals=[[r.breakfast,"早餐",r.breakfastCal],[r.lunch,"午餐",r.lunchCal],[r.dinner,"晚餐",r.dinnerCal],[r.snacks,"加餐",r.snacksCal]]
      .filter(x=>x[0]).map(x=>x[1]+"："+safe(x[0])+(x[2]!=null?" <i>"+Number(x[2])+" kcal</i>":"")).join("<br>");
    return '<article class="history-item c-'+({good:1,tired:1,pain:1}[r.condition]?r.condition:"good")+'"><div class="history-top"><span>'+dateText(r.date)+'</span><strong>'+(r.weight?Number(r.weight).toFixed(1)+" kg":"未记体重")+'</strong></div><div class="chips"><span>走路 '+(r.walkMinutes||0)+' 分钟</span><span>俯卧撑 '+(r.pushups||0)+' 个</span><span>摄入 '+mealCalories(r)+' kcal</span><span>'+(feelings[r.condition]||"状态未记")+'</span></div>'+(meals?'<p class="meals">'+meals+"</p>":"")+(r.notes?'<p class="meals">备注：'+safe(r.notes)+"</p>":"")+'<div class="history-actions"><button class="text-btn edit" data-date="'+safe(r.date)+'">编辑</button><button class="text-btn delete" data-date="'+safe(r.date)+'">删除</button></div></article>';
  }).join("");
}
function weekData(){
  const start=new Date(today()+"T12:00:00");start.setDate(start.getDate()-6);
  const records=sorted("asc").filter(r=>new Date(r.date+"T12:00:00")>=start);
  const weights=records.filter(r=>r.weight);
  const steps=records.filter(r=>r.steps);
  const sleeps=records.filter(r=>r.sleep);
  const calories=records.filter(r=>mealCalories(r)>0);
  return{
    records,weights,
    change:weights.length>1?weights.at(-1).weight-weights[0].weight:null,
    walk:records.reduce((s,r)=>s+(Number(r.walkMinutes)||0),0),
    pushups:records.reduce((s,r)=>s+(Number(r.pushups)||0),0),
    avgSteps:steps.length?Math.round(steps.reduce((s,r)=>s+Number(r.steps),0)/steps.length):null,
    avgSleep:sleeps.length?sleeps.reduce((s,r)=>s+Number(r.sleep),0)/sleeps.length:null,
    avgCalories:calories.length?Math.round(calories.reduce((s,r)=>s+mealCalories(r),0)/calories.length):null
  };
}
function renderChart(weights){
  const svg=$("#weightChart");
  if(weights.length<2){svg.innerHTML='<text x="165" y="82" text-anchor="middle" fill="#999999" font-size="11">记录至少两次体重后显示趋势</text>';return}
  const values=weights.map(r=>Number(r.weight));
  let min=Math.min(...values),max=Math.max(...values);
  if(max-min<1){min-=.5;max+=.5}
  const left=35,right=320,top=20,bottom=130;
  const points=weights.map((r,i)=>({x:left+i*(right-left)/(weights.length-1),y:top+(max-r.weight)*(bottom-top)/(max-min),r}));
  let html='<g stroke="#f0f0f0"><path d="M35 20H320M35 75H320M35 130H320"/></g>';
  html+='<polyline points="'+points.map(p=>p.x+","+p.y).join(" ")+'" fill="none" stroke="#ff2442" stroke-width="4"/>';
  html+='<g fill="#ff2442">'+points.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="4"/>').join("")+"</g>";
  html+='<g fill="#999999" font-size="9"><text x="3" y="24">'+max.toFixed(1)+'</text><text x="3" y="79">'+((max+min)/2).toFixed(1)+'</text><text x="3" y="134">'+min.toFixed(1)+'</text>';
  html+=points.map((p,i)=>(i===0||i===points.length-1||i===Math.floor(points.length/2))?'<text x="'+(p.x-9)+'" y="153">'+dateText(p.r.date,{month:"numeric",day:"numeric"})+"</text>":"").join("")+"</g>";
  svg.innerHTML=html;
}
function reportText(d){
  if(!d.records.length)return"最近7天还没有打卡记录。";
  const trend=d.change==null?"体重数据不足":d.change<0?"体重下降 "+Math.abs(d.change).toFixed(1)+" kg":d.change>0?"体重上升 "+d.change.toFixed(1)+" kg":"体重保持不变";
  const nl=String.fromCharCode(10);
  return"LSC 减肥周报（最近7天）"+nl+"打卡："+d.records.length+"/7天"+nl+"体重："+trend+nl+"步行："+d.walk+"分钟"+nl+"俯卧撑："+d.pushups+"个"+nl+"日均热量："+(d.avgCalories??"记录不足")+" kcal"+nl+"日均步数："+(d.avgSteps??"记录不足")+nl+"平均睡眠："+(d.avgSleep?d.avgSleep.toFixed(1)+"小时":"记录不足");
}
function renderReport(){
  const d=weekData(),box=$("#reportContent");
  if(!d.records.length){box.innerHTML='<div class="empty">完成第一次打卡后，这里会生成周报。</div>';renderChart([]);return}
  const trend=d.change==null?"待积累":(d.change>0?"+":"")+d.change.toFixed(1)+"kg";
  const weight=d.weights.at(-1)?.weight||state.profile.startWeight;
  const bmi=weight&&state.profile.height?weight/Math.pow(state.profile.height/100,2):null;
  const calorieTarget=Number(state.profile.calorieTarget);
  let suggestion=d.walk>=150?"本周步行量已达到150分钟基础目标。":"下周优先保证每天20～30分钟走路，不需要突然增加强度。";
  if(d.avgCalories&&calorieTarget){
    suggestion+=" 日均摄入"+d.avgCalories+" kcal，"+(d.avgCalories<=calorieTarget?"在你设定的目标范围内。":"高于设定目标，先检查饮料、零食和烹调油的记录是否完整。");
  }
  box.innerHTML='<div class="report-stats"><div class="report-stat"><strong>'+d.records.length+'/7</strong><span>打卡天数</span></div><div class="report-stat"><strong>'+trend+'</strong><span>体重变化</span></div><div class="report-stat"><strong>'+d.walk+'</strong><span>步行分钟</span></div><div class="report-stat"><strong>'+(d.avgCalories??"--")+'</strong><span>日均 kcal</span></div></div><section class="report-block"><h3>本周概况</h3><p>俯卧撑累计'+d.pushups+'个；'+(d.avgSteps?"日均"+d.avgSteps.toLocaleString()+"步；":"")+(d.avgSleep?"平均睡眠"+d.avgSleep.toFixed(1)+"小时；":"")+(bmi?"当前估算BMI为"+bmi.toFixed(1)+"。":"")+'</p></section><section class="report-block warn"><h3>下周建议</h3><p>'+suggestion+"</p></section>";
  renderChart(d.weights);
}
function renderRemaining(){
  const el=$("#coachRemain");if(!el)return;
  let walked,pushed;
  if($("#recordDate").value===today()){walked=Number($("#walkMinutes").value)||0;pushed=Number($("#pushups").value)||0}
  else{const r=state.records.find(x=>x.date===today());walked=Number(r?.walkMinutes)||0;pushed=Number(r?.pushups)||0}
  const left=[];
  const walkLeft=Math.max(0,coachTarget.walk-walked),pushLeft=Math.max(0,coachTarget.pushups-pushed);
  if(walkLeft>0)left.push("走路 "+walkLeft+" 分钟");
  if(pushLeft>0)left.push("俯卧撑 "+pushLeft+" 个");
  el.classList.toggle("done",!left.length);
  el.textContent=!coachTarget.walk?"":left.length?"今天还需要：" + left.join(" · "):"今天的运动目标已完成 ✓";
}
function refresh(){renderSummary();updateCalories();renderCoach();renderHistory();renderReport()}

$("#checkForm").addEventListener("submit",e=>{
  e.preventDefault();
  const record=collectRecord();
  const index=state.records.findIndex(r=>r.date===record.date);
  if(index>=0)state.records[index]=record;else state.records.push(record);
  saveState();refresh();flash($("#message"),"记录与热量已保存");
});
$("#recordDate").addEventListener("change",e=>fillRecord(e.target.value));
$$(".meal-cal").forEach(input=>input.addEventListener("input",updateCalories));
$$(".meal-entry textarea,#notes").forEach(el=>el.addEventListener("input",()=>autosize(el)));
["walkMinutes","pushups"].forEach(id=>$("#"+id).addEventListener("input",renderRemaining));
$("#profileForm").addEventListener("submit",e=>{
  e.preventDefault();
  state.profile={
    sex:$("#sex").value,age:num($("#age").value),height:num($("#height").value),
    startWeight:num($("#startWeight").value),targetWeight:num($("#targetWeight").value),
    availableMinutes:num($("#availableMinutes").value),calorieTarget:num($("#profileCalorieTarget").value),
    healthConfirmed:$("#healthConfirmed").checked
  };
  saveState();refresh();flash($("#profileMessage"),"个人资料已保存");
});
$("nav").addEventListener("click",e=>{
  const btn=e.target.closest("[data-view]");if(!btn)return;
  $$(".nav-btn").forEach(x=>x.classList.toggle("active",x===btn));
  $$(".view").forEach(v=>v.hidden=v.id!==btn.dataset.view);
  scrollTo({top:0,behavior:"smooth"});
  if(btn.dataset.view==="reportView")requestAnimationFrame(renderReport);
  if(btn.dataset.view==="todayView")requestAnimationFrame(autosizeAll);
});
$("#historyList").addEventListener("click",e=>{
  const btn=e.target.closest("[data-date]");if(!btn)return;
  if(btn.classList.contains("edit")){
    $("#recordDate").value=btn.dataset.date;fillRecord(btn.dataset.date);
    document.querySelector('[data-view="todayView"]').click();
  }else if(confirm("删除这一天的记录？")){
    state.records=state.records.filter(r=>r.date!==btn.dataset.date);saveState();refresh();
  }
});
$("#copyBtn").addEventListener("click",async()=>{
  const text=reportText(weekData());
  try{await navigator.clipboard.writeText(text);$("#copyBtn").textContent="已复制";setTimeout(()=>$("#copyBtn").textContent="复制报告",1500)}catch{alert(text)}
});
$("#exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="LSC备份-"+today()+".json";a.click();URL.revokeObjectURL(a.href);
});
$("#importInput").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!data.profile||typeof data.profile!=="object"||!Array.isArray(data.records))throw Error();
    const records=data.records.filter(r=>r&&typeof r==="object"&&/^\d{4}-\d{2}-\d{2}$/.test(r.date));
    state={profile:{...defaults.profile,...data.profile},records};saveState();fillProfile();fillRecord($("#recordDate").value);refresh();alert("备份已导入");
  }catch{alert("无法导入，请选择由LSC导出的JSON备份")}
  e.target.value="";
});
$("#clearBtn").addEventListener("click",()=>{
  if(!confirm("确认清空所有打卡记录？此操作无法撤销。"))return;
  state.records=[];saveState();fillRecord($("#recordDate").value);refresh();
});

// ---- AI 热量估算（Claude API）----
const API_KEY_STORAGE="lsc-anthropic-key",API_BASE_STORAGE="lsc-anthropic-base-url",API_PROVIDER_STORAGE="lsc-ai-provider";
const OPENAI_COMPAT={
  bailian:{base:"https://dashscope.aliyuncs.com/compatible-mode/v1",model:"qwen-plus",name:"百炼"},
  deepseek:{base:"https://api.deepseek.com",model:"deepseek-chat",name:"DeepSeek"},
  custom:{base:"",model:"",name:"自定义"}
};
const API_MODEL_STORAGE="lsc-ai-model";
const ESTIMATE_PROMPT="你是营养师，根据用户描述的一餐估算热量。按中国常见做法和份量估算；用户没写份量时按普通成年人一份估计，并在 amount 里写出你假设的份量。items 逐项列出食物，kcal 为整数，total_kcal 为各项之和。note 用一句中文简短说明估算依据或需注意的地方（如油、酱料、含糖饮料）。";
const aiProvider=()=>localStorage.getItem(API_PROVIDER_STORAGE)||"bailian";
const MEAL_NAMES={breakfast:"早餐",lunch:"午餐",dinner:"晚餐",snacks:"加餐"};
const ESTIMATE_SCHEMA={
  type:"object",
  properties:{
    items:{type:"array",items:{type:"object",properties:{name:{type:"string"},amount:{type:"string"},kcal:{type:"integer"}},required:["name","amount","kcal"],additionalProperties:false}},
    total_kcal:{type:"integer"},
    note:{type:"string"}
  },
  required:["items","total_kcal","note"],
  additionalProperties:false
};
let anthropicModule;
async function estimateOpenAICompat(apiKey,meal,text){
  const cfg=OPENAI_COMPAT[aiProvider()];
  const base=(localStorage.getItem(API_BASE_STORAGE)||cfg.base).replace(/[/]+$/,"");
  const model=localStorage.getItem(API_MODEL_STORAGE)||cfg.model;
  if(!base)throw Error("自定义服务商需要在「我的」页面填写 API 地址（例如 https://xxx/v1）");
  if(!model)throw Error("请在「我的」页面填写模型名（用你 Key 所在分组支持的模型）");
  const res=await fetch(base+"/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+apiKey},
    body:JSON.stringify({
      model,
      temperature:0.2,
      response_format:{type:"json_object"},
      messages:[
        {role:"system",content:ESTIMATE_PROMPT+"只输出 JSON，格式：{\"items\":[{\"name\":\"\",\"amount\":\"\",\"kcal\":0}],\"total_kcal\":0,\"note\":\"\"}"},
        {role:"user",content:MEAL_NAMES[meal]+"："+text}
      ]
    })
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok){const e=Error(data?.error?.message||"请求失败（"+res.status+"）");e.status=res.status;e.detail=data?.error?.message||"";throw e}
  const content=data?.choices?.[0]?.message?.content;
  if(!content)throw Error("没有拿到估算结果，请重试");
  let r;try{r=JSON.parse(content)}catch{throw Error("返回内容不是有效格式，请重试")}
  if(!Array.isArray(r.items)||!Number.isFinite(Number(r.total_kcal)))throw Error("返回内容不完整，请重试");
  r.total_kcal=Math.round(Number(r.total_kcal));
  return r;
}
async function estimateCalories(meal,text){
  const apiKey=localStorage.getItem(API_KEY_STORAGE);
  if(!apiKey)throw Error("请先在「我的」页面填入 API Key");
  if(aiProvider()in OPENAI_COMPAT)return estimateOpenAICompat(apiKey,meal,text);
  anthropicModule??=await import("https://esm.sh/@anthropic-ai/sdk@1.8.0");
  const Anthropic=anthropicModule.default;
  const baseURL=localStorage.getItem(API_BASE_STORAGE)||undefined;
  const client=new Anthropic({apiKey,baseURL,dangerouslyAllowBrowser:true});
  const response=await client.beta.messages.create({
    model:"claude-opus-5-5",
    max_tokens:2000,
    betas:["server-side-fallback-2026-07-01"],
    fallbacks:"default",
    output_config:{effort:"low",format:{type:"json_schema",schema:ESTIMATE_SCHEMA}},
    system:ESTIMATE_PROMPT,
    messages:[{role:"user",content:MEAL_NAMES[meal]+"："+text}]
  });
  if(response.stop_reason==="refusal")throw Error("这次请求被拒绝了，换个描述再试试");
  if(response.stop_reason==="max_tokens")throw Error("结果不完整，请把描述写简短一些再试");
  const block=response.content.find(b=>b.type==="text");
  if(!block)throw Error("没有拿到估算结果，请重试");
  return JSON.parse(block.text);
}
function apiErrorText(err){
  const status=err?.status;
  if(status===401)return"API Key 无效，请到「我的」页面检查";
  const detail=err?.detail||err?.error?.error?.message||err?.error?.message||"";
  const used=localStorage.getItem(API_BASE_STORAGE)||(OPENAI_COMPAT[aiProvider()]?OPENAI_COMPAT[aiProvider()].name+"默认地址":"官方地址 api.anthropic.com");
  if(status===403)return"请求被拒绝（403）。当前使用："+used+(detail?"。服务端返回："+detail:"")+"。若用的是官方地址，请在「我的」页面填写可用的 API 地址；若已填中转，请检查 Key 是否有权限";
  if(status===429)return"请求太频繁或额度不足，稍后再试";
  if(status>=500)return"AI 服务返回 "+status+"。当前使用："+used+"，服务商："+aiProvider()+(detail?"。服务端返回："+detail:"")+"。可稍后重试；若一直如此，可能是该地址不支持这种请求，请换服务商或地址再试";
  if(status===400||status===404)return"请求不被接受（"+status+"）。当前使用："+used+"，服务商："+aiProvider()+(detail?"。服务端返回："+detail:"")+"。请检查服务商与 API 地址是否匹配（Claude 只写域名，不带 /v1）";
  if(err instanceof TypeError||err?.name==="APIConnectionError")return"网络连接失败，请检查网络";
  return err?.message||"估算失败，请重试";
}
$$(".ai-btn").forEach(btn=>btn.addEventListener("click",async()=>{
  const meal=btn.dataset.meal,text=$("#"+meal).value.trim(),out=$("#"+meal+"Ai");
  out.classList.remove("error");
  if(!text){out.classList.add("error");out.textContent="先写下吃了什么，例如：一碗牛肉面加一个卤蛋";return}
  btn.disabled=true;btn.textContent="估算中…";out.textContent="";
  try{
    const r=await estimateCalories(meal,text);
    $("#"+meal+"Cal").value=r.total_kcal;updateCalories();
    out.innerHTML=r.items.map(i=>'<span class="ai-item"><span>'+safe(i.name)+'<em>'+safe(i.amount)+'</em></span><b>'+Number(i.kcal)+' kcal</b></span>').join("")+(r.note?'<span class="ai-note">'+safe(r.note)+"</span>":"");
  }catch(err){out.classList.add("error");out.textContent=apiErrorText(err)}
  finally{btn.disabled=false;btn.textContent="AI估算"}
}));
$("#apiKey").value=localStorage.getItem(API_KEY_STORAGE)||"";
$("#apiBase").value=localStorage.getItem(API_BASE_STORAGE)||"";
$("#aiProvider").value=aiProvider();
$("#aiModel").value=localStorage.getItem(API_MODEL_STORAGE)||"";
$("#saveKeyBtn").addEventListener("click",()=>{
  const key=$("#apiKey").value.trim();
  if(!key){flash($("#keyMessage"),"请输入 API Key");return}
  const base=$("#apiBase").value.trim().replace(/\/+$/,"");
  if(base&&!base.startsWith("https://")){flash($("#keyMessage"),"API 地址需以 https:// 开头");return}
  localStorage.setItem(API_KEY_STORAGE,key);localStorage.setItem(API_PROVIDER_STORAGE,$("#aiProvider").value);
  const model=$("#aiModel").value.trim();if(model)localStorage.setItem(API_MODEL_STORAGE,model);else localStorage.removeItem(API_MODEL_STORAGE);
  if(base)localStorage.setItem(API_BASE_STORAGE,base);else localStorage.removeItem(API_BASE_STORAGE);
  flash($("#keyMessage"),"AI 设置已保存在本机");
});
$("#clearKeyBtn").addEventListener("click",()=>{localStorage.removeItem(API_KEY_STORAGE);localStorage.removeItem(API_BASE_STORAGE);localStorage.removeItem(API_PROVIDER_STORAGE);localStorage.removeItem(API_MODEL_STORAGE);$("#aiModel").value="";$("#aiProvider").value="bailian";$("#apiKey").value="";$("#apiBase").value="";flash($("#keyMessage"),"AI 设置已清除")});

let installPrompt;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn").hidden=false});
$("#navAdd").addEventListener("click",()=>{
  if($("#todayView").hidden)document.querySelector('[data-view="todayView"]').click();
  setTimeout(()=>$("#checkForm").scrollIntoView({behavior:"smooth",block:"start"}),60);
});
$("#installBtn").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn").hidden=true});

const now=new Date();
$("#dateLabel").textContent=now.toLocaleDateString("zh-CN",{month:"long",day:"numeric",weekday:"long"});
$("#recordDate").value=today();
fillProfile();fillRecord(today());refresh();

// 快捷指令导入：index.html?steps=6200&walk=25&sleep=7.5&weight=80.5&water=1500
function importFromURL(){
  const q=new URLSearchParams(location.search);
  const limits={steps:[0,100000],walk:[0,600],sleep:[0,24],weight:[30,300],water:[0,10000],pushups:[0,1000]};
  const field={steps:"steps",walk:"walkMinutes",sleep:"sleep",weight:"weight",water:"water",pushups:"pushups"};
  const values={};
  for(const key of Object.keys(limits)){
    if(!q.has(key)||q.get(key)==="")continue;
    const v=Number(q.get(key));
    if(Number.isFinite(v)&&v>=limits[key][0]&&v<=limits[key][1])values[field[key]]=v;
  }
  if(!Object.keys(values).length)return;
  const date=today();
  const old=state.records.find(r=>r.date===date)||{date,condition:"good",notes:""};
  const record={...old,...values,updatedAt:new Date().toISOString()};
  record.totalCalories=mealCalories(record);
  const i=state.records.findIndex(r=>r.date===date);
  if(i>=0)state.records[i]=record;else state.records.push(record);
  saveState();history.replaceState(null,"",location.pathname);
  $("#recordDate").value=date;fillRecord(date);refresh();
  flash($("#message"),"已从手机导入："+Object.keys(values).length+" 项数据");
}
importFromURL();
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});

