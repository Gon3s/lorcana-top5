import {readFile,writeFile,mkdir,cp,access} from 'node:fs/promises';
import {normalizeCatalog,validateCatalog} from '../web/core.mjs';
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
let catalog;
const source=process.argv[process.argv.indexOf('--catalog')+1];
if(process.argv.includes('--catalog')) {
  if(!source)throw new Error('--catalog requires a path');
  catalog=normalizeCatalog(JSON.parse(await readFile(source,'utf8')));
} else if(await exists('data/catalog-source.json')) {
  catalog=normalizeCatalog(JSON.parse(await readFile('data/catalog-source.json','utf8')));
} else {
  catalog=validateCatalog(JSON.parse(await readFile('web/data/catalog.json','utf8')));
}
if(process.argv.includes('--require-catalog')&&!catalog.cards.length)throw new Error('Aucun catalogue chargé. Importer un fichier officiel avant de publier.');
await mkdir('dist',{recursive:true});
await cp('web','dist',{recursive:true});
await writeFile('dist/data/catalog.json',JSON.stringify(catalog));
await writeFile('dist/.nojekyll','');
console.log(`Built dist: ${catalog.cards.length} cards, ${catalog.sets.length} sets.`);
