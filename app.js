const ASSETS = {};

const state = {view:"painel", head:"", reg:"", nivel:"", ramp:"", tempo:"", sort:"pac", dir:-1};
const el = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const brlM = v => "R$ " + (v/1e6).toLocaleString("pt-BR",{maximumFractionDigits:2}) + "M";

function trava(g){
  if(g.final === "B") return g.pac >= 60 ? [] : ["PAC ≥60 p/ A"];
  const f = [];
  if(g.rec_nivel !== "A" && g.rec_nivel !== "B") f.push("R6");
  if(g.pac_nivel !== "A" && g.pac_nivel !== "B") f.push("PAC");
  if(g.churn == null || g.churn > 20) f.push("Churn");
  if(g.crc_nivel !== "A" && g.crc_nivel !== "B") f.push("CRC");
  if(g.mb_nivel !== "A" && g.mb_nivel !== "B") f.push("Score MB");
  return f;
}
function filtered(){
  return GCS.filter(g => {
    if(state.head && g.head !== state.head) return false;
    if(state.reg && g.regional !== state.reg) return false;
    if(state.nivel && g.final !== state.nivel) return false;
    if(state.ramp && (!g.rampagem || g.rampagem.status !== state.ramp)) return false;
    if(state.tempo){
      const m = g.meses_casa; if(m == null) return false;
      const [a,b] = state.tempo.split("-").map(Number);
      if(m < a || m > b) return false;
    }
    return true;
  }).map(g => ({...g, _trava: trava(g)}));
}
function kpisHtml(list){
  const n = list.length||1;
  const b = list.filter(g=>g.final==="B").length;
  const rA = list.filter(g=>g.rampagem&&g.rampagem.status==="ativa").length;
  const rV = list.filter(g=>g.rampagem&&g.rampagem.status==="vencida").length;
  const chA = list.filter(g=>g.churn!=null&&g.churn>20).length;
  const crcLive = list.reduce((a,g)=>a+((g.crc_ploomes||{}).mes_atual||0),0);
  return `
    <div class="kpi"><div class="t">GCs no filtro</div><div class="v">${list.length}</div><div class="d">de 47 consolidados</div></div>
    <div class="kpi"><div class="t">Nível B</div><div class="v">${b}</div><div class="d">título até janeiro</div></div>
    <div class="kpi o"><div class="t">Rampagem ativa</div><div class="v">${rA}</div><div class="d">&lt; 6 meses de casa</div></div>
    <div class="kpi r"><div class="t">Rampagem vencida</div><div class="v">${rV}</div><div class="d">6+ meses no D</div></div>
    <div class="kpi"><div class="t">Churn 6M &gt; 20%</div><div class="v" style="color:var(--lev-red)">${chA}</div><div class="d">${(chA/n*100).toFixed(0)}% do filtro</div></div>
    <div class="kpi g"><div class="t">CRC ao vivo (Ploomes)</div><div class="v" style="font-size:17px">${brlM(crcLive)}</div><div class="d">mês corrente · sync diário</div></div>`;
}
function chartNiveis(list){
  const c = {D:0,C:0,B:0};
  list.forEach(g=>{ if(c[g.final]!==undefined) c[g.final]++; });
  const tot = Math.max(list.length,1);
  const cores = {D:"linear-gradient(90deg,#A63A50,#8E2D5B)",C:"linear-gradient(90deg,#8E2D5B,#5B2D8E)",B:"linear-gradient(90deg,#5B2D8E,#3E1E63)"};
  return ["B","C","D"].map(nv=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
      <div style="width:26px;font-weight:700;color:var(--lev-purple-d)">${nv}</div>
      <div class="bar" style="flex:1;height:22px;border-radius:6px">
        <i style="width:${c[nv]/tot*100}%;background:${cores[nv]};border-radius:6px"></i>
        <span style="position:absolute;left:10px;top:3px;color:#fff;font-size:11px;font-weight:700">${c[nv]}</span>
      </div></div>`).join("");
}
function chartRamp(list){
  const ds = list.filter(g=>g.final==="D");
  const ativa = ds.filter(g=>g.rampagem&&g.rampagem.status==="ativa");
  const venc = ds.filter(g=>g.rampagem&&g.rampagem.status==="vencida");
  const tot = Math.max(ds.length,1);
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
      <div style="width:110px;font-size:12px;font-weight:600;color:var(--lev-purple-d)">Ativa (&lt;6m)</div>
      <div class="bar" style="flex:1;height:20px;border-radius:6px"><i style="width:${ativa.length/tot*100}%;background:linear-gradient(90deg,#E8913D,#B87333);border-radius:6px"></i>
      <span style="position:absolute;left:10px;top:2px;color:#fff;font-size:11px;font-weight:700">${ativa.length}</span></div></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
      <div style="width:110px;font-size:12px;font-weight:600;color:var(--lev-purple-d)">Vencida (6m+)</div>
      <div class="bar" style="flex:1;height:20px;border-radius:6px"><i style="width:${venc.length/tot*100}%;background:linear-gradient(90deg,#A63A50,#8E2D5B);border-radius:6px"></i>
      <span style="position:absolute;left:10px;top:2px;color:#fff;font-size:11px;font-weight:700">${venc.length}</span></div></div>
    <div class="mini" style="margin-top:8px"><b>Ativa:</b> ${ativa.map(g=>esc(g.nome.split(" ")[0])+" ("+g.meses_casa+"m)").join(", ")||"—"}<br>
    <b>Vencida há mais tempo:</b> ${venc.slice().sort((a,b)=>b.meses_casa-a.meses_casa).slice(0,5).map(g=>esc(g.nome.split(" ")[0])+" ("+Math.floor(g.meses_casa/12)+"a"+g.meses_casa%12+"m)").join(", ")||"—"}</div>`;
}
function critCell(g){
  const cls = x => x==="A"?"cA":x==="B"?"cB":x==="C"?"cC":x==="D"?"cD":"cN";
  return ["rec_nivel","pac_nivel","churn","crc_nivel","mb_nivel"].map((k,i)=>{
    if(k==="churn"){
      const v = g.churn==null?"—":g.churn.toFixed(0)+"%";
      const c = g.churn==null?"cN":g.churn<=20?"cA":"cD";
      return `<span class="crit ${c}" title="Churn 6M">${v}</span>`;
    }
    return `<span class="crit ${cls(g[k])}" title="${["Recorrência","PAC","Churn","CRC","Score MB"][i]}">${g[k]??"—"}</span>`;
  }).join("");
}
function rampCell(g){
  const r = g.rampagem||{status:"na"};
  if(r.status==="ativa") return `<span class="ramp ativa">M${r.mes} · ${r.meta}</span>`;
  if(r.status==="vencida") return `<span class="ramp vencida">vencida · ${Math.floor(r.meses/12)}a${r.meses%12}m</span>`;
  return `<span class="ramp na">—</span>`;
}
function sortList(list){
  const k = state.sort;
  return list.slice().sort((a,b)=>{
    let va=a[k], vb=b[k];
    if(k==="trava"){va=a._trava.length;vb=b._trava.length}
    if(k==="ramp"){va=(a.rampagem?.status==="ativa"?0:a.rampagem?.status==="vencida"?a.meses_casa:999);vb=(b.rampagem?.status==="ativa"?0:b.rampagem?.status==="vencida"?b.meses_casa:999)}
    if(k==="crc_live"){va=(a.crc_ploomes||{}).mes_atual||0;vb=(b.crc_ploomes||{}).mes_atual||0}
    if(k==="farol"){va=a.farol||"zz";vb=b.farol||"zz"}
    if(typeof va==="string"||typeof vb==="string") return state.dir*String(va).localeCompare(String(vb));
    va=va==null?1e9:va; vb=vb==null?1e9:vb;
    return state.dir*(va-vb);
  });
}
function viewPainel(){
  const list = filtered();
  return `
  <div class="rule"><b>Rampagem (nível D):</b> metas progressivas M1: 5 cadastros · M2: 10 · M3: 15 · M4: 18 · M5: 22 · M6: 25 positivações. A coluna <b>CRC (Ploomes)</b> vem direto da API, sincronizada diariamente — é a produção do mês corrente por carteira.</div>
  <div class="kpis">${kpisHtml(list)}</div>
  <div class="grid">
    <div class="panel"><h3>Posição final dos GCs</h3><div class="ps">título vigente até a janela de janeiro</div>${chartNiveis(list)}</div>
    <div class="panel"><h3>Rampagem — dentro e vencidos</h3><div class="ps">nível D por tempo de casa</div>${chartRamp(list)}</div>
  </div>
  <div class="panel">
    <div class="sort" id="sortBtns"></div>
    <table><thead><tr>
      <th data-k="nome">Gerente Comercial</th><th data-k="final">Posição</th>
      <th>REC · PAC · CHURN · CRC · MB</th><th data-k="meses_casa">Casa</th>
      <th data-k="ramp">Rampagem</th><th data-k="pac">PAC</th><th data-k="r6">R6</th>
      <th data-k="churn">Churn 6M</th><th data-k="farol">Farol MB</th>
      <th data-k="crc_live">CRC (Ploomes)</th><th data-k="trava">Trava p/ subir</th>
    </tr></thead><tbody>
    ${sortList(list).map(g=>`
      <tr class="${g.final==='D'&&g.rampagem&&g.rampagem.status==='vencida'&&g.pac>=40?'hl':''}">
        <td><b>${esc(g.nome)}</b><div class="mini">${esc(g.cargo)} · ${esc(g.regional)}</div></td>
        <td><span class="bdg nv${g.final}">${g.final}</span></td>
        <td>${critCell(g)}</td>
        <td class="num">${g.meses_casa!=null?g.meses_casa+"m":"—"}</td>
        <td>${rampCell(g)}</td>
        <td class="num"><b>${g.pac.toFixed(0)}</b></td>
        <td class="num"><div class="bar ${g.r6<50?'hot':''}"><i style="width:${Math.min(g.r6||0,100)}%"></i></div><div class="mini num">${g.r6!=null?g.r6.toFixed(0)+"%":"—"}</div></td>
        <td class="num" style="color:${g.churn>20?'var(--lev-red)':'inherit'}">${g.churn!=null?g.churn.toFixed(0)+"%":"—"}</td>
        <td>${g.farol?`<span class="bdg f${g.farol}">${g.farol}</span>`:`<span class="bdg fNa">—</span>`}</td>
        <td class="num">${g.crc_ploomes?brlM(g.crc_ploomes.mes_atual):"—"}</td>
        <td>${g._trava.length?g._trava.map(t=>`<span class="gap">${t}</span>`).join(" · "):`<span class="gap ok">✓</span>`}</td>
      </tr>`).join("")}
    </tbody></table>
  </div>`;
}
function bonusRow(g, cls){
  const linhas = g.bonus.linhas.map(l=>{
    const st = l[3]===true?"ok":l[3]===false?"no":"id";
    const ic = l[3]===true?"✓":l[3]===false?"✕":"?";
    return `<div class="blin"><span class="st ${st}">${ic}</span><b>${l[0]}</b> — ${l[2]}</div>`;
  }).join("");
  return `<tr><td style="width:26%">
    <b>${esc(g.nome)}</b>
    <div class="mini">${esc(g.cargo)} · nível ${g.final} · alvo ${g.bonus.alvo}</div></td>
    <td>${linhas}</td>
    <td class="num"><span class="bdg ${cls==="ok"?"bok":cls==="no"?"bno":"bind"}">${g.bonus.bonus}</span></td></tr>`;
}
function viewBonus(){
  const list = filtered();
  const allTrue = g=>g.bonus.linhas.length && g.bonus.linhas.every(l=>l[3]===true);
  const hasFalse = g=>g.bonus.linhas.some(l=>l[3]===false);
  const ok = list.filter(allTrue);
  const no = list.filter(hasFalse);
  const ind = list.filter(g=>g.bonus.linhas.length && !allTrue(g) && !hasFalse(g));
  return `
  <div class="rule"><b>Bônus de performance (mensal)</b> — critérios por nível, conforme a Política de Progressão: <b>D</b> rampagem (meta do mês) ou critérios do C se rampagem vencida · <b>C</b> crescimento de PAC + produção mínima 15% + churn &lt;20% · <b>B</b> PAC &gt; 50 <i>ou</i> margem verde B + PAC ≥ 45 · <b>A</b> PAC ≥ 70. Valores: D/C = R$ 1.000 · B/A = R$ 500.</div>
  <div class="kpis">
    <div class="kpi g"><div class="t">Atingiram</div><div class="v" style="color:var(--green)">${ok.length}</div><div class="d">bônus no mês</div></div>
    <div class="kpi r"><div class="t">Não atingiram</div><div class="v" style="color:var(--lev-red)">${no.length}</div><div class="d">critério pendente</div></div>
    <div class="kpi o"><div class="t">Sem dados suficientes</div><div class="v">${ind.length}</div><div class="d">criterios abertos</div></div>
    <div class="kpi"><div class="t">No filtro</div><div class="v">${list.length}</div><div class="d">GCs</div></div>
  </div>
  <div class="panel"><h3>✅ Atingiram o bônus</h3><div class="ps">todos os critérios do nível cumpridos no mês</div>
    <table class="btab"><tbody>
    ${ok.map(g=>bonusRow(g,"ok")).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>
  <div class="panel" style="margin-top:14px"><h3>⛔ Não atingiram</h3><div class="ps">critério em vermelho = pendência do mês</div>
    <table class="btab"><tbody>
    ${no.map(g=>bonusRow(g,"no")).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>
  ${ind.length?`<div class="panel" style="margin-top:14px"><h3>⏳ Critérios em aberto</h3><div class="ps">dependem de dados que a apuração ainda não fechou</div>
    <table class="btab"><tbody>${ind.map(g=>bonusRow(g,"id")).join("")}</tbody></table></div>`:""}`;
}
const TITLES = {
  painel: ["Painel Geral — PPC Lev","Posição consolidada (jan/jul) · PAC e R6 do último mês · CRC, Churn e Score MB na média 6M · CRC ao vivo direto do Ploomes"],
  bonus: ["Acompanhamento de Bônus de Performance","Quem atingiu e quem não atingiu os critérios do mês, por nível — conforme a Política de Progressão Comercial"]
};
function renderFiltros(){
  const heads = [...new Set(GCS.map(g=>g.head))].filter(Boolean).sort();
  const regs = [...new Set(GCS.filter(g=>!state.head||g.head===state.head).map(g=>g.regional))].filter(Boolean).sort();
  el("filtros").innerHTML = `
    <div class="f"><label>Head</label><select id="fhead"><option value="">Todos</option>${heads.map(s=>`<option ${s===state.head?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
    <div class="f"><label>Regional</label><select id="freg"><option value="">Todas</option>${regs.map(s=>`<option ${s===state.reg?"selected":""}>${esc(s)}</option>`).join("")}</select></div>
    <div class="f"><label>Posição</label><select id="fnivel"><option value="">Todas</option><option ${state.nivel==="D"?"selected":""}>D</option><option ${state.nivel==="C"?"selected":""}>C</option><option ${state.nivel==="B"?"selected":""}>B</option></select></div>
    <div class="f"><label>Tempo de casa</label><select id="ftempo"><option value="">Todos</option>
      <option value="0-6" ${state.tempo==="0-6"?"selected":""}>0–6 meses</option>
      <option value="6-12" ${state.tempo==="6-12"?"selected":""}>6–12 meses</option>
      <option value="12-24" ${state.tempo==="12-24"?"selected":""}>1–2 anos</option>
      <option value="24-36" ${state.tempo==="24-36"?"selected":""}>2–3 anos</option>
      <option value="36-9999" ${state.tempo==="36-9999"?"selected":""}>2+ anos</option></select></div>
    <div class="f"><label>Rampagem</label><select id="framp"><option value="">Todas</option><option value="ativa" ${state.ramp==="ativa"?"selected":""}>Ativa</option><option value="vencida" ${state.ramp==="vencida"?"selected":""}>Vencida</option></select></div>
    <span class="tag" id="tagCount">${filtered().length} GCs</span>`;
  el("fhead").addEventListener("change",e=>{state.head=e.target.value;state.reg="";render()});
  el("freg").addEventListener("change",e=>{state.reg=e.target.value;render()});
  el("fnivel").addEventListener("change",e=>{state.nivel=e.target.value;render()});
  el("ftempo").addEventListener("change",e=>{state.tempo=e.target.value;render()});
  el("framp").addEventListener("change",e=>{state.ramp=e.target.value;render()});
}
function render(){
  el("vtitle").textContent = TITLES[state.view][0];
  el("vsub").textContent = TITLES[state.view][1];
  renderFiltros();
  el("view").innerHTML = state.view==="painel"?viewPainel():viewBonus();
  if(state.view==="painel"){
    el("sortBtns").innerHTML = `<span class="mini" style="align-self:center">Ordenar por:</span>`+
      [["pac","PAC"],["r6","R6"],["churn","Churn"],["crc_live","CRC Ploomes"],["meses_casa","Tempo de casa"],["trava","Travas"],["nome","Nome"]]
      .map(([k,l])=>`<button class="${state.sort===k?'on':''}" onclick="setSort('${k}')">${l}</button>`).join("");
  }
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on", b.dataset.v===state.view));
}
function go(v){ state.view=v; render(); }
function setSort(k){ state.dir=(state.sort===k?-state.dir:-1); state.sort=k; render(); }
window.go=go; window.setSort=setSort;
el("foot").innerHTML = "Fontes: Estudo PPC (consolidação jan–jun) · Dados Gerentes Comerciais out/2026 · Score MB set/2026 (Controladoria) · <b>Produção CRC via API do Ploomes</b> (sincronização diária) · Política de Progressão Comercial. Gestão do ex-superintendente Cassiano transferida ao Zagui.";
render();