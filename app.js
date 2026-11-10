/* carteiras consolidadas (Sp Interior/Sp Capital) ficam fora do painel — sugestão aprovada 09/11 */

const GCS = GCS_TODOS.filter(g => !g.fora_painel);



document.getElementById("logoImg").src = ASSETS.logo;

const state = {view:"painel", head:"", reg:"", nivel:"", ramp:"", tempo:"", sort:"pac", dir:-1};
const el = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const brlM = v => "R$ " + (v/1e6).toLocaleString("pt-BR",{maximumFractionDigits:2}) + "M";

function trava(g){
  /* nível B → A: exige os 5 critérios do A (PAC 60 · R6 70 · Churn<20 · CRC 3 · Score MB B1) */
  if(g.final === "B"){
    const f = [];
    if((g.pac_out||0) < 60) f.push("PAC 60");
    if(g.r6_out==null || g.r6_out < 70) f.push("R6 70");
    if(g.churn==null || g.churn >= 20) f.push("Churn");
    if(((g.crc_out||0)/1e6) < 3) f.push("CRC 3");
    if(!mbAlvoOk(g)) f.push("Score MB B1");
    return f;
  }
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
function kpis(list){
  const n = list.length || 1;
  const b = list.filter(g=>g.final==="B").length;
  const rA = list.filter(g=>g.rampagem&&g.rampagem.status==="ativa").length;
  const rM6 = list.filter(g=>g.rampagem&&g.rampagem.status==="m6").length;
  const rV = list.filter(g=>g.rampagem&&g.rampagem.status==="vencida").length;
  const chA = list.filter(g=>g.churn!=null&&g.churn>20).length;
  const crcLive = list.reduce((a,g)=>a+((g.crc_ploomes||{}).mes_atual||0),0);
  el("kpis").innerHTML = `
    <div class="kpi"><div class="t">GCs no filtro</div><div class="v">${list.length}</div><div class="d">de 57 consolidados</div></div>
    <div class="kpi"><div class="t">Nível B</div><div class="v">${b}</div><div class="d">título até janeiro</div></div>
    <div class="kpi o"><div class="t">Rampagem ativa</div><div class="v">${rA}</div><div class="d">nível D até o 6º mês</div></div>
    <div class="kpi o"><div class="t">Nível D — M6</div><div class="v">${rM6}</div><div class="d">passou do 6º mês, segue em D</div></div>
    <div class="kpi"><div class="t">Churn 6M &gt; 20%</div><div class="v" style="color:var(--lev-red)">${chA}</div><div class="d">${(chA/n*100).toFixed(0)}% do filtro</div></div>
    <div class="kpi g"><div class="t">CRC ao vivo (Ploomes)</div><div class="v" style="font-size:17px">${brlM(crcLive)}</div><div class="d">mês corrente · sync diário</div></div>`;
}
function filtraRamp(v){
  state.ramp = (state.ramp===v) ? "" : v;
  render();
}
window.filtraRamp = filtraRamp;

function chartNiveis(list){
  const c = {D:0,C:0,B:0};
  list.forEach(g=>{ if(c[g.final]!==undefined) c[g.final]++; });
  const tot = Math.max(list.length,1);
  const cores = {D:"linear-gradient(90deg,#A63A50,#8E2D5B)",C:"linear-gradient(90deg,#8E2D5B,#5B2D8E)",B:"linear-gradient(90deg,#5B2D8E,#3E1E63)"};
  const sel = state.nivel||"";
  return ["B","C","D"].map(nv=>{
    const ativo = sel===nv;
    return `<div class="chbar ${ativo?"sel":""}" onclick="filtraNivel('${nv}')" title="Clique para filtrar só o nível ${nv}">
      <div style="width:26px;font-weight:700;color:var(--lev-purple-d)">${nv}</div>
      <div class="bar" style="flex:1;height:22px;border-radius:6px">
        <i style="width:${c[nv]/tot*100}%;background:${cores[nv]};border-radius:6px"></i>
        <span style="position:absolute;left:10px;top:3px;color:#fff;font-size:11px;font-weight:700">${c[nv]}</span>
      </div>
      <div class="mini" style="width:34px;text-align:right">${(c[nv]/tot*100).toFixed(0)}%</div>
    </div>`;
  }).join("") + (sel?`<div class="mini" style="margin-top:6px"><a href="#" onclick="filtraNivel('');return false" style="color:var(--lev-purple)">limpar filtro de nível</a></div>`:"");
}
function filtraNivel(nv){
  state.nivel = (state.nivel===nv) ? "" : nv;
  render();
}
window.filtraNivel = filtraNivel;
function chartRamp(list){
  const ds = list.filter(g=>g.final==="D");
  const ativa = ds.filter(g=>g.rampagem&&g.rampagem.status==="ativa");
  const m6 = ds.filter(g=>g.rampagem&&g.rampagem.status==="m6");
  const venc = ds.filter(g=>g.rampagem&&g.rampagem.status==="vencida");
  const tot = Math.max(ds.length,1);
  const selR = state.ramp||"";
  const linha = (rot,arr,cor,chave)=>{
    const ativo = selR===chave;
    return `<div class="chbar ${ativo?"sel":""}" onclick="filtraRamp('${chave}')" title="Clique para filtrar">
      <div style="width:118px;font-size:12px;font-weight:600;color:var(--lev-purple-d)">${rot}</div>
      <div class="bar" style="flex:1;height:20px;border-radius:6px"><i style="width:${arr.length/tot*100}%;background:${cor};border-radius:6px"></i>
      <span style="position:absolute;left:10px;top:2px;color:#fff;font-size:11px;font-weight:700">${arr.length}</span></div></div>`;
  };
  return linha("Ativa (até 6m)",ativa,"linear-gradient(90deg,#E8913D,#B87333)","ativa")
       + linha("M6 (6m+, em D)",m6,"linear-gradient(90deg,#8E2D5B,#5B2D8E)","m6")
       + (selR?`<div class="mini" style="margin-top:6px"><a href="#" onclick="filtraRamp('');return false" style="color:var(--lev-purple)">limpar filtro de rampagem</a></div>`:"")
       + `<div class="mini" style="margin-top:8px"><b>Ativa:</b> ${ativa.map(g=>esc(g.nome.split(" ")[0])+" ("+g.meses_casa+"m)").join(", ")||"—"}<br>
    <b>M6 — mais tempo em D:</b> ${m6.slice().sort((a,b)=>b.meses_casa-a.meses_casa).slice(0,5).map(g=>esc(g.nome.split(" ")[0])+" ("+g.meses_casa+"m)").join(", ")||"—"}</div>`;
}
const TIPS = {
  rec: "R6 — Recorrência: % da carteira que produziu em pelo menos 6 dos últimos meses. Gatilhos: C 20% · B 50% · A 70% · AB+ 80%",
  pac: "PAC — Parceiros Ativos: parceiros com produção no mês. Gatilhos: C 25 · B 40 · A 60 · AB+ 70",
  churn: "Churn: % de parceiros perdidos no mês. Teto de 20% em todos os níveis (15% no AB+). Quanto menor, melhor.",
  crc: "CRC — Produção: volume originado no mês, em R$ milhões. Gatilhos: C 1–2M · B 2M · A 3M · AB+ 2,5–3,5M",
  mb: "Score MB — Margem Bruta: pontuação da margem dos parceiros (régua da Controladoria em 10 faróis). Gatilhos: C C1 · B C2 · A B1 · AB+ A1"
};
function critCell(g){
  const cls = x => x==="A"?"cA":x==="B"?"cB":x==="C"?"cC":x==="D"?"cD":"cN";
  const chaves = ["rec","pac","churn","crc","mb"];
  return ["rec_nivel","pac_nivel","churn","crc_nivel","mb_nivel"].map((k,i)=>{
    const tip = TIPS[chaves[i]];
    if(k==="churn"){
      const v = g.churn==null?"—":g.churn.toFixed(0)+"%";
      const c = g.churn==null?"cN":g.churn<=20?"cA":"cD";
      return `<span class="crit ${c}" data-tip="${tip}">${v}</span>`;
    }
    return `<span class="crit ${cls(g[k])}" data-tip="${tip}">${g[k]??"—"}</span>`;
  }).join("");
}
function rampCell(g){
  const r = g.rampagem||{status:"na"};
  if(r.status==="ativa") return `<span class="ramp ativa">M${r.mes} · ${r.meta}</span>`;
  if(r.status==="vencida") return `<span class="ramp vencida">vencida · ${Math.floor(r.meses/12)}a${r.meses%12}m</span>`;
  if(r.status==="m6") return `<span class="ramp m6">M6 · ${r.meta}</span>`;
  return `<span class="ramp na">—</span>`;
}
/* ---------- VIEW: PAINEL ---------- */
function viewPainel(){
  const list = filtered();
  return `
  <div class="rule"><b>Rampagem (nível D):</b> metas progressivas M1: 5 cadastros · M2: 10 · M3: 15 · M4: 18 · M5: 22 · M6: 25 positivações. A coluna <b>CRC (Ploomes)</b> vem direto da API, sincronizada diariamente — é a produção do mês corrente por carteira.</div>
  <div class="kpis">${kpisHtml(list)}</div>
  <div class="grid">
    <div class="panel"><h3>Posição final dos GCs</h3><div class="ps">título vigente até a janela de janeiro</div>${chartNiveis(list)}</div>
    <div class="panel"><h3>Rampagem — dentro e vencidos</h3><div class="ps">nível D por tempo de casa — do 1º ao 6º mês é rampagem ativa; depois disso segue em D com a meta do M6</div>${chartRamp(list)}</div>
  </div>
  <div class="panel">
    <div class="sort" id="sortBtns"></div>
    <table class="tmain"><thead><tr>
      <th data-k="nome">Gerente Comercial</th><th data-k="final" data-tip="Nível atual no PPC: D Geração · C Evolução · B Consolidação · A Consagração">Posição</th>
      <th>REC · PAC · CHURN · CRC · MB</th><th data-k="cad_out" data-tip="Cadastros de novos parceiros realizados no mês">Cad.</th><th data-k="meses_casa" data-tip="Tempo de casa em meses, contado da admissão">Casa</th>
      <th data-k="ramp">Rampagem</th><th data-k="pac" data-tip="Parceiros Ativos com produção no mês">PAC</th><th data-k="r6" data-tip="Recorrência: % da carteira que produziu em 6+ dos últimos meses">R6</th>
      <th data-k="churn" data-tip="Churn médio dos últimos 3 meses (teto 20%) — a partir de 2027 passa a 6 meses">Churn 3M</th><th data-k="farol" data-tip="Posição no Score de Margem Bruta, régua da Controladoria (D1 a A1)">Farol MB</th>
      <th data-k="crc_live" data-tip="Produção do mês corrente puxada da API do Ploomes">CRC (Ploomes)</th><th data-k="trava" data-tip="Indicadores que ainda impedem a subida de nível">Trava p/ subir</th>
    </tr></thead><tbody>
    ${sortList(list).map(g=>`
      <tr class="${g.final==='D'&&g.rampagem&&g.rampagem.status==='vencida'&&g.pac>=40?'hl':''}">
        <td><b class="nm-link" onclick="abrirModalGC('${esc(g.nome).replace(/'/g,"\\'")}')" title="Abrir detalhes">${esc(g.nome)}</b> <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:22px;height:22px;vertical-align:-6px;border-radius:50%" alt="${g.final}"><div class="mini">${esc(g.cargo)} · ${esc(g.regional)}</div></td>
        <td><span class="bdg nv${g.final}">${g.final}</span></td>
        <td>${critCell(g)}</td>
        <td class="num">${g.cad_out!=null&&g.cad_out>0?"<b>"+g.cad_out.toFixed(0)+"</b>":"—"}</td><td class="num">${g.meses_casa!=null?g.meses_casa+"m":"—"}</td>
        <td>${rampCell(g)}</td>
        <td class="num"><b>${g.pac.toFixed(0)}</b></td>
        <td class="num"><div class="bar ${g.r6<50?'hot':''}"><i style="width:${Math.min(g.r6||0,100)}%"></i></div><div class="mini num">${g.r6!=null?g.r6.toFixed(0)+"%":"—"}</div></td>
        <td class="num" style="color:${g.churn>20?'var(--lev-red)':'inherit'}">${g.churn!=null?g.churn.toFixed(0)+"%":"—"}</td>
        <td>${g.farol?`<span class="bdg f${g.farol}">${g.farol}</span>`:`<span class="bdg fNa">—</span>`}</td>
        <td class="num">${g.crc_ploomes?brlM(g.crc_ploomes.mes_atual):"—"}</td>
        <td>${g._trava.length?g._trava.map(t=>`<span class="gap">${t}</span>`).join(" · "):`<span class="gap ok">✓</span>`}</td>
      </tr>`).join("")}
    </tbody></table>
    <div class="mcards">
      ${sortList(list).map(g=>`
        <div class="mcard nv${g.final}" onclick="abrirModalGC('${esc(g.nome).replace(/'/g,"\\'")}')">
          <div class="cab">
            <div class="nm">${esc(g.nome)}<div class="mini">${esc(g.cargo)} · ${esc(g.regional)}</div></div>
            <div class="badges">
              <span class="bdg nv${g.final}">${g.final}</span>
              ${g.farol?`<span class="bdg f${g.farol}">${g.farol}</span>`:""}
            </div>
          </div>
          <div class="gr">
            <div class="it"><div class="l">PAC</div><div class="v">${g.pac_out!=null?g.pac_out.toFixed(0):"—"}</div></div>
            <div class="it"><div class="l">R6</div><div class="v ${g.r6<50?'ruim':''}">${g.r6!=null?g.r6.toFixed(0)+"%":"—"}</div></div>
            <div class="it"><div class="l">Churn</div><div class="v ${g.churn>20?'ruim':''}">${g.churn!=null?g.churn.toFixed(0)+"%":"—"}</div></div>
            <div class="it"><div class="l">Cad.</div><div class="v">${g.cad_out!=null&&g.cad_out>0?g.cad_out.toFixed(0):"—"}</div></div>
          </div>
          <div class="pe">
            <span>Casa <b>${g.meses_casa!=null?g.meses_casa+"m":"—"}</b></span><span style="color:var(--line)">|</span>
            ${g.rampagem&&g.rampagem.status==="ativa"?`<span>Rampagem <b>M${g.rampagem.mes}</b></span>`:g.rampagem&&g.rampagem.status==="m6"?`<span>Rampagem <b>M6</b></span>`:""}
            <span style="width:100%;border-top:1px solid var(--line);padding-top:6px;margin-top:1px">${g._trava&&g._trava.length?g._trava.map(t=>`<span class="gap">${t}</span>`).join(" · "):`<span class="gap ok">✓ sem trava</span>`}</span>
          </div>
        </div>`).join("")}
    </div>
  </div>`;
}
function abrirGC(nome){
  gcSel = nome; state.view = "gc"; location.hash = "gc"; render();
  window.scrollTo({top:0,behavior:"smooth"});
}
window.abrirGC = abrirGC;
function kpisHtml(list){
  const n = list.length||1;
  const b = list.filter(g=>g.final==="B").length;
  const rA = list.filter(g=>g.rampagem&&g.rampagem.status==="ativa").length;
  const rM6 = list.filter(g=>g.rampagem&&g.rampagem.status==="m6").length;
  const rV = list.filter(g=>g.rampagem&&g.rampagem.status==="vencida").length;
  const chA = list.filter(g=>g.churn!=null&&g.churn>20).length;
  const crcLive = list.reduce((a,g)=>a+((g.crc_ploomes||{}).mes_atual||0),0);
  return `
    <div class="kpi"><div class="t">GCs no filtro</div><div class="v">${list.length}</div><div class="d">de 57 consolidados</div></div>
    <div class="kpi"><div class="t">Nível B</div><div class="v">${b}</div><div class="d">título até janeiro</div></div>
    <div class="kpi o"><div class="t">Rampagem ativa</div><div class="v">${rA}</div><div class="d">nível D até o 6º mês</div></div>
    <div class="kpi o"><div class="t">Nível D — M6</div><div class="v">${rM6}</div><div class="d">passou do 6º mês, segue em D</div></div>
    <div class="kpi"><div class="t">Churn 6M &gt; 20%</div><div class="v" style="color:var(--lev-red)">${chA}</div><div class="d">${(chA/n*100).toFixed(0)}% do filtro</div></div>
    <div class="kpi g"><div class="t">CRC ao vivo (Ploomes)</div><div class="v" style="font-size:17px">${brlM(crcLive)}</div><div class="d">mês corrente · sync diário</div></div>`;
}
function sortList(list){
  const k = state.sort;
  return list.slice().sort((a,b)=>{
    let va=a[k], vb=b[k];
    if(k==="trava"){va=a._trava.length;vb=b._trava.length}
    if(k==="ramp"){va=(a.rampagem?.status==="ativa"?a.meses_casa:a.rampagem?.status==="m6"?100+a.meses_casa:999);vb=(b.rampagem?.status==="ativa"?b.meses_casa:b.rampagem?.status==="m6"?100+b.meses_casa:999)}
    if(k==="crc_live"){va=(a.crc_ploomes||{}).mes_atual||0;vb=(b.crc_ploomes||{}).mes_atual||0}
    if(k==="farol"){va=a.farol||"zz";vb=b.farol||"zz"}
    if(typeof va==="string"||typeof vb==="string") return state.dir*String(va).localeCompare(String(vb));
    va=va==null?1e9:va; vb=vb==null?1e9:vb;
    return state.dir*(va-vb);
  });
}
/* ---------- VIEW: BÔNUS ---------- */
let bonusHD = true;   /* true = aplica hierarquia dinâmica */
function setBonusHD(v){ bonusHD = v; render(); }
window.setBonusHD = setBonusHD;

/* ===== REGRA: Inelegibilidade a Bônus =====
   GC acima do limite de tempo de casa não recebe bônus de nível D.
   mesesIneq = 0 (desligada) | 6 | 12 | 18
   A regra vale para o bônus de PERFORMANCE do nível D (rampagem). */
let mesesIneq = 0;
function setMesesIneq(v){ mesesIneq = Number(v)||0; render(); }
window.setMesesIneq = setMesesIneq;

/* devolve true se o GC está inelegível pela regra ativa */
function inelegivel(g){
  if(!mesesIneq) return false;
  if(g.final !== "D") return false;
  return (g.meses_casa || 0) > mesesIneq;
}
window.inelegivel = inelegivel;

/* quantos GCs a regra atinge numa lista, e quanto de bônus ela corta */
function impactoIneq(list, calcFn){
  const at = list.filter(inelegivel);
  const valor = at.reduce((a,g)=>a+((calcFn?calcFn(g):g.bonus||{}).bonus_efetivo||0),0);
  return {qtd:at.length, valor, gcs:at};
}
window.impactoIneq = impactoIneq;

