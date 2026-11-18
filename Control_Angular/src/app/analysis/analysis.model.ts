/** Owner screen for one month. Prices are compared per line, in USD. */
export interface OwnerAnalysis {
  periodLabel: string;
  narrativeAr: string;
  spendUsd: number;
  budgetUsd: number;
  savingsVsAverageUsd: number;
  savingsVsHighestUsd: number;
  missedSavingsUsd: number;
  vessels: VesselSpend[];
  topSuppliers: SupplierScore[];
  bottomSuppliers: SupplierScore[];
  heatmapCategories: string[];
  heatmap: HeatmapRow[];
  alerts: AnalysisAlert[];
  pareto: ParetoItem[];
  concentration: SpendShare[];
}

export interface VesselSpend {
  name: string;
  crew: number;
  spendUsd: number;
  budgetUsd: number;
  costPerManDayUsd: number;
  categories: CategorySpend[];
}

export interface CategorySpend {
  name: string;
  spendUsd: number;
}

/** Price index is percent versus the market average of the same line. Positive means more expensive. */
export interface SupplierScore {
  name: string;
  score: number;
  priceIndexPercent: number;
  responseRatePercent: number;
  responseHours: number;
  completenessPercent: number;
  exactPercent: number;
  probablePercent: number;
  unmatchedPercent: number;
  cheapestWinPercent: number;
  selectedPercent: number;
  spendSharePercent: number;
  note: string;
}

export interface HeatmapRow {
  supplier: string;
  /** Null means the supplier did not price that category on the lines compared. */
  cells: Array<number | null>;
}

export type AlertKind = 'cover' | 'waste' | 'anomaly' | 'spike' | 'price' | 'consolidate';

export interface AnalysisAlert {
  kind: AlertKind;
  title: string;
  detail: string;
}

export interface ParetoItem {
  name: string;
  vessel: string;
  spendUsd: number;
}

export interface SpendShare {
  supplier: string;
  spendUsd: number;
  sharePercent: number;
}
