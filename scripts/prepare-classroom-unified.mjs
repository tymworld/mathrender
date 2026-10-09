// Run on the original deployment computer. Never print the API key or proof.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadConfig} from '../server/inequality-review.mjs';

const {apiKey} = await loadConfig();
if (!apiKey || !/^[\x21-\x7E]{1,1024}$/.test(apiKey)) throw new Error('请先在本机 .env.qwen 中配置与现有加密文件一致的 API Key。');
const proof = createHash('sha256').update('mathrender-classroom-initialize-v1:'+apiKey).digest('hex');
await mkdir('.wrangler/private',{recursive:true});
await writeFile('.wrangler/private/classroom-unified-secrets.json',JSON.stringify({CLASSROOM_UNIFIED_PROOF:proof}),{mode:0o600});
console.log('统一密码的一次性迁移验证信息已保存到受忽略的私有目录。');