/* barra de controle da regra — usada nas duas abas */
function barraIneq(list, calcFn){
  const imp = impactoIneq(list, calcFn);
  const ligada = mesesIneq > 0;
  const opcoes = [[0,"Desligada"],[6,"6 meses"],[12,"12 meses"],[18,"18 meses"]];
  return `<div class="panel" style="margin-bottom:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:${ligada?"linear-gradient(90deg,#FDF0DD,#FFFBF3)":"#fff"};border-color:${ligada?"#F2DDB8":"var(--line)"}">
    <div style="flex:1;min-width:280px">
      <div style="font-size:13px;font-weight:800;color:${ligada?"#8A6210":"var(--lev-purple-d)"}">
        ${ligada ? `⚠️ Inelegibilidade a Bônus ATIVA — limite de ${mesesIneq} meses` : "Inelegibilidade a Bônus — desligada"}
      </div>
      <div class="mini" style="margin-top:4px;line-height:1.6;color:${ligada?"#8A6210":"var(--mut)"}">
        ${ligada
          ? `GC no nível D com mais de <b>${mesesIneq} meses</b> de casa <b>não recebe</b> o bônus de nível D. Atinge <b>${imp.qtd}</b> GC${imp.qtd===1?"":"s"} · <b>R$ ${fmtN(imp.valor)}</b> deixariam de ser pagos.`
          : "Regra desligada: todo GC no nível D com a meta de rampagem cumprida recebe o bônus, independente do tempo de casa."}
      </div>
    </div>
    <div style="display:flex;gap:4px;background:#fff;border:1px solid var(--line);border-radius:9px;padding:3px">
      ${opcoes.map(([v,l])=>`<button onclick="setMesesIneq(${v})" style="border:0;border-radius:7px;padding:8px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;
        background:${mesesIneq===v?(v===0?"var(--lev-purple)":"var(--gem)"):"transparent"};color:${mesesIneq===v?(v===0?"#fff":"#2A1A08"):"var(--mut)"}">${l}</button>`).join("")}
    </div>
  </div>`;
}
window.barraIneq = barraIneq;

function viewBonus(){
  const list = filtered();
  /* escolhe qual cálculo usar conforme o botão; aplica a inelegibilidade */
  const calc = g => {
    const base = (bonusHD ? (g.bonus_din || g.bonus) : g.bonus) || {};
    if(!inelegivel(g)) return base;
    return Object.assign({}, base, {
      atingiu: base.atingiu,
      bonus_efetivo: 0,
      inelegivel: true,
      inelegivel_motivo: `Nível D com ${g.meses_casa} meses de casa — acima do limite de ${mesesIneq} meses`
    });
  };

  const ok  = list.filter(g=>bonusOk(calc(g))===true);
  const no  = list.filter(g=>bonusNaoOk(calc(g)));
  const ind = list.filter(g=>bonusOk(calc(g))===null);

  const recebe = g=>(calc(g).bonus_efetivo||0) > 0;
  const pagos = ok.filter(recebe);
  const cortados = ok.filter(g=>!recebe(g));

  const totNom = ok.reduce((a,g)=>a+(calc(g).bonus_nominal||0),0);
  const totEf  = ok.reduce((a,g)=>a+(calc(g).bonus_efetivo||0),0);

  /* números da hierarquia, para o cabeçalho */
  const comExcl = list.filter(g=>((g.din||{}).excl||0)>0);
  const exclTot = list.reduce((a,g)=>a+((g.din||{}).excl||0),0);
  const exclAtivos = list.reduce((a,g)=>a+((g.din||{}).excl_ativos_out||0),0);
  const semHD = list.reduce((a,g)=>a+((g.bonus||{}).bonus_efetivo||0),0);
  const comHD = list.reduce((a,g)=>a+((g.bonus_din||{}).bonus_efetivo||0),0);
  const qtMudam = list.filter(g=>{
    const a=(g.bonus||{}).bonus_efetivo||0, b=(g.bonus_din||{}).bonus_efetivo||0;
    return a!==b;
  }).length;

  return `
  <div class="panel" style="margin-bottom:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:${bonusHD?"linear-gradient(90deg,#F3EDFA,#FAF7FE)":"linear-gradient(90deg,#FDF0DD,#FFFBF3)"};border-color:${bonusHD?"#E0D4F0":"#F2DDB8"}">
    <div style="flex:1;min-width:280px">
      <div style="font-size:13px;font-weight:800;color:${bonusHD?"var(--lev-purple-d)":"#8A6210"}">
        ${bonusHD ? "✅ Hierarquia dinâmica ATIVA" : "⚠️ Hierarquia dinâmica DESATIVADA"}
      </div>
      <div class="mini" style="margin-top:4px;line-height:1.6;color:${bonusHD?"#4A3A63":"#8A6210"}">
        ${bonusHD
          ? `Parceiros com menos de 90 dias na carteira que <b>já produziam antes</b> não entram no PAC. ${comExcl.length} GCs têm exclusão neste mês · <b>${exclTot}</b> parceiros desconsiderados (${exclAtivos} com produção em out).`
          : `O bônus usa o <b>PAC bruto</b>, sem descontar quem já produzia antes de entrar na carteira. Com a hierarquia ligada, ${qtMudam} GC${qtMudam>1?"s":""} mudaria${qtMudam>1?"m":""} de resultado.`}
      </div>
    </div>
    <div style="display:flex;gap:6px;background:#fff;border:1px solid var(--line);border-radius:9px;padding:3px">
      <button onclick="setBonusHD(true)" style="border:0;border-radius:7px;padding:9px 17px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;
        background:${bonusHD?"var(--lev-purple)":"transparent"};color:${bonusHD?"#fff":"var(--mut)"}">Com hierarquia</button>
      <button onclick="setBonusHD(false)" style="border:0;border-radius:7px;padding:9px 17px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;
        background:${!bonusHD?"var(--gem)":"transparent"};color:${!bonusHD?"#2A1A08":"var(--mut)"}">Sem hierarquia</button>
    </div>
  </div>

  ${barraIneq(list, calc)}

  <div class="rule">Critérios por nível: <b>D</b> rampagem do mês · <b>C</b> crescimento ≥15% em PAC e CRC + churn &lt;20% · <b>B</b> PAC ≥ 50 <i>ou</i> (PAC ≥ 45 <i>e</i> Score MB verde) · <b>A</b> PAC ≥ 70.</div>

  <div class="kpis" style="margin-bottom:14px">
    <div class="kpi g"><div class="t">Recebem bônus</div><div class="v" style="color:var(--green)">${pagos.length}</div><div class="d">${cortados.length} com valor reduzido</div></div>
    <div class="kpi o"><div class="t">Atingiram, teto zerou</div><div class="v" style="color:var(--gem)">${cortados.length}</div><div class="d">salário já no teto do nível</div></div>
    <div class="kpi r"><div class="t">Não atingiram</div><div class="v" style="color:var(--lev-red)">${no.length}</div><div class="d">critério pendente</div></div>
    <div class="kpi"><div class="t">Folha de bônus</div><div class="v" style="font-size:16px">R$ ${fmtN(totEf)}</div><div class="d">nominal seria R$ ${fmtN(totNom)}</div></div>
  </div>

  <div class="panel"><h3>💰 Recebem o bônus</h3><div class="ps">critério cumprido e valor já ajustado ao teto${bonusHD?" · PAC sem os parceiros recém-chegados que já produziam":""}</div>
    <table class="btab"><tbody>
    ${pagos.map(g=>bonusRow(g,"ok",calc)).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>

  <div class="panel" style="margin-top:14px"><h3>⚠️ Atingiram o critério, mas o teto zerou</h3><div class="ps">o salário atual já consome todo o teto da categoria</div>
    <table class="btab"><tbody>
    ${cortados.map(g=>bonusRow(g,"id",calc)).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>

  <div class="panel" style="margin-top:14px"><h3>⛔ Não atingiram</h3><div class="ps">critério em vermelho = pendência do mês</div>
    <table class="btab"><tbody>
    ${no.map(g=>bonusRow(g,"no",calc)).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>

  ${ind.length?`<div class="panel" style="margin-top:14px"><h3>⏳ Critérios em aberto</h3>
    <table class="btab"><tbody>${ind.map(g=>bonusRow(g,"id",calc)).join("")}</tbody></table></div>`:""}`;
}


/* faixa de teto remuneratório no card de bônus */
function tetoHTML(b){
  if(!b || b.teto==null) return "";
  if(b.salario==null){
    return `<div class="teto ok"><b>Sem salário cadastrado</b> — bônus integral de R$ ${fmtN(b.bonus_nominal)} (teto R$ ${fmtN(b.teto)})</div>`;
  }
  const sal = b.salario, teto = b.teto, nom = b.bonus_nominal, ef = b.bonus_efetivo;
  const cls = !b.atingiu ? "ok" : (ef===0 ? "full" : ef<nom ? "cut" : "ok");
  const ocup = Math.min(100, (sal/teto)*100);
  const rot = b.atingiu
    ? (ef===0 ? "salário já consome o teto" : ef<nom ? "bônus reduzido pelo teto" : "cabe no teto")
    : "critério não cumprido";
  return `<div class="teto ${cls}">
    <b>Remuneração:</b> salário R$ ${fmtN(sal)} · teto do nível R$ ${fmtN(teto)}
    ${b.atingiu?` → <b>bônus R$ ${fmtN(ef)}</b>${ef<nom?` <span style="opacity:.8">(nominal ${fmtN(nom)})</span>`:""}`:""}
    <div class="calc"><span>${rot}</span></div>
    <div class="barra"><i style="width:${ocup}%"></i></div>
  </div>`;
}


/* classe do badge de bônus conforme a situação */
function bcls(b, cls){
  if(b && b.inelegivel) return "bno";
  if(b && b.atingiu && b.bonus_efetivo===0) return "bno";
  if(b && b.atingiu && b.bonus_efetivo>0 && b.bonus_efetivo < (b.bonus_nominal||0)) return "bcut";
  if(b && b.atingiu) return "bok";
  return cls==="ok"?"bok":cls==="no"?"bno":"bind";
}

function ehDinamico(g, calc){
  return calc && calc(g) === (g.bonus_din || {});
}
function ajusteHD(g, b, calc){
  if(!calc || calc(g) !== (g.bonus_din||{})) return "";
  const excecao = (g.din||{}).excecao;
  if(excecao) return `<div class="mini" style="margin-top:5px;padding:5px 8px;background:#FDF0DD;border-radius:6px;color:#8A5510"><b>Exceção:</b> ${esc(excecao)}</div>`;
  const excl = b.excl||0;
  if(!excl) return `<div class="mini" style="margin-top:5px;color:var(--mut)">Sem exclusão — nenhum parceiro novo com produção anterior</div>`;
  return `<div class="mini" style="margin-top:5px;color:var(--lev-magenta)">
    <b>Hierarquia dinâmica:</b> PAC ${b.pac_base} − ${excl} parceiro${excl>1?"s":""} que já produzia${excl>1?"m":""} antes da carteira = <b>${b.pac_ajust}</b></div>`;
}

function bonusRow(g, cls, calc){
  const b = calc ? calc(g) : g.bonus;
  const linhas = b.linhas.map(l=>{
    const st = l[3]===true?"ok":l[3]===false?"no":"id";
    const ic = l[3]===true?"✓":l[3]===false?"✕":"?";
    return `<div class="blin"><span class="st ${st}">${ic}</span><b>${l[0]}</b> — ${l[2]}</div>`;
  }).join("");
  return `<tr><td style="width:26%">
    <b class="nm-link" onclick="abrirModalGC('${esc(g.nome).replace(/'/g,"\\'")}')" title="Abrir detalhes">${esc(g.nome)}</b> <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:20px;height:20px;vertical-align:-5px;border-radius:50%">
    <div class="mini">${esc(g.cargo)} · nível ${g.final} · alvo ${b.alvo}${ehDinamico(g,calc)?` · <span style="color:var(--lev-magenta);font-weight:700">PAC ajustado ${b.pac_ajust}</span>`:""}</div></td>
    <td>${linhas}${b.inelegivel?`<div class="mini" style="margin-top:5px;padding:5px 8px;background:#FDF0DD;border-radius:6px;color:#8A6210"><b>🚫 Inelegível:</b> ${esc(b.inelegivel_motivo)}</div>`:""}${tetoHTML(b)}${ajusteHD(g,b,calc)}</td>
    <td class="num"><span class="bdg ${bcls(b,cls)}">${b.bonus_efetivo!=null?(b.bonus_efetivo>0?"R$ "+fmtN(b.bonus_efetivo):"R$ 0"):b.bonus}</span></td></tr>`;
}

/* ---------- VIEW: BÔNUS DINÂMICO ---------- */
function bonusOk(b){
  if(!b || !b.linhas || !b.linhas.length) return null;
  const vals = b.linhas.map(l=>l[3]).filter(v=>v!==null && v!==undefined);
  if(!vals.length) return null;
  return b.modo === "ou" ? vals.some(v=>v===true) : vals.every(v=>v===true);
}
function bonusNaoOk(b){
  if(!b || !b.linhas) return false;
  const vals = b.linhas.map(l=>l[3]).filter(v=>v!==null && v!==undefined);
  if(!vals.length) return false;
  return b.modo === "ou" ? vals.every(v=>v===false) : vals.some(v=>v===false);
}

function ordenaInd(lista){
  const m = Object.fromEntries(lista.map(d=>[d.k,d]));
  return ORDEM_IND.map(k=>m[k]).filter(Boolean);
}
function farolDeScore(v){
  if(v==null) return null;
  for(const [n,lo,hi] of FAIXA_MB) if(v>=lo && v<hi) return n;
  return v>=95 ? "A1" : null;
}

/* os 5 indicadores do PPC.
   Em nível D (rampagem) não há gatilho de REC/PAC/CRC/MB — a régua é a meta de rampagem. */
function indicadores(g){
  const lvl = g.final;
  const emRamp = lvl==="D" && g.rampagem && (g.rampagem.status==="ativa" || g.rampagem.status==="m6");
  const prox = lvl==="D" ? "C" : lvl==="C" ? "B" : lvl==="B" ? "A" : null;
  const alvoNome = prox;

  /* REGRA DO PPC: PAC e R6 = último mês · CRC, CHURN e Score MB = média de 6 meses */
  const r6 = g.r6_out, pac = g.pac_out, ch = g.churn, crc = (g.crc_out||0)/1e6;
  /* CRC exibido = média dos últimos JANELA meses (via FUNIL.serie3) */
  const s3 = (typeof FUNIL!=="undefined" && FUNIL.serie3) ? FUNIL.serie3[g.nome] : null;
  const crcMedia3 = s3 ? ((s3.agosto.producao + s3.setembro.producao + s3.outubro.producao)/3/1e6) : crc;
  const farol = (g.farol && g.farol!=="#DIV/0!") ? g.farol : farolDeScore(g.score);
  const cr = g.cresc || {};

  /* CHURN exibido = média dos últimos JANELA meses */
  const cs = g.churn_serie || {};
  const chVals = ["ago","set","out"].map(k=>(cs[k]&&cs[k].churn!=null)?cs[k].churn:null).filter(v=>v!=null);
  const chMedia = chVals.length ? chVals.reduce((a,b)=>a+b,0)/chVals.length : ch;

  const recAlvo = emRamp ? null : (prox ? PPC.rec[prox] : null);
  const pacAlvo = emRamp ? null : (prox ? PPC.pac[prox] : null);
  const crcAlvo = emRamp ? null : (prox ? PPC.crc[prox] : null);
  const mbAlvo = emRamp ? null : (prox==="C" ? "C1" : prox==="B" ? "C2" : prox==="A" ? "B1" : null);
  const mbAlvoDestaque = "A1";   /* Selo Extraordinário exige Score MB A1 */

  const recOk = recAlvo==null ? null : (r6!=null && r6>=recAlvo);
  const pacOk = pacAlvo==null ? null : (pac!=null && pac>=pacAlvo);
  const chOk  = chMedia==null ? null : chMedia < PPC.churnMax;
  const crcOk = crcAlvo==null ? null : (crc>=crcAlvo);
  const idxA = ORDEM_LUZ.indexOf(farol), idxB = mbAlvo ? ORDEM_LUZ.indexOf(mbAlvo) : null;
  const mbOk  = (idxB==null || idxA<0) ? null : idxA>=idxB;

  /* Nível C: bônus é crescimento de PAC e CRC ≥15% no MÊS + churn <20% */
  const cresceu = (lvl==="C" && !emRamp)
    ? (cr.pac!=null && cr.crc!=null ? (cr.pac>=15 && cr.crc>=15) : null)
    : null;

  return [
    {k:"crc", nm:"CRC — PRODUÇÃO", sub:`média dos últimos ${JANELA} meses`,
     val:crcMedia3, fmt:v=>v==null?"—":"R$ "+v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"<span class='un'>M</span>",
     click: "abrirSerie3", clickArg: "producao",
     gat: crcAlvo==null?"sem gatilho na rampagem":`Gatilho ${alvoNome}: ≥ R$ ${crcAlvo.toLocaleString("pt-BR",{minimumFractionDigits:1})}M`,
     meta: crcAlvo==null?"foco: cadastros e positivações":`Meta ${alvoNome}: R$ ${crcAlvo.toLocaleString("pt-BR",{minimumFractionDigits:1})}M`,
     ok:crcOk, prog: crcAlvo ? Math.min(1,crc/crcAlvo) : null},

    {k:"pac", nm:"PAC — PARCEIROS ATIVOS", sub:"parceiros com produção no mês (consolidado)",
     click: "abrirSerie3", clickArg: "pac",
     val:pac, fmt:v=>v==null?"—":v.toFixed(0),
     gat: pacAlvo==null?"sem gatilho na rampagem":`Gatilho ${alvoNome}: ≥ ${pacAlvo}`,
     meta: pacAlvo==null?"foco: cadastros e positivações":`Meta ${alvoNome}: ${pacAlvo}`,
     ok:pacOk, prog: pacAlvo&&pac!=null ? Math.min(1,pac/pacAlvo) : null},

    {k:"churn", nm:"CHURN", sub:`média dos últimos ${JANELA} meses · teto < 20%`,
     click: "abrirSerie3", clickArg: "churn",
     val:chMedia, fmt:v=>v==null?"—":v.toFixed(1)+"<span class='un'>%</span>",
     gat:`Média 3M · mês: ${g.churn_out!=null?g.churn_out.toFixed(1)+"%":"—"} · base ${g.churn_base||"—"}`,
     meta: chMedia==null?"sem apuração":(chMedia<10?"metade do teto":chMedia<PPC.churnMax?"uso de "+(chMedia/PPC.churnMax*100).toFixed(0)+"% do teto":"acima do teto em "+(chMedia-PPC.churnMax).toFixed(1)+" p.p."),
     ok:chOk, prog: chMedia!=null ? Math.min(1,chMedia/PPC.churnMax) : null,
     comp: g.churn_out!=null ? {rot:"mês", val:g.churn_out, cor:(g.churn_out>20?"var(--lev-red)":"var(--green)")} : null},

    {k:"rec", nm:"RECORRÊNCIA", sub:"R6 — producente nos últimos 6 meses",
     val:r6, fmt:v=>v==null?"—":v.toFixed(1)+"<span class='un'>%</span>",
     extra: (function(){ const f=(typeof FUNIL!=="undefined"&&FUNIL.funil)?FUNIL.funil[g.nome]:null;
              return f? `<b>${f.r6}</b> de <b>${f.pac}</b> parceiros em R6`:""; })(),
     click: "abrirFunilR6",
     gat: recAlvo==null?"sem gatilho na rampagem":`Gatilho ${alvoNome}: ≥ ${recAlvo}%`,
     meta: recAlvo==null?"foco: cadastros e positivações":`Meta ${alvoNome}: ${recAlvo}%`,
     ok:recOk, prog: recAlvo&&r6!=null ? Math.min(1,r6/recAlvo) : null},

    {k:"mb", nm:"SCORE MB", sub:"pontuação da margem bruta dos parceiros",
     val:g.score, fmt:v=>v==null?"—":v.toFixed(1)+"<span class='un'>/100</span>",
     gat: mbAlvo==null?"sem gatilho na rampagem":`Gatilho ${alvoNome}: ${mbAlvo}`,
     meta: farol?`Farol: ${farol}`:"sem farol",
     ok:mbOk, farol:farol, prog: g.score!=null ? Math.min(1,g.score/100) : null}
  ];
}

let gcSel = null;
function pickGC(v){ gcSel = v; render(); }
window.pickGC = pickGC;

function gcAtual(){
  const lista = GCS.slice().sort((a,b)=>a.nome.localeCompare(b.nome));
  return lista.find(g=>g.nome===gcSel) || filtered()[0] || lista[0];
}

function semaforoHTML(farol){
  const idx = ORDEM_LUZ.indexOf(farol);
  const grupos = [
    ["D",["D1","D2","D3"]],
    ["C",["C1","C2","C3"]],
    ["B",["B1","B2","B3"]],
    ["A",["A1"]]
  ];
  return `<div class="trilha" style="display:flex;flex-wrap:nowrap;align-items:flex-start;justify-content:space-evenly;gap:0;padding:10px 2px 4px;width:100%">` + grupos.map(([letra,lista])=>{
    const luzes = lista.map(n=>{
      const i = ORDEM_LUZ.indexOf(n);
      const on = i===idx;
      return `<div class="luz ${n[0].toLowerCase()} ${on?"on":""}"></div>`;
    }).join("");
    return `<div class="grupo" style="display:flex;flex-direction:column;align-items:center;gap:6px"><div class="luzes" style="display:flex;align-items:center;gap:5px">${luzes}</div><div class="lbl">${letra}</div></div>`;
  }).join("") + `</div>`;
}

/* Selo Extraordinário (AB+): requisitos mensais da seção 6 da política.
   Não é nível — é a posição de destaque do mês, olhando só o resultado do mês anterior. */
function requisitosDestaque(g){
  const baseB = g.final==="B", baseA = g.final==="A";
  const elegivelBase = baseB || baseA;
  const r6 = g.r6_out, pac = g.pac_out, ch = g.churn, crc = (g.crc_out||0)/1e6;
  /* CRC exibido = média dos últimos JANELA meses (via FUNIL.serie3) */
  const s3 = (typeof FUNIL!=="undefined" && FUNIL.serie3) ? FUNIL.serie3[g.nome] : null;
  const crcMedia3 = s3 ? ((s3.agosto.producao + s3.setembro.producao + s3.outubro.producao)/3/1e6) : crc;
  const farol = (g.farol && g.farol!=="#DIV/0!") ? g.farol : farolDeScore(g.score);
  const pacMin = baseB ? 70 : baseA ? 80 : 70;
  const crcMin = baseB ? 2.5 : baseA ? 3.5 : 2.5;
  return [
    {nm:"Título A ou B",      val:elegivelBase?g.final:"—", req:"A ou B",   ok:elegivelBase},
    {nm:"R6 acima de 80%",    val:r6==null?"—":r6.toFixed(1)+"%", req:"> 80%",  ok:r6!=null && r6>80},
    {nm:"PAC",                val:pac==null?"—":String(pac), req:`> ${pacMin}`, ok:pac!=null && pac>pacMin},
    {nm:"Churn até 15%",      val:ch==null?"—":ch.toFixed(1)+"%", req:"≤ 15%",  ok:ch!=null && ch<=15},
    {nm:"CRC",                val:"R$ "+crc.toFixed(2).replace(".",",")+"M", req:`> R$ ${crcMin.toFixed(1).replace(".",",")}M`, ok:crc>crcMin},
    {nm:"Score MB",           val:farol||"—", req:"A1", ok:farol==="A1"}
  ];
}

function viewGC(){
  const atual = gcAtual();
  if(!atual) return `<div class="panel mini">Nenhum GC disponível.</div>`;
  const g = atual;
  const inds = ordenaInd(indicadores(g));
  const farol = (g.farol && g.farol!=="#DIV/0!") ? g.farol : farolDeScore(g.score);
  const posIdx = NIVEIS.indexOf(g.final);
  const escSrc = ASSETS["esc_"+String(g.final).toLowerCase()+"_circ"]||"";
  const prox = NIVEIS[posIdx+1];
  const emRamp = g.final==="D" && g.rampagem && (g.rampagem.status==="ativa"||g.rampagem.status==="m6");
  const reqDest = requisitosDestaque(g);
  const destaqueAgora = reqDest.every(r=>r.ok===true);

  const blocos = inds.map(d=>{
    const st = d.ok===true?"ok":d.ok===false?"no":"mid";
    const ic = d.ok===true?"✓":d.ok===false?"✕":"—";
    const tx = d.ok===true ? (d.k==="churn"?"dentro do teto":"no gatilho")
             : d.ok===false ? (d.k==="churn"?"acima do teto":"abaixo")
             : "sem gatilho";
    const nomeJson = JSON.stringify(g.nome).replace(/"/g, "&quot;");
    const clicavel = d.click
      ? ' indclick" data-clk="'+d.click+'" data-gc="'+esc(g.nome)+'" data-arg="'+(d.clickArg||"")+'" title="Clique para ver o detalhe'
      : "";
    return `<div class="indc st-${st}${clicavel}">
      <div class="nm">${d.nm}</div><div class="gt">${d.gat}</div>
      <div class="vl">${d.fmt(d.val)}</div>
      ${d.extra?`<div class="mini" style="margin-top:4px;color:var(--lev-purple);font-weight:600">${d.extra}</div>`:""}
      <div class="mt">${d.meta}</div>
      ${d.comp?`<div class="mini" style="margin-top:5px;padding-top:5px;border-top:1px solid var(--line)">
        média ${JANELA_ROT} <b>${d.val==null?"—":d.val.toFixed(1)+"%"}</b> · este mês <b style="color:${d.comp.cor}">${d.comp.val.toFixed(1)}%</b></div>`:""}
      ${d.prog!=null?`<div class="mini-lv" style="color:${st==="ok"?"#2e7d4f":st==="no"?"#A63A50":"#E8913D"}">
        ${Array.from({length:10},(_,i)=>`<i class="${i < Math.round(d.prog*10)?"f":""}"></i>`).join("")}</div>`:""}
      <div class="foot"><span class="pill ${st}">${ic} ${tx}</span></div>
    </div>`;
  }).join("");

  /* o 6º bloco é o semáforo, ocupando 2 colunas */
  return `
  <div class="gchead">
    <div class="id">
      <div style="font-size:10px;letter-spacing:1.1px;text-transform:uppercase;font-weight:700;color:var(--lev-purple)">Painel de Progressão Comercial · PPC Lev</div>
      <div class="nm" style="font-size:26px;margin-top:2px">${esc(g.nome)}</div>
      <div class="sb">${esc(g.cargo)} · ${esc(g.regional||"—")} · Head ${esc(g.head||"—")} · ${g.meses_casa} meses de casa</div>
      <span class="tag">${esc(g.unidade||"—")} · ${emRamp?(g.rampagem.status==="ativa"?`Rampagem M${g.rampagem.mes} · ${g.rampagem.meta}`:`Nível D · M6 (${g.rampagem.meta})`):"Fora da rampagem"}</span>
    </div>
    <div class="termo" style="flex:0 0 56%;min-width:420px">
      <img class="esc" src="${escSrc}" alt="">
      <div class="info">
        <div class="lb">Posição atual na carreira</div>
        <div class="pos">Nível ${g.final} <span style="font-size:13px;font-weight:700;color:var(--lev-magenta)">· ${NIVEL_LONGO[g.final]||""}</span></div>
        <div class="nv">${prox?`próximo: <b>${prox}</b> · ${NIVEL_LONGO[prox]}`:`topo da carreira · ${NIVEL_LONGO.A}`}${destaqueAgora?` · <b style="color:var(--lev-magenta)">★ ${DESTAQUE} no mês</b>`:""}</div>
        <div class="prog">${NIVEIS.map((n,i)=>`<i class="${i<posIdx?"on":i===posIdx?"cur":""}"></i>`).join("")}</div>
        <div class="ladder">${NIVEIS.map(n=>`<span>${n}</span>`).join("")}</div>
      </div>
    </div>
  </div>

  <div class="ind5" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
    ${blocos}
    <div class="semafarobloco" style="grid-column:span 2;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column">
      <div class="cab">
        <div>
          <div class="nm">SEMÁFORO DO SCORE MB</div>
          <div class="gt">posição atual pela régua da Controladoria</div>
        </div>
        <div class="pos">${farol||"—"}<small>farol atual</small></div>
      </div>
      <div style="margin-top:auto">
        ${semaforoHTML(farol)}
      </div>
    </div>
  </div>

  <div class="gcgrid">
    <div class="panel"><h3>${emRamp?"Régua da rampagem":"Travas para o próximo nível"}</h3>
      <div class="ps">${emRamp?`nível D — a régua são as metas de cadastro e positivação, não os 5 indicadores`:`o que falta para sair do nível ${g.final}${prox?` e chegar ao ${prox}`:""}`}</div>
      ${emRamp?`
        <div class="trava"><span class="ic ${g.rampagem.status==="ativa"?"mid":"no"}">${g.rampagem.status==="ativa"?"›":"!"}</span>
          <span class="tx">Meta do mês ${g.rampagem.mes?`(M${g.rampagem.mes})`:""}</span><span class="vv">${g.rampagem.meta}</span></div>
        <div class="trava"><span class="ic mid">›</span><span class="tx">Foco do nível D</span><span class="vv">cadastros e positivações</span></div>
        <div class="trava"><span class="ic ${g.din&&g.din.excl_ativos_out>0?"mid":"ok"}">${g.din&&g.din.excl_ativos_out>0?"!":"✓"}</span>
          <span class="tx">Hierarquia dinâmica</span><span class="vv">${g.din?`${g.din.excl} parceiros <90d`:"—"}</span></div>
      `:`
        <div class="travas">
          ${prox? inds.filter(d=>d.k!=="mb").map(d=>{
            return `<div class="trava"><span class="ic ${d.ok===true?"ok":d.ok===false?"no":"mid"}">${d.ok===true?"✓":d.ok===false?"✕":"—"}</span>
              <span class="tx">${d.nm.split(" — ")[0]} <span class="mini">— ${d.gat}</span></span>
              <span class="vv">${d.ok===true?"cumprido":d.ok===false?"pendente":"—"}</span></div>`;
          }).join("") : `<div class="trava"><span class="ic ok">✓</span><span class="tx">Nível máximo da política</span></div>`}
          <div class="trava"><span class="ic ${farol&&mbAlvoOk(g)?'ok':'mid'}">${farol&&mbAlvoOk(g)?"✓":"›"}</span>
            <span class="tx">Score MB <span class="mini">— Gatilho ${prox||"—"}: ${prox==="C"?"C1":prox==="B"?"C2":prox==="A"?"B1":"A1"}</span></span>
            <span class="vv">posição ${farol||"—"}</span></div>
        </div>
      `}
    </div>
    <div class="panel"><h3>★ Posição de destaque — nível ${DESTAQUE}</h3>
      <div class="ps">não é nível de carreira: olha só o resultado do mês anterior. Quem atinge todos os requisitos entra em destaque naquele mês.</div>
      <table><tbody>
        ${reqDest.map(r=>`<tr>
          <td style="border:0;padding:4px 0;font-size:12px">${r.nm}</td>
          <td class="num" style="border:0;padding:4px 0;font-weight:700;color:var(--lev-purple-d)">${r.val}</td>
          <td class="num mini" style="border:0;padding:4px 0">${r.req}</td>
          <td class="num" style="border:0;padding:4px 0"><span class="pill ${r.ok?"ok":"no"}">${r.ok?"✓":"✕"}</span></td>
        </tr>`).join("")}
      </tbody></table>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--line)">
        <span class="pill ${destaqueAgora?"ok":"mid"}">${destaqueAgora?"★ EM POSIÇÃO DE DESTAQUE":"— sem destaque no mês"}</span>
        <span class="mini" style="margin-left:6px">${reqDest.filter(r=>r.ok).length} de ${reqDest.length} requisitos${(g.final!=="A" && g.final!=="B")?" · exige título A ou B":""}</span>
      </div>
    </div>
  </div>
  ${painelAlavancagem(g)}
  ${gcCardHtml(g)}
  <div class="panel" style="margin-top:14px"><h3>Leitura do ciclo</h3>
    <div class="ps">resultado consolidado do mês — sem média</div>
    <table><tbody>
      ${inds.map(d=>`<tr><td style="border:0;padding:5px 0;font-size:12px">${d.nm.split(" — ")[0]}</td>
        <td class="num" style="border:0;padding:5px 0;font-weight:700;color:var(--lev-purple-d)">${d.val==null?"—":(d.k==="crc"?("R$ "+d.val.toFixed(2).replace(".",",")+"M"):(d.k==="churn"||d.k==="rec"?d.val.toFixed(1)+"%":d.k==="pac"?d.val.toFixed(0):d.val.toFixed(1)))}</td>
        <td class="num" style="border:0;padding:5px 0"><span class="pill ${d.ok===true?"ok":d.ok===false?"no":"mid"}">${d.ok===true?"✓":d.ok===false?"✕":"—"}</span></td></tr>`).join("")}
    </tbody></table>
    ${g.final==="C"?`<div class="mini" style="margin-top:9px;padding-top:8px;border-top:1px solid var(--line)">
      <b>Bônus do nível C:</b> crescimento ≥15% no mês em PAC e CRC + churn &lt;20%.
      PAC ${g.cresc?.pac!=null?(g.cresc.pac>=0?"+":"")+g.cresc.pac+"%":"—"} · CRC ${g.cresc?.crc!=null?(g.cresc.crc>=0?"+":"")+g.cresc.crc+"%":"—"}
    </div>`:""}
    <div class="mini" style="margin-top:9px;padding-top:8px;border-top:1px solid var(--line)">
      <b>Cadastros em out/2026:</b> ${g.cad_out!=null?g.cad_out.toFixed(0):"—"}
      · ${g.na_lev?"usuário ativo no Ploomes":"sem usuário no Ploomes"}
    </div>
    <div class="mini" style="margin-top:6px">Admissão: ${g.admissao||"—"} · ${g.meses_casa} meses
      ${g.rampagem&&g.rampagem.status==="ativa"?` · rampagem M${g.rampagem.mes} (${g.rampagem.meta})`:""}
      ${g.bonus&&g.bonus.bonus?` · bônus do nível: ${g.bonus.bonus}`:""}
    </div>
  </div>`;
}

function mbAlvoOk(g){
  /* alvo do PRÓXIMO nível: D→C1 · C→C2 · B→B1 */
  const prox = g.final==="D"?"C":g.final==="C"?"B":g.final==="B"?"A":null;
  const alvo = prox==="C"?"C1":prox==="B"?"C2":prox==="A"?"B1":"A1";
  const f = (g.farol && g.farol!=="#DIV/0!") ? g.farol : farolDeScore(g.score);
  return ORDEM_LUZ.indexOf(f) >= ORDEM_LUZ.indexOf(alvo);
}


/* ============ VIEW: DIRECIONAMENTOS ============ */
let dirHead = "", dirReg = "";

function dirFiltrados(){
  return GCS.filter(g => {
    if(dirHead && g.head !== dirHead) return false;
    if(dirReg && g.regional !== dirReg) return false;
    if(dirGC && g.nome !== dirGC) return false;
    return true;
  });
}
function pickDirHead(v){ dirHead = v; dirReg = ""; render(); }
function pickDirReg(v){ dirReg = v; render(); }
window.pickDirHead = pickDirHead; window.pickDirReg = pickDirReg;

/* pontos de atenção — a mesma lógica do painel */
const PONTOS = [
  {k:"atencao", nm:"Atenção redobrada", cor:"var(--lev-red)", desc:"Nível D há mais de 6 meses com carteira acima da rampagem"},
  {k:"recorrencia", nm:"Recorrência", cor:"#5B2D8E", desc:"R6 abaixo do gatilho do próximo nível"},
  {k:"churn", nm:"Churn", cor:"#A63A50", desc:"Acima do teto de 20%"},
  {k:"rampagem", nm:"Rampagem", cor:"var(--gem)", desc:"Nível D dentro do prazo — meta do mês"},
  {k:"individual", nm:"Plano individual", cor:"#8E2D5B", desc:"3+ travas ou carteira abaixo da rampagem"},
  {k:"margem", nm:"Margem", cor:"#5B2D8E", desc:"Score MB travando a subida"},
  {k:"capilaridade", nm:"Capilaridade", cor:"#B87333", desc:"Faltam parceiros ativos para o próximo nível"},
  {k:"prontos", nm:"Prontos para subir", cor:"var(--green)", desc:"Todos os critérios cumpridos"}
];

function viewDirecionamentos(){
  const heads = [...new Set(GCS.map(g=>g.head))].filter(Boolean).sort();
  if(!dirHead) dirHead = heads[0];
  const base = GCS.filter(g=>g.head===dirHead);
  const list = dirFiltrados();
  const regs = [...new Set(base.map(g=>g.regional))].filter(Boolean).sort();
  const crcT = list.reduce((a,g)=>a+(g.crc_out||0),0);
  const pubT = list.reduce((a,g)=>a+(g._pub||0),0);
  const chuT = list.reduce((a,g)=>a+(g._p_chu||0),0);

  return `
  <div class="rule"><b>Direcionamento por head.</b> Este é o material para o head conduzir com o time: primeiro o <b>retrato das carteiras por ponto de atenção</b>, depois o <b>direcionamento por gerente regional</b> e, por fim, o <b>detalhe por GC</b>.</div>

  <div class="hbar" style="margin-bottom:14px">
    <div class="f" style="background:#fff;border-color:var(--lev-purple)"><label>Head</label>
      <select id="dirHead" style="font-weight:700;color:var(--lev-purple-d)">
        ${heads.map(h=>`<option value="${esc(h)}" ${h===dirHead?"selected":""}>${esc(h)}</option>`).join("")}
      </select></div>
    <div class="f"><label>Gerente regional</label>
      <select id="dirReg"><option value="">Todos</option>${regs.map(r=>`<option value="${esc(r)}" ${r===dirReg?"selected":""}>${esc(r)}</option>`).join("")}</select></div>
    <div class="f"><label>Gerente comercial</label>
      <select id="dirGC"><option value="">Todos</option>${base.slice().sort((a,b)=>a.nome.localeCompare(b.nome)).map(g=>`<option value="${esc(g.nome)}" ${g.nome===dirGC?"selected":""}>${esc(g.nome)}</option>`).join("")}</select></div>
    <span class="tag">${list.length} GCs · ${brlM(crcT)}</span>
    <div style="display:flex;gap:3px;background:#fff;border:1px solid var(--line);border-radius:9px;padding:3px;margin-left:auto">
      <button onclick="setDirVisao('tabela')" class="vbtn ${dirVisao==="tabela"?"on":""}">▤ Tabela</button>
      <button onclick="setDirVisao('kanban')" class="vbtn ${dirVisao==="kanban"?"on":""}">▥ Kanban</button>
    </div>
  </div>
  ${dirGC?`<div class="mini" style="margin-bottom:10px">Filtrando: <b>${esc(dirGC)}</b> · <a href="#" onclick="limparDirGC();return false" style="color:var(--lev-purple)">ver todos</a></div>`:""}

  <!-- RELATÓRIO ANALÍTICO DE ENTRADA -->
  <div class="panel" style="margin-bottom:14px">
    <h3>Retrato das carteiras — pontos de atenção</h3>
    <div class="ps">onde está o volume e onde está o esforço de campo do time</div>
    <div class="kpis" style="margin-bottom:12px">
      <div class="kpi"><div class="t">GCs</div><div class="v">${list.length}</div><div class="d">na carteira do head</div></div>
      <div class="kpi"><div class="t">Produção</div><div class="v" style="font-size:17px">${brlM(crcT)}</div><div class="d">out/2026</div></div>
      <div class="kpi o"><div class="t">Parceiros a acionar</div><div class="v">${pubT}</div><div class="d">atenção redobrada + recorrência</div></div>
      <div class="kpi r"><div class="t">Fila de reconquista</div><div class="v">${chuT}</div><div class="d">churn acima de 20%</div></div>
    </div>
    ${pontosHtml(list)}
  </div>

  <!-- DIRECIONAMENTO POR REGIONAL -->
  <div class="panel" style="margin-bottom:14px">
    <h3>Direcionamento por gerente regional</h3>
    <div class="ps">o que cada regional leva para o time — clique para filtrar os GCs dela</div>
    <div class="dirgrid">
    ${regs.map(r=>{
      const gs = list.filter(g=>g.regional===r);
      if(!gs.length) return "";
      const crc = gs.reduce((a,g)=>a+(g.crc_out||0),0);
      const pub = gs.reduce((a,g)=>a+(g._pub||0),0);
      const chu = gs.reduce((a,g)=>a+(g._p_chu||0),0);
      const cnt = {}; gs.forEach(g=>{ cnt[g._alav]=(cnt[g._alav]||0)+1; });
      const top = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,3);
      return `<div class="dircard ${r===dirReg?"sel":""}" onclick="pickDirReg('${esc(r).replace(/'/g,"\\'")}')">
        <div class="cnt">${gs.length}</div>
        <div class="nm">${esc(r)}</div>
        <div class="sub">${gs.length} GC${gs.length>1?"s":""} · ${brlM(crc)}</div>
        <div class="nums">
          <div class="it" data-tip="Parceiros que produziram em no máximo 2 dos últimos 6 meses — a lista de trabalho da regional"><div class="l">Acionar</div><div class="v">${pub}</div></div>
          <div class="it" data-tip="Parceiros que produziram antes e zeraram em outubro — a fila de reconquista"><div class="l">Reconq.</div><div class="v ${chu>100?'ruim':''}">${chu}</div></div>
          <div class="it" data-tip="GCs que já cumprem todos os critérios do próximo nível — entram na janela de janeiro"><div class="l">Prontos</div><div class="v">${cnt["Prontos para subir"]||0}</div></div>
          <div class="it" data-tip="GCs no nível D há mais de 6 meses com carteira acima do teto da rampagem (25 parceiros)"><div class="l">Atenção</div><div class="v ${(cnt["Atenção redobrada"]||0)>2?'ruim':''}">${cnt["Atenção redobrada"]||0}</div></div>
        </div>
        <div class="tags">${top.map(([k,v])=>`<b>${k}</b> ${v}`).join(" · ")}</div>
      </div>`;
    }).join("")}
    </div>
  </div>

  <!-- POR GC — tabela ou kanban -->
  <div class="panel">
    <h3>${dirVisao==="kanban"?"O que cada um tem de fazer — Kanban":"O que cada um tem de fazer — Tabela"}</h3>
    <div class="ps">${dirReg?`regional: ${esc(dirReg)} · `:""}${list.length} GCs · o número de parceiros é clicável e abre a lista</div>
    ${list.length
      ? (dirVisao==="kanban" ? dirKanban(list) : dirTabela(list))
      : '<div class="mini">Nenhum GC neste filtro.</div>'}
  </div>`;
}

function pontosHtml(list){
  const grupos = {};
  PONTOS.forEach(p=>grupos[p.k]=[]);
  list.forEach(g=>{ if(grupos[g._alav]) grupos[g._alav].push(g); });
  const total = list.length||1;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px">
    ${PONTOS.map(p=>{
      const gs = grupos[p.k]||[];
      const crc = gs.reduce((a,g)=>a+(g.crc_out||0),0);
      const pct = crc/(list.reduce((a,g)=>a+(g.crc_out||0),0)||1)*100;
      if(!gs.length) return "";
      return `<div class="indc" style="min-height:auto;padding:11px 13px" data-tip="${p.desc}">
        <div class="nm" style="color:${p.cor}">${p.nm}</div>
        <div class="gt">${p.desc}</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:7px">
          <div class="vl" style="font-size:22px;margin:0">${gs.length}</div>
          <div class="mini">GC${gs.length>1?"s":""}</div>
          <div style="margin-left:auto;text-align:right">
            <div style="font-size:12px;font-weight:700;color:var(--lev-purple-d)">${brlM(crc)}</div>
            <div class="mini">${pct.toFixed(1)}%</div>
          </div>
        </div>
        <div class="mini-lv" style="color:${p.cor}">${Array.from({length:10},(_,i)=>`<i class="${i<Math.round(pct/10)?"f":""}"></i>`).join("")}</div>
      </div>`;
    }).join("")}
  </div>`;
}

function dirGcCards(list){
  const ACAO = {
    "Atenção redobrada":"Antes: perfil estudado e 2 oportunidades na mão · Semana 1: abordagem com as oportunidades do perfil · Semana 2: positivação",
    "Recorrência":"Negociação de produção com cada parceiro intermitente — e, se preciso, implantar um novo produto",
    "Churn":"Recuperar quem parou: identificar a causa da parada e negociar a volta com proposta concreta",
    "Rampagem":"Converter os cadastros que o GC já fez em primeira produção",
    "Plano individual":"Atacar uma trava por vez, com um lote de 10 parceiros por mês",
    "Margem":"Redirecionar a operação dos maiores parceiros para o produto de maior margem",
    "Capilaridade":"Prospecção com lista nominal de 23 parceiros por GC",
    "Sem tração":"Reativação de carteira — para parte deles, decisão de estrutura",
    "Prontos para subir":"Nada a fazer no campo: entram na janela de janeiro"
  };
  const ord = ["Atenção redobrada","Recorrência","Churn","Rampagem","Plano individual","Margem","Capilaridade","Sem tração","Prontos para subir"];
  return ord.map(k=>{
    const gs = list.filter(g=>g._alav===k).sort((a,b)=>(b.crc_out||0)-(a.crc_out||0));
    if(!gs.length) return "";
    const pub = gs.reduce((a,g)=>a+(g._pub||0),0);
    const chu = gs.reduce((a,g)=>a+(g._p_chu||0),0);
    return `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px">
        <h3 style="font-size:13px;color:var(--lev-purple-d)">${k}</h3>
        <span class="mini">${gs.length} GC${gs.length>1?"s":""} · ${brlM(gs.reduce((a,g)=>a+(g.crc_out||0),0))}${pub?` · ${pub} parceiros`:""}${chu?` · ${chu} a reconquistar`:""}</span>
      </div>
      <div class="mini" style="background:var(--bg);border-radius:7px;padding:6px 9px;margin-bottom:8px"><b>A ação:</b> ${ACAO[k]}</div>
      <table class="btab"><tbody>
        ${gs.map(g=>`<tr>
          <td style="width:27%"><b class="nm-link" onclick="abrirModalGC('${esc(g.nome).replace(/'/g,"\\'")}')" title="Abrir detalhes">${esc(g.nome)}</b>
            <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:19px;height:19px;vertical-align:-4px;border-radius:50%">
            <div class="mini">${esc(g.regional)} · ${g.meses_casa}m de casa</div></td>
          <td><div class="mini">
            <b>PAC</b> ${g.pac_out!=null?g.pac_out.toFixed(0):"—"} ·
            <b>R6</b> ${g.r6_out!=null?g.r6_out.toFixed(0)+"%":"—"} ·
            <b>Churn</b> ${g.churn!=null?g.churn.toFixed(0)+"%":"—"} ·
            <b>Cad.</b> ${g.cad_out?g.cad_out.toFixed(0):"—"}
            ${g._pub?` · <span style="color:var(--lev-purple);font-weight:700">${g._pub} parceiros a acionar</span>`:""}
            ${g._p_chu?` · <span style="color:var(--lev-red);font-weight:700">${g._p_chu} a reconquistar</span>`:""}
          </div></td>
          <td class="num"><span class="bdg nv${g.final}">${g.final}</span></td>
        </tr>`).join("")}
      </tbody></table>
    </div>`;
  }).join("");
}


