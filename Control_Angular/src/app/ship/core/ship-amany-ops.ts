import { BunkerRecord, DailyRate, Expense, FixedCost, Tank } from './ship.types';

/** مصروفات وتقارير الظهيرة مربوطة برحلة دمياط ← ريني AQ-003. */
export const AMANY_VOYAGE_ID = 20261012;

const DIESEL_PRICE = 1572.5;
const WATER_PRICE = 8;
const CYL_PRICE = 2.71;
const ME_PRICE = 2.54;
const HYD_PRICE = 0.78;

export function amanyDailyRates(): DailyRate[] {
  return [
    {
      kind: 'Diesel',
      motion: 'Sailing',
      tonsPerDay: 6.025,
      unit: 'طن',
      unitPrice: DIESEL_PRICE,
      note: 'من 6.0 إلى 6.1 طن/يوم. السعر أكتوبر 1,572.50 ونوفمبر 1,583.86. تكلفة اليوم 9,474.31. متوسط السرعة 8.49 عقدة و420 لفة.',
    },
    {
      kind: 'Diesel',
      motion: 'Stopped',
      tonsPerDay: 0.3,
      unit: 'طن',
      unitPrice: DIESEL_PRICE,
      dailyCost: 473.45,
      note: 'الرقم الثابت 300 كجم/يوم. متوسط الشيت 0.476 طن لأن يوم الوصول 20/10 (3.8 طن إبحار جزئي) دخل ضمن أيام المخطاف، وتكلفته 750.71.',
    },
    {
      kind: 'Water',
      motion: 'Sailing',
      tonsPerDay: 2,
      unit: 'طن',
      unitPrice: WATER_PRICE,
      dailyCost: 0,
      note: 'تُعوض بجهاز التحلية +3 طن، فتكلفة اليوم أثناء الإبحار صفر.',
    },
    {
      kind: 'Water',
      motion: 'Stopped',
      tonsPerDay: 2,
      unit: 'طن',
      unitPrice: WATER_PRICE,
      note: 'أكتوبر 2 طن/يوم، والنصف الثاني من نوفمبر 1 طن/يوم. متوسط الشيت 2.09 وصافي التانك 1.65، والتكلفة 13.20 إلى 16.73.',
    },
    {
      kind: 'CylinderOil',
      motion: 'Sailing',
      tonsPerDay: 60,
      unit: 'لتر',
      unitPrice: CYL_PRICE,
      note: 'المتوسط 60 لتر/يوم، وإبحار 24 ساعة 70 لتر/يوم. التكلفة 162.60 إلى 189.70.',
    },
    {
      kind: 'CylinderOil',
      motion: 'Stopped',
      tonsPerDay: 0,
      unit: 'لتر',
      unitPrice: CYL_PRICE,
      note: 'الماكينة واقفة. متوسط الدفعات 6.18 لتر/يوم (35–50 لتر على فترات)، والتكلفة العادية صفر أو 16.74 كمتوسط عام.',
    },
    {
      kind: 'EngineOil',
      motion: 'Sailing',
      tonsPerDay: 0,
      unit: 'لتر',
      unitPrice: ME_PRICE,
      note: 'دائرة مغلقة. التزويد 50 إلى 100 لتر كل 15 يوماً تقريباً. متوسط الدفعات 6.06 لتر/يوم، والتكلفة العادية صفر أو 15.39 كمتوسط عام.',
    },
    {
      kind: 'EngineOil',
      motion: 'Stopped',
      tonsPerDay: 0,
      unit: 'لتر',
      unitPrice: ME_PRICE,
      note: 'لا يوجد استهلاك يومي والماكينة واقفة. نفس دفعات التزويد.',
    },
    {
      kind: 'HydraulicOil',
      motion: 'Sailing',
      tonsPerDay: 0,
      unit: 'لتر',
      unitPrice: HYD_PRICE,
      note: 'الرصيد ثابت عند 2,300 لتر من أول الرحلة لآخرها.',
    },
    {
      kind: 'HydraulicOil',
      motion: 'Stopped',
      tonsPerDay: 0,
      unit: 'لتر',
      unitPrice: HYD_PRICE,
      note: 'الرصيد ثابت عند 2,300 لتر.',
    },
  ];
}

export function amanyFixedCosts(): FixedCost[] {
  return [
    {
      code: 'crew',
      label: 'مرتبات الطاقم',
      amountPerDay: 962,
      note: '16 فرداً. أول 3 أيام من أكتوبر 951.67، ومتوسط الرحلة 961.21. رواتب الشهر 27,980 بالإضافة إلى 450 مكافآت.',
    },
    {
      code: 'kitchen',
      label: 'المطبخ والإعاشة',
      amountPerDay: 97.5,
      note: '5,850 على 60 يوماً، أي 6.09 للفرد في اليوم.',
    },
    {
      code: 'maintenance',
      label: 'مخصص الصيانة الدورية',
      amountPerDay: 210.28,
      note: '12,617 موزعة على 60 يوماً. المسجل مباشرة في شيت الرحلة 195 فقط، ومخصص التحليل للـ 39 يوماً 8,201.',
    },
    {
      code: 'insurance',
      label: 'مخصص التأمين',
      amountPerDay: 178.39,
      note: '16,055 موزعة على 90 يوماً حتى 16/12/2026.',
    },
    {
      code: 'certificates',
      label: 'مخصص الشهادات والتراخيص',
      amountPerDay: 138.8,
      note: '18,737.52 موزعة على 135 يوماً.',
    },
    {
      code: 'management',
      label: 'رسوم الإدارة',
      amountPerDay: 50,
      note: 'وليد دياب. 1,500 موزعة على 30 يوماً.',
    },
  ];
}

