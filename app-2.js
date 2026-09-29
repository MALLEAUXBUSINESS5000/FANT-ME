const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function cells(l,d){const o=[];let c='',q=false;for(const ch of l){if(ch=='"')q=!q;else if(ch==d&&!q){o.push(c);c=''}else c+=ch}o.push(c);return o.map(x=>x.trim())}
function num(s){if(s==null||s==='')return NaN;s=String(s).replace(/[\s\u00a0€]/g,'');s=s.includes(',')?s.replace(/\./g,'').replace(',','.'):s;return /^[-+]?\d+(\.\d+)?$/.test(s)?parseFloat(s):NaN}
function pdate(s){let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],m[2]-1,+m[3]);m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,m[2]-1,+m[1])}return null}
function parseCSV(t){
  const L=t.split(/\r?\n/).filter(x=>x.trim());if(!L.length)return[];
  const d=[';',',','\t'].map(x=>[x,L.slice(0,8).reduce((a,l)=>a+cells(l,x).length,0)]).sort((a,b)=>b[1]-a[1])[0][0];
  let cD=-1,cM=-1,cL=-1,cS=-1;
  for(const l of L.slice(0,20)){const h=cells(l,d).map(norm);if(h.some(x=>x.includes('DATE'))&&h.some(x=>x.includes('MONTANT')||x.includes('DEBIT')||x.includes('AMOUNT'))){cD=h.findIndex(x=>x.includes('DEBIT'));cM=h.findIndex(x=>x.includes('MONTANT')||x.includes('AMOUNT'));cL=h.findIndex(x=>/DESCRIPTION|LIBELLE|LABEL|INTITULE/.test(x));cS=h.findIndex(x=>/^(ETAT|STATE|STATUT)/.test(x));break}}
  const rows=[];
  for(const l of L){const c=cells(l,d);const di=c.findIndex(x=>pdate(x));if(di<0)continue;
    let a=NaN;
    if(cD>=0&&!isNaN(num(c[cD])))a=-Math.abs(num(c[cD]));
    else if(cM>=0)a=num(c[cM]);
    else for(let i=c.length-1;i>=0;i--){if(i!==di&&!isNaN(num(c[i]))){a=num(c[i]);break}}
    if(!(a<0))continue;
    if(cS>=0&&/REVERT|DECLIN|FAIL|ANNUL|REFUS|REJET/.test(norm(c[cS]||'')))continue;
    const lab=(cL>=0&&c[cL])||c.filter((x,i)=>i!==di&&isNaN(num(x))&&!pdate(x)).sort((x,y)=>y.length-x.length)[0]||'';
    rows.push({d:pdate(c[di]),label:lab,amt:-a})}
  return rows}
const STOP=/\b(PRLV|PRELEVEMENT|SEPA|PAIEMENT|CB|CARTE|VIR|VIREMENT|REF|ECH|MANDAT|DE|DU|LE|LA|FACTURE|ABONNEMENT|COM|WWW)\b/g;
const key=l=>norm(l).replace(/[^A-Z ]/g,' ').replace(STOP,' ').replace(/\s+/g,' ').trim().split(' ').slice(0,2).join(' ');
const titre=s=>s.toLowerCase().replace(/(^|\s)\S/g,x=>x.toUpperCase());
function detect(rows){
  const g={};for(const r of rows){const k=key(r.label);if(k.length>=3)(g[k]=g[k]||[]).push(r)}
  const out=[];
  for(const k in g){
    const v=g[k].sort((a,b)=>a.d-b.d).filter((r,i,a)=>!i||r.d-a[i-1].d>86400000);
    if(v.length<2)continue;
    const gaps=v.slice(1).map((r,i)=>Math.round((r.d-v[i].d)/864e5)),m=[...gaps].sort((a,b)=>a-b)[gaps.length>>1];
    const am=v.map(r=>r.amt),lo=Math.min(...am),hi=Math.max(...am);
    let f=0,lib='';if(m>=25&&m<=36){f=12;lib='par mois'}else if(m>=80&&m<=100){f=4;lib='par trimestre'}else continue;
    if(!gaps.every(x=>Math.abs(x-m)<=6)||hi/lo>1.25)continue;
    if(v.length<3&&hi-lo>0.01)continue;
    const last=v[v.length-1];
    out.push({nom:titre(k),brut:last.label,montant:last.amt,lib,annuel:Math.round(last.amt*f*100)/100,n:v.length,coche:false})}
  return out.sort((a,b)=>b.annuel-a.annuel)}
const eur=(n,d=0)=>n.toLocaleString('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:d,maximumFractionDigits:d});
function lettre(u,it){return `${u.nom||'[Ton nom]'}\n${u.adresse||'[Ton adresse]'}\n\n${it.nom}\nService résiliation\n\nFait à [ville], le ${new Date().toLocaleDateString('fr-FR')}\n\nObjet : résiliation de mon abonnement\nRéférence client ou contrat : [à compléter]\n\nMadame, Monsieur,\n\nPar la présente, je vous notifie la résiliation de mon abonnement « ${it.nom} », prélevé ${eur(it.montant,2)} ${it.lib}. Cette résiliation prend effet à la première échéance possible.\n\nMerci de cesser tout prélèvement à l'issue de la période en cours et de me confirmer la résiliation par écrit, en indiquant la date d'effet.\n\nÀ défaut de confirmation, je ferai opposition aux prélèvements auprès de ma banque.\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n${u.nom||'[Ton nom]'}`}
function exemple(){const now=new Date(),R=[["NETFLIX.COM",13.49,3],["SPOTIFY AB",10.99,8],["BASIC FIT",29.9,12],["ICLOUD STORAGE",2.99,17],["CANAL PLUS",24.99,5]];let s="Date;Libellé;Montant\n";for(let i=6;i>=1;i--)for(const[n,a,j]of R){const d=new Date(now.getFullYear(),now.getMonth()-i,j);s+=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()};PRLV SEPA ${n} REF${1000+i*7};-${String(a).replace('.',',')}\n`}
  s+=`03/${String(now.getMonth()||12).padStart(2,'0')}/${now.getFullYear()};CARTE CARREFOUR MARKET;-47,20\n`;return s}
if(typeof module!=='undefined')module.exports={parseCSV,detect,lettre,exemple};
