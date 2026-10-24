import type { DestinationCategory } from "@/types";

// Seasonal quests for the 掲示板 (quest board). Peak windows are typical
// years ("例年"), not live reports — the UI says so.
// Spot coordinates were checked against ja.wikipedia / Wikidata.

export type EventSpot = {
  id: string;
  name: string;
  /** ja.wikipedia article, for the description and photos. */
  wiki: string;
  prefectureId: string;
  latitude: number;
  longitude: number;
  /** Typical peak, "MM-DD" → "MM-DD" (may wrap past New Year). */
  peak: readonly [string, string];
  note: string;
  image?: string;
};

export type QuestGoal = {
  id: string;
  label: string;
  /** Spots to complete (distinct). */
  count: number;
  /** Only arrivals confirmed by GPS count. */
  verified?: boolean;
  xp: number;
  title?: string;
};

export type TravelEvent = {
  id: string;
  title: string;
  /** Two characters for the hanko seal. */
  seal: string;
  emoji: string;
  tagline: string;
  description: string;
  /** Yearly window, "MM-DD" → "MM-DD" (wraps when start > end). */
  window: readonly [string, string];
  categories: DestinationCategory[];
  /** Seal / pin colour. */
  color: string;
  peakLabels: { before: string; soon: string; peak: string; after: string };
  goals: QuestGoal[];
  spots: EventSpot[];
};

