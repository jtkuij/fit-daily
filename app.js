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
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function sorted(dir="desc"){return [...state.records].sort((a,b)=>dir==="desc"?b.date.localeCompare(a.date):a.date.localeCompare(b.date))}
function flash(el,text){el.textContent=text;setTimeout(()=>{if(el.textContent===text)el.textContent=""},2200)}
function mealCalories(r){return Number(r.totalCalories)||(Number(r.breakfastCal)||0)+(Number(r.lunchCal)||0)+(Number(r.dinnerCal)||0)+(Number(r.snacksCal)||0)}

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
  let cursor=new Date(dates[0]+"T12:00:00"),count=0;
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
  $("#weightChange").style.color=change!==null&&change<=0?"#ce6a55":"#b95d4a";
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
  $("#coachPlans").innerHTML=plans.map(p=>'<div class="plan"><b>'+p[0]+'</b><span>'+p[1]+"</span></div>").join("");
}

function renderHistory(){
  const all=sorted(),list=$("#historyList");
  if(!all.length){list.innerHTML='<div class="empty">还没有记录，从今天开始就好。</div>';return}
  const feelings={good:"状态不错",tired:"有点累",pain:"身体疼痛"};
  list.innerHTML=all.map(r=>{
    const meals=[[r.breakfast,"早餐",r.breakfastCal],[r.lunch,"午餐",r.lunchCal],[r.dinner,"晚餐",r.dinnerCal],[r.snacks,"加餐",r.snacksCal]]
      .filter(x=>x[0]).map(x=>x[1]+"："+safe(x[0])+(x[2]!=null?"（"+x[2]+" kcal）":"")).join("<br>");
    return '<article class="history-item"><div class="history-top"><span>'+dateText(r.date)+'</span><strong>'+(r.weight?Number(r.weight).toFixed(1)+" kg":"未记体重")+'</strong></div><div class="chips"><span>走路 '+(r.walkMinutes||0)+' 分钟</span><span>俯卧撑 '+(r.pushups||0)+' 个</span><span>摄入 '+mealCalories(r)+' kcal</span><span>'+(feelings[r.condition]||"状态未记")+'</span></div>'+(meals?'<p class="meals">'+meals+"</p>":"")+(r.notes?'<p class="meals">备注：'+safe(r.notes)+"</p>":"")+'<div class="history-actions"><button class="text-btn edit" data-date="'+r.date+'">编辑</button><button class="text-btn delete" data-date="'+r.date+'">删除</button></div></article>';
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
  if(weights.length<2){svg.innerHTML='<text x="165" y="82" text-anchor="middle" fill="#7d6f6a" font-size="11">记录至少两次体重后显示趋势</text>';return}
  const values=weights.map(r=>Number(r.weight));
  let min=Math.min(...values),max=Math.max(...values);
  if(max-min<1){min-=.5;max+=.5}
  const left=35,right=320,top=20,bottom=130;
  const points=weights.map((r,i)=>({x:left+i*(right-left)/(weights.length-1),y:top+(max-r.weight)*(bottom-top)/(max-min),r}));
  let html='<g stroke="#eadfda"><path d="M35 20H320M35 75H320M35 130H320"/></g>';
  html+='<polyline points="'+points.map(p=>p.x+","+p.y).join(" ")+'" fill="none" stroke="#ce6a55" stroke-width="4"/>';
  html+='<g fill="#ce6a55">'+points.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="4"/>').join("")+"</g>";
  html+='<g fill="#7d6f6a" font-size="9"><text x="3" y="24">'+max.toFixed(1)+'</text><text x="3" y="79">'+((max+min)/2).toFixed(1)+'</text><text x="3" y="134">'+min.toFixed(1)+'</text>';
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
    if(!data.profile||!Array.isArray(data.records))throw Error();
    state={profile:{...defaults.profile,...data.profile},records:data.records};saveState();fillProfile();fillRecord($("#recordDate").value);refresh();alert("备份已导入");
  }catch{alert("无法导入，请选择由LSC导出的JSON备份")}
  e.target.value="";
});
$("#clearBtn").addEventListener("click",()=>{
  if(!confirm("确认清空所有打卡记录？此操作无法撤销。"))return;
  state.records=[];saveState();fillRecord($("#recordDate").value);refresh();
});

let installPrompt;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("#installBtn").hidden=false});
$("#installBtn").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#installBtn").hidden=true});

const now=new Date();
$("#dateLabel").textContent=now.toLocaleDateString("zh-CN",{month:"long",day:"numeric",weekday:"long"});
$("#recordDate").value=today();
fillProfile();fillRecord(today());refresh();
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});