/* ============ VIEW: RELATÓRIO DE PAGAMENTOS ============ */
let pagHD = true;   /* true = aplica hierarquia dinâmica (padrão) */
function setPagHD(v){ pagHD = v; render(); }
window.setPagHD = setPagHD;

function viewPagamentos(){
  const list = filtered();
  /* escolhe qual bônus usar conforme o toggle; aplica a inelegibilidade */
  const B = g => {
    const base = (pagHD ? (g.bonus_din||g.bonus) : g.bonus) || {};
    if(!inelegivel(g)) return base;
    return Object.assign({}, base, {
      atingiu: base.atingiu,
      bonus_efetivo: 0,
      inelegivel: true,
      inelegivel_motivo: `Nível D com ${g.meses_casa} meses — acima do limite de ${mesesIneq} meses`
    });
  };
  const atingiu = g => B(g).atingiu === true;
  const recebe  = g => (B(g).bonus_efetivo||0) > 0;
  const zerado  = g => atingiu(g) && !recebe(g);
  const naoAting= g => B(g).atingiu === false;
  const pagos = list.filter(recebe);
  const zeros = list.filter(zerado);
  const naos  = list.filter(naoAting);
  const totPago = pagos.reduce((a,g)=>a+(B(g).bonus_efetivo||0),0);
  const totNominal = list.filter(atingiu).reduce((a,g)=>a+(B(g).bonus_nominal||0),0);

  /* --- hierarquia dinâmica --- */
  const comHD = list.filter(g=>((g.din||{}).excl||0)>0);
  const totSemHD = list.reduce((a,g)=>a+(g.bonus.bonus_efetivo||0),0);
  const totComHD = list.reduce((a,g)=>a+((g.bonus_din||{}).bonus_efetivo||0),0);
  const perdidosHD = totSemHD - totComHD;
  const qtPerdidos = list.filter(g=>{
    const b=g.bonus.bonus_efetivo||0, bd=(g.bonus_din||{}).bonus_efetivo||0;
    return bd < b;
  }).length;

  /* --- gráficos clicáveis --- */
  const filtroTempo = state.tempo||"";
  const filtroNivel = state.nivel||"";

  const faixas = [
    {k:"0-6", nm:"até 6 meses", f:g=>(g.meses_casa||0)<=6},
    {k:"6-12", nm:"6 a 12 meses", f:g=>(g.meses_casa||0)>6 && (g.meses_casa||0)<=12},
    {k:"12-24", nm:"1 a 2 anos", f:g=>(g.meses_casa||0)>12 && (g.meses_casa||0)<=24},
    {k:"24-48", nm:"2 a 4 anos", f:g=>(g.meses_casa||0)>24 && (g.meses_casa||0)<=48},
    {k:"48+", nm:"4+ anos", f:g=>(g.meses_casa||0)>48}
  ];
  const porTempo = faixas.map(fx=>{
    const gs = list.filter(fx.f), p = gs.filter(recebe);
    return {k:fx.k, nm:fx.nm, n:gs.length, pagos:p.length, v:p.reduce((a,g)=>a+(B(g).bonus_efetivo||0),0)};
  });
  const maxTempo = Math.max(...porTempo.map(x=>x.v),1);

  const porEstagio = ["D","C","B","A"].map(nv=>{
    const gs = list.filter(g=>g.final===nv), p = gs.filter(recebe);
    return {k:nv, n:gs.length, pagos:p.length, zeros:gs.filter(zerado).length,
            v:p.reduce((a,g)=>a+(B(g).bonus_efetivo||0),0),
            vCom:p.reduce((a,g)=>a+((g.bonus_din||{}).bonus_efetivo||0),0)};
  }).filter(x=>x.n);

  /* --- D antigo --- */
  const dAntigo = list.filter(g=>g.final==="D" && (g.meses_casa||0)>6 && (g.pac_out||0)>25);
  const dAntigoPago = dAntigo.filter(recebe);
  const totDAntigo = dAntigoPago.reduce((a,g)=>a+(B(g).bonus_efetivo||0),0);

  const selTempo = filtroTempo;
  const selNivel = filtroNivel;

  return `
  <div class="panel" style="margin-bottom:14px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:${pagHD?"linear-gradient(90deg,#E2F2E8,#F5FBF7)":"linear-gradient(90deg,#FDF0DD,#FFFBF3)"};border-color:${pagHD?"#CFE7D7":"#F2DDB8"}">
    <div style="flex:1;min-width:260px">
      <div style="font-size:13px;font-weight:800;color:${pagHD?"var(--green)":"#8A6210"}">
        ${pagHD ? "✅ Hierarquia dinâmica ATIVA" : "⚠️ Hierarquia dinâmica DESATIVADA"}
      </div>
      <div class="mini" style="margin-top:3px;color:${pagHD?"#3D7A57":"#8A6210"}">
        ${pagHD
          ? "O bônus considera só os parceiros que o GC construiu — quem já produzia antes de entrar na carteira é desconsiderado por 90 dias."
          : "O bônus usa o PAC bruto, sem descontar os parceiros que já produziam antes. Os valores pagos ficam maiores."}
      </div>
    </div>
    <div style="display:flex;gap:6px;background:#fff;border:1px solid ${pagHD?"#CFE7D7":"#F2DDB8"};border-radius:9px;padding:3px">
      <button onclick="setPagHD(true)" style="border:0;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;
        background:${pagHD?"var(--green)":"transparent"};color:${pagHD?"#fff":"var(--mut)"}">Com hierarquia</button>
      <button onclick="setPagHD(false)" style="border:0;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;
        background:${!pagHD?"var(--gem)":"transparent"};color:${!pagHD?"#fff":"var(--mut)"}">Sem hierarquia</button>
    </div>
  </div>

  ${barraIneq(list, B)}

  <div class="rule"><b>Relatório de pagamentos — outubro/2026.</b> Clique nos gráficos para filtrar. Os valores ${pagHD?"já consideram a <b>hierarquia dinâmica</b>":"<b>não</b> consideram a hierarquia dinâmica"} e o <b>teto remuneratório</b> do nível.</div>

  <div class="panel" style="margin-bottom:14px;background:linear-gradient(90deg,#F3EDFA,#FDF4EA);border-color:#E0D4F0">
    <h3 style="color:var(--lev-purple-d)">O que é a hierarquia dinâmica</h3>
    <div style="font-size:12px;color:#4A3A63;line-height:1.75;margin-top:6px">
      Quando um gerente comercial recebe uma carteira, alguns parceiros que chegam já <b>produziam antes</b> — a produção deles não nasceu da gestão dele.
      A regra desconsidera esses parceiros do PAC por <b>90 dias</b>: conta só o que o GC efetivamente construiu.
      <br><br>
      <b>Sem a regra:</b> R$ ${fmtN(totSemHD)} pagos · <b>Com a regra:</b> R$ ${fmtN(totComHD)} ·
      <b>Deixado de pagar:</b> <span style="color:var(--lev-red);font-weight:700">R$ ${fmtN(perdidosHD)}</span> em ${qtPerdidos} GC${qtPerdidos>1?"s":""}.
    </div>
  </div>

  <div class="kpis" style="margin-bottom:14px">
    <div class="kpi g"><div class="t">Pago no mês</div><div class="v" style="font-size:18px">R$ ${fmtN(totPago)}</div><div class="d">${pagos.length} GCs recebem</div></div>
    <div class="kpi o"><div class="t">Atingiram, teto zerou</div><div class="v">${zeros.length}</div><div class="d">salário consome o teto</div></div>
    <div class="kpi r"><div class="t">Não atingiram</div><div class="v">${naos.length}</div><div class="d">critério pendente</div></div>
    <div class="kpi"><div class="t">Nominal se todos pagassem</div><div class="v" style="font-size:17px">R$ ${fmtN(totNominal)}</div><div class="d">${list.filter(atingiu).length} GCs cumpriram</div></div>
  </div>

  <div class="grid" style="margin-bottom:14px">
    <div class="panel">
      <h3>Bônus por tempo de casa</h3>
      <div class="ps">clique para filtrar · ${selTempo?`<a href="#" onclick="filtraTempo('');return false" style="color:var(--lev-purple)">limpar</a>`:"filtro ativo: todos"}</div>
      ${porTempo.map(x=>`<div class="chbar ${selTempo===x.k?"sel":""}" onclick="filtraTempo('${x.k}')">
        <div style="width:96px;font-size:11.5px;font-weight:600;color:var(--lev-purple-d)">${x.nm}</div>
        <div class="bar" style="flex:1;height:20px;border-radius:5px"><i style="width:${(x.v/maxTempo)*100}%;background:linear-gradient(90deg,#5B2D8E,#8E2D5B);border-radius:5px"></i></div>
        <div style="width:74px;text-align:right;font-size:11px;font-weight:700;color:var(--lev-purple-d)">R$ ${fmtN(x.v)}</div>
        <div class="mini" style="width:52px;text-align:right">${x.pagos}/${x.n}</div>
      </div>`).join("")}
    </div>
    <div class="panel">
      <h3>Bônus por estágio</h3>
      <div class="ps">clique para filtrar · ${selNivel?`<a href="#" onclick="filtraNivel('');return false" style="color:var(--lev-purple)">limpar</a>`:"filtro ativo: todos"}</div>
      ${porEstagio.map(e=>`<div class="chbar ${selNivel===e.k?"sel":""}" onclick="filtraNivel('${e.k}')">
        <div style="width:34px"><span class="bdg nv${e.k}">${e.k}</span></div>
        <div style="flex:1">
          <div style="display:flex;gap:8px;font-size:11px;color:var(--mut)">
            <span><b style="color:var(--lev-purple-d)">${e.pagos}</b> recebem</span>
            <span><b style="color:var(--lev-red)">${e.zeros}</b> zerados</span>
            <span>de ${e.n}</span>
          </div>
          <div class="bar" style="height:6px;margin-top:4px"><i style="width:${e.n?(e.pagos/e.n*100):0}%;background:var(--green)"></i></div>
        </div>
        <div style="width:84px;text-align:right">
          <div style="font-size:11.5px;font-weight:700;color:var(--lev-purple-d)">R$ ${fmtN(e.v)}</div>
          <div class="mini">c/ HD R$ ${fmtN(e.vCom)}</div>
        </div>
      </div>`).join("")}
    </div>
  </div>

  <div class="panel" style="margin-bottom:14px">
    <h3>Quem recebe — e por quê</h3>
    <div class="ps">o motivo está explícito em cada linha: critério cumprido, teto aplicado ou critério pendente</div>
    <table class="btab"><tbody>
    ${list.filter(g=>atingiu(g)||recebe(g)).sort((a,b)=>(B(b).bonus_efetivo||0)-(B(a).bonus_efetivo||0)).map(g=>{
      const b = B(g), ef = b.bonus_efetivo||0;
      const crit = (b.linhas||[]).map(l=>`${l[0]} → <b>${l[2]}</b> ${l[3]===true?"✓":l[3]===false?"✕":"—"}`).join(" · ");
      const motivo = b.inelegivel ? "inelegível pela regra de tempo de casa"
        : !b.atingiu ? "critério não cumprido"
        : ef===0 ? "atingiu, mas o salário já consome o teto"
        : ef<(b.bonus_nominal||0) ? "atingiu — bônus reduzido pelo teto"
        : "atingiu o critério → bônus integral";
      const cor = b.inelegivel?"#8A6210":!b.atingiu?"var(--mut)":ef===0?"var(--lev-red)":ef<(b.bonus_nominal||0)?"var(--gem)":"var(--green)";
      return `<tr>
        <td style="width:22%"><b class="nm-link" onclick="abrirModalGC('${esc(g.nome).replace(/'/g,"\\'")}')" title="Abrir detalhes">${esc(g.nome)}</b>
          <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:18px;height:18px;vertical-align:-4px;border-radius:50%">
          <div class="mini">${esc(g.regional)} · ${g.meses_casa}m</div></td>
        <td><div class="mini" style="line-height:1.7">${crit||"sem critério apurado"}</div></td>
        <td style="width:26%"><div style="font-size:11px;font-weight:700;color:${cor};line-height:1.5">${motivo}</div>
          <div class="mini">salário R$ ${fmtN(b.salario||0)} · teto R$ ${fmtN(b.teto||0)}</div></td>
        <td class="num" style="width:12%"><span class="bdg" style="background:${cor};color:#fff">${ef?"R$ "+fmtN(ef):"R$ 0"}</span></td>
      </tr>`;}).join("")}
    </tbody></table>
  </div>

  <div class="panel">
    <h3>O caso do nível D antigo</h3>
    <div class="ps">GCs no nível D há mais de 6 meses e com mais de 25 parceiros — já passaram do prazo da rampagem</div>
    <div class="paygrid" style="margin-bottom:12px">
      <div class="paycard r"><div class="l">GCs nesta condição</div><div class="v">${dAntigo.length}</div><div class="d">D · +6 meses · +25 parceiros</div></div>
      <div class="paycard o"><div class="l">Pago hoje a eles</div><div class="v">R$ ${fmtN(totDAntigo)}</div><div class="d">${dAntigoPago.length} GCs recebem</div></div>
      <div class="paycard g"><div class="l">Economia anual se não pagar</div><div class="v">R$ ${fmtN(totDAntigo*12)}</div><div class="d">já perderam o direito à rampagem</div></div>
    </div>
    <table><thead><tr><th>GC</th><th class="num">Casa</th><th class="num">PAC</th><th class="num">Recebe</th><th class="num">Nominal</th><th class="num">Ano</th></tr></thead><tbody>
    ${dAntigo.sort((a,b)=>(B(b).bonus_efetivo||0)-(B(a).bonus_efetivo||0)).map(g=>{
      const v=B(g).bonus_efetivo||0;
      return `<tr><td><b class="nm-link" onclick="abrirModalGC('${esc(g.nome).replace(/'/g,"\\'")}')" title="Abrir detalhes">${esc(g.nome)}</b><div class="mini">${esc(g.regional)}</div></td>
        <td class="num">${g.meses_casa}m</td><td class="num">${g.pac_out.toFixed(0)}</td>
        <td class="num" style="color:${v?"var(--green)":"var(--mut)"}">${v?"R$ "+fmtN(v):"—"}</td>
        <td class="num">R$ ${fmtN(B(g).bonus_nominal||0)}</td>
        <td class="num">${v?"R$ "+fmtN(v*12):"—"}</td></tr>`;}).join("")}
    </tbody></table>
  </div>`;
}
function filtraTempo(v){ state.tempo = (state.tempo===v)?"":v; render(); }
window.filtraTempo = filtraTempo;


