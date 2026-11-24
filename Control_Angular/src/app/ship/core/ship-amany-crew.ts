import { AMANY_CREW_FILES } from './ship-amany-crew-files';
import { CrewCert, CrewDept, CrewDocument, CrewEvent, CrewMember, CrewStatus, CrewTour } from './ship.types';

function papers(id: string): CrewDocument[] {
  return (AMANY_CREW_FILES[id] ?? []).map((file, index) => ({
    id: `${id}-d${index + 1}`,
    kind: file.kind,
    name: file.name,
    path: file.path,
  }));
}

function certsOf(id: string, person: Person): CrewCert[] {
  const rows: CrewCert[] = [
    { id: `${id}-sb`, name: 'جواز بحار', number: person.seaman, expiry: person.seamanExp },
    { id: `${id}-pp`, name: 'جواز سفر', number: person.passport, expiry: person.passportExp },
  ];
  if (person.gmdss) rows.push({ id: `${id}-gmdss`, name: 'GMDSS', number: person.gmdss, expiry: person.gmdssExp ?? '' });
  return rows;
}

function eventsOf(id: string, tours: CrewTour[], status: CrewStatus): CrewEvent[] {
  const events: CrewEvent[] = [];
  tours.forEach((tour, index) => {
    const current = index === tours.length - 1 && status === 'OnBoard' && !tour.signOff;
    if (!tour.signOff && !current) return;
    events.push({ id: `${id}-on-${index}`, date: tour.signOn, type: 'sign-on', note: tour.signOnPort });
    if (tour.signOff) events.push({ id: `${id}-off-${index}`, date: tour.signOff, type: 'sign-off', note: tour.signOffPort });
  });
  return events;
}

interface Person {
  id: string;
  name: string;
  nameEn: string;
  rank: string;
  dept: CrewDept;
  nationality: string;
  birth: string;
  place: string;
  passport: string;
  passportExp: string;
  seaman: string;
  seamanExp: string;
  oldSeaman?: string;
  gmdss?: string;
  gmdssExp?: string;
  status: CrewStatus;
  tours: CrewTour[];
  notes?: string;
}

function crew(person: Person): CrewMember {
  return {
    id: person.id,
    name: person.name,
    nameEn: person.nameEn,
    rank: person.rank,
    dept: person.dept,
    nationality: person.nationality,
    birthDate: person.birth,
    birthPlace: person.place,
    passportNo: person.passport,
    passportExpiry: person.passportExp,
    seamanBookNo: person.seaman,
    seamanBookExpiry: person.seamanExp,
    previousSeamanBook: person.oldSeaman ?? '',
    gmdssNo: person.gmdss ?? '',
    gmdssExpiry: person.gmdssExp ?? '',
    phone: '',
    salary: 0,
    photo: null,
    status: person.status,
    certs: certsOf(person.id, person),
    documents: papers(person.id),
    tours: person.tours,
    events: eventsOf(person.id, person.tours, person.status),
    notes: person.notes ?? '',
  };
}

const onBoard = 'OnBoard' as const;
const former = 'Former' as const;

