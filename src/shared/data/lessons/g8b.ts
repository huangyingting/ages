/** 八年级下册 — 1949 to today. */
import type { Lesson } from '../types.ts';

export const G8B: Lesson[] = [
  {
    id: 'g8b-1', book: 'g8b', unit: 1, minutes: 12,
    title: { zh: '中华人民共和国的成立和巩固', en: 'Founding and consolidation of the People’s Republic of China' },
    blurb: { zh: '开国大典、西藏和平解放、抗美援朝和土地改革。', en: 'The founding ceremony, the peaceful liberation of Tibet, the Korean War and land reform.' },
    steps: [
      {
        year: 1949, at: [116.4, 39.9, 25],
        title: { zh: '新政协召开', en: 'The People’s Political Consultative Conference' },
        body: { zh: '1949年9月，中国人民政治协商会议第一届全体会议在北平召开，通过了起临时宪法作用的《共同纲领》，选举毛泽东为中央人民政府主席，决定定都北平并改名北京。', en: 'In September 1949 the first Chinese People’s Political Consultative Conference met in Beiping. It adopted the Common Programme as a provisional constitution, elected Mao Zedong chairman and made Beiping, renamed Beijing, the capital.' },
      },
      {
        ev: 'founding', polity: 'prc',
        body: { zh: '1949年10月1日，首都30万军民在天安门广场隆重举行开国大典，毛泽东宣告中华人民共和国中央人民政府成立。新中国的成立开辟了中国历史的新纪元。', en: 'On 1 October 1949, before 300,000 people in Tiananmen Square, Mao Zedong proclaimed the Central People’s Government of the People’s Republic of China. Its founding opened a new era in Chinese history.' },
      },
      { ev: 'tibet1951' },
      {
        ev: 'kangmei',
        body: { zh: '朝鲜内战爆发后，美国派兵侵略朝鲜，战火烧到鸭绿江边。1950年10月，中国人民志愿军在彭德怀率领下赴朝作战，涌现出黄继光、邱少云等英雄。1953年7月签订停战协定。', en: 'When war broke out in Korea the United States sent troops and the fighting reached the Yalu. In October 1950 the Chinese People’s Volunteers under Peng Dehuai entered Korea; heroes such as Huang Jiguang and Qiu Shaoyun emerged. An armistice was signed in July 1953.' },
      },
      { ev: 'tugai' },
    ],
    checks: [
      {
        q: { zh: '新中国成立前夕通过的、起临时宪法作用的文件是？', en: 'Which document served as a provisional constitution when the PRC was founded?' },
        options: [{ zh: '《中华民国临时约法》', en: 'The Provisional Constitution of the Republic of China' }, { zh: '《中国人民政治协商会议共同纲领》', en: 'The Common Programme of the CPPCC' }, { zh: '《中华人民共和国宪法》', en: 'The Constitution of the PRC' }, { zh: '《中华人民共和国土地改革法》', en: 'The Land Reform Law' }],
        answer: 1, ev: 'founding',
        why: { zh: '1949年9月新政协通过的《共同纲领》起临时宪法作用；第一部宪法1954年才通过。', en: 'The Common Programme, adopted in September 1949, served as a provisional constitution; the first constitution came only in 1954.' },
      },
      {
        q: { zh: '土地改革完成的最重要意义是？', en: 'What was the main significance of completing land reform?' },
        options: [{ zh: '彻底摧毁了两千多年的封建土地制度', en: 'It destroyed the two-thousand-year-old feudal land system' }, { zh: '建立了社会主义基本制度', en: 'It established the basic socialist system' }, { zh: '实现了农业机械化', en: 'It mechanised farming' }, { zh: '完成了对农业的社会主义改造', en: 'It completed the socialist transformation of agriculture' }],
        answer: 0, ev: 'tugai',
        why: { zh: '1952年底土地改革基本完成，彻底摧毁了封建土地制度，农民成为土地的主人；社会主义基本制度到1956年才初步建立。', en: 'By the end of 1952 land reform had destroyed the feudal land system and made peasants owners of the land; the socialist system came only in 1956.' },
      },
      { order: ['sanda', 'founding', 'kangmei', 'tibet1951'] },
      { where: 'kangmei' },
    ],
    keys: [
      { zh: '1949年10月1日中华人民共和国成立，中国人民从此站起来了，开辟了中国历史的新纪元。', en: 'The People’s Republic of China was founded on 1 October 1949: the Chinese people had stood up, and a new era in Chinese history began.' },
      { zh: '1950年10月中国人民志愿军赴朝作战，抗美援朝战争的胜利保卫了新中国的安全，提高了中国的国际威望。', en: 'The Chinese People’s Volunteers entered Korea in October 1950; victory safeguarded the new China and raised its standing in the world.' },
      { zh: '1950年颁布《土地改革法》，1952年底土地改革基本完成，彻底摧毁了封建土地制度，农民成为土地的主人。', en: 'Under the 1950 Land Reform Law, land reform was largely complete by the end of 1952; the feudal land system was destroyed and peasants owned the land.' },
    ],
  },
  {
    id: 'g8b-2', book: 'g8b', unit: 2, minutes: 14,
    title: { zh: '社会主义制度的建立与社会主义建设的探索', en: 'Establishing socialism and exploring socialist construction' },
    blurb: { zh: '“一五”计划、第一部宪法、三大改造，以及社会主义建设的曲折探索。', en: 'The First Five-Year Plan, the first constitution, the socialist transformation, and the winding search for a way to build socialism.' },
    steps: [
      {
        year: 1953, at: [116, 36, 50],
        title: { zh: '过渡时期总路线', en: 'The general line for the transition' },
        body: { zh: '国民经济恢复后，1953年党提出过渡时期总路线：逐步实现国家的社会主义工业化，并逐步实现对农业、手工业和资本主义工商业的社会主义改造。', en: 'With the economy restored, in 1953 the Party set out the general line for the transition: gradually industrialise the country and transform agriculture, handicrafts and capitalist industry and commerce along socialist lines.' },
      },
      {
        ev: 'five_year',
        body: { zh: '1953—1957年“一五”计划集中主要力量发展重工业：长春第一汽车制造厂生产出第一辆国产汽车，武汉长江大桥建成。1957年计划超额完成，我国开始改变工业落后的面貌。', en: 'The First Five-Year Plan of 1953–1957 concentrated on heavy industry: Changchun’s First Automobile Works built China’s first lorry and the Wuhan Yangtze River Bridge was completed. The plan was overfulfilled in 1957 and China’s industrial backwardness began to change.' },
      },
      { ev: 'constitution54' },
      { ev: 'sanda_gaizao' },
      {
        year: 1956, at: [116.4, 39.9, 30],
        title: { zh: '中共八大', en: 'The Eighth Party Congress' },
        body: { zh: '1956年中共八大指出，国内主要矛盾已不再是工人阶级和资产阶级的矛盾，全国人民的主要任务是集中力量发展社会生产力。', en: 'The Eighth Party Congress of 1956 declared that the main contradiction was no longer between the working class and the bourgeoisie, and that the nation’s main task was to develop the productive forces.' },
      },
      {
        ev: 'dayuejin',
        body: { zh: '1958年开展的“大跃进”和人民公社化运动急于求成，忽视了客观经济规律，以高指标、浮夸风和“共产风”为主要标志的“左”倾错误泛滥，国民经济遭到严重困难。', en: 'The Great Leap Forward and the people’s communes of 1958 rushed ahead and ignored economic laws; leftist errors – inflated targets, exaggeration and levelling – brought the economy into grave difficulty.' },
      },
      { ev: 'daqing' },
      { ev: 'wenge' },
    ],
    checks: [
      {
        q: { zh: '1956年底三大改造基本完成，标志着？', en: 'What did completing the socialist transformation in late 1956 mark?' },
        options: [{ zh: '中华人民共和国成立', en: 'The founding of the PRC' }, { zh: '国民经济恢复任务完成', en: 'The recovery of the national economy' }, { zh: '我国初步建立起社会主义基本制度', en: 'The basic socialist system was established in China' }, { zh: '社会主义市场经济体制建立', en: 'A socialist market economy was set up' }],
        answer: 2, ev: 'sanda_gaizao',
        why: { zh: '三大改造完成，生产资料私有制基本转变为社会主义公有制，我国初步建立起社会主义基本制度，进入社会主义初级阶段。', en: 'Private ownership of the means of production became public ownership: the basic socialist system was set up and China entered the primary stage of socialism.' },
      },
      {
        q: { zh: '“一五”计划的基本任务是？', en: 'What was the main task of the First Five-Year Plan?' },
        options: [{ zh: '优先发展轻工业', en: 'Light industry first' }, { zh: '大力发展农业', en: 'Farming first' }, { zh: '扩大对外贸易', en: 'Expanding foreign trade' }, { zh: '集中主要力量发展重工业', en: 'Concentrating on heavy industry' }],
        answer: 3, ev: 'five_year',
        why: { zh: '为建立国家工业化的初步基础，“一五”计划集中主要力量发展重工业。', en: 'To lay the first foundations of industrialisation, the plan put its main effort into heavy industry.' },
      },
      { order: ['five_year', 'sanda_gaizao', 'daqing', 'wenge'] },
      { where: 'five_year', why: { zh: '长春第一汽车制造厂是“一五”计划的代表性成就。', en: 'The First Automobile Works in Changchun was a landmark of the First Five-Year Plan.' } },
    ],
    keys: [
      { zh: '1953—1957年“一五”计划集中主要力量发展重工业；1954年第一部宪法通过，人民代表大会制度成为我国的根本政治制度。', en: 'The First Five-Year Plan (1953–1957) focused on heavy industry; the 1954 Constitution made the people’s congresses China’s fundamental political system.' },
      { zh: '1956年底三大改造基本完成，我国初步建立起社会主义基本制度，进入社会主义初级阶段。', en: 'The socialist transformation was largely complete by the end of 1956; China established the basic socialist system and entered the primary stage of socialism.' },
      { zh: '社会主义建设在探索中曲折前进：“大跃进”和“文化大革命”带来严重挫折，同时取得大庆油田等成就，涌现出王进喜、焦裕禄、邓稼先等楷模。', en: 'Socialist construction advanced along a winding path: the Great Leap Forward and the Cultural Revolution were grave setbacks, while the Daqing oilfield and models such as Wang Jinxi, Jiao Yulu and Deng Jiaxian marked its achievements.' },
    ],
  },
  {
    id: 'g8b-3', book: 'g8b', unit: 3, minutes: 14,
    title: { zh: '中国特色社会主义道路', en: 'The path of socialism with Chinese characteristics' },
    blurb: { zh: '十一届三中全会、农村和城市改革、对外开放，到中国特色社会主义进入新时代。', en: 'The Third Plenum, reform in the countryside and the cities, opening up, and the new era of socialism with Chinese characteristics.' },
    steps: [
      {
        year: 1978, at: [116.4, 39.9, 40],
        title: { zh: '历史的转折关头', en: 'At a turning point' },
        body: { zh: '1976年10月“文化大革命”结束，中国面临向何处去的重大问题。1978年展开的关于真理标准问题的讨论，为党重新确立马克思主义思想路线作了准备。', en: 'When the Cultural Revolution ended in October 1976, China had to decide which way to go. The 1978 debate on the criterion of truth prepared the Party to restore a Marxist line of thought.' },
      },
      {
        ev: 'third_plenum',
        body: { zh: '1978年12月中共十一届三中全会重新确立解放思想、实事求是的思想路线，把党和国家的工作中心转移到经济建设上来，作出实行改革开放的历史性决策，是新中国成立以来党的历史上具有深远意义的伟大转折。', en: 'The Third Plenum of the 11th Central Committee in December 1978 restored the line of freeing minds and seeking truth from facts, shifted the focus to economic construction and decided on reform and opening up – a great turning point of far-reaching significance.' },
      },
      { ev: 'xiaogang' },
      {
        year: 1984, at: [118, 32, 45],
        title: { zh: '城市经济体制改革', en: 'Reform in the cities' },
        body: { zh: '1984年起，经济体制改革的重点从农村转向城市，中心环节是增强企业特别是国有大中型企业的活力，实行政企分开、所有权与经营权分离。', en: 'From 1984 reform moved from the countryside to the cities. Its core was to invigorate enterprises, above all large and medium state firms, by separating government from business and ownership from management.' },
      },
      { ev: 'shenzhen' },
      { ev: 'pudong' },
      { ev: 'nanxun' },
      { ev: 'wto' },
      {
        year: 2017, at: [116.4, 39.9, 40],
        title: { zh: '新时代', en: 'A new era' },
        body: { zh: '2012年中共十八大以来，中国特色社会主义事业取得历史性成就。2017年中共十九大宣布中国特色社会主义进入新时代，确立了习近平新时代中国特色社会主义思想。', en: 'Since the 18th Party Congress of 2012 socialism with Chinese characteristics has made historic achievements. In 2017 the 19th Congress declared that it had entered a new era and adopted Xi Jinping Thought on Socialism with Chinese Characteristics for a New Era.' },
      },
    ],
    checks: [
      {
        q: { zh: '新中国成立以来党的历史上具有深远意义的伟大转折是？', en: 'Which meeting was the great turning point of far-reaching significance in the Party’s history since 1949?' },
        options: [{ zh: '中共八大', en: 'The Eighth Party Congress' }, { zh: '中共十四大', en: 'The 14th Party Congress' }, { zh: '中共十一届三中全会', en: 'The Third Plenum of the 11th Central Committee' }, { zh: '中共十九大', en: 'The 19th Party Congress' }],
        answer: 2, ev: 'third_plenum',
        why: { zh: '1978年十一届三中全会把工作中心转移到经济建设上来，作出改革开放的决策，开启了改革开放和社会主义现代化建设新时期。', en: 'The 1978 Third Plenum shifted the focus to economic construction and decided on reform and opening up, beginning a new period of modernisation.' },
      },
      {
        q: { zh: '我国农村经济体制改革的主要内容是？', en: 'What was the core of rural economic reform in China?' },
        options: [{ zh: '实行家庭联产承包责任制', en: 'The household responsibility system' }, { zh: '建立人民公社', en: 'Setting up people’s communes' }, { zh: '增强国有企业活力', en: 'Invigorating state enterprises' }, { zh: '设立经济特区', en: 'Creating special economic zones' }],
        answer: 0, ev: 'xiaogang',
        why: { zh: '1978年安徽凤阳小岗村率先实行“包产到户”，家庭联产承包责任制调动了农民的生产积极性；增强企业活力是城市改革的中心环节。', en: 'Xiaogang village in Anhui led the way in 1978; the household responsibility system fired peasants’ enthusiasm. Invigorating enterprises was the core of urban reform.' },
      },
      { order: ['third_plenum', 'shenzhen', 'nanxun', 'wto'] },
      { where: 'xiaogang' },
    ],
    keys: [
      { zh: '1978年十一届三中全会把工作中心转移到经济建设上来，作出改革开放的决策，是新中国成立以来党的历史上具有深远意义的伟大转折。', en: 'The Third Plenum of 1978 shifted the focus to economic construction and decided on reform and opening up – a great turning point in the Party’s history since 1949.' },
      { zh: '农村改革以家庭联产承包责任制为主要内容，城市改革的中心环节是增强企业活力；1980年设立深圳、珠海、汕头、厦门四个经济特区。', en: 'Rural reform centred on the household responsibility system and urban reform on invigorating enterprises; in 1980 Shenzhen, Zhuhai, Shantou and Xiamen became special economic zones.' },
      { zh: '1992年邓小平南方谈话，中共十四大确立建立社会主义市场经济体制的改革目标；2001年中国加入世界贸易组织。', en: 'After Deng Xiaoping’s Southern Tour of 1992, the 14th Party Congress set the goal of a socialist market economy; China joined the WTO in 2001.' },
    ],
  },
  {
    id: 'g8b-4', book: 'g8b', unit: 4, minutes: 12,
    title: { zh: '民族团结与祖国统一', en: 'Ethnic unity and national reunification' },
    blurb: { zh: '民族区域自治制度，“一国两制”与香港、澳门回归，海峡两岸的交往。', en: 'Regional ethnic autonomy, “one country, two systems” and the return of Hong Kong and Macao, and ties across the Taiwan Strait.' },
    steps: [
      {
        year: 1947, at: [104, 36, 60],
        title: { zh: '统一的多民族国家', en: 'A unified multi-ethnic country' },
        body: { zh: '我国是统一的多民族国家，共有56个民族。1947年，内蒙古率先实行民族区域自治；新中国成立后，国家坚持民族平等、民族团结和各民族共同繁荣，在少数民族聚居的地方普遍实行区域自治。', en: 'China is a unified multi-ethnic country of 56 ethnic groups. Inner Mongolia led the way with regional autonomy in 1947; after 1949 the new state upheld ethnic equality, unity and common prosperity, with autonomy wherever minorities live in compact communities.' },
      },
      { ev: 'neimenggu' },
      {
        year: 1984, at: [114.1, 22.4, 25],
        title: { zh: '“一国两制”', en: '“One country, two systems”' },
        body: { zh: '为解决台湾、香港和澳门问题，邓小平提出“一个国家，两种制度”的伟大构想。1984年中英两国政府签署关于香港问题的联合声明，1987年中葡签署关于澳门问题的联合声明。', en: 'To settle the questions of Taiwan, Hong Kong and Macao, Deng Xiaoping proposed “one country, two systems”. China and Britain signed the Joint Declaration on Hong Kong in 1984, and China and Portugal one on Macao in 1987.' },
      },
      {
        ev: 'hk_return',
        body: { zh: '1997年7月1日零时，中国政府对香港恢复行使主权，香港特别行政区成立，香港回到祖国怀抱。', en: 'At midnight on 1 July 1997 China resumed sovereignty over Hong Kong; the Hong Kong Special Administrative Region was established and Hong Kong returned to the motherland.' },
      },
      {
        ev: 'macao_return', polity: 'prc',
        body: { zh: '1999年12月20日，中国政府对澳门恢复行使主权，澳门特别行政区成立。香港、澳门的回归是“一国两制”的成功实践。', en: 'On 20 December 1999 China resumed sovereignty over Macao and the Macao Special Administrative Region was established. The returns of Hong Kong and Macao put “one country, two systems” into successful practice.' },
      },
      { ev: 'cross_strait' },
    ],
    checks: [
      {
        q: { zh: '我国第一个省级民族自治区是？', en: 'Which was China’s first provincial-level autonomous region?' },
        options: [{ zh: '新疆维吾尔自治区', en: 'Xinjiang Uygur Autonomous Region' }, { zh: '西藏自治区', en: 'Tibet Autonomous Region' }, { zh: '广西壮族自治区', en: 'Guangxi Zhuang Autonomous Region' }, { zh: '内蒙古自治区', en: 'Inner Mongolia Autonomous Region' }],
        answer: 3, ev: 'neimenggu',
        why: { zh: '1947年内蒙古自治区成立，是我国第一个省级民族自治区；新疆（1955）、广西（1958）、西藏（1965）自治区随后成立。', en: 'Inner Mongolia became autonomous in 1947, the first at provincial level; Xinjiang (1955), Guangxi (1958) and Tibet (1965) followed.' },
      },
      {
        q: { zh: '香港、澳门顺利回归，是哪一构想的成功实践？', en: 'The returns of Hong Kong and Macao put which idea into practice?' },
        options: [{ zh: '和平共处五项原则', en: 'The Five Principles of Peaceful Coexistence' }, { zh: '“一国两制”', en: '“One country, two systems”' }, { zh: '“求同存异”', en: 'Seeking common ground while setting aside differences' }, { zh: '民族区域自治', en: 'Regional ethnic autonomy' }],
        answer: 1, ev: 'hk_return',
        why: { zh: '邓小平提出的“一国两制”构想首先在香港、澳门问题上得到成功实践。', en: 'Deng Xiaoping’s idea of “one country, two systems” was first put into practice with Hong Kong and Macao.' },
      },
      { order: ['neimenggu', 'cross_strait', 'hk_return', 'macao_return'] },
      { where: 'macao_return' },
    ],
    keys: [
      { zh: '民族区域自治制度是我国的一项基本政治制度；1947年内蒙古自治区成立，是第一个省级民族自治区。', en: 'Regional ethnic autonomy is one of China’s basic political systems; Inner Mongolia, autonomous from 1947, was the first provincial-level autonomous region.' },
      { zh: '邓小平提出“一国两制”构想；1997年7月1日香港回归，1999年12月20日澳门回归。', en: 'Deng Xiaoping proposed “one country, two systems”; Hong Kong returned on 1 July 1997 and Macao on 20 December 1999.' },
      { zh: '1992年海协会与海基会达成体现一个中国原则的“九二共识”；2008年两岸实现全面直接双向“三通”。', en: 'In 1992 the two cross-Strait associations reached the 1992 Consensus on the one-China principle; in 2008 full direct links in mail, trade and transport were achieved.' },
    ],
  },
  {
    id: 'g8b-5', book: 'g8b', unit: 5, minutes: 12,
    title: { zh: '国防建设与外交成就', en: 'National defence and diplomatic achievements' },
    blurb: { zh: '钢铁长城与“两弹一星”，和平共处五项原则，重返联合国与中美建交。', en: 'A great wall of steel and “two bombs, one satellite”, the Five Principles, the UN seat and relations with the United States.' },
    steps: [
      {
        year: 1950, at: [116.4, 39.9, 50],
        title: { zh: '钢铁长城', en: 'A great wall of steel' },
        body: { zh: '1949年4月人民海军成立，11月人民空军成立。人民解放军由单一的陆军逐步发展成为诸军兵种合成的强大军队，成为保卫祖国的钢铁长城。', en: 'The People’s Navy was founded in April 1949 and the Air Force in November. The PLA grew from an army of foot soldiers into combined services – a great wall of steel guarding the country.' },
      },
      { ev: 'liangdan' },
      {
        year: 2012, at: [121.61, 38.91, 25],
        title: { zh: '辽宁舰', en: 'The carrier Liaoning' },
        body: { zh: '2012年我国第一艘航空母舰“辽宁舰”正式交付海军，标志着我国国防现代化建设迈上了新的台阶。', en: 'In 2012 China’s first aircraft carrier, the Liaoning, entered service with the navy, a new step in the modernisation of national defence.' },
      },
      { ev: 'bandung' },
      { ev: 'un_seat' },
      { ev: 'sco' },
      {
        ev: 'belt_road',
        body: { zh: '2013年我国提出共建“一带一路”倡议，同沿线国家共商共建共享，积极推动构建人类命运共同体。', en: 'In 2013 China proposed the Belt and Road Initiative, to be planned, built and shared with partner countries, and works to build a community with a shared future for mankind.' },
      },
    ],
    checks: [
      {
        q: { zh: '1953年周恩来提出、后来成为处理国与国关系基本准则的是？', en: 'What did Zhou Enlai propose in 1953 that became a basic norm of international relations?' },
        options: [{ zh: '“一国两制”', en: '“One country, two systems”' }, { zh: '和平共处五项原则', en: 'The Five Principles of Peaceful Coexistence' }, { zh: '“求同存异”方针', en: 'Seeking common ground while setting aside differences' }, { zh: '“一带一路”倡议', en: 'The Belt and Road Initiative' }],
        answer: 1, ev: 'bandung',
        why: { zh: '1953年周恩来首次完整提出和平共处五项原则；“求同存异”方针是1955年万隆会议上提出的。', en: 'Zhou set out the Five Principles in 1953; “seeking common ground” was his approach at Bandung in 1955.' },
      },
      {
        q: { zh: '1971年第26届联合国大会作出的决议是？', en: 'What did the 26th UN General Assembly decide in 1971?' },
        options: [{ zh: '中美正式建立外交关系', en: 'China and the US establish diplomatic relations' }, { zh: '尼克松总统访华', en: 'President Nixon visits China' }, { zh: '恢复中华人民共和国在联合国的一切合法权利', en: 'The PRC’s lawful rights in the UN are restored' }, { zh: '中国加入世界贸易组织', en: 'China joins the World Trade Organization' }],
        answer: 2, ev: 'un_seat',
        why: { zh: '1971年第26届联大恢复了中华人民共和国在联合国的一切合法权利；尼克松访华在1972年，中美建交在1979年。', en: 'The 1971 General Assembly restored all the PRC’s lawful rights in the UN; Nixon came in 1972 and diplomatic relations followed in 1979.' },
      },
      { order: ['bandung', 'liangdan', 'un_seat', 'wto'] },
      { where: 'liangdan' },
    ],
    keys: [
      { zh: '1964年我国第一颗原子弹爆炸成功，1967年氢弹、1970年“东方红一号”卫星相继成功，“两弹一星”增强了国防实力。', en: 'China’s first atomic bomb in 1964, hydrogen bomb in 1967 and satellite Dongfanghong-1 in 1970 – “two bombs, one satellite” – strengthened its defence.' },
      { zh: '1953年周恩来提出和平共处五项原则；1955年万隆会议上提出“求同存异”方针。', en: 'Zhou Enlai proposed the Five Principles of Peaceful Coexistence in 1953 and “seeking common ground while setting aside differences” at Bandung in 1955.' },
      { zh: '1971年恢复联合国合法席位，1972年尼克松访华，1979年中美正式建交。', en: 'China’s UN seat was restored in 1971, Nixon visited in 1972 and China and the US established relations in 1979.' },
    ],
  },
  {
    id: 'g8b-6', book: 'g8b', unit: 6, minutes: 12,
    title: { zh: '科技文化与社会生活', en: 'Science, culture and social life' },
    blurb: { zh: '“两弹一星”、杂交水稻、载人航天、教育发展和社会生活的变迁。', en: '“Two bombs, one satellite”, hybrid rice, human spaceflight, education and changes in daily life.' },
    steps: [
      {
        year: 1956, at: [116.4, 39.9, 40],
        title: { zh: '向科学进军', en: 'March on science' },
        body: { zh: '1956年党中央发出“向科学进军”的号召，制定了科学技术发展远景规划，新中国的科技事业从此蓬勃发展。', en: 'In 1956 the Party called for a “march on science” and drew up a long-term plan for science and technology, and the new China’s science began to flourish.' },
      },
      {
        ev: 'liangdan',
        body: { zh: '1964年我国第一颗原子弹爆炸成功，1967年第一颗氢弹爆炸成功，1970年第一颗人造地球卫星“东方红一号”发射成功。邓稼先被誉为“两弹元勋”。', en: 'China exploded its first atomic bomb in 1964 and its first hydrogen bomb in 1967, and launched its first satellite, Dongfanghong-1, in 1970. Deng Jiaxian is honoured as a founding hero of the bombs and the satellite.' },
      },
      { ev: 'hybrid_rice' },
      { ev: 'gaokao' },
      {
        year: 1986, at: [116.4, 39.9, 40],
        title: { zh: '教育的发展', en: 'Education grows' },
        body: { zh: '1986年颁布《中华人民共和国义务教育法》，我国开始实行九年制义务教育。', en: 'The Compulsory Education Law of 1986 introduced nine years of compulsory schooling.' },
      },
      { ev: 'shenzhou5' },
      { ev: 'change' },
      {
        ev: 'olympics2008',
        body: { zh: '改革开放以来，人民生活水平显著提高，衣食住行发生巨大变化。2008年北京成功举办第29届奥运会；同年京津城际铁路开通，中国进入高铁时代。', en: 'Since reform and opening up living standards have risen sharply and food, clothing, housing and travel have changed greatly. Beijing hosted the 2008 Olympics, and the Beijing–Tianjin intercity line brought China into the high-speed rail age that year.' },
      },
    ],
    checks: [
      {
        q: { zh: '被誉为“杂交水稻之父”的科学家是？', en: 'Which scientist is called the father of hybrid rice?' },
        options: [{ zh: '钱学森', en: 'Qian Xuesen' }, { zh: '邓稼先', en: 'Deng Jiaxian' }, { zh: '屠呦呦', en: 'Tu Youyou' }, { zh: '袁隆平', en: 'Yuan Longping' }],
        answer: 3, ev: 'hybrid_rice',
        why: { zh: '1973年袁隆平培育成功籼型杂交水稻；屠呦呦发现青蒿素，邓稼先是“两弹元勋”，钱学森是航天事业的奠基人。', en: 'Yuan Longping bred indica hybrid rice in 1973; Tu Youyou discovered artemisinin, Deng Jiaxian led the bomb programme and Qian Xuesen founded China’s rocketry.' },
      },
      {
        q: { zh: '2003年“神舟五号”发射成功，中国成为世界上第几个独立掌握载人航天技术的国家？', en: 'After Shenzhou 5 in 2003, China became which country to master human spaceflight on its own?' },
        options: [{ zh: '第一个', en: 'The first' }, { zh: '第二个', en: 'The second' }, { zh: '第三个', en: 'The third' }, { zh: '第四个', en: 'The fourth' }],
        answer: 2, ev: 'shenzhou5',
        why: { zh: '继苏联（俄罗斯）、美国之后，中国成为世界上第三个独立掌握载人航天技术的国家，杨利伟成为中国进入太空第一人。', en: 'After the Soviet Union and the United States, China became the third; Yang Liwei was the first Chinese in space.' },
      },
      { order: ['liangdan', 'hybrid_rice', 'shenzhou5', 'olympics2008'] },
      { where: 'shenzhou5' },
    ],
    keys: [
      { zh: '“两弹一星”：1964年原子弹、1967年氢弹、1970年“东方红一号”卫星；邓稼先被誉为“两弹元勋”。', en: '“Two bombs, one satellite”: the atomic bomb in 1964, the hydrogen bomb in 1967 and Dongfanghong-1 in 1970; Deng Jiaxian is honoured as a founding hero of the bombs and the satellite.' },
      { zh: '袁隆平培育出籼型杂交水稻，被誉为“杂交水稻之父”；屠呦呦发现青蒿素，2015年获诺贝尔生理学或医学奖。', en: 'Yuan Longping, father of hybrid rice, bred indica hybrid rice; Tu Youyou discovered artemisinin and won the 2015 Nobel Prize in Physiology or Medicine.' },
      { zh: '2003年“神舟五号”载人飞船发射成功，杨利伟成为中国进入太空的第一人。', en: 'Shenzhou 5 flew in 2003 and Yang Liwei became the first Chinese in space.' },
    ],
  },
];
