document.getElementById("logoImg").src = ASSETS.logo;

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
function kpis(list){
  const n = list.length || 1;
  const b = list.filter(g=>g.final==="B").length;
  const rA = list.filter(g=>g.rampagem&&g.rampagem.status==="ativa").length;
  const rM6 = list.filter(g=>g.rampagem&&g.rampagem.status==="m6").length;
  const rV = list.filter(g=>g.rampagem&&g.rampagem.status==="vencida").length;
  const chA = list.filter(g=>g.churn!=null&&g.churn>20).length;
  const crcLive = list.reduce((a,g)=>a+((g.crc_ploomes||{}).mes_atual||0),0);
  el("kpis").innerHTML = `
    <div class="kpi"><div class="t">GCs no filtro</div><div class="v">${list.length}</div><div class="d">de 61 consolidados</div></div>
    <div class="kpi"><div class="t">Nível B</div><div class="v">${b}</div><div class="d">título até janeiro</div></div>
    <div class="kpi o"><div class="t">Rampagem ativa</div><div class="v">${rA}</div><div class="d">nível D até o 6º mês</div></div>
    <div class="kpi o"><div class="t">Nível D — M6</div><div class="v">${rM6}</div><div class="d">passou do 6º mês, segue em D</div></div>
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
  const m6 = ds.filter(g=>g.rampagem&&g.rampagem.status==="m6");
  const venc = ds.filter(g=>g.rampagem&&g.rampagem.status==="vencida");
  const tot = Math.max(ds.length,1);
  const linha = (rot,arr,cor)=>{
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
      <div style="width:118px;font-size:12px;font-weight:600;color:var(--lev-purple-d)">${rot}</div>
      <div class="bar" style="flex:1;height:20px;border-radius:6px"><i style="width:${arr.length/tot*100}%;background:${cor};border-radius:6px"></i>
      <span style="position:absolute;left:10px;top:2px;color:#fff;font-size:11px;font-weight:700">${arr.length}</span></div></div>`;
  };
  return linha("Ativa (até 6m)",ativa,"linear-gradient(90deg,#E8913D,#B87333)")
       + linha("M6 (6m+, em D)",m6,"linear-gradient(90deg,#8E2D5B,#5B2D8E)")
       + `<div class="mini" style="margin-top:8px"><b>Ativa:</b> ${ativa.map(g=>esc(g.nome.split(" ")[0])+" ("+g.meses_casa+"m)").join(", ")||"—"}<br>
    <b>M6 — mais tempo em D:</b> ${m6.slice().sort((a,b)=>b.meses_casa-a.meses_casa).slice(0,5).map(g=>esc(g.nome.split(" ")[0])+" ("+g.meses_casa+"m)").join(", ")||"—"}</div>`;
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
      <th data-k="nome">Gerente Comercial</th><th data-k="final">Posição</th>
      <th>REC · PAC · CHURN · CRC · MB</th><th data-k="cad_out">Cad.</th><th data-k="meses_casa">Casa</th>
      <th data-k="ramp">Rampagem</th><th data-k="pac">PAC</th><th data-k="r6">R6</th>
      <th data-k="churn">Churn 6M</th><th data-k="farol">Farol MB</th>
      <th data-k="crc_live">CRC (Ploomes)</th><th data-k="trava">Trava p/ subir</th>
    </tr></thead><tbody>
    ${sortList(list).map(g=>`
      <tr class="${g.final==='D'&&g.rampagem&&g.rampagem.status==='vencida'&&g.pac>=40?'hl':''}">
        <td><b>${esc(g.nome)}</b> <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:22px;height:22px;vertical-align:-6px;border-radius:50%" alt="${g.final}"><div class="mini">${esc(g.cargo)} · ${esc(g.regional)}</div></td>
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
        <div class="mcard nv${g.final}" onclick="abrirGC('${esc(g.nome).replace(/'/g,"\\'")}')">
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
    <div class="kpi"><div class="t">GCs no filtro</div><div class="v">${list.length}</div><div class="d">de 61 consolidados</div></div>
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
function viewBonus(){
  const list = filtered();
  const ok = list.filter(g=>bonusOk(g.bonus)===true);
  const no = list.filter(g=>bonusNaoOk(g.bonus));
  const ind = list.filter(g=>{const r=bonusOk(g.bonus); return r===null;});
  const recebe = g=>(g.bonus.bonus_efetivo||0) > 0;
  /* três grupos dentro de quem atingiu o critério */
  const pagos   = ok.filter(recebe);                                  // recebe o bônus
  const cortados= ok.filter(g=>!recebe(g));                            // atingiu, mas o teto zerou
  const reduzidos = pagos.filter(g=>(g.bonus.bonus_efetivo||0) < (g.bonus.bonus_nominal||0));
  const totNom = ok.reduce((a,g)=>a+(g.bonus.bonus_nominal||0),0);
  const totEf  = ok.reduce((a,g)=>a+(g.bonus.bonus_efetivo||0),0);
  return `
  <div class="rule"><b>Bônus de performance — fechamento de outubro/2026.</b> Critérios por nível: <b>D</b> rampagem do mês · <b>C</b> crescimento ≥15% em PAC e CRC + churn &lt;20% · <b>B</b> PAC ≥ 50 <i>ou</i> (PAC ≥ 45 <i>e</i> Score MB verde) · <b>A</b> PAC ≥ 70.
  <br><b>Teto remuneratório:</b> quem entrou antes do PPC pode ter salário acima da mensalidade prevista. O bônus só é pago até a soma <i>salário + bônus</i> caber no <b>teto do nível</b> — D R$ 4.000 · C R$ 4.500 · B R$ 5.000 · A R$ 6.000.</div>
  <div class="kpis">
    <div class="kpi g"><div class="t">Recebem bônus</div><div class="v" style="color:var(--green)">${pagos.length}</div><div class="d">${reduzidos.length} com valor reduzido</div></div>
    <div class="kpi o"><div class="t">Atingiram, mas teto zerou</div><div class="v" style="color:var(--gem)">${cortados.length}</div><div class="d">salário já no teto do nível</div></div>
    <div class="kpi r"><div class="t">Não atingiram</div><div class="v" style="color:var(--lev-red)">${no.length}</div><div class="d">critério pendente</div></div>
    <div class="kpi"><div class="t">Folha de bônus</div><div class="v" style="font-size:16px">R$ ${fmtN(totEf)}</div><div class="d">nominal seria R$ ${fmtN(totNom)}</div></div>
  </div>
  <div class="panel"><h3>💰 Recebem o bônus</h3><div class="ps">critério cumprido e valor já ajustado ao teto do nível</div>
    <table class="btab"><tbody>
    ${pagos.map(g=>bonusRow(g,"ok")).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>
  <div class="panel" style="margin-top:14px"><h3>⚠️ Atingiram o critério, mas o teto zerou</h3><div class="ps">o salário atual já consome todo o teto da categoria — não sobra espaço para o bônus</div>
    <table class="btab"><tbody>
    ${cortados.map(g=>bonusRow(g,"id")).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>
  <div class="panel" style="margin-top:14px"><h3>⛔ Não atingiram</h3><div class="ps">critério em vermelho = pendência do mês</div>
    <table class="btab"><tbody>
    ${no.map(g=>bonusRow(g,"no")).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>
  ${ind.length?`<div class="panel" style="margin-top:14px"><h3>⏳ Critérios em aberto</h3><div class="ps">dependem de dados que a apuração ainda não fechou</div>
    <table class="btab"><tbody>${ind.map(g=>bonusRow(g,"id")).join("")}</tbody></table></div>`:""}`;
}

function bcls(b, cls){
  if(b && b.atingiu && b.bonus_efetivo===0) return "bno";
  if(b && b.atingiu && b.bonus_efetivo>0 && b.bonus_efetivo<b.bonus_nominal) return "bcut";
  if(b && b.atingiu) return "bok";
  return cls==="ok"?"bok":cls==="no"?"bno":"bind";
}
function tetoHTML(b){
  if(!b || b.teto==null) return "";
  if(b.salario==null){
    return `<div class="teto ok"><b>Sem salário cadastrado</b> — bônus integral de R$ ${fmtN(b.bonus_nominal)} (teto ${b.final||""} R$ ${fmtN(b.teto)})</div>`;
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
function fmtN(v){ return v==null?"—":Number(v).toLocaleString("pt-BR",{maximumFractionDigits:0}); }

function bonusRow(g, cls){
  const linhas = g.bonus.linhas.map(l=>{
    const st = l[3]===true?"ok":l[3]===false?"no":"id";
    const ic = l[3]===true?"✓":l[3]===false?"✕":"?";
    return `<div class="blin"><span class="st ${st}">${ic}</span><b>${l[0]}</b> — ${l[2]}</div>`;
  }).join("");
  return `<tr><td style="width:26%">
    <b>${esc(g.nome)}</b> <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:20px;height:20px;vertical-align:-5px;border-radius:50%">
    <div class="mini">${esc(g.cargo)} · nível ${g.final} · alvo ${g.bonus.alvo}</div></td>
    <td>${linhas}${tetoHTML(g.bonus)}</td>
    <td class="num"><span class="bdg ${bcls(g.bonus,cls)}">${g.bonus.bonus_efetivo!=null?(g.bonus.bonus_efetivo>0?"R$ "+fmtN(g.bonus.bonus_efetivo):"R$ 0"):g.bonus.bonus}</span></td></tr>`;
}

/* ---------- VIEW: BÔNUS DINÂMICO ---------- */
function viewDinamica(){
  const list = filtered();
  const ok = list.filter(g=>bonusOk(g.bonus_din)===true);
  const no = list.filter(g=>bonusNaoOk(g.bonus_din));
  const ind = list.filter(g=>{const r=bonusOk(g.bonus_din); return r===null;});
  const excl = list.reduce((a,g)=>a+(g.din?.excl_ativos_out||0),0);
  const exclTot = list.reduce((a,g)=>a+(g.din?.excl||0),0);
  return `
  <div class="rule"><b>Bônus H. Dinâmica</b> — mesma regra do Acompanhamento, com uma diferença: <b>parceiros com menos de 90 dias na carteira do GC que já tinham produção no mês anterior à entrada não entram no PAC</b>. O PAC ajustado é o que compara com a meta de rampagem (níveis D) e os critérios de PAC (A/B/C). Fonte da carteira: campo <i>Dias na carteira</i> do Ploomes × produção por parceiro da planilha analítica.</div>
  <div class="kpis">
    <div class="kpi g"><div class="t">Atingiram (dinâmico)</div><div class="v" style="color:var(--green)">${ok.length}</div><div class="d">bônus de out/2026</div></div>
    <div class="kpi r"><div class="t">Não atingiram</div><div class="v" style="color:var(--lev-red)">${no.length}</div><div class="d">critério pendente</div></div>
    <div class="kpi o"><div class="t">Sem dados suficientes</div><div class="v">${ind.length}</div><div class="d">critérios abertos</div></div>
    <div class="kpi"><div class="t">Parceiros desconsiderados</div><div class="v">${exclTot}</div><div class="d">${excl} com produção em out</div></div>
  </div>
  <div class="panel"><h3>✅ Atingiram o bônus (carteira ajustada)</h3><div class="ps">todos os critérios cumpridos — PAC já sem os parceiros recém-chegados que vinham produzindo</div>
    <table class="btab"><tbody>
    ${ok.map(g=>dinRow(g,"ok")).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>
  <div class="panel" style="margin-top:14px"><h3>⛔ Não atingiram</h3><div class="ps">critério em vermelho = pendência do mês</div>
    <table class="btab"><tbody>
    ${no.map(g=>dinRow(g,"no")).join("")||`<tr><td class="mini">Ninguém no filtro.</td></tr>`}
    </tbody></table></div>
  ${ind.length?`<div class="panel" style="margin-top:14px"><h3>⏳ Critérios em aberto</h3><div class="ps">dependem de dados que a apuração ainda não fechou</div>
    <table class="btab"><tbody>${ind.map(g=>dinRow(g,"id")).join("")}</tbody></table></div>`:""}`;
}
function dinRow(g, cls){
  const bd = g.bonus_din || {};
  const bruto = g.bonus || {};
  const linhas = (bd.linhas||[]).map(l=>{
    const st = l[3]===true?"ok":l[3]===false?"no":"id";
    const ic = l[3]===true?"✓":l[3]===false?"✕":"?";
    return `<div class="blin"><span class="st ${st}">${ic}</span><b>${esc(l[0])}</b> — ${l[2]}</div>`;
  }).join("");
  const excl = bd.excl||0;
  const excecao = (g.din||{}).excecao;
  const ajuste = excecao
    ? `<div class="mini" style="margin-top:4px;padding:5px 7px;background:#FDF0DD;border-radius:6px;color:#8A5510"><b>Exceção:</b> ${esc(excecao)}. PAC integral de <b>${bd.pac_ajust}</b>.</div>`
    : excl>0
    ? `<div class="mini" style="margin-top:4px">PAC ajustado: <b>${bd.pac_ajust}</b> <span style="color:var(--mut)">(bruto ${bd.pac_base} − ${excl} parceiro${excl>1?"s":""} que já produzia${excl>1?"m":""} antes da carteira)</span></div>`
    : `<div class="mini" style="margin-top:4px">Sem exclusão — nenhum parceiro novo com produção anterior</div>`;
  const mudou = (bd.linhas||[]).some(l=>l[3]===true) !== (bruto.linhas||[]).some(l=>l[3]===true);
  return `<tr><td style="width:26%">
    <b>${esc(g.nome)}</b> <img src="${ASSETS["esc_"+g.final.toLowerCase()+"_circ"]||""}" style="width:20px;height:20px;vertical-align:-5px;border-radius:50%">
    <div class="mini">${esc(g.cargo)} · nível ${g.final} · alvo ${bd.alvo||bruto.alvo||"—"}</div></td>
    <td>${linhas}${ajuste}${tetoHTML(bd)}</td>
    <td class="num"><span class="bdg ${bcls(bd,cls)}">${bd.bonus_efetivo!=null?(bd.bonus_efetivo>0?"R$ "+fmtN(bd.bonus_efetivo):"R$ 0"):(bd.bonus||bruto.bonus||"")}</span></td></tr>`;
}

/* ---------- VIEW: ANÁLISE POR GC ---------- */
const PPC = {
  rec: {C:20,  B:50,  A:70,  AB:80},
  pac: {C:25,  B:40,  A:60,  AB:70},
  crc: {C:1.0, B:2.0, A:3.0, AB:2.5},
  churnMax: 20
};
const NIVEIS = ["D","C","B","A"];          /* AB+ não é nível: é posição de destaque mensal */
/* "Foco" de cada nível conforme a seção 5 da Política de Progressão */
const NIVEL_LONGO = {
  D:"Geração",
  C:"Evolução",
  B:"Consolidação",
  A:"Consagração"
};
/* "AB+" não é nível da carreira: é a posição de destaque do mês — o GC que atinge
   os indicadores no mês anterior entra em posição de destaque naquele mês. */
const DESTAQUE = "Extraordinário";

const FAIXA_MB = [
  ["D1",0,25],["D2",25,45],["D3",45,55],
  ["C1",55,60],["C2",60,65],["C3",65,70],
  ["B1",70,75],["B2",75,80],["B3",80,95],["A1",95,999]
];
const ORDEM_LUZ = ["D1","D2","D3","C1","C2","C3","B1","B2","B3","A1"];
const ORDEM_IND = ["crc","pac","churn","rec"];   /* Score MB vive no semáforo */

/* avalia o bônus respeitando o modo:
   "e"  = todas as linhas precisam ser verdadeiras
   "ou" = basta uma (nível B: PAC>=50 OU PAC>=45 com Score MB verde) */
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

  const r6 = g.r6_out, pac = g.pac_out, ch = g.churn_out, crc = (g.crc_out||0)/1e6;
  const farol = (g.farol && g.farol!=="#DIV/0!") ? g.farol : farolDeScore(g.score);
  const cr = g.cresc || {};

  const recAlvo = emRamp ? null : (prox ? PPC.rec[prox] : null);
  const pacAlvo = emRamp ? null : (prox ? PPC.pac[prox] : null);
  const crcAlvo = emRamp ? null : (prox ? PPC.crc[prox] : null);
  const mbAlvo = emRamp ? null : (prox==="C" ? "C1" : prox==="B" ? "C2" : prox==="A" ? "B1" : null);
  const mbAlvoDestaque = "A1";   /* Selo Extraordinário exige Score MB A1 */

  const recOk = recAlvo==null ? null : (r6!=null && r6>=recAlvo);
  const pacOk = pacAlvo==null ? null : (pac!=null && pac>=pacAlvo);
  const chOk  = ch==null ? null : ch < PPC.churnMax;
  const crcOk = crcAlvo==null ? null : (crc>=crcAlvo);
  const idxA = ORDEM_LUZ.indexOf(farol), idxB = mbAlvo ? ORDEM_LUZ.indexOf(mbAlvo) : null;
  const mbOk  = (idxB==null || idxA<0) ? null : idxA>=idxB;

  /* Nível C: bônus é crescimento de PAC e CRC ≥15% no MÊS + churn <20% */
  const cresceu = (lvl==="C" && !emRamp)
    ? (cr.pac!=null && cr.crc!=null ? (cr.pac>=15 && cr.crc>=15) : null)
    : null;

  return [
    {k:"crc", nm:"CRC — PRODUÇÃO", sub:"produção vendida no mês (consolidado)",
     val:crc, fmt:v=>v==null?"—":"R$ "+v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"<span class='un'>M</span>",
     gat: crcAlvo==null?"sem gatilho na rampagem":`Gatilho ${alvoNome}: ≥ R$ ${crcAlvo.toLocaleString("pt-BR",{minimumFractionDigits:1})}M`,
     meta: crcAlvo==null?"foco: cadastros e positivações":`Meta ${alvoNome}: R$ ${crcAlvo.toLocaleString("pt-BR",{minimumFractionDigits:1})}M`,
     ok:crcOk, prog: crcAlvo ? Math.min(1,crc/crcAlvo) : null},

    {k:"pac", nm:"PAC — PARCEIROS ATIVOS", sub:"parceiros com produção no mês (consolidado)",
     val:pac, fmt:v=>v==null?"—":v.toFixed(0),
     gat: pacAlvo==null?"sem gatilho na rampagem":`Gatilho ${alvoNome}: ≥ ${pacAlvo}`,
     meta: pacAlvo==null?"foco: cadastros e positivações":`Meta ${alvoNome}: ${pacAlvo}`,
     ok:pacOk, prog: pacAlvo&&pac!=null ? Math.min(1,pac/pacAlvo) : null},

    {k:"churn", nm:"CHURN", sub:"parceiros perdidos no mês (consolidado)",
     val:ch, fmt:v=>v==null?"—":v.toFixed(1)+"<span class='un'>%</span>",
     gat:`Teto: < ${PPC.churnMax}%`,
     meta: ch==null?"sem apuração":(ch<10?"metade do teto":ch<PPC.churnMax?"uso de "+(ch/PPC.churnMax*100).toFixed(0)+"% do teto":"acima do teto em "+(ch-PPC.churnMax).toFixed(1)+" p.p."),
     ok:chOk, prog: ch!=null ? Math.min(1,ch/PPC.churnMax) : null},

    {k:"rec", nm:"RECORRÊNCIA", sub:"R6 — producente nos últimos 6 meses",
     val:r6, fmt:v=>v==null?"—":v.toFixed(1)+"<span class='un'>%</span>",
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
  return `<div class="trilha">` + grupos.map(([letra,lista])=>{
    const luzes = lista.map(n=>{
      const i = ORDEM_LUZ.indexOf(n);
      const on = i===idx;
      return `<div class="luz ${n[0].toLowerCase()} ${on?"on":""}"></div>`;
    }).join("");
    return `<div class="grupo"><div class="luzes">${luzes}</div><div class="lbl">${letra}</div></div>`;
  }).join("") + `</div>`;
}

/* Selo Extraordinário (AB+): requisitos mensais da seção 6 da política.
   Não é nível — é a posição de destaque do mês, olhando só o resultado do mês anterior. */
function requisitosDestaque(g){
  const baseB = g.final==="B", baseA = g.final==="A";
  const elegivelBase = baseB || baseA;
  const r6 = g.r6_out, pac = g.pac_out, ch = g.churn_out, crc = (g.crc_out||0)/1e6;
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
    return `<div class="indc st-${st}">
      <div class="nm">${d.nm}</div><div class="gt">${d.gat}</div>
      <div class="vl">${d.fmt(d.val)}</div>
      <div class="mt">${d.meta}</div>
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

  <div class="ind5">
    ${blocos}
    <div class="semafarobloco">
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
            <span class="tx">Score MB <span class="mini">— Gatilho ${prox||"—"}: ${g.final==="C"?"C1":g.final==="B"?"C2":g.final==="A"?"B1":"A1"}</span></span>
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
  const alvo = g.final==="C"?"C1":g.final==="B"?"C2":g.final==="A"?"B1":"A1";
  const f = (g.farol && g.farol!=="#DIV/0!") ? g.farol : farolDeScore(g.score);
  return ORDEM_LUZ.indexOf(f) >= ORDEM_LUZ.indexOf(alvo);
}

/* ---------- RENDER ---------- */
const TITLES = {
  painel: ["Painel Geral — PPC Lev","Posição consolidada (jan/jul) · PAC e R6 do último mês · CRC, Churn e Score MB na média 6M · CRC ao vivo direto do Ploomes"],
  bonus: ["Acompanhamento de Bônus de Performance","Quem atingiu e quem não atingiu os critérios do mês, por nível — conforme a Política de Progressão Comercial"],
  gc: ["Análise por GC","Leitura individual do Gerente Comercial: posição atual, os indicadores do PPC e o semáforo do Score MB em 10 luzes"],
  dinamica: ["Acompanhamento de Bônus c/ Hierarquia Dinâmica","Mesmo critério do Acompanhamento, com uma diferença: parceiros com menos de 90 dias na carteira do GC que JÁ tinham produção no mês anterior à entrada são desconsiderados do PAC"]
};
function renderFiltros(){
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
    const fb = el("fbtn"); if(fb) fb.classList.remove("mostra");
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
  const c = el("fcount"); if(c){ c.textContent = n; c.style.opacity = n?1:.45; }
  const fb = el("fbtn"); if(fb) fb.classList.toggle("mostra", state.view!=="gc");
}
function gcAtual(){
  const lista = GCS.slice().sort((a,b)=>a.nome.localeCompare(b.nome));
  return lista.find(g=>g.nome===gcSel) || filtered()[0] || lista[0];
}
function render(){
  if(state.view==="gc"){ const a = gcAtual(); if(a) gcSel = a.nome; }
  el("vtitle").textContent = TITLES[state.view][0];
  el("vsub").textContent = TITLES[state.view][1];
  renderFiltros();
  el("view").innerHTML = state.view==="painel"?viewPainel():state.view==="bonus"?viewBonus():state.view==="dinamica"?viewDinamica():viewGC();
  if(state.view==="painel"){
    el("sortBtns").innerHTML = `<span class="mini" style="align-self:center">Ordenar por:</span>`+
      [["pac","PAC"],["r6","R6"],["churn","Churn"],["crc_live","CRC Ploomes"],["cad_out","Cadastros"],["meses_casa","Tempo de casa"],["trava","Travas"],["nome","Nome"]]
      .map(([k,l])=>`<button class="${state.sort===k?'on':''}" onclick="setSort('${k}')">${l}</button>`).join("");
  }
  document.querySelectorAll("aside nav button, .mnav button").forEach(b=>b.classList.toggle("on", b.dataset.v===state.view));
}
function toggleFiltros(){
  const h = el("filtros");
  if(h) h.classList.toggle("aberto");
}
window.toggleFiltros = toggleFiltros;

function go(v){ state.view=v; if(location.hash!=="#"+v) location.hash=v; render(); }
if(location.hash) state.view = location.hash.slice(1);
function setSort(k){ state.dir=(state.sort===k?-state.dir:-1); state.sort=k; render(); }
window.go=go; window.setSort=setSort;
el("foot").innerHTML = "Fontes: Estudo PPC (consolidação jan–jun) · Dados Gerentes Comerciais out/2026 · Score MB set/2026 (Controladoria) · <b>Produção CRC via API do Ploomes</b> (sincronização diária) · Política de Progressão Comercial. Gestão do ex-superintendente Cassiano transferida ao Zagui.";
render();