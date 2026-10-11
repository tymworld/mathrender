// Shared allowlist: evaluation data only; never include credentials.
  function text(value, max, allowEmpty = false) {
    if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) throw new Error('这条历史记录不完整，无法打开。');
    return value;
  }
  function copyResult(value) {
    if (!value || !['valid', 'needs_revision', 'counterexample', 'insufficient_information', 'undetermined','unreadable'].includes(value.status)) throw new Error('这条历史记录不完整，无法打开。');
    const result = {status:value.status, formula:text(value.formula, 1200, true), verdict:text(value.verdict, 200)};
    for (const dimension of ['scientific','rigor','creativity']) {
      const item = value[dimension];
      if (!item || !['A','B','C','D',null].includes(item.grade)) throw new Error('这条历史记录的等级无效。');
      result[dimension] = {grade:item.grade, comment:text(item.comment, 300)};
    }
    result.highlight = text(value.highlight, 300);
    result.suggestion = text(value.suggestion, 800);
    return result;
  }
export function validateHistoryEntry(entry) {
    const id = text(entry?.id, 100);
    if (!/^[a-zA-Z0-9-]+$/.test(id) || !Number.isFinite(Date.parse(entry.createdAt))) throw new Error('历史记录格式无效。');
    return {id, createdAt:new Date(entry.createdAt).toISOString(), result:copyResult(entry.result), model:text(entry.model ?? '',100,true),
      promptVersion:text(entry.promptVersion ?? '',100,true), promptTitle:text(entry.promptTitle ?? '',200,true)};
  }
