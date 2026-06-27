import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "content", "imports", "bal-e-jibril-first-seven.json");
const scanPages = [[22], [23], [23, 24, 25], [25], [26], [27], [27, 28]];

const poems = [
  {
    id: "bal-e-jibril-meri-nawa-e-shauq",
    title: "میری نوائے شوق سے شور حریمِ ذات میں",
    transliteration: "Meri nawa-e-shauq se shor-e-harim-e-zat mein",
    sourceUrl: "https://allamaiqbal.com/poetry.php?bookbup=24&conType=ur&lang=0&lang_code=ur&orderno=203",
    legacySourceUrl: "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/part01/01.htm",
    lines: [
      "میری نوائے شوق سے شور حریمِ ذات میں", "غلغلہ ہائے الاماں بُت کدۂ صفات میں",
      "حُور و فرشتہ ہیں اسیر میرے تخیّلات میں", "میری نگاہ سے خلل تیری تجلّیات میں",
      "گرچہ ہے میری جُستجو دَیر و حرم کی نقش بند", "میری فغاں سے رستخیز کعبہ و سومنات میں",
      "گاہ مری نگاہِ تیز چِیر گئی دلِ وجُود", "گاہ اُلجھ کے رہ گئی میرے توہّمات میں",
      "تُو نے یہ کیا غضب کِیا، مجھ کو بھی فاش کر دیا", "مَیں ہی تو ایک راز تھا سینۂ کائنات میں!"
    ]
  },
  {
    id: "bal-e-jibril-agar-kaj-rau-hain-anjum",
    title: "اگر کج رَو ہیں انجم، آسماں تیرا ہے یا میرا",
    transliteration: "Agar kaj-rau hain anjum, aasman tera hai ya mera",
    sourceUrl: "https://allamaiqbal.com/poetry.php?bookbup=24&conType=ur&lang=4&lang_code=ur&orderno=205",
    legacySourceUrl: "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/part01/02.htm",
    lines: [
      "اگر کج رَو ہیں انجم، آسماں تیرا ہے یا میرا", "مجھے فکرِ جہاں کیوں ہو، جہاں تیرا ہے یا میرا؟",
      "اگر ہنگامہ ہائے شوق سے ہے لامکاں خالی", "خطا کس کی ہے یا رب! لامکاں تیرا ہے یا میرا؟",
      "اُسے صبحِ ازل انکار کی جُرأت ہوئی کیونکر", "مجھے معلوم کیا، وہ راز داں تیرا ہے یا میرا؟",
      "محمدؐ بھی ترا، جبریل بھی، قرآن بھی تیرا", "مگر یہ حرفِ شیریں ترجماں تیرا ہے یا میرا؟",
      "اسی کوکب کی تابانی سے ہے تیرا جہاں روشن", "زوالِ آدمِ خاکی زیاں تیرا ہے یا میرا؟"
    ]
  },
  {
    id: "bal-e-jibril-gesu-e-tabdar",
    title: "گیسوئے تاب‌دار کو اور بھی تاب‌دار کر",
    transliteration: "Gesu-e-tabdar ko aur bhi tabdar kar",
    sourceUrl: "https://www.allamaiqbal.com/poetry.php?bookbup=24&conType=ur&lang=4&lang_code=ur&orderno=206",
    legacySourceUrl: "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/part01/03.htm",
    lines: [
      "گیسوئے تاب‌دار کو اور بھی تاب‌دار کر", "ہوش و خرد شکار کر، قلب و نظر شکار کر",
      "عشق بھی ہو حجاب میں، حُسن بھی ہو حجاب میں", "یا تو خود آشکار ہو یا مجھے آشکار کر",
      "تُو ہے محیطِ بےکراں، میں ہُوں ذرا سی آبُجو", "یا مجھے ہمکنار کر یا مجھے بے کنار کر",
      "میں ہُوں صدَف تو تیرے ہاتھ میرے گُہر کی آبرو", "میں ہُوں خزَف تو تُو مجھے گوہرِ شاہوار کر",
      "نغمۂ نَو بہار اگر میرے نصیب میں نہ ہو", "اس دمِ نیم سوز کو طائرکِ بہار کر",
      "باغِ بہشت سے مجھے حکمِ سفر دیا تھا کیوں", "کارِ جہاں دراز ہے، اب مرا انتظار کر",
      "روزِ حساب جب مرا پیش ہو دفترِ عمل", "آپ بھی شرمسار ہو، مجھ کو بھی شرمسار کر"
    ]
  },
  {
    id: "bal-e-jibril-asar-kare-na-kare",
    title: "اثر کرے نہ کرے، سُن تو لے مِری فریاد",
    transliteration: "Asar kare na kare, sun to le meri faryad",
    sourceUrl: "https://allamaiqbal.com/poetry.php?bookbup=24&conType=ur&lang=0&lang_code=ur&orderno=208",
    legacySourceUrl: "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/part01/04.htm",
    lines: [
      "اثر کرے نہ کرے، سُن تو لے مِری فریاد", "نہیں ہے داد کا طالب یہ بندۂ آزاد",
      "یہ مشتِ خاک، یہ صرصر، یہ وسعتِ افلاک", "کرم ہے یا کہ ستم تیری لذّتِ ایجاد!",
      "ٹھہر سکا نہ ہوائے چمن میں خیمۂ گُل", "یہی ہے فصلِ بہاری، یہی ہے بادِ مراد؟",
      "قصوروار، غریبُ الدّیار ہُوں لیکن", "ترا خرابہ فرشتے نہ کر سکے آباد",
      "مری جفا طلبی کو دعائیں دیتا ہے", "وہ دشتِ سادہ، وہ تیرا جہانِ بے بنیاد",
      "خطر پسند طبیعت کو سازگار نہیں", "وہ گُلِستاں کہ جہاں گھات میں نہ ہو صّیاد",
      "مقامِ شوق ترے قدسیوں کے بس کا نہیں", "اُنھی کا کام ہے یہ جن کے حوصلے ہیں زیاد"
    ]
  },
  {
    id: "bal-e-jibril-kya-ishq-ek-zindagi",
    title: "کیا عشق ایک زندگی مستعار کا",
    transliteration: "Kya ishq ek zindagi-e-mustaar ka",
    sourceUrl: "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/part01/05.htm",
    notes: "The separate four-line poem appended to this Academy page is intentionally excluded.",
    lines: [
      "کیا عشق ایک زندگی مستعار کا", "کیا عشق پائدار سے ناپائدار کا",
      "وہ عشق جس کی شمع بجھا دے اجل کی پھونک", "اس میں مزا نہیں تپش و انتظار کا",
      "میری بساط کیا ہے، تب و تاب یک نفس", "شعلے سے بے محل ہے الجھنا شرار کا",
      "کر پہلے مجھ کو زندگی جاوداں عطا", "پھر ذوق و شوق دیکھ دل بے قرار کا",
      "کانٹا وہ دے کہ جس کی کھٹک لازوال ہو", "یارب، وہ درد جس کی کسک لازوال ہو!"
    ]
  },
  {
    id: "bal-e-jibril-pareshan-hoke-meri-khak",
    title: "پریشاں ہوکے میری خاک آخر دل نہ بن جائے",
    transliteration: "Pareshan ho ke meri khak aakhir dil na ban jaye",
    sourceUrl: "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/part01/06.htm",
    lines: [
      "پریشاں ہوکے میری خاک آخر دل نہ بن جائے", "جو مشکل اب ہے یارب پھر وہی مشکل نہ بن جائے",
      "نہ کر دیں مجھ کو مجبور نوا فردوس میں حوریں", "مرا سوز دروں پھر گرمی محفل نہ بن جائے",
      "کبھی چھوڑی ہوئی منزل بھی یاد آتی ہے راہی کو", "کھٹک سی ہے، جو سینے میں، غم منزل نہ بن جائے",
      "بنایا عشق نے دریائے ناپیدا کراں مجھ کو", "یہ میری خود نگہداری مرا ساحل نہ بن جائے",
      "کہیں اس عالم بے رنگ و بو میں بھی طلب میری", "وہی افسانہ دنبالہ محمل نہ بن جائے",
      "عروج آدم خاکی سے انجم سہمے جاتے ہیں", "کہ یہ ٹوٹا ہوا تارا مہ کامل نہ بن جائے"
    ]
  },
  {
    id: "bal-e-jibril-digargun-hai-jahan",
    title: "دگرگوں ہے جہاں، تاروں کی گردش تیز ہے ساقی",
    transliteration: "Digargun hai jahan, taron ki gardish tez hai saqi",
    sourceUrl: "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/part01/07.htm",
    lines: [
      "دگرگوں ہے جہاں، تاروں کی گردش تیز ہے ساقی", "دل ہر ذرہ میں غوغائے رستاخیز ہے ساقی",
      "متاع دین و دانش لٹ گئی اللہ والوں کی", "یہ کس کافر ادا کا غمزۂ خوں ریز ہے ساقی",
      "وہی دیرینہ بیماری، وہی نامحکمی دل کی", "علاج اس کا وہی آب نشاط انگیز ہے ساقی",
      "حرم کے دل میں سوز آرزو پیدا نہیں ہوتا", "کہ پیدائی تری اب تک حجاب آمیز ہے ساقی",
      "نہ اٹھا پھر کوئی رومی عجم کے لالہ زاروں سے", "وہی آب و گل ایران، وہی تبریز ہے ساقی",
      "نہیں ہے ناامید اقبال اپنی کشت ویراں سے", "ذرا نم ہو تو یہ مٹی بہت زرخیز ہے ساقی",
      "فقیر راہ کو بخشے گئے اسرار سلطانی", "بہا میری نوا کی دولت پرویز ہے ساقی"
    ]
  }
];

