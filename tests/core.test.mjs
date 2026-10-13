import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalog,validateCatalog,emptyTops,addCard,moveCard,cleanTops,encodeShare,decodeShare} from '../web/core.mjs';
import {exportRows} from '../web/core.mjs';
// Synthetic official-shaped cards used only in tests, never in the published site.
const card=(id,number=1,set=14,inks=['Amber'])=>({culture_invariant_id:id,card_identifier:`${number}/204 • FR • ${set}`,name:`Carte test ${id}`,subtitle:'Épreuve',magic_ink_colors:inks,ink_cost:3,rarity:'Common',thumbnail_url:`https://example.test/${id}-thumb.jpg`,variants:[{variant_id:'Regular',detail_image_url:`https://example.test/${id}.jpg`},{variant_id:'Foiled',detail_image_url:`https://example.test/${id}-foil.jpg`}]});
const raw=(...cards)=>({cards:{characters:cards,actions:[]}});
test('a single-ink export selects only the requested row and rejects unknown scopes',()=>{
  assert.equal(exportRows().length,6);assert.deepEqual(exportRows('Ruby').map(i=>i.id),['Ruby']);assert.throws(()=>exportRows('Unknown'),/inconnue/);
});
test('imports French identifier, standard art and multiple sets',()=>{
  const catalog=normalizeCatalog(raw(card(10,2),card(11,1,15)));
  assert.equal(catalog.cards[0].set,'14');assert.equal(catalog.cards[0].number,2);
  assert.equal(catalog.cards[0].image,'https://example.test/10.jpg');assert.deepEqual(catalog.sets.map(s=>s.id),['15','14']);
});
test('accepts the uppercase ink values used in the live Ravensburger catalogue',()=>{
  const catalog=normalizeCatalog(raw(card(3292,27,14,['AMBER']),card(3293,28,14,['AMBER','AMETHYST'])));
  assert.deepEqual(catalog.cards[0].inks,['Amber']);assert.deepEqual(catalog.cards[1].inks,['Amber','Amethyst']);
});
test('excludes foreign cards, alternate numbering and promo identifiers',()=>{
  const catalog=normalizeCatalog(raw(card(1),card(2,205),{...card(3),card_identifier:'1/204 EN 14'},{...card(4),card_identifier:'1/P1 FR 14'},{...card(5),rarity:'Enchanted'}));
  assert.equal(catalog.cards.length,1);assert.equal(catalog.skipped,4);
});
test('rejects ambiguous catalogues instead of silently producing an empty grid',()=>{
  assert.throws(()=>normalizeCatalog(raw({...card(1),magic_ink_colors:[]})),/manquants/);
  assert.throws(()=>normalizeCatalog(raw(card(1),card(1))),/dupliqué/);
  assert.throws(()=>normalizeCatalog(raw()),/Aucune carte/);
});
test('bicolour is independently selectable in both inks',()=>{
  const c=normalizeCatalog(raw(card(1,1,14,['Amber','Amethyst']))).cards[0],tops=emptyTops();
  assert.equal(addCard(tops,'Amber',c,'14'),true);assert.equal(addCard(tops,'Amethyst',c,'14'),true);
  assert.deepEqual(tops.Amber,['1']);assert.deepEqual(tops.Amethyst,['1']);assert.equal(addCard(tops,'Ruby',c,'14'),false);
});
test('enforces five unique picks and prevents cards from another set',()=>{
  const cards=normalizeCatalog(raw(...Array.from({length:6},(_,i)=>card(i+1)),card(7,1,15))).cards,tops=emptyTops();
  cards.slice(0,5).forEach(c=>assert.equal(addCard(tops,'Amber',c,'14'),true));
  assert.equal(addCard(tops,'Amber',cards[0],'14'),false);assert.equal(addCard(tops,'Amber',cards[5],'14'),false);assert.equal(addCard(tops,'Amber',cards[6],'14'),false);
  assert.equal(tops.Amber.length,5);
});
test('reordering preserves card IDs and respects boundaries',()=>{
  const tops=emptyTops();tops.Amber=['1','2','3'];assert.equal(moveCard(tops,'Amber',0,-1),false);assert.equal(moveCard(tops,'Amber',1,-1),true);assert.deepEqual(tops.Amber,['2','1','3']);assert.equal(moveCard(tops,'Amber',2,1),false);
});
test('restoration removes invalid ink/set references without mutating other sets',()=>{
  const cards=normalizeCatalog(raw(card(1),card(2,2,14,['Ruby']),card(3,1,15))).cards;
  const tops=emptyTops();tops.Amber=['1','1','2','3','99'];const cleaned=cleanTops(tops,'14',cards);
  assert.deepEqual(cleaned.Amber,['1']);assert.deepEqual(tops.Amber,['1','1','2','3','99']);
});
test('URL round-trip retains unicode, set, ranks and all six ink lists',()=>{
  const tops=emptyTops();tops.Amber=['12','23'];tops.Amethyst=['12'];const title='Émeraude & cœur ✨';
  const token=encodeShare('14',title,tops);assert.match(token,/^[A-Za-z0-9_-]+$/);assert.deepEqual(decodeShare('#top='+token),{set:'14',title,tops});
});
test('rejects malformed, oversized and unsupported share links',()=>{
  assert.throws(()=>decodeShare('#top=bad'));assert.throws(()=>decodeShare('a'.repeat(8001)));
  const token=btoa(JSON.stringify({v:2,s:'14',t:'',r:[]}));assert.throws(()=>decodeShare(token),/invalide/);
});
test('rejects executable URLs, duplicate IDs and unknown inks in normalized imports',()=>{
  const catalog=normalizeCatalog(raw(card(1)));
  assert.throws(()=>validateCatalog({...catalog,cards:[{...catalog.cards[0],image:'javascript:alert(1)'}]}));
  assert.throws(()=>validateCatalog({...catalog,cards:[...catalog.cards,...catalog.cards]}));
  assert.throws(()=>validateCatalog({...catalog,cards:[{...catalog.cards[0],inks:['Unknown']}]}));
});
