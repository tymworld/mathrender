import test from 'node:test';
import assert from 'node:assert/strict';
import {groupHistoryEntries,photoFingerprint,validPhotoKey} from '../assets/js/labs/inequality-history-groups.mjs';
test('grouping uses photo bytes or stable photo identity, keeps all versions, and orders recent first',async()=>{
  const first=await photoFingerprint(new Blob(['photo one'])),second=await photoFingerprint(new Blob(['photo two']));
  assert.equal(first,await photoFingerprint(new Blob(['photo one'])));assert.notEqual(first,second);
  const entries=[{id:'1',createdAt:'2026-10-10T01:00:00Z',photoKey:first},{id:'2',createdAt:'2026-10-11T01:00:00Z',photoKey:second},{id:'3',createdAt:'2026-10-11T02:00:00Z',photoKey:first},{id:'4',createdAt:'2026-10-09T01:00:00Z'},{id:'5',createdAt:'2026-10-09T01:00:00Z'}];
  assert.deepEqual(groupHistoryEntries(entries).map(group=>group.entries.map(entry=>entry.id)),[['3','1'],['2'],['5'],['4']]);
  assert.equal(validPhotoKey('same-formula'),'');assert.equal(await photoFingerprint(null),'');
});
