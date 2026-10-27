/** 八年级上册 — 1840 to 1949. */
import type { Lesson } from '../types.ts';

export const G8A: Lesson[] = [
  {
    id: 'g8a-1', book: 'g8a', unit: 1, minutes: 12,
    title: { zh: '中国开始沦为半殖民地半封建社会', en: 'China begins to become semi-colonial and semi-feudal' },
    blurb: { zh: '虎门销烟、两次鸦片战争和太平天国运动。', en: 'The opium burning at Humen, the two Opium Wars and the Taiping Heavenly Kingdom.' },
    steps: [
      {
        year: 1838, at: [113.3, 23.1, 30],
        title: { zh: '鸦片走私', en: 'Opium smuggling' },
        body: { zh: '19世纪前期，英国为扭转对华贸易逆差，向中国大量走私鸦片。鸦片泛滥造成白银外流，严重摧残了中国人的身心健康。', en: 'In the early 19th century Britain smuggled huge amounts of opium into China to reverse its trade deficit. Silver drained out of the country and the drug ruined people’s health.' },
      },
      { ev: 'humen' },
      {
        ev: 'opium_war',
        body: { zh: '1840年英国发动鸦片战争。1842年清政府被迫签订中国近代史上第一个不平等条约《南京条约》：割香港岛，赔款2100万银元，开放五口通商，协定关税。', en: 'Britain launched the Opium War in 1840. In 1842 the Qing signed the Treaty of Nanking, modern China’s first unequal treaty: Hong Kong Island ceded, 21 million silver dollars paid, five ports opened and tariffs set by agreement.' },
      },
      {
        ev: 'yuanmingyuan',
        body: { zh: '1856年英法发动第二次鸦片战争。1860年英法联军攻入北京，洗劫并焚毁“万园之园”圆明园；清政府被迫签订《北京条约》，割九龙司地方一区给英国。', en: 'Britain and France began the Second Opium War in 1856. In 1860 their troops took Beijing, looted and burned the Old Summer Palace, and the Qing ceded part of Kowloon to Britain in the Convention of Peking.' },
      },
      { ev: 'russia_land' },
      {
        ev: 'taiping',
        body: { zh: '1851年洪秀全领导金田起义，建号太平天国；1853年定都天京，颁布《天朝田亩制度》。1864年天京陷落，运动在中外反动势力联合镇压下失败。', en: 'Hong Xiuquan rose at Jintian in 1851 and proclaimed the Taiping Heavenly Kingdom; in 1853 it made Nanjing its Heavenly Capital and issued its land system. Crushed by Qing and foreign forces together, it fell in 1864.' },
      },
    ],
    checks: [
      {
        q: { zh: '中国近代史上第一个不平等条约是？', en: 'Which was modern China’s first unequal treaty?' },
        options: [{ zh: '《南京条约》', en: 'Treaty of Nanking' }, { zh: '《北京条约》', en: 'Convention of Peking' }, { zh: '《马关条约》', en: 'Treaty of Shimonoseki' }, { zh: '《辛丑条约》', en: 'Boxer Protocol' }],
        answer: 0, ev: 'opium_war',
        why: { zh: '1842年鸦片战争后签订的《南京条约》是中国近代史上第一个不平等条约，中国开始沦为半殖民地半封建社会。', en: 'The Treaty of Nanking, signed after the Opium War in 1842, was the first; with it China began to become semi-colonial and semi-feudal.' },
      },
      {
        q: { zh: '《南京条约》中破坏中国关税自主权的条款是？', en: 'Which term of the Treaty of Nanking took away China’s control of its tariffs?' },
        options: [{ zh: '割香港岛给英国', en: 'Ceding Hong Kong Island' }, { zh: '赔款2100万银元', en: 'An indemnity of 21 million silver dollars' }, { zh: '开放五处通商口岸', en: 'Opening five treaty ports' }, { zh: '英商应纳税款由双方协定', en: 'Customs duties fixed by agreement with Britain' }],
        answer: 3, ev: 'opium_war',
        why: { zh: '“协定关税”使中国不能自主决定进出口税率，关税主权遭到破坏。', en: 'Tariffs “by agreement” meant China could no longer set its own customs duties.' },
      },
      { order: ['humen', 'opium_war', 'taiping', 'yuanmingyuan'] },
      { where: 'humen' },
    ],
    keys: [
      { zh: '1840年鸦片战争爆发，1842年《南京条约》是中国近代史上第一个不平等条约，中国开始沦为半殖民地半封建社会。', en: 'The Opium War began in 1840; the 1842 Treaty of Nanking was the first unequal treaty, and China began to become semi-colonial and semi-feudal.' },
      { zh: '第二次鸦片战争中英法联军火烧圆明园；沙俄割占中国东北和西北领土150多万平方千米。', en: 'In the Second Opium War Anglo-French troops burned the Old Summer Palace; Russia annexed over 1.5 million km² in the northeast and northwest.' },
      { zh: '太平天国运动颁布《天朝田亩制度》，是中国旧式农民战争的最高峰。', en: 'The Taiping Heavenly Kingdom issued its land system and was the high point of China’s old-style peasant wars.' },
    ],
  },
  {
    id: 'g8a-2', book: 'g8a', unit: 2, minutes: 14,
    title: { zh: '近代化的早期探索与民族危机的加剧', en: 'Early modernisation and a deepening national crisis' },
    blurb: { zh: '洋务运动、甲午战争、戊戌变法和八国联军侵华。', en: 'The Self-Strengthening Movement, the war of 1894, the 1898 reform and the Eight-Nation Alliance.' },
    steps: [
      {
        year: 1861, at: [116, 33, 50],
        title: { zh: '内忧外患', en: 'Trouble within and without' },
        body: { zh: '两次鸦片战争和太平天国运动后，清政府面临内忧外患。统治集团中一部分官员主张学习西方先进技术，以维护清朝统治。', en: 'After the two Opium Wars and the Taiping rising the Qing faced crises at home and abroad. Some officials argued for learning Western technology to save the dynasty.' },
      },
      {
        ev: 'yangwu',
        body: { zh: '19世纪60—90年代，洋务派以“自强”“求富”为口号，创办江南制造总局、福州船政局、轮船招商局等近代企业，筹建北洋水师，兴办新式学堂。', en: 'From the 1860s to the 1890s the Westernisers, under the slogans “self-strengthening” and “seeking wealth”, set up arsenals, shipyards and steamship lines, built the Beiyang Fleet and opened new schools.' },
      },
      { ev: 'zuo_xinjiang' },
      { ev: 'sino_french' },
      {
        ev: 'jiawu',
        body: { zh: '1894年日本发动甲午中日战争。黄海海战中邓世昌指挥“致远”舰英勇作战，壮烈殉国。1895年北洋舰队在威海卫全军覆没，标志着洋务运动的失败。', en: 'Japan started the war of 1894. Deng Shichang fought the cruiser Zhiyuan to the end in the Yellow Sea battle. The Beiyang Fleet was wiped out at Weihaiwei in 1895, marking the failure of self-strengthening.' },
      },
      {
        ev: 'maguan',
        body: { zh: '1895年清政府被迫签订《马关条约》，割辽东半岛、台湾全岛及所有附属各岛屿、澎湖列岛给日本，赔款白银2亿两，允许日本在通商口岸开设工厂，大大加深了中国社会的半殖民地化。', en: 'The 1895 Treaty of Shimonoseki ceded the Liaodong Peninsula, Taiwan and the Penghu Islands to Japan, imposed 200 million taels and let Japan open factories in the treaty ports, deepening China’s semi-colonial status.' },
      },
      {
        year: 1898, at: [119, 34, 50],
        title: { zh: '瓜分中国的狂潮', en: 'The scramble for China' },
        body: { zh: '甲午战后，列强掀起瓜分中国的狂潮，强占“租借地”、划分“势力范围”：德国强租胶州湾，俄国强租旅顺、大连，英国强租威海卫和九龙半岛北部，法国强租广州湾。', en: 'After 1895 the powers scrambled for China, seizing leased territories and spheres of influence: Germany took Jiaozhou Bay, Russia Lüshun and Dalian, Britain Weihaiwei and the New Territories, France Guangzhouwan.' },
      },
      {
        ev: 'wuxu',
        body: { zh: '1895年康有为等发动“公车上书”。1898年光绪帝颁布“明定国是”诏书，宣布变法；慈禧太后发动政变，谭嗣同等“戊戌六君子”遇害，变法历时103天失败。', en: 'Kang Youwei and others petitioned the throne in 1895. In 1898 the Guangxu Emperor decreed reform, but Empress Dowager Cixi staged a coup; Tan Sitong and five others were executed and the reform ended after 103 days.' },
      },
      {
        ev: 'baguo',
        body: { zh: '1900年八国联军侵华，镇压义和团运动，攻占北京。1901年清政府被迫签订《辛丑条约》，赔款白银4.5亿两，划定使馆界，拆毁大沽炮台。中国完全沦为半殖民地半封建社会。', en: 'In 1900 the Eight-Nation Alliance invaded, crushed the Boxers and took Beijing. The 1901 Boxer Protocol imposed 450 million taels, a legation quarter and the razing of the Dagu forts. China became fully semi-colonial and semi-feudal.' },
      },
    ],
    checks: [
      {
        q: { zh: '中法战争中，在镇南关大败法军的将领是？', en: 'Who routed the French at Zhennan Pass in the Sino-French War?' },
        options: [{ zh: '左宗棠', en: 'Zuo Zongtang' }, { zh: '邓世昌', en: 'Deng Shichang' }, { zh: '冯子材', en: 'Feng Zicai' }, { zh: '林则徐', en: 'Lin Zexu' }],
        answer: 2, ev: 'sino_french',
        why: { zh: '1885年老将冯子材率军取得镇南关大捷；左宗棠收复新疆，邓世昌在甲午黄海海战中殉国，林则徐主持虎门销烟。', en: 'The veteran Feng Zicai won at Zhennan Pass in 1885; Zuo Zongtang recovered Xinjiang, Deng Shichang died in the Yellow Sea battle of 1894, and Lin Zexu destroyed the opium at Humen.' },
      },
      {
        q: { zh: '标志着洋务运动失败的是？', en: 'What marked the failure of the Self-Strengthening Movement?' },
        options: [{ zh: '黄海海战', en: 'The Battle of the Yellow Sea' }, { zh: '北洋舰队全军覆没', en: 'The destruction of the Beiyang Fleet' }, { zh: '《马关条约》签订', en: 'The Treaty of Shimonoseki' }, { zh: '戊戌政变', en: 'The coup of 1898' }],
        answer: 1, ev: 'jiawu',
        why: { zh: '北洋舰队是洋务运动的重要成果，1895年它在威海卫全军覆没，标志着洋务运动的失败。', en: 'The Beiyang Fleet was the showpiece of self-strengthening; its destruction at Weihaiwei in 1895 marked the movement’s failure.' },
      },
      {
        q: { zh: '《马关条约》允许日本在中国通商口岸开设工厂，反映了列强对华侵略的什么新特点？', en: 'Letting Japan open factories in the treaty ports showed what new form of aggression?' },
        options: [{ zh: '以鸦片走私为主', en: 'Mainly opium smuggling' }, { zh: '以割占领土为主', en: 'Mainly seizing territory' }, { zh: '资本输出成为主要方式', en: 'Exporting capital became the main form' }, { zh: '以商品倾销为唯一方式', en: 'Dumping goods as the only form' }],
        answer: 2, ev: 'maguan',
        why: { zh: '在华开设工厂就是资本输出，列强对华经济侵略由商品输出为主转向资本输出为主。', en: 'Building factories in China meant exporting capital: the powers moved from mainly selling goods to mainly investing capital.' },
      },
      { order: ['yangwu', 'jiawu', 'wuxu', 'baguo'] },
      { where: 'weihai', why: { zh: '1895年北洋舰队在威海卫全军覆没。', en: 'The Beiyang Fleet was destroyed at Weihaiwei in 1895.' } },
    ],
    keys: [
      { zh: '洋务运动以“自强”“求富”为口号学习西方先进技术，是中国近代化的开端，但没有使中国走上富强道路。', en: 'The Self-Strengthening Movement learned Western technology to gain strength and wealth; it began China’s modernisation but did not make China strong.' },
      { zh: '1895年《马关条约》大大加深了中国社会的半殖民地化；1898年戊戌变法是爱国救亡运动，起了思想启蒙作用。', en: 'The 1895 Treaty of Shimonoseki deepened China’s semi-colonial status; the 1898 reform was a patriotic movement that opened minds.' },
      { zh: '1901年《辛丑条约》使清政府成为“洋人的朝廷”，中国完全沦为半殖民地半封建社会。', en: 'The 1901 Boxer Protocol made the Qing a court serving foreigners; China became fully semi-colonial and semi-feudal.' },
    ],
  },
  {
    id: 'g8a-3', book: 'g8a', unit: 3, minutes: 12,
    title: { zh: '资产阶级民主革命与中华民国的建立', en: 'The bourgeois democratic revolution and the Republic of China' },
    blurb: { zh: '孙中山与同盟会，辛亥革命推翻帝制，中华民国成立。', en: 'Sun Yat-sen and the Tongmenghui, the 1911 Revolution ends the monarchy and the Republic is founded.' },
    steps: [
      {
        year: 1894, at: [113.4, 22.5, 30],
        title: { zh: '革命先行者孙中山', en: 'Sun Yat-sen, forerunner of the revolution' },
        body: { zh: '孙中山是广东香山人。1894年他在檀香山创立兴中会，提出“驱除鞑虏，恢复中华，创立合众政府”，走上了反清革命的道路。', en: 'Sun Yat-sen came from Xiangshan in Guangdong. In 1894 he founded the Revive China Society in Honolulu, calling for the overthrow of the Qing and a republican government.' },
      },
      {
        ev: 'tongmenghui',
        body: { zh: '1905年中国同盟会在日本东京成立，孙中山任总理，以“驱除鞑虏，恢复中华，创立民国，平均地权”为纲领，是第一个全国性的资产阶级革命政党。孙中山将纲领概括为三民主义。', en: 'The Tongmenghui was founded in Tokyo in 1905 with Sun Yat-sen at its head. Its programme made it China’s first nationwide bourgeois revolutionary party; Sun summed it up as the Three Principles of the People.' },
      },
      { ev: 'huanghuagang' },
      {
        ev: 'wuchang',
        body: { zh: '1911年4月黄花岗起义失败。10月10日，湖北的革命党人在武昌发动起义并取得胜利，各省纷纷响应，清朝统治土崩瓦解。这一年是农历辛亥年，史称辛亥革命。', en: 'The Huanghuagang rising failed in April 1911. On 10 October revolutionaries rose at Wuchang and won; province after province declared independence and Qing rule collapsed. It is called the 1911 (Xinhai) Revolution.' },
      },
      {
        ev: 'roc_found', polity: 'roc',
        body: { zh: '1912年1月1日孙中山在南京就任临时大总统，中华民国成立；2月清帝退位，两千多年的君主专制制度结束。3月颁布《中华民国临时约法》。', en: 'On 1 January 1912 Sun Yat-sen became provisional president in Nanjing and the Republic of China was founded; in February the last emperor abdicated, ending over two thousand years of monarchy. A Provisional Constitution followed in March.' },
      },
      {
        year: 1915, at: [116.4, 39.9, 40],
        title: { zh: '北洋政府的黑暗统治', en: 'The dark rule of the Beiyang government' },
        body: { zh: '1912年袁世凯在北京就任临时大总统，窃取了辛亥革命的果实。1915年他复辟帝制，蔡锷等发动护国战争，袁世凯被迫取消帝制；袁死后北洋军阀割据混战。', en: 'Yuan Shikai became provisional president in Beijing in 1912 and seized the fruits of the revolution. In 1915 he restored the monarchy; Cai E led the National Protection War and Yuan had to give it up. After his death the warlords fought for power.' },
      },
      { ev: 'huguo' },
    ],
    checks: [
      {
        q: { zh: '中国第一个全国性的资产阶级革命政党是？', en: 'Which was China’s first nationwide bourgeois revolutionary party?' },
        options: [{ zh: '兴中会', en: 'The Revive China Society' }, { zh: '光复会', en: 'The Restoration Society' }, { zh: '中国同盟会', en: 'The Tongmenghui' }, { zh: '强学会', en: 'The Society for the Study of Self-Strengthening' }],
        answer: 2, ev: 'tongmenghui',
        why: { zh: '1905年在东京成立的中国同盟会是第一个全国性的资产阶级革命政党；兴中会是孙中山建立的第一个革命团体。', en: 'The Tongmenghui, founded in Tokyo in 1905, was the first nationwide party; the Revive China Society was Sun’s first, smaller group.' },
      },
      {
        q: { zh: '辛亥革命最大的历史功绩是？', en: 'What was the 1911 Revolution’s greatest achievement?' },
        options: [{ zh: '推翻清朝统治，结束了两千多年的君主专制制度', en: 'Overthrowing the Qing and ending over two thousand years of monarchy' }, { zh: '彻底完成了反帝反封建的任务', en: 'Completing the fight against imperialism and feudalism' }, { zh: '建立了工农民主政权', en: 'Setting up a workers’ and peasants’ government' }, { zh: '使中国实现了完全独立', en: 'Making China fully independent' }],
        answer: 0, ev: 'wuchang',
        why: { zh: '辛亥革命推翻了清朝统治，结束了统治中国两千多年的君主专制制度，使民主共和观念深入人心；但没有改变中国半殖民地半封建社会的性质。', en: 'It ended the Qing and the age-old monarchy and spread the idea of a republic, but China remained semi-colonial and semi-feudal.' },
      },
      { order: ['wuxu', 'tongmenghui', 'wuchang', 'roc_found'] },
      { where: 'wuchang' },
    ],
    keys: [
      { zh: '1905年中国同盟会在东京成立，是第一个全国性的资产阶级革命政党；孙中山提出民族、民权、民生三民主义。', en: 'The Tongmenghui, founded in Tokyo in 1905, was the first nationwide bourgeois revolutionary party; Sun Yat-sen set out the Three Principles: nationalism, democracy and the people’s livelihood.' },
      { zh: '1911年武昌起义爆发，辛亥革命推翻清朝统治，结束了两千多年的君主专制制度，使民主共和观念深入人心。', en: 'The Wuchang Uprising of 1911 began the revolution that overthrew the Qing, ended the monarchy and spread the idea of a democratic republic.' },
      { zh: '1912年中华民国成立，《中华民国临时约法》是中国第一部具有资产阶级共和国宪法性质的法典；革命果实被袁世凯窃取。', en: 'The Republic of China was founded in 1912; its Provisional Constitution was China’s first republican constitution. Yuan Shikai seized the fruits of the revolution.' },
    ],
  },
  {
    id: 'g8a-4', book: 'g8a', unit: 4, minutes: 12,
    title: { zh: '新民主主义革命的开始', en: 'The beginning of the New Democratic Revolution' },
    blurb: { zh: '新文化运动、五四运动和中国共产党的诞生。', en: 'The New Culture Movement, the May Fourth Movement and the founding of the Communist Party of China.' },
    steps: [
      {
        year: 1915, at: [116.4, 36, 45],
        title: { zh: '思想文化的启蒙', en: 'A call for new thinking' },
        body: { zh: '辛亥革命后，北洋政府统治下尊孔复古的逆流泛滥。先进的知识分子认识到，必须从思想文化上启发民众的觉悟。', en: 'Under the Beiyang government a tide of Confucian revivalism swept the country. Progressive intellectuals saw that the people’s minds had to be awakened first.' },
      },
      {
        ev: 'xinwenhua',
        body: { zh: '1915年陈独秀在上海创办《青年杂志》（后改名《新青年》），新文化运动兴起。运动提倡民主和科学，反对专制和迷信；提倡新文学，鲁迅发表第一篇白话小说《狂人日记》。', en: 'Chen Duxiu founded New Youth in Shanghai in 1915 and the New Culture Movement began. It championed democracy and science against autocracy and superstition, and a new vernacular literature; Lu Xun wrote the first vernacular short story, A Madman’s Diary.' },
      },
      {
        year: 1918, at: [116.4, 39.9, 30],
        title: { zh: '马克思主义的传播', en: 'Marxism spreads' },
        body: { zh: '1917年俄国十月革命胜利。李大钊发表《庶民的胜利》《布尔什维主义的胜利》等文章，热情歌颂十月革命，宣传马克思主义成为新文化运动的主流。', en: 'The October Revolution triumphed in Russia in 1917. Li Dazhao praised it in articles such as The Victory of Bolshevism, and spreading Marxism became the main current of the New Culture Movement.' },
      },
      {
        ev: 'may4',
        body: { zh: '巴黎和会把德国在山东的权益转让给日本。1919年5月4日北京学生游行示威，提出“外争主权，内除国贼”；6月上海工人罢工，工人阶级登上政治舞台，中国代表最终拒绝在和约上签字。', en: 'The Paris Peace Conference handed Germany’s rights in Shandong to Japan. On 4 May 1919 Beijing students marched for sovereignty abroad and against traitors at home; in June Shanghai workers struck, the working class entered politics, and China refused to sign the treaty.' },
      },
      {
        ev: 'cpc_found',
        body: { zh: '1921年7月，中共一大在上海召开，最后一天转移到浙江嘉兴南湖的游船上举行，确定党的名称为中国共产党。中国共产党的诞生是开天辟地的大事变。', en: 'In July 1921 the First Congress met in Shanghai and, on its last day, on a boat on South Lake in Jiaxing; it named the party the Communist Party of China. Its founding was an epoch-making event.' },
      },
    ],
    checks: [
      {
        q: { zh: '新文化运动高举的两面大旗是？', en: 'What two banners did the New Culture Movement raise?' },
        options: [{ zh: '“自强”“求富”', en: 'Self-strengthening and wealth' }, { zh: '“扶清灭洋”', en: 'Support the Qing, destroy the foreigners' }, { zh: '“外争主权，内除国贼”', en: 'Sovereignty abroad, no traitors at home' }, { zh: '民主和科学', en: 'Democracy and science' }],
        answer: 3, ev: 'xinwenhua',
        why: { zh: '新文化运动提倡民主和科学，反对专制和迷信；“外争主权，内除国贼”是五四运动的口号。', en: 'The movement championed democracy and science; “sovereignty abroad, no traitors at home” was the May Fourth slogan.' },
      },
      {
        q: { zh: '五四运动的导火线是？', en: 'What sparked the May Fourth Movement?' },
        options: [{ zh: '袁世凯复辟帝制', en: 'Yuan Shikai’s restoration of the monarchy' }, { zh: '巴黎和会上中国外交的失败', en: 'China’s diplomatic defeat at the Paris Peace Conference' }, { zh: '俄国十月革命的胜利', en: 'The October Revolution in Russia' }, { zh: '《新青年》的创办', en: 'The founding of New Youth' }],
        answer: 1, ev: 'may4',
        why: { zh: '巴黎和会把德国在山东的权益转让给日本，中国外交失败，激起了1919年的五四运动。', en: 'The conference gave Germany’s Shandong rights to Japan; this diplomatic defeat set off the May Fourth Movement of 1919.' },
      },
      { order: ['roc_found', 'xinwenhua', 'may4', 'cpc_found'] },
      { where: 'cpc_found' },
    ],
    keys: [
      { zh: '新文化运动以民主和科学为旗帜，是一次空前的思想解放运动；十月革命后，李大钊等宣传马克思主义。', en: 'The New Culture Movement, under the banners of democracy and science, freed minds as never before; after the October Revolution Li Dazhao and others spread Marxism.' },
      { zh: '1919年五四运动是一次彻底反帝反封建的爱国运动，是中国新民主主义革命的开端。', en: 'The May Fourth Movement of 1919 was a thoroughly anti-imperialist, anti-feudal patriotic movement and the start of the New Democratic Revolution.' },
      { zh: '1921年中国共产党诞生，是开天辟地的大事变，中国革命的面貌从此焕然一新。', en: 'The Communist Party of China was founded in 1921, an epoch-making event that changed the face of the Chinese revolution.' },
    ],
  },
  {
    id: 'g8a-5', book: 'g8a', unit: 5, minutes: 14,
    title: { zh: '从国共合作到国共对立', en: 'From KMT–CPC cooperation to confrontation' },
    blurb: { zh: '国共合作与北伐，南昌起义与井冈山道路，红军长征。', en: 'The first united front and the Northern Expedition, the Nanchang Uprising and the Jinggangshan road, and the Long March.' },
    steps: [
      {
        year: 1923, at: [113.3, 26, 45],
        title: { zh: '走向合作', en: 'Towards cooperation' },
        body: { zh: '1922年中共二大制定了反帝反封建的民主革命纲领。为联合各种革命力量，中国共产党决定与孙中山领导的国民党合作，孙中山也决心改组国民党。', en: 'In 1922 the CPC’s Second Congress adopted an anti-imperialist, anti-feudal programme. To unite the revolutionary forces it decided to work with Sun Yat-sen’s Kuomintang, which Sun resolved to reorganise.' },
      },
      {
        ev: 'huangpu',
        body: { zh: '1924年1月国民党一大在广州召开，对三民主义作出新的解释，标志着国共合作正式形成。同年创办黄埔军校，为国民革命培养了大批军事人才。', en: 'The Kuomintang’s First Congress met in Guangzhou in January 1924 and reinterpreted the Three Principles, marking the start of KMT–CPC cooperation. The Whampoa Military Academy, founded that year, trained the revolution’s officers.' },
      },
      {
        ev: 'beifa',
        body: { zh: '1926年国民革命军从广东出师北伐，打倒吴佩孚、孙传芳、张作霖等北洋军阀，叶挺独立团被誉为“铁军”。1927年蒋介石发动四一二反革命政变，国民大革命失败。', en: 'In 1926 the National Revolutionary Army marched north from Guangdong against the warlords Wu Peifu, Sun Chuanfang and Zhang Zuolin; Ye Ting’s regiment was called the Iron Army. Chiang Kai-shek’s coup of 12 April 1927 ended the revolution.' },
      },
      { ev: 'nanchang' },
      { ev: 'jinggang' },
      { ev: 'gutian' },
      { ev: 'ruijin' },
      {
        ev: 'long_march',
        body: { zh: '由于第五次反“围剿”失败，1934年10月中央红军被迫撤离中央革命根据地，从瑞金等地出发，开始长征。', en: 'After the fifth campaign against the encirclements failed, the Central Red Army had to leave its base and set out from Ruijin in October 1934 on the Long March.' },
      },
      { ev: 'zunyi' },
      {
        year: 1936, at: [105.1, 35.7, 30],
        title: { zh: '长征胜利', en: 'The Long March ends in victory' },
        body: { zh: '红军四渡赤水、巧渡金沙江、强渡大渡河、飞夺泸定桥、爬雪山过草地，1935年10月中央红军到达陕北。1936年10月三大主力会师，长征胜利结束。', en: 'The Red Army crossed the Chishui four times, the Jinsha and Dadu rivers, took the Luding Bridge and passed snow mountains and marshes, reaching northern Shaanxi in October 1935. In October 1936 its three main forces met and the Long March ended in victory.' },
      },
    ],
    checks: [
      {
        q: { zh: '打响武装反抗国民党反动派第一枪的是？', en: 'Which uprising fired the first shot of armed resistance to the Kuomintang reactionaries?' },
        options: [{ zh: '秋收起义', en: 'The Autumn Harvest Uprising' }, { zh: '广州起义', en: 'The Guangzhou Uprising' }, { zh: '南昌起义', en: 'The Nanchang Uprising' }, { zh: '武昌起义', en: 'The Wuchang Uprising' }],
        answer: 2, ev: 'nanchang',
        why: { zh: '1927年8月1日周恩来等领导南昌起义，打响了武装反抗国民党反动派的第一枪，8月1日后来成为建军节。', en: 'The Nanchang Uprising, led by Zhou Enlai and others on 1 August 1927, fired the first shot; 1 August became Army Day.' },
      },
      {
        q: { zh: '“农村包围城市、武装夺取政权”革命道路的起点是？', en: 'Where did the road of “encircling the cities from the countryside” begin?' },
        options: [{ zh: '南昌起义', en: 'The Nanchang Uprising' }, { zh: '井冈山革命根据地的建立', en: 'The Jinggangshan revolutionary base' }, { zh: '遵义会议', en: 'The Zunyi Conference' }, { zh: '红军长征', en: 'The Long March' }],
        answer: 1, ev: 'jinggang',
        why: { zh: '1927年毛泽东率秋收起义部队到井冈山，建立第一个农村革命根据地，开辟了农村包围城市、武装夺取政权的道路。', en: 'Mao led the Autumn Harvest troops to Jinggangshan in 1927 and built the first rural base, opening the road of surrounding the cities and seizing power by arms.' },
      },
      { order: ['huangpu', 'nanchang', 'long_march', 'zunyi'] },
      { where: 'zunyi' },
    ],
    keys: [
      { zh: '1924年国民党一大召开，标志着国共合作正式形成；1926年北伐开始，1927年四一二反革命政变后国民大革命失败。', en: 'The Kuomintang’s First Congress of 1924 marked the start of KMT–CPC cooperation; the Northern Expedition began in 1926 and the revolution failed after the coup of 12 April 1927.' },
      { zh: '1927年南昌起义打响武装反抗国民党反动派的第一枪；井冈山革命根据地开辟了农村包围城市、武装夺取政权的道路。', en: 'The Nanchang Uprising of 1927 fired the first shot; the Jinggangshan base opened the road of encircling the cities from the countryside.' },
      { zh: '1935年遵义会议是党的历史上生死攸关的转折点；1936年红军三大主力会师，长征胜利结束。', en: 'The Zunyi Conference of 1935 was a life-or-death turning point for the Party; in 1936 the Red Army’s three main forces met and the Long March ended in victory.' },
    ],
  },
  {
    id: 'g8a-6', book: 'g8a', unit: 6, minutes: 14,
    title: { zh: '中华民族的抗日战争', en: 'The Chinese People’s War of Resistance against Japanese Aggression' },
    blurb: { zh: '从九一八事变到西安事变，全民族抗战，正面战场和敌后战场，抗战胜利。', en: 'From the September 18 Incident to the Xi’an Incident, the nationwide war, the front lines and the enemy rear, and victory.' },
    steps: [
      {
        year: 1931, at: [123.4, 42, 35],
        title: { zh: '日本侵华蓄谋已久', en: 'Japan plans its invasion' },
        body: { zh: '1929年资本主义世界爆发经济危机，日本为摆脱危机，加紧推行侵略中国的政策，企图首先占领中国东北。', en: 'When the world economic crisis broke out in 1929, Japan sought a way out by stepping up its plans to invade China, starting with the northeast.' },
      },
      {
        ev: 'sept18',
        body: { zh: '1931年9月18日夜，日本关东军炸毁沈阳柳条湖附近的一段铁路，反诬中国军队所为，进攻东北军北大营。不到半年东北三省全部沦陷。九一八事变是中国人民抗日战争的起点。', en: 'On the night of 18 September 1931 Japan’s Kwantung Army blew up a stretch of railway at Liutiaohu near Shenyang, blamed China and attacked the Beidaying barracks. Within six months the three northeastern provinces were lost. The incident began China’s War of Resistance.' },
      },
      { ev: 'dec9' },
      {
        ev: 'xian_incident',
        body: { zh: '1936年12月12日，张学良、杨虎城在西安扣押蒋介石，逼其抗日。中共派周恩来等调停，事变和平解决，成为时局转换的枢纽，十年内战基本结束。', en: 'On 12 December 1936 Zhang Xueliang and Yang Hucheng detained Chiang Kai-shek in Xi’an to force him to fight Japan. The CPC sent Zhou Enlai to mediate; the peaceful settlement turned the tide and the ten-year civil war largely ended.' },
      },
      {
        ev: 'july7',
        body: { zh: '1937年7月7日，日军炮轰宛平城，中国守军奋起抵抗。七七事变标志着日本全面侵华战争的开始，也是中国全民族抗战的开始；9月国共第二次合作，抗日民族统一战线正式形成。', en: 'On 7 July 1937 Japanese guns shelled Wanping and the Chinese garrison fought back. The incident began Japan’s all-out invasion and China’s nationwide resistance; in September the second KMT–CPC united front was formed.' },
      },
      { ev: 'songhu' },
      { ev: 'taierzhuang' },
      {
        ev: 'baituan', polity: 'jp_occ',
        body: { zh: '八路军、新四军深入敌后，开辟抗日根据地。1937年9月八路军取得平型关大捷；1940年彭德怀指挥八路军100多个团发动百团大战，这是抗战以来八路军主动出击日军规模最大的战役。', en: 'The Eighth Route Army and New Fourth Army set up bases behind enemy lines. The Eighth Route Army won at Pingxingguan in September 1937, and in 1940 Peng Dehuai led over a hundred regiments in its largest offensive of the war.' },
      },
      { ev: 'yuanzheng' },
      { ev: 'qida' },
      {
        ev: 'victory1945',
        body: { zh: '1945年8月15日日本宣布无条件投降，9月2日签署投降书。抗日战争是近代以来中国反抗外敌入侵第一次取得完全胜利的民族解放战争，台湾回到祖国怀抱。', en: 'Japan announced its unconditional surrender on 15 August 1945 and signed on 2 September. It was China’s first complete victory over a foreign invader in modern times, and Taiwan returned to China.' },
      },
    ],
    checks: [
      {
        q: { zh: '标志着中国全民族抗战开始的事件是？', en: 'Which event began China’s nationwide War of Resistance?' },
        options: [{ zh: '九一八事变', en: 'The September 18 Incident' }, { zh: '西安事变', en: 'The Xi’an Incident' }, { zh: '淞沪会战', en: 'The Battle of Shanghai' }, { zh: '七七事变', en: 'The Marco Polo Bridge Incident' }],
        answer: 3, ev: 'july7',
        why: { zh: '1937年七七事变是日本全面侵华战争的开始，也是中国全民族抗战的开始；九一八事变是局部抗战的开始。', en: 'The Marco Polo Bridge Incident of 1937 began the all-out war and nationwide resistance; the September 18 Incident began the regional resistance.' },
      },
      {
        q: { zh: '抗战以来正面战场取得的最大胜利是？', en: 'What was the greatest victory on the front lines of the war?' },
        options: [{ zh: '台儿庄战役', en: 'The Battle of Tai’erzhuang' }, { zh: '平型关大捷', en: 'The victory at Pingxingguan' }, { zh: '百团大战', en: 'The Hundred Regiments Offensive' }, { zh: '淞沪会战', en: 'The Battle of Shanghai' }],
        answer: 0, ev: 'taierzhuang',
        why: { zh: '1938年李宗仁指挥台儿庄战役，歼灭日军1万余人；平型关大捷和百团大战属于敌后战场。', en: 'Li Zongren’s army destroyed over 10,000 Japanese troops at Tai’erzhuang in 1938; Pingxingguan and the Hundred Regiments were behind enemy lines.' },
      },
      { order: ['sept18', 'xian_incident', 'july7', 'baituan'] },
      { where: 'taierzhuang' },
    ],
    keys: [
      { zh: '1931年九一八事变是中国人民抗日战争的起点；1936年西安事变和平解决，成为时局转换的枢纽。', en: 'The September 18 Incident of 1931 began China’s War of Resistance; the peaceful settlement of the Xi’an Incident in 1936 turned the tide.' },
      { zh: '1937年七七事变标志着全民族抗战开始；台儿庄战役是正面战场的重大胜利，平型关大捷和百团大战是敌后战场的著名战役。', en: 'The 1937 Marco Polo Bridge Incident began nationwide resistance; Tai’erzhuang was a great front-line victory, Pingxingguan and the Hundred Regiments famous battles behind enemy lines.' },
      { zh: '1945年抗日战争胜利，是近代以来中国反抗外敌入侵第一次取得完全胜利的民族解放战争。', en: 'Victory in 1945 was China’s first complete victory against foreign invasion in modern times.' },
    ],
  },
  {
    id: 'g8a-7', book: 'g8a', unit: 7, minutes: 12,
    title: { zh: '人民解放战争', en: 'The War of Liberation' },
    blurb: { zh: '重庆谈判与内战爆发，挺进大别山，三大战役和渡江战役。', en: 'The Chongqing talks and the outbreak of civil war, the drive into the Dabie Mountains, the three great campaigns and the Yangtze crossing.' },
    steps: [
      {
        year: 1945, at: [110, 32, 50],
        title: { zh: '和平还是内战', en: 'Peace or civil war' },
        body: { zh: '抗日战争胜利后，全国人民渴望和平、民主，建设新中国。蒋介石却一面准备内战，一面三次电邀毛泽东到重庆“共商国是”。', en: 'After the victory the whole nation longed for peace and democracy. Chiang Kai-shek prepared for civil war while inviting Mao Zedong three times to Chongqing for talks.' },
      },
      { ev: 'chongqing_talks' },
      {
        year: 1947, at: [115.5, 31.2, 30],
        title: { zh: '千里跃进大别山', en: 'The drive into the Dabie Mountains' },
        body: { zh: '1947年6月，刘伯承、邓小平率领晋冀鲁豫解放军主力强渡黄河，千里跃进大别山，揭开了人民解放军战略进攻的序幕。', en: 'In June 1947 Liu Bocheng and Deng Xiaoping led their main force across the Yellow River and deep into the Dabie Mountains, opening the People’s Liberation Army’s strategic offensive.' },
      },
      { ev: 'dabieshan' },
      {
        ev: 'sanda',
        body: { zh: '1948年9月至1949年1月，人民解放军发动辽沈、淮海、平津三大战役，共歼灭和改编国民党军队150多万人，基本上消灭了国民党军队的主力。', en: 'From September 1948 to January 1949 the PLA fought the Liaoshen, Huaihai and Pingjin campaigns, destroying or absorbing over 1.5 million Kuomintang troops – most of its main forces.' },
      },
      {
        year: 1949, at: [113.94, 38.35, 25],
        title: { zh: '七届二中全会', en: 'The Second Plenum at Xibaipo' },
        body: { zh: '1949年3月，中共七届二中全会在河北西柏坡召开，决定把党的工作重心由乡村转移到城市，并要求全党继续保持谦虚谨慎、艰苦奋斗的作风。', en: 'In March 1949 the CPC’s Second Plenum met at Xibaipo in Hebei. It moved the Party’s focus from the countryside to the cities and urged members to stay modest, prudent and hard-working.' },
      },
      {
        ev: 'dujiang',
        body: { zh: '1949年4月21日，人民解放军百万大军在千里战线上横渡长江，23日占领南京，宣告了延续22年的国民党反动统治的覆灭。', en: 'On 21 April 1949 a million PLA troops crossed the Yangtze along a vast front; on the 23rd they took Nanjing, ending 22 years of Kuomintang rule.' },
      },
    ],
    checks: [
      {
        q: { zh: '揭开人民解放军战略进攻序幕的是？', en: 'What opened the PLA’s strategic offensive?' },
        options: [{ zh: '重庆谈判', en: 'The Chongqing talks' }, { zh: '刘邓大军挺进大别山', en: 'Liu and Deng’s drive into the Dabie Mountains' }, { zh: '辽沈战役', en: 'The Liaoshen campaign' }, { zh: '渡江战役', en: 'The Yangtze crossing' }],
        answer: 1,
        why: { zh: '1947年6月刘邓大军强渡黄河、千里跃进大别山，揭开了战略进攻的序幕。', en: 'In June 1947 Liu and Deng crossed the Yellow River and pushed into the Dabie Mountains, opening the strategic offensive.' },
      },
      {
        q: { zh: '标志着延续22年的国民党反动统治覆灭的是？', en: 'What marked the end of 22 years of Kuomintang rule?' },
        options: [{ zh: '辽沈战役结束', en: 'The end of the Liaoshen campaign' }, { zh: '北平和平解放', en: 'The peaceful liberation of Beiping' }, { zh: '七届二中全会召开', en: 'The Second Plenum at Xibaipo' }, { zh: '人民解放军占领南京', en: 'The PLA’s capture of Nanjing' }],
        answer: 3, ev: 'dujiang',
        why: { zh: '1949年4月渡江战役中人民解放军占领国民政府首都南京，宣告了国民党反动统治的覆灭。', en: 'Taking Nanjing, the Nationalist capital, in the Yangtze crossing of April 1949 ended Kuomintang rule.' },
      },
      { order: ['july7', 'chongqing_talks', 'sanda', 'dujiang'] },
      { where: 'dujiang' },
    ],
    keys: [
      { zh: '1945年重庆谈判签订“双十协定”；1946年6月国民党军队大举围攻中原解放区，全面内战爆发。', en: 'The Chongqing talks of 1945 produced the Double Tenth Agreement; in June 1946 the Kuomintang attacked the Central Plains Liberated Area and full civil war began.' },
      { zh: '1947年刘邓大军挺进大别山，揭开战略进攻的序幕；三大战役基本上消灭了国民党军队的主力。', en: 'Liu and Deng’s drive into the Dabie Mountains in 1947 opened the strategic offensive; the three great campaigns destroyed most of the Kuomintang’s main forces.' },
      { zh: '1949年4月渡江战役，人民解放军占领南京，延续22年的国民党反动统治覆灭。', en: 'In the Yangtze crossing of April 1949 the PLA took Nanjing, ending 22 years of Kuomintang rule.' },
    ],
  },
  {
    id: 'g8a-8', book: 'g8a', unit: 8, minutes: 12,
    title: { zh: '近代经济、社会生活与教育文化事业的发展', en: 'Modern economy, society, education and culture' },
    blurb: { zh: '实业救国与民族工业，铁路与社会习俗的变化，新式教育、出版和文艺。', en: 'Industry to save the nation, railways and changing customs, new schools, publishing and the arts.' },
    steps: [
      {
        year: 1895, at: [117, 32, 50],
        title: { zh: '近代社会的变化', en: 'A changing society' },
        body: { zh: '鸦片战争后，西方的机器生产、交通工具和生活方式逐渐传入中国，中国近代经济、社会生活和教育文化发生了深刻变化。', en: 'After the Opium War Western machines, transport and ways of life gradually reached China, changing its economy, daily life, education and culture.' },
      },
      {
        ev: 'zhang_jian',
        body: { zh: '甲午战争后，状元张謇在家乡江苏南通创办大生纱厂，走上“实业救国”的道路；他还兴办学校，推动了近代民族工业和教育的发展。', en: 'After the war of 1894 Zhang Jian, top scholar of the imperial examinations, founded the Dasheng cotton mill in his home town of Nantong to save the nation through industry, and opened schools as well.' },
      },
      { ev: 'jingzhang' },
      {
        year: 1912, at: [118.78, 32.06, 35],
        title: { zh: '社会习俗的变化', en: 'New customs' },
        body: { zh: '中华民国成立后，人们剪掉辫子，劝禁缠足，以鞠躬、握手代替跪拜，中山装、西装逐渐流行，社会风气趋向文明。', en: 'After the Republic was founded men cut off their queues, foot-binding was discouraged, bows and handshakes replaced kowtows, and Sun Yat-sen suits and Western dress spread.' },
      },
      {
        year: 1915, at: [121.47, 31.23, 25],
        title: { zh: '民族工业的“短暂的春天”', en: 'A “brief spring” for national industry' },
        body: { zh: '中华民国成立后，政府鼓励兴办实业；第一次世界大战期间，欧洲列强暂时放松了对中国的经济侵略，中国民族工业迎来了“短暂的春天”。', en: 'The new Republic encouraged industry, and during the First World War the European powers eased their economic grip on China, giving Chinese-owned industry a brief spring.' },
      },
      { ev: 'jingshi_dxt' },
      {
        ev: 'keju_end',
        body: { zh: '1862年清政府在北京设立京师同文馆；1898年创办京师大学堂；1905年清政府废除科举制度，新式学堂迅速发展起来。', en: 'The Qing opened the Tongwen Guan language school in Beijing in 1862 and the Imperial University of Peking in 1898; in 1905 it abolished the imperial examinations, and new-style schools spread fast.' },
      },
      {
        ev: 'commercial_press',
        body: { zh: '1897年商务印书馆在上海创办，出版新式教科书、工具书和大量中外书籍；《申报》等近代报刊也在上海兴起，传播了新知识、新思想。', en: 'The Commercial Press was founded in Shanghai in 1897 and published new textbooks, reference works and many Chinese and foreign books; newspapers such as Shenbao also flourished in Shanghai, spreading new ideas.' },
      },
      {
        year: 1935, at: [116, 34, 50],
        title: { zh: '文学艺术', en: 'Literature and the arts' },
        body: { zh: '鲁迅、茅盾、巴金、老舍、曹禺等创作了大量优秀作品。聂耳作曲的《义勇军进行曲》后来成为国歌，冼星海创作了《黄河大合唱》。', en: 'Lu Xun, Mao Dun, Ba Jin, Lao She and Cao Yu wrote many great works. Nie Er composed the March of the Volunteers, later the national anthem, and Xian Xinghai wrote the Yellow River Cantata.' },
      },
    ],
    checks: [
      {
        q: { zh: '张謇创办大生纱厂，体现的思想主张是？', en: 'What idea did Zhang Jian’s Dasheng cotton mill embody?' },
        options: [{ zh: '“师夷长技以制夷”', en: 'Learning from the foreigners to resist them' }, { zh: '“中体西用”', en: 'Chinese learning as the base, Western learning for use' }, { zh: '“实业救国”', en: 'Saving the nation through industry' }, { zh: '民主和科学', en: 'Democracy and science' }],
        answer: 2,
        why: { zh: '甲午战后张謇弃官从商，在南通创办大生纱厂，希望通过发展实业来救国，即“实业救国”。', en: 'After 1894 Zhang Jian left officialdom for business, hoping that building industry would save China.' },
      },
      {
        q: { zh: '中国人自行设计和建造的第一条铁路干线是？', en: 'Which was the first trunk railway designed and built by Chinese engineers?' },
        options: [{ zh: '京张铁路', en: 'The Beijing–Zhangjiakou Railway' }, { zh: '吴淞铁路', en: 'The Woosung Railway' }, { zh: '唐胥铁路', en: 'The Tangshan–Xugezhuang Railway' }, { zh: '粤汉铁路', en: 'The Canton–Hankow Railway' }],
        answer: 0, ev: 'jingzhang',
        why: { zh: '1909年詹天佑主持修建的京张铁路通车，是中国人自行设计和建造的第一条铁路干线。', en: 'The Beijing–Zhangjiakou line, built under Zhan Tianyou and opened in 1909, was the first trunk line designed and built by Chinese.' },
      },
      { order: ['yangwu', 'wuxu', 'jingzhang', 'xinwenhua'] },
      { where: 'jingzhang' },
    ],
    keys: [
      { zh: '甲午战后张謇在南通创办大生纱厂，走“实业救国”道路；一战期间中国民族工业迎来“短暂的春天”。', en: 'After 1894 Zhang Jian founded the Dasheng mill in Nantong to save the nation through industry; national industry had a brief spring during the First World War.' },
      { zh: '1909年詹天佑主持修建的京张铁路通车，是中国人自行设计和建造的第一条铁路干线；民国初年剪辫易服，社会习俗趋向文明。', en: 'Zhan Tianyou’s Beijing–Zhangjiakou Railway of 1909 was the first trunk line built by Chinese; in the early Republic queues were cut and customs modernised.' },
      { zh: '1862年设京师同文馆，1898年创办京师大学堂，1905年废除科举制度；1897年商务印书馆在上海创办。', en: 'The Tongwen Guan opened in 1862 and the Imperial University in 1898, the examinations ended in 1905, and the Commercial Press was founded in Shanghai in 1897.' },
    ],
  },
];
