import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=resolve('scripts/release.mjs');
test('release increments the requested level and retains earlier history',async()=>{
  await mkdir('.cache',{recursive:true});const dir=await mkdtemp(resolve('.cache/release-test-'));
  try{
    await writeFile(resolve(dir,'package.json'),JSON.stringify({version:'1.2.3'}));
    await writeFile(resolve(dir,'CHANGELOG.json'),JSON.stringify({releases:[{version:'1.2.3',date:'2026-10-01',changes:['Ancienne version']}]}));
    const result=spawnSync(process.execPath,[script,'minor','Aperçu des cartes'],{cwd:dir,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
    const pkg=JSON.parse(await readFile(resolve(dir,'package.json'),'utf8'));const log=JSON.parse(await readFile(resolve(dir,'CHANGELOG.json'),'utf8'));
    assert.equal(pkg.version,'1.3.0');assert.equal(log.releases[0].version,pkg.version);assert.deepEqual(log.releases[0].changes,['Aperçu des cartes']);assert.equal(log.releases[1].version,'1.2.3');
    const refused=spawnSync(process.execPath,[script,'patch'],{cwd:dir,encoding:'utf8'});assert.notEqual(refused.status,0);assert.equal(JSON.parse(await readFile(resolve(dir,'package.json'),'utf8')).version,'1.3.0');
  }finally{await rm(dir,{recursive:true,force:true});}
});
