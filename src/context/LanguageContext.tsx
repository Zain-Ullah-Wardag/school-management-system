import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type Language = 'en' | 'ur';

// Phrase-first dictionary. The DOM localizer below reuses this existing language
// context so legacy hard-coded screen labels can be localized without changing
// application behavior, API payloads, form values, or database data.
const urdu: Record<string, string> = {
  'School ERP': 'اسکول ای آر پی',
  'Offline-first education management': 'آف لائن تعلیمی انتظام',
  'Welcome back': 'خوش آمدید',
  'Sign in to your workspace': 'اپنے ورک اسپیس میں سائن ان کریں',
  'Enter your school account credentials to continue.': 'جاری رکھنے کے لیے اپنے اسکول اکاؤنٹ کی تفصیلات درج کریں۔',
  'Username': 'صارف نام', 'Password': 'پاس ورڈ', 'Sign in securely': 'محفوظ طریقے سے سائن ان کریں', 'First launch:': 'پہلی بار:',
  'Dashboard': 'ڈیش بورڈ', 'Students': 'طلبہ', 'Staff': 'عملہ', 'Academic Setup': 'تعلیمی سیٹ اپ', 'Timetable': 'ٹائم ٹیبل',
  'Attendance': 'حاضری', 'Fees & Finance': 'فیس اور مالیات', 'Tests & Exams': 'ٹیسٹ اور امتحانات', 'SMS & WhatsApp': 'ایس ایم ایس اور واٹس ایپ',
  'Reports': 'رپورٹس', 'Settings': 'ترتیبات', 'Visitors': 'ملاقاتی', 'Operations': 'عملیات', 'Workspace': 'ورک اسپیس',
  'Good day': 'خوش آمدید', 'Student management': 'طلبہ کا انتظام', 'Staff management': 'عملہ کا انتظام', 'Academic setup': 'تعلیمی سیٹ اپ',
  'Fees & finance': 'فیس اور مالیات', 'Tests & examinations': 'ٹیسٹ اور امتحانات', 'Reports & printing': 'رپورٹس اور پرنٹنگ',
  'Search': 'تلاش', 'Search students by name, registration, class…': 'نام، رجسٹریشن یا کلاس سے طلبہ تلاش کریں…',
  'Search staff by name, employee no., or phone…': 'نام، ملازم نمبر یا فون سے عملہ تلاش کریں…',
  'Search invoices, receipts, or students…': 'انوائس، رسید یا طالب علم تلاش کریں…',
  'Search attendance records…': 'حاضری ریکارڈ تلاش کریں…', 'Search timetable classes, teachers, subjects…': 'کلاس، استاد یا مضمون تلاش کریں…',
  'Search academic setup records…': 'تعلیمی سیٹ اپ ریکارڈ تلاش کریں…', 'Search tests, exams, and results…': 'ٹیسٹ، امتحان اور نتائج تلاش کریں…',
  'Search report results or certificates…': 'رپورٹ نتائج یا سرٹیفکیٹس تلاش کریں…', 'Search messages, recipients, providers…': 'پیغامات، وصول کنندگان یا پروائیڈر تلاش کریں…',
  'Search visitor register…': 'ملاقاتی رجسٹر تلاش کریں…',
  'Save': 'محفوظ کریں', 'Cancel': 'منسوخ کریں', 'Close': 'بند کریں', 'Delete': 'حذف کریں', 'Remove': 'ہٹائیں', 'Replace': 'تبدیل کریں',
  'Edit': 'ترمیم', 'View': 'دیکھیں', 'Download': 'ڈاؤن لوڈ', 'Upload': 'اپ لوڈ', 'Refresh': 'تازہ کریں', 'Retry': 'دوبارہ کوشش',
  'Add New': 'نیا شامل کریں', 'Add': 'شامل کریں', 'Create': 'بنائیں', 'Update': 'اپ ڈیٹ کریں', 'Submit': 'جمع کریں',
  'Active': 'فعال', 'Inactive': 'غیر فعال', 'Archived': 'محفوظ شدہ', 'Pending': 'زیر التوا', 'Paid': 'ادا شدہ', 'Unpaid': 'غیر ادا شدہ',
  'Partial': 'جزوی', 'Overdue': 'واجب الادا', 'Present': 'حاضر', 'Absent': 'غیر حاضر', 'Leave': 'چھٹی', 'Late': 'دیر سے',
  'Connected': 'منسلک', 'Disconnected': 'غیر منسلک', 'Enabled': 'فعال', 'Disabled': 'غیر فعال', 'Connected Device': 'منسلک آلہ',
  'Class': 'کلاس', 'Section': 'سیکشن', 'Subject': 'مضمون', 'Teacher': 'استاد', 'Room': 'کمرہ', 'Session': 'تعلیمی سال',
  'Academic Session': 'تعلیمی سال', 'Registration Number': 'رجسٹریشن نمبر', 'Roll Number': 'رول نمبر', 'Admission date': 'داخلہ کی تاریخ',
  'First name': 'پہلا نام', 'Last name': 'آخری نام', 'Gender': 'جنس', 'Date of birth': 'تاریخ پیدائش', 'B-Form number': 'ب فارم نمبر',
  'CNIC': 'شناختی کارڈ', 'Phone': 'فون', 'WhatsApp': 'واٹس ایپ', 'Email': 'ای میل', 'Address': 'پتہ', 'Nationality': 'قومیت',
  'Father': 'والد', 'Mother': 'والدہ', 'Guardian': 'سرپرست', 'Emergency contact': 'ہنگامی رابطہ',
  'Invoice': 'انوائس', 'Receipt': 'رسید', 'Amount': 'رقم', 'Balance': 'بقایا', 'Due date': 'واجب الادا تاریخ',
  'Message': 'پیغام', 'Message Type': 'پیغام کی قسم', 'Recipient': 'وصول کنندہ', 'Provider': 'پروائیڈر', 'Status': 'حالت',
  'Messaging Provider': 'میسجنگ پروائیڈر', 'Message Templates': 'پیغام ٹیمپلیٹس', 'Delivery Log': 'ترسیل ریکارڈ', 'Send Message': 'پیغام بھیجیں',
  'Fee Reminders': 'فیس یاد دہانیاں', 'Generate Monthly Fees': 'ماہانہ فیس بنائیں', 'Fee structures': 'فیس اسٹرکچر', 'Fee heads': 'فیس مدات',
  'Print': 'پرنٹ', 'Print / PDF': 'پرنٹ / پی ڈی ایف', 'Print / Save PDF': 'پرنٹ / پی ڈی ایف محفوظ کریں',
  'Bonafide Certificate': 'بونا فائیڈ سرٹیفکیٹ', 'Enrollment Certificate': 'داخلہ سرٹیفکیٹ', 'Student ID Card': 'طالب علم شناختی کارڈ',
  'Certificate Templates': 'سرٹیفکیٹ ٹیمپلیٹس', 'Backup & restore': 'بیک اپ اور بحالی', 'Reset school data': 'اسکول ڈیٹا ری سیٹ',
  'Save school profile': 'اسکول پروفائل محفوظ کریں', 'Sign out': 'سائن آؤٹ', 'My account': 'میرا اکاؤنٹ',
  'Administrator': 'منتظم', 'Principal': 'پرنسپل', 'Accountant': 'اکاؤنٹنٹ', 'Receptionist': 'استقبالیہ', 'Class Teacher': 'کلاس ٹیچر', 'Subject Teacher': 'مضمون ٹیچر',
  'Report preview': 'رپورٹ پیش منظر', 'Ready to print or export.': 'پرنٹ یا ایکسپورٹ کے لیے تیار۔',
  'No records found': 'کوئی ریکارڈ موجود نہیں', 'Select class': 'کلاس منتخب کریں', 'Select section': 'سیکشن منتخب کریں',
  'All classes': 'تمام کلاسیں', 'All sections': 'تمام سیکشن', 'All statuses': 'تمام حالتیں', 'Select student': 'طالب علم منتخب کریں',
  'Today': 'آج', 'Date': 'تاریخ', 'Time': 'وقت', 'Next': 'اگلا', 'Previous': 'پچھلا',
  'GSM Modem': 'جی ایس ایم موڈیم', 'SMS Gateway API': 'ایس ایم ایس گیٹ وے اے پی آئی', 'Android SMS Gateway': 'اینڈرائیڈ ایس ایم ایس گیٹ وے',
  'WhatsApp Business API': 'واٹس ایپ بزنس اے پی آئی', 'Connect': 'کنیکٹ کریں', 'Disconnect': 'منقطع کریں',
  'Test SMS': 'ٹیسٹ ایس ایم ایس', 'Refresh Ports': 'پورٹس تازہ کریں', 'Auto Detect Modem': 'موڈیم خودکار شناخت',
  'COM Port': 'کوم پورٹ', 'Baud Rate': 'باڈ ریٹ', 'SIM Number': 'سم نمبر', 'Network Operator': 'نیٹ ورک آپریٹر', 'Signal Strength': 'سگنل کی طاقت',
  'Register student': 'طالب علم رجسٹر کریں', 'New student registration': 'نیا طالب علم رجسٹریشن', 'Edit student': 'طالب علم میں ترمیم', 'Student Profile': 'طالب علم پروفائل',
  'Archived students': 'محفوظ شدہ طلبہ', 'Active students': 'فعال طلبہ', 'Promote class': 'کلاس پروموٹ کریں', 'Promote student': 'طالب علم پروموٹ کریں',
  'Documents': 'دستاویزات', 'Parents & guardians': 'والدین اور سرپرست', 'Contact & address': 'رابطہ اور پتہ', 'Identity & admission': 'شناخت اور داخلہ',
  'Class test history': 'کلاس ٹیسٹ تاریخ', 'Enrollment history': 'داخلہ تاریخ', 'Bonafide': 'بونا فائیڈ', 'Enrollment': 'داخلہ', 'ID card': 'شناختی کارڈ',
  'Academic session': 'تعلیمی سال', 'Class filter': 'کلاس فلٹر', 'Section filter': 'سیکشن فلٹر', 'Select a class first': 'پہلے کلاس منتخب کریں',
  'Create class': 'کلاس بنائیں', 'Create classes': 'کلاسیں بنائیں', 'Manage subjects': 'مضامین کا انتظام', 'Add teachers': 'اساتذہ شامل کریں',
  'My classes & subjects': 'میری کلاسیں اور مضامین', 'Today\'s timetable': 'آج کا ٹائم ٹیبل', 'My attendance': 'میری حاضری',
  'Student attendance': 'طلبہ کی حاضری', 'Staff attendance': 'عملے کی حاضری', 'Daily report': 'روزانہ رپورٹ', 'Class register': 'کلاس رجسٹر',
  'Mark attendance': 'حاضری لگائیں', 'Save attendance': 'حاضری محفوظ کریں', 'All present': 'سب حاضر', 'All absent': 'سب غیر حاضر',
  'Invoices & collection': 'انوائس اور وصولی', 'Manual invoice': 'دستی انوائس', 'Generate monthly': 'ماہانہ فیس بنائیں',
  'Income & expenses': 'آمدن اور اخراجات', 'Outstanding students': 'بقایا طلبہ', 'Total due': 'کل بقایا',
  'Class tests': 'کلاس ٹیسٹ', 'Term exams': 'مدتی امتحانات', 'Results & award lists': 'نتائج اور ایوارڈ فہرست',
  'Create class test': 'کلاس ٹیسٹ بنائیں', 'Create term exam': 'مدتی امتحان بنائیں', 'Enter marks': 'نمبر درج کریں',
  'Messaging Providers': 'میسجنگ پروائیڈرز',
  'Save Provider': 'پروائیڈر محفوظ کریں', 'Save Gateway': 'گیٹ وے محفوظ کریں', 'Verify Connection': 'کنکشن کی تصدیق',
  'School profile': 'اسکول پروفائل', 'Users': 'صارفین', 'Roles & permissions': 'کردار اور اجازتیں', 'Rules & preferences': 'قواعد اور ترجیحات',
  'Certificate templates': 'سرٹیفکیٹ ٹیمپلیٹس', 'Save certificate templates': 'سرٹیفکیٹ ٹیمپلیٹس محفوظ کریں',
  'Run report': 'رپورٹ چلائیں', 'Export CSV': 'سی ایس وی ایکسپورٹ', 'Export Excel': 'ایکسل ایکسپورٹ',
  'Male': 'مرد', 'Female': 'خاتون', 'Other': 'دیگر', 'Yes': 'ہاں', 'No': 'نہیں', 'None': 'کوئی نہیں',
  'Loading': 'لوڈ ہو رہا ہے', 'Error': 'خرابی', 'Success': 'کامیابی', 'Warning': 'انتباہ'
};

