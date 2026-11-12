"use strict";
const API="https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const CORE="https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba";
const SEARCH="https://site.web.api.espn.com/apis/search/v2";
const $=id=>document.getElementById(id);
const state={teams:[],picked:[null,null]};
const safe=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function getJSON(url){const r=await fetch(url,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error("Data provider returned HTTP "+r.status);return r.json()}
function setConnection(ok,msg){$("connection").textContent=msg;$("connection").previousElementSibling.style.background=ok?"var(--green)":"var(--red)"}
function showError(id,msg){$(id).innerHTML='<div class="error">'+safe(msg)+'</div>'}
function statVal(obj,keys){for(const k of keys){if(obj&&obj[k]!=null)return obj[k]}return "—"}
function teamName(t){return t?.displayName||t?.name||"Team"}
function eventStatus(e){return e?.status?.type?.shortDetail||e?.status?.type?.description||"Scheduled"}
async function loadScores(){
 $("scores").innerHTML='<div class="loading">Refreshing scoreboard…</div>';$("scoreError").innerHTML="";
 try{
  const data=await getJSON(API+"/scoreboard");
  const events=data.events||[];
  $("scores").innerHTML=events.length?events.map(e=>{
   const c=e.competitions?.[0], comps=c?.competitors||[],home=comps.find(x=>x.homeAway==="home")||comps[0],away=comps.find(x=>x.homeAway==="away")||comps[1],live=e.status?.type?.state==="in";
   return '<div class="game"><div class="game-top"><span>'+safe(eventStatus(e))+'</span><span class="'+(live?'tag live':'tag')+'">'+(live?'LIVE':'NBA')+'</span></div><div class="teamrow"><span>'+safe(teamName(away?.team))+'</span><strong>'+safe(away?.score??"—")+'</strong></div><div class="teamrow"><span>'+safe(teamName(home?.team))+'</span><strong>'+safe(home?.score??"—")+'</strong></div><div class="game-foot">'+safe(c?.date?new Date(c.date).toLocaleString():"Game date unavailable")+'</div></div>'
  }).join(""):'<div class="placeholder" style="grid-column:1/-1">No games listed for today. Check back on a game day.</div>';
  setConnection(true,"Connected");$("updated").textContent="Last checked: "+new Date().toLocaleTimeString();
 }catch(e){$("scores").innerHTML='<div class="placeholder" style="grid-column:1/-1">Could not load the scoreboard.</div>';showError("scoreError",e.message+" — Check your connection and try again.");setConnection(false,"Unavailable")}
}
// Favorite teams are stored in this browser with localStorage.
const FAVORITES_KEY = "nbaStatChecker.favoriteTeams";

function getFavoriteTeams(){
 try{
  const saved=localStorage.getItem(FAVORITES_KEY);
  const parsed=saved?JSON.parse(saved):[];
  return Array.isArray(parsed)?parsed.filter(x=>x&&typeof x.id==="string"&&typeof x.name==="string"):[];
 }catch(error){return [];}
}
function saveFavoriteTeams(favorites){
 try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites));return true;}
 catch(error){return false;}
}
function toggleFavoriteTeam(team){
 const favorites=getFavoriteTeams();
 const exists=favorites.some(f=>f.id===team.id);
 const updated=exists?favorites.filter(f=>f.id!==team.id):[...favorites,team];
 if(!saveFavoriteTeams(updated)){alert("Your browser could not save favorites. Check its storage settings.");return;}
 renderFavoriteTeams();
 const button=$("favoriteToggle");
 if(button)button.textContent=exists?"☆ Save team":"★ Saved";
}
function renderFavoriteTeams(){
 const box=$("favoriteTeams");
 if(!box)return;
 const favorites=getFavoriteTeams();
 if(!favorites.length){
  box.innerHTML='<p class="tiny">No favorite teams saved yet. Open a team and select “Save team.”</p>';
  return;
 }
 box.innerHTML=favorites.map(team=>'<div class="result"><button type="button" data-favorite-id="'+safe(team.id)+'">'+safe(team.name)+'</button><button type="button" class="remove-favorite" data-remove-id="'+safe(team.id)+'" aria-label="Remove '+safe(team.name)+' from favorites">Remove</button></div>').join("");
 box.querySelectorAll("[data-favorite-id]").forEach(button=>button.addEventListener("click",()=>loadTeam(button.dataset.favoriteId,"teamProfile")));
 box.querySelectorAll("[data-remove-id]").forEach(button=>button.addEventListener("click",()=>{
  saveFavoriteTeams(getFavoriteTeams().filter(team=>team.id!==button.dataset.removeId));
  renderFavoriteTeams();
 }));
}

