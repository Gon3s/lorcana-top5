export const INKS = [
  {id:'Amber', name:'Ambre', color:'#edbd53'},
  {id:'Amethyst', name:'Améthyste', color:'#b395ed'},
  {id:'Emerald', name:'Émeraude', color:'#64cb9d'},
  {id:'Ruby', name:'Rubis', color:'#f27c89'},
  {id:'Sapphire', name:'Saphir', color:'#6db8ed'},
  {id:'Steel', name:'Acier', color:'#b5c3d3'}
];
export const SOURCE = 'https://api.lorcana.ravensburger.com/v3/catalog/fr';
const knownInks = new Set(INKS.map(x=>x.id));
const canonicalInk = new Map(INKS.map(x=>[x.id.toUpperCase(),x.id]));
export function safeImage(value) {
  try { const u=new URL(value); return u.protocol==='https:' ? u.href : ''; } catch { return ''; }
}
export function normalizeCatalog(raw) {
  if (!raw || typeof raw!=='object' || !raw.cards) throw new Error('Le fichier ne contient pas de catalogue de cartes.');
  if (raw.schemaVersion===1 && Array.isArray(raw.cards)) return validateCatalog(raw);
  const sourceCards=Array.isArray(raw.cards) ? raw.cards : Object.values(raw.cards).flat();
  const cards=[], ids=new Set(); let skipped=0;
  for (const c of sourceCards) {
    const identifier=String(c.card_identifier??'').replace(/[•∙·—]/g,' ').replace(/\s+/g,' ').trim();
    const match=identifier.match(/^(\d+)\s*\/\s*(\d+)\s+FR\s+(\d+)$/i);
    // Promotions and alternate numbered illustrations are outside the V1.
    if (!match || +match[1]>+match[2] || /enchanted|enchant|iconic|epic/i.test(String(c.rarity))) {skipped++;continue;}
    const id=String(c.culture_invariant_id??'');
    const inks=[...new Set((c.magic_ink_colors??[]).map(x=>canonicalInk.get(String(x).toUpperCase())).filter(Boolean))];
    const variant=(c.variants??[]).find(v=>v.variant_id==='Regular');
    const image=safeImage(variant?.detail_image_url);
    if (!id || !c.name || !inks.length || !image) throw new Error(`Carte ${id||identifier} : nom, encres ou image Regular manquants.`);
    if(ids.has(id)) throw new Error(`Identifiant dupliqué : ${id}`);
    ids.add(id);
    cards.push({id,set:String(+match[3]),number:+match[1],name:String(c.name).replace(/\u00ad/g,''),
      subtitle:String(c.subtitle??'').replace(/\u00ad/g,''),inks,image,thumbnail:safeImage(c.thumbnail_url)||image,
      cost:Number.isFinite(+c.ink_cost)?+c.ink_cost:null,rarity:String(c.rarity??'')});
  }
  if(!cards.length) throw new Error('Aucune carte française standard reconnue. Vérifiez le format card_identifier du catalogue.');
  const sets=[...new Set(cards.map(c=>c.set))].sort((a,b)=>+b-+a).map(id=>({id,name:`Set ${id}`}));
  return {schemaVersion:1,source:SOURCE,updatedAt:new Date().toISOString(),sets,cards,skipped};
}
export function validateCatalog(raw) {
  if(raw.schemaVersion!==1 || !Array.isArray(raw.cards) || !Array.isArray(raw.sets)) throw new Error('Format de catalogue invalide.');
  const ids=new Set();
  const cards=raw.cards.map(c=>{
    const id=String(c.id),set=String(c.set);
    if(!/^\d+$/.test(id)|| !/^\d+$/.test(set) || !c.name || !Array.isArray(c.inks)|| !c.inks.length || c.inks.some(i=>!knownInks.has(i)) || !safeImage(c.image) || ids.has(id)) throw new Error('Carte invalide ou dupliquée dans le catalogue.');
    ids.add(id);
    return {...c,id,set,image:safeImage(c.image),thumbnail:safeImage(c.thumbnail)||safeImage(c.image)};
  });
  const setIds=[...new Set(cards.map(c=>c.set))].sort((a,b)=>+b-+a);
  return {...raw,cards,sets:setIds.map(id=>({id,name:String(raw.sets.find(s=>String(s.id)===id)?.name||`Set ${id}`)}))};
}
export const emptyTops=()=>Object.fromEntries(INKS.map(i=>[i.id,[]]));
export function cleanTops(value,set,cards) {
  const byId=new Map(cards.map(c=>[c.id,c]));
  return Object.fromEntries(INKS.map(ink=>[ink.id,[...new Set(Array.isArray(value?.[ink.id])?value[ink.id].map(String):[])]
    .filter(id=>byId.get(id)?.set===String(set)&&byId.get(id).inks.includes(ink.id)).slice(0,5)]));
}
export function addCard(tops,ink,card,set) {
  if(!knownInks.has(ink) || card.set!==String(set) || !card.inks.includes(ink)) return false;
  if(tops[ink].includes(card.id) || tops[ink].length>=5) return false;
  tops[ink].push(card.id); return true;
}
export function moveCard(tops,ink,index,delta) {
  const target=index+delta;
  if(index<0 || target<0 || index>=tops[ink].length || target>=tops[ink].length)return false;
  [tops[ink][index],tops[ink][target]]=[tops[ink][target],tops[ink][index]]; return true;
}
export function encodeShare(set,title,tops) {
  const json=JSON.stringify({v:1,s:String(set),t:String(title).slice(0,80),r:INKS.map(i=>tops[i.id])});
  const bytes=new TextEncoder().encode(json);
  return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeShare(hash) {
  if(hash.length>8000) throw new Error('Le lien de partage est trop long.');
  const code=hash.replace(/^#top=/,'').replace(/-/g,'+').replace(/_/g,'/');
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code),c=>c.charCodeAt(0))));
  if(value.v!==1 || !/^\d+$/.test(value.s) || typeof value.t!=='string' || value.t.length>80 || !Array.isArray(value.r)||value.r.length!==6 || value.r.some(row=>!Array.isArray(row)||row.length>5||row.some(id=>typeof id!=='string'||!/^\d+$/.test(id)))) throw new Error('Lien de classement invalide.');
  return {set:value.s,title:value.t,tops:Object.fromEntries(INKS.map((i,n)=>[i.id,value.r[n]]))};
}
