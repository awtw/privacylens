import Foundation

public struct Rule {
    public let id: String
    public let type: EntityType
    public let regex: NSRegularExpression
    public let confidence: Double
    /// Capture group holding the sensitive part; nil = whole match.
    public let group: Int?
    public let validate: ((String) -> Bool)?

    init(_ id: String, _ type: EntityType, _ pattern: String, _ confidence: Double,
         group: Int? = nil, ignoreCase: Bool = false, validate: ((String) -> Bool)? = nil) {
        self.id = id; self.type = type; self.confidence = confidence; self.group = group; self.validate = validate
        // Patterns are compile-time constants; a failure here is a programmer error caught by the test suite.
        self.regex = try! NSRegularExpression(pattern: pattern, options: ignoreCase ? [.caseInsensitive] : [])
    }
}

/// Port of packages/privacy-spec/src/rules.ts. Keep the two in sync; fixtures/cases.json verifies both.
/// ICU `\d` matches non-ASCII digits, so `[0-9]` is used to match JavaScript semantics.
public enum Rules {
    static let surnames =
        "陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴徐周葉蘇莊呂江何蕭羅高潘簡朱鍾彭游詹胡施沈余盧梁趙顏柯翁魏孫戴范方宋鄧杜傅侯曹薛丁卓馬阮董唐溫藍蔣石古紀姚連馮歐程湯田康姜白汪鄒尤巫鐘黎涂龔嚴韓袁金童陸夏柳凃邵"

    static let nameStopwords: Set<String> = [
        "簡介", "簡單", "簡訊", "簡報", "高度", "高級", "高階", "金額", "金融", "馬上", "白色", "周邊", "田野", "石頭", "方式", "方法", "方案", "方向",
        "古老", "紀錄", "何時", "何況", "江湖", "程式", "程序", "連結", "連線", "連接", "康復", "夏天", "陸續", "黎明",
        "溫度", "溫和", "田地", "丁點", "范圍", "羅列", "嚴重", "嚴格", "韓國", "金色", "藍色", "朱色", "設計", "余額",
        "李子", "王國", "林業", "施工", "蘇打", "游戲", "游泳", "汪洋", "白天", "白板", "袁地", "董事", "董事會", "高中",
        "高速", "高雄", "洪水", "徐徐", "許可", "許多", "曾經", "胡亂", "梁柱", "童年", "馮", "唐突", "宋體", "魏碑",
        "周期", "周圍", "周末", "周年", "陳述", "陳列", "黃色", "黃金", "張貼", "張數", "劉海", "賴皮", "蔡英文",
    ]

    static let enStopwords: Set<String> = Set(
        """
        add new sign in out log login logout home settings setting search save cancel delete edit open close file files drive google
        microsoft apple chrome windows mac privacy lens terms service services help menu next back submit send share copy paste upload
        download my the and for with from dashboard profile account report reports chat message messages project projects team data page
        pages email password name user users admin date time status type title description notes note view list tools tool update create
        total item items all none yes no ok error warning info click here more less show hide select option options default new old
        first last previous continue start stop run test build deploy release version history today yesterday monday tuesday wednesday
        thursday friday saturday sunday january february march april may june july august september october november december
        patient doctor nurse record records clinical history medical case cases score feedback result results question answer
        learning knowledge engineering assistant system model models prompt prompts document documents knowledge base
        """.split(whereSeparator: { $0 == " " || $0 == "\n" }).map(String.init)
    )

    static func digits(_ s: String) -> String { s.filter { $0 != " " && $0 != "-" } }

