import { Port, Voyage } from './ship.types';

const emptyStopFees = { berthFee: 0, pilotFee: 0, canalFee: 0, agencyFee: 0, legNm: null, legFuelT: null };

export function amanyTradePorts(): Port[] {
  return [
    { id: 'tubruq', name: 'طبرق', country: 'ليبيا', lat: 32.0833, lng: 23.9764, hfoPrice: 0, mgoPrice: 0, berthPerDay: 0, pilotage: 0, agency: 0, canal: 0, supplierIds: [], notes: 'TUBRUQ' },
    { id: 'damietta', name: 'دمياط', country: 'مصر', lat: 31.417, lng: 31.814, hfoPrice: 0, mgoPrice: 0, berthPerDay: 0, pilotage: 0, agency: 0, canal: 0, supplierIds: [], notes: 'DAMIETTA' },
    { id: 'reni', name: 'ريني', country: 'أوكرانيا', lat: 45.439, lng: 28.282, hfoPrice: 0, mgoPrice: 0, berthPerDay: 0, pilotage: 0, agency: 0, canal: 0, supplierIds: [], notes: 'RENI' },
  ];
}

/** رحلات شيت VESSELS 2026 حتى 24/11/2026. */
export function amanyTradeVoyages(): Voyage[] {
  return [
    {
      id: 20260921,
      number: 'AQ-001',
      title: 'طبرق ← دمياط',
      status: 'completed',
      startDate: '2026-09-21',
      endDate: '2026-10-12',
      expectedHfo: 0,
      expectedMgo: 0,
      expectedLube: 0,
      notes: 'رحلة واحدة. الوصول طبرق 21/09/2026 الساعة 11:30 ص وتحميل خردة حديد من 22/09 إلى 30/09 بكمية 2,388.73 طن. المغادرة من طبرق 30/09 الساعة 02:42 م والوصول دمياط 03/10 الساعة 03:58 م. الإبحار 3 أيام و1:16 ساعة، وانتظار المخطاف 20:02 ساعة. التفريغ في دمياط من 06/10 إلى 08/10 بكمية 2,385.10 طن وعجز 3.63 طن. الوقوف في دمياط وتحميل حديد التسليح من 08/10 إلى 12/10 بكمية 5,204.84 طن جزء من نفس الرحلة، مش رحلة لبلد تاني.',
      stops: [
        {
          id: 'aq1-tubruq',
          portId: 'tubruq',
          eta: '2026-09-21',
          etd: '2026-09-30',
          activities: ['تحميل'],
          ...emptyStopFees,
          actualFda: 7486.08,
          agent: 'ELREEDY',
        },
        {
          id: 'aq1-damietta',
          portId: 'damietta',
          eta: '2026-10-03',
          etd: '2026-10-12',
          activities: ['تفريغ', 'تحميل'],
          ...emptyStopFees,
          actualFda: 0,
          agent: 'ELREEDY',
        },
      ],
      sheet: {
        cargoType: 'STEEL SCRAP',
        destination: 'طبرق ← دمياط',
        agent: 'ELREEDY',
        daAmount: 7486.08,
        daContact: 'كريم الريدي',
        exporter: 'NOUR 2 SHIPPING AND TRADING CO',
        sailingTime: '3 أيام و1:16 ساعة',
        anchorTime: '0 يوم و20:02 ساعة',
        loads: [
          { type: 'STEEL SCRAP', place: 'طبرق', start: '2026-09-22', end: '2026-09-30', days: '9 أيام', qty: 2388.73 },
          { type: 'STEEL REBAR', place: 'دمياط', start: '2026-10-08', end: '2026-10-12', days: '5 أيام', qty: 5204.84 },
        ],
        discharges: [
          { type: 'STEEL SCRAP', place: 'دمياط', start: '2026-10-06', end: '2026-10-08', days: '3 أيام', qty: 2385.1, shortage: 3.63 },
        ],
        totalTime: '11 يوم و21:18 ساعة',
        operation: 'Complete',
      },
    },
    {
      id: 20261012,
      number: 'AQ-003',
      title: 'دمياط ← ريني',
      status: 'active',
      startDate: '2026-10-12',
      endDate: '',
      expectedHfo: 0,
      expectedMgo: 40.4,
      expectedLube: 0,
      expectedWater: 57,
      consumptions: [
        { kind: 'Diesel', quantity: 40.4 },
        { kind: 'Water', quantity: 57 },
      ],
      notes: 'مغادرة دمياط 12/10/2026 الساعة 12:00 م بحمولة حديد تسليح إلى ريني. الحالة في الشيت بتاريخ 24/11/2026: مخطاف. تقارير الظهيرة من 13/10 إلى 22/11 على نفس الرحلة.',
      stops: [
        {
          id: 'aq3-damietta',
          portId: 'damietta',
          eta: '2026-10-12',
          etd: '2026-10-12',
          activities: [],
          ...emptyStopFees,
          actualFda: 0,
          agent: 'ELREEDY',
        },
        {
          id: 'aq3-reni',
          portId: 'reni',
          eta: '',
          etd: '',
          activities: ['تفريغ'],
          ...emptyStopFees,
          actualFda: 0,
          agent: 'ELREEDY',
        },
      ],
      sheet: {
        cargoType: 'STEEL REBAR',
        destination: 'دمياط ← ريني',
        agent: 'ELREEDY',
        daAmount: null,
        daContact: 'صقر',
        exporter: 'NOUR 2 SHIPPING AND TRADING CO',
        sailingTime: '',
        anchorTime: '0 يوم و0:00 ساعة',
        loads: [],
        discharges: [{ type: 'STEEL REBAR', place: 'ريني', start: '', end: '', days: '', qty: null }],
        totalTime: '',
        operation: 'Anchor',
      },
    },
  ];
}
