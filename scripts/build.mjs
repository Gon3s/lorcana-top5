import {readFile,writeFile,mkdir,cp,access} from 'node:fs/promises';
import {normalizeCatalog,validateCatalog} from '../web/core.mjs';
import {createHash} from 'node:crypto';
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
// Version all browser assets together so imports do not retain an older export module.
const modules=['app.mjs','core.mjs','export.mjs'];
const moduleSources=await Promise.all(modules.map(name=>readFile(`web/${name}`,'utf8')));
const version=createHash('sha256').update(moduleSources.join('\n')).update(await readFile('web/style.css','utf8')).digest('hex').slice(0,12);
for(let i=0;i<modules.length;i++) {
  await writeFile(`dist/${modules[i]}`,moduleSources[i].replace(/from\s+(['"])\.\/(core|export)\.mjs\1/g,(_,quote,name)=>`from ${quote}./${name}.mjs?v=${version}${quote}`));
}
const html=await readFile('web/index.html','utf8');
await writeFile('dist/index.html',html.replace('src="./app.mjs"',`src="./app.mjs?v=${version}"`).replace('href="./style.css"',`href="./style.css?v=${version}"`));
await writeFile('dist/data/catalog.json',JSON.stringify(catalog));
await writeFile('dist/.nojekyll','');
console.log(`Built dist: ${catalog.cards.length} cards, ${catalog.sets.length} sets.`);
