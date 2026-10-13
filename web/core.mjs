export const INKS = [
  {id:'Amber', name:'Ambre', color:'#edbd53'},
  {id:'Amethyst', name:'Améthyste', color:'#b395ed'},
  {id:'Emerald', name:'Émeraude', color:'#64cb9d'},
  {id:'Ruby', name:'Rubis', color:'#f27c89'},
  {id:'Sapphire', name:'Saphir', color:'#6db8ed'},
  {id:'Steel', name:'Acier', color:'#b5c3d3'}
];
export const SOURCE = 'https://api.lorcana.ravensburger.com/v3/catalog/fr';
// French expansion names from the official Disney Lorcana product pages.
export const SET_NAMES = {
  1:'Premier Chapitre',2:'L’Ascension des Floodborn',3:'Les Terres d’Encres',
  4:'Le Retour d’Ursula',5:'Ciel Scintillant',6:'La Mer Azurite',7:'L’Île d’Archazia',
  8:'Le Règne de Jafar',9:'Fabuleux',10:'Lueurs dans les Profondeurs',11:'Givresort',
  12:'Contrées Inconnues',13:'Invasion Épineuse !',14:'Hyperia City'
};
export const TYPES = {Character:'Personnage',Action:'Action',Item:'Objet',Location:'Lieu'};
export const RARITIES = {Common:'Commune',Uncommon:'Peu commune',Rare:'Rare',SuperRare:'Super rare',Legendary:'Légendaire'};
const key = value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[\s_-]/g,'');
const canonicalType = value=>Object.keys(TYPES).find(t=>key(t)===key(value)||key(t)+'s'===key(value)||key(TYPES[t])===key(value))||'';
const canonicalRarity = value=>Object.keys(RARITIES).find(r=>key(r)===key(value)||key(RARITIES[r])===key(value))||String(value??'');
export function setName(id,sets=[]) {
  const name=sets.find(s=>String(s.id)===String(id))?.name;
  return name&&!/^Set \d+$/.test(name)?String(name):SET_NAMES[id]||`Extension ${id}`;
}
export function exportRows(scope='all') {
  if(scope==='all')return INKS;
  const ink=INKS.find(i=>i.id===scope);if(!ink)throw new Error('Couleur d’export inconnue.');return [ink];
}
const knownInks = new Set(INKS.map(x=>x.id));
const canonicalInk = new Map(INKS.map(x=>[x.id.toUpperCase(),x.id]));
export function safeImage(value) {
  try { const u=new URL(value); return u.protocol==='https:' ? u.href : ''; } catch { return ''; }
}
export function normalizeCatalog(raw) {
  if (!raw || typeof raw!=='object' || !raw.cards) throw new Error('Le fichier ne contient pas de catalogue de cartes.');
  if (raw.schemaVersion===1 && Array.isArray(raw.cards)) return validateCatalog(raw);
  const sourceCards=Array.isArray(raw.cards) ? raw.cards : Object.entries(raw.cards).flatMap(([type,list])=>list.map(c=>({...c,category:type})));
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
      cost:c.ink_cost!=null&&Number.isFinite(+c.ink_cost)?+c.ink_cost:null,
      rarity:canonicalRarity(c.rarity),type:canonicalType(c.category||c.type||c.card_type)});
  }
  if(!cards.length) throw new Error('Aucune carte française standard reconnue. Vérifiez le format card_identifier du catalogue.');
  const sets=[...new Set(cards.map(c=>c.set))].sort((a,b)=>+b-+a).map(id=>({id,name:setName(id,Array.isArray(raw.sets)?raw.sets:[])}));
  return {schemaVersion:1,source:SOURCE,updatedAt:new Date().toISOString(),sets,cards,skipped};
}
export function validateCatalog(raw) {
  if(raw.schemaVersion!==1 || !Array.isArray(raw.cards) || !Array.isArray(raw.sets)) throw new Error('Format de catalogue invalide.');
  const ids=new Set();
  const cards=raw.cards.map(c=>{
    const id=String(c.id),set=String(c.set);
    if(!/^\d+$/.test(id)|| !/^\d+$/.test(set) || !c.name || !Array.isArray(c.inks)|| !c.inks.length || c.inks.some(i=>!knownInks.has(i)) || !safeImage(c.image) || ids.has(id)) throw new Error('Carte invalide ou dupliquée dans le catalogue.');
    ids.add(id);
    return {...c,id,set,image:safeImage(c.image),thumbnail:safeImage(c.thumbnail)||safeImage(c.image),type:canonicalType(c.type),rarity:canonicalRarity(c.rarity)};
  });
  const setIds=[...new Set(cards.map(c=>c.set))].sort((a,b)=>+b-+a);
  return {...raw,cards,sets:setIds.map(id=>({id,name:setName(id,raw.sets)}))};
}
export function filterCards(cards,{set,ink,query='',cost='',rarity='',type=''}={}) {
  const search=String(query).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
  return cards.filter(c=>(!set||c.set===String(set))&&(!ink||c.inks.includes(ink))
    &&(!cost||(c.cost!==null&&c.cost!==undefined&&(cost==='10+'?c.cost>=10:c.cost===Number(cost))))
    &&(!rarity||c.rarity===rarity)&&(!type||c.type===type)
    &&`${c.name} ${c.subtitle} ${c.number}`.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes(search))
    .sort((a,b)=>a.number-b.number);
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
export function moveCardTo(tops,ink,index,target) {
  const row=tops[ink];
  if(!row||!Number.isInteger(index)||!Number.isInteger(target)||index<0||target<0||index>=row.length||target>=row.length||index===target)return false;
  row.splice(target,0,row.splice(index,1)[0]);return true;
}
export function resetTop(tops,ink) {
  if(!knownInks.has(ink)||!tops[ink].length)return null;
  const previous=[...tops[ink]];tops[ink]=[];return previous;
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
