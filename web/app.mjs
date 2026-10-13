import './theme.mjs';
import {INKS,TYPES,RARITIES,setName,filterCards,validateCatalog,emptyTops,cleanTops,addCard,moveCard,moveCardTo,resetTop,encodeShare,decodeShare} from './core.mjs';
import {exportPng} from './export.mjs';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const inkInfo=id=>INKS.find(i=>i.id===id);
let catalog={cards:[],sets:[]},set='14',active='Amber',tops=emptyTops(),title='',shared=false,summary=false,toastTimer,db;
let previewId=null,previewInk='Amber',previewTrigger=null,rankingExpanded=false;
let undoReset=null;
let store={v:1,sets:{}};
try { const saved=JSON.parse(localStorage.getItem('lorcana-top5-v1'));if(saved?.v===1&&saved.sets&&typeof saved.sets==='object')store=saved; } catch {}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function notice(message){$('catalog-notice').textContent=message;$('catalog-notice').hidden=!message;}
function persist(){
  if(shared)return;
  store.sets[set]={tops,title};
  try{localStorage.setItem('lorcana-top5-v1',JSON.stringify(store));$('save-status').textContent='Sauvegardé sur cet appareil';}
  catch{$('save-status').textContent='Sauvegarde locale indisponible. Conservez votre lien de partage.';}
}
function loadSet(){
  const saved=store.sets[set];
  // Preserve references when a set temporarily disappears from the catalogue.
  tops=catalog.cards.some(c=>c.set===set)?cleanTops(saved?.tops,set,catalog.cards):Object.fromEntries(INKS.map(i=>[i.id,
    [...new Set(Array.isArray(saved?.tops?.[i.id])?saved.tops[i.id].filter(id=>typeof id==='string'&&/^\d+$/.test(id)):[])].slice(0,5)]));
  title=String(saved?.title??'').slice(0,80);
}
async function openDb(){return new Promise((resolve,reject)=>{
  const req=indexedDB.open('lorcana-top5',1);req.onupgradeneeded=()=>req.result.createObjectStore('catalog');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});}