const dictionary = {
  en: { dashboard: 'Dashboard', students: 'Students', staff: 'Staff', attendance: 'Attendance', fees: 'Fees', examinations: 'Examinations', reports: 'Reports', settings: 'Settings', save: 'Save', cancel: 'Cancel', search: 'Search', add: 'Add New', logout: 'Sign out' },
  ur: { dashboard: 'ڈیش بورڈ', students: 'طلبہ', staff: 'عملہ', attendance: 'حاضری', fees: 'فیس', examinations: 'امتحانات', reports: 'رپورٹس', settings: 'ترتیبات', save: 'محفوظ کریں', cancel: 'منسوخ کریں', search: 'تلاش', add: 'نیا شامل کریں', logout: 'سائن آؤٹ' }
};

type Context = { language: Language; setLanguage: (language: Language) => void; t: (key: keyof typeof dictionary.en) => string };
const LanguageContext = createContext<Context | undefined>(undefined);

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function translate(source: string, language: Language) {
  if (language === 'en') return source;
  const exact = urdu[source.trim()];
  if (exact) return source.replace(source.trim(), exact);
  return Object.keys(urdu).sort((a, b) => b.length - a.length).reduce((text, phrase) => text.replace(new RegExp(escapeRegExp(phrase), 'g'), urdu[phrase]), source);
}

