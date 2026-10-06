import type { EntityType } from './types';
import { isValidLuhn, isValidTaiwanId } from './validators';

export interface Rule {
  id: string;
  type: EntityType;
  pattern: RegExp;
  confidence: number;
  /** Capture group holding the sensitive part; default is the whole match. */
  group?: number;
  validate?: (matched: string) => boolean;
}

const SURNAMES =
  '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴徐周葉蘇莊呂江何蕭羅高潘簡朱鍾彭游詹胡施沈余盧梁趙顏柯翁魏孫戴范方宋鄧杜傅侯曹薛丁卓馬阮董唐溫藍蔣石古紀姚連馮歐程湯田康姜白汪鄒尤巫鐘黎涂龔嚴韓袁金童陸夏柳凃邵';

// Separators never include newlines so a match stays within one OCR line.
export const RULES: Rule[] = [
  {
    id: 'email',
    type: 'EMAIL',
    // Optional spaces around '@': OCR often splits the address into two words.
        pattern: /[A-Za-z0-9._%+-]+[ \t]?@[ \t]?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    confidence: 0.98,
  },
  {
    id: 'tw-national-id',
    type: 'TW_NATIONAL_ID',
    pattern: /(?<![A-Za-z0-9])[A-Z][1289]\d{8}(?!\d)/g,
    confidence: 0.97,
    validate: isValidTaiwanId,
  },
  {
    id: 'credit-card',
    type: 'CREDIT_CARD',
    pattern: /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g,
    confidence: 0.95,
    validate: (m) => isValidLuhn(m.replace(/[ -]/g, '')),
  },
  {
    id: 'tw-mobile',
    type: 'PHONE',
    pattern: /(?<!\d)(?:\+?886[- ]?|0)9\d{2}[- ]?\d{3}[- ]?\d{3}(?!\d)/g,
    confidence: 0.95,
  },
  {
    id: 'tw-landline',
    type: 'PHONE',
    pattern: /(?<![\d-])\(?0[2-8]\d?\)?[- ]?\d{3,4}[- ]?\d{4}(?![\d-])/g,
    confidence: 0.85,
  },
  {
    id: 'bank-account',
    type: 'BANK_ACCOUNT',
    pattern: /(?:帳號|帳戶|匯款|account(?:\s*(?:no\.?|number|#))?|acct)[:：#]?[ \t]*(\d(?:[ -]?\d){7,15})(?!\d)/gi,
    confidence: 0.8,
    group: 1,
  },
  {
    id: 'url',
    type: 'URL',
    pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'，。]+/gi,
    confidence: 0.9,
  },
  {
    id: 'ipv4',
    type: 'IP_ADDRESS',
    pattern: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/g,
    confidence: 0.9,
  },
  {
    id: 'tw-address',
    type: 'ADDRESS',
    pattern:
      /[一-鿿]{2}[縣市][一-鿿]{1,4}[鄉鎮市區][一-鿿0-9]{1,14}?(?:路|街|大道)(?:[一二三四五六七八九十0-9]{1,3}段)?(?:[ ]?\d+[ ]?(?:巷|弄))*(?:[ ]?\d+(?:之\d+)?[ ]?號)?(?:[ ]?\d+[ ]?樓(?:之\d+)?)?/g,
    confidence: 0.85,
  },
  {
    id: 'org-suffix',
    type: 'ORGANIZATION',
    pattern: /[一-鿿A-Za-z0-9]{2,14}?(?:股份有限公司|有限公司|銀行|分行|金控|基金會|醫院|大學)/g,
    confidence: 0.7,
  },
  {
    id: 'person-label-colon',
    type: 'PERSON',
    pattern: /(?:姓名|聯絡人|收件人|申請人|負責人|病患|患者|病人|學生|老師|醫師)[ \t]*[:：][ \t]*(?!資訊|資料|方式|電話|信箱|地址|欄位|名稱)([一-鿿]{2,4})(?![一-鿿])/g,
    confidence: 0.7,
    group: 1,
  },
  {
    // No colon: OCR often drops it, so require the value to start with a common surname.
    id: 'person-label-surname',
    type: 'PERSON',
    pattern: new RegExp(
      `(?:姓名|聯絡人|收件人|申請人|負責人|病患|患者)[ \\t]*(?!資訊|資料|方式|電話|信箱|地址|欄位|名稱)([${SURNAMES}][\\u4e00-\\u9fff]{1,3})(?![\\u4e00-\\u9fff])`,
      'g',
    ),
    confidence: 0.6,
    group: 1,
  },
  {
    // "小雯 (14歲)" — a name directly followed by an age marker. Latin letters allowed: OCR often garbles small names.
    id: 'person-age',
    type: 'PERSON',
    pattern: /([一-鿿A-Za-z]{1,6})[ \t]*[（(][ \t]*\d{1,3}[ \t]*歲[ \t]*[)）]/g,
    confidence: 0.55,
    group: 1,
  },
  {
    id: 'handle',
    type: 'USERNAME',
    pattern: /(?<![A-Za-z0-9._@])@[A-Za-z0-9][A-Za-z0-9._]{2,29}(?![A-Za-z0-9._]*@)/g,
    confidence: 0.75,
  },
  {
    id: 'letter-digit-id',
    type: 'ID_NUMBER',
    pattern: /(?<![A-Za-z0-9])[A-Za-z]\d{7,}(?!\d)/g,
    confidence: 0.5,
  },
  {
    id: 'person-label-en',
    type: 'PERSON',
    pattern:
      /(?:name|patient|user|contact|owner|姓名|聯絡人|病患|患者|病人)[ \t]*[:：][ \t]*([A-Za-z][A-Za-z.'-]*(?:[ \t]+[A-Za-z][A-Za-z.'-]*){0,2})/gi,
    confidence: 0.7,
    group: 1,
  },
  {
    // Heuristic: 2–3 consecutive Capitalized words (e.g. "John Smith"). Low confidence; UI words are excluded.
    id: 'person-capitalized-en',
    type: 'PERSON',
    pattern: /(?<![A-Za-z])[A-Z][a-z]{1,14}(?:[ \t][A-Z][a-z]{1,14}){1,2}(?![A-Za-z])/g,
    confidence: 0.4,
    validate: (m) => m.split(/\s+/).every((w) => !EN_STOPWORDS.has(w.toLowerCase())),
  },
  {
    // Fallback: long digit runs (employee/member/account ids). Lowest priority, user can untick.
    id: 'long-number',
    type: 'ID_NUMBER',
    pattern: /(?<![\dA-Za-z.])\d{8,}(?![\d.])/g,
    confidence: 0.5,
  },
];


/** Standalone 2–3 char token: common surname + 1–2 chars. Low confidence; user confirms. */
export const SURNAME_RE = new RegExp(`^[${SURNAMES}][\\u4e00-\\u9fff]{1,2}$`);

/** Common words that start with a surname character. */
export const NAME_STOPWORDS = new Set([
  '簡介', '簡單', '簡訊', '簡報', '高度', '高級', '高階', '金額', '金融', '馬上', '白色', '周邊', '田野', '石頭', '方式', '方法', '方案', '方向',
  '古老', '紀錄', '何時', '何況', '江湖', '程式', '程序', '連結', '連線', '連接', '康復', '夏天', '陸續', '黎明',
  '溫度', '溫和', '田地', '丁點', '范圍', '羅列', '嚴重', '嚴格', '韓國', '金色', '藍色', '朱色', '設計', '余額',
  '李子', '王國', '林業', '施工', '蘇打', '游戲', '游泳', '汪洋', '白天', '白板', '袁地', '董事', '董事會', '高中',
  '高速', '高雄', '洪水', '徐徐', '許可', '許多', '曾經', '胡亂', '梁柱', '童年', '馮', '唐突', '宋體', '魏碑',
  '周期', '周圍', '周末', '周年', '陳述', '陳列', '黃色', '黃金', '張貼', '張數', '劉海', '賴皮', '蔡英文',
]);

/** Capitalized UI / generic words that must not be treated as part of a person name. */
const EN_STOPWORDS = new Set(
  `add new sign in out log login logout home settings setting search save cancel delete edit open close file files drive google
  microsoft apple chrome windows mac privacy lens terms service services help menu next back submit send share copy paste upload
  download my the and for with from dashboard profile account report reports chat message messages project projects team data page
  pages email password name user users admin date time status type title description notes note view list tools tool update create
  total item items all none yes no ok error warning info click here more less show hide select option options default new old
  first last previous continue start stop run test build deploy release version history today yesterday monday tuesday wednesday
  thursday friday saturday sunday january february march april may june july august september october november december
  patient doctor nurse record records clinical history medical case cases score feedback result results question answer
  learning knowledge engineering assistant system model models prompt prompts document documents knowledge base`.split(/\s+/),
);
