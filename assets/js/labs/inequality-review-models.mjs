// Curated stable IDs, verified against official Beijing availability on 2026-10-02.
// All support image input, JSON Object output and enable_thinking: false.
// https://help.aliyun.com/zh/model-studio/vision-model
// https://help.aliyun.com/zh/model-studio/visual-reasoning
// https://help.aliyun.com/zh/model-studio/model-pricing
// Excludes text-only, OCR-only, thinking-only, preview and dated snapshot models.
export const QWEN_MODELS_CHECKED_ON = '2026-10-02';
export const DEFAULT_QWEN_MODEL = 'qwen3.5-plus';
export const QWEN_VISION_MODELS = Object.freeze([
  { id: 'qwen3.8-max', group: 'Qwen 3.8 / 3.7', description: '旗舰视觉模型，适合复杂作品；调用费用较高。' },
  { id: 'qwen3.8-flash', group: 'Qwen 3.8 / 3.7', description: '轻量视觉模型，适合兼顾图片理解与使用成本。' },
  { id: 'qwen3.7-plus', group: 'Qwen 3.8 / 3.7', description: '通用视觉模型，兼顾能力与使用成本。' },
  { id: 'qwen3.7-flash', group: 'Qwen 3.8 / 3.7', description: '轻量视觉模型，适合批量作品评价。' },
  { id: 'qwen3.6-plus', group: 'Qwen 3.6 / 3.5', description: 'Qwen 3.6 通用视觉模型，支持图片理解与评价。' },
  { id: 'qwen3.6-flash', group: 'Qwen 3.6 / 3.5', description: 'Qwen 3.6 Flash 视觉模型，支持图片理解与评价。' },
  { id: 'qwen3.5-plus', group: 'Qwen 3.6 / 3.5', description: '本页原有默认模型，支持手写图片理解与评价。' },
  { id: 'qwen3.5-flash', group: 'Qwen 3.6 / 3.5', description: 'Qwen 3.5 轻量视觉模型，可用于作品评价。' },
  { id: 'qwen3-vl-plus', group: 'Qwen 3-VL', description: '专用视觉理解系列，支持图像分析与文字识别。' },
  { id: 'qwen3-vl-flash', group: 'Qwen 3-VL', description: '专用视觉理解系列的轻量模型。' }
]);