function useDocumentLocalization(language: Language) {
  const originals = useRef(new WeakMap<Text, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    const isIgnored = (element: Element | null) => Boolean(element?.closest('script, style, code, pre, textarea, [data-no-translate]'));
    const localizeText = (node: Text) => {
      if (!node.parentElement || isIgnored(node.parentElement)) return;
      if (!originals.current.has(node)) originals.current.set(node, node.data);
      const source = originals.current.get(node) || '';
      const desired = translate(source, language);
      if (node.data !== desired) node.data = desired;
    };
    const localizeElement = (element: Element) => {
      if (isIgnored(element)) return;
      ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
        const current = element.getAttribute(attribute);
        if (!current) return;
        let originalsForElement = attributeOriginals.current.get(element);
        if (!originalsForElement) { originalsForElement = new Map(); attributeOriginals.current.set(element, originalsForElement); }
        if (!originalsForElement.has(attribute)) originalsForElement.set(attribute, current);
        const desired = translate(originalsForElement.get(attribute) || current, language);
        if (current !== desired) element.setAttribute(attribute, desired);
      });
    };
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) localizeText(node as Text);
      if (node.nodeType === Node.ELEMENT_NODE) {
        localizeElement(node as Element);
        node.childNodes.forEach(walk);
      }
    };
    walk(root);
    const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => {
      if (mutation.type === 'characterData') localizeText(mutation.target as Text);
      if (mutation.type === 'attributes') localizeElement(mutation.target as Element);
      mutation.addedNodes.forEach(walk);
    }));
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    return () => observer.disconnect();
  }, [language]);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('school_erp_language') === 'ur' ? 'ur' : 'en');
  useEffect(() => {
    localStorage.setItem('school_erp_language', language);
    document.documentElement.lang = language === 'ur' ? 'ur' : 'en';
    // Keep the desktop shell physically stable. Urdu localizes content only;
    // sidebar, navbar, cards, and table positions remain in their LTR locations.
    document.documentElement.dir = 'ltr';
    document.documentElement.classList.toggle('urdu-language', language === 'ur');
  }, [language]);
  useDocumentLocalization(language);
  const value = useMemo(() => ({ language, setLanguage, t: (key: keyof typeof dictionary.en) => dictionary[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => { const context = useContext(LanguageContext); if (!context) throw new Error('Language provider missing'); return context; };