async function readImported(){try{db=await openDb();return await new Promise((resolve,reject)=>{const r=db.transaction('catalog').objectStore('catalog').get('fr');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}catch{return null;}}
function image(card,cls=''){
  const img=el('img',undefined,cls);img.src=card.thumbnail||card.image;img.alt=[card.name,card.subtitle].filter(Boolean).join(' — ');img.loading='lazy';img.decoding='async';
  img.onerror=()=>{if(img.src!==card.image){img.src=card.image;return;}img.parentElement?.classList.add('image-unavailable');img.alt='Image indisponible';};return img;
}
function dot(ink){const n=el('span',undefined,'dot');n.style.setProperty('--dot',inkInfo(ink)?.color||'#aaa');n.setAttribute('aria-hidden','true');return n;}
function invalidateUndo(ink=active){if(undoReset?.set===set&&undoReset.ink===ink)undoReset=null;}
function toggleCard(card,ink=active){
  if(shared)return;
  const rank=tops[ink].indexOf(card.id);
  if(rank>=0)tops[ink].splice(rank,1);else if(!addCard(tops,ink,card,set))return;
  invalidateUndo(ink);persist();render();
  if(!$('card-dialog').open)document.querySelector(`.card-pick[data-card-id="${card.id}"]`)?.focus();
}
function previewButton(card,ink,cls){
  const b=el('button',undefined,cls);b.setAttribute('aria-label',`Agrandir ${card.name} ${card.subtitle}`.trim());b.setAttribute('aria-haspopup','dialog');b.dataset.previewId=card.id;
  b.onclick=()=>openPreview(card,ink,b);return b;
}
function openPreview(card,ink,trigger){
  previewId=card.id;previewInk=ink;previewTrigger=trigger;renderPreview();$('card-dialog').showModal();
}
function renderPreview(){
  const card=catalog.cards.find(c=>c.id===previewId);if(!card)return;
  $('card-dialog-title').textContent=card.name;$('card-dialog-subtitle').textContent=card.subtitle;
  $('card-dialog-meta').textContent=[card.inks.map(i=>inkInfo(i).name).join(' / '),TYPES[card.type],RARITIES[card.rarity]||card.rarity,`Coût ${card.cost??'—'}`,`N° ${card.number}`,setName(card.set,catalog.sets)].filter(Boolean).join(' · ');
  const img=$('card-dialog-image');if(img.getAttribute('src')!==card.image){img.hidden=false;$('card-dialog-error').hidden=true;img.src=card.image;}
  img.alt=[card.name,card.subtitle].filter(Boolean).join(' — ');
  const selected=tops[previewInk].includes(card.id);const b=$('card-dialog-pick');
  b.hidden=shared;b.disabled=!selected&&tops[previewInk].length===5;
  b.textContent=selected?`Retirer du top ${inkInfo(previewInk).name}`:b.disabled?`Top ${inkInfo(previewInk).name} complet`:`Ajouter au top ${inkInfo(previewInk).name}`;
}
$('card-dialog-close').onclick=()=>$('card-dialog').close();
$('card-dialog').onclick=event=>{if(event.target===$('card-dialog'))$('card-dialog').close();};
$('card-dialog').addEventListener('close',()=>{
  const target=previewTrigger?.isConnected?previewTrigger:[...document.querySelectorAll('[data-preview-id]')].find(b=>b.dataset.previewId===previewId&&b.offsetParent!==null);
  target?.focus();previewId=null;previewTrigger=null;
});
$('card-dialog-image').onerror=()=>{$('card-dialog-image').hidden=true;$('card-dialog-error').hidden=false;};
$('card-dialog-pick').onclick=()=>{const card=catalog.cards.find(c=>c.id===previewId);if(card)toggleCard(card,previewInk);};
$('mobile-ranking-toggle').onclick=()=>{rankingExpanded=!rankingExpanded;renderMobileRanking();};
function renderMobileRanking(){
  document.querySelector('.ranking').classList.toggle('expanded',rankingExpanded);
  $('mobile-ranking-toggle').setAttribute('aria-expanded',String(rankingExpanded));
  $('mobile-ranking-toggle').textContent=`${rankingExpanded?'Replier':'Voir mon top'} (${tops[active].length}/5) ${rankingExpanded?'↑':'↓'}`;
}
function renderSets(){
  const values=[...new Set([set,'14',...catalog.sets.map(s=>s.id)])].sort((a,b)=>+b-+a);
  $('set-select').replaceChildren(...values.map(id=>{const s=catalog.sets.find(s=>s.id===id);const o=el('option',`${id} · ${setName(id,catalog.sets)}${s?'':' — en attente'}`);o.value=id;return o;}));
  $('set-select').value=set;$('set-select').disabled=shared;
  const count=catalog.cards.filter(c=>c.set===set).length;
  const date=catalog.updatedAt?new Date(catalog.updatedAt):null;
  $('catalog-meta').textContent=`${count} cartes standard françaises${date&&!Number.isNaN(+date)?' · Mis à jour le '+date.toLocaleDateString('fr-FR'):''}`;
}
function renderTabs(){
  $('ink-tabs').replaceChildren(...INKS.map(ink=>{const b=el('button',undefined,'ink-tab');b.append(dot(ink.id),document.createTextNode(ink.name));b.setAttribute('aria-pressed',String(active===ink.id));b.onclick=()=>{active=ink.id;render();};return b;}));
  const count=INKS.reduce((n,i)=>n+tops[i.id].length,0);$('progress').textContent=`${count} / 30 favoris sélectionnés`;
}
function renderGrid(){
  const criteria={set,ink:active,query:$('search').value,cost:$('filter-cost').value,rarity:$('filter-rarity').value,type:$('filter-type').value};
  const filtered=Boolean(criteria.query.trim()||criteria.cost||criteria.rarity||criteria.type);
  const cards=filterCards(catalog.cards,criteria);
  $('clear-filters').disabled=!filtered;
  $('collection-title').textContent=`Les cartes ${inkInfo(active).name}`;
  $('card-count').textContent=`${cards.length} carte${cards.length>1?'s':''}${filtered?' trouvée'+(cards.length>1?'s':''):''} · Les bicolores figurent dans leurs deux encres`;
  $('grid').replaceChildren();
  if(!cards.length){const box=el('div',undefined,'empty');box.append(el('span','✦','star'),el('strong',filtered?'Aucune carte trouvée':`La collection vous attend`),el('p',filtered?'Modifiez les filtres ou cliquez sur « Effacer les filtres ».':`Aucune carte de ${setName(set,catalog.sets)} disponible. Choisissez une autre extension ou réessayez après la mise à jour du catalogue.`));$('grid').append(box);return;}
  $('grid').append(...cards.map(card=>{
    const rank=tops[active].indexOf(card.id),selected=rank>=0;
    const b=el('article',undefined,'card'+(selected?' selected':''));
    const preview=previewButton(card,active,'card-preview');const wrap=el('span',undefined,'card-image');wrap.append(image(card));
    preview.append(wrap,el('span','Agrandir ⤢','preview-hint'));
    const name=el('span',card.name,'card-name');name.append(el('span',card.subtitle,'card-subtitle'));
    const meta=el('span',undefined,'card-meta');meta.append(el('span',`N° ${card.number}${card.cost!==null?' · '+card.cost+' ◈':''}`));const colors=el('span',undefined,'card-inks');card.inks.forEach(i=>colors.append(dot(i)));meta.append(colors);
    const pick=el('button',selected?`N° ${rank+1} · Retirer`:'Ajouter au top +','card-pick');pick.setAttribute('aria-pressed',String(selected));pick.setAttribute('aria-label',`${selected?'Retirer':'Ajouter'} ${card.name} ${card.subtitle} ${selected?'du':'au'} top ${inkInfo(active).name}`);
    pick.dataset.cardId=card.id;pick.disabled=shared||(!selected&&tops[active].length===5);pick.onclick=()=>toggleCard(card);
    b.append(preview,name,meta,pick);return b;
  }));
}
function bindDrag(handle,li,index){
  let drag=null;
  const clear=()=>{li.classList.remove('dragging');document.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));drag=null;};
  const targetAt=event=>{
    if(!drag)return -1;
    const rect=$('ranking-list').getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return -1;
    let closest=0,distance=Infinity;
    drag.centers.forEach((y,i)=>{if(Math.abs(event.clientY-y)<distance){distance=Math.abs(event.clientY-y);closest=i;}});return closest;
  };
  handle.onpointerdown=event=>{
    if(event.button!==0||!event.isPrimary)return;
    event.preventDefault();handle.setPointerCapture(event.pointerId);
    drag={ink:active,set,centers:[...$('ranking-list').children].slice(0,tops[active].length).map(n=>{const r=n.getBoundingClientRect();return r.top+r.height/2;})};
    li.classList.add('dragging');
  };
  handle.onpointermove=event=>{
    if(!drag)return;event.preventDefault();const target=targetAt(event);
    [...$('ranking-list').children].forEach((n,i)=>n.classList.toggle('drop-target',i===target&&target!==index));
  };
  handle.onpointerup=event=>{
    if(!drag)return;const target=targetAt(event),valid=!shared&&drag.ink===active&&drag.set===set;clear();
    if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
    if(valid&&moveCardTo(tops,active,index,target)){invalidateUndo();persist();render();$('ranking-list').children[target]?.querySelector('.rank-handle')?.focus();toast(`Carte déplacée au rang ${target+1}.`);}
  };
  handle.onpointercancel=clear;handle.onlostpointercapture=clear;
}
function renderRanking(){
  renderMobileRanking();
  const ink=inkInfo(active);$('ranking-title').replaceChildren(dot(ink.id),document.createTextNode(`Top 5 ${ink.name}`));$('rank-count').textContent=`${tops[active].length} / 5`;
  $('ranking-list').replaceChildren(...Array.from({length:5},(_,index)=>{
    const id=tops[active][index],card=catalog.cards.find(c=>c.id===id);const li=el('li',undefined,'rank-slot'+(!id?' blank':''));li.append(el('span',String(index+1),'rank-number'));
    if(!id){li.append(el('span','Votre prochaine favorite','rank-name'));return li;}
    if(!shared){const handle=el('button','⠿','rank-handle');handle.setAttribute('aria-label',`Déplacer ${card?.name||id}`);handle.title='Glisser pour changer le rang ; les flèches sont aussi disponibles';handle.tabIndex=-1;bindDrag(handle,li,index);li.append(handle);}
    if(card)li.append(image(card,'rank-thumb'));
    const name=el('span',card?.name||`Carte ${id}`,'rank-name');name.append(el('small',card?.subtitle||(!card?'Catalogue de cette carte indisponible':'')));li.append(name);
    if(!shared){const controls=el('span',undefined,'rank-controls');for(const [label,symbol,delta] of [['Monter','↑',-1],['Descendre','↓',1],['Retirer','×',0]]){
      const b=el('button',symbol,delta?'':'remove');b.setAttribute('aria-label',`${label} ${card?.name||id}`);b.disabled=delta===-1?index===0:delta===1?index===tops[active].length-1:false;
      b.onclick=()=>{if(delta)moveCard(tops,active,index,delta);else tops[active].splice(index,1);invalidateUndo();persist();render();$('ranking-list').children[Math.min(index,tops[active].length-1)]?.querySelector('.rank-controls button:not(:disabled)')?.focus();};controls.append(b);
    }li.append(controls);}return li;
  }));
  $('reset-top').hidden=shared;$('reset-top').disabled=!tops[active].length;
  $('undo-reset').hidden=shared||!undoReset;
  $('undo-message').textContent=undoReset?`Top ${inkInfo(undoReset.ink).name} réinitialisé (${setName(undoReset.set,catalog.sets)}).`:'';
}
function renderSummary(){
  $('ranking-name').value=title;$('ranking-name').readOnly=shared;$('back-editor').hidden=shared;
  $('summary-grid').replaceChildren(...INKS.map(ink=>{
    const section=el('section',undefined,'summary-row');const h=el('h3');h.append(dot(ink.id),document.createTextNode(ink.name));section.append(h);
    const row=el('div',undefined,'summary-cards');row.append(...Array.from({length:5},(_,index)=>{
      const box=el('div',undefined,'summary-card');const id=tops[ink.id][index],card=catalog.cards.find(c=>c.id===id);
      if(card){const preview=previewButton(card,ink.id,'summary-preview');preview.append(image(card));box.append(preview);const p=el('p',card.name);p.append(el('small',card.subtitle));box.append(p);}else{box.append(el('div',id?'?':'—','summary-placeholder'));if(id)box.append(el('p',`Carte ${id} · catalogue indisponible`));}
      box.append(el('span',String(index+1),'rank-badge'));return box;
    }));section.append(row);return section;
  }));
}
function render(){
  document.documentElement.style.setProperty('--ink',inkInfo(active).color);
  renderSets();renderTabs();renderGrid();renderRanking();if(summary)renderSummary();
  $('editor').hidden=summary;$('summary').hidden=!summary;$('shared-notice').hidden=!shared;
  $('summary-toggle').textContent=summary&&!shared?'Revenir aux cartes ←':'Voir mes six tops ↗';
  if($('card-dialog').open)renderPreview();
}
function viewSummary(value){summary=value;render();}
function shareUrl(){const u=new URL(location.href);u.hash='top='+encodeShare(set,title,tops);return u.href;}
$('set-select').onchange=()=>{persist();set=$('set-select').value;loadSet();$('search').value='';render();};
$('search').oninput=renderGrid;
for(const id of ['filter-cost','filter-rarity','filter-type'])$(id).onchange=renderGrid;
$('clear-filters').onclick=()=>{for(const id of ['search','filter-cost','filter-rarity','filter-type'])$(id).value='';renderGrid();$('search').focus();};
$('reset-top').onclick=()=>{
  if(shared)return;const ids=resetTop(tops,active);if(!ids)return;
  undoReset={set,ink:active,ids};persist();render();$('undo-button').focus();
};
$('undo-button').onclick=()=>{
  if(shared||!undoReset)return;const snapshot=undoReset;undoReset=null;
  if(set!==snapshot.set){persist();set=snapshot.set;loadSet();}
  active=snapshot.ink;tops[active]=[...snapshot.ids];persist();render();$('reset-top').focus();toast('Votre top a été restauré dans son ordre initial.');
};
$('view-summary').onclick=()=>viewSummary(true);
$('summary-toggle').onclick=()=>viewSummary(shared||!summary);
$('back-editor').onclick=()=>viewSummary(false);
$('ranking-name').oninput=()=>{title=$('ranking-name').value;persist();};
$('share-link').onclick=async()=>{const url=shareUrl();try{await navigator.clipboard.writeText(url);toast('Lien copié. Votre sélection est prête à être partagée.');}catch{$('share-fallback').hidden=false;$('share-url').value=url;$('share-url').select();toast('Copiez le lien affiché sous les boutons.');}};
$('copy-ranking').onclick=()=>{
  const copy=cleanTops(tops,set,catalog.cards);
  const removed=INKS.some(i=>copy[i.id].length!==tops[i.id].length);
  if(removed){toast('Le catalogue de ce set est indisponible. Réessayez après sa mise à jour.');return;}
  shared=false;tops=copy;history.replaceState(null,'',location.pathname+location.search);persist();summary=false;render();toast('Votre version est prête.');
};
$('print').onclick=()=>window.print();
$('export-png').onclick=async()=>{
  const b=$('export-png');b.disabled=true;b.textContent='Préparation de l’image…';
  try{const missing=await exportPng({set,title,tops,catalog,scope:$('export-scope').value});toast(missing?`Image exportée. ${missing} visuel(s) indisponible(s) : les noms et rangs sont conservés.`:'Votre image PNG est téléchargée.');}
  catch{toast('L’image n’a pas pu être exportée. Utilisez Imprimer / PDF ou le lien de partage.');}
  finally{b.disabled=false;b.textContent='Exporter en image PNG ↓';}
};
function applyShare(){
  if(!location.hash.startsWith('#top='))return false;
  try{const s=decodeShare(location.hash);set=s.set;title=s.title;tops=s.tops;shared=true;summary=true;return true;}
  catch{toast('Le lien de partage est invalide. Votre sauvegarde locale est conservée.');return false;}
}
window.addEventListener('hashchange',()=>{if(!applyShare()){shared=false;summary=false;loadSet();}render();});
async function init(){
  const imported=await readImported();
  try{
    const response=await fetch('./data/catalog.json',{cache:'no-cache'});if(!response.ok)throw new Error();
    const official=validateCatalog(await response.json());
    if(imported){const cached=validateCatalog(imported);const merged=new Map(cached.cards.map(c=>[c.id,c]));official.cards.forEach(c=>merged.set(c.id,c));catalog=validateCatalog({...official,updatedAt:official.updatedAt||cached.updatedAt,cards:[...merged.values()],sets:[...official.sets,...cached.sets]});}else catalog=official;
  }catch{try{if(imported)catalog=validateCatalog(imported);}catch{}notice('Le catalogue n’a pas pu être chargé. Rechargez la page dans quelques instants.');}
  if(!catalog.cards.length)notice('Le catalogue français est momentanément indisponible. Réessayez dans quelques instants.');
  if(!applyShare())loadSet();render();
}
init();
