export function validPhotoKey(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value) ? value : '';
}
export async function photoFingerprint(photo) {
  if (!(photo instanceof Blob)) return '';
  const bytes = await crypto.subtle.digest('SHA-256', await photo.arrayBuffer());
  return 'sha256:' + Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}
export function groupHistoryEntries(entries) {
  const groups = new Map();
  const ordered = [...entries].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
  for (const entry of ordered) {
    const key = validPhotoKey(entry.photoKey) || 'record:' + entry.id;
    if (!groups.has(key)) groups.set(key, {key, entries:[]});
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()];
}