async function loadTeams(){
 try{
  const d=await getJSON(API+"/teams?limit=50");state.teams=d.sports?.[0]?.leagues?.[0]?.teams?.map(x=>x.team)||[];
  for(const id of ["teamSelect","teamQuick"]){const s=$(id);state.teams.forEach(t=>{const o=document.createElement("option");o.value=t.id;o.textContent=t.displayName||t.name;s.appendChild(o)})}
 }catch(e){setConnection(false,"Partial data");}
}
async function searchPlayers(q,target){
 const box=$(target);box.innerHTML='<div class="loading">Searching…</div>';
 if(!q.trim()){box.innerHTML='<p class="tiny">Enter a player name first.</p>';return}
 try{
  const d=await getJSON(SEARCH+"?query="+encodeURIComponent(q)+"&sport=basketball&league=nba&limit=20");
  let items=[];
  const groups=d.results||[];
  for(const group of groups){
   const contents=group.contents||group.items||[];
   for(const item of contents){
    const candidate=item.athlete||item;
    if(candidate.id&&(candidate.displayName||candidate.fullName||candidate.name)&&(!item.type||String(item.type).toLowerCase().includes("athlete")||candidate.position))items.push(candidate);
   }
  }
  if(!items.length){items=(d.items||d.athletes||[]).map(x=>x.athlete||x).filter(x=>x.id&&(x.displayName||x.fullName||x.name))}
  if(!items.length){box.innerHTML='<div class="placeholder">No matching players found. Try a different spelling.</div>';return}
  box.innerHTML=items.slice(0,12).map(p=>'<div class="result"><button data-player="'+safe(p.id)+'" data-name="'+safe(p.displayName||p.fullName||p.name)+'">'+safe(p.displayName||p.fullName||p.name)+'</button><span class="tiny">'+safe(p.position?.abbreviation||p.position||"NBA player")+'</span></div>').join("");
  box.querySelectorAll("[data-player]").forEach(b=>b.addEventListener("click",()=>loadPlayer(b.dataset.player,b.dataset.name,target==="playerResults"?"playerProfile":target==="dashPlayerResults"?"dashPlayerResults":null)));
 }catch(e){box.innerHTML='<div class="error">Player search is unavailable from the data provider right now. Try again shortly.</div>'}
}
function renderStats(stats){
 const list=Array.isArray(stats)?stats:(stats?.splits?.categories||stats?.categories||[]);
 let flat=[];
 for(const cat of list){
  if(Array.isArray(cat.stats)){for(const s of cat.stats){flat.push({name:s.displayName||s.name||s.abbreviation,value:s.displayValue??s.value??"—"})}}
  if(Array.isArray(cat.labels)&&Array.isArray(cat.totals)){cat.labels.forEach((label,i)=>flat.push({name:label,value:cat.totals[i]??"—"}))}
 }
 if(!flat.length&&stats?.statistics?.names){stats.statistics.names.forEach((name,i)=>flat.push({name,value:stats.statistics.displayValues?.[i]??stats.statistics.values?.[i]??"—"}))}
 if(!flat.length)return '<div class="placeholder">The provider did not return a season stat line for this player.</div>';
 const wanted=["Points Per Game","Rebounds Per Game","Assists Per Game","Steals Per Game","Blocks Per Game","Field Goal Percentage","Three Point Field Goal Percentage","Free Throw Percentage"];
 const chosen=wanted.map(w=>flat.find(x=>x.name.toLowerCase()===w.toLowerCase())).filter(Boolean);
 const show=(chosen.length?chosen:flat).slice(0,12);
 return '<div class="stats">'+show.map(s=>'<div class="stat"><b>'+safe(s.value)+'</b><span>'+safe(s.name)+'</span></div>').join("")+'</div>';
}
async function loadPlayer(id,name,profileId){
 const target=profileId||"playerProfile";$(target).innerHTML='<div class="loading">Loading '+safe(name)+'…</div>';
 try{
  const [bio,stats]=await Promise.allSettled([getJSON(CORE+"/athletes/"+encodeURIComponent(id)+"/overview"),getJSON(CORE+"/athletes/"+encodeURIComponent(id)+"/stats")]);
  const a=bio.status==="fulfilled"?(bio.value.athlete||bio.value):{};
  const statData=stats.status==="fulfilled"?stats.value:(bio.status==="fulfilled"?bio.value:null);
  const details='<div class="cardhead"><div><h2>'+safe(a.displayName||name)+'</h2><div class="tiny">'+safe(a.position?.displayName||a.position||"NBA player")+(a.team?.displayName?" · "+safe(a.team.displayName):"")+'</div></div><span class="tag">PLAYER PROFILE</span></div>';
  const statsHtml=statData?renderStats(statData):'<div class="placeholder">Player profile loaded, but season statistics were not available from the provider.</div>';
  $(target).innerHTML=details+statsHtml+(stats.status==="rejected"?'<p class="tiny">Statistics endpoint did not respond. You can still search another player.</p>':"");
  if(target==="dashPlayerResults")$(target).insertAdjacentHTML("beforeend",'<p class="tiny">Profile displayed above the search results.</p>');
 }catch(e){$(target).innerHTML='<div class="error">Could not load this player profile. Please try again.</div>'}
}
async function loadTeam(id,target){
 const t=state.teams.find(x=>String(x.id)===String(id));if(!t)return;
 $(target).innerHTML='<div class="loading">Loading team information…</div>';
 try{
  const [info,stats]=await Promise.allSettled([getJSON(API+"/teams/"+encodeURIComponent(id)),getJSON(API+"/teams/"+encodeURIComponent(id)+"/statistics")]);
  const d=info.status==="fulfilled"?(info.value.team||info.value):t;
  const s=stats.status==="fulfilled"?stats.value:null;
  const teamTitle=d.displayName||teamName(t);
  const isFavorite=getFavoriteTeams().some(f=>String(f.id)===String(id));
  $(target).innerHTML='<div class="cardhead"><div><h2>'+safe(teamTitle)+'</h2><div class="tiny">'+safe(d.location||"NBA")+' · '+safe(d.abbreviation||"")+'</div></div><button class="btn secondary" id="favoriteToggle" type="button">'+(isFavorite?'★ Saved':'☆ Save team')+'</button></div>'+(s?renderStats(s):'<div class="placeholder">Team profile loaded. Team statistics are not available from this endpoint right now.</div>');
  const favoriteButton=$("favoriteToggle");
  if(favoriteButton)favoriteButton.addEventListener("click",()=>toggleFavoriteTeam({id:String(id),name:teamTitle}));
  renderFavoriteTeams();
 }catch(e){$(target).innerHTML='<div class="error">Could not load team information.</div>'}
}
function wireSearch(input,button,target){$(button).addEventListener("click",()=>searchPlayers($(input).value,target));$(input).addEventListener("keydown",e=>{if(e.key==="Enter")searchPlayers($(input).value,target)})}
function pickPlayer(slot,id,name){
 state.picked[slot]={id,name};$("comparePick"+(slot+1)).textContent="Selected: "+name;
 if(state.picked.every(Boolean))comparePlayers();
}
async function comparePlayers(){
 $("comparison").innerHTML='<div class="loading">Loading comparison…</div>';
 try{
  const results=await Promise.all(state.picked.map(p=>getJSON(CORE+"/athletes/"+encodeURIComponent(p.id)+"/stats")));
  const extract=d=>{let out={};const cats=d.categories||d.splits?.categories||[];cats.forEach(c=>{if(Array.isArray(c.stats))c.stats.forEach(s=>out[(s.displayName||s.name||"").toLowerCase()]=s.displayValue??s.value);if(Array.isArray(c.labels)&&Array.isArray(c.totals))c.labels.forEach((label,i)=>out[label.toLowerCase()]=c.totals[i]);});return out};
  const a=extract(results[0]),b=extract(results[1]),keys=["points per game","rebounds per game","assists per game","steals per game","blocks per game","field goal percentage","three point field goal percentage","free throw percentage"];
  $("comparison").innerHTML='<div class="tablewrap"><table><thead><tr><th>Statistic</th><th class="num">'+safe(state.picked[0].name)+'</th><th class="num">'+safe(state.picked[1].name)+'</th></tr></thead><tbody>'+keys.map(k=>'<tr><td>'+safe(k.replace(/\b\w/g,x=>x.toUpperCase()))+'</td><td class="num">'+safe(a[k]??"—")+'</td><td class="num">'+safe(b[k]??"—")+'</td></tr>').join("")+'</tbody></table></div>';
 }catch(e){$("comparison").innerHTML='<div class="error">Could not retrieve one or both stat lines. The provider may not expose comparison data for these players.</div>'}
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".page").forEach(p=>p.classList.toggle("hidden",p.id!==b.dataset.tab))}));
$("refreshScores").addEventListener("click",loadScores);
wireSearch("dashPlayerSearch","dashPlayerGo","dashPlayerResults");
wireSearch("playerSearch","playerGo","playerResults");
$("teamGo").addEventListener("click",()=>loadTeam($("teamSelect").value,"teamProfile"));
$("teamQuick").addEventListener("change",()=>loadTeam($("teamQuick").value,"teamQuickInfo"));
[1,2].forEach(n=>{$("compareGo"+n).addEventListener("click",async()=>{
 const slot=n-1,box=$("compareResults"+n),q=$("compareSearch"+n).value;
 await searchPlayers(q,"compareResults"+n);
 box.querySelectorAll("[data-player]").forEach(b=>b.addEventListener("click",()=>pickPlayer(slot,b.dataset.player,b.dataset.name)));
});$("compareSearch"+n).addEventListener("keydown",e=>{if(e.key==="Enter")$("compareGo"+n).click()})});
loadScores();loadTeams();setInterval(loadScores,60000);
