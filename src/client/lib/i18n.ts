/** UI strings (content strings live with the data as I18n objects). */
import type { EventKind, Lang } from '../../shared/data/types.ts';
import { load, save } from './storage.ts';

const S = {
  brand: { zh: '长河', en: 'Ages' },
  brandSub: { zh: '3D 中国历史地图', en: '3D Atlas of Chinese History' },
  search: { zh: '搜索事件、朝代、地点…', en: 'Search events, dynasties, places…' },
  noHits: { zh: '没有找到', en: 'No matches' },
  lang: { zh: 'EN', en: '中' },
  langTitle: { zh: 'Switch to English', en: '切换到中文' },
  learn: { zh: '课本', en: 'Textbook' },
  learnTitle: { zh: '按课本单元学习', en: 'Learn by textbook unit' },
  quiz: { zh: '测验', en: 'Quiz' },
  layers: { zh: '图层', en: 'Layers' },
  help: { zh: '帮助', en: 'Help' },
  home: { zh: '回到全图', en: 'Reset view' },
  territory: { zh: '疆域', en: 'Territories' },
  places: { zh: '地名', en: 'Places' },
  events: { zh: '事件', en: 'Events' },
  models: { zh: '3D 模型', en: '3D models' },
  narrate: { zh: '语音解说', en: 'Narration' },
  play: { zh: '播放时间轴', en: 'Play timeline' },
  pause: { zh: '暂停', en: 'Pause' },
  playStory: { zh: '动画演示', en: 'Play animation' },
  replay: { zh: '重播', en: 'Replay' },
  read: { zh: '维基百科', en: 'Wikipedia' },
  readTitle: { zh: '延伸阅读', en: 'Background reading' },
  learned: { zh: '已掌握', en: 'Learned' },
  markLearned: { zh: '标记为已掌握', en: 'Mark as learned' },
  keyPoints: { zh: '考点', en: 'Key points' },
  people: { zh: '人物', en: 'People' },
  textbook: { zh: '课本', en: 'Textbook' },
  close: { zh: '关闭', en: 'Close' },
  prev: { zh: '上一个事件', en: 'Previous event' },
  next: { zh: '下一个事件', en: 'Next event' },
  skip: { zh: '下一步', en: 'Next step' },
  stop: { zh: '停止', en: 'Stop' },
  speed: { zh: '速度', en: 'Speed' },
  era: { zh: '时期', en: 'Period' },
  ruler: { zh: '在位', en: 'Ruler' },
  map: { zh: '疆域图', en: 'Map' },
  watched: { zh: '已观看', en: 'watched' },
  progress: { zh: '进度', en: 'Progress' },
  scripted: { zh: '精编动画', en: 'Scripted animation' },
  // reader
  contents: { zh: '目录', en: 'Contents' },
  loading: { zh: '正在加载…', en: 'Loading…' },
  offline: { zh: '无法连接维基百科。请检查网络后重试。', en: 'Could not reach Wikipedia. Check your connection and try again.' },
  retry: { zh: '重试', en: 'Retry' },
  missing: { zh: '维基百科上暂无该语言的条目。', en: 'No article in this language yet.' },
  openWiki: { zh: '在维基百科打开', en: 'Open on Wikipedia' },
  minutes: { zh: '分钟阅读', en: 'min read' },
  readMore: { zh: '继续阅读', en: 'Continue reading' },
  license: { zh: '文字来自维基百科，依 CC BY-SA 4.0 授权。', en: 'Text from Wikipedia, licensed CC BY-SA 4.0.' },
  wikiNote: { zh: '维基百科内容由志愿者编写，可能与课本表述不同，请以课本为准。', en: 'Wikipedia is written by volunteers and may differ from the textbook; the textbook is authoritative for exams.' },
  // quiz
  quizTitle: { zh: '历史小测验', en: 'History quiz' },
  quizBook: { zh: '范围', en: 'Scope' },
  allBooks: { zh: '全部', en: 'All' },
  start: { zh: '开始', en: 'Start' },
  clickMap: { zh: '在地图上点击你的答案', en: 'Click your answer on the map' },
  correct: { zh: '正确！', en: 'Correct!' },
  close_: { zh: '很接近！', en: 'Close!' },
  wrong: { zh: '不对哦', en: 'Not quite' },
  kmAway: { zh: '相距 {n} 公里', en: '{n} km away' },
  answerWas: { zh: '正确答案：{a}', en: 'Answer: {a}' },
  check: { zh: '确定', en: 'Check' },
  nextQ: { zh: '下一题', en: 'Next' },
  done: { zh: '完成！得分 {s}/{n}', en: 'Done! Score {s}/{n}' },
  best: { zh: '最高分 {n}', en: 'Best {n}' },
  again: { zh: '再来一次', en: 'Try again' },
  orderHint: { zh: '点击事件按从早到晚的顺序排列', en: 'Tap the events from earliest to latest' },
  undo: { zh: '撤销', en: 'Undo' },
  // help
  helpTitle: { zh: '使用说明', en: 'How to use' },
  helpControls: { zh: '拖动平移 · 右键/双指旋转倾斜 · 滚轮/捏合缩放 · 点击地图上的事件查看详情', en: 'Drag to pan · right-drag / two fingers to rotate and tilt · scroll / pinch to zoom · click an event pin for details' },
  helpTimeline: { zh: '拖动底部时间轴穿越历史；疆域、地名和都城会随年代变化。', en: 'Drag the timeline to travel through history; borders, place names and capitals change with the year.' },
  helpStory: { zh: '在事件卡片中点击「动画演示」观看 3D 动画讲解。', en: 'Press “Play animation” on an event card to watch a 3D animated explanation.' },
  helpKeys: { zh: '快捷键：空格 播放/暂停 · ← → 上一个/下一个事件 · / 搜索 · Esc 关闭', en: 'Keys: Space play/pause · ← → previous/next event · / search · Esc close' },
  disclaimer: { zh: '历史疆域为示意图，依据中学历史课本地图简化绘制，不作为划界依据。', en: 'Historical borders are schematic, simplified from school-textbook maps, and are not authoritative boundaries.' },
  credits: { zh: '地形：AWS Terrain Tiles（SRTM、GMTED、ETOPO1）。背景阅读：维基百科（CC BY-SA）。', en: 'Terrain: AWS Terrain Tiles (SRTM, GMTED, ETOPO1). Background reading: Wikipedia (CC BY-SA).' },
  phase2: { zh: '即将推出：世界历史。', en: 'Coming next: world history.' },
  webgl: { zh: '你的浏览器不支持 WebGL，无法显示 3D 地图。', en: 'Your browser does not support WebGL, so the 3D map cannot be shown.' },
  loadingMap: { zh: '正在加载长河…', en: 'Loading the map…' },
} satisfies Record<string, Record<Lang, string>>;

