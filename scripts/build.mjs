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
const pkg=JSON.parse(await readFile('package.json','utf8'));
const changelog=JSON.parse(await readFile('CHANGELOG.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(pkg.version)||changelog.releases?.[0]?.version!==pkg.version)throw new Error('Version du package et changelog incohérents. Utiliser npm run release.');
if(changelog.releases.some(r=>!/^\d+\.\d+\.\d+$/.test(r.version)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Array.isArray(r.changes)||!r.changes.length||r.changes.some(c=>typeof c!=='string')))throw new Error('Entrée de changelog invalide.');
await mkdir('dist',{recursive:true});
await cp('web','dist',{recursive:true});
// Version all browser assets together so imports do not retain an older export module.
const modules=['app.mjs','core.mjs','export.mjs','theme.mjs'];
const moduleSources=await Promise.all(modules.map(name=>readFile(`web/${name}`,'utf8')));
const version=createHash('sha256').update(moduleSources.join('\n')).update(await readFile('web/style.css','utf8')).update(pkg.version).digest('hex').slice(0,12);
for(let i=0;i<modules.length;i++) {
  await writeFile(`dist/${modules[i]}`,moduleSources[i].replace(/(from\s+|import\s+)(['"])\.\/(core|export|theme)\.mjs\2/g,(_,prefix,quote,name)=>`${prefix}${quote}./${name}.mjs?v=${version}${quote}`));
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entries=changelog.releases.map((r,n)=>{
  const date=new Date(r.date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'});
  return `<section class="release" id="v${r.version}"><div class="release-heading"><h2>Version ${r.version}</h2>${n===0?'<span class="release-latest">Version actuelle</span>':''}<time datetime="${r.date}">${escape(date)}</time></div><ul>${r.changes.map(c=>`<li>${escape(c)}</li>`).join('')}</ul></section>`;
}).join('\n');
for(const page of ['index.html','changelog.html']){
  const html=await readFile(`web/${page}`,'utf8');
  await writeFile(`dist/${page}`,html.replaceAll('__APP_VERSION__',pkg.version).replace('__CHANGELOG_ENTRIES__',entries)
    .replace(/src="\.\/(app|theme)\.mjs"/g,(_,name)=>`src="./${name}.mjs?v=${version}"`).replace('href="./style.css"',`href="./style.css?v=${version}"`));
}
await writeFile('dist/data/catalog.json',JSON.stringify(catalog));
await writeFile('dist/.nojekyll','');
console.log(`Built dist: ${catalog.cards.length} cards, ${catalog.sets.length} sets.`);