function normalizeUrdu(text) {
  return text.normalize("NFC").replaceAll("ي", "ی").replaceAll("ى", "ی").replaceAll("ك", "ک");
}

function toReading(poem, index) {
  if (poem.lines.length % 2 !== 0) {
    throw new Error(`${poem.id} has an unmatched verse line`);
  }

  const { lines, ...metadata } = poem;
  return {
    ...metadata,
    sequence: index + 1,
    collection: "بالِ جبریل · حصہ اول",
    sourceChecked: true,
    importStatus: "verified_against_scan",
    verification: {
      file: "BalEJibreelByAllamahMuhammadIqbalr.a.pdf",
      pdfPages: scanPages[index],
      checkedOn: "2026-06-19"
    },
    verses: Array.from({ length: lines.length / 2 }, (_, verseIndex) => ({
      lines: lines.slice(verseIndex * 2, verseIndex * 2 + 2).map(normalizeUrdu)
    }))
  };
}

const payload = {
  schemaVersion: 1,
  source: {
    publisher: "Iqbal Academy Pakistan",
    contentsUrl: "https://www.allamaiqbal.com/works/poetry/urdu/bal/text/contents.htm",
    collection: "Bal-e-Jibril"
  },
  reviewRequired: false,
  readings: poems.map(toReading)
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Imported ${payload.readings.length} poems to ${path.relative(root, outputPath)}`);