export type Key = keyof typeof S;

const KIND: Record<EventKind, Record<Lang, string>> = {
  prehistory: { zh: '史前', en: 'Prehistory' }, politics: { zh: '政治', en: 'Politics' }, war: { zh: '战争', en: 'War' },
  reform: { zh: '改革', en: 'Reform' }, culture: { zh: '文化', en: 'Culture' }, science: { zh: '科技', en: 'Science' },
  economy: { zh: '经济', en: 'Economy' }, diplomacy: { zh: '外交', en: 'Diplomacy' }, revolution: { zh: '革命', en: 'Revolution' },
};

const browser = (): Lang => (typeof navigator !== 'undefined' && /^zh/i.test(navigator.language) ? 'zh' : navigator.language ? 'en' : 'zh');
export let lang: Lang = load<Lang | null>('lang', null) ?? browser();

const listeners = new Set<(l: Lang) => void>();
export function setLang(l: Lang): void {
  lang = l;
  save('lang', l);
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  for (const f of listeners) f(l);
}
export const onLang = (f: (l: Lang) => void) => listeners.add(f);

export function t(k: Key, vars: Record<string, string | number> = {}): string {
  let s = S[k][lang];
  for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, String(b));
  return s;
}
export const kindName = (k: EventKind): string => KIND[k][lang];
export const dict = S;
