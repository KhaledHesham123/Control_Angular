import { AMANY_VOYAGE_ID } from './ship-amany-ops';
import { DailyLog } from './ship.types';

type Noon = [
  date: string,
  sea: 0 | 1,
  location: string,
  speed: number | null,
  distance: number | null,
  hours: number,
  rob: number,
  used: number,
  sheet: number,
  fw: number,
  cyl: number,
  note: string,
];

const ROWS: Noon[] = [
  ['2026-10-13', 1, "33°10.60'N 030°19.70'E", 8.96, 130, 14.5, 36.1, 4.2, 0, 60, 5550, 'بداية القيد في الشيت، والاستهلاك الفعلي 4.2 طن'],
  ['2026-10-14', 1, "35°49.00'N 027°43.00'E", 8.45, 203, 24, 30.1, 6, 6, 63, 5480, ''],
  ['2026-10-15', 1, "35°49.00'N 027°43.00'E", 8.25, 198, 24, 24.1, 6, 6, 63, 5410, ''],
  ['2026-10-16', 1, "40°41.10'N 027°31.70'E", 7.6, 183, 24, 18.1, 6, 6, 63, 5340, ''],
  ['2026-10-17', 0, 'ISTANBUL ANCHOR', null, null, 0, 65.8, 2.3, 0, 62, 5315, 'تموين +50 طن. صافي الشيت +47.7 طن'],
  ['2026-10-18', 0, 'ISTANBUL ANCHOR', null, null, 0, 65.5, 0.3, 0.3, 60, 5315, ''],
  ['2026-10-19', 1, "40°41.10'N 027°31.70'E", 9.21, 212, 23, 59.4, 6.1, 6.1, 63, 5285, ''],
  ['2026-10-20', 0, 'SULINA ANCHOR', null, null, 0, 55.6, 3.8, 3.8, 66, 5250, 'يوم الوصول، وفيه إبحار جزئي'],
  ['2026-10-21', 0, 'SULINA ANCHOR', null, null, 0, 55.5, 0.1, 0.1, 64, 5250, ''],
  ['2026-10-22', 0, 'SULINA ANCHOR', null, null, 0, 55, 0.5, 0.5, 62, 5200, ''],
  ['2026-10-23', 0, 'SULINA ANCHOR', null, null, 0, 54.7, 0.3, 0.8, 60, 5200, 'الشيت سجّل 0.8 بخطأ معادلة، والفعلي 0.3'],
  ['2026-10-24', 0, 'SULINA ANCHOR', null, null, 0, 54.4, 0.3, 0.3, 58, 5200, ''],
  ['2026-10-25', 0, 'SULINA ANCHOR', null, null, 0, 54.1, 0.3, 0.3, 56, 5200, ''],
  ['2026-10-26', 0, 'SULINA ANCHOR', null, null, 0, 53.8, 0.3, 0.3, 56, 5200, ''],
  ['2026-10-27', 0, 'SULINA ANCHOR', null, null, 0, 53.5, 0.3, 0.3, 52, 5200, ''],
  ['2026-10-28', 0, 'SULINA ANCHOR', null, null, 0, 53.2, 0.3, 0.3, 50, 5150, ''],
  ['2026-10-29', 0, 'SULINA ANCHOR', null, null, 0, 52.9, 0.3, 0.3, 50, 5150, ''],
  ['2026-10-30', 0, 'SULINA ANCHOR', null, null, 0, 52.6, 0.3, 0.3, 46, 5150, ''],
  ['2026-10-31', 0, 'SULINA ANCHOR', null, null, 0, 52.3, 0.3, 0.6, 44, 5150, 'الشيت سجّل 0.6 بخطأ معادلة، والفعلي 0.3'],
  ['2026-11-01', 0, 'SULINA ANCHOR', null, null, 0, 52, 0.3, 0.3, 42, 5150, ''],
  ['2026-11-02', 0, 'SULINA ANCHOR', null, null, 0, 51.7, 0.3, 0.3, 40, 5150, ''],
  ['2026-11-03', 0, 'SULINA ANCHOR', null, null, 0, 51.4, 0.3, 0.3, 38, 5150, ''],
  ['2026-11-04', 0, 'SULINA ANCHOR', null, null, 0, 51.1, 0.3, 1.2, 36, 5150, 'الشيت سجّل 1.2 بخطأ معادلة، والفعلي 0.3'],
  ['2026-11-05', 0, 'SULINA ANCHOR', null, null, 0, 50.8, 0.3, 0.3, 34, 5150, ''],
  ['2026-11-06', 0, 'SULINA ANCHOR', null, null, 0, 50.5, 0.3, 0.3, 32, 5150, ''],
  ['2026-11-07', 0, 'SULINA ANCHOR', null, null, 0, 50.2, 0.3, 0.3, 30, 5150, ''],
  ['2026-11-08', 0, 'SULINA ANCHOR', null, null, 0, 49.9, 0.3, 0.3, 28, 5150, ''],
  ['2026-11-09', 0, 'SULINA ANCHOR', null, null, 0, 49.5, 0.4, 0.4, 24, 5150, ''],
  ['2026-11-10', 0, 'SULINA ANCHOR', null, null, 0, 49.2, 0.3, 0.3, 22, 5150, ''],
  ['2026-11-11', 0, 'SULINA ANCHOR', null, null, 0, 48.9, 0.3, 0.3, 22, 5150, ''],
  ['2026-11-12', 0, 'SULINA ANCHOR', null, null, 0, 48.6, 0.3, 0.3, 21, 5150, ''],
  ['2026-11-13', 0, 'SULINA ANCHOR', null, null, 0, 48.3, 0.3, 0.3, 20, 5150, ''],
  ['2026-11-14', 0, 'SULINA ANCHOR', null, null, 0, 48, 0.3, 0.3, 19, 5150, ''],
  ['2026-11-15', 0, 'SULINA ANCHOR', null, null, 0, 47.7, 0.3, 0.3, 18, 5150, ''],
  ['2026-11-16', 0, 'SULINA ANCHOR', null, null, 0, 47.4, 0.3, 0.3, 17, 5150, ''],
  ['2026-11-18', 0, 'SULINA ANCHOR', null, null, 0, 46.8, 0.6, 0.6, 16, 5150, 'يغطي 17 و18 نوفمبر لأن تقرير 17 لم يُرسل'],
  ['2026-11-19', 0, 'SULINA ANCHOR', null, null, 0, 46.5, 0.3, 0.3, 15, 5150, ''],
  ['2026-11-20', 0, 'SULINA ANCHOR', null, null, 0, 46.2, 0.3, 0.3, 14, 5150, ''],
  ['2026-11-22', 0, 'SULINA ANCHOR', null, null, 0, 45.7, 0.5, 0.5, 12, 5150, 'يغطي 21 و22 نوفمبر لأن تقرير 21 لم يُرسل'],
];

/** 39 تقرير ظهيرة من 13/10/2026 إلى 22/11/2026. الاستهلاك المعروض هو الفعلي. */
export function amanyNoonReports(): DailyLog[] {
  return ROWS.map((row) => {
    const [date, sea, location, speed, distance, hours, rob, used, sheet, fw, cyl, note] = row;
    return {
      id: `noon-${date}`,
      date,
      location,
      mode: sea ? 'sea' : 'port',
      by: 'تقرير ظهيرة',
      hfo: 0,
      mgo: used,
      lube: 0,
      water: 0,
      hours: { mainEngine: hours, boiler: 0, gens: [] },
      voyageId: AMANY_VOYAGE_ID,
      speedKn: speed,
      distanceNm: distance,
      dieselRob: rob,
      fwRob: fw,
      cylLiters: cyl,
      sheetMgo: sheet,
      note: note || undefined,
    };
  });
}
