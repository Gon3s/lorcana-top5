import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const project=resolve('.'),script=resolve('scripts/build.mjs');
async function tempSite(fn){await mkdir('.cache',{recursive:true});const dir=await mkdtemp(resolve('.cache/build-test-'));try{await cp(resolve('web'),resolve(dir,'web'),{recursive:true});await cp(resolve('package.json'),resolve(dir,'package.json'));await cp(resolve('CHANGELOG.json'),resolve(dir,'CHANGELOG.json'));await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('production build refuses an empty catalogue and preserves the previous output',async()=>tempSite(async dir=>{
  await mkdir(resolve(dir,'dist'));await writeFile(resolve(dir,'dist/index.html'),'previous site');
  const result=spawnSync(process.execPath,[script,'--require-catalog'],{cwd:dir,encoding:'utf8'});
  assert.notEqual(result.status,0);assert.equal(await readFile(resolve(dir,'dist/index.html'),'utf8'),'previous site');
}));
test('build imports official cards, produces relative assets and excludes fixtures and scripts',async()=>tempSite(async dir=>{
  const source={cards:{characters:[{culture_invariant_id:100,card_identifier:'2/204 FR 14',name:'Test',subtitle:'Épreuve',magic_ink_colors:['Amber','Amethyst'],ink_cost:4,rarity:'Common',variants:[{variant_id:'Regular',detail_image_url:'https://example.test/card.jpg'}]}]}};
  await writeFile(resolve(dir,'source.json'),JSON.stringify(source));
  const result=spawnSync(process.execPath,[script,'--catalog','source.json','--require-catalog'],{cwd:dir,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const data=JSON.parse(await readFile(resolve(dir,'dist/data/catalog.json'),'utf8'));
  assert.equal(data.cards.length,1);assert.deepEqual(data.cards[0].inks,['Amber','Amethyst']);assert.equal(data.cards[0].set,'14');
  const files=await readdir(resolve(dir,'dist'));assert.ok(files.includes('.nojekyll'));assert.ok(!files.includes('tests'));assert.ok(!files.includes('scripts'));
  const html=await readFile(resolve(dir,'dist/index.html'),'utf8');assert.match(html,/src="\.\/app\.mjs\?v=[a-f0-9]{12}"/);assert.match(html,/href="\.\/style\.css\?v=[a-f0-9]{12}"/);
  const app=await readFile(resolve(dir,'dist/app.mjs'),'utf8');assert.match(app,/from '\.\/export\.mjs\?v=[a-f0-9]{12}'/);
  const pkg=JSON.parse(await readFile(resolve(dir,'package.json'),'utf8'));
  assert.ok(html.includes('v'+pkg.version));assert.ok(!html.includes('__APP_VERSION__'));
  const changes=await readFile(resolve(dir,'dist/changelog.html'),'utf8');assert.ok(changes.includes('Version '+pkg.version));assert.ok(!changes.includes('__CHANGELOG_ENTRIES__'));
}));
test('a mismatched release cannot replace the previously built site',async()=>tempSite(async dir=>{
  const pkg=JSON.parse(await readFile(resolve(dir,'package.json'),'utf8'));pkg.version='99.0.0';await writeFile(resolve(dir,'package.json'),JSON.stringify(pkg));
  await mkdir(resolve(dir,'dist'));await writeFile(resolve(dir,'dist/index.html'),'previous release');
  const result=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/incohérents/);assert.equal(await readFile(resolve(dir,'dist/index.html'),'utf8'),'previous release');
}));