/** الطاقم من كشف 10/10/2026 والقوائم السابقة. التواريخ حقول، والملاحظة سبب النزول فقط. */
export function amanyCrew(): CrewMember[] {
  return [
    crew({ id: 'cr-tarek', name: 'طارق السيد أحمد زيان', nameEn: 'TAREK ELSYED AHMED ZAYAN', rank: 'ربان', dept: 'deck', nationality: 'مصري', birth: '1977-03-12', place: 'الغربية', passport: 'A44771009', passportExp: '2033-04-06', seaman: 'S00052180', seamanExp: '2028-05-15', gmdss: 'A25-01244', gmdssExp: '2027-09-09', status: onBoard, tours: [{ signOn: '2026-08-26', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'ربان', note: '' }] }),
    crew({ id: 'cr-mahmoud', name: 'محمود ياسر علي شحاتة', nameEn: 'MAHMOUD YASSER ALI SHEHATA', rank: 'ضابط أول', dept: 'deck', nationality: 'مصري', birth: '1995-12-19', place: 'الشرقية', passport: 'A46521094', passportExp: '2033-09-28', seaman: 'S00050864', seamanExp: '2029-05-06', gmdss: 'A25-00282', gmdssExp: '2030-03-22', status: onBoard, tours: [{ signOn: '2026-10-08', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'ضابط أول', note: '' }] }),
    crew({ id: 'cr-abdalla', name: 'عبد الله محمد جاموس', nameEn: 'ABDALLA JAMOUS', rank: 'كبير مهندسين', dept: 'engine', nationality: 'سوري', birth: '1968-12-04', place: 'اللاذقية', passport: 'N00118321', passportExp: '2029-09-02', seaman: '0003854', seamanExp: '2032-06-01', oldSeaman: '001190004895', status: onBoard, tours: [
      { signOn: '2024-08-12', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'مهندس ثانٍ ثم كبير مهندسين', note: 'ترقى كبير مهندسين في 08/02/2025 ونزل بعد 11/03/2025' },
      { signOn: '2026-08-15', signOnPort: 'دوريس، ألبانيا', signOff: null, signOffPort: '', rank: 'كبير مهندسين', note: '' },
    ] }),
    crew({ id: 'cr-samir', name: 'سمير مجدي أحمد عبد الله', nameEn: 'SAMIR MAGDY AHMED ABD-ALLA', rank: 'مهندس ثالث', dept: 'engine', nationality: 'مصري', birth: '1993-06-02', place: 'دمياط', passport: 'A35501142', passportExp: '2030-10-16', seaman: 'S00068419', seamanExp: '2031-09-21', oldSeaman: 'S00019566', status: onBoard, tours: [
      { signOn: '2025-02-01', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'مهندس مساعد ثم ثانٍ وثالث', note: 'نزل بعد 11/03/2025' },
      { signOn: '2026-10-08', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'مهندس ثالث', note: '' },
    ] }),
    crew({ id: 'cr-alaa', name: 'علاء رشدي محمد الديب', nameEn: 'ALAA ROSHDY MOHAMED ELDEEB', rank: 'بحار ماهر 1', dept: 'deck', nationality: 'مصري', birth: '1990-05-02', place: 'دمياط', passport: 'A37185387', passportExp: '2031-03-22', seaman: 'S00032351', seamanExp: '2028-06-06', status: onBoard, tours: [
      { signOn: '2024-07-06', signOnPort: 'الإسكندرية', signOff: null, signOffPort: '', rank: 'بحار عادي ثم ماهر', note: 'نزل بعد 11/03/2025' },
      { signOn: '2026-08-24', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'بحار ماهر 1', note: '' },
    ] }),
    crew({ id: 'cr-obada', name: 'عبادة محروس السيد جمعة', nameEn: 'OBADA MAHROS ELSAYED GOMAA', rank: 'بحار ماهر 2', dept: 'deck', nationality: 'مصري', birth: '2003-03-04', place: 'دمياط', passport: 'A41085552', passportExp: '2031-03-22', seaman: 'S00051936', seamanExp: '2030-03-09', status: onBoard, tours: [{ signOn: '2026-10-08', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'بحار ماهر 2', note: '' }] }),
    crew({ id: 'cr-nader', name: 'نادر نادر محمد سرحان', nameEn: 'NADER NADER MOHAMED SARHAN', rank: 'بحار عادي 1', dept: 'deck', nationality: 'مصري', birth: '1993-05-03', place: 'دمياط', passport: 'A27417351', passportExp: '2028-01-20', seaman: 'S00045630', seamanExp: '2029-09-01', status: onBoard, tours: [{ signOn: '2026-10-10', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'بحار عادي 1', note: '' }] }),
    crew({ id: 'cr-zeyad', name: 'زياد محمد علي بركات', nameEn: 'ZEYAD MOHAMED ALI BARAKAT', rank: 'بحار عادي 2', dept: 'deck', nationality: 'مصري', birth: '2002-09-12', place: 'دمياط', passport: 'A42037562', passportExp: '2032-07-07', seaman: 'S00053777', seamanExp: '2030-05-13', status: onBoard, tours: [{ signOn: '2026-10-08', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'بحار عادي 2', note: '' }] }),
    crew({ id: 'cr-rouds', name: 'أحمد جمال فتحي رودس', nameEn: 'AHMED GAMAL FATHY ROUDS', rank: 'مزيّت 1', dept: 'engine', nationality: 'مصري', birth: '1997-04-06', place: 'دمياط', passport: 'A38721687', passportExp: '2031-08-27', seaman: 'S00025626', seamanExp: '2027-09-24', status: onBoard, tours: [
      { signOn: '2024-11-16', signOnPort: 'الإسكندرية', signOff: null, signOffPort: '', rank: 'مزيّت', note: 'نزل بعد 11/03/2025' },
      { signOn: '2026-05-16', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'مزيّت 1', note: '' },
    ] }),
    crew({ id: 'cr-serag', name: 'محمد محمد سراج الدين محمد السيد', nameEn: 'MOHAMED MOHAMED SERAGELDIN MOHAMED ELSAYED', rank: 'مزيّت 2', dept: 'engine', nationality: 'مصري', birth: '1986-07-11', place: 'دمياط', passport: 'A32002631', passportExp: '2029-11-14', seaman: 'S00041901', seamanExp: '2029-05-07', status: onBoard, tours: [
      { signOn: '2024-08-12', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'مزيّت', note: 'نزل بعد 11/03/2025' },
      { signOn: '2025-11-03', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'مزيّت 2', note: '' },
    ] }),
    crew({ id: 'cr-reda', name: 'رضا محمد المغازي إسماعيل', nameEn: 'REDA MOHAMED ELMOGHAZY ISMAIL', rank: 'طباخ', dept: 'catering', nationality: 'مصري', birth: '1990-10-27', place: 'الغربية', passport: 'A35188013', passportExp: '2030-09-17', seaman: 'S00032501', seamanExp: '2028-07-08', status: onBoard, tours: [{ signOn: '2025-09-21', signOnPort: 'الإسكندرية', signOff: null, signOffPort: '', rank: 'طباخ', note: '' }] }),
    crew({ id: 'cr-elalamy', name: 'محمد رفعت مصطفى العلمي', nameEn: 'MOHAMED REFAAT MOSTAFA ELALAMY', rank: 'ربان', dept: 'deck', nationality: 'مصري', birth: '1988-06-01', place: 'دمياط', passport: 'A31761883', passportExp: '2029-10-11', seaman: 'S00039615', seamanExp: '2029-02-18', gmdss: 'ALS C-01/CH-100', gmdssExp: '2026-01-22', status: former, notes: 'استلم مكانه طارق زيان في 26/08/2026', tours: [{ signOn: '2024-08-11', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'ربان', note: 'نزل بعد 11/03/2025 وقبل 26/08/2026' }] }),
    crew({ id: 'cr-abdelrazik', name: 'محمد محمود محمد عبد الرازق', nameEn: 'MOHAMED MAHMOUD MOHAMED ABDELRAZIK', rank: 'ضابط أول', dept: 'deck', nationality: 'مصري', birth: '1991-02-06', place: 'دمياط', passport: 'A32008241', passportExp: '2029-11-04', seaman: 'S00032749', seamanExp: '2028-06-11', gmdss: 'XNG567', gmdssExp: '', status: former, tours: [
      { signOn: '2024-05-19', signOnPort: 'الإسكندرية', signOff: '2024-11-16', signOffPort: 'الإسكندرية', rank: 'ضابط أول', note: 'تبديل مع محمد طنطاوي' },
      { signOn: '2025-01-29', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'ضابط أول', note: 'نزل بعد 11/03/2025' },
    ] }),
    crew({ id: 'cr-tantawi', name: 'محمد أحمد محمود إبراهيم طنطاوي', nameEn: 'MOHAMED AHMED MAHMOUD IBRAHIM TANTAWY', rank: 'ضابط أول', dept: 'deck', nationality: 'مصري', birth: '1985-02-24', place: 'العراق', passport: 'A27118159', passportExp: '2027-09-13', seaman: 'S00029886', seamanExp: '2028-01-18', status: former, notes: 'سلّم لمحمد محمود عبد الرازق', tours: [{ signOn: '2024-11-16', signOnPort: 'الإسكندرية', signOff: '2025-01-29', signOffPort: 'دمياط', rank: 'ضابط أول', note: '' }] }),
    crew({ id: 'cr-hassan', name: 'حسان عابده مصطفى', nameEn: 'HASSAN ABDEH', rank: 'كبير مهندسين', dept: 'engine', nationality: 'سوري', birth: '1981-04-18', place: 'طرطوس', passport: 'N013708028', passportExp: '2025-12-07', seaman: '001190005118', seamanExp: '2025-12-09', status: former, notes: 'ترقى عبد الله جاموس مكانه', tours: [{ signOn: '2024-10-15', signOnPort: 'صفاقس', signOff: null, signOffPort: '', rank: 'كبير مهندسين', note: 'نزل بين 02/02/2025 و08/02/2025 أثناء رحلة دمياط إلى كوبر' }] }),
    crew({ id: 'cr-elshamy', name: 'محمد الغريب ياقوت الشامي', nameEn: 'MOHAMED ELGHARIIB YAKOUT ELSHAMY', rank: 'بحار ماهر 2', dept: 'deck', nationality: 'مصري', birth: '1991-03-23', place: 'دمياط', passport: 'A30748732', passportExp: '2024-11-22', seaman: 'S00037898', seamanExp: '2028-12-17', status: former, notes: 'حل محله أمير عبد السلام', tours: [{ signOn: '2024-08-14', signOnPort: 'دمياط', signOff: '2024-11-16', signOffPort: 'الإسكندرية', rank: 'بحار ماهر 2', note: '' }] }),
    crew({ id: 'cr-abouamasha', name: 'أحمد علي محمد حسن أبو عماشة', nameEn: 'AHMED ALY MOHAMED HASSAN ABOU AMASHA', rank: 'مزيّت 1', dept: 'engine', nationality: 'مصري', birth: '1994-02-26', place: 'دمياط', passport: 'A24362855', passportExp: '2026-03-06', seaman: 'S00019566', seamanExp: '2026-11-21', status: former, notes: 'حل محله أحمد جمال فتحي رودس', tours: [{ signOn: '2024-08-14', signOnPort: 'دمياط', signOff: '2024-11-16', signOffPort: 'الإسكندرية', rank: 'مزيّت 1', note: '' }] }),
    crew({ id: 'cr-makram', name: 'محمد مكرم محمد إبراهيم', nameEn: 'MOHAMED MAKRAM MOHAMED IBRAHIM', rank: 'بحار ماهر 1', dept: 'deck', nationality: 'مصري', birth: '1996-09-21', place: 'الدقهلية', passport: 'A25653166', passportExp: '2026-10-02', seaman: 'S00034006', seamanExp: '2027-10-30', status: former, notes: 'حل محله كريم سمير محمد', tours: [{ signOn: '2024-08-14', signOnPort: 'دمياط', signOff: '2024-12-23', signOffPort: 'دمياط', rank: 'بحار ماهر 1', note: '' }] }),
    crew({ id: 'cr-mosaad', name: 'مسعد يوسف مسعد الجمال', nameEn: 'MOSAAD YOUSSEF MOSAAD ELGAMMAL', rank: 'بحار عادي 1', dept: 'deck', nationality: 'مصري', birth: '1995-03-27', place: 'دمياط', passport: 'A35698240', passportExp: '2030-11-11', seaman: 'S00032052', seamanExp: '2028-06-17', status: former, notes: 'حل محله عمر عبد العال', tours: [{ signOn: '2024-07-14', signOnPort: 'العريش', signOff: '2025-03-11', signOffPort: 'دمياط', rank: 'بحار عادي 1', note: '' }] }),
    crew({ id: 'cr-elsayed-ab', name: 'محمد السيد محمد رودس', nameEn: 'MOHAMED ELSAYED MOHAMED ROUDS', rank: 'بحار ماهر 3', dept: 'deck', nationality: 'مصري', birth: '1966-10-22', place: 'دمياط', passport: 'A35622247', passportExp: '2030-10-31', seaman: 'S00036347', seamanExp: '2028-11-01', status: former, tours: [
      { signOn: '2024-11-17', signOnPort: 'الإسكندرية', signOff: null, signOffPort: '', rank: 'بحار ماهر 3', note: 'نزل أواخر يناير 2025 في دمياط' },
      { signOn: '2025-03-11', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'بحار ماهر 3', note: 'نزل بعد 11/03/2025' },
    ] }),
    crew({ id: 'cr-kareem', name: 'كريم سمير محمد', nameEn: 'KARIM SAMIR MOHAMED', rank: 'بحار ماهر 1', dept: 'deck', nationality: 'مصري', birth: '1993-02-14', place: 'الإسماعيلية', passport: 'A34101302', passportExp: '2030-05-30', seaman: 'S00030864', seamanExp: '2026-01-30', status: former, tours: [{ signOn: '2024-12-23', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'بحار ماهر 1', note: 'نزل بعد 11/03/2025 وقبل انتهاء جوازه البحري في 30/01/2026' }] }),
    crew({ id: 'cr-amir', name: 'أمير عبد السلام محمد عبد السلام مرسي', nameEn: 'AMIR ABD ELSALAM MOHAMED MORSY', rank: 'بحار عادي 1', dept: 'deck', nationality: 'مصري', birth: '1997-05-25', place: 'الإسكندرية', passport: 'A30145823', passportExp: '2029-03-12', seaman: 'S00019153', seamanExp: '2026-11-07', status: former, tours: [{ signOn: '2024-11-16', signOnPort: 'الإسكندرية', signOff: null, signOffPort: '', rank: 'بحار ماهر ثم بحار عادي', note: 'نزل بعد 11/03/2025 وقبل 08/10/2026' }] }),
    crew({ id: 'cr-omar', name: 'عمر عبد الرحمن عبد العال', nameEn: 'OMAR ABDELRAHMAN ABDELAL', rank: 'بحار عادي 2', dept: 'deck', nationality: 'مصري', birth: '2002-11-22', place: 'دمياط', passport: 'A36556264', passportExp: '2031-02-06', seaman: 'S00038383', seamanExp: '2029-01-03', status: former, notes: 'حل محله زياد محمد علي بركات', tours: [{ signOn: '2025-03-11', signOnPort: 'دمياط', signOff: null, signOffPort: '', rank: 'بحار عادي 2', note: 'نزل بعد 11/03/2025 وقبل 08/10/2026' }] }),
    crew({ id: 'cr-shady', name: 'شادي السعيد محمد الطنطاوي', nameEn: 'SHADY ELSAID MOHAMED ELTANTAWY', rank: 'طباخ', dept: 'catering', nationality: 'مصري', birth: '1976-10-08', place: 'دمياط', passport: 'A22679214', passportExp: '2025-05-14', seaman: 'S00035090', seamanExp: '2028-09-24', status: former, notes: 'استلم مكانه رضا المغازي في 21/09/2025', tours: [{ signOn: '2024-07-06', signOnPort: 'الإسكندرية', signOff: null, signOffPort: '', rank: 'طباخ', note: 'نزل بعد 11/03/2025 وقبل انتهاء جواز السفر في 14/05/2025' }] }),
  ];
}