    // Separators never include newlines so a match stays within one OCR line.
    public static let all: [Rule] = [
        Rule("email", .EMAIL, #"[A-Za-z0-9._%+-]+[ \t]?@[ \t]?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}"#, 0.98),
        Rule("tw-national-id", .TW_NATIONAL_ID, #"(?<![A-Za-z0-9])[A-Z][1289][0-9]{8}(?![0-9])"#, 0.97,
             validate: Validators.isValidTaiwanId),
        Rule("credit-card", .CREDIT_CARD, #"(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])"#, 0.95,
             validate: { Validators.isValidLuhn(digits($0)) }),
        Rule("tw-mobile", .PHONE, #"(?<![0-9])(?:\+?886[- ]?|0)9[0-9]{2}[- ]?[0-9]{3}[- ]?[0-9]{3}(?![0-9])"#, 0.95),
        Rule("tw-landline", .PHONE, #"(?<![0-9-])\(?0[2-8][0-9]?\)?[- ]?[0-9]{3,4}[- ]?[0-9]{4}(?![0-9-])"#, 0.85),
        Rule("bank-account", .BANK_ACCOUNT,
             #"(?:帳號|帳戶|匯款|account(?:\s*(?:no\.?|number|#))?|acct)[:：#]?[ \t]*([0-9](?:[ -]?[0-9]){7,15})(?![0-9])"#, 0.8,
             group: 1, ignoreCase: true),
        Rule("url", .URL, #"\b(?:https?://|www\.)[^\s<>"'，。]+"#, 0.9, ignoreCase: true),
        Rule("ipv4", .IP_ADDRESS,
             #"(?<![0-9.])(?:(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(?![0-9.])"#, 0.9),
        Rule("tw-address", .ADDRESS,
             #"[\u4e00-\u9fff]{2}[縣市][\u4e00-\u9fff]{1,4}[鄉鎮市區][\u4e00-\u9fff0-9]{1,14}?(?:路|街|大道)(?:[一二三四五六七八九十0-9]{1,3}段)?(?:[ ]?[0-9]+[ ]?(?:巷|弄))*(?:[ ]?[0-9]+(?:之[0-9]+)?[ ]?號)?(?:[ ]?[0-9]+[ ]?樓(?:之[0-9]+)?)?"#, 0.85),
        Rule("org-suffix", .ORGANIZATION,
             #"[\u4e00-\u9fffA-Za-z0-9]{2,14}?(?:股份有限公司|有限公司|銀行|分行|金控|基金會|醫院|大學)"#, 0.7),
        Rule("person-label-colon", .PERSON,
             #"(?:姓名|聯絡人|收件人|申請人|負責人|病患|患者|病人|學生|老師|醫師)[ \t]*[:：][ \t]*(?!資訊|資料|方式|電話|信箱|地址|欄位|名稱)([\u4e00-\u9fff]{2,4})(?![\u4e00-\u9fff])"#,
             0.7, group: 1),
        Rule("person-label-surname", .PERSON,
             "(?:姓名|聯絡人|收件人|申請人|負責人|病患|患者)[ \\t]*(?!資訊|資料|方式|電話|信箱|地址|欄位|名稱)([\(surnames)][\\u4e00-\\u9fff]{1,3})(?![\\u4e00-\\u9fff])",
             0.6, group: 1),
        Rule("person-age", .PERSON, #"([\u4e00-\u9fffA-Za-z]{1,6})[ \t]*[（(][ \t]*[0-9]{1,3}[ \t]*歲[ \t]*[)）]"#, 0.55, group: 1),
        Rule("handle", .USERNAME, #"(?<![A-Za-z0-9._@])@[A-Za-z0-9][A-Za-z0-9._]{2,29}(?![A-Za-z0-9._]*@)"#, 0.75),
        Rule("letter-digit-id", .ID_NUMBER, #"(?<![A-Za-z0-9])[A-Za-z][0-9]{7,}(?![0-9])"#, 0.5),
        Rule("person-label-en", .PERSON,
             #"(?:name|patient|user|contact|owner|姓名|聯絡人|病患|患者|病人)[ \t]*[:：][ \t]*([A-Za-z][A-Za-z.'-]*(?:[ \t]+[A-Za-z][A-Za-z.'-]*){0,2})"#,
             0.7, group: 1, ignoreCase: true),
        Rule("person-capitalized-en", .PERSON, #"(?<![A-Za-z])[A-Z][a-z]{1,14}(?:[ \t][A-Z][a-z]{1,14}){1,2}(?![A-Za-z])"#, 0.4,
             validate: { m in m.split(whereSeparator: { $0.isWhitespace }).allSatisfy { !enStopwords.contains($0.lowercased()) } }),
        Rule("long-number", .ID_NUMBER, #"(?<![0-9A-Za-z.])[0-9]{8,}(?![0-9.])"#, 0.5),
    ]

    /// Standalone 2–3 char token: common surname + 1–2 CJK chars. Low confidence; user confirms.
    static func looksLikeSurnameToken(_ t: String) -> Bool {
        let c = Array(t)
        guard (2...3).contains(c.count), surnames.contains(c[0]) else { return false }
        return c.dropFirst().allSatisfy(isCJKIdeograph)
    }

    static func isCJKIdeograph(_ ch: Character) -> Bool {
        guard let v = ch.unicodeScalars.first?.value, ch.unicodeScalars.count == 1 else { return false }
        return (0x4E00...0x9FFF).contains(v)
    }

    /// JS: /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/
    static func isCJK(_ ch: Character) -> Bool {
        guard let v = ch.unicodeScalars.first?.value else { return false }
        return (0x3000...0x303F).contains(v) || (0x4E00...0x9FFF).contains(v) || (0xFF00...0xFFEF).contains(v)
    }
}