const MOMIJI_SPOTS: EventSpot[] = [
  { id: "kurodake", name: "大雪山・黒岳", wiki: "黒岳 (北海道)", prefectureId: "hokkaido", latitude: 43.6975, longitude: 142.92028, peak: ["09-20", "10-05"], note: "日本でいちばん早い紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Kurodake_seen_from_the_SW.jpg/500px-Kurodake_seen_from_the_SW.jpg" },
  { id: "jozankei", name: "定山渓", wiki: "定山渓温泉", prefectureId: "hokkaido", latitude: 42.96444, longitude: 141.16139, peak: ["10-05", "10-20"], note: "渓谷を染める温泉街の紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/TsukimiBashi2004-12.jpg/500px-TsukimiBashi2004-12.jpg" },
  { id: "oirase", name: "奥入瀬渓流", wiki: "奥入瀬渓流", prefectureId: "aomori", latitude: 40.52528, longitude: 140.9745, peak: ["10-18", "10-31"], note: "清流と滝と紅葉の遊歩道", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Oirase-keiryu.jpg/500px-Oirase-keiryu.jpg" },
  { id: "hakkoda", name: "八甲田山", wiki: "八甲田山", prefectureId: "aomori", latitude: 40.65883, longitude: 140.87725, peak: ["10-01", "10-15"], note: "山肌一面のパッチワーク", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Hakkodasan_seen_from_the_northwest.jpg/500px-Hakkodasan_seen_from_the_northwest.jpg" },
  { id: "chusonji", name: "中尊寺", wiki: "中尊寺", prefectureId: "iwate", latitude: 39.00153, longitude: 141.10272, peak: ["10-25", "11-10"], note: "金色堂と月見坂の紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/230728_Chusonji_Hiraizumi_Iwate_pref_Japan01s3.jpg/500px-230728_Chusonji_Hiraizumi_Iwate_pref_Japan01s3.jpg" },
  { id: "dakigaeri", name: "抱返り渓谷", wiki: "抱返り渓谷", prefectureId: "akita", latitude: 39.61111, longitude: 140.66667, peak: ["10-18", "11-02"], note: "神秘的な青い渓流", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Dakigaeri_Gorge_and_Kamino-iwahashi_20201101.jpg/500px-Dakigaeri_Gorge_and_Kamino-iwahashi_20201101.jpg" },
  { id: "narukokyo", name: "鳴子峡", wiki: "鳴子峡", prefectureId: "miyagi", latitude: 38.73639, longitude: 140.69222, peak: ["10-22", "11-05"], note: "V字峡谷を彩る秋", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/%E9%B3%B4%E5%AD%90%E5%B3%A1%E5%A4%A7%E6%B7%B1%E6%B2%A2%E6%A9%8B%E3%82%92%E6%9C%9B%E3%82%80.JPG/500px-%E9%B3%B4%E5%AD%90%E5%B3%A1%E5%A4%A7%E6%B7%B1%E6%B2%A2%E6%A9%8B%E3%82%92%E6%9C%9B%E3%82%80.JPG" },
  { id: "yamadera", name: "山寺（立石寺）", wiki: "立石寺", prefectureId: "yamagata", latitude: 38.31256, longitude: 140.43739, peak: ["10-25", "11-08"], note: "千段の石段と紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Risshaku-ji_konponchudo.jpg/500px-Risshaku-ji_konponchudo.jpg" },
  { id: "bandai", name: "磐梯吾妻スカイライン", wiki: "磐梯吾妻道路", prefectureId: "fukushima", latitude: 37.7291, longitude: 140.25938, peak: ["10-05", "10-25"], note: "空中を走る紅葉ドライブ", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/South_gate_entrance_of_Bandai-Aduma_skyline.jpg/500px-South_gate_entrance_of_Bandai-Aduma_skyline.jpg" },
  { id: "irohazaka", name: "いろは坂", wiki: "いろは坂", prefectureId: "tochigi", latitude: 36.7377, longitude: 139.525, peak: ["10-15", "10-31"], note: "48のカーブと錦秋" },
  { id: "ryuzu", name: "竜頭ノ滝", wiki: "竜頭の滝", prefectureId: "tochigi", latitude: 36.75882, longitude: 139.45126, peak: ["10-10", "10-25"], note: "奥日光いちばんの紅葉" },
  { id: "fukuroda", name: "袋田の滝", wiki: "袋田の滝", prefectureId: "ibaraki", latitude: 36.76419, longitude: 140.40736, peak: ["11-01", "11-20"], note: "四度の滝を包む紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Fukuroda_Falls_38.jpg/500px-Fukuroda_Falls_38.jpg" },
  { id: "fukiware", name: "吹割の滝", wiki: "吹割の滝", prefectureId: "gunma", latitude: 36.70217, longitude: 139.20742, peak: ["10-25", "11-10"], note: "東洋のナイアガラ", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Fukiware_Falls_05.jpg/500px-Fukiware_Falls_05.jpg" },
  { id: "nagatoro", name: "長瀞", wiki: "長瀞", prefectureId: "saitama", latitude: 36.11481, longitude: 139.10972, peak: ["11-12", "11-30"], note: "川下りで見る紅葉" },
  { id: "takao", name: "高尾山", wiki: "高尾山", prefectureId: "tokyo", latitude: 35.62528, longitude: 139.24361, peak: ["11-12", "11-30"], note: "都心から気軽な紅葉登山", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Tokyo-to_g%C3%A9olocalisation_relief.svg/500px-Tokyo-to_g%C3%A9olocalisation_relief.svg.png" },
  { id: "yoro", name: "養老渓谷", wiki: "養老渓谷", prefectureId: "chiba", latitude: 35.25761, longitude: 140.16008, peak: ["11-25", "12-10"], note: "関東でいちばん遅い紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Yoro_Keikoku_04.JPG/500px-Yoro_Keikoku_04.JPG" },
  { id: "oyama-kanagawa", name: "大山", wiki: "大山 (神奈川県)", prefectureId: "kanagawa", latitude: 35.44083, longitude: 139.23111, peak: ["11-12", "11-30"], note: "ライトアップの紅葉参道", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Mt.Oyama_from_Shibusawa_Hill_Range_01.jpg/500px-Mt.Oyama_from_Shibusawa_Hill_Range_01.jpg" },
  { id: "kawaguchiko", name: "河口湖", wiki: "河口湖", prefectureId: "yamanashi", latitude: 35.51778, longitude: 138.75611, peak: ["11-01", "11-20"], note: "富士山と紅葉の回廊", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/KawaguchiKo.jpg/500px-KawaguchiKo.jpg" },
  { id: "shosenkyo", name: "昇仙峡", wiki: "昇仙峡", prefectureId: "yamanashi", latitude: 35.745, longitude: 138.56639, peak: ["10-28", "11-15"], note: "奇岩と紅葉の渓谷", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/Kakuenpou_in_autumn.jpg/500px-Kakuenpou_in_autumn.jpg" },
  { id: "kamikochi", name: "上高地", wiki: "上高地", prefectureId: "nagano", latitude: 36.24697, longitude: 137.63333, peak: ["10-10", "10-25"], note: "カラマツが黄金に輝く", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/%E7%A7%8B%E3%81%AE%E4%B8%8A%E9%AB%98%E5%9C%B0_%28Kamikochi_in_autumn%29_24_Oct%2C_2011_-_panoramio.jpg/500px-%E7%A7%8B%E3%81%AE%E4%B8%8A%E9%AB%98%E5%9C%B0_%28Kamikochi_in_autumn%29_24_Oct%2C_2011_-_panoramio.jpg" },
  { id: "karasawa", name: "涸沢", wiki: "涸沢カール", prefectureId: "nagano", latitude: 36.29444, longitude: 137.6625, peak: ["09-25", "10-08"], note: "山岳紅葉の聖地", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Karasawa_Cirque_%28200708%29.jpg/500px-Karasawa_Cirque_%28200708%29.jpg" },
  { id: "korankei", name: "香嵐渓", wiki: "香嵐渓", prefectureId: "aichi", latitude: 35.13184, longitude: 137.31337, peak: ["11-12", "11-30"], note: "4000本のもみじ", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/K%C5%8Drankei.jpg/500px-K%C5%8Drankei.jpg" },
  { id: "shuzenji", name: "修善寺", wiki: "修善寺温泉", prefectureId: "shizuoka", latitude: 34.97047, longitude: 138.92753, peak: ["11-20", "12-08"], note: "竹林の小径ともみじ林", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/181124_Shuzenji_Onsen_Izu_Shizuoka_pref_Japan01s3.jpg/500px-181124_Shuzenji_Onsen_Izu_Shizuoka_pref_Japan01s3.jpg" },
  { id: "kenrokuen", name: "兼六園", wiki: "兼六園", prefectureId: "ishikawa", latitude: 36.56214, longitude: 136.6625, peak: ["11-05", "11-25"], note: "日本三名園の秋", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Kenrokuen10-r.jpg/500px-Kenrokuen10-r.jpg" },
  { id: "kurobe", name: "黒部峡谷", wiki: "黒部峡谷", prefectureId: "toyama", latitude: 36.64444, longitude: 137.68333, peak: ["10-25", "11-15"], note: "トロッコ電車から見る紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/S-ji-kyo_in_Kurobe_Gorge.jpg/500px-S-ji-kyo_in_Kurobe_Gorge.jpg" },
  { id: "shirakawago", name: "白川郷", wiki: "白川郷", prefectureId: "gifu", latitude: 36.25833, longitude: 136.90556, peak: ["10-25", "11-08"], note: "合掌造りと山の紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Shirakawa-go_%282017-07-22%29.jpg/500px-Shirakawa-go_%282017-07-22%29.jpg" },
  { id: "arashiyama", name: "嵐山", wiki: "嵐山", prefectureId: "kyoto", latitude: 35.00958, longitude: 135.66639, peak: ["11-15", "12-05"], note: "渡月橋と山の錦", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Arashiyama_%288741759830%29.jpg/500px-Arashiyama_%288741759830%29.jpg" },
  { id: "tofukuji", name: "東福寺", wiki: "東福寺", prefectureId: "kyoto", latitude: 34.97705, longitude: 135.77409, peak: ["11-15", "11-30"], note: "通天橋から見下ろす紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/TofukujiHondo.jpg/500px-TofukujiHondo.jpg" },
  { id: "eikando", name: "永観堂", wiki: "禅林寺 (京都市)", prefectureId: "kyoto", latitude: 35.01452, longitude: 135.79529, peak: ["11-15", "11-30"], note: "もみじの永観堂", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Eikando_Somon.jpg/500px-Eikando_Somon.jpg" },
  { id: "kiyomizu", name: "清水寺", wiki: "清水寺", prefectureId: "kyoto", latitude: 34.99483, longitude: 135.785, peak: ["11-15", "11-30"], note: "舞台から望む紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Kiyomizu-dera%2C_Kyoto%2C_November_2016_-02.jpg/500px-Kiyomizu-dera%2C_Kyoto%2C_November_2016_-02.jpg" },
  { id: "minoo", name: "箕面公園", wiki: "明治の森箕面国定公園", prefectureId: "osaka", latitude: 34.84106, longitude: 135.47156, peak: ["11-12", "11-30"], note: "滝ともみじの天ぷら", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Waterfall_in_Mino_Quasi-National_Park_during_early_autumn.jpg/500px-Waterfall_in_Mino_Quasi-National_Park_during_early_autumn.jpg" },
  { id: "narapark", name: "奈良公園", wiki: "奈良公園", prefectureId: "nara", latitude: 34.68556, longitude: 135.84333, peak: ["11-10", "11-30"], note: "鹿と紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Five-storied_Pagoda%2C_Kofuku-ji_-_Nara%2C_Japan_-_DSC07497.jpg/500px-Five-storied_Pagoda%2C_Kofuku-ji_-_Nara%2C_Japan_-_DSC07497.jpg" },
  { id: "tanzan", name: "談山神社", wiki: "談山神社", prefectureId: "nara", latitude: 34.46589, longitude: 135.86175, peak: ["11-10", "11-25"], note: "十三重塔と紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Tanzan-jinja%2C_keidai.jpg/500px-Tanzan-jinja%2C_keidai.jpg" },
  { id: "eigenji", name: "永源寺", wiki: "永源寺", prefectureId: "shiga", latitude: 35.0806, longitude: 136.3196, peak: ["11-12", "11-30"], note: "3000本のもみじに包まれる", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Eigen-ji_%28Rinzai_temple%29.jpg/500px-Eigen-ji_%28Rinzai_temple%29.jpg" },
  { id: "zuihoji", name: "瑞宝寺公園", wiki: "瑞宝寺公園", prefectureId: "hyogo", latitude: 34.79561, longitude: 135.25536, peak: ["11-05", "11-20"], note: "有馬温泉のもみじ名所", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Zuihoji_park15n4272.jpg/500px-Zuihoji_park15n4272.jpg" },
  { id: "momijidani", name: "宮島・紅葉谷公園", wiki: "紅葉谷公園", prefectureId: "hiroshima", latitude: 34.29419, longitude: 132.32406, peak: ["11-12", "11-30"], note: "厳島に広がるもみじ谷", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Japan_location_map_with_side_map_of_the_Ryukyu_Islands.svg/500px-Japan_location_map_with_side_map_of_the_Ryukyu_Islands.svg.png" },
  { id: "sandankyo", name: "三段峡", wiki: "三段峡", prefectureId: "hiroshima", latitude: 34.6, longitude: 132.20778, peak: ["10-28", "11-10"], note: "秘境の渓谷紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Sandankyo_%289875225076%29.jpg/500px-Sandankyo_%289875225076%29.jpg" },
  { id: "daisen", name: "大山", wiki: "大山 (鳥取県)", prefectureId: "tottori", latitude: 35.3711, longitude: 133.5464, peak: ["10-25", "11-08"], note: "ブナ林と伯耆富士", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Daisen_%28mountain%29_in_2012.JPG/500px-Daisen_%28mountain%29_in_2012.JPG" },
  { id: "iyakei", name: "祖谷渓", wiki: "祖谷渓", prefectureId: "tokushima", latitude: 33.87528, longitude: 133.83528, peak: ["10-28", "11-15"], note: "かずら橋と深い谷", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Iya_Valley_seen_from_the_Iya_Valley_Observatory_001.jpg/500px-Iya_Valley_seen_from_the_Iya_Valley_Observatory_001.jpg" },
  { id: "kankakei", name: "寒霞渓", wiki: "寒霞渓", prefectureId: "kagawa", latitude: 34.51556, longitude: 134.30083, peak: ["11-10", "11-30"], note: "ロープウェイで紅葉の空中散歩", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/201211Kankakei_Shodoshima_Kagawa_pref_Japan08s3.jpg/500px-201211Kankakei_Shodoshima_Kagawa_pref_Japan08s3.jpg" },
  { id: "omogokei", name: "面河渓", wiki: "面河渓", prefectureId: "ehime", latitude: 33.73624, longitude: 133.11496, peak: ["10-25", "11-10"], note: "石鎚山麓の清流", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Omogokeikoku.jpg/500px-Omogokeikoku.jpg" },
  { id: "yabakei", name: "耶馬渓", wiki: "耶馬渓", prefectureId: "oita", latitude: 33.44, longitude: 131.14139, peak: ["11-05", "11-20"], note: "奇岩と紅葉の名勝", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Yamakunigawa_River_and_Mount_Kyoshuho_from_Zenkaibashi_Bridge_2.jpg/500px-Yamakunigawa_River_and_Mount_Kyoshuho_from_Zenkaibashi_Bridge_2.jpg" },
  { id: "kunenan", name: "九年庵", wiki: "九年庵", prefectureId: "saga", latitude: 33.35758, longitude: 130.36389, peak: ["11-15", "11-25"], note: "年に9日だけの公開", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Kunen%27an_kanzaki_1.jpg/500px-Kunen%27an_kanzaki_1.jpg" },
  { id: "takachiho", name: "高千穂峡", wiki: "高千穂峡", prefectureId: "miyazaki", latitude: 32.70817, longitude: 131.29894, peak: ["11-15", "11-30"], note: "真名井の滝と紅葉", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Takachiho-kyo%28Gorge%29_-_River_-_%E5%B7%9D.jpg/500px-Takachiho-kyo%28Gorge%29_-_River_-_%E5%B7%9D.jpg" },
  { id: "kikuchi", name: "菊池渓谷", wiki: "菊池渓谷", prefectureId: "kumamoto", latitude: 33.00316, longitude: 130.94646, peak: ["11-05", "11-20"], note: "光の差し込む紅葉の渓谷", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Tengu_fall_in_the_Kikuchi_River_001.jpg/500px-Tengu_fall_in_the_Kikuchi_River_001.jpg" },
  { id: "nitatoge", name: "雲仙・仁田峠", wiki: "雲仙岳", prefectureId: "nagasaki", latitude: 32.76134, longitude: 130.29869, peak: ["10-28", "11-12"], note: "普賢岳を染める紅葉" },
  { id: "akizuki", name: "秋月", wiki: "秋月城", prefectureId: "fukuoka", latitude: 33.46556, longitude: 130.69556, peak: ["11-15", "11-30"], note: "筑前の小京都" },
];

const YUKIMI_SPOTS: EventSpot[] = [
  { id: "ginzan", name: "銀山温泉", wiki: "銀山温泉", prefectureId: "yamagata", latitude: 38.5697, longitude: 140.5311, peak: ["12-15", "02-28"], note: "ガス灯と雪の大正ロマン", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Evening_twilight_in_Ginzan_Onsen_town_January_2022_A.jpg/500px-Evening_twilight_in_Ginzan_Onsen_town_January_2022_A.jpg" },
  { id: "nyuto", name: "乳頭温泉郷", wiki: "乳頭温泉郷", prefectureId: "akita", latitude: 39.8, longitude: 140.78, peak: ["12-15", "03-10"], note: "雪見の秘湯", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Pathway_to_the_Qkamura_Nyuto_Onsenkyo.jpg/500px-Pathway_to_the_Qkamura_Nyuto_Onsenkyo.jpg" },
  { id: "kusatsu", name: "草津温泉", wiki: "草津温泉", prefectureId: "gunma", latitude: 36.62281, longitude: 138.59664, peak: ["12-10", "03-10"], note: "湯畑に舞う雪", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Yubatake_%28Kusatsu_Onsen%29.jpg/500px-Yubatake_%28Kusatsu_Onsen%29.jpg" },
  { id: "shirahone", name: "白骨温泉", wiki: "白骨温泉", prefectureId: "nagano", latitude: 36.15222, longitude: 137.62761, peak: ["12-15", "03-10"], note: "乳白色の雪見露天", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Sirahone_spa_kyoudou-noten-buro_2008.jpg/500px-Sirahone_spa_kyoudou-noten-buro_2008.jpg" },
  { id: "okuhida", name: "奥飛騨温泉郷", wiki: "奥飛騨温泉郷", prefectureId: "gifu", latitude: 36.238, longitude: 137.526, peak: ["12-15", "03-10"], note: "北アルプスを望む露天", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Japan_Gifu_hida_relief_location_map.webp/500px-Japan_Gifu_hida_relief_location_map.webp" },
  { id: "zao", name: "蔵王温泉", wiki: "蔵王温泉", prefectureId: "yamagata", latitude: 38.17, longitude: 140.4, peak: ["12-20", "03-01"], note: "樹氷と強酸性の湯", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/220430_ZaoOnsen_Yamagata_Yamagata_pref_Japan24s3.jpg/500px-220430_ZaoOnsen_Yamagata_Yamagata_pref_Japan24s3.jpg" },
  { id: "nozawa", name: "野沢温泉", wiki: "野沢温泉", prefectureId: "nagano", latitude: 36.92225, longitude: 138.44794, peak: ["12-15", "03-10"], note: "外湯めぐりと雪の村", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Nozawa_Onsen_01.jpg/500px-Nozawa_Onsen_01.jpg" },
  { id: "kinosaki", name: "城崎温泉", wiki: "城崎温泉", prefectureId: "hyogo", latitude: 35.62778, longitude: 134.8, peak: ["12-20", "02-28"], note: "浴衣で雪の外湯めぐり", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Kinosaki_onsen02_1920.jpg/500px-Kinosaki_onsen02_1920.jpg" },
  { id: "noboribetsu", name: "登別温泉", wiki: "登別温泉", prefectureId: "hokkaido", latitude: 42.49506, longitude: 141.14406, peak: ["12-01", "03-10"], note: "地獄谷の湯けむり", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Noboribetsu_hot_spring_jigokudani.JPG/500px-Noboribetsu_hot_spring_jigokudani.JPG" },
  { id: "jigokudani", name: "地獄谷野猿公苑", wiki: "地獄谷野猿公苑", prefectureId: "nagano", latitude: 36.73281, longitude: 138.46269, peak: ["12-20", "02-28"], note: "温泉に入るサル", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Jigokudani_hotspring_in_Nagano_Japan_001.jpg/500px-Jigokudani_hotspring_in_Nagano_Japan_001.jpg" },
  { id: "sukayu", name: "酸ヶ湯温泉", wiki: "酸ヶ湯", prefectureId: "aomori", latitude: 40.65, longitude: 140.85, peak: ["12-01", "03-15"], note: "千人風呂と豪雪", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Sukayu_Onsen_01.jpg/500px-Sukayu_Onsen_01.jpg" },
  { id: "yunishigawa", name: "湯西川温泉", wiki: "湯西川温泉", prefectureId: "tochigi", latitude: 36.96211, longitude: 139.59147, peak: ["01-20", "03-01"], note: "かまくら祭", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Heikesyuraku2011-10-23.jpg/500px-Heikesyuraku2011-10-23.jpg" },
  { id: "shibu", name: "渋温泉", wiki: "渋温泉", prefectureId: "nagano", latitude: 36.73444, longitude: 138.43306, peak: ["12-20", "02-28"], note: "石畳の湯けむり", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/Shibu-onsen02s3200.jpg/500px-Shibu-onsen02s3200.jpg" },
  { id: "ouchijuku", name: "大内宿", wiki: "大内宿", prefectureId: "fukushima", latitude: 37.33417, longitude: 139.86078, peak: ["12-20", "02-28"], note: "雪の宿場町", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Ja-fukushima-ohuchijuku-4.jpg/500px-Ja-fukushima-ohuchijuku-4.jpg" },
];

export const TRAVEL_EVENTS: TravelEvent[] = [
  {
    id: "momiji",
    title: "紅葉狩りクエスト",
    seal: "紅葉",
    emoji: "🍁",
    tagline: "山が燃える季節。名所をめぐって、紅葉ハンターになろう。",
    description:
      "北から南へ、紅葉前線が日本列島を下っていきます。例年の見頃に合わせて、全国の紅葉名所から行き先を選ぼう。",
    window: ["09-15", "12-15"],
    categories: ["nature", "viewpoint", "shrine"],
    color: "#c2361f",
    peakLabels: { before: "まだ青葉", soon: "色づき始め", peak: "見頃", after: "散り始め" },
    goals: [
      { id: "first", label: "紅葉の名所をひとつ訪れる", count: 1, xp: 150 },
      { id: "hunter", label: "3か所めぐる", count: 3, xp: 400, title: "紅葉ハンター" },
      { id: "genchi", label: "現地認証で訪れる", count: 1, verified: true, xp: 200 },
    ],
    spots: MOMIJI_SPOTS,
  },
  {
    id: "yukimi",
    title: "雪見湯めぐりクエスト",
    seal: "雪見",
    emoji: "♨️",
    tagline: "しんしんと降る雪と、あったかい湯けむり。",
    description:
      "雪景色の中の露天風呂は冬だけのごほうび。豪雪の秘湯から、雪の宿場町まで。",
    window: ["12-01", "03-10"],
    categories: ["hot-spring"],
    color: "#2f6fa5",
    peakLabels: { before: "雪待ち", soon: "初雪のころ", peak: "雪見の季節", after: "春のきざし" },
    goals: [
      { id: "first", label: "雪見の湯をひとつ訪れる", count: 1, xp: 150 },
      { id: "master", label: "3か所めぐる", count: 3, xp: 400, title: "湯けむり名人" },
      { id: "genchi", label: "現地認証で訪れる", count: 1, verified: true, xp: 200 },
    ],
    spots: YUKIMI_SPOTS,
  },
];

// Pinned "coming soon" notes for the rest of the year.
export const EVENT_TEASERS: {
  id: string;
  title: string;
  emoji: string;
  window: readonly [string, string];
}[] = [
  { id: "ume", title: "梅だより", emoji: "🌸", window: ["02-01", "03-15"] },
  { id: "sakura", title: "桜前線クエスト", emoji: "🌸", window: ["03-20", "05-10"] },
  { id: "ajisai", title: "紫陽花めぐり", emoji: "💠", window: ["06-01", "07-10"] },
  { id: "hanabi", title: "花火大会", emoji: "🎆", window: ["07-15", "08-31"] },
];
