/** 七年级上册 — prehistory to the Northern & Southern Dynasties. */
import type { Lesson } from '../types.ts';

export const G7A: Lesson[] = [
  {
    id: 'g7a-1', book: 'g7a', unit: 1, minutes: 12,
    title: { zh: '史前时期：远古人类与文明起源', en: 'Prehistory: early humans and the dawn of civilisation' },
    blurb: { zh: '从元谋人、北京人到河姆渡、半坡的农耕村落，再到良渚古城与炎黄、尧舜禹的传说。', en: 'From Yuanmou and Peking Man to the farming villages of Hemudu and Banpo, the city of Liangzhu and the legends of the first rulers.' },
    steps: [
      {
        year: -1_700_000, at: [110, 32, 60],
        title: { zh: '远古的人类', en: 'The first people' },
        body: { zh: '我国境内发现了大量远古人类遗址，分布在大江南北。远古人类在这片土地上学会制造工具、使用火，后来又开始种植农作物、定居生活。', en: 'Sites of early humans have been found all over China, north and south. Here people learned to make tools and use fire, and later to grow crops and settle down.' },
      },
      { ev: 'yuanmou' },
      {
        ev: 'peking_man',
        body: { zh: '北京人保留了猿的某些特征，但能直立行走。他们使用打制石器，会使用天然火，过着群居生活。约3万年前的山顶洞人已掌握磨光和钻孔技术，会用骨针缝制衣服。', en: 'Peking Man still had some ape-like features but walked upright. They used chipped stone tools and natural fire and lived in groups. About 30,000 years ago Upper Cave Man could grind and drill stone and sewed with bone needles.' },
      },
      { ev: 'hemudu' },
      { ev: 'banpo' },
      { ev: 'liangzhu' },
      { ev: 'huangdi' },
      { ev: 'shanrang' },
    ],
    checks: [
      {
        q: { zh: '我国境内目前已确认的最早的古人类是？', en: 'Who is the earliest confirmed early human found in China?' },
        options: [{ zh: '北京人', en: 'Peking Man' }, { zh: '山顶洞人', en: 'Upper Cave Man' }, { zh: '元谋人', en: 'Yuanmou Man' }, { zh: '半坡居民', en: 'The Banpo villagers' }],
        answer: 2, ev: 'yuanmou',
        why: { zh: '元谋人距今约170万年，是我国境内目前已确认的最早的古人类；北京人距今约70万—20万年，山顶洞人距今约3万年。', en: 'Yuanmou Man lived about 1.7 million years ago; Peking Man lived 700,000–200,000 years ago and Upper Cave Man about 30,000 years ago.' },
      },
      {
        q: { zh: '长江流域的河姆渡居民过着怎样的生活？', en: 'How did the Hemudu people of the Yangtze basin live?' },
        options: [{ zh: '种植水稻，住干栏式房屋', en: 'They grew rice and lived in stilt houses' }, { zh: '种植粟，住半地穴式房屋', en: 'They grew millet and lived in semi-subterranean houses' }, { zh: '种植小麦，住半地穴式房屋', en: 'They grew wheat and lived in semi-subterranean houses' }, { zh: '种植粟，住干栏式房屋', en: 'They grew millet and lived in stilt houses' }],
        answer: 0, ev: 'hemudu',
        why: { zh: '河姆渡位于湿润的长江流域，居民种植水稻、住干栏式房屋；种粟、住半地穴式房屋的是黄河流域的半坡居民。', en: 'In the wet Yangtze basin Hemudu people grew rice and built stilt houses; millet and semi-subterranean houses belong to Banpo on the Yellow River.' },
      },
      { order: ['yuanmou', 'peking_man', 'hemudu', 'banpo', 'liangzhu'] },
      { where: 'peking_man', tol: 400 },
    ],
    keys: [
      { zh: '元谋人是我国境内目前已确认的最早的古人类；北京人会制造和使用打制石器，会使用天然火。', en: 'Yuanmou Man is the earliest confirmed early human in China; Peking Man made chipped stone tools and used natural fire.' },
      { zh: '河姆渡（长江流域，种水稻，住干栏式房屋）和半坡（黄河流域，种粟，住半地穴式房屋）是原始农耕生活的代表。', en: 'Hemudu (Yangtze, rice, stilt houses) and Banpo (Yellow River, millet, semi-subterranean houses) show early farming life.' },
      { zh: '良渚古城遗址实证了中华五千多年文明史；炎帝、黄帝被尊为中华民族的“人文始祖”，尧、舜、禹实行禅让。', en: 'Liangzhu is evidence of over 5,000 years of Chinese civilisation; the Yan and Yellow Emperors are honoured as the first ancestors, and Yao, Shun and Yu passed on rule by abdication.' },
    ],
  },
  {
    id: 'g7a-2', book: 'g7a', unit: 2, minutes: 12,
    title: { zh: '夏商周：早期国家与社会变革', en: 'Xia, Shang and Zhou: early states and social change' },
    blurb: { zh: '夏朝建立，商朝留下甲骨文和青铜器，西周实行分封制；春秋争霸、战国变法与百家争鸣推动社会变革。', en: 'The Xia founds the first dynasty, the Shang leaves oracle bones and bronzes, the Zhou rules by enfeoffment; then rival lords, reforms and the Hundred Schools transform society.' },
    steps: [
      {
        year: -2070, at: [113, 35, 45],
        title: { zh: '从部落到国家', en: 'From tribes to a state' },
        body: { zh: '约公元前2070年起，夏、商、周三个王朝在黄河流域相继兴起，早期国家逐渐形成。到了春秋战国时期，社会发生了深刻变革。', en: 'From about 2070 BCE the Xia, Shang and Zhou dynasties rose one after another on the Yellow River and the first states took shape. In the Spring and Autumn and Warring States periods society changed deeply.' },
      },
      { ev: 'xia_found', polity: 'xia' },
      {
        ev: 'pangeng', polity: 'shang',
        body: { zh: '约公元前1600年商汤灭夏，建立商朝。盘庚迁殷后商朝统治趋于稳定；殷墟出土的甲骨文是目前已知最早的成熟文字，后母戊鼎体现了商朝高超的青铜铸造技术。', en: 'Around 1600 BCE Tang overthrew the Xia and founded the Shang. After Pangeng moved the capital to Yin, Shang rule grew stable; the oracle-bone script found at Yinxu is the earliest known mature Chinese writing, and the Houmuwu ding shows the skill of Shang bronze casters.' },
      },
      { ev: 'muye', polity: 'zhou' },
      { ev: 'fenfeng' },
      {
        ev: 'kuiqiu',
        body: { zh: '公元前770年周平王东迁洛邑，东周开始。春秋时期周王室衰微，诸侯争霸；齐桓公任用管仲改革，以“尊王攘夷”为号召，成为春秋时期第一个霸主。', en: 'In 770 BCE King Ping moved the capital east to Luoyi and the Eastern Zhou began. As the Zhou kings weakened, lords fought for supremacy; Duke Huan of Qi, who reformed his state with Guan Zhong and claimed to “honour the king and repel the barbarians”, became the first hegemon.' },
      },
      {
        ev: 'shangyang', polity: 'qin_s',
        body: { zh: '战国时期铁农具和牛耕逐渐推广，各国纷纷变法图强。商鞅在秦国变法：国家承认土地私有、奖励耕战、建立县制，秦国逐渐成为最强大的诸侯国。', en: 'In the Warring States period iron tools and ox ploughs spread and states reformed to grow strong. Shang Yang’s reforms in Qin recognised private land, rewarded farming and fighting and set up counties, and Qin became the strongest state.' },
      },
      {
        ev: 'baijia',
        body: { zh: '春秋末年孔子创立儒家学派，主张“仁”，提出“有教无类”。战国时期儒家、道家、墨家、法家等学派相互辩论，形成“百家争鸣”的局面。', en: 'Late in the Spring and Autumn period Confucius founded the Confucian school, teaching benevolence and education for all. In the Warring States period Confucians, Daoists, Mohists, Legalists and others debated: the Hundred Schools of Thought.' },
      },
    ],
    checks: [
      {
        q: { zh: '西周为巩固统治，把土地和人民分给王族、功臣等，这种制度是？', en: 'To secure its rule the Western Zhou granted land and people to royal kin and loyal followers. What was this system?' },
        options: [{ zh: '禅让制', en: 'Abdication' }, { zh: '郡县制', en: 'Commanderies and counties' }, { zh: '世袭制', en: 'Hereditary succession' }, { zh: '分封制', en: 'Enfeoffment' }],
        answer: 3, ev: 'fenfeng',
        why: { zh: '西周实行分封制，诸侯要服从周王、定期朝贡、随从作战，巩固了统治、扩大了统治区域；郡县制推行于秦朝。', en: 'Under enfeoffment the lords obeyed the Zhou king, paid tribute and fought for him, which secured and extended Zhou rule; commanderies and counties came with the Qin.' },
      },
      {
        q: { zh: '使秦国成为战国时期最强大诸侯国的改革是？', en: 'Which reform made Qin the strongest of the Warring States?' },
        options: [{ zh: '商鞅变法', en: 'Shang Yang’s reforms' }, { zh: '管仲改革', en: 'Guan Zhong’s reforms' }, { zh: '孝文帝改革', en: 'Emperor Xiaowen’s reforms' }, { zh: '王安石变法', en: 'Wang Anshi’s reforms' }],
        answer: 0, ev: 'shangyang',
        why: { zh: '商鞅变法承认土地私有、奖励耕战、建立县制，使秦国国力大增；管仲改革使齐国成为春秋首霸。', en: 'Shang Yang recognised private land, rewarded farming and fighting and created counties, making Qin powerful; Guan Zhong’s reforms had made Qi the first hegemon of the Spring and Autumn period.' },
      },
      { order: ['xia_found', 'pangeng', 'muye', 'kuiqiu', 'shangyang'] },
      { where: 'pangeng', tol: 300 },
    ],
    keys: [
      { zh: '约公元前2070年禹建立夏朝，世袭制代替禅让制；商朝的甲骨文是目前已知最早的成熟文字。', en: 'Around 2070 BCE Yu founded the Xia and hereditary rule replaced abdication; Shang oracle-bone script is the earliest known mature writing.' },
      { zh: '公元前1046年牧野之战后西周建立，实行分封制；春秋时期诸侯争霸，齐桓公成为第一个霸主。', en: 'After the battle of Muye in 1046 BCE the Western Zhou ruled by enfeoffment; in the Spring and Autumn period Duke Huan of Qi became the first hegemon.' },
      { zh: '战国时期商鞅变法使秦国成为最强大的诸侯国；孔子创立儒家学派，战国时期出现“百家争鸣”。', en: 'Shang Yang’s reforms made Qin the strongest Warring State; Confucius founded Confucianism and the Warring States saw the Hundred Schools of Thought.' },
    ],
  },
  {
    id: 'g7a-3', book: 'g7a', unit: 3, minutes: 12,
    title: { zh: '秦汉：大一统国家的建立和巩固', en: 'Qin and Han: building and securing a unified state' },
    blurb: { zh: '秦统一六国，汉朝巩固大一统，张骞打通西域。', en: 'Qin unites the Warring States, Han secures the empire and Zhang Qian opens the Western Regions.' },
    steps: [
      {
        year: -230, at: [110, 34, 60],
        title: { zh: '七国争雄', en: 'Seven warring states' },
        body: { zh: '战国末年，秦、齐、楚、燕、韩、赵、魏七国并立。秦国经过商鞅变法，国力最强，开始东出兼并六国。', en: 'At the end of the Warring States period seven states stood side by side. Strengthened by Shang Yang’s reforms, Qin was the strongest and began to conquer the other six.' },
      },
      {
        ev: 'qin_unify', polity: 'qin',
        body: { zh: '公元前230年至前221年，秦王嬴政先后灭掉韩、赵、魏、楚、燕、齐，建立了中国历史上第一个统一的中央集权国家——秦朝，自称“始皇帝”。', en: 'Between 230 and 221 BCE King Zheng of Qin destroyed Han, Zhao, Wei, Chu, Yan and Qi, founding the Qin dynasty, China’s first unified centralised state, and called himself the First Emperor.' },
      },
      {
        ev: 'qin_wall',
        body: { zh: '秦始皇统一文字、货币和度量衡，推行郡县制；北击匈奴，修筑西起临洮、东至辽东的万里长城。', en: 'The First Emperor standardised writing, coins, weights and measures and ruled through commanderies and counties; he drove back the Xiongnu and built the Great Wall from Lintao to Liaodong.' },
      },
      { ev: 'dazexiang' },
      {
        ev: 'hanwudi', polity: 'whan',
        body: { zh: '汉武帝推行“推恩令”削弱诸侯王，“罢黜百家，独尊儒术”，把盐铁收归中央经营，大一统局面得到巩固。', en: 'Emperor Wu of Han weakened the vassal kings, made Confucianism the state teaching and put salt and iron under the court, securing the unified empire.' },
      },
      { ev: 'zhangqian' },
      { ev: 'xiyu_duhu' },
      { ev: 'cailun' },
    ],
    checks: [
      {
        q: { zh: '秦朝在地方推行的行政制度是？', en: 'How did the Qin govern its provinces?' },
        options: [{ zh: '分封制', en: 'Enfeoffment' }, { zh: '郡县制', en: 'Commanderies and counties' }, { zh: '行省制', en: 'Provinces (xingsheng)' }, { zh: '科举制', en: 'Imperial examinations' }],
        answer: 1, ev: 'qin_unify',
        why: { zh: '秦朝在全国推行郡县制，郡守、县令由皇帝直接任免；分封制属于西周，行省制始于元朝。', en: 'Qin divided the realm into commanderies and counties whose officials the emperor appointed; enfeoffment belongs to the Western Zhou and the province system to the Yuan.' },
      },
      { order: ['qin_unify', 'dazexiang', 'han_found', 'zhangqian'] },
      { where: 'zhangqian', tol: 500 },
      {
        q: { zh: '汉武帝“罢黜百家，独尊儒术”主要是为了？', en: 'Why did Emperor Wu make Confucianism the sole state teaching?' },
        options: [{ zh: '发展商业', en: 'To promote trade' }, { zh: '加强思想统一，巩固大一统', en: 'To unify thought and secure the unified empire' }, { zh: '抵御匈奴', en: 'To fight the Xiongnu' }, { zh: '开通丝绸之路', en: 'To open the Silk Road' }],
        answer: 1, ev: 'hanwudi',
        why: { zh: '汉武帝采纳董仲舒的建议，以儒家思想统一人们的思想，为大一统服务。', en: 'Following Dong Zhongshu, Emperor Wu used Confucian teaching to unify thought in the service of the unified state.' },
      },
    ],
    keys: [
      { zh: '前221年秦统一六国，建立第一个统一的中央集权国家；推行郡县制，统一文字、货币、度量衡。', en: 'In 221 BCE Qin founded the first unified centralised state: commanderies and counties, one script, one currency, one set of measures.' },
      { zh: '汉武帝从政治、思想、经济、军事上巩固大一统。', en: 'Emperor Wu of Han secured the empire politically, ideologically, economically and militarily.' },
      { zh: '张骞通西域，丝绸之路开通；前60年设西域都护，新疆正式归属中央。', en: 'Zhang Qian opened the way west and the Silk Road; from 60 BCE the Protectorate of the Western Regions brought Xinjiang under the central government.' },
    ],
  },
  {
    id: 'g7a-4', book: 'g7a', unit: 4, minutes: 12,
    title: { zh: '三国两晋南北朝：政权分立与民族交融', en: 'Three Kingdoms to Northern and Southern Dynasties: division and integration' },
    blurb: { zh: '官渡、赤壁之战后三国鼎立；西晋短暂统一，东晋时江南得到开发，北魏孝文帝改革促进民族交融。', en: 'Guandu and Red Cliffs lead to three rival kingdoms; the Jin briefly reunites China, the south is opened up and Emperor Xiaowen’s reforms bring peoples together.' },
    steps: [
      {
        year: 190, at: [113, 33, 50],
        title: { zh: '东汉末年的割据', en: 'Warlords at the end of the Han' },
        body: { zh: '东汉后期外戚、宦官交替专权，政治黑暗。184年爆发黄巾起义，此后地方割据势力形成，曹操、袁绍、孙权、刘备等在混战中崛起。', en: 'In the late Eastern Han consort clans and eunuchs took turns in power. The Yellow Turban rising of 184 was followed by regional warlords; Cao Cao, Yuan Shao, Sun Quan and Liu Bei rose in the fighting.' },
      },
      { ev: 'guandu' },
      { ev: 'chibi' },
      { ev: 'sanguo' },
      { ev: 'wjin_unify', polity: 'wjin' },
      {
        ev: 'dongjin', polity: 'ejin',
        body: { zh: '西晋灭亡后，317年司马睿在建康建立东晋。北方人民大量南迁，带来了先进的生产技术和劳动力，加上江南自然条件优越、社会相对安定，江南地区得到开发。', en: 'After the Western Jin fell, Sima Rui founded the Eastern Jin at Jiankang in 317. Northerners moved south in great numbers with skills and labour, and with good land and relative peace the Jiangnan region was opened up.' },
      },
      { ev: 'feishui' },
      {
        ev: 'xiaowendi', polity: 'beiwei',
        body: { zh: '439年北魏统一黄河流域。孝文帝把都城从平城迁到洛阳，推行汉化：穿汉服、说汉语、改汉姓、与汉族通婚、采用汉族官制律法，促进了北方的民族交融。', en: 'The Northern Wei united the Yellow River basin in 439. Emperor Xiaowen moved the capital from Pingcheng to Luoyang and adopted Han ways: Han dress, language and surnames, intermarriage and Han offices and laws, bringing the northern peoples together.' },
      },
    ],
    checks: [
      {
        q: { zh: '奠定三国鼎立局面基础的战役是？', en: 'Which battle laid the basis for the three rival kingdoms?' },
        options: [{ zh: '官渡之战', en: 'Guandu' }, { zh: '淝水之战', en: 'The Fei River' }, { zh: '赤壁之战', en: 'The Red Cliffs' }, { zh: '巨鹿之战', en: 'Julu' }],
        answer: 2, ev: 'chibi',
        why: { zh: '208年孙刘联军在赤壁大败曹操，曹操退回北方，奠定了三国鼎立的基础；官渡之战则为曹操统一北方奠定了基础。', en: 'In 208 Sun Quan and Liu Bei routed Cao Cao at the Red Cliffs and he withdrew north, setting up the three-way split; Guandu had won Cao Cao the north.' },
      },
      {
        q: { zh: '北魏孝文帝改革最主要的作用是？', en: 'What was the main result of Emperor Xiaowen’s reforms?' },
        options: [{ zh: '结束了分裂，统一了全国', en: 'It ended division and reunited China' }, { zh: '奠定了三国鼎立的基础', en: 'It laid the basis for the Three Kingdoms' }, { zh: '使江南地区得到开发', en: 'It opened up the Jiangnan region' }, { zh: '促进了北方的民族交融', en: 'It brought the northern peoples together' }],
        answer: 3, ev: 'xiaowendi',
        why: { zh: '孝文帝迁都洛阳、推行汉化，加速了鲜卑族与汉族的交融；江南的开发主要得益于北方人口南迁。', en: 'By moving to Luoyang and adopting Han ways Xiaowen sped up the blending of the Xianbei and the Han; the south was opened up mainly by migrants from the north.' },
      },
      { order: ['guandu', 'chibi', 'wjin_unify', 'feishui', 'xiaowendi'] },
      { where: 'chibi', tol: 400 },
    ],
    keys: [
      { zh: '官渡之战为曹操统一北方奠定基础；赤壁之战奠定三国鼎立的基础；220—229年魏、蜀、吴相继建立。', en: 'Guandu won Cao Cao the north; the Red Cliffs set up the three-way split; Wei, Shu and Wu were founded between 220 and 229.' },
      { zh: '西晋于280年短暂统一全国；东晋时北方人民大量南迁，江南地区得到开发。', en: 'The Western Jin briefly reunited China in 280; under the Eastern Jin northern migrants helped open up the Jiangnan region.' },
      { zh: '北魏孝文帝迁都洛阳、推行汉化政策，促进了北方的民族交融。', en: 'Emperor Xiaowen of the Northern Wei moved the capital to Luoyang and adopted Han ways, bringing the northern peoples together.' },
    ],
  },
];
