/** 高中《中外历史纲要（上）》. */
import type { Lesson } from '../types.ts';

export const HS1: Lesson[] = [
  {
    id: 'hs1-1', book: 'hs1', unit: 1, minutes: 15,
    title: { zh: '从中华文明起源到秦汉大一统封建国家的建立与巩固', en: 'From the origins of Chinese civilisation to the unified Qin–Han empire' },
    blurb: { zh: '早期国家与分封制、宗法制，春秋战国的大变革与百家争鸣，秦朝中央集权制度的建立和汉朝大一统的巩固。', en: 'Early states, enfeoffment and the lineage system; the upheaval of the Spring and Autumn and Warring States periods; Qin’s centralised state and its consolidation under the Han.' },
    steps: [
      {
        year: -3300, at: [117, 32, 55],
        title: { zh: '中华文明的起源', en: 'The origins of Chinese civilisation' },
        body: { zh: '新石器时代，黄河、长江流域等地的文化遗址星罗棋布。良渚古城出现宫殿、城墙、大型水利工程和玉礼器，显示出早期国家的形态，实证了中华五千多年的文明史。', en: 'Neolithic sites spread across the Yellow River and Yangtze basins. Liangzhu, with palaces, walls, large water works and jade ritual objects, shows an early state and attests to over 5,000 years of Chinese civilisation.' },
      },
      {
        ev: 'xia_found', polity: 'xia',
        body: { zh: '约公元前2070年夏朝建立，王位世袭制取代禅让制，“公天下”变为“家天下”。此后商、周相继，早期国家逐步发展。', en: 'Around 2070 BCE the Xia was founded and hereditary kingship replaced abdication to the worthy: the realm became a family possession. Shang and Zhou followed and the early state matured.' },
      },
      {
        ev: 'fenfeng', polity: 'zhou',
        body: { zh: '西周实行分封制，并以宗法制相配合：宗法制以血缘关系为纽带，核心是嫡长子继承制。二者互为表里，形成“天子—诸侯—卿大夫—士”的等级秩序，巩固了周王的统治。', en: 'The Western Zhou enfeoffed kinsmen and allies and backed this with the lineage system, bound by blood and centred on succession by the eldest son of the principal wife. Together they built a hierarchy of Son of Heaven, lords, ministers and shi that upheld Zhou rule.' },
      },
      {
        ev: 'baijia',
        body: { zh: '春秋战国时期，铁农具和牛耕推广，井田制瓦解，分封制和宗法制逐渐崩溃，各国纷纷变法。社会大变革中出现“百家争鸣”，奠定了中华思想文化的基础。', en: 'In the Spring and Autumn and Warring States periods iron tools and ox-ploughing spread, the well-field system collapsed, enfeoffment broke down and states pushed through reforms. Amid this upheaval the Hundred Schools of Thought laid the foundations of Chinese thought.' },
      },
      {
        ev: 'qin_unify', polity: 'qin',
        body: { zh: '秦朝建立以皇帝为中心的中央集权制度：创立皇帝制度；中央设丞相、太尉、御史大夫等三公九卿；地方推行郡县制，官吏由皇帝任免，不得世袭。这一制度奠定了此后两千多年政治制度的基本格局。', en: 'Qin built a centralised state around the emperor: the imperial title; the Three Lords (chancellor, grand commandant, imperial counsellor) and Nine Ministers at court; and commanderies and counties whose officials the emperor appointed and who could not pass on their posts. This framework shaped Chinese government for two thousand years.' },
      },
      {
        ev: 'han_found',
        body: { zh: '秦朝暴政引发农民起义而迅速灭亡。西汉建立后“汉承秦制”，地方实行郡国并行制，推行休养生息政策，社会经济得到恢复。', en: 'Harsh rule provoked peasant risings and Qin fell quickly. The Western Han kept the Qin system, ruling through both commanderies and vassal kingdoms, and let the people recover by lightening their burdens.' },
      },
      {
        ev: 'hanwudi', polity: 'whan',
        body: { zh: '汉武帝颁布“推恩令”削弱王国势力，设刺史监察地方；“罢黜百家，独尊儒术”；盐铁官营、统一铸造五铢钱；北击匈奴。大一统局面从政治、思想、经济、军事上得到巩固。', en: 'Emperor Wu split up the vassal kingdoms with the Edict of Grace and sent inspectors to watch the provinces; made Confucianism the state teaching; put salt and iron under state monopoly and minted the wuzhu coin; and drove back the Xiongnu, securing unity politically, ideologically, economically and militarily.' },
      },
      { ev: 'xiyu_duhu' },
    ],
    checks: [
      {
        q: { zh: '西周宗法制的核心是？', en: 'What lay at the heart of the Western Zhou lineage system?' },
        options: [{ zh: '嫡长子继承制', en: 'Succession by the eldest son of the principal wife' }, { zh: '郡县制', en: 'Commanderies and counties' }, { zh: '禅让制', en: 'Abdication to the worthy' }, { zh: '三公九卿制', en: 'The Three Lords and Nine Ministers' }],
        answer: 0, ev: 'fenfeng',
        why: { zh: '宗法制以血缘关系为纽带，核心是嫡长子继承制，与分封制互为表里；禅让制属于传说时代，郡县制和三公九卿制属于秦朝。', en: 'The lineage system was bound by blood and centred on the eldest son of the principal wife; abdication belongs to the legendary age, and commanderies and the Three Lords to Qin.' },
      },
      {
        q: { zh: '与西周分封制相比，秦朝郡县制最主要的不同是？', en: 'Compared with Zhou enfeoffment, what was the key difference of the Qin commandery–county system?' },
        options: [{ zh: '地方享有较大的自治权', en: 'Localities enjoyed wide self-rule' }, { zh: '按血缘亲疏分配土地和人民', en: 'Land and people were granted by closeness of kinship' }, { zh: '地方官由皇帝任免，不得世袭', en: 'Local officials were appointed by the emperor and could not pass on their posts' }, { zh: '以诸侯定期朝贡维系中央权威', en: 'Central authority rested on lords’ regular tribute' }],
        answer: 2, ev: 'qin_unify',
        why: { zh: '郡守、县令由皇帝直接任免、不能世袭，地方完全听命于中央，这是中央集权的关键；其余选项都是分封制的特点。', en: 'Commandery and county heads were appointed and dismissed by the emperor and could not inherit office, which is what made the state centralised; the other options describe enfeoffment.' },
      },
      {
        q: { zh: '汉武帝颁布“推恩令”，主要是为了？', en: 'What was Emperor Wu’s Edict of Grace mainly for?' },
        options: [{ zh: '减轻农民赋役负担', en: 'To lighten the peasants’ taxes and labour' }, { zh: '通过考试选拔人才', en: 'To recruit officials by examination' }, { zh: '联合西域夹击匈奴', en: 'To ally with the Western Regions against the Xiongnu' }, { zh: '削弱王国势力，加强中央集权', en: 'To weaken the vassal kingdoms and strengthen central power' }],
        answer: 3, ev: 'hanwudi',
        why: { zh: '“推恩令”允许诸侯王把封地分给子弟，王国越分越小，解决了汉初王国问题，加强了中央集权。', en: 'The edict let kings divide their land among all their sons, so the kingdoms shrank with each generation and no longer threatened the throne.' },
      },
      { order: ['xia_found', 'fenfeng', 'shangyang', 'qin_unify', 'hanwudi'] },
      { where: 'xiyu_duhu', tol: 500 },
    ],
    keys: [
      { zh: '分封制与宗法制互为表里，维护了西周的统治；春秋战国时期随着铁犁牛耕推广、井田制瓦解而逐渐崩溃。', en: 'Enfeoffment and the lineage system together upheld Zhou rule; they broke down as iron ploughs spread and the well-field system collapsed.' },
      { zh: '百家争鸣是社会大变革在思想领域的反映，奠定了中华思想文化的基础。', en: 'The Hundred Schools reflected social upheaval in the realm of ideas and laid the foundations of Chinese thought.' },
      { zh: '秦朝建立以皇帝为中心的中央集权制度（皇帝制、三公九卿制、郡县制），奠定了两千多年政治制度的基本格局。', en: 'Qin created the centralised imperial system (emperor, Three Lords and Nine Ministers, commanderies and counties) that shaped two thousand years of government.' },
      { zh: '汉武帝从政治、思想、经济、军事等方面巩固了大一统。', en: 'Emperor Wu consolidated the unified empire politically, ideologically, economically and militarily.' },
    ],
  },
  {
    id: 'hs1-2', book: 'hs1', unit: 2, minutes: 15,
    title: { zh: '三国两晋南北朝的民族交融与隋唐统一多民族封建国家的发展', en: 'Ethnic integration (220–589) and the Sui–Tang empire' },
    blurb: { zh: '分裂时期的民族交融与江南开发，隋朝重建统一，三省六部制和科举制，唐朝由盛转衰。', en: 'Ethnic integration and the opening of the south in an age of division; Sui reunification, the Three Departments and Six Ministries, the examinations, and the Tang from glory to decline.' },
    steps: [
      {
        year: 220, at: [113, 32, 55],
        title: { zh: '由统一走向分裂', en: 'From unity to division' },
        body: { zh: '东汉末年豪强割据，220年东汉灭亡，三国鼎立。西晋短暂统一后，北方多个政权并立，南方东晋和宋、齐、梁、陈相继，形成长期分裂的局面。', en: 'Late Han warlords carved up the realm; in 220 the Han ended and three kingdoms emerged. After the brief Western Jin unity, the north split among many regimes while the Eastern Jin and then Song, Qi, Liang and Chen ruled the south.' },
      },
      {
        ev: 'dongjin', polity: 'ejin',
        body: { zh: '北方战乱，大量人口南迁，带来劳动力和先进生产技术；江南自然条件优越、社会相对安定，经济得到开发，为后来经济重心南移奠定了基础。', en: 'War in the north drove many people south with their labour and farming skills. With good land and relative peace, the Yangtze delta was developed, preparing the later shift of China’s economic centre southwards.' },
      },
      {
        ev: 'xiaowendi', polity: 'beiwei',
        body: { zh: '北魏孝文帝迁都洛阳，推行汉化改革。内迁各族与汉族长期杂居、通婚，相互学习，民族交融加速，为隋唐的统一奠定了基础。', en: 'Emperor Xiaowen of the Northern Wei moved the capital to Luoyang and adopted Han ways. Peoples who had moved into China lived and married alongside the Han, speeding ethnic integration and preparing the Sui–Tang reunification.' },
      },
      {
        ev: 'sui_unify', polity: 'sui',
        body: { zh: '589年隋灭陈，结束了长期分裂局面。隋朝开创三省六部制和科举制，开通大运河，为唐朝的繁荣奠定了基础。', en: 'In 589 the Sui conquered the Chen and ended the long division. It created the Three Departments and Six Ministries and the examinations and dug the Grand Canal, laying the ground for Tang prosperity.' },
      },
      {
        year: 627, polity: 'tang',
        title: { zh: '三省六部制', en: 'Three Departments and Six Ministries' },
        body: { zh: '隋唐中央实行三省六部制：中书省起草诏令，门下省审核，尚书省执行，下设吏、户、礼、兵、刑、工六部。三省分工合作、相互牵制，提高了行政效率，分散了相权、加强了皇权。', en: 'At the Sui–Tang court the Secretariat drafted edicts, the Chancellery reviewed them and the Department of State Affairs carried them out through six ministries: personnel, revenue, rites, war, justice and works. The division of labour made government more efficient, split the chancellor’s power and strengthened the throne.' },
      },
      {
        ev: 'keju',
        body: { zh: '科举制以考试成绩选拔官员，改变了魏晋以来门阀士族垄断仕途的局面，扩大了官吏来源，加强了中央集权，也促进了文化教育的发展。', en: 'The examinations chose officials by results, ending the great families’ hold on office since the Wei and Jin. They widened recruitment, strengthened central power and encouraged learning.' },
      },
      {
        ev: 'kaiyuan', polity: 'tang',
        body: { zh: '唐朝前期出现“贞观之治”和“开元盛世”，疆域辽阔，民族关系友好，文成公主入藏促进了唐蕃交往；中外交流频繁，长安成为国际性大都市。', en: 'The early Tang saw the Zhenguan and Kaiyuan golden ages: a vast realm, friendly ties with neighbouring peoples (Princess Wencheng went to Tibet) and busy foreign exchange that made Chang’an a cosmopolitan city.' },
      },
      {
        ev: 'anshi',
        body: { zh: '安史之乱是唐朝由盛转衰的转折点。此后藩镇割据、宦官专权、朋党之争，907年唐朝灭亡。', en: 'The An Lushan rebellion turned the Tang from glory to decline. Regional governors went their own way, eunuchs dominated the court and factions feuded until the dynasty fell in 907.' },
      },
    ],
    checks: [
      {
        q: { zh: '北魏孝文帝改革最重要的历史意义是？', en: 'What was the main significance of Emperor Xiaowen’s reforms?' },
        options: [{ zh: '实现了全国统一', en: 'It reunified the whole country' }, { zh: '促进了北方民族交融', en: 'It sped up ethnic integration in the north' }, { zh: '确立了科举制度', en: 'It established the examinations' }, { zh: '使经济重心完成南移', en: 'It completed the shift of the economic centre south' }],
        answer: 1, ev: 'xiaowendi',
        why: { zh: '孝文帝迁都洛阳、推行汉化，加速了北方民族交融；全国统一由隋完成，科举始于隋，经济重心南移完成于南宋。', en: 'Moving to Luoyang and adopting Han ways sped up integration in the north; reunification came with the Sui, the examinations began under the Sui, and the economic shift south was completed under the Southern Song.' },
      },
      {
        q: { zh: '唐朝三省六部制中，负责审核诏令、可以“封驳”的机构是？', en: 'Under the Tang system, which body reviewed edicts and could send them back?' },
        options: [{ zh: '尚书省', en: 'Department of State Affairs' }, { zh: '中书省', en: 'Secretariat' }, { zh: '吏部', en: 'Ministry of Personnel' }, { zh: '门下省', en: 'Chancellery' }],
        answer: 3, ev: 'zhenguan',
        why: { zh: '中书省起草，门下省审核，尚书省执行；门下省可以驳回不当的诏令，体现了三省相互牵制。', en: 'The Secretariat drafted, the Chancellery reviewed and could reject, and the Department of State Affairs executed: a system of mutual checks.' },
      },
      {
        q: { zh: '与魏晋以来的九品中正制相比，科举制的进步主要在于？', en: 'Compared with the earlier Nine-Rank system, what was the main advance of the examinations?' },
        options: [{ zh: '以考试成绩选官，打破门第限制', en: 'Officials were chosen by examination, not by family standing' }, { zh: '由地方官员推荐人才', en: 'Local officials recommended candidates' }, { zh: '根据家世门第评定等级', en: 'Candidates were ranked by their family’s status' }, { zh: '官职由贵族子弟世袭', en: 'Offices passed down in noble families' }],
        answer: 0, ev: 'keju',
        why: { zh: '九品中正制后期“上品无寒门，下品无势族”；科举制以考试选官，使出身寒微的读书人也能入仕，扩大了统治基础。', en: 'The Nine-Rank system came to favour the great families; examinations let able men of humble birth enter office and broadened the regime’s base.' },
      },
      { order: ['sanguo', 'feishui', 'xiaowendi', 'sui_unify', 'anshi'] },
      { where: 'wencheng', tol: 500 },
    ],
    keys: [
      { zh: '三国两晋南北朝时期政权分立，但北方民族交融、江南得到开发，为隋唐统一奠定了基础。', en: 'Though divided, the period 220–589 saw integration in the north and the opening of the south, preparing the Sui–Tang unity.' },
      { zh: '三省六部制分工明确、相互牵制，提高了行政效率，加强了皇权。', en: 'The Three Departments and Six Ministries divided and checked power, raising efficiency and strengthening the throne.' },
      { zh: '科举制以考试选官，打破了士族对仕途的垄断，对后世影响深远。', en: 'The examinations broke the great families’ monopoly on office and had a lasting influence.' },
      { zh: '安史之乱是唐朝由盛转衰的转折点。', en: 'The An Lushan rebellion was the Tang’s turning point from glory to decline.' },
    ],
  },
  {
    id: 'hs1-3', book: 'hs1', unit: 3, minutes: 15,
    title: { zh: '辽宋夏金多民族政权的并立与元朝的统一', en: 'Coexisting regimes of Liao, Song, Xia and Jin; Yuan unification' },
    blurb: { zh: '宋代加强中央集权与“重文轻武”，多民族政权并立，经济重心南移，元朝统一与行省制度。', en: 'Song centralisation and civil rule over the military, coexisting regimes, the economic shift south, and Yuan unification with its provinces.' },
    steps: [
      {
        year: 907, at: [112, 36, 55],
        title: { zh: '五代十国', en: 'Five Dynasties and Ten Kingdoms' },
        body: { zh: '唐朝灭亡后，中原相继出现五个王朝，南方等地先后存在十个割据政权，史称“五代十国”。同时，北方的契丹族逐渐兴起。', en: 'After the Tang fell five dynasties followed one another in the north while ten regional states rose in the south. Meanwhile the Khitan grew strong on the northern steppe.' },
      },
      {
        ev: 'song_found',
        body: { zh: '宋太祖吸取唐末五代藩镇割据的教训，收兵权、削实权、制钱谷：派文臣任知州并设通判，设转运使管理地方财赋，中央分割宰相权力。中央集权空前加强，形成“重文轻武”的风气。', en: 'Learning from the warlords of late Tang, the first Song emperor took back the generals’ armies, sent civil officials to govern prefectures under watchful vice-prefects, put local revenue under fiscal commissioners and split the chancellor’s power. Central power grew as never before, and civil rule over the military became the norm.' },
      },
      {
        ev: 'wanganshi',
        body: { zh: '北宋中期“冗官、冗兵、冗费”，形成“积贫积弱”的局面。王安石推行青苗法、募役法、保甲法等以求富国强兵，一度增加了财政收入，但因触动大官僚、大地主利益等原因而失败。', en: 'By the mid-11th century surplus officials, soldiers and spending left Song poor and weak. Wang Anshi’s new laws on crop loans, labour service and local militia raised revenue for a time but failed against the opposition of great officials and landlords.' },
      },
      {
        ev: 'chanyuan', polity: 'liao',
        body: { zh: '辽、北宋、西夏以及后来的金与南宋等政权并立，战争与和议交替。澶渊之盟后宋辽长期和平，双方设立榷场开展贸易，民族交融不断加深。', en: 'Liao, Northern Song, Western Xia and later Jin and Southern Song coexisted, alternating war and treaty. After the Treaty of Chanyuan Song and Liao kept a long peace and traded at border markets, deepening integration.' },
      },
      {
        ev: 'jingkang', polity: 'nsong',
        body: { zh: '1127年金军攻破开封，北宋灭亡；赵构建立南宋，后定都临安。1142年宋金议和，形成南北对峙的局面。', en: 'In 1127 Jin troops took Kaifeng and the Northern Song fell; Zhao Gou founded the Southern Song with its capital later at Lin’an. The 1142 peace left Song and Jin facing each other across the Huai.' },
      },
      {
        ev: 'south_shift',
        body: { zh: '宋代农业、手工业和商业繁荣，城市打破坊市界限，出现交子。南宋时，我国经济重心南移完成，“苏湖熟，天下足”。', en: 'Song farming, crafts and trade flourished; cities broke down the old walls between wards and markets, and paper money appeared. Under the Southern Song China’s economic centre completed its shift south: “When Suzhou and Huzhou ripen, all under heaven has enough.”' },
      },
      {
        ev: 'yuan_found', polity: 'yuan',
        body: { zh: '1271年忽必烈定国号为元，1279年灭南宋，结束了长期多个政权并立的局面，奠定了元明清时期我国疆域的基础。', en: 'In 1271 Kublai named his dynasty Yuan and in 1279 destroyed the Southern Song, ending centuries of coexisting regimes and setting the frame of China’s territory under the Yuan, Ming and Qing.' },
      },
      {
        ev: 'xingsheng', polity: 'yuan',
        body: { zh: '元朝中央设中书省总领全国政务，地方设行省；设宣政院管辖西藏地区，设澎湖巡检司管辖澎湖和台湾。行省制度加强了中央对地方的管辖，是我国省制的开端。', en: 'The Yuan Secretariat ran the whole realm and provinces (xingsheng) governed the regions; the Bureau of Buddhist and Tibetan Affairs ruled Tibet and a police office on Penghu covered Penghu and Taiwan. The provinces tightened central control and began China’s province system.' },
      },
    ],
    checks: [
      {
        q: { zh: '宋初加强中央集权的措施，带来的消极后果是？', en: 'What harmful result did early Song centralisation bring?' },
        options: [{ zh: '藩镇割据愈演愈烈', en: 'Regional warlords grew ever stronger' }, { zh: '“冗官、冗兵、冗费”，积贫积弱', en: 'Surplus officials, troops and spending left the state poor and weak' }, { zh: '宦官专权、朋党相争', en: 'Eunuchs ruled and factions feuded' }, { zh: '经济重心向北方转移', en: 'The economic centre moved north' }],
        answer: 1, ev: 'wanganshi',
        why: { zh: '宋初措施消除了割据隐患，但机构重叠、军队战斗力下降，造成“三冗”和积贫积弱；藩镇割据和宦官专权是唐后期的问题。', en: 'The measures ended the warlord threat but bred overlapping offices and weak armies, hence surplus and poverty; warlords and eunuch power were late-Tang problems.' },
      },
      {
        q: { zh: '元朝行省制度的历史意义是？', en: 'What was the significance of the Yuan province system?' },
        options: [{ zh: '结束了五代十国的分裂', en: 'It ended the Five Dynasties division' }, { zh: '削弱了皇权，分散了相权', en: 'It weakened the throne and split the chancellor’s power' }, { zh: '加强了中央对地方的管辖，开创我国省制', en: 'It tightened central control and began China’s province system' }, { zh: '恢复了西周的分封制度', en: 'It restored Zhou-style enfeoffment' }],
        answer: 2, ev: 'xingsheng',
        why: { zh: '行省是中书省的派出机构，加强了中央集权，巩固了统一多民族国家，是我国省制的开端，影响至今。', en: 'The provinces were branches of the central Secretariat; they strengthened central rule over a multi-ethnic empire and are the origin of today’s provinces.' },
      },
      {
        q: { zh: '宋代流传“苏湖熟，天下足”的说法，它反映了？', en: 'The Song saying “When Suzhou and Huzhou ripen, all under heaven has enough” shows what?' },
        options: [{ zh: '宋代海外贸易发达', en: 'Song overseas trade was thriving' }, { zh: '江南地区开始得到开发', en: 'The south was just beginning to be developed' }, { zh: '北方经济依然领先', en: 'The north still led the economy' }, { zh: '经济重心南移完成', en: 'The economic centre had shifted south' }],
        answer: 3, ev: 'south_shift',
        why: { zh: '太湖流域成为全国粮食主产区，说明南方经济超过北方，经济重心南移在南宋时完成；江南开始开发是魏晋南北朝时期。', en: 'The Lake Tai region had become China’s granary, so the south had overtaken the north; the south’s development had begun back in the 3rd–6th centuries.' },
      },
      { order: ['liao_found', 'song_found', 'xixia_found', 'jin_found', 'yuan_found'] },
      { where: 'xixia_found', tol: 400 },
    ],
    keys: [
      { zh: '宋初“重文轻武”、分化事权，加强了中央集权，消除了割据隐患，但也造成“积贫积弱”。', en: 'Early Song favoured civil over military and split authority, ending warlordism but leaving the state poor and weak.' },
      { zh: '辽宋夏金政权并立，战争与和议交替，民族交融不断加深。', en: 'Liao, Song, Xia and Jin coexisted through war and treaty, deepening ethnic integration.' },
      { zh: '南宋时我国经济重心南移完成。', en: 'Under the Southern Song China’s economic centre completed its shift south.' },
      { zh: '元朝实行行省制度，设宣政院管辖西藏，奠定了元明清疆域的基础。', en: 'The Yuan introduced provinces and ruled Tibet through the Bureau of Buddhist and Tibetan Affairs, framing the later territory of China.' },
    ],
  },
  {
    id: 'hs1-4', book: 'hs1', unit: 4, minutes: 15,
    title: { zh: '明清中国版图的奠定与面临的挑战', en: 'Ming and Qing: shaping China’s territory and facing new challenges' },
    blurb: { zh: '废丞相、设内阁、设军机处，君主专制走向顶峰；清朝奠定版图；明清之际的思想；闭关锁国。', en: 'From abolishing the chancellor to the Grand Council, autocracy at its height; the Qing shapes China’s territory; early Qing thinkers; and the closed door.' },
    steps: [
      {
        year: 1368, at: [116, 35, 60],
        title: { zh: '从元到明', en: 'From Yuan to Ming' },
        body: { zh: '元朝后期政治腐败、社会矛盾尖锐，爆发了元末农民起义。朱元璋在起义中壮大力量，1368年建立明朝，同年攻占大都，元朝在全国的统治结束。', en: 'Late Yuan misrule and social tension set off peasant risings. Zhu Yuanzhang rose among the rebels, founded the Ming in 1368 and took Dadu the same year, ending Yuan rule over China.' },
      },
      {
        ev: 'ming_found', polity: 'ming',
        body: { zh: '明太祖废除丞相和中书省，由六部直接对皇帝负责；地方设三司，分掌行政、司法和军事。皇权空前加强。', en: 'The Hongwu emperor abolished the chancellor and the Secretariat, making the six ministries answer to him directly, and split each province between three offices for administration, justice and the army. Imperial power grew as never before.' },
      },
      {
        ev: 'forbidden_city',
        body: { zh: '明成祖迁都北京，设立内阁。内阁大学士起初只是皇帝的顾问，后来地位逐渐提高，但内阁不是法定的中央一级行政机构，决策权始终掌握在皇帝手中。', en: 'The Yongle emperor moved the capital to Beijing and set up the Grand Secretariat. Its grand secretaries began as advisers and grew in standing, but it was never a statutory organ of government: decisions stayed with the emperor.' },
      },
      {
        ev: 'li_zicheng',
        body: { zh: '明朝后期政治腐败、土地兼并严重，1644年李自成攻入北京，明朝灭亡；同年清军入关，迁都北京，逐步统一全国。', en: 'Corruption and land concentration weakened the late Ming. In 1644 Li Zicheng took Beijing and the Ming fell; the same year Qing armies entered through Shanhai Pass, moved their capital to Beijing and went on to unify the country.' },
      },
      {
        year: 1663, at: [119, 31, 30],
        title: { zh: '明清之际的思想', en: 'Thinkers of the Ming–Qing transition' },
        body: { zh: '明清之际，黄宗羲抨击君主专制，提出“为天下之大害者，君而已矣”；顾炎武提倡“经世致用”；王夫之主张“气”是万物的本原。他们的思想具有批判专制的色彩，但没有突破传统儒学的框架。', en: 'At the Ming–Qing transition Huang Zongxi attacked autocracy, writing that the greatest harm to the realm is the ruler; Gu Yanwu urged learning of practical use to the state; Wang Fuzhi held that qi is the origin of all things. They criticised absolutism but stayed within Confucian tradition.' },
      },
      {
        ev: 'junjichu', polity: 'qing',
        body: { zh: '雍正帝设立军机处，军机大臣只是“跪受笔录”、传达皇帝旨意，军国大事由皇帝一人裁决，标志着君主专制达到顶峰。', en: 'The Yongzheng emperor set up the Grand Council, whose ministers knelt to take down and pass on his orders while he alone decided affairs of state: autocracy had reached its height.' },
      },
      {
        year: 1757, polity: 'qing',
        title: { zh: '统一多民族国家的巩固', en: 'Consolidating the multi-ethnic state' },
        body: { zh: '清朝收复台湾并设台湾府，抗击沙俄、签订《尼布楚条约》，平定准噶尔和大小和卓叛乱、统一新疆，设驻藏大臣管理西藏。到18世纪中叶，奠定了中国的版图。', en: 'The Qing recovered Taiwan and made it a prefecture, resisted Russia and signed the Treaty of Nerchinsk, crushed the Dzungars and the Khoja revolt to unify Xinjiang, and sent resident ministers to Tibet. By the mid-18th century China’s territory had taken shape.' },
      },
      {
        ev: 'canton',
        body: { zh: '清朝实行“闭关锁国”政策，1757年只开广州一处对外通商。这一政策对西方殖民者有一定的自卫作用，但使中国与世界隔绝，逐渐落后于世界潮流。', en: 'The Qing closed the country, from 1757 allowing foreign trade only at Canton. This offered some defence against Western colonisers but cut China off from the world, and it fell behind.' },
      },
    ],
    checks: [
      {
        q: { zh: '明太祖废除丞相制度的直接结果是？', en: 'What was the direct result of the Hongwu emperor abolishing the chancellor?' },
        options: [{ zh: '六部直接对皇帝负责，皇权空前加强', en: 'The six ministries answered to the emperor, and his power grew as never before' }, { zh: '内阁成为法定的中央行政机构', en: 'The Grand Secretariat became a statutory organ of government' }, { zh: '地方开始实行行省制度', en: 'Provinces were introduced' }, { zh: '军机处取代了内阁', en: 'The Grand Council replaced the Grand Secretariat' }],
        answer: 0, ev: 'ming_found',
        why: { zh: '废丞相后，皇帝直接统领六部，相权归于皇权；内阁从未成为法定机构，行省始于元，军机处设于清雍正时。', en: 'With no chancellor the emperor ran the ministries himself; the Grand Secretariat was never statutory, provinces began under the Yuan, and the Grand Council came under Yongzheng.' },
      },
      {
        q: { zh: '明清之际有思想家提出“为天下之大害者，君而已矣”，这主要体现了？', en: 'A Ming–Qing thinker wrote that the greatest harm to the realm is the ruler. What does this mainly show?' },
        options: [{ zh: '主张经世致用的学风', en: 'A call for practical learning' }, { zh: '提倡“存天理，灭人欲”', en: 'Upholding heavenly principle against human desire' }, { zh: '批判君主专制', en: 'An attack on autocracy' }, { zh: '主张“罢黜百家，独尊儒术”', en: 'Making Confucianism the sole state teaching' }],
        answer: 2,
        why: { zh: '这是黄宗羲在《明夷待访录》中的观点，矛头直指君主专制；经世致用是顾炎武的主张，“存天理，灭人欲”属于宋代理学。', en: 'It is Huang Zongxi’s attack on absolute monarchy; practical learning was Gu Yanwu’s call, and the heavenly-principle slogan belongs to Song Neo-Confucianism.' },
      },
      {
        q: { zh: '清朝设立军机处，标志着？', en: 'What did the Qing Grand Council mark?' },
        options: [{ zh: '中央对地方的控制削弱', en: 'Weaker central control over the provinces' }, { zh: '君主专制达到顶峰', en: 'Autocracy reaching its height' }, { zh: '内阁成为决策中枢', en: 'The Grand Secretariat becoming the centre of decision' }, { zh: '三省六部制正式确立', en: 'The Three Departments and Six Ministries being founded' }],
        answer: 1, ev: 'junjichu',
        why: { zh: '军机大臣只能秉承皇帝旨意办事，没有决策权，一切由皇帝独断，君主专制发展到顶峰。', en: 'Grand councillors only carried out the emperor’s will and had no say of their own; everything was decided by him alone.' },
      },
      { order: ['ming_found', 'zhenghe', 'li_zicheng', 'yaksa', 'junjichu'] },
      { where: 'yaksa', tol: 500 },
    ],
    keys: [
      { zh: '明朝废丞相、设内阁，清朝设军机处，君主专制不断强化并达到顶峰。', en: 'The Ming abolished the chancellor and set up the Grand Secretariat; the Qing Grand Council took autocracy to its height.' },
      { zh: '清朝前期收复台湾、抗击沙俄、统一新疆、加强对西藏的管辖，奠定了中国的版图。', en: 'The early Qing recovered Taiwan, resisted Russia, unified Xinjiang and tightened rule over Tibet, shaping China’s territory.' },
      { zh: '明清之际黄宗羲、顾炎武、王夫之等批判君主专制，主张经世致用。', en: 'Huang Zongxi, Gu Yanwu and Wang Fuzhi criticised autocracy and called for practical learning.' },
      { zh: '闭关锁国使中国与世界隔绝，逐渐落后于世界潮流。', en: 'The closed-door policy cut China off from the world and left it falling behind.' },
    ],
  },
  {
    id: 'hs1-5', book: 'hs1', unit: 5, minutes: 15,
    title: { zh: '晚清时期的内忧外患与救亡图存', en: 'Late Qing: crises at home and abroad, and the struggle for survival' },
    blurb: { zh: '两次鸦片战争与中国社会性质的变化，太平天国、洋务运动和戊戌变法的探索，甲午战争后的民族危机。', en: 'The Opium Wars and China’s changing society; the Taiping, Self-Strengthening and the 1898 reform; and the national crisis after 1895.' },
    steps: [
      {
        year: 1838, at: [113, 26, 60],
        title: { zh: '变化中的世界与中国', en: 'A changing world, an unchanging China' },
        body: { zh: '19世纪前期，英国工业革命迅速发展，急需开拓海外市场；清朝仍以自给自足的自然经济为主，政治腐败、军备废弛。英国以鸦片走私扭转对华贸易逆差。', en: 'In the early 19th century industrialising Britain needed new markets, while Qing China still lived on a self-sufficient farm economy, with a corrupt court and neglected armies. Britain turned to smuggling opium to reverse its trade deficit.' },
      },
      {
        ev: 'opium_war',
        body: { zh: '鸦片战争后清政府被迫签订《南京条约》，割地、赔款、开放五口通商、协定关税，中国的领土主权和关税自主权遭到破坏，开始沦为半殖民地半封建社会。', en: 'After the Opium War the Treaty of Nanjing forced China to cede land, pay indemnities, open five ports and accept fixed tariffs. Its territory and tariff autonomy were breached, and it began to become a semi-colonial, semi-feudal society.' },
      },
      {
        ev: 'taiping',
        body: { zh: '太平天国颁布《天朝田亩制度》，后期洪仁玕提出具有资本主义色彩的《资政新篇》。运动沉重打击了清朝统治和外国侵略势力，但由于农民阶级的局限而失败。', en: 'The Taiping issued a land system for the Heavenly Kingdom, and later Hong Rengan proposed a reform plan with capitalist features. The movement shook Qing rule and the foreign powers but failed through the limits of a peasant movement.' },
      },
      { ev: 'yuanmingyuan' },
      {
        ev: 'yangwu',
        body: { zh: '洋务派以“中学为体，西学为用”为指导，以“自强”“求富”为口号，创办近代军事和民用工业、筹建海军、兴办新式学堂，开启了中国近代化的进程，但没有触动封建制度。', en: 'Guided by “Chinese learning as the core, Western learning for use”, the Self-Strengthening officials built arsenals, factories, a navy and new schools under the slogans of strength and wealth. They began China’s modernisation but left the old order untouched.' },
      },
      {
        ev: 'maguan',
        body: { zh: '甲午战败后签订的《马关条约》允许日本在中国通商口岸开设工厂，适应了列强资本输出的需要；列强随即掀起瓜分中国的狂潮，民族危机空前严重。', en: 'After defeat in 1895 the Treaty of Shimonoseki let Japan open factories in the treaty ports, suiting the powers’ export of capital; a scramble for concessions followed and the national crisis became graver than ever.' },
      },
      {
        ev: 'wuxu',
        body: { zh: '维新派主张学习西方、实行君主立宪。戊戌变法是一次资产阶级性质的政治改革，也是一场思想启蒙运动，但因维新派力量弱小、顽固势力强大而失败。', en: 'The reformers wanted to learn from the West and set up a constitutional monarchy. The Hundred Days’ Reform of 1898 was a bourgeois political reform and an intellectual awakening, but the weak reformers were crushed by the conservatives.' },
      },
      { ev: 'baguo' },
    ],
    checks: [
      {
        q: { zh: '《马关条约》中最能反映列强侵华从商品输出转向资本输出的条款是？', en: 'Which term of the Treaty of Shimonoseki best shows the powers turning from exporting goods to exporting capital?' },
        options: [{ zh: '割台湾全岛及附属岛屿、澎湖列岛', en: 'Ceding Taiwan, its islands and Penghu' }, { zh: '赔偿日本军费白银2亿两', en: 'An indemnity of 200 million taels' }, { zh: '开放沙市、重庆、苏州、杭州为商埠', en: 'Opening Shashi, Chongqing, Suzhou and Hangzhou' }, { zh: '允许日本在通商口岸开设工厂', en: 'Letting Japan build factories in the treaty ports' }],
        answer: 3, ev: 'maguan',
        why: { zh: '在华开设工厂就是直接投资办厂，属于资本输出；割地、赔款、开埠在此前的条约中已有。', en: 'Building factories in China is direct investment, the export of capital; land, indemnities and open ports had all appeared in earlier treaties.' },
      },
      {
        q: { zh: '洋务运动的指导思想是？', en: 'What principle guided the Self-Strengthening Movement?' },
        options: [{ zh: '中学为体，西学为用', en: 'Chinese learning as the core, Western learning for use' }, { zh: '民主与科学', en: 'Democracy and science' }, { zh: '驱除鞑虏，恢复中华', en: 'Drive out the Manchus and restore China' }, { zh: '实行君主立宪', en: 'Constitutional monarchy' }],
        answer: 0, ev: 'yangwu',
        why: { zh: '洋务派在维护清朝统治的前提下学习西方技术，即“中体西用”；民主与科学是新文化运动的口号，君主立宪是维新派的主张。', en: 'The Self-Strengtheners borrowed Western technique to preserve Qing rule; democracy and science were New Culture slogans and constitutional monarchy the reformers’ goal.' },
      },
      {
        q: { zh: '关于戊戌变法的性质，下列说法正确的是？', en: 'Which best describes the nature of the 1898 reform?' },
        options: [{ zh: '一场农民战争', en: 'A peasant war' }, { zh: '地主阶级的自救运动', en: 'A self-rescue movement of the landlord class' }, { zh: '资产阶级性质的政治改革和思想启蒙运动', en: 'A bourgeois political reform and an intellectual awakening' }, { zh: '新民主主义革命的开端', en: 'The start of the New Democratic Revolution' }],
        answer: 2, ev: 'wuxu',
        why: { zh: '维新派要求发展资本主义、实行君主立宪，传播了西方政治学说；地主阶级自救运动指洋务运动，新民主主义革命开端是五四运动。', en: 'The reformers sought capitalism and constitutional monarchy and spread Western political ideas; the landlords’ self-rescue was Self-Strengthening, and the New Democratic Revolution began in 1919.' },
      },
      { order: ['opium_war', 'taiping', 'yangwu', 'jiawu', 'wuxu'] },
      { where: 'humen', tol: 300 },
    ],
    keys: [
      { zh: '鸦片战争后中国开始沦为半殖民地半封建社会；《辛丑条约》签订后完全沦为半殖民地半封建社会。', en: 'After the Opium War China began to become semi-colonial and semi-feudal; after the Boxer Protocol of 1901 it became so completely.' },
      { zh: '太平天国是农民运动的高峰；洋务运动开启了中国近代化；戊戌变法是资产阶级维新运动和思想启蒙运动。', en: 'The Taiping marked the peak of peasant revolt, Self-Strengthening began modernisation, and the 1898 reform was a bourgeois reform and awakening.' },
      { zh: '《马关条约》允许日本在华设厂，反映了列强对华资本输出，民族危机空前严重。', en: 'The Treaty of Shimonoseki let Japan build factories in China, marking the export of capital and a gravely deepened national crisis.' },
    ],
  },
  {
    id: 'hs1-6', book: 'hs1', unit: 6, minutes: 12,
    title: { zh: '辛亥革命与中华民国的建立', en: 'The 1911 Revolution and the Republic of China' },
    blurb: { zh: '清末新政与预备立宪，同盟会与三民主义，武昌起义和中华民国成立，辛亥革命的意义与局限。', en: 'Late Qing reforms, the Revolutionary Alliance and the Three Principles, the Wuchang Uprising and the Republic: what 1911 achieved and what it did not.' },
    steps: [
      {
        year: 1901, at: [116, 34, 55],
        title: { zh: '二十世纪初的中国', en: 'China at the turn of the century' },
        body: { zh: '《辛丑条约》后清政府推行“新政”，1905年废除科举，1906年宣布“预备仿行立宪”，1911年却成立“皇族内阁”。民族资本主义有所发展，资产阶级革命派登上历史舞台。', en: 'After the Boxer Protocol the Qing launched the New Policies, ended the examinations in 1905 and promised a constitution in 1906, yet in 1911 formed a cabinet of princes. Chinese-owned industry grew and a bourgeois revolutionary movement took the stage.' },
      },
      {
        ev: 'tongmenghui',
        body: { zh: '1905年中国同盟会在东京成立，是第一个全国性的资产阶级革命政党。孙中山把它的纲领阐发为民族、民权、民生三民主义，成为资产阶级民主革命纲领。', en: 'Founded in Tokyo in 1905, the Revolutionary Alliance was China’s first nationwide bourgeois revolutionary party. Sun Yat-sen set out its programme as the Three Principles of nationalism, democracy and the people’s livelihood.' },
      },
      { ev: 'jingzhang' },
      {
        ev: 'wuchang',
        body: { zh: '1911年10月10日武昌起义爆发，各省纷纷宣布独立，清朝统治迅速土崩瓦解。', en: 'The Wuchang Uprising broke out on 10 October 1911; province after province declared independence and Qing rule fell apart.' },
      },
      {
        ev: 'roc_found', polity: 'roc',
        body: { zh: '1912年1月1日中华民国成立，3月颁布《中华民国临时约法》，确立了资产阶级共和国的政治体制。2月清帝退位，统治中国两千多年的君主专制制度结束。', en: 'The Republic of China was founded on 1 January 1912 and its Provisional Constitution of March set up a bourgeois republic. The last emperor abdicated in February, ending more than two thousand years of monarchy.' },
      },
      {
        year: 1912, at: [116, 34, 55],
        title: { zh: '辛亥革命的意义与局限', en: 'What 1911 achieved, and its limits' },
        body: { zh: '辛亥革命推翻了清朝统治，结束了两千多年的君主专制制度，使民主共和观念深入人心；但它没有改变中国半殖民地半封建的社会性质，革命果实被袁世凯窃取。', en: 'The revolution overthrew the Qing, ended two thousand years of monarchy and planted the idea of a democratic republic, but it did not change China’s semi-colonial, semi-feudal society, and Yuan Shikai seized its fruits.' },
      },
      {
        year: 1915, at: [116.4, 39.9, 40],
        title: { zh: '袁世凯复辟帝制', en: 'Yuan Shikai restores the monarchy' },
        body: { zh: '袁世凯就任大总统后独揽大权，1915年底复辟帝制，引发护国战争，次年被迫取消帝制，不久死去。此后北洋军阀分裂割据。', en: 'As president Yuan Shikai gathered all power and at the end of 1915 made himself emperor. The National Protection War forced him to give up the throne the next year, and he soon died; the Beiyang warlords then divided the country.' },
      },
    ],
    checks: [
      {
        q: { zh: '三民主义中，“民权主义”的核心内容是？', en: 'What was the core of the principle of democracy (minquan)?' },
        options: [{ zh: '驱除鞑虏，恢复中华', en: 'Drive out the Manchus and restore China' }, { zh: '推翻君主专制，创立民国', en: 'Overthrow the monarchy and found a republic' }, { zh: '平均地权', en: 'Equalise land rights' }, { zh: '实行君主立宪', en: 'Constitutional monarchy' }],
        answer: 1, ev: 'tongmenghui',
        why: { zh: '民族主义是“驱除鞑虏，恢复中华”，民权主义是“创立民国”，民生主义是“平均地权”；君主立宪是立宪派的主张。', en: 'Nationalism meant driving out the Manchus, democracy meant founding a republic, livelihood meant equalising land rights; constitutional monarchy was the reformers’ aim.' },
      },
      {
        q: { zh: '《中华民国临时约法》的历史地位是？', en: 'What is the historical standing of the 1912 Provisional Constitution?' },
        options: [{ zh: '中国第一部资产阶级共和国性质的宪法文件', en: 'China’s first constitution of a bourgeois republic' }, { zh: '中国第一部社会主义类型的宪法', en: 'China’s first socialist constitution' }, { zh: '确立了君主立宪制', en: 'It set up a constitutional monarchy' }, { zh: '废除了列强强加的不平等条约', en: 'It abolished the unequal treaties' }],
        answer: 0, ev: 'roc_found',
        why: { zh: '临时约法规定主权属于国民全体、实行三权分立，是第一部资产阶级共和国性质的宪法文件；第一部社会主义类型的宪法是1954年宪法。', en: 'It vested sovereignty in the people and separated the powers: the first constitution of a bourgeois republic. The first socialist constitution came in 1954.' },
      },
      {
        q: { zh: '有人说辛亥革命“成功了，也失败了”。说它失败，主要是因为它？', en: 'The 1911 Revolution is said to have both succeeded and failed. In what sense did it fail?' },
        options: [{ zh: '没有推翻清朝统治', en: 'It did not overthrow the Qing' }, { zh: '没有建立共和政体', en: 'It did not set up a republic' }, { zh: '没有改变中国半殖民地半封建的社会性质', en: 'It did not change China’s semi-colonial, semi-feudal society' }, { zh: '没有颁布宪法性文件', en: 'It issued no constitution' }],
        answer: 2, ev: 'wuchang',
        why: { zh: '辛亥革命推翻了清朝、建立了共和、颁布了临时约法，但没有完成反帝反封建的任务，社会性质没有改变，果实被袁世凯窃取。', en: 'It overthrew the Qing, founded a republic and issued a constitution, but did not end imperialist and feudal domination; society was unchanged and Yuan Shikai took power.' },
      },
      { order: ['tongmenghui', 'jingzhang', 'wuchang', 'roc_found'] },
      { where: 'wuchang', tol: 300 },
    ],
    keys: [
      { zh: '同盟会是第一个全国性的资产阶级革命政党，三民主义是资产阶级民主革命纲领。', en: 'The Revolutionary Alliance was the first nationwide bourgeois revolutionary party, and the Three Principles its democratic programme.' },
      { zh: '辛亥革命推翻了清朝统治，结束了两千多年的君主专制制度，使民主共和观念深入人心。', en: 'The 1911 Revolution overthrew the Qing, ended two thousand years of monarchy and made democratic republicanism take root.' },
      { zh: '《临时约法》是第一部资产阶级共和国性质的宪法文件；辛亥革命没有改变中国社会性质，果实被袁世凯窃取。', en: 'The Provisional Constitution was the first of a bourgeois republic; but the revolution left society unchanged and Yuan Shikai seized its fruits.' },
    ],
  },
  {
    id: 'hs1-7', book: 'hs1', unit: 7, minutes: 15,
    title: { zh: '中国共产党成立与新民主主义革命兴起', en: 'The founding of the CPC and the rise of the New Democratic Revolution' },
    blurb: { zh: '新文化运动与五四运动，中国共产党诞生，国共合作与国民革命，土地革命和农村包围城市道路，长征与遵义会议。', en: 'New Culture and May Fourth, the birth of the CPC, the National Revolution, the agrarian revolution and its rural road to power, the Long March and Zunyi.' },
    steps: [
      {
        year: 1914, at: [112, 33, 70],
        title: { zh: '北洋统治下的中国', en: 'China under the Beiyang warlords' },
        body: { zh: '第一次世界大战期间，欧洲列强暂时放松对华经济侵略，民族资本主义进入发展的“短暂的春天”，工人阶级队伍壮大；北洋政府则掀起尊孔复古逆流。', en: 'During the First World War the European powers eased their economic grip on China; Chinese industry enjoyed a brief spring and the working class grew, while the Beiyang government promoted a return to Confucian orthodoxy.' },
      },
      {
        ev: 'xinwenhua',
        body: { zh: '新文化运动高举民主和科学两面大旗，是一次空前的思想解放运动。俄国十月革命后，李大钊等开始在中国宣传马克思主义。', en: 'The New Culture Movement raised the banners of democracy and science, an unprecedented liberation of thought. After the October Revolution Li Dazhao and others began to spread Marxism in China.' },
      },
      {
        ev: 'may4',
        body: { zh: '五四运动是一次彻底反帝反封建的爱国运动，中国工人阶级开始登上政治舞台，是中国新民主主义革命的开端。', en: 'The May Fourth Movement was a thoroughly anti-imperialist, anti-feudal patriotic movement; the working class entered politics, and it marks the start of the New Democratic Revolution.' },
      },
      {
        ev: 'cpc_found',
        body: { zh: '中国共产党是马克思列宁主义同中国工人运动相结合的产物。中国共产党的成立是开天辟地的大事变，中国革命从此面目焕然一新。', en: 'The Communist Party of China grew out of the union of Marxism–Leninism with the Chinese labour movement. Its founding was an epoch-making event that transformed the Chinese revolution.' },
      },
      {
        ev: 'huangpu',
        body: { zh: '1924年国民党一大召开，标志着第一次国共合作正式形成；同年创办黄埔军校。1926年国民革命军出师北伐，基本推翻了北洋军阀的统治。', en: 'The Guomindang’s first congress in 1924 formalised the first CPC–Guomindang alliance and the Whampoa Military Academy was founded. From 1926 the Northern Expedition largely overthrew the Beiyang warlords.' },
      },
      {
        ev: 'nanchang',
        body: { zh: '1927年蒋介石、汪精卫先后叛变革命，国民大革命失败。南昌起义打响了武装反抗国民党反动派的第一枪，八七会议确定了土地革命和武装反抗国民党反动派的总方针。', en: 'In 1927 Chiang Kai-shek and Wang Jingwei turned on their allies and the National Revolution failed. The Nanchang Uprising fired the first shot of armed resistance, and the August 7th meeting set the course of land revolution and armed struggle.' },
      },
      {
        ev: 'jinggang',
        body: { zh: '毛泽东率秋收起义部队进军井冈山，创建第一个农村革命根据地，开辟了农村包围城市、武装夺取政权的革命道路。', en: 'Mao Zedong led the Autumn Harvest troops to the Jinggang Mountains and built the first rural base, opening the road of surrounding the cities from the countryside and seizing power by arms.' },
      },
      {
        ev: 'zunyi',
        body: { zh: '第五次反“围剿”失败后红军被迫长征。1935年遵义会议事实上确立了毛泽东在党中央和红军的领导地位，是党的历史上一个生死攸关的转折点。', en: 'After the fifth encirclement campaign the Red Army set out on the Long March. The 1935 Zunyi Conference in effect confirmed Mao Zedong’s leadership of the Party and the army, a life-or-death turning point in Party history.' },
      },
    ],
    checks: [
      {
        q: { zh: '五四运动成为中国新民主主义革命开端的主要标志是？', en: 'Why does the May Fourth Movement mark the start of the New Democratic Revolution?' },
        options: [{ zh: '青年学生是运动的先锋', en: 'Students led the way' }, { zh: '中国工人阶级开始登上政治舞台', en: 'The Chinese working class entered politics' }, { zh: '提出了民主和科学的口号', en: 'It raised the call for democracy and science' }, { zh: '中国代表拒绝在和约上签字', en: 'China’s delegates refused to sign the peace treaty' }],
        answer: 1, ev: 'may4',
        why: { zh: '六三以后上海工人罢工，工人阶级以独立的姿态登上政治舞台，这是新民主主义革命开端的重要标志；民主和科学是新文化运动的口号。', en: 'From June the Shanghai workers struck, entering politics as an independent force; democracy and science were the New Culture slogans.' },
      },
      {
        q: { zh: '中国共产党探索农村包围城市、武装夺取政权道路的开端是？', en: 'Where did the CPC begin the road of surrounding the cities from the countryside?' },
        options: [{ zh: '南昌起义', en: 'The Nanchang Uprising' }, { zh: '八七会议', en: 'The August 7th meeting' }, { zh: '井冈山革命根据地的创建', en: 'Founding the Jinggangshan base' }, { zh: '遵义会议', en: 'The Zunyi Conference' }],
        answer: 2, ev: 'jinggang',
        why: { zh: '井冈山革命根据地是第一个农村革命根据地，由此开辟了农村包围城市、武装夺取政权的道路；南昌起义是武装反抗的第一枪。', en: 'Jinggangshan was the first rural base and opened that road; Nanchang was the first shot of armed resistance.' },
      },
      {
        q: { zh: '遵义会议被称为党的历史上“生死攸关的转折点”，主要因为它？', en: 'Why is the Zunyi Conference called a life-or-death turning point?' },
        options: [{ zh: '确定了土地革命的总方针', en: 'It set the course of land revolution' }, { zh: '实现了第一次国共合作', en: 'It formed the first CPC–Guomindang alliance' }, { zh: '标志着红军长征的胜利结束', en: 'It marked the end of the Long March' }, { zh: '事实上确立了毛泽东在党中央和红军的领导地位', en: 'It in effect confirmed Mao Zedong’s leadership of the Party and the army' }],
        answer: 3, ev: 'zunyi',
        why: { zh: '遵义会议纠正了“左”倾错误的军事指挥，在最危急的关头挽救了党、挽救了红军、挽救了中国革命；土地革命方针由八七会议确定。', en: 'Zunyi corrected the leftist military command and saved the Party, the Red Army and the revolution at its darkest hour; the land-revolution course was set at the August 7th meeting.' },
      },
      { order: ['xinwenhua', 'may4', 'cpc_found', 'huangpu', 'nanchang'] },
      { where: 'jinggang', tol: 300 },
    ],
    keys: [
      { zh: '新文化运动是思想解放运动，五四运动是新民主主义革命的开端。', en: 'New Culture liberated thought; May Fourth began the New Democratic Revolution.' },
      { zh: '中国共产党的成立是开天辟地的大事变，中国革命从此面目焕然一新。', en: 'The founding of the CPC was epoch-making and transformed the Chinese revolution.' },
      { zh: '国民大革命失败后，中国共产党开辟了农村包围城市、武装夺取政权的革命道路。', en: 'After 1927 the CPC opened the road of surrounding the cities from the countryside and seizing power by arms.' },
      { zh: '遵义会议是党的历史上一个生死攸关的转折点。', en: 'The Zunyi Conference was a life-or-death turning point in Party history.' },
    ],
  },
  {
    id: 'hs1-8', book: 'hs1', unit: 8, minutes: 15,
    title: { zh: '中华民族的抗日战争和人民解放战争', en: 'The War of Resistance against Japan and the War of Liberation' },
    blurb: { zh: '从局部抗战到全民族抗战，正面战场与敌后战场，抗战胜利的意义，人民解放战争的胜利。', en: 'From local to nationwide resistance, the front line and the war behind enemy lines, the meaning of victory in 1945, and the People’s Liberation War.' },
    steps: [
      {
        year: 1931, at: [118, 38, 60],
        title: { zh: '局部抗战的开始', en: 'Resistance begins in the north-east' },
        body: { zh: '1931年日本发动九一八事变，东北人民和爱国官兵奋起抵抗，中国人民的局部抗战由此开始。中国是世界反法西斯战争中开始最早、持续时间最长的国家。', en: 'Japan’s Mukden Incident of 1931 met resistance from the people and patriotic soldiers of the north-east: China’s local War of Resistance had begun, the earliest and longest fight of the world’s anti-fascist war.' },
      },
      { ev: 'sept18' },
      {
        ev: 'xian_incident',
        body: { zh: '1936年西安事变和平解决，十年内战基本结束，成为时局转换的枢纽，国共两党由内战走向第二次合作。', en: 'The peaceful settlement of the Xi’an Incident in 1936 all but ended ten years of civil war and became the hinge of the situation: the two parties moved from war to a second alliance.' },
      },
      {
        ev: 'july7',
        body: { zh: '七七事变标志着全民族抗战的开始。国民党公布中共中央递交的国共合作宣言，抗日民族统一战线正式形成。', en: 'The Marco Polo Bridge Incident began the nationwide war. When the Guomindang published the CPC’s declaration of cooperation, the Anti-Japanese National United Front was formally established.' },
      },
      {
        year: 1938, at: [114, 33, 50], polity: 'jp_occ',
        title: { zh: '正面战场与敌后战场', en: 'The front line and behind enemy lines' },
        body: { zh: '国民党军队担负正面战场作战，进行了淞沪、台儿庄等会战；中国共产党领导八路军、新四军开辟敌后战场，建立抗日根据地。两个战场相互配合，构成中国抗战的整体。', en: 'Guomindang armies held the front line in battles such as Shanghai and Taierzhuang; the CPC’s Eighth Route and New Fourth Armies opened a front behind enemy lines and built base areas. The two fronts together made up China’s war.' },
      },
      { ev: 'baituan' },
      {
        ev: 'victory1945',
        body: { zh: '抗日战争的胜利是近代以来中国反抗外敌入侵第一次取得完全胜利的民族解放战争，台湾回归祖国；中国为世界反法西斯战争的胜利作出了重大贡献，国际地位显著提高。', en: 'Victory in 1945 was China’s first complete victory over a foreign invader in modern times, and Taiwan returned to China. China made a major contribution to the world’s defeat of fascism and its international standing rose.' },
      },
      {
        ev: 'sanda',
        body: { zh: '1946年国民党挑起全面内战。人民解放军由战略防御转入战略进攻，1948年至1949年初进行辽沈、淮海、平津三大战役，基本消灭了国民党军队主力。', en: 'The Guomindang launched all-out civil war in 1946. The People’s Liberation Army went from defence to the offensive, and the Liaoshen, Huaihai and Pingjin campaigns of 1948–49 destroyed the bulk of the Guomindang armies.' },
      },
    ],
    checks: [
      {
        q: { zh: '西安事变和平解决的历史意义是？', en: 'What was the significance of the peaceful settlement of the Xi’an Incident?' },
        options: [{ zh: '成为时局转换的枢纽，十年内战基本结束', en: 'It turned the situation and all but ended ten years of civil war' }, { zh: '标志着全民族抗战的开始', en: 'It began the nationwide War of Resistance' }, { zh: '标志着第一次国共合作的形成', en: 'It formed the first CPC–Guomindang alliance' }, { zh: '粉碎了日军“三个月灭亡中国”的计划', en: 'It foiled Japan’s plan to conquer China in three months' }],
        answer: 0, ev: 'xian_incident',
        why: { zh: '西安事变和平解决促成国共再度合作；全民族抗战始于七七事变，第一次国共合作形成于1924年，粉碎“三个月灭亡中国”的是淞沪会战。', en: 'It led the parties back to cooperation; the nationwide war began on 7 July 1937, the first alliance dates from 1924, and the Battle of Shanghai foiled the three-month plan.' },
      },
      {
        q: { zh: '台儿庄战役和百团大战分别属于？', en: 'The Battle of Taierzhuang and the Hundred Regiments Offensive belonged to which fronts?' },
        options: [{ zh: '敌后战场、正面战场', en: 'Behind the lines; the front line' }, { zh: '正面战场、敌后战场', en: 'The front line; behind the lines' }, { zh: '都属于正面战场', en: 'Both the front line' }, { zh: '都属于敌后战场', en: 'Both behind the lines' }],
        answer: 1, ev: 'taierzhuang',
        why: { zh: '台儿庄战役由李宗仁指挥，是正面战场的大胜；百团大战由八路军发动，是敌后战场规模最大的主动出击。', en: 'Taierzhuang, under Li Zongren, was a front-line victory; the Hundred Regiments Offensive was the Eighth Route Army’s largest attack behind enemy lines.' },
      },
      {
        q: { zh: '中国人民抗日战争胜利的历史意义是？', en: 'What was the historical significance of victory in the War of Resistance?' },
        options: [{ zh: '结束了两千多年的君主专制制度', en: 'It ended two thousand years of monarchy' }, { zh: '推翻了国民党在大陆的统治', en: 'It overthrew Guomindang rule on the mainland' }, { zh: '结束了半殖民地半封建社会', en: 'It ended semi-colonial, semi-feudal society' }, { zh: '是近代以来中国反抗外敌入侵第一次取得完全胜利的民族解放战争', en: 'It was China’s first complete victory over a foreign invader in modern times' }],
        answer: 3, ev: 'victory1945',
        why: { zh: '抗战胜利洗雪了近代以来的民族耻辱；结束君主专制的是辛亥革命，推翻国民党统治、结束半殖民地半封建社会的是新民主主义革命的胜利（1949年）。', en: 'Victory wiped out a century of national humiliation; monarchy ended in 1911, and Guomindang rule and the old society ended with the revolution’s victory in 1949.' },
      },
      { order: ['sept18', 'xian_incident', 'july7', 'victory1945', 'sanda'] },
      { where: 'taierzhuang', tol: 300 },
    ],
    keys: [
      { zh: '九一八事变是中国人民局部抗战的开始，七七事变是全民族抗战的开始。', en: 'The Mukden Incident began local resistance; the Marco Polo Bridge Incident began the nationwide war.' },
      { zh: '正面战场与敌后战场相互配合；中国共产党是全民族抗战的中流砥柱。', en: 'The front line and the war behind the lines worked together; the CPC was the mainstay of the nation’s resistance.' },
      { zh: '抗日战争是近代以来中国反抗外敌入侵第一次取得完全胜利的民族解放战争。', en: 'The War of Resistance was China’s first complete victory over a foreign invader in modern times.' },
      { zh: '三大战役基本消灭了国民党军队主力，渡江战役后国民党在大陆的统治覆灭。', en: 'The three great campaigns destroyed the main Guomindang armies, and after the Yangtze crossing its rule on the mainland collapsed.' },
    ],
  },
  {
    id: 'hs1-9', book: 'hs1', unit: 9, minutes: 15,
    title: { zh: '中华人民共和国成立和社会主义革命与建设', en: 'Founding of the PRC; socialist revolution and construction' },
    blurb: { zh: '新中国成立与政权巩固，基本政治制度的确立，三大改造与社会主义制度建立，社会主义建设在探索中曲折发展。', en: 'The founding of the PRC and securing the new state, its basic political institutions, socialist transformation, and socialist construction through trial and setback.' },
    steps: [
      {
        year: 1949, at: [108, 34, 60],
        title: { zh: '从新民主主义到社会主义', en: 'From New Democracy to socialism' },
        body: { zh: '1949年9月中国人民政治协商会议召开，通过起临时宪法作用的《共同纲领》。新中国成立后，面临巩固政权、恢复国民经济的任务，随后逐步实现向社会主义的过渡。', en: 'In September 1949 the Chinese People’s Political Consultative Conference adopted the Common Programme as an interim constitution. The new state had first to secure its power and restore the economy, then made its transition to socialism.' },
      },
      {
        ev: 'founding', polity: 'prc',
        body: { zh: '中华人民共和国的成立，标志着中国新民主主义革命取得伟大胜利，结束了一百多年来被侵略被奴役的屈辱历史，中国人民从此站起来了。', en: 'The founding of the People’s Republic marked the victory of the New Democratic Revolution and ended over a century of invasion and humiliation: the Chinese people had stood up.' },
      },
      {
        ev: 'tugai',
        body: { zh: '土地改革彻底废除了封建土地制度，农民成为土地的主人，巩固了人民政权，为国家工业化创造了条件。', en: 'Land reform abolished the feudal land system for good; the peasants became the owners of the land, strengthening the people’s state and preparing industrialisation.' },
      },
      { ev: 'kangmei' },
      {
        ev: 'constitution54',
        body: { zh: '1954年第一届全国人民代表大会通过《中华人民共和国宪法》。人民代表大会制度是我国的根本政治制度；中国共产党领导的多党合作和政治协商制度、民族区域自治制度也相继确立。', en: 'The first National People’s Congress adopted the Constitution in 1954. The people’s congress system became the fundamental political system, alongside multi-party cooperation and consultation under CPC leadership and regional ethnic autonomy.' },
      },
      {
        ev: 'sanda_gaizao',
        body: { zh: '过渡时期总路线要求逐步实现社会主义工业化和对农业、手工业、资本主义工商业的社会主义改造。1956年三大改造基本完成，社会主义基本制度在我国确立。', en: 'The general line for the transition called for socialist industrialisation and the transformation of agriculture, handicrafts and capitalist business. With these largely complete in 1956, China’s basic socialist system was established.' },
      },
      {
        year: 1958, at: [112, 34, 55],
        title: { zh: '在探索中曲折发展', en: 'Exploration, with setbacks' },
        body: { zh: '1956年中共八大提出集中力量发展社会生产力。此后“大跃进”和人民公社化运动出现严重失误，1966年至1976年的“文化大革命”使国家遭到新中国成立以来最严重的挫折，但建设仍取得一批重大成就。', en: 'In 1956 the Eighth Party Congress called for concentrating on developing the productive forces. The Great Leap Forward and the people’s communes brought grave errors, and the Cultural Revolution of 1966–76 was the worst setback since 1949, yet major achievements were still made.' },
      },
      { ev: 'liangdan' },
    ],
    checks: [
      {
        q: { zh: '新中国成立前夕，起临时宪法作用的文件是？', en: 'Which document served as the interim constitution when the PRC was founded?' },
        options: [{ zh: '《中国人民政治协商会议共同纲领》', en: 'The Common Programme of the CPPCC' }, { zh: '《中华民国临时约法》', en: 'The Provisional Constitution of the Republic of China' }, { zh: '1954年《中华人民共和国宪法》', en: 'The 1954 Constitution of the PRC' }, { zh: '《论十大关系》', en: 'On the Ten Major Relationships' }],
        answer: 0, ev: 'founding',
        why: { zh: '1949年9月政协会议通过的《共同纲领》在1954年宪法颁布前起临时宪法的作用；《临时约法》是1912年的文件。', en: 'The Common Programme, adopted in September 1949, served until the 1954 Constitution; the Provisional Constitution dates from 1912.' },
      },
      {
        q: { zh: '1956年三大改造基本完成，标志着？', en: 'What did the largely completed socialist transformation of 1956 mark?' },
        options: [{ zh: '新民主主义革命取得胜利', en: 'Victory of the New Democratic Revolution' }, { zh: '封建土地制度被彻底废除', en: 'The end of the feudal land system' }, { zh: '改革开放新时期的开始', en: 'The start of reform and opening-up' }, { zh: '社会主义基本制度在我国确立', en: 'The establishment of China’s basic socialist system' }],
        answer: 3, ev: 'sanda_gaizao',
        why: { zh: '三大改造实现了生产资料私有制向社会主义公有制的转变，我国进入社会主义初级阶段；废除封建土地制度是土地改革的成果。', en: 'The transformation turned private ownership of the means of production into socialist public ownership; ending feudal landholding was the work of land reform.' },
      },
      {
        q: { zh: '我国的根本政治制度是？', en: 'What is China’s fundamental political system?' },
        options: [{ zh: '中国共产党领导的多党合作和政治协商制度', en: 'Multi-party cooperation and political consultation under CPC leadership' }, { zh: '人民代表大会制度', en: 'The system of people’s congresses' }, { zh: '民族区域自治制度', en: 'Regional ethnic autonomy' }, { zh: '基层群众自治制度', en: 'Grassroots self-government' }],
        answer: 1, ev: 'constitution54',
        why: { zh: '1954年宪法确立人民代表大会制度为根本政治制度；多党合作和政治协商制度、民族区域自治制度、基层群众自治制度是基本政治制度。', en: 'The 1954 Constitution made the people’s congresses the fundamental system; the other three are basic political systems.' },
      },
      { order: ['founding', 'kangmei', 'five_year', 'constitution54', 'un_seat'] },
      { where: 'daqing', tol: 400 },
    ],
    keys: [
      { zh: '新中国成立标志着新民主主义革命的伟大胜利，中国人民从此站起来了。', en: 'The founding of the PRC marked the victory of the New Democratic Revolution: the Chinese people had stood up.' },
      { zh: '1954年宪法确立人民代表大会制度为根本政治制度。', en: 'The 1954 Constitution made the people’s congress system China’s fundamental political system.' },
      { zh: '1956年三大改造基本完成，社会主义基本制度在我国确立。', en: 'With socialist transformation largely complete in 1956, China’s basic socialist system was established.' },
      { zh: '社会主义建设在探索中曲折发展，既有严重失误，也取得“两弹一星”等重大成就。', en: 'Socialist construction advanced through trial and setback, with grave errors but also achievements such as the bombs and the first satellite.' },
    ],
  },
  {
    id: 'hs1-10', book: 'hs1', unit: 10, minutes: 12,
    title: { zh: '改革开放与社会主义现代化建设新时期', en: 'Reform and opening-up and the new era of modernisation' },
    blurb: { zh: '十一届三中全会的伟大转折，农村和城市改革，对外开放格局的形成，社会主义市场经济体制，“一国两制”的实践。', en: 'The great turning point of 1978, rural and urban reform, opening to the world, the socialist market economy and “one country, two systems”.' },
    steps: [
      {
        year: 1978, at: [110, 33, 60],
        title: { zh: '历史的转折', en: 'A historic turn' },
        body: { zh: '1976年“文化大革命”结束后，国家百废待兴。1978年关于真理标准问题的讨论冲破了“两个凡是”的束缚，为历史性的转折作了思想准备。', en: 'When the Cultural Revolution ended in 1976 the country had much to rebuild. The 1978 debate on the criterion of truth broke the hold of the “two whatevers” and prepared minds for a historic turn.' },
      },
      {
        ev: 'third_plenum',
        body: { zh: '十一届三中全会重新确立解放思想、实事求是的思想路线，把工作重点转移到经济建设上来，作出改革开放的历史性决策，开启了改革开放和社会主义现代化建设新时期。', en: 'The Third Plenum of the 11th Central Committee restored the line of emancipating the mind and seeking truth from facts, shifted the focus to economic development and decided on reform and opening-up, opening a new era.' },
      },
      {
        ev: 'xiaogang',
        body: { zh: '改革首先在农村取得突破，家庭联产承包责任制调动了农民的生产积极性。1984年后改革重点转向城市，以增强企业活力为中心环节。', en: 'Reform broke through first in the countryside, where the household responsibility system fired farmers’ initiative. From 1984 the focus moved to the cities, centred on invigorating enterprises.' },
      },
      {
        ev: 'shenzhen',
        body: { zh: '从设立经济特区，到开放沿海港口城市、开发开放上海浦东，我国逐步形成全方位、多层次、宽领域的对外开放格局。', en: 'From the special economic zones to the open coastal cities and Shanghai’s Pudong, China built up opening on all fronts, at many levels and in many fields.' },
      },
      {
        ev: 'nanxun',
        body: { zh: '1992年邓小平南方谈话回答了长期困扰人们思想的重大问题；同年中共十四大确立建立社会主义市场经济体制的改革目标。', en: 'Deng Xiaoping’s 1992 southern tour answered questions that had long troubled people, and the 14th Party Congress that year made a socialist market economy the goal of reform.' },
      },
      {
        ev: 'hk_return',
        body: { zh: '“一国两制”的伟大构想在香港、澳门成功实践：1997年香港回归，1999年澳门回归，洗雪了百年耻辱。', en: '“One country, two systems” was put into practice: Hong Kong returned in 1997 and Macao in 1999, wiping out a century of humiliation.' },
      },
      { ev: 'wto' },
    ],
    checks: [
      {
        q: { zh: '中共十一届三中全会的历史意义是？', en: 'What was the historical significance of the Third Plenum of 1978?' },
        options: [{ zh: '实现了从新民主主义到社会主义的转变', en: 'It completed the move from New Democracy to socialism' }, { zh: '开启了改革开放和社会主义现代化建设新时期', en: 'It opened the new era of reform, opening-up and modernisation' }, { zh: '确立了社会主义市场经济体制的改革目标', en: 'It set the goal of a socialist market economy' }, { zh: '确立了人民代表大会制度', en: 'It established the people’s congress system' }],
        answer: 1, ev: 'third_plenum',
        why: { zh: '十一届三中全会是新中国成立以来党的历史上具有深远意义的伟大转折；市场经济目标由1992年十四大确立。', en: 'The plenum was a turning point of far-reaching significance; the market-economy goal came with the 14th Congress in 1992.' },
      },
      {
        q: { zh: '我国农村经济体制改革的主要内容是？', en: 'What was the main content of China’s rural reform?' },
        options: [{ zh: '实行人民公社化', en: 'Setting up people’s communes' }, { zh: '进行土地改革', en: 'Carrying out land reform' }, { zh: '实行家庭联产承包责任制', en: 'Introducing the household responsibility system' }, { zh: '完成对农业的社会主义改造', en: 'Completing the socialist transformation of agriculture' }],
        answer: 2, ev: 'xiaogang',
        why: { zh: '家庭联产承包责任制在坚持土地集体所有的前提下实行家庭经营，调动了农民积极性；其余选项都是改革开放以前的事。', en: 'The household responsibility system kept land collectively owned but let families farm it, firing their initiative; the other options all predate 1978.' },
      },
      {
        q: { zh: '1992年中共十四大确立的经济体制改革目标是？', en: 'What goal of economic reform did the 14th Party Congress set in 1992?' },
        options: [{ zh: '计划经济为主、市场调节为辅', en: 'Planning first, the market as supplement' }, { zh: '有计划的商品经济', en: 'A planned commodity economy' }, { zh: '建立社会主义市场经济体制', en: 'A socialist market economy' }, { zh: '优先发展重工业', en: 'Priority for heavy industry' }],
        answer: 2, ev: 'nanxun',
        why: { zh: '南方谈话指出计划和市场都是经济手段，十四大据此确立了建立社会主义市场经济体制的目标；前两项是此前不同阶段的提法。', en: 'The southern tour argued that plan and market are both economic tools, and the 14th Congress set the goal of a socialist market economy; the first two were earlier formulas.' },
      },
      { order: ['third_plenum', 'shenzhen', 'nanxun', 'hk_return', 'wto'] },
      { where: 'shenzhen', tol: 300 },
    ],
    keys: [
      { zh: '十一届三中全会是新中国成立以来党的历史上具有深远意义的伟大转折，开启了改革开放新时期。', en: 'The 1978 Third Plenum was a turning point of far-reaching significance that opened the era of reform and opening-up.' },
      { zh: '改革从农村家庭联产承包责任制开始，逐步推向城市；对外开放形成全方位、多层次、宽领域的格局。', en: 'Reform began with the household responsibility system and spread to the cities; opening-up reached all fronts and levels.' },
      { zh: '1992年中共十四大确立建立社会主义市场经济体制的改革目标。', en: 'In 1992 the 14th Party Congress set the goal of a socialist market economy.' },
      { zh: '“一国两制”在香港、澳门成功实践。', en: '“One country, two systems” was successfully applied in Hong Kong and Macao.' },
    ],
  },
];