export function amanyTanks(): Tank[] {
  return [
    {
      id: 'mgo',
      name: 'خزان الديزل',
      kind: 'mgo',
      unit: 'طن',
      bob: 18,
      opening: 36.1,
      added: 50,
      consumed: 40.4,
      current: 45.7,
      max: 86.1,
      peak: 86.1,
      note: '',
    },
    {
      id: 'water',
      name: 'خزان المياه العذبة',
      kind: 'water',
      unit: 'طن',
      bob: 78,
      opening: 60,
      added: 9,
      consumed: 57,
      current: 12,
      max: 78,
      peak: 78,
      note: '',
    },
    {
      id: 'cyl',
      name: 'زيت السلندرات',
      kind: 'lube',
      unit: 'لتر',
      bob: 2200,
      opening: 5550,
      added: 0,
      consumed: 400,
      current: 5150,
      max: 5550,
      peak: 5550,
      note: '',
    },
    {
      id: 'me',
      name: 'زيت الماكينة',
      kind: 'lube',
      unit: 'لتر',
      bob: 1050,
      opening: 5200,
      added: 100,
      consumed: 200,
      current: 5100,
      max: 5300,
      peak: 5300,
      note: '',
    },
    {
      id: 'hyd',
      name: 'زيت الهيدروليك',
      kind: 'lube',
      unit: 'لتر',
      bob: 1890,
      opening: 2300,
      added: 0,
      consumed: 0,
      current: 2300,
      max: 2300,
      peak: 2300,
      note: '',
    },
  ];
}

export function amanyExpenses(): Expense[] {
  const date = '2026-11-22';
  const voyageId = AMANY_VOYAGE_ID;
  return [
    {
      id: 'exp-diesel',
      date,
      voyageId,
      category: 'fuel',
      label: 'الديزل (Diesel MGO)',
      amount: 62670.7,
      note: '40.81% من الرحلة، بمتوسط 1,606.94 في اليوم. الاستهلاك 38.1 إلى 40.4 طن. رصيد البداية 36.1 وتموين Agataz 50 طن بفاتورة 76,600، ورصيد النهاية 45.7.',
    },
    {
      id: 'exp-port',
      date,
      voyageId,
      category: 'port',
      label: 'مصاريف الموانئ والوكلاء',
      amount: 44531,
      note: '29%. Metro Shipping 15,448، وLibya Altadamen دفعتان 15,283 و13,800.',
    },
    {
      id: 'exp-crew',
      date,
      voyageId,
      category: 'crew',
      label: 'رواتب الطاقم',
      amount: 37487,
      note: '24.41%. 16 فرداً لمدة 39 يوماً، بمتوسط 961.21 في اليوم.',
    },
    {
      id: 'exp-kitchen',
      date,
      voyageId,
      category: 'other',
      label: 'المطبخ والإعاشة',
      amount: 3802.5,
      note: '2.48%. 39 يوماً × 97.50.',
    },
    {
      id: 'exp-management',
      date,
      voyageId,
      category: 'other',
      label: 'رسوم الإدارة',
      amount: 1500,
      note: '0.98%. مبلغ شهري مقطوع لوليد دياب، ومتوسطه على أيام الرحلة 38.46.',
    },
    {
      id: 'exp-dock',
      date,
      voyageId,
      category: 'other',
      label: 'الحوض الجاف',
      amount: 1500,
      note: '0.98%. مخصص مسجل على الرحلة في Trip Cost، ومتوسطه 38.46 في اليوم.',
    },
    {
      id: 'exp-oil',
      date,
      voyageId,
      category: 'fuel',
      label: 'الزيوت',
      amount: 1405.75,
      note: '0.92%. زيت سلندرات 1,151.75 لكمية 400–450 لتر، وزيت ماكينة 254 لكمية 100 لتر.',
    },
    {
      id: 'exp-water',
      date,
      voyageId,
      category: 'fuel',
      label: 'المياه العذبة',
      amount: 480,
      note: '0.31%. المسجل 60 طن × 8 دولار. البداية 60 والتصفية 9 والاستهلاك الفعلي 57 والنهاية 12.',
    },
    {
      id: 'exp-maint',
      date,
      voyageId,
      category: 'other',
      label: 'الصيانة الدورية',
      amount: 195,
      note: '0.13%. هذا المسجل المباشر في ملخص الرحلة. مخصص التحليل للـ 39 يوماً 8,201.',
    },
  ];
}

export function amanyBunkers(): BunkerRecord[] {
  return [
    {
      id: 'bk-agataz',
      date: '2026-10-17',
      tankId: 'mgo',
      qty: 50,
      pricePerTon: 1532,
      supplier: 'Agataz',
      port: 'إسطنبول',
      invoice: '76,600',
      sameDayUse: 2.3,
      voyageId: AMANY_VOYAGE_ID,
    },
    {
      id: 'bk-water',
      date: '2026-10-20',
      tankId: 'water',
      qty: 9,
      pricePerTon: 0,
      supplier: 'جهاز التحلية',
      port: '',
      invoice: '',
      voyageId: null,
    },
    {
      id: 'bk-me',
      date: '2026-11-10',
      tankId: 'me',
      qty: 100,
      pricePerTon: 2.54,
      supplier: 'تزويد التانك',
      port: '',
      invoice: '',
      voyageId: null,
    },
  ];
}
