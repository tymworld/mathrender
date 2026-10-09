/* Shared by the phone and the bundled review page. No account or AI key is sent. */
(() => {
  'use strict';
  const base = '/api/classroom';
  let token = '';
  async function request(route, {method = 'GET', body, timeout = 15000, binary = false} = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(base + route, {method, cache:'no-store', credentials:'omit', redirect:'error',
        headers:{...(token ? {Authorization:'Bearer ' + token} : {}), ...(body ? {'Content-Type':'application/json'} : {})},
        body:body ? JSON.stringify(body) : undefined, signal:controller.signal});
      if (!response.ok) {
        let message = '课堂相册暂时无法连接，请确认电脑上的服务正在运行。';
        try { message = (await response.json()).error || message; } catch {}
        const error = new Error(message); error.status = response.status; throw error;
      }
      return binary ? await response.blob() : await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('连接超时，请检查网络后重试。');
      if (error instanceof TypeError) throw new Error('连接中断，请检查网络后重试。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  const uuid = () => {
    const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const s = Array.from(bytes, byte => byte.toString(16).padStart(2,'0')).join('');
    return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
  };
  function make(tag, className, text) {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const dateLabel = value => new Date(value).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
  window.ClassroomPhotos = Object.freeze({request, uuid, make, dateLabel,
    setToken(value) { token = value; },
    async photo(id, thumbnail = false) { return request('/photos/' + encodeURIComponent(id) + (thumbnail ? '/thumbnail' : '/image'), {binary:true, timeout:30000}); }
  });
})();
