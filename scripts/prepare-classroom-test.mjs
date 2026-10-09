// Independent local bindings and an artificial AI key; never points at production.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const directory = '.wrangler/private/unified-test';
await mkdir(directory,{recursive:true});
await writeFile(path.join(directory,'wrangler.jsonc'),JSON.stringify({
  name:'mathrender-unified-test', main:path.resolve('cloudflare/worker.mjs'), compatibility_date:'2026-10-01',
  assets:{directory:path.resolve('dist'),binding:'ASSETS',run_worker_first:['/api/classroom/*']},
  r2_buckets:[{binding:'CLASSROOM_PHOTOS',bucket_name:'classroom-local-test'}],
  d1_databases:[{binding:'CLASSROOM_DB',database_name:'classroom-local-test',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:path.resolve('cloudflare/migrations')}],
  vars:{CLASSROOM_SECRET:'local-fixture-signing-secret-at-least-32-characters',
    CLASSROOM_UNIFIED_PROOF:createHash('sha256').update('mathrender-classroom-initialize-v1:sk-unified-browser-fixture').digest('hex')}
},null,2));
console.log('已准备独立的本地课堂测试环境。');
