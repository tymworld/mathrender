import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadConfig, completionURL, ROOT} from '../server/inequality-review.mjs';
import {encryptKeyFile, KEY_FILE_NAME} from '../assets/js/labs/inequality-review-keyfile.mjs';
import {buildStandalone} from './build-inequality-standalone.mjs';

// Read directly from the terminal without echo or command-line secret arguments.
function readSecret(label) {
  if (!process.stdin.isTTY) throw new Error('请在终端中运行此脚本，以便安全输入密码。');
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let text = '';
    const finish = () => {
      process.stdin.off('data', input);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const input = chunk => {
      for (const char of chunk) {
        if (char === '\u0003' || char === '\u0004') { finish(); reject(new Error('已取消，文件未修改。')); return; }
        if (char === '\r' || char === '\n') { finish(); resolve(text); return; }
        if (char === '\u007f' || char === '\b') text = [...text].slice(0, -1).join('');
        else if (char >= ' ' && text.length < 1024) text += char;
      }
    };
    process.stdin.on('data', input);
  });
}

try {
  const config = await loadConfig();
  const endpoint = completionURL(config.baseURL);
  const apiKey = config.apiKey || (await readSecret('请输入百炼 API Key（输入不显示）：')).trim();
  const password = await readSecret('请设置网站解锁密码，至少 8 个字符（输入不显示）：');
  const confirmation = await readSecret('请再次输入密码：');
  if (password !== confirmation) throw new Error('两次密码不一致，文件未修改。');
  const encrypted = await encryptKeyFile(apiKey, endpoint, password);
  const target = path.join(ROOT, 'labs/algebra', KEY_FILE_NAME);
  await writeFile(target, JSON.stringify(encrypted, null, 2) + '\n', {mode: 0o600});
  console.log(`已保存加密密钥文件：${target}`);
  await buildStandalone();
  console.log('已同步更新 HTML 内的加密配置，直接双击即可用密码解锁。密码和明文密钥未写入文件。');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