/* ============ CHAT DETERMINÍSTICO (sem IA) ============ */
function normTxt(t){
  return String(t||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s%.,-]/g," ").replace(/\s+/g," ").trim();
}
function fmtBR(v,d){ return v==null?"—":Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d||0,maximumFractionDigits:d||0}); }
function pct(v){ return v==null?"—":fmtBR(v,1)+"%"; }
function brl(v){ return v==null?"—":"R$ "+fmtBR(v/1e6,2)+"M"; }

const CAMPOS = [
  {k:"pac_out", nm:"PAC", aliases:["pac","parceiros ativos","parceiro ativo","positivados"]},
  {k:"r6_out",  nm:"R6 (recorrência)", aliases:["r6","recorrencia","recorrência"]},
  {k:"churn", nm:"Churn (média 6M)", aliases:["churn"]},
  {k:"crc_out", nm:"Produção (CRC)", aliases:["crc","producao","produção","volume"]},
  {k:"cad_out", nm:"Cadastros", aliases:["cadastro","cadastros","cad"]},
  {k:"score",   nm:"Score MB", aliases:["score","margem","mb","score mb"]},
  {k:"meses_casa", nm:"Tempo de casa", aliases:["tempo de casa","meses","casa","tempo"]},
  {k:"bonus_efetivo", nm:"Bônus", aliases:["bonus","bônus","pagamento"]}
];





/* ============ CONSTANTES DO PPC ============ */
/* Janela das médias: 2026 usa 3 meses; a partir de 2027 passa a 6 meses. */
const ANO_JANELA = (new Date()).getFullYear();
const JANELA = ANO_JANELA >= 2027 ? 6 : 3;
const JANELA_ROT = JANELA + "M";          /* rótulo curto: "3M" / "6M" */
const PPC = {
  rec: {C:20,  B:50,  A:70,  AB:80},
  pac: {C:25,  B:40,  A:60,  AB:70},
  crc: {C:1.0, B:2.0, A:3.0, AB:2.5},
  churnMax: 20
};
const NIVEIS = ["D","C","B","A"];          /* AB+ não é nível: é posição de destaque mensal */
const NIVEL_LONGO = { D:"Geração", C:"Evolução", B:"Consolidação", A:"Consagração" };
const DESTAQUE = "Extraordinário";         /* posição de destaque mensal (antigo AB+) */
/* formatação numérica usada em várias views */
function fmtN(v){ return v==null?"—":Number(v).toLocaleString("pt-BR",{maximumFractionDigits:0}); }
const ORDEM_IND = ["crc","pac","churn","rec"];   /* Score MB vive no semáforo */
const ORDEM_LUZ = ["D1","D2","D3","C1","C2","C3","B1","B2","B3","A1"];
const FAIXA_MB = [
  ["D1",0,25],["D2",25,45],["D3",45,55],
  ["C1",55,60],["C2",60,65],["C3",65,70],
  ["B1",70,75],["B2",75,80],["B3",80,95],["A1",95,999]
];

/* ============ CONTROLES DE UI (sidebar, filtros, menu mobile) ============ */
function toggleSidebar(){
  document.body.classList.toggle("sb-min");
  try{ localStorage.setItem("ppc_sb", document.body.classList.contains("sb-min") ? "1" : "0"); }catch(e){}
}
window.toggleSidebar = toggleSidebar;

function toggleFiltros(){
  const w = el("fbarTop");
  if(w){ w.classList.toggle("recolhida"); return; }
  const h = el("filtros");
  if(h) h.classList.toggle("aberto");
}
window.toggleFiltros = toggleFiltros;

function abrirMais(){ const m = el("maisSheet"); if(m) m.style.display = "block"; }
function fecharMais(){ const m = el("maisSheet"); if(m) m.style.display = "none"; }
window.abrirMais = abrirMais; window.fecharMais = fecharMais;

/* restaura o estado da sidebar salvo */
(function(){
  try{ if(localStorage.getItem("ppc_sb")==="1") document.body.classList.add("sb-min"); }catch(e){}
  /* no celular, a barra de filtros começa recolhida */
  if(window.matchMedia && window.matchMedia("(max-width:820px)").matches){
    document.addEventListener("DOMContentLoaded", function(){
      const f = document.getElementById("fbarTop");
      if(f) f.classList.add("recolhida");
    });
  }
})();

/* ============ NÚCLEO: TÍTULOS, FILTROS E RENDER ============ */
const TITLES = {
  painel: ["Painel Geral — PPC Lev","Posição consolidada (jan/jul) · PAC e R6 do último mês · CRC, Churn e Score MB na média 6M"],
  bonus: ["Acompanhamento de Bônus de Performance","Quem atingiu e quem não atingiu os critérios do mês, por nível"],
  dinamica: ["Acompanhamento de Bônus","Mesmo critério, desconsiderando parceiros com menos de 90 dias na carteira que já produziam antes"],
  gc: ["Análise por GC","Leitura individual: indicadores do PPC, esforço no Ploomes e desempenho de 6 meses"],
  dir: ["Direcionamentos","O retrato das carteiras por ponto de atenção e o direcionamento por regional e por GC"],
  pag: ["Relatório de Pagamentos de Bônus","Visão aglomerada: hierarquia dinâmica, tempo de casa, estágio e o impacto do teto"],
  chat: ["Perguntar sobre os dados","Respostas por regra sobre a base — o número é o mesmo do painel"],
  sug: ["Sugerir melhoria","Sua ideia entra na fila de análise do administrador"],
  adm: ["Administração","Área restrita: sugestões, perfis e visibilidade"]
};

function go(v){
  state.view = v;
  if(location.hash !== "#"+v) location.hash = v;
  render();
}
window.go = go;

