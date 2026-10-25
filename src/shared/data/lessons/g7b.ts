/** 七年级下册. */
import type { Lesson } from '../types.ts';

export const G7B: Lesson[] = [
  {
    id: 'g7b-1', book: 'g7b', unit: 1, minutes: 12,
    title: { zh: '隋唐：繁荣与开放的时代', en: 'Sui and Tang: an age of prosperity and openness' },
    blurb: { zh: '隋朝统一全国、开通大运河、创立科举制；唐朝出现贞观之治和开元盛世，与吐蕃友好往来，安史之乱后由盛转衰。', en: 'The Sui reunites China, digs the Grand Canal and creates the examinations; the Tang flourishes, befriends Tibet and declines after the An Lushan rebellion.' },
    steps: [
      {
        year: 581, at: [112, 33, 55],
        title: { zh: '隋朝建立', en: 'The Sui is founded' },
        body: { zh: '南北朝后期，北方的北周逐渐强大。581年杨坚夺取北周政权，建立隋朝，定都长安，他就是隋文帝。', en: 'Late in the Northern and Southern Dynasties the Northern Zhou grew strong. In 581 Yang Jian took its throne and founded the Sui with its capital at Chang’an; he is Emperor Wen of Sui.' },
      },
      {
        ev: 'sui_unify', polity: 'sui',
        body: { zh: '589年隋军南下灭陈，结束了西晋末年以来近三百年的分裂局面。隋文帝励精图治，隋朝经济繁荣。', en: 'In 589 Sui armies destroyed the Chen in the south, ending nearly three centuries of division since the end of the Western Jin. Emperor Wen ruled diligently and the economy flourished.' },
      },
      {
        ev: 'grand_canal',
        body: { zh: '为加强南北交通、巩固对全国的统治，隋炀帝开通大运河。它以洛阳为中心，北达涿郡，南至余杭，是古代世界最长的运河，促进了南北经济文化交流。', en: 'To link north and south and secure his rule, Emperor Yang opened the Grand Canal. Centred on Luoyang, it ran north to Zhuojun and south to Yuhang, the longest canal of the ancient world, and joined the economies and cultures of north and south.' },
      },
      {
        ev: 'keju',
        body: { zh: '隋文帝开始用分科考试选拔官员，隋炀帝设进士科，科举制正式诞生。科举制改变了门阀士族垄断官场的局面，唐朝时进一步完善。', en: 'Emperor Wen began choosing officials by examination in several subjects and Emperor Yang created the jinshi degree: the imperial examinations were born. They broke the great clans’ hold on office and were refined under the Tang.' },
      },
      {
        ev: 'zhenguan', polity: 'tang',
        body: { zh: '隋炀帝暴政引发农民起义，618年隋朝灭亡，李渊建立唐朝。唐太宗吸取隋亡教训，虚心纳谏、轻徭薄赋、完善科举制，史称“贞观之治”。', en: 'Emperor Yang’s tyranny sparked peasant risings; the Sui fell in 618 and Li Yuan founded the Tang. Learning from the Sui’s fall, Emperor Taizong heeded advice, lightened taxes and labour and improved the examinations: the Reign of Zhenguan.' },
      },
      { ev: 'wencheng', polity: 'tubo' },
      {
        ev: 'kaiyuan', polity: 'tang',
        body: { zh: '唐玄宗前期励精图治，唐朝进入全盛时期，史称“开元盛世”。长安成为国际性大都市，日本多次派遣唐使来华学习，高僧鉴真东渡日本传播唐文化。', en: 'In his early reign Emperor Xuanzong ruled diligently and the Tang reached its height, the Kaiyuan golden age. Chang’an became a cosmopolitan city; Japan sent envoys to learn from the Tang, and the monk Jianzhen sailed to Japan.' },
      },
      {
        ev: 'anshi',
        body: { zh: '755年安禄山、史思明发动叛乱，攻占洛阳、长安，763年才被平定。安史之乱是唐朝由盛转衰的转折点，此后藩镇割据，907年唐朝灭亡。', en: 'In 755 An Lushan and Shi Siming rebelled and took Luoyang and Chang’an; the revolt was put down only in 763. It was the turning point from prosperity to decline: regional governors became warlords, and the Tang fell in 907.' },
      },
    ],
    checks: [
      {
        q: { zh: '隋朝大运河的中心是？', en: 'Which city was the centre of the Sui Grand Canal?' },
        options: [{ zh: '长安', en: 'Chang’an' }, { zh: '洛阳', en: 'Luoyang' }, { zh: '涿郡', en: 'Zhuojun' }, { zh: '余杭', en: 'Yuhang' }],
        answer: 1, ev: 'grand_canal',
        why: { zh: '大运河以洛阳为中心，北达涿郡，南至余杭，连接海河、黄河、淮河、长江、钱塘江五大水系。', en: 'The canal was centred on Luoyang and reached Zhuojun in the north and Yuhang in the south, linking five great river systems.' },
      },
      {
        q: { zh: '唐朝由盛转衰的转折点是？', en: 'What turned the Tang from prosperity to decline?' },
        options: [{ zh: '黄巢起义', en: 'The Huang Chao rebellion' }, { zh: '文成公主入藏', en: 'Princess Wencheng’s marriage into Tibet' }, { zh: '玄奘西行', en: 'Xuanzang’s journey west' }, { zh: '安史之乱', en: 'The An Lushan rebellion' }],
        answer: 3, ev: 'anshi',
        why: { zh: '755年爆发的安史之乱历时八年，此后藩镇割据，唐朝由盛转衰；黄巢起义发生在唐朝末年，沉重打击了唐朝统治。', en: 'The eight-year An Lushan rebellion from 755 left warlord governors in power and began the Tang’s decline; the Huang Chao rebellion came near the dynasty’s end.' },
      },
      { order: ['sui_unify', 'grand_canal', 'zhenguan', 'kaiyuan', 'anshi'] },
      { where: 'wencheng', tol: 400 },
    ],
    keys: [
      { zh: '589年隋朝统一全国；隋炀帝开通大运河，以洛阳为中心，北达涿郡，南至余杭。', en: 'The Sui reunited China in 589; Emperor Yang’s Grand Canal ran from Zhuojun to Yuhang with Luoyang at its centre.' },
      { zh: '隋朝创立科举制，隋炀帝设进士科标志着科举制正式诞生；唐太宗时出现“贞观之治”，唐玄宗前期出现“开元盛世”。', en: 'The Sui created the imperial examinations, born with Emperor Yang’s jinshi degree; the Tang saw the Reign of Zhenguan under Taizong and the Kaiyuan golden age under Xuanzong.' },
      { zh: '641年文成公主入藏，促进了唐蕃友好；755年爆发的安史之乱是唐朝由盛转衰的转折点。', en: 'Princess Wencheng’s marriage into Tibet in 641 furthered Tang–Tibetan friendship; the An Lushan rebellion of 755 turned the Tang towards decline.' },
    ],
  },
  {
    id: 'g7b-2', book: 'g7b', unit: 2, minutes: 12,
    title: { zh: '辽宋夏金元：民族关系发展和社会变化', en: 'Liao, Song, Xia, Jin and Yuan: ethnic relations and social change' },
    blurb: { zh: '北宋与辽、西夏并立，南宋与金对峙，经济重心南移；蒙古兴起，元朝统一全国并实行行省制度。', en: 'The Song stands beside the Liao and Xia and then faces the Jin, the economy shifts south, and the Mongol Yuan reunites China under its provinces.' },
    steps: [
      {
        year: 907, at: [113, 38, 60],
        title: { zh: '五代十国', en: 'Five Dynasties and Ten Kingdoms' },
        body: { zh: '907年唐朝灭亡，中原相继出现后梁、后唐、后晋、后汉、后周五个王朝，南方等地先后出现十个政权，史称“五代十国”。北方的契丹族逐渐强大，后来建立了辽。', en: 'After the Tang fell in 907, five short dynasties followed one another in the north and ten kingdoms rose in the south: the Five Dynasties and Ten Kingdoms. To the north the Khitan grew strong and later founded the Liao.' },
      },
      { ev: 'song_found' },
      { ev: 'chanyuan', polity: 'liao' },
      {
        ev: 'jingkang',
        body: { zh: '1115年女真首领阿骨打建立金，1125年金灭辽。1127年金军攻破开封，北宋灭亡，史称“靖康之变”；同年赵构即位，后定都临安，史称南宋。', en: 'The Jurchen leader Aguda founded the Jin in 1115, and the Jin destroyed the Liao in 1125. In 1127 Jin troops took Kaifeng and the Northern Song fell; that year Zhao Gou took the throne and later made Lin’an his capital: the Southern Song.' },
      },
      { ev: 'yuefei', polity: 'nsong' },
      {
        ev: 'south_shift',
        body: { zh: '宋代农业、手工业和商业都很发达，北宋前期四川出现了世界上最早的纸币“交子”。南宋时我国经济重心南移完成，“苏湖熟，天下足”。', en: 'Song farming, crafts and trade flourished, and early in the Northern Song Sichuan issued jiaozi, the world’s first paper money. By the Southern Song the centre of the economy had moved south: “when Suzhou and Huzhou ripen, the realm has enough”.' },
      },
      {
        ev: 'yuan_found', polity: 'yuan',
        body: { zh: '1206年铁木真统一蒙古，被尊为“成吉思汗”。1271年忽必烈定国号为元，次年定都大都；1276年元军攻占临安，1279年南宋灭亡，元朝统一全国。', en: 'Temujin united the Mongols in 1206 and was hailed as Genghis Khan. In 1271 Kublai named his dynasty Yuan and next year made Dadu his capital; the Yuan took Lin’an in 1276 and ended the Southern Song in 1279, reuniting China.' },
      },
      {
        ev: 'xingsheng',
        body: { zh: '元朝中央设中书省，地方实行行省制度，这是我国省制的开端，加强了中央集权。元朝设宣政院管辖西藏，设澎湖巡检司管辖澎湖和台湾。', en: 'The Yuan ran the court through the Central Secretariat and the provinces through branch secretariats, the origin of China’s provinces, strengthening central power. It governed Tibet through the Xuanzheng Yuan and Penghu and Taiwan through the Penghu Inspectorate.' },
      },
    ],
    checks: [
      {
        q: { zh: '1005年，北宋与辽达成的和议是？', en: 'What peace did the Northern Song make with the Liao in 1005?' },
        options: [{ zh: '澶渊之盟', en: 'The Chanyuan treaty' }, { zh: '绍兴和议', en: 'The Shaoxing peace' }, { zh: '宋夏和议', en: 'The Song–Xia peace' }, { zh: '葵丘会盟', en: 'The Kuiqiu meeting' }],
        answer: 0, ev: 'chanyuan',
        why: { zh: '宋真宗亲征澶州后与辽议和，宋每年给辽岁币，史称“澶渊之盟”，此后宋辽长期保持和平；绍兴和议是宋金之间的和议。', en: 'After Emperor Zhenzong went to the front at Chanzhou, the Song agreed to pay the Liao a yearly sum, and the two kept the peace for a long time; the Shaoxing peace was made between the Song and the Jin.' },
      },
      {
        q: { zh: '元朝为加强对地方的管理，实行了什么制度？', en: 'How did the Yuan govern its provinces?' },
        options: [{ zh: '郡县制', en: 'Commanderies and counties' }, { zh: '三省六部制', en: 'Three Departments and Six Ministries' }, { zh: '行省制度', en: 'Provinces (xingsheng)' }, { zh: '分封制', en: 'Enfeoffment' }],
        answer: 2, ev: 'xingsheng',
        why: { zh: '元朝在地方设行省，这是我国省制的开端，加强了中央对地方的管辖；三省六部制完善于隋唐。', en: 'The Yuan created provinces, the origin of China’s provinces, tightening central control; the Three Departments and Six Ministries belong to the Sui and Tang.' },
      },
      { order: ['song_found', 'chanyuan', 'jingkang', 'genghis', 'yuan_found'] },
      { where: 'chanyuan', tol: 300 },
    ],
    keys: [
      { zh: '960年赵匡胤建立北宋；1005年宋辽订立澶渊之盟，此后双方长期保持和平。', en: 'Zhao Kuangyin founded the Northern Song in 960; the Chanyuan treaty of 1005 brought the Song and Liao a long peace.' },
      { zh: '1127年靖康之变，北宋灭亡、南宋建立；岳飞抗金；南宋时我国经济重心南移完成。', en: 'The Northern Song fell in 1127 and the Southern Song began; Yue Fei fought the Jin; by the Southern Song the economic centre had moved south.' },
      { zh: '1206年成吉思汗统一蒙古，1271年忽必烈建立元朝；元朝实行行省制度，设宣政院管辖西藏。', en: 'Genghis Khan united the Mongols in 1206 and Kublai founded the Yuan in 1271; the Yuan created provinces and governed Tibet through the Xuanzheng Yuan.' },
    ],
  },
  {
    id: 'g7b-3', book: 'g7b', unit: 3, minutes: 12,
    title: { zh: '明清：统一多民族国家的巩固与发展', en: 'Ming and Qing: consolidating the unified multi-ethnic state' },
    blurb: { zh: '明朝加强皇权、郑和下西洋、戚继光抗倭；清朝收复台湾、抗击沙俄、管辖西藏和新疆，君主专制达到顶峰。', en: 'The Ming strengthens the throne, sends Zheng He to sea and fights the pirates; the Qing recovers Taiwan, resists Russia, governs Tibet and Xinjiang and takes autocracy to its peak.' },
    steps: [
      {
        year: 1368, at: [116, 34, 55], polity: 'ming',
        title: { zh: '明朝建立', en: 'The Ming is founded' },
        body: { zh: '1368年朱元璋在应天府称帝，建立明朝，同年明军攻占大都，结束了元朝的统治。明太祖废除丞相，由六部直接对皇帝负责，皇权空前加强。', en: 'In 1368 Zhu Yuanzhang proclaimed himself emperor at Yingtian and founded the Ming; that year his army took Dadu and ended Yuan rule. He abolished the chancellor and made the Six Ministries answer to him directly, greatly strengthening the throne.' },
      },
      { ev: 'zhenghe' },
      { ev: 'qijiguang' },
      { ev: 'li_zicheng' },
      { ev: 'zheng_chenggong' },
      { ev: 'yaksa', polity: 'qing' },
      {
        ev: 'zungar', polity: 'qing',
        body: { zh: '康熙、雍正、乾隆三朝平定准噶尔叛乱，乾隆帝又平定大小和卓叛乱，统一新疆并设伊犁将军。清朝还设驻藏大臣，与达赖、班禅共同管理西藏。', en: 'Under Kangxi, Yongzheng and Qianlong the Qing put down the Dzungars, then Qianlong crushed the Khoja revolt, unified Xinjiang and appointed the General of Ili. The Qing also posted Ambans to govern Tibet with the Dalai Lama and the Panchen Lama.' },
      },
      {
        ev: 'junjichu',
        body: { zh: '1729年雍正帝设立军机处，军国大事由皇帝一人裁决，君主专制达到顶峰。清朝还实行“闭关锁国”，1757年只开放广州一处通商，使中国逐渐落后于世界潮流。', en: 'In 1729 Emperor Yongzheng set up the Grand Council and decided all affairs of state alone: autocracy reached its peak. The Qing also closed the country, opening only Guangzhou to foreign trade from 1757, and China fell behind the world.' },
      },
    ],
    checks: [
      {
        q: { zh: '郑和下西洋最远到达了哪里？', en: 'How far did Zheng He’s voyages reach?' },
        options: [{ zh: '日本和朝鲜', en: 'Japan and Korea' }, { zh: '印度半岛南端', en: 'The southern tip of India' }, { zh: '非洲东海岸和红海沿岸', en: 'The coast of East Africa and the Red Sea' }, { zh: '欧洲地中海沿岸', en: 'The Mediterranean coast of Europe' }],
        answer: 2, ev: 'zhenghe',
        why: { zh: '1405—1433年郑和七次远航，访问了亚非三十多个国家和地区，最远到达非洲东海岸和红海沿岸。', en: 'On seven voyages between 1405 and 1433 Zheng He visited over thirty countries in Asia and Africa, reaching as far as East Africa and the Red Sea.' },
      },
      {
        q: { zh: '标志着我国君主专制达到顶峰的是？', en: 'What marked the peak of imperial autocracy in China?' },
        options: [{ zh: '明太祖废除丞相', en: 'The Ming founder abolishing the chancellor' }, { zh: '雍正帝设立军机处', en: 'Yongzheng setting up the Grand Council' }, { zh: '明成祖设立内阁', en: 'The Yongle Emperor creating the Grand Secretariat' }, { zh: '元朝实行行省制度', en: 'The Yuan creating provinces' }],
        answer: 1, ev: 'junjichu',
        why: { zh: '军机处设立后，军国大事由皇帝一人裁决，标志着君主专制达到顶峰；废丞相、设内阁是明朝加强皇权的措施。', en: 'With the Grand Council the emperor alone decided all affairs of state, the peak of autocracy; abolishing the chancellor and creating the Grand Secretariat were earlier Ming steps.' },
      },
      { order: ['zhenghe', 'qijiguang', 'li_zicheng', 'zheng_chenggong', 'yaksa'] },
      { where: 'yaksa', tol: 400 },
    ],
    keys: [
      { zh: '明太祖废丞相、权分六部，加强皇权；1405—1433年郑和七下西洋；戚继光抗倭，基本平定倭患。', en: 'The Ming founder abolished the chancellor and ruled through the Six Ministries; Zheng He sailed seven times between 1405 and 1433; Qi Jiguang defeated the Japanese pirates.' },
      { zh: '1644年明朝灭亡，清军入关；1662年郑成功收复台湾；雅克萨之战后，1689年中俄签订《尼布楚条约》。', en: 'The Ming fell and the Qing entered the passes in 1644; Zheng Chenggong recovered Taiwan in 1662; after Albazin, China and Russia signed the Treaty of Nerchinsk in 1689.' },
      { zh: '清朝设驻藏大臣、平定准噶尔和大小和卓叛乱，巩固了统一多民族国家；军机处的设立标志着君主专制达到顶峰。', en: 'The Qing posted Ambans in Tibet and put down the Dzungars and the Khojas, consolidating the unified multi-ethnic state; the Grand Council marked the peak of autocracy.' },
    ],
  },
];