function renderFiltros(){
  /* Pagamentos usa os MESMOS filtros globais (head, regional, nível, tempo, rampagem) */
  if(["dir","chat","sug","adm"].includes(state.view)){
    const fx = el("filtros"); if(fx) fx.innerHTML = "";
    const c0 = el("fcount"); if(c0){ c0.textContent="0"; c0.style.opacity=.4; }
    return;
  }
  if(state.view === "gc"){
    const lista = GCS.slice().sort((a,b)=>a.nome.localeCompare(b.nome));
    const atual = lista.some(g=>g.nome===gcSel) ? gcSel : (lista[0]&&lista[0].nome);
    el("filtros").innerHTML = `
      <div class="f" style="background:#fff;border-color:var(--lev-purple)"><label>Gerente comercial</label>
        <select id="gcPickTop" style="min-width:230px;font-weight:700;color:var(--lev-purple-d)">
          ${lista.map(g=>`<option ${g.nome===atual?"selected":""}>${esc(g.nome)}</option>`).join("")}
        </select></div>
      <span class="tag">${lista.length} GCs na base</span>`;
    el("gcPickTop").addEventListener("change", e=>pickGC(e.target.value));
    const c1 = el("fcount"); if(c1){ c1.textContent="1"; c1.style.opacity=1; }
    return;
  }
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
      <option value="36-48" ${state.tempo==="36-48"?"selected":""}>3–4 anos</option>
      <option value="48-9999" ${state.tempo==="48-9999"?"selected":""}>4+ anos</option></select></div>
    <div class="f"><label>Rampagem</label><select id="framp"><option value="">Todas</option><option value="ativa" ${state.ramp==="ativa"?"selected":""}>Ativa (até o 6º mês)</option><option value="m6" ${state.ramp==="m6"?"selected":""}>M6 (passou do 6º mês)</option></select></div>
    <span class="tag" id="tagCount">${filtered().length} GCs</span>`;
  el("fhead").addEventListener("change",e=>{state.head=e.target.value;state.reg="";render()});
  el("freg").addEventListener("change",e=>{state.reg=e.target.value;render()});
  el("fnivel").addEventListener("change",e=>{state.nivel=e.target.value;render()});
  el("ftempo").addEventListener("change",e=>{state.tempo=e.target.value;render()});
  el("framp").addEventListener("change",e=>{state.ramp=e.target.value;render()});
  const n = [state.head,state.reg,state.nivel,state.tempo,state.ramp].filter(Boolean).length;
  setTimeout(()=>{ const c = el("fcount"); if(c){ c.textContent = n; c.style.opacity = n?1:.45; } }, 0);
}

function render(){
  if(!podeVer(state.view)){
    const prim = secoesVisiveis()[0];
    if(prim) state.view = prim.k;
  }
  if(state.view==="gc"){ const a = gcAtual(); if(a) gcSel = a.nome; if(gcAba==="ppc") gcAba="esforco"; }
  const t = TITLES[state.view] || ["PPC Lev",""];
  el("vtitle").textContent = t[0];
  el("vsub").textContent = t[1];
  renderFiltros();
  el("view").innerHTML = state.view==="painel"?viewPainel()
    :state.view==="bonus"?viewBonus()
    :state.view==="dinamica"?viewBonus()
    :state.view==="gc"?viewGC()
    :state.view==="dir"?viewDirecionamentos()
    :state.view==="chat"?viewChat()
    :state.view==="sug"?viewSugestao()
    :state.view==="adm"?viewAdmin()
    :viewPagamentos();
  if(state.view==="painel"){
    const sb = el("sortBtns");
    if(sb) sb.innerHTML = `<span class="mini" style="align-self:center">Ordenar por:</span>`+
      [["pac","PAC"],["r6","R6"],["churn","Churn"],["crc_live","CRC Ploomes"],["cad_out","Cadastros"],["meses_casa","Tempo de casa"],["trava","Travas"],["nome","Nome"]]
      .map(([k,l])=>`<button class="${state.sort===k?'on':''}" onclick="setSort('${k}')">${l}</button>`).join("");
  }
  document.querySelectorAll(".indc.indclick").forEach(c=>{
    c.onclick = function(){
      const fn = window[this.dataset.clk];
      if(typeof fn === "function") fn(this.dataset.gc, this.dataset.arg);
    };
  });
  document.querySelectorAll("aside nav button, .mnav button").forEach(b=>b.classList.toggle("on", b.dataset.v===state.view));
  if(state.view==="dir") ligarFiltrosDir();
  aplicaVisibilidade();
  const sel = el("selPerfil");
  if(sel && sel.value !== PERFIS.ativo) sel.value = PERFIS.ativo;
}

function setSort(k){ state.sort = k; state.dir = (state.dir===-1?1:-1); render(); }
window.setSort = setSort;

/* inicialização: rota por hash */
function bootView(){
  const h = (location.hash||"").replace("#","");
  const validas = Object.keys(TITLES);
  if(h && validas.includes(h)) state.view = h;
  render();
}
window.addEventListener("hashchange", ()=>{
  const h = (location.hash||"").replace("#","");
  if(h && TITLES[h] && state.view!==h){ state.view = h; render(); }
});





/* ============ POPUPS DOS INDICADORES ============ */
/* Recorrência: funil PAC → R2 → R3 → R4 → R5 → R6
   Produção / PAC / Churn: série dos últimos 3 meses + média */

function fecharIndModal(){
  const m = el("indModal");
  if(m) m.style.display = "none";
  document.body.style.overflow = "";
}
window.fecharIndModal = fecharIndModal;

function abreIndModal(html, largura){
  let m = el("indModal");
  if(!m){
    m = document.createElement("div");
    m.id = "indModal"; m.className = "gcm-back";
    m.onclick = e => { if(e.target===m) fecharIndModal(); };
    document.body.appendChild(m);
  }
  m.style.display = "flex";
  document.body.style.overflow = "hidden";
  m.innerHTML = `<div class="gcm" style="max-width:${largura||760}px" onclick="event.stopPropagation()">${html}</div>`;
}

/* ---- 1. DISTRIBUIÇÃO DE RECORRÊNCIA (NP → R6) ----
   Definição do Leo: faixas EXCLUSIVAS de meses consecutivos de produção,
   fechadas no mês anterior (outubro). NP = novo producente (só o mês). */
function abrirFunilR6(nomeGC){
  const f = (typeof FUNIL !== "undefined" && FUNIL.funil) ? FUNIL.funil[nomeGC] : null;
  if(!f){ abreIndModal(`<div class="gcm-body"><div class="mini">Sem dados de recorrência para ${esc(nomeGC)}.</div></div>`); return; }

  const faixas = [
    {k:"np", rot:"NP", cor:"#7A7186", desc:"novo producente — só outubro"},
    {k:"r2", rot:"R2", cor:"#8E2D5B", desc:"set e out (2 meses)"},
    {k:"r3", rot:"R3", cor:"#7B4DAE", desc:"ago, set e out"},
    {k:"r4", rot:"R4", cor:"#6B3D9E", desc:"jul a out"},
    {k:"r5", rot:"R5", cor:"#5B2D8E", desc:"jun a out"},
    {k:"r6", rot:"R6", cor:"#2E7D4F", desc:"mai a out — 6+ meses"}
  ];
  const pac = f.pac || 1;
  const alt = 200;
  const pctR6 = (f.r6/pac*100);

  abreIndModal(`
    <div class="gcm-head">
      <div>
        <div style="font-size:16px;font-weight:800;color:var(--lev-purple-d)">Recorrência — ${esc(nomeGC)}</div>
        <div class="mini">meses consecutivos de produção, fechados em <b>outubro</b> · cada parceiro aparece em uma única faixa</div>
      </div>
      <button onclick="fecharIndModal()" style="background:none;border:0;font-size:22px;color:var(--mut);cursor:pointer">✕</button>
    </div>
    <div class="gcm-body">
      <div style="display:flex;align-items:flex-end;gap:7px;height:${alt+46}px;padding:10px 0 0">
        ${faixas.map(e=>{
          const v = f[e.k] || 0;
          const h = Math.max(8, (v/pac) * alt);
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
            <div style="font-size:15px;font-weight:800;color:${e.cor};margin-bottom:2px">${v}</div>
            <div style="font-size:9px;color:var(--mut);font-weight:700;margin-bottom:4px">${(v/pac*100).toFixed(0)}%</div>
            <div style="width:100%;height:${h}px;background:${e.cor};border-radius:6px 6px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:5px">
              <span style="font-size:10.5px;font-weight:800;color:#fff">${e.rot}</span></div>
            <div style="font-size:8px;color:var(--mut);text-align:center;line-height:1.25;margin-top:4px;min-height:22px">${e.desc}</div>
          </div>`;
        }).join("")}
      </div>

      <div style="margin-top:14px;padding:12px 14px;background:linear-gradient(90deg,#E2F2E8,#F5FBF7);border:1px solid #CFE7D7;border-radius:10px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div>
          <div class="mini" style="color:#3D7A57;font-weight:700;text-transform:uppercase;letter-spacing:.6px">Parceiros em R6</div>
          <div style="font-size:30px;font-weight:800;color:var(--green);line-height:1">${f.r6}</div>
        </div>
        <div style="flex:1;min-width:190px">
          <div class="mini" style="color:#3D7A57;line-height:1.7">de <b>${f.pac}</b> parceiros ativos em outubro ·
            <b>${pctR6.toFixed(0)}%</b> da carteira é R6<br>
            <span style="color:var(--lev-red)">${(100-pctR6).toFixed(0)}% ainda não chegou a 6 meses seguidos</span></div>
        </div>
      </div>

      <div style="margin-top:10px;font-size:11px;color:var(--mut);line-height:1.7">
        <b>Como ler:</b> as faixas são exclusivas e somam a carteira ativa (${f.pac} parceiros).
        NP + R2 + R3 + R4 + R5 + R6 = ${f.np+f.r2+f.r3+f.r4+f.r5+f.r6}.
        O PPC trabalha com fechamento: a régua é sempre a produção até o mês anterior ao corrente.
      </div>
    </div>`);
}
window.abrirFunilR6 = abrirFunilR6;

/* ---- 2. SÉRIE DE 3 MESES (produção / PAC / churn) ---- */
function abrirSerie3(nomeGC, tipo){
  const g = GCS.find(x=>x.nome===nomeGC);
  if(!g) return;
  const s3 = (typeof FUNIL !== "undefined" && FUNIL.serie3) ? FUNIL.serie3[nomeGC] : null;
  if(!s3){ abreIndModal(`<div class="gcm-body"><div class="mini">Sem série para ${esc(nomeGC)}.</div></div>`); return; }

  const meses = [["agosto","ago"],["setembro","set"],["outubro","out"]];
  let vals = [], rot = "", cor = "", fmtV = v=>v, mediaLbl = "";

  if(tipo==="producao"){
    vals = meses.map(([m])=>s3[m].producao);
    rot = "Produção (CRC)"; cor = "#5B2D8E"; fmtV = v => "R$ " + fmtN(v/1e6*1e6/1e6*1) + "M";
    fmtV = v => "R$ " + (v/1e6).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) + "M";
  } else if(tipo==="pac"){
    vals = meses.map(([m])=>s3[m].pac);
    rot = "PAC — parceiros ativos"; cor = "#2E7D4F"; fmtV = v => fmtN(v);
  } else {
    // churn: usa o churn_serie já calculado
    const cs = g.churn_serie || {};
    vals = meses.map(([m,ab])=>(cs[ab]&&cs[ab].churn!=null)?cs[ab].churn:0);
    rot = "Churn"; cor = "#A63A50"; fmtV = v => v.toFixed(1)+"%";
  }

  const media = vals.reduce((a,b)=>a+b,0)/vals.length;
  const max = Math.max(...vals, 1);
  const calculaMedia = (tipo!=="pac");

  abreIndModal(`
    <div class="gcm-head">
      <div>
        <div style="font-size:16px;font-weight:800;color:var(--lev-purple-d)">${rot} — ${esc(nomeGC)}</div>
        <div class="mini">${calculaMedia?"média dos últimos 3 meses (janela de 2026)":"valor do mês — PAC não usa média"}</div>
      </div>
      <button onclick="fecharIndModal()" style="background:none;border:0;font-size:22px;color:var(--mut);cursor:pointer">✕</button>
    </div>
    <div class="gcm-body">
      <div style="display:flex;align-items:flex-end;gap:14px;height:210px;padding:8px 0 0">
        ${vals.map((v,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
          <div style="font-size:13px;font-weight:800;color:${cor};margin-bottom:4px">${fmtV(v)}</div>
          <div style="width:100%;max-width:110px;height:${Math.max(12,(v/max)*160)}px;background:${i===2?cor:"#C9B6DE"};border-radius:7px 7px 0 0"></div>
          <div style="font-size:10.5px;color:var(--mut);font-weight:700;margin-top:6px">${meses[i][1]}</div>
        </div>`).join("")}
      </div>

      ${calculaMedia?`<div style="margin-top:16px;padding:13px 15px;background:#F3EDFA;border:1px solid #E0D4F0;border-radius:10px">
        <div class="mini" style="color:var(--lev-purple);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px">Como a média é calculada</div>
        <div style="font-size:12.5px;color:var(--lev-purple-d);line-height:1.9">
          (${valoresTexto(vals, fmtV)}) ÷ 3 =
          <b style="font-size:16px;color:${cor}">${fmtV(media)}</b>
        </div>
        <div class="mini" style="margin-top:6px">É este valor que aparece no indicador do painel.</div>
      </div>
      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
        <div class="paycard" style="flex:1;min-width:130px"><div class="l">Média 3M</div><div class="v" style="font-size:20px">${fmtV(media)}</div></div>
        <div class="paycard ${vals[2]>=vals[0]?"g":"r"}" style="flex:1;min-width:130px"><div class="l">Tendência</div>
          <div class="v" style="font-size:17px">${vals[2]>=vals[0]?"subindo":"caindo"}</div>
          <div class="d">${fmtV(vals[0])} → ${fmtV(vals[2])}</div></div>
      </div>`:`
      <div style="margin-top:16px;padding:13px 15px;background:#EDF7F0;border:1px solid #CFE7D7;border-radius:10px">
        <div class="mini" style="color:#3D7A57;line-height:1.7">PAC é a <b>quantidade de parceiros com produção no mês</b> — não se calcula média aqui.
        O valor do indicador é o de <b>outubro</b>: <b style="font-size:15px">${fmtN(vals[2])}</b> parceiros.</div>
      </div>`}
    </div>`);
}
function valoresTexto(vals, fmt){ return vals.map(v=>fmt(v)).join(" + "); }
window.abrirSerie3 = abrirSerie3;

/* ============ DIRECIONAMENTOS: filtro por GC + visão tabela/kanban ============ */
let dirVisao = "tabela";     /* "tabela" | "kanban" */
let dirGC = "";              /* nome do GC para filtrar um só */

function setDirVisao(v){ dirVisao = v; render(); }
function setDirGC(v){ dirGC = v; render(); }
function limparDirGC(){ dirGC = ""; render(); }
window.setDirVisao = setDirVisao; window.setDirGC = setDirGC; window.limparDirGC = limparDirGC;

/* abre a lista de parceiros de um número */
function abrirListaParceiros(nomeGC, tipo){
  const g = GCS.find(x=>x.nome===nomeGC);
  if(!g) return;
  const todos = PARCEIROS[nomeGC] || [];
  let sel = [], titulo = "", desc = "";
  if(tipo==="acionar"){
    sel = todos.filter(p=>p[2]<=2 && p[1]>0);
    titulo = `Parceiros a acionar — ${nomeGC}`;
    desc = "produziram em no máximo 2 dos últimos 6 meses";
  } else if(tipo==="reconquista"){
    sel = todos.filter(p=>p[1]<=0 && p[2]>0);
    titulo = `Fila de reconquista — ${nomeGC}`;
    desc = "produziram antes e zeraram em outubro";
  } else if(tipo==="carteira"){
    sel = todos.filter(p=>p[1]>0);
    titulo = `Carteira ativa — ${nomeGC}`;
    desc = "parceiros com produção em outubro";
  } else {
    sel = todos;
    titulo = `Todos os parceiros — ${nomeGC}`;
    desc = `${todos.length} parceiros na base`;
  }
  let m = el("parcModal");
  if(!m){
    m = document.createElement("div");
    m.id = "parcModal"; m.className = "gcm-back";
    m.onclick = e => { if(e.target===m) fecharListaParceiros(); };
    document.body.appendChild(m);
  }
  m.style.display = "flex";
  document.body.style.overflow = "hidden";
  const total = sel.reduce((a,p)=>a+p[1],0);
  m.innerHTML = `<div class="gcm" style="max-width:820px" onclick="event.stopPropagation()">
    <div class="gcm-head">
      <div>
        <div style="font-size:16px;font-weight:800;color:var(--lev-purple-d)">${esc(titulo)}</div>
        <div class="mini">${esc(desc)} · ${sel.length} parceiros${total?" · R$ "+fmtN(total/1e6*1e6/1e6*1)+"M":""}</div>
      </div>
      <button onclick="fecharListaParceiros()" style="background:none;border:0;font-size:22px;color:var(--mut);cursor:pointer">✕</button>
    </div>
    <div class="gcm-body">
      ${sel.length?`<table><thead><tr><th>Parceiro</th><th class="num">Produção out</th><th class="num">Meses ativos (6m)</th></tr></thead><tbody>
        ${sel.slice(0,400).map(p=>`<tr>
          <td style="font-size:11.5px">${esc(p[0])}</td>
          <td class="num">${p[1]>0?"R$ "+fmtN(p[1]):"—"}</td>
          <td class="num">${p[2]}</td></tr>`).join("")}
      </tbody></table>
      ${sel.length>400?`<div class="mini" style="margin-top:8px">Mostrando os 400 primeiros de ${sel.length}.</div>`:""}`
      :`<div class="mini">Nenhum parceiro nesta condição.</div>`}
    </div>
  </div>`;
}
function fecharListaParceiros(){
  const m = el("parcModal");
  if(m) m.style.display = "none";
  document.body.style.overflow = "";
}
window.abrirListaParceiros = abrirListaParceiros;
window.fecharListaParceiros = fecharListaParceiros;

/* ação por cenário */
const ACAO_CENARIO = {
  "Atenção redobrada":"Antes: perfil estudado e 2 oportunidades na mão · Semana 1: abordagem com as oportunidades do perfil · Semana 2: positivação",
  "Recorrência":"Negociação de produção com cada parceiro intermitente — e, se preciso, implantar um novo produto",
  "Churn":"Recuperar quem parou: identificar a causa da parada e negociar a volta com proposta concreta",
  "Rampagem":"Converter os cadastros que o GC já fez em primeira produção",
  "Plano individual":"Atacar uma trava por vez, com um lote de 10 parceiros por mês",
  "Margem":"Redirecionar a operação dos maiores parceiros para o produto de maior margem",
  "Capilaridade":"Prospecção com lista nominal de 23 parceiros por GC",
  "Sem tração":"Reativação de carteira — para parte deles, decisão de estrutura",
  "Prontos para subir":"Nada a fazer no campo: entram na janela de janeiro"
};
const ORDEM_CENARIO = ["Atenção redobrada","Recorrência","Churn","Rampagem","Plano individual","Margem","Capilaridade","Sem tração","Prontos para subir"];
const COR_CENARIO = {
  "Atenção redobrada":"#A63A50","Recorrência":"#5B2D8E","Churn":"#A63A50","Rampagem":"#E8913D",
  "Plano individual":"#8E2D5B","Margem":"#5B2D8E","Capilaridade":"#B87333","Sem tração":"#7A7186","Prontos para subir":"#2E7D4F"
};

/* ---- VISÃO TABELA ---- */
function dirTabela(list){
  return ORDEM_CENARIO.map(cen=>{
    const gs = list.filter(g=>g._alav===cen);
    if(!gs.length) return "";
    const pub = gs.reduce((a,g)=>a+(g._pub||0),0);
    const chu = gs.reduce((a,g)=>a+(g._p_chu||0),0);
    return `<div style="margin-bottom:18px">
      <div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin-bottom:7px">
        <span style="width:9px;height:9px;border-radius:50%;background:${COR_CENARIO[cen]};display:inline-block"></span>
        <h3 style="font-size:13px;color:var(--lev-purple-d)">${cen}</h3>
        <span class="mini">${gs.length} GC${gs.length>1?"s":""} · ${brlM(gs.reduce((a,g)=>a+(g.crc_out||0),0))}</span>
      </div>
      <div class="mini" style="background:var(--bg);border-radius:7px;padding:7px 10px;margin-bottom:9px;line-height:1.6">
        <b style="color:${COR_CENARIO[cen]}">O que fazer:</b> ${ACAO_CENARIO[cen]}</div>
      <table class="btab"><tbody>
        ${gs.map(g=>`<tr>
          <td style="width:30%">
            <b class="nm-link" onclick="abrirModalGC('${esc(g.nome).replace(/'/g,"\\\\'")}')">${esc(g.nome)}</b>
            <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:18px;height:18px;vertical-align:-4px;border-radius:50%">
            <div class="mini">${esc(g.regional)} · ${g.meses_casa}m · nível ${g.final}</div></td>
          <td style="width:22%">
            ${g._pub?`<button onclick="abrirListaParceiros('${esc(g.nome).replace(/'/g,"\\\\'")}','acionar')" class="btnparc">
              <b>${g._pub}</b> a acionar</button>`:`<span class="mini">—</span>`}
            ${g._p_chu?`<button onclick="abrirListaParceiros('${esc(g.nome).replace(/'/g,"\\\\'")}','reconquista')" class="btnparc red">
              <b>${g._p_chu}</b> a reconquistar</button>`:""}
          </td>
          <td><div class="mini">
            PAC ${g.pac_out!=null?fmtN(g.pac_out):"—"} · R6 ${g.r6_out!=null?g.r6_out.toFixed(0)+"%":"—"} ·
            Churn ${g.churn!=null?g.churn.toFixed(0)+"%":"—"}${g.churn_out!=null?` <span style="color:var(--mut)">(mês ${g.churn_out.toFixed(0)}%)</span>`:""}</div></td>
          <td class="num" style="width:12%"><span class="bdg nv${g.final}">${g.final}</span></td>
        </tr>`).join("")}
      </tbody></table>
    </div>`;
  }).join("");
}

/* ---- VISÃO KANBAN ---- */
function dirKanban(list){
  const cols = ORDEM_CENARIO.filter(cen => list.some(g=>g._alav===cen));
  return `<div class="kboard" style="display:flex;gap:11px;overflow-x:auto;padding-bottom:12px;align-items:flex-start;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity">
    ${cols.map(cen=>{
      const gs = list.filter(g=>g._alav===cen).sort((a,b)=>(b.crc_out||0)-(a.crc_out||0));
      return `<div class="kcol" style="flex:0 0 268px;min-width:268px;background:#F8F6FC;border-radius:12px;padding:10px;scroll-snap-align:start">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:9px">
          <span style="width:8px;height:8px;border-radius:50%;background:${COR_CENARIO[cen]}"></span>
          <div style="font-size:11.5px;font-weight:800;color:var(--lev-purple-d);line-height:1.2;flex:1">${cen}</div>
          <span class="fbadge" style="background:${COR_CENARIO[cen]}">${gs.length}</span>
        </div>
        <div class="mini" style="font-size:9.5px;line-height:1.5;color:var(--mut);margin-bottom:9px;min-height:28px">${ACAO_CENARIO[cen].slice(0,88)}${ACAO_CENARIO[cen].length>88?"…":""}</div>
        ${gs.map(g=>`<div class="kcard" onclick="abrirModalGC('${esc(g.nome).replace(/'/g,"\\\\'")}')">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="font-size:11.5px;font-weight:700;color:var(--lev-purple-d);flex:1;line-height:1.25">${esc(g.nome)}</div>
            <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:16px;height:16px;border-radius:50%">
          </div>
          <div class="mini" style="margin-top:2px">${brlM(g.crc_out||0)} · ${g.meses_casa}m</div>
          <div style="display:flex;gap:5px;margin-top:7px;flex-wrap:wrap">
            ${g._pub?`<button onclick="event.stopPropagation();abrirListaParceiros('${esc(g.nome).replace(/'/g,"\\\\'")}','acionar')" class="btnparc sm"><b>${g._pub}</b> acionar</button>`:""}
            ${g._p_chu?`<button onclick="event.stopPropagation();abrirListaParceiros('${esc(g.nome).replace(/'/g,"\\\\'")}','reconquista')" class="btnparc sm red"><b>${g._p_chu}</b> reconq.</button>`:""}
          </div>
        </div>`).join("")}
      </div>`;
    }).join("")}
  </div>`;
}

/* ============ PAINEL DE ALAVANCAGEM (tom + ganho/perda) ============ */
/* Lê a situação do GC e devolve: tom, frase de abertura, o que está bom (manter),
   o que falta, e o que ele ganha ou perde. */

function alavancagem(g){
  const prox = g.final==="D"?"C":g.final==="C"?"B":g.final==="B"?"A":null;
  const emRamp = g.final==="D" && g.rampagem && g.rampagem.status==="ativa";

  /* nível D DENTRO DO PRAZO da rampagem (status "ativa"): a régua é a meta do mês.
     Passou do 6º mês (m6/vencida): já é avaliado pelos 5 critérios do C,
     porque a meta de rampagem deixou de valer. */
  if(emRamp && g.rampagem.status === "ativa"){
    const meta = g.rampagem.meta || "";
    const numAlvo = parseInt((meta.match(/\d+/)||[0])[0]);
    const cad = g.cad_out || 0, pac = g.pac_out || 0;
    const ehCadastro = /cadastro/i.test(meta);
    const feito = ehCadastro ? cad : pac;
    const ok = numAlvo>0 && feito >= numAlvo;
    const faltaN = Math.max(0, numAlvo - feito);
    return {
      tom: ok ? "otimo" : (feito >= numAlvo*0.7 ? "quase" : feito >= numAlvo*0.4 ? "atencao" : "critico"),
      prox: "C",
      pronto: ok,
      bons: ok ? [`Meta de ${meta} cumprida (${feito} de ${numAlvo})`] : [],
      falta: ok ? [] : [{k:"Rampagem", txt:`Meta do mês: ${numAlvo} ${ehCadastro?"cadastros":"positivações"} — está em ${feito}`, acao:`faltam ${faltaN} para cumprir outubro`}],
      abertura: ok
        ? `Cumpriu a meta do mês (${meta}). O caminho para o C está aberto.`
        : `Está na rampagem: a régua deste mês é ${meta}. Está em ${feito} de ${numAlvo}.`,
      ganho: {
        titulo:"Sair do D e chegar ao C",
        itens:[
          "Deixa de ser cobrado pela meta de rampagem e passa a ser avaliado pelos 5 indicadores",
          "Ganha acesso ao bônus por título do nível C (R$ 500/semestre)",
          "O teto remuneratório sobe de R$ 4.000 para R$ 4.500"]
      }
    };
  }
  const r6 = g.r6_out, pac = g.pac_out, ch = g.churn;
  const crc = (g.crc_out||0)/1e6;
  const farol = (g.farol && g.farol!=="#DIV/0!") ? g.farol : farolDeScore(g.score);

  const bons = [], falta = [];
  if(!prox) return null;

  // R6
  if(r6!=null){
    if(r6 >= (PPC.rec[prox]||0)) bons.push(`Recorrência em ${r6.toFixed(0)}% (${PPC.rec[prox]}% exigidos)`);
    else falta.push({k:"R6", txt:`R6 em ${r6.toFixed(0)}% — faltam ${(PPC.rec[prox]-r6).toFixed(0)} p.p. para ${PPC.rec[prox]}%`, acao:"trabalhar a recorrência da carteira"});
  }
  // PAC
  if(pac!=null){
    if(pac >= (PPC.pac[prox]||0)) bons.push(`PAC em ${pac.toFixed(0)} parceiros (${PPC.pac[prox]} exigidos)`);
    else falta.push({k:"PAC", txt:`PAC em ${pac.toFixed(0)} — faltam ${(PPC.pac[prox]-pac).toFixed(0)} parceiros`, acao:"ativar parceiros da carteira"});
  }
  // Churn
  if(ch!=null){
    if(ch < PPC.churnMax) bons.push(`Churn controlado em ${ch.toFixed(1)}% (teto ${PPC.churnMax}%)`);
    else falta.push({k:"Churn", txt:`Churn em ${ch.toFixed(1)}% — ${(ch-PPC.churnMax).toFixed(1)} p.p. acima do teto`, acao:"recuperar quem parou de produzir"});
  }
  // CRC
  if(crcAlvoOK(crc, prox)) bons.push(`Produção de R$ ${crc.toFixed(1)}M (${PPC.crc[prox]}M exigidos)`);
  else falta.push({k:"CRC", txt:`Produção em R$ ${crc.toFixed(1)}M — faltam R$ ${(PPC.crc[prox]-crc).toFixed(1)}M`, acao:"aumentar o volume produzido"});
  // Score MB
  const alvoMB = prox==="C"?"C1":prox==="B"?"C2":"B1";
  if(farol && ORDEM_LUZ.indexOf(farol) >= ORDEM_LUZ.indexOf(alvoMB)) bons.push(`Score MB em ${farol} (${alvoMB} exigido)`);
  else falta.push({k:"Score MB", txt:`Score MB em ${farol||"—"} — precisa estar em ${alvoMB}`, acao:"redirecionar a operação para produtos de maior margem"});

  const pronto = falta.length===0;
  const tom = pronto ? "otimo" : (falta.length<=1 ? "quase" : falta.length<=2 ? "atencao" : "critico");

  const ABERTURA = {
    otimo:  `Está no ponto: todos os critérios do nível ${prox} estão cumpridos.`,
    quase:  `Está a um passo do nível ${prox}. Falta um critério só.`,
    atencao:`Tem ${falta.length} critérios travando a subida para o ${prox}. Dá para atacar em 2 meses.`,
    critico:`${falta.length} critérios travando. Precisa de plano, não de esforço isolado.`
  };

  /* o que ganha / o que perde */
  const GANHO = {
    D: {titulo:"Sair do D e chegar ao C", itens:[
      "Deixa de ser cobrado pela meta de rampagem e passa a ser avaliado pelos 5 indicadores",
      "Ganha acesso ao bônus por título do nível C (R$ 500/semestre)",
      "O teto remuneratório sobe de R$ 4.000 para R$ 4.500"]},
    C: {titulo:"Sair do C e chegar ao B", itens:[
      "Bônus por título sobe de R$ 500 para R$ 1.500/semestre",
      "Teto remuneratório sobe de R$ 4.500 para R$ 5.000",
      "Entra na faixa de consolidação — a mais valorizada na avaliação de carreira"]},
    B: {titulo:"Sair do B e chegar ao A", itens:[
      "Bônus por título sobe de R$ 1.500 para R$ 2.500/semestre",
      "Teto remuneratório sobe de R$ 5.000 para R$ 6.000",
      "Passa a disputar a posição de destaque (Extraordinário) todo mês"]}
  };

  /* quanto de esforço por critério faltante, em linhas de ação */
  return {tom, abertura:ABERTURA[tom], bons, falta, prox, pronto, ganho:GANHO[g.final]};
}

function crcAlvoOK(crc, prox){
  return crc >= (PPC.crc[prox]||0);
}

/* cor/tom por situação */
const TOM_COR = {
  otimo:  {cor:"var(--green)",     bg:"#E2F2E8", bd:"#CFE7D7", ico:"★", rot:"MOMENTO BOM"},
  quase:  {cor:"#2E7D4F",          bg:"#EDF7F0", bd:"#CFE7D7", ico:"✓", rot:"QUASE LÁ"},
  atencao:{cor:"var(--gem)",       bg:"#FDF4E6", bd:"#F2DDB8", ico:"!", rot:"ATENÇÃO"},
  critico:{cor:"var(--lev-red)",   bg:"#F6E7EA", bd:"#EBCFD5", ico:"✕", rot:"PONTO CRÍTICO"}
};

/* bloco visual do painel de alavancagem */
function painelAlavancagem(g){
  const a = alavancagem(g);
  if(!a) return "";
  const t = TOM_COR[a.tom];
  const total = a.bons.length + a.falta.length;
  const pct = total ? (a.bons.length/total*100) : 0;

  return `
  <div class="panel" style="margin-top:14px;border-color:${t.bd};background:linear-gradient(135deg,${t.bg},#fff 70%)">
    <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="width:34px;height:34px;border-radius:50%;background:${t.cor};color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;flex-shrink:0">${t.ico}</div>
      <div style="flex:1;min-width:240px">
        <div style="font-size:10px;font-weight:800;letter-spacing:1.2px;color:${t.cor};text-transform:uppercase">${t.rot} · alavancagem para o nível ${a.prox}</div>
        <div style="font-size:14px;font-weight:700;color:var(--lev-purple-d);margin-top:4px;line-height:1.45">${a.abertura}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:26px;font-weight:800;color:${t.cor};line-height:1">${a.bons.length}<span style="font-size:15px;opacity:.7">/${total}</span></div>
        <div class="mini">critérios cumpridos</div>
      </div>
    </div>

    <div style="height:7px;border-radius:4px;background:#E6E1EF;margin:13px 0 15px;overflow:hidden">
      <div style="height:100%;width:${pct}%;border-radius:4px;background:${t.cor};transition:width .3s"></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
      <div>
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:var(--green);text-transform:uppercase;margin-bottom:7px">✓ O que está bom — mantenha</div>
        ${a.bons.length
          ? a.bons.map(x=>`<div style="font-size:11.5px;color:#3D7A57;line-height:1.7;padding-left:14px;position:relative"><span style="position:absolute;left:0">•</span>${x}</div>`).join("")
          : `<div class="mini" style="color:var(--mut)">Nenhum critério cumprido ainda — o foco é construir a base.</div>`}
      </div>
      <div>
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:${t.cor};text-transform:uppercase;margin-bottom:7px">${a.falta.length?"→ O que falta — e a ação":"→ Nada faltando"}</div>
        ${a.falta.length
          ? a.falta.map(f=>`<div style="font-size:11.5px;color:var(--txt);line-height:1.6;margin-bottom:6px">
              <b>${f.txt}</b><div class="mini" style="color:${t.cor}">→ ${f.acao}</div></div>`).join("")
          : `<div class="mini" style="color:var(--green)">Todos os critérios do ${a.prox} estão cumpridos. Falta só a janela de avaliação.</div>`}
      </div>
    </div>

    <div style="margin-top:15px;padding-top:13px;border-top:1px solid ${t.bd}">
      <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:var(--lev-purple-d);text-transform:uppercase;margin-bottom:8px">
        ${a.pronto?"🎁 O que ele ganha subindo":"⚠️ O que ele deixa na mesa enquanto não sobe"} — ${a.ganho.titulo}
      </div>
      ${a.ganho.itens.map(x=>`<div style="font-size:11.5px;color:${a.pronto?"#3D7A57":"#8A5510"};line-height:1.75;padding-left:15px;position:relative">
        <span style="position:absolute;left:0">${a.pronto?"+":"−"}</span>${x}</div>`).join("")}
    </div>
  </div>`;
}

/* ============ MODAL DO GC (estilo Trello) ============ */
let modalGC = null;

function abrirModalGC(nome){
  modalGC = GCS.find(x=>x.nome===nome) || null;
  if(!modalGC) return;
  gcAba = "ppc";
  let m = el("gcModal");
  if(!m){
    m = document.createElement("div");
    m.id = "gcModal";
    m.className = "gcm-back";
    m.onclick = function(e){ if(e.target===m) fecharModalGC(); };
    document.body.appendChild(m);
  }
  m.style.display = "flex";
  document.body.style.overflow = "hidden";
  renderModalGC();
}
function fecharModalGC(){
  const m = el("gcModal");
  if(m) m.style.display = "none";
  document.body.style.overflow = "";
  modalGC = null;
}
window.abrirModalGC = abrirModalGC;
window.fecharModalGC = fecharModalGC;

function setModalAba(a){ gcAba = a; renderModalGC(); }
window.setModalAba = setModalAba;

function renderModalGC(){
  const m = el("gcModal");
  if(!m || !modalGC) return;
  const g = modalGC;
  const tabs = [["ppc","PPC"],["esforco","Esforço"],["desempenho","Desempenho"]];
  const corpo = gcAba==="ppc" ? gcAbaPpc(g) : gcAba==="esforco" ? gcAbaEsforco(g) : gcAbaDesempenho(g);

  m.innerHTML = `
    <div class="gcm" onclick="event.stopPropagation()">
      <div class="gcm-head">
        <div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">
          <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:34px;height:34px;border-radius:50%">
          <div>
            <div style="font-size:18px;font-weight:800;color:var(--lev-purple-d);line-height:1.2">${esc(g.nome)}</div>
            <div class="mini">Nível ${g.final} · ${esc(g.regional)} · head ${esc((g.head||"").split(" ")[0])} · ${g.meses_casa} meses de casa</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <button onclick="go('gc');pickGC('${esc(g.nome).replace(/'/g,"\\'")}');fecharModalGC();'"
            style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:7px 13px;font-size:11.5px;cursor:pointer;font-family:inherit">Abrir análise completa</button>
          <button onclick="fecharModalGC()" style="background:none;border:0;font-size:22px;line-height:1;color:var(--mut);cursor:pointer;padding:0 4px">✕</button>
        </div>
      </div>

      <div class="gcm-tabs">
        ${tabs.map(([k,l])=>`<button class="${gcAba===k?"on":""}" onclick="setModalAba('${k}')">${l}</button>`).join("")}
      </div>

      <div class="gcm-body">${corpo}</div>
    </div>`;
  m.querySelectorAll(".indc.indclick").forEach(c=>{
    c.onclick = function(){
      const fn = window[this.dataset.clk];
      if(typeof fn === "function") fn(this.dataset.gc, this.dataset.arg);
    };
  });
}

/* ---- motor de respostas do chat ---- */
function achaGC(q){
  const nq = normTxt(q);
  let melhor=null, score=0;
  GCS.forEach(g=>{
    if(nq.includes(normTxt(g.nome))) { score=99; melhor=g; return; }
    const partes = normTxt(g.nome).split(" ").filter(p=>p.length>2);
    let bate=0; partes.forEach(p=>{ if(nq.includes(p)) bate++; });
    if(bate>score){ score=bate; melhor=g; }
  });
  return score>0 ? melhor : null;
}
function achaCampo(q){
  const nq = normTxt(q); let achou=null;
  CAMPOS.forEach(c=>{ c.aliases.forEach(a=>{ if(nq.includes(normTxt(a))) achou=c; }); });
  return achou;
}
function respostaChat(pergunta){
  const q = normTxt(pergunta);
  if(!q) return {txt:"Escreva a sua pergunta."};
  if(/^(ajuda|help|como usar|exemplos)/.test(q))
    return {txt:`Posso responder sobre a base de ${GCS.length} GCs (out/2026). Exemplos:\n\n• "Qual o PAC do Filipe Fiorini?"\n• "Quem está com churn acima de 20%?"\n• "Quantos GCs o Zagui tem?"\n• "Quem está em atenção redobrada?"\n• "Ranking de produção"\n• "Panorama geral"\n\nSó respondo o que está nos dados — não interpreto nem recomendo.`};

  const heads = [...new Set(GCS.map(g=>g.head))].filter(Boolean);
  const headCitado = heads.find(h=>{
    const nh = normTxt(h);
    if(q.includes(nh)) return true;
    return nh.split(" ").filter(p=>p.length>3).some(p=>q.includes(p));
  });

  if(headCitado){
    const gs = GCS.filter(g=>g.head===headCitado);
    const crc = gs.reduce((a,g)=>a+(g.crc_out||0),0);
    const pac = gs.reduce((a,g)=>a+(g.pac_out||0),0);
    return {txt:`**${headCitado}** — ${gs.length} GCs · out/2026\n\n• Produção: **${brl(crc)}**\n• Parceiros ativos: **${fmtBR(pac)}**\n• Média por GC: **${brl(crc/gs.length)}**\n• Níveis: **${gs.filter(g=>g.final==="D").length}** D · **${gs.filter(g=>g.final==="C").length}** C · **${gs.filter(g=>g.final==="B").length}** B\n\n`+
      gs.sort((a,b)=>(b.crc_out||0)-(a.crc_out||0)).slice(0,8).map(g=>`• ${g.nome} — ${brl(g.crc_out)} · ${g.final}`).join("\n")};
  }

  if(/atencao redobrada|atenção redobrada/.test(q)){
    const gs = GCS.filter(g=>g._alav==="Atenção redobrada");
    return {txt:`**${gs.length} GCs em atenção redobrada** · ${brl(gs.reduce((a,g)=>a+(g.crc_out||0),0))}\n\n`+
      gs.sort((a,b)=>(b.crc_out||0)-(a.crc_out||0)).map(g=>`• ${g.nome} — ${g.meses_casa}m · PAC ${fmtBR(g.pac_out)} · ${g._pub||0} a acionar`).join("\n")};
  }
  if(/prontos? para subir/.test(q)){
    const gs = GCS.filter(g=>g._alav==="Prontos para subir");
    return {txt:`**${gs.length} GCs prontos para subir:**\n\n`+gs.map(g=>`• ${g.nome} — nível ${g.final} · ${g.regional}`).join("\n")};
  }
  if(/planos? individual|multicriterio/.test(q)){
    const gs = GCS.filter(g=>g._alav==="Plano individual");
    return {txt:`**${gs.length} GCs em plano individual:**\n\n`+gs.map(g=>`• ${g.nome} — ${g.final} · PAC ${fmtBR(g.pac_out)} · churn 6M ${pct(g.churn)}`).join("\n")};
  }

  const campo = achaCampo(q);
  if(campo && /abaixo|acima|menor|maior|menos|mais de|superior|inferior/.test(q)){
    let lim = null; const m = q.match(/(\d+(?:[.,]\d+)?)\s*%?/);
    if(m) lim = parseFloat(m[1].replace(",","."));
    if(lim==null && /churn/.test(q)) lim = 20;
    if(lim==null && /r6|recorrencia/.test(q)) lim = 50;
    if(lim!=null){
      const menor = /abaixo|menor|menos|inferior/.test(q);
      const gs = GCS.filter(g=>{ const v=g[campo.k]; if(v==null) return false; return menor ? v<lim : v>lim; });
      return {txt:`**${gs.length} GCs com ${campo.nm} ${menor?"abaixo de":"acima de"} ${fmtBR(lim,1)}%**\n\n`+
        (gs.length? gs.sort((a,b)=> menor? a[campo.k]-b[campo.k] : b[campo.k]-a[campo.k])
          .map(g=>`• ${g.nome} — ${pct(g[campo.k])} · ${g.head.split(" ")[0]}`).join("\n") : "Nenhum.")};
    }
  }
  if(campo && /ranking|top|maiores|melhores|ordem|ranque/.test(q)){
    const validos = GCS.filter(g=>g[campo.k]!=null);
    if(!validos.length) return {txt:`Não há dado de ${campo.nm}.`};
    const desc = validos.slice().sort((a,b)=>b[campo.k]-a[campo.k]).slice(0,10);
    const ehPct = ["r6_out","churn"].includes(campo.k);
    const ehDin = ["crc_out"].includes(campo.k);
    const fmt = v => ehPct?pct(v):ehDin?brl(v):fmtBR(v);
    return {txt:`**Top 10 por ${campo.nm}**\n\n`+desc.map((g,i)=>`${i+1}. ${g.nome} — ${fmt(g[campo.k])}`).join("\n")};
  }

  const gc = achaGC(q);
  if(gc){
    const b = gc.bonus||{};
    return {txt:[`**${gc.nome}**`,
      `Nível **${gc.final}** · ${gc.regional} · head ${gc.head.split(" ")[0]} · ${gc.meses_casa} meses de casa`,"",
      `• PAC: **${fmtBR(gc.pac_out)}**`,`• R6: **${pct(gc.r6_out)}**`,`• Churn (média 6M): **${pct(gc.churn)}**`,
      `• Produção: **${brl(gc.crc_out)}**`,`• Cadastros: **${fmtBR(gc.cad_out)}**`,
      `• Score MB: **${gc.score!=null?fmtBR(gc.score,1):"—"}** (farol ${gc.farol||"—"})`,"",
      `**Cenário:** ${gc._alav||"—"}`,
      gc._pub?`**Parceiros a acionar:** ${gc._pub}`:"",
      gc._p_chu?`**Parceiros a reconquistar:** ${gc._p_chu}`:"",
      `**Interações no mês:** ${fmtBR((gc.esf||{}).total||0)}`
    ].filter(Boolean).join("\n")};
  }

  if(/total|geral|resumo|panorama/.test(q)){
    const crc = GCS.reduce((a,g)=>a+(g.crc_out||0),0);
    const pac = GCS.reduce((a,g)=>a+(g.pac_out||0),0);
    return {txt:`**Panorama — ${GCS.length} GCs · out/2026**\n\n• Produção: **${brl(crc)}**\n• Parceiros ativos: **${fmtBR(pac)}**\n`+
      `• Níveis: **${GCS.filter(g=>g.final==="D").length}** D · **${GCS.filter(g=>g.final==="C").length}** C · **${GCS.filter(g=>g.final==="B").length}** B\n`+
      `• Atenção redobrada: **${GCS.filter(g=>g._alav==="Atenção redobrada").length}** GCs\n`+
      `• Recebem bônus: **${GCS.filter(g=>(g.bonus||{}).bonus_efetivo>0).length}** GCs`};
  }

  return {txt:`Não encontrei essa informação nos dados.\n\nEu respondo por regra, não por interpretação — preciso que a pergunta cite um **GC**, um **indicador** (PAC, R6, churn, produção, cadastros, Score MB) ou um **head**.\n\nDigite **ajuda** para ver exemplos.`};
}

let chatHist = [];
function viewChat(){
  return `
  <div class="rule"><b>Pergunte sobre os dados.</b> Este chat responde por <b>regra sobre a base</b>, não por IA — o número que aparece é sempre o mesmo do painel.</div>
  <div class="panel" style="max-width:900px">
    <div id="chatBox" style="min-height:300px;max-height:52vh;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:4px 2px">
      ${chatHist.length?chatHist.map(m=>`<div style="align-self:${m.quem==="eu"?"flex-end":"flex-start"};max-width:82%">
        <div style="background:${m.quem==="eu"?"var(--lev-purple)":"var(--bg)"};color:${m.quem==="eu"?"#fff":"var(--txt)"};padding:10px 13px;border-radius:12px;font-size:13px;line-height:1.6;white-space:pre-wrap">${m.txt.replace(/[<>]/g,"")}</div>
      </div>`).join(""):`<div style="color:var(--mut);font-size:12.5px;text-align:center;padding:40px 10px">
        Faça uma pergunta sobre os dados.<br><span style="font-size:11.5px">Ex.: "qual o PAC do Filipe Fiorini?" · "quem está com churn acima de 20%?" · "quantos GCs o Zagui tem?"</span>
      </div>`}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;border-top:1px solid var(--line);padding-top:12px">
      <input id="chatIn" placeholder="Escreva sua pergunta…" onkeydown="if(event.key==='Enter')enviarChat()"
        style="flex:1;border:1px solid var(--line);border-radius:9px;padding:10px 13px;font-size:13.5px;outline:none;font-family:inherit">
      <button onclick="enviarChat()" style="background:var(--lev-purple);color:#fff;border:0;border-radius:9px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">Perguntar</button>
    </div>
    <div class="mini" style="margin-top:9px">Sugestões: ${["Qual o PAC do Filipe Fiorini?","Quem está com churn acima de 20%?","Quantos GCs o Eudes tem?","Quem está em atenção redobrada?","Ranking de produção"].map(x=>`<a href="#" onclick="chatSugere('${x.replace(/'/g,"\\'")}');return false" style="color:var(--lev-purple);text-decoration:none;border-bottom:1px dotted">${x}</a>`).join(" · ")}</div>
  </div>`;
}
function chatSugere(t){ el("chatIn").value=t; enviarChat(); }
function enviarChat(){
  const inp = el("chatIn"); if(!inp) return;
  const t = inp.value.trim(); if(!t) return;
  chatHist.push({quem:"eu", txt:t});
  chatHist.push({quem:"ele", txt:respostaChat(t).txt});
  inp.value = ""; render();
  const box = el("chatBox"); if(box) box.scrollTop = box.scrollHeight;
}
window.chatSugere = chatSugere; window.enviarChat = enviarChat;

/* liga os selects da aba Direcionamentos */
function ligarFiltrosDir(){
  const h = el("dirHead"), r = el("dirReg"), gc = el("dirGC");
  if(h) h.onchange = e => { dirHead = e.target.value; dirReg = ""; dirGC = ""; render(); };
  if(r) r.onchange = e => { dirReg = e.target.value; dirGC = ""; render(); };
  if(gc) gc.onchange = e => { dirGC = e.target.value; render(); };
}
window.ligarFiltrosDir = ligarFiltrosDir;

/* ============ SUGESTÕES + ADMIN ============ */
/* A planilha é a fonte da verdade. O painel só envia e lê. */

/* ---- inicialização ---- */
document.addEventListener("DOMContentLoaded", function(){
  try{ bootView(); }catch(e){ console.error(e); }
});

const SUG = {
  url: localStorage.getItem("ppc_sug_url") || "COLE_AQUI_A_URL_DO_APPS_SCRIPT",
  senha: localStorage.getItem("ppc_admin_senha") || "",
  itens: [],
  carregado: false,
  erro: ""
};
const SUG_AREAS = ["Geral","Painel Geral","Bônus","Hierarquia Dinâmica","Análise por GC","Direcionamentos","Pagamentos","Visual/Layout"];
const SUG_PRIOS = ["Baixa","Média","Alta"];

function sugConfigurar(url){ 
  SUG.url = url.trim();
  localStorage.setItem("ppc_sug_url", SUG.url);
  render();
}
window.sugConfigurar = sugConfigurar;

/* --- enviar sugestão (POST no-cors: não sabemos se gravou, então confirmamos por mensagem) --- */
function sugerir(){
  const quem = (el("sugQuem")||{}).value || "";
  const area = (el("sugArea")||{}).value || "Geral";
  const prio = (el("sugPrio")||{}).value || "Média";
  const txt  = (el("sugTxt")||{}).value || "";
  const st = el("sugStatus");
  if(txt.trim().length < 8){ if(st){st.textContent="Descreva a sugestão com pelo menos 8 caracteres."; st.style.color="var(--lev-red)";} return; }
  if(!SUG.url){ if(st){st.textContent="A planilha não está configurada. Peça ao administrador."; st.style.color="var(--lev-red)";} return; }

  const payload = { acao:"sugerir", quem: quem.trim()||"anônimo", area, prioridade: prio, sugestao: txt.trim() };

  if(st){ st.textContent = "Enviando…"; st.style.color = "var(--mut)"; }

  // envio por JSONP: só confirmo depois que o script responde que gravou
  const u = SUG.url + (SUG.url.indexOf("?")>=0?"&":"?" )
    + "acao=sugerir&t=" + Date.now()
    + "&quem=" + encodeURIComponent(payload.quem)
    + "&area=" + encodeURIComponent(payload.area)
    + "&prioridade=" + encodeURIComponent(payload.prioridade)
    + "&sugestao=" + encodeURIComponent(payload.sugestao);

  jsonpSug(u,
    j=>{
      if(j && j.ok){
        if(st){ st.textContent = "Sugestão enviada e registrada (" + (j.id||"ok") + "). Obrigado!"; st.style.color = "var(--green)"; }
        el("sugTxt").value = "";
        SUG.carregado = false;
      } else {
        if(st){ st.textContent = "A planilha recusou o envio: " + ((j&&j.erro)||"erro desconhecido"); st.style.color = "var(--lev-red)"; }
      }
    },
    ()=>{
      if(st){ st.textContent = "Não consegui confirmar o envio. Verifique a conexão e tente de novo."; st.style.color = "var(--lev-red)"; }
    }
  );
}
window.sugerir = sugerir;

/* --- admin: carregar via JSONP (o Apps Script devolve JSON; usamos fetch simples) --- */
let _sugCbN = 0;
function jsonpSug(url, ok, err){
  const nome = "__sugCb" + (++_sugCbN);
  const sc = document.createElement("script");
  let feito = false;
  const limpa = () => { try{ delete window[nome]; }catch(e){ window[nome]=undefined; } if(sc.parentNode) sc.parentNode.removeChild(sc); };
  window[nome] = function(d){ feito = true; limpa(); ok(d); };
  sc.src = url + "&callback=" + nome;
  sc.onerror = function(){ if(!feito){ limpa(); err(); } };
  document.body.appendChild(sc);
  setTimeout(()=>{ if(!feito){ limpa(); err(); } }, 12000);
}

function carregarSugestoes(){
  if(!SUG.url || SUG.url.indexOf("COLE_AQUI")===0){ SUG.erro = "Planilha não configurada."; SUG.carregado=false; render(); return; }
  if(!SUG.senha){ SUG.erro = "Informe a senha de administrador."; return; }
  SUG.erro = "";
  const u = SUG.url + (SUG.url.indexOf("?")>=0?"&":"?") + "acao=listar&senha=" + encodeURIComponent(SUG.senha) + "&t=" + Date.now();
  jsonpSug(u,
    j=>{
      if(j && j.ok){ SUG.itens = j.itens || []; SUG.carregado = true; SUG.erro = ""; }
      else { SUG.itens = []; SUG.carregado = true; SUG.erro = (j && j.erro)==="senha" ? "Senha incorreta." : "A planilha respondeu com erro."; }
      render();
    },
    ()=>{ SUG.itens = []; SUG.carregado = false; SUG.erro = "Não consegui falar com a planilha. Confira a URL do Apps Script e se a implantação está como \"qualquer pessoa\"."; render(); }
  );
}
window.carregarSugestoes = carregarSugestoes;

function testarConexao(){
  const alvo = el("diagBox");
  const escreve = (t,cor)=>{ if(alvo){ alvo.innerHTML = t; alvo.style.color = cor||"var(--txt)"; } };
  if(!SUG.url || SUG.url.indexOf("COLE_AQUI")===0){ escreve("A URL do Apps Script não está configurada.", "var(--lev-red)"); return; }
  escreve("Testando…", "var(--mut)");

  const ping = SUG.url + (SUG.url.indexOf("?")>=0?"&":"?") + "acao=ping&t=" + Date.now();
  jsonpSug(ping,
    j=>{
      const versao = j && j.versao ? String(j.versao) : "?";
      const temVersao2 = versao === "2";
      // agora testa a senha
      const senhaTeste = (el("admTesteSenha")||{}).value || SUG.senha || "";
      const u = SUG.url + (SUG.url.indexOf("?")>=0?"&":"?") + "acao=listar&senha=" + encodeURIComponent(senhaTeste) + "&t=" + Date.now();
      jsonpSug(u,
        k=>{
          if(k && k.ok){
            escreve(`✅ Conexão OK · script versão ${versao} · senha correta · ${(k.itens||[]).length} sugestões na planilha`, "var(--green)");
          } else if(k && k.erro === "senha"){
            escreve(`⚠️ O script respondeu (versão ${versao}), mas a senha <b>não confere</b>.<br>
              Confira a linha <code>var SENHA_ADMIN = '...'</code> no script.<br>
              ${temVersao2?"":"<b>Atenção:</b> versão antiga do script — reimplante com o código novo."}`, "var(--gem)");
          } else {
            escreve("Resposta inesperada: " + JSON.stringify(k), "var(--lev-red)");
          }
        },
        ()=>escreve(`Não recebi resposta da planilha.<br>Versão detectada no teste: <b>${versao}</b>${temVersao2?"":" · ⚠️ deveria ser 2 (script antigo)"}`, "var(--lev-red)")
      );
    },
    ()=>escreve("Não consegui falar com a URL. Confira se ela termina em <b>/exec</b> e se a implantação está como \"qualquer pessoa\".", "var(--lev-red)")
  );
}
window.testarConexao = testarConexao;

function salvarSenha(){
  const v = (el("admSenha")||{}).value || "";
  SUG.senha = v.trim();
  localStorage.setItem("ppc_admin_senha", SUG.senha);
  carregarSugestoes();
}
window.salvarSenha = salvarSenha;

/* --- responder uma sugestão --- */
function responderSug(id, status){
  const resp = (el("resp_"+id)||{}).value || "";
  const u = SUG.url + (SUG.url.indexOf("?")>=0?"&":"?") + "acao=responder&senha=" + encodeURIComponent(SUG.senha)
          + "&id=" + encodeURIComponent(id) + "&status=" + encodeURIComponent(status)
          + "&resposta=" + encodeURIComponent(resp) + "&t=" + Date.now();
  jsonpSug(u,
    j=>{ if(j && j.ok) carregarSugestoes(); else alert("Não consegui salvar. " + ((j&&j.erro)||"")); },
    ()=>alert("Falha de conexão com a planilha.")
  );
}
window.responderSug = responderSug;

/* --- tela de sugestão (pública) --- */
function viewSugestao(){
  return `
  <div class="rule"><b>Caixa de sugestões.</b> Sua ideia vai para a planilha do painel e entra na fila de análise. Tudo o que for aprovado é implementado de uma vez, no próximo ciclo de melhoria.</div>
  <div class="panel" style="max-width:820px">
    <h3>Enviar uma sugestão</h3>
    <div class="ps">quanto mais específico, mais fácil de executar</div>
    <div style="display:grid;gap:11px;margin-top:6px">
      <div><label class="mini" style="font-weight:700">Seu nome (opcional)</label>
        <input id="sugQuem" placeholder="Como você quer ser identificado" style="width:100%;border:1px solid var(--line);border-radius:9px;padding:9px 12px;font-size:13px;margin-top:4px;font-family:inherit"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px">
        <div><label class="mini" style="font-weight:700">Área do painel</label>
          <select id="sugArea" style="width:100%;border:1px solid var(--line);border-radius:9px;padding:9px 12px;font-size:13px;margin-top:4px;background:#fff">
            ${SUG_AREAS.map(a=>`<option>${a}</option>`).join("")}</select></div>
        <div><label class="mini" style="font-weight:700">Prioridade</label>
          <select id="sugPrio" style="width:100%;border:1px solid var(--line);border-radius:9px;padding:9px 12px;font-size:13px;margin-top:4px;background:#fff">
            ${SUG_PRIOS.map(p=>`<option ${p==="Média"?"selected":""}>${p}</option>`).join("")}</select></div>
      </div>
      <div><label class="mini" style="font-weight:700">Sua sugestão</label>
        <textarea id="sugTxt" rows="5" placeholder="O que você melhoraria neste painel? Se puder, explique o problema e o que espera ver."
          style="width:100%;border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-size:13px;margin-top:4px;font-family:inherit;resize:vertical"></textarea></div>
      <div style="display:flex;align-items:center;gap:12px">
        <button onclick="sugerir()" style="background:var(--lev-purple);color:#fff;border:0;border-radius:9px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer">Enviar sugestão</button>
        <span id="sugStatus" class="mini"></span>
      </div>
    </div>
  </div>`;
}

/* --- admin --- */
function viewAdmin(){
  if(!SUG.carregado && !SUG.erro && SUG.senha) setTimeout(carregarSugestoes, 100);
  const pend = SUG.itens.filter(i=>i.status==="Pendente");
  const aprov = SUG.itens.filter(i=>i.status==="Aprovado");
  const exec = SUG.itens.filter(i=>i.status==="Executado");
  const rec = SUG.itens.filter(i=>i.status==="Recusado");

  if(!SUG.senha){
    return `<div class="panel" style="max-width:560px">
      <h3>Administração</h3>
      <div class="ps">Área restrita — só quem tem a senha vê as sugestões.</div>
      ${SUG.url.indexOf("COLE_AQUI")===0?`<div style="background:#FDF0DD;border:1px solid #F2DDB8;border-radius:9px;padding:10px 12px;font-size:11.5px;color:#8A6210;margin:10px 0">
        <b>Configuração pendente:</b> a URL do Apps Script ainda não foi definida.<br>
        Implante o script e cole a URL abaixo (uma única vez, fica salva neste navegador).
        <input id="admUrl" placeholder="https://script.google.com/macros/s/.../exec"
          style="width:100%;border:1px solid #E5CFA8;border-radius:7px;padding:7px 10px;font-size:11.5px;margin-top:7px;font-family:inherit;background:#fff">
        <button onclick="sugConfigurar(document.getElementById('admUrl').value)" style="background:#8A6210;color:#fff;border:0;border-radius:7px;padding:6px 14px;font-size:11.5px;font-weight:700;cursor:pointer;margin-top:6px">Salvar URL</button>
      </div>`:""}
      <input id="admSenha" type="password" placeholder="Senha de administrador" onkeydown="if(event.key==='Enter')salvarSenha()"
        style="width:100%;border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-size:13px;margin:10px 0">
      <button onclick="salvarSenha()" style="background:var(--lev-purple);color:#fff;border:0;border-radius:9px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">Entrar</button>
      ${SUG.erro?`<div class="mini" style="color:var(--lev-red);margin-top:9px">${SUG.erro}</div>`:""}
    </div>`;
  }

  const admAba = (window._admAba || "sug");
  const tabsAdm = `<div style="display:flex;gap:6px;margin-bottom:14px">
    <button onclick="window._admAba='sug';render()" style="border:1px solid var(--line);border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;background:${admAba==="sug"?"var(--lev-purple)":"#fff"};color:${admAba==="sug"?"#fff":"var(--lev-purple-d)"}">Sugestões</button>
    <button onclick="window._admAba='perfis';render()" style="border:1px solid var(--line);border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;background:${admAba==="perfis"?"var(--lev-purple)":"#fff"};color:${admAba==="perfis"?"#fff":"var(--lev-purple-d)"}">Perfis e visibilidade</button>
  </div>`;

  if(admAba === "perfis") return admPerfis(tabsAdm);

  return `
  <div class="rule"><b>Painel de administração.</b> Aprove ou recuse cada sugestão. O que ficar <b>Aprovado</b> entra na fila — quando você mandar "execute as aprovadas" no chat, eu implemento todas de uma vez.</div>
  ${tabsAdm}
  <div class="kpis" style="margin-bottom:14px">
    <div class="kpi o"><div class="t">Pendentes</div><div class="v">${pend.length}</div><div class="d">aguardando sua análise</div></div>
    <div class="kpi g"><div class="t">Aprovadas</div><div class="v">${aprov.length}</div><div class="d">na fila para executar</div></div>
    <div class="kpi"><div class="t">Executadas</div><div class="v">${exec.length}</div><div class="d">já implementadas</div></div>
    <div class="kpi r"><div class="t">Recusadas</div><div class="v">${rec.length}</div><div class="d">arquivadas</div></div>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
    <button onclick="carregarSugestoes()" style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer">↻ Atualizar</button>
    <button onclick="testarConexao()" style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer">🔍 Testar conexão</button>
    <button onclick="localStorage.removeItem('ppc_admin_senha');SUG.senha='';SUG.itens=[];SUG.carregado=false;render()" style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer">Sair</button>
    <span class="mini" style="align-self:center;margin-left:auto">${SUG.itens.length} sugestões na planilha</span>
  </div>
  ${SUG.erro?`<div class="callout" style="background:#F6E7EA;border:1px solid #EBCFD5;color:var(--lev-red);border-radius:10px;padding:11px 14px;font-size:12.5px;margin-bottom:12px">${SUG.erro}</div>`:""}
  <div style="display:flex;gap:7px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
    <input id="admTesteSenha" type="password" placeholder="Digite a senha do script para testar"
      style="border:1px solid var(--line);border-radius:8px;padding:7px 11px;font-size:12px;font-family:inherit;min-width:260px">
    <button onclick="testarConexao()" style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:7px 13px;font-size:12px;cursor:pointer">🔍 Testar senha</button>
  </div>
  <div id="diagBox" class="mini" style="margin-bottom:12px;min-height:16px"></div>
  ${!SUG.itens.length && !SUG.erro?`<div class="panel"><div class="mini">Nenhuma sugestão ainda.${SUG.carregado?"":" Carregando…"}</div></div>`:""}
  ${SUG.itens.length?sugTabela(SUG.itens):""}`;
}

function admPerfis(tabsAdm){
  return `
  <div class="rule"><b>Perfis e visibilidade.</b> Cada perfil define quais seções aparecem no menu. O perfil ativo é escolhido no seletor do topo — hoje é um <b>login cosmético</b> (esconde a tela, não protege o dado).</div>
  ${tabsAdm}
  <div class="panel" style="margin-bottom:14px">
    <h3>Criar um perfil</h3>
    <div class="ps">depois de criar, marque as seções que ele pode ver</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <input id="novoPerfilNome" placeholder="Nome do perfil (ex.: Gerente Regional SP)" style="flex:1;min-width:240px;border:1px solid var(--line);border-radius:8px;padding:9px 12px;font-size:12.5px;font-family:inherit">
      <button onclick="criarPerfil()" style="background:var(--lev-purple);color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:12.5px;font-weight:700;cursor:pointer">+ Criar perfil</button>
    </div>
  </div>
  ${PERFIS.lista.map(pf=>`<div class="panel" style="margin-bottom:12px;${pf.id===PERFIS.ativo?"border-color:var(--lev-purple);box-shadow:0 0 0 2px #EDE4FA":""}">
    <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:3px">
      <input value="${esc(pf.nm)}" onchange="renomearPerfil('${pf.id}',this.value)"
        style="border:1px solid transparent;background:none;font-size:14px;font-weight:700;color:var(--lev-purple-d);font-family:inherit;padding:2px 4px;border-radius:5px;min-width:180px"
        onfocus="this.style.borderColor='var(--line)';this.style.background='#fff'" onblur="this.style.borderColor='transparent';this.style.background='none'">
      ${pf.id===PERFIS.ativo?`<span class="bdg" style="background:var(--lev-purple);color:#fff">em uso</span>`:""}
      <span class="mini">${pf.secoes.length} de ${SECOES.length} seções</span>
      ${pf.id!=="admin"?`<button onclick="apagarPerfil('${pf.id}')" style="margin-left:auto;background:#F6E7EA;color:var(--lev-red);border:1px solid #EBCFD5;border-radius:6px;padding:4px 11px;font-size:10.5px;font-weight:700;cursor:pointer">Apagar</button>`:""}
    </div>
    <div class="mini" style="margin-bottom:9px">${esc(pf.desc||"")}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px">
      ${SECOES.map(sc=>{
        const tem = pf.secoes.indexOf(sc.k)>=0;
        return `<label style="display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid ${tem?"#DED0F0":"var(--line)"};border-radius:8px;cursor:pointer;font-size:11px;background:${tem?"#F3EDFA":"#fff"}">
          <input type="checkbox" ${tem?"checked":""} ${pf.id==="admin"?"disabled":""} onchange="toggleSecaoPerfil('${pf.id}','${sc.k}',this.checked)">
          <span>${sc.ico} ${sc.nm}</span></label>`;
      }).join("")}
    </div>
    ${pf.id!=="admin"?`<div style="margin-top:9px"><button onclick="setPerfilAtivo('${pf.id}')" style="background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:6px 13px;font-size:11px;cursor:pointer">Testar este perfil</button></div>`:""}
  </div>`).join("")}
  <div class="panel">
    <h3>Como funciona hoje</h3>
    <div class="mini" style="line-height:1.7">
      • O perfil ativo é escolhido no seletor <b>Perfil</b>, no topo da tela.<br>
      • As seções desmarcadas <b>desaparecem do menu</b> e, se você estiver numa delas, o painel volta para a primeira permitida.<br>
      • A escolha fica salva neste navegador.<br>
      • <b>Login cosmético:</b> esconde a tela, mas não o dado — qualquer pessoa com o link e o código-fonte vê a base completa. A proteção real virá depois, com autenticação no Apps Script.
    </div>
  </div>`;
}

function sugTabela(itens){
  const cor = {Pendente:"var(--gem)",Aprovado:"var(--green)",Executado:"var(--lev-purple)",Recusado:"var(--mut)"};
  return `<div class="panel"><table><thead><tr>
    <th>Sugestão</th><th>Quem / Área</th><th>Status</th><th style="width:34%">Sua resposta</th>
  </tr></thead><tbody>
  ${itens.map(it=>`<tr>
    <td style="max-width:330px">
      <b style="font-size:12px">${esc(it.sugestao).slice(0,230)}${it.sugestao.length>230?"…":""}</b>
      <div class="mini">${it.id} · ${it.quando} · prioridade ${it.prioridade}</div></td>
    <td><div style="font-size:12px">${esc(it.quem)}</div><div class="mini">${esc(it.area)}</div></td>
    <td><span class="bdg" style="background:${cor[it.status]||"var(--mut)"};color:#fff">${it.status}</span>
      ${it.executado?`<div class="mini">${it.executado}</div>`:""}</td>
    <td>
      <input id="resp_${it.id}" value="${esc(it.resposta||"")}" placeholder="Observação (opcional)"
        style="width:100%;border:1px solid var(--line);border-radius:7px;padding:6px 9px;font-size:11.5px;margin-bottom:6px;font-family:inherit">
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        <button onclick="responderSug('${it.id}','Aprovado')" style="background:#E2F2E8;color:var(--green);border:1px solid #CFE7D7;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">✓ Aprovar</button>
        <button onclick="responderSug('${it.id}','Recusado')" style="background:#F6E7EA;color:var(--lev-red);border:1px solid #EBCFD5;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">✕ Recusar</button>
        <button onclick="responderSug('${it.id}','Executado')" style="background:#F3EDFA;color:var(--lev-purple);border:1px solid #E0D4F0;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer">✓ Executado</button>
      </div>
    </td>
  </tr>`).join("")}
  </tbody></table></div>`;
}


/* ============ PERFIS E VISIBILIDADE ============ */
/* Cada perfil define quais abas aparecem no menu. O perfil ativo é escolhido
   no seletor do topo (login cosmético) ou pelo administrador. */

const SECOES = [
  {k:"painel",  nm:"Painel Geral",           ico:"▦"},
  {k:"bonus",   nm:"Acompanhamento de Bônus", ico:"🏅"},
  {k:"dinamica",nm:"Hierarquia Dinâmica",     ico:"⚡"},
  {k:"gc",      nm:"Análise por GC",          ico:"🎯"},
  {k:"dir",     nm:"Direcionamentos",         ico:"🧭"},
  {k:"pag",     nm:"Relatório de Pagamentos", ico:"💰"},
  {k:"chat",    nm:"Perguntar",               ico:"💬"},
  {k:"sug",     nm:"Sugerir melhoria",        ico:"💡"},
  {k:"adm",     nm:"Administração",           ico:"🔐"}
];

const PERFIS_PADRAO = [
  { id:"admin", nm:"Administrador", desc:"Acesso total, incluindo administração e pagamentos", secoes: SECOES.map(s=>s.k) },
  { id:"head",  nm:"Head",          desc:"Vê tudo do time, sem administração",                    secoes: ["painel","bonus","dinamica","gc","dir","pag","chat","sug"] },
  { id:"gerente", nm:"Gerente Regional", desc:"Painel, bônus e direcionamentos do time",         secoes: ["painel","bonus","gc","dir","chat","sug"] },
  { id:"gc",    nm:"Gerente Comercial", desc:"Vê só a própria carteira",                          secoes: ["gc","bonus","chat","sug"] },
  { id:"consulta", nm:"Consulta",   desc:"Só leitura dos indicadores",                            secoes: ["painel","gc","chat"] }
];

const PERFIS = {
  lista: (()=>{ try{ const s = localStorage.getItem("ppc_perfis"); return s? JSON.parse(s) : JSON.parse(JSON.stringify(PERFIS_PADRAO)); }catch(e){ return JSON.parse(JSON.stringify(PERFIS_PADRAO)); } })(),
  ativo: (()=>{ try{ return localStorage.getItem("ppc_perfil_ativo") || "admin"; }catch(e){ return "admin"; } })()
};

function salvaPerfis(){ try{ localStorage.setItem("ppc_perfis", JSON.stringify(PERFIS.lista)); }catch(e){} }
function setPerfilAtivo(id){ PERFIS.ativo = id; try{ localStorage.setItem("ppc_perfil_ativo", id); }catch(e){} render(); }
window.setPerfilAtivo = setPerfilAtivo;

function perfilAtual(){
  return PERFIS.lista.find(p=>p.id===PERFIS.ativo) || PERFIS.lista[0];
}
function podeVer(secao){
  const p = perfilAtual();
  return !p || !p.secoes || p.secoes.indexOf(secao) >= 0;
}
function secoesVisiveis(){
  return SECOES.filter(s=>podeVer(s.k));
}
/* aplica a visibilidade ao menu (lateral e inferior) */
function aplicaVisibilidade(){
  document.querySelectorAll("aside nav button[data-v]").forEach(b=>{
    b.style.display = podeVer(b.dataset.v) ? "" : "none";
  });
  document.querySelectorAll(".mnav button[data-v]").forEach(b=>{
    b.style.display = podeVer(b.dataset.v) ? "" : "none";
  });
}

/* --- editor de perfis (aba Administração) --- */
function novaSecaoToggle(perfilId, secao, marcado){
  const id = "chk_"+perfilId+"_"+secao;
  return `<label style="display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;cursor:pointer;font-size:11.5px;background:${marcado?"#F3EDFA":"#fff"}">
    <input type="checkbox" id="${id}" ${marcado?"checked":""} onchange="toggleSecaoPerfil('${perfilId}','${secao}',this.checked)">
    <span>${secao}</span></label>`;
}
function toggleSecaoPerfil(perfilId, secao, marcado){
  const p = PERFIS.lista.find(x=>x.id===perfilId); if(!p) return;
  if(marcado){ if(p.secoes.indexOf(secao)<0) p.secoes.push(secao); }
  else { p.secoes = p.secoes.filter(s=>s!==secao); }
  salvaPerfis();
  if(PERFIS.ativo===perfilId) render();
}
window.toggleSecaoPerfil = toggleSecaoPerfil;

function criarPerfil(){
  const nome = (el("novoPerfilNome")||{}).value || "";
  if(!nome.trim()){ alert("Dê um nome ao perfil."); return; }
  const id = "p" + Date.now().toString(36);
  PERFIS.lista.push({ id, nm: nome.trim(), desc:"Perfil personalizado", secoes: ["painel","gc","chat"] });
  salvaPerfis(); render();
}
window.criarPerfil = criarPerfil;

function apagarPerfil(id){
  if(id==="admin"){ alert("O perfil Administrador não pode ser apagado."); return; }
  if(!confirm("Apagar este perfil?")) return;
  PERFIS.lista = PERFIS.lista.filter(p=>p.id!==id);
  if(PERFIS.ativo===id) PERFIS.ativo = "admin";
  salvaPerfis(); render();
}
window.apagarPerfil = apagarPerfil;

function renomearPerfil(id, nome){
  const p = PERFIS.lista.find(x=>x.id===id); if(!p) return;
  p.nm = nome || p.nm; salvaPerfis(); render();
}
window.renomearPerfil = renomearPerfil;


/* ============ CARD DO GC EM ABAS ============ */
let gcAba = "ppc";
function setGcAba(a){ gcAba = a; render(); }
window.setGcAba = setGcAba;

function gcCardHtml(g){
  /* Na aba Análise por GC o PPC já está logo acima — mostramos só esforço e desempenho */
  const soComplemento = (state.view === "gc");
  const tabs = soComplemento
    ? [["esforco","Esforço"],["desempenho","Desempenho 6M"]]
    : [["ppc","PPC"],["esforco","Esforço"],["desempenho","Desempenho 6M"]];
  return `
  <div style="display:flex;gap:6px;margin:16px 0 12px;flex-wrap:wrap">
    ${tabs.map(([k,l])=>`<button onclick="setGcAba('${k}')" style="border:1px solid var(--line);border-radius:9px;padding:9px 18px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;
      background:${gcAba===k?"var(--lev-purple)":"#fff"};color:${gcAba===k?"#fff":"var(--lev-purple-d)"}">${l}</button>`).join("")}
  </div>
  ${gcAba==="ppc"?gcAbaPpc(g):gcAba==="esforco"?gcAbaEsforco(g):gcAbaDesempenho(g)}`;
}
/* ao entrar na aba de GC, começa em Esforço */
function gcAbaInicial(){ if(state.view==="gc" && gcAba==="ppc") gcAba="esforco"; }

/* --- aba PPC: mesma leitura da Análise por GC --- */
function gcAbaPpc(g){
  const inds = ordenaInd(indicadores(g));
  const farol = (g.farol && g.farol!=="#DIV/0!") ? g.farol : farolDeScore(g.score);
  return `
  ${painelAlavancagem(g)}
  <div class="ind5" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;margin-top:14px">
    ${inds.map(d=>{
      const st = d.ok===true?"ok":d.ok===false?"no":"mid";
      const ic = d.ok===true?"✓":d.ok===false?"✕":"—";
      const tx = d.ok===true ? (d.k==="churn"?"dentro do teto":"no gatilho")
               : d.ok===false ? (d.k==="churn"?"acima do teto":"abaixo")
               : "sem gatilho";
      const cl2 = d.click ? ' indclick" data-clk="'+d.click+'" data-gc="'+esc(g.nome)+'" data-arg="'+(d.clickArg||"")+'" title="Clique para ver o detalhe' : "";
      return `<div class="indc st-${st}${cl2}">
        <div class="nm">${d.nm}</div><div class="gt">${d.gat}</div>
        <div class="vl">${d.fmt(d.val)}</div>
        <div class="mt">${d.meta}</div>
      ${d.comp?`<div class="mini" style="margin-top:5px;padding-top:5px;border-top:1px solid var(--line)">
        média ${JANELA_ROT} <b>${d.val==null?"—":d.val.toFixed(1)+"%"}</b> · este mês <b style="color:${d.comp.cor}">${d.comp.val.toFixed(1)}%</b></div>`:""}
        <div class="foot"><span class="pill ${st}">${ic} ${tx}</span></div>
      </div>`;
    }).join("")}
  </div>
  <div class="semafarobloco" style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-top:12px">
    <div class="cab">
      <div><div class="nm">SEMÁFORO DO SCORE MB</div><div class="gt">régua da Controladoria</div></div>
      <div class="pos">${farol||"—"}<small>farol</small></div>
    </div>
    <div>${semaforoHTML(farol)}</div>
  </div>`;
}

/* --- aba ESFORÇO --- */
function gcAbaEsforco(g){
  const e = g.esf || {total:0, contatos:0, porTipo:{}};
  const pac = g.pac_out || 0;
  const naoAcionados = Math.max(0, pac - (e.contatos||0));
  const cobertura = pac>0 ? Math.min(100, ((e.contatos||0)/pac)*100) : (e.contatos>0?100:0);
  const baseCob = Math.max(pac, e.contatos||0);
  const TIPO = {"1":"Ligação / contato","2":"Reunião","3":"Visita","4":"WhatsApp / mensagem","5":"E-mail","6":"Tarefa","7":"Nota / registro"};
  const tipos = Object.entries(e.porTipo||{}).sort((a,b)=>b[1]-a[1]);

  return `
  <div class="paygrid" style="margin-bottom:14px">
    <div class="paycard"><div class="l">Interações no mês</div><div class="v">${fmtBR(e.total)}</div><div class="d">registros feitos no Ploomes em out/2026</div></div>
    <div class="paycard o"><div class="l">Parceiros acionados</div><div class="v">${fmtBR(e.contatos)}</div><div class="d">contatos distintos com interação</div></div>
    <div class="paycard ${cobertura<50?"r":"g"}"><div class="l">Cobertura da carteira</div><div class="v">${cobertura.toFixed(0)}%</div><div class="d">${fmtBR(e.contatos)} de ${fmtBR(baseCob)} parceiros${(e.contatos||0)>pac?" (mais acionados que o PAC — inclui inativos)":""}</div></div>
    <div class="paycard ${naoAcionados>0?"r":"g"}"><div class="l">Não acionados</div><div class="v">${fmtBR(naoAcionados)}</div><div class="d">parceiros ativos sem interação no mês</div></div>
  </div>

  <div class="panel" style="margin-bottom:14px">
    <h3>Composição do esforço</h3>
    <div class="ps">quantas interações de cada tipo</div>
    ${tipos.length?tipos.map(([k,v])=>{
      const pctv = e.total? (v/e.total*100):0;
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:170px;font-size:12px;font-weight:600;color:var(--lev-purple-d)">${TIPO[k]||("Tipo "+k)}</div>
        <div class="bar" style="flex:1;height:20px;border-radius:6px"><i style="width:${pctv}%;background:linear-gradient(90deg,#5B2D8E,#8E2D5B);border-radius:6px"></i>
          <span style="position:absolute;left:10px;top:2px;color:#fff;font-size:11px;font-weight:700">${v}</span></div>
        <div class="mini" style="width:42px;text-align:right">${pctv.toFixed(0)}%</div>
      </div>`;
    }).join(""):`<div class="mini">Nenhuma interação registrada no mês.</div>`}
  </div>

  <div class="panel">
    <h3>Acionados vs não acionados</h3>
    <div class="ps">quem produziu e quem ficou sem contato — o cruzamento que mostra onde o esforço não chegou</div>
    ${e.obs?`<div class="mini" style="background:#FDF0DD;border:1px solid #F2DDB8;border-radius:8px;padding:8px 11px;color:#8A6210;margin-bottom:10px">${e.obs}</div>`:""}
    <div style="display:flex;height:26px;border-radius:8px;overflow:hidden;border:1px solid var(--line)">
      <div style="width:${cobertura}%;background:linear-gradient(90deg,#2E7D4F,#5DAA7E);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">${cobertura.toFixed(0)}% acionados</div>
      <div style="flex:1;background:#F6E7EA;display:flex;align-items:center;justify-content:center;color:var(--lev-red);font-size:11px;font-weight:700">${(100-cobertura).toFixed(0)}% sem contato</div>
    </div>
    <div class="mini" style="margin-top:10px;line-height:1.7">
      <b>Como ler:</b> cobertura alta com produção em queda indica esforço no parceiro errado.
      Cobertura baixa com produção estável indica que a carteira anda sozinha — mas está exposta.
    </div>
  </div>`;
}

/* --- aba DESEMPENHO 6 MESES --- */
function gcAbaDesempenho(g){
  const sr = g.serie6;
  const pac = g.pac_out || 0;
  const cad = g.cad_out || 0;

  if(!sr){
    return `<div class="panel"><div class="mini">Sem série histórica para este GC.</div></div>`;
  }

  // 6 meses fechados: mai a out (out = "Mês passado" no Ploomes)
  const MESES = [["mai","mai"],["jun","jun"],["jul","jul"],["ago","ago"],["set","set"],["out","OUT"]];
  const vals = MESES.map(([k])=>sr[k]||0);
  const max = Math.max(...vals,1);
  const varPct = vals[0] ? ((vals[5]-vals[0])/vals[0]*100) : 0;
  const media6 = vals.reduce((a,b)=>a+b,0)/6;
  const tend = vals[5] >= vals[4] ? "subindo" : "caindo";
  const difPlan = sr.out_planilha ? Math.abs((sr.out - sr.out_planilha)/sr.out_planilha*100) : 0;

  return `
  <div class="paygrid" style="margin-bottom:14px">
    <div class="paycard ${varPct>=0?"g":"r"}"><div class="l">Variação mai → out</div>
      <div class="v">${varPct>=0?"+":""}${varPct.toFixed(0)}%</div>
      <div class="d">${brlM(vals[0])} → ${brlM(vals[5])}</div></div>
    <div class="paycard"><div class="l">Média mensal</div><div class="v">${brlM(media6)}</div><div class="d">mai a out/2026</div></div>
    <div class="paycard ${tend==="subindo"?"g":"o"}"><div class="l">Tendência</div><div class="v" style="font-size:19px">${tend}</div><div class="d">out vs set</div></div>
    <div class="paycard"><div class="l">Parceiros ativos</div><div class="v">${fmtBR(pac)}</div><div class="d">R$ ${fmtBR(pac?vals[5]/pac:0)} por parceiro em out</div></div>
  </div>

  <div class="panel" style="margin-bottom:14px">
    <h3>Produção CRC — 6 meses fechados</h3>
    <div class="ps">mai a outubro/2026 · valores sem C6AUTO, do campo do Ploomes</div>
    <div style="display:flex;align-items:flex-end;gap:10px;height:165px;padding:10px 0 0">
      ${vals.map((v,i2)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end">
        <div style="font-size:9.5px;color:var(--mut);font-weight:700">${brlM(v)}</div>
        <div style="width:100%;height:${Math.max(3,(v/max)*118)}px;background:linear-gradient(180deg,#5B2D8E,#8E2D5B);border-radius:5px 5px 0 0;${i2===5?"background:linear-gradient(180deg,#E8913D,#B87333)":""}"></div>
        <div style="font-size:9.5px;color:${i2===5?"var(--gem)":"var(--mut)"};font-weight:${i2===5?700:400}">${MESES[i2][1]}</div>
      </div>`).join("")}
    </div>
    <div class="mini" style="margin-top:10px">A barra laranja é <b>outubro</b>, o mês de referência do painel. Novembro está em andamento (${brlM(sr.nov_parcial||0)} até agora).</div>
  </div>

  ${(function(){
    const p6 = g.pac6;
    if(!p6) return `<div class="panel" style="margin-bottom:14px"><h3>Parceiros ativos (PAC) — 6 meses</h3><div class="mini">Sem série de PAC para este GC.</div></div>`;
    const MM = [["mai","mai"],["jun","jun"],["jul","jul"],["ago","ago"],["set","set"],["out","OUT"]];
    const vv = MM.map(([k])=>p6[k]||0);
    const mx = Math.max(...vv,1);
    const varP = vv[0] ? ((vv[5]-vv[0])/vv[0]*100) : 0;
    return `<div class="panel" style="margin-bottom:14px">
      <h3>Parceiros ativos (PAC) — 6 meses</h3>
      <div class="ps">parceiro com Produção CRC no mês = ativo · variação mai → out: <b style="color:${varP>=0?"var(--green)":"var(--lev-red)"}">${varP>=0?"+":""}${varP.toFixed(0)}%</b></div>
      <div style="display:flex;align-items:flex-end;gap:10px;height:130px;padding:8px 0 0">
        ${vv.map((v,i3)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">
          <div style="font-size:10px;color:var(--mut);font-weight:700">${v}</div>
          <div style="width:100%;height:${Math.max(3,(v/mx)*92)}px;background:linear-gradient(180deg,#2E7D4F,#5DAA7E);border-radius:5px 5px 0 0;${i3===5?"background:linear-gradient(180deg,#E8913D,#B87333)":""}"></div>
          <div style="font-size:9px;color:${i3===5?"var(--gem)":"var(--mut)"};font-weight:${i3===5?700:400}">${MM[i3][1]}</div>
        </div>`).join("")}
      </div>
    </div>`;
  })()}

  <div class="grid">
    <div class="panel"><h3>Cadastros no mês</h3>
      <div class="ps">novos parceiros cadastrados em outubro</div>
      <div style="font-size:30px;font-weight:800;color:var(--lev-purple-d)">${fmtBR(cad)}</div>
      <div class="mini" style="margin-top:6px">${cad>0?"cadastros em out/2026":"sem cadastros no mês"}</div>
    </div>
    <div class="panel"><h3>Recorrência e churn</h3>
      <div class="ps">saúde da carteira em outubro</div>
      <div style="display:flex;gap:18px;margin-top:4px">
        <div><div class="mini">R6</div><div style="font-size:22px;font-weight:800;color:var(--lev-purple-d)">${pct(g.r6_out)}</div></div>
        <div><div class="mini">Churn 6M</div><div style="font-size:22px;font-weight:800;color:${(g.churn||0)>20?"var(--lev-red)":"var(--green)"}">${pct(g.churn)}</div></div>
      </div>
    </div>
  </div>

  <div class="panel" style="margin-top:14px">
    <h3>Fonte e conferência</h3>
    <div class="mini" style="line-height:1.7">
      <b>Meses:</b> o campo "Mês passado" do Ploomes é <b>outubro</b> — o "Mês Atual" é novembro, que ainda está aberto e por isso não entra como mês fechado.<br>
      <b>Valores:</b> campo <i>Produção CRC s/ C6AUTO</i>, que é a produção considerada (C6AUTO não conta).<br>
      <b>Conferência:</b> outubro no campo está em ${brlM(sr.out)} e na planilha analítica em ${brlM(sr.out_planilha)} — diferença de ${difPlan.toFixed(0)}%.
      ${difPlan>10?`<br><br><b>Atenção:</b> quando a divergência passa de 10%, vale conferir com a Controladoria qual fonte usar. O painel mostra o campo do Ploomes por ser a série completa.`:`<br>As duas fontes estão próximas neste caso.`}
    </div>
  </div>`;
}

/* ---- motor de respostas do chat ---- */

/* ============ CHAT DETERMINÍSTICO (sem IA) ============ */
/* Responde por regra sobre os dados. Nunca inventa: se não souber, diz que não sabe. */

function normTxt(t){
  return String(t||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s%.,-]/g," ").replace(/\s+/g," ").trim();
}
function fmtBR(v,d){ return v==null?"—":Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d||0,maximumFractionDigits:d||0}); }
function pct(v){ return v==null?"—":fmtBR(v,1)+"%"; }
function brl(v){ return v==null?"—":"R$ "+fmtBR(v/1e6,2)+"M"; }

/* sinônimos → campo */
/* ============ SUGESTÕES + ADMIN ============ */
/* A planilha é a fonte da verdade. O painel só envia e lê. */

/* ---- inicialização ---- */
document.addEventListener("DOMContentLoaded", function(){
  try{ bootView(); }catch(e){ console.error(e); }
});