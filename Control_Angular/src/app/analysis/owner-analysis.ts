import { Component, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { OWNER_ANALYSIS } from './analysis-sample';
import { AlertKind, OwnerAnalysis as AnalysisReport } from './analysis.model';

@Component({
  selector: 'app-owner-analysis',
  standalone: false,
  templateUrl: './owner-analysis.html',
  styleUrl: './owner-analysis.css',
})
export class OwnerAnalysis implements OnInit {
  private readonly title = inject(Title);

  readonly data: AnalysisReport = OWNER_ANALYSIS;

  ngOnInit(): void {
    this.title.setTitle('تحليل المشتريات | Ships Control');
  }

  money(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  signed(value: number): string {
    const rounded = Math.round(value);
    return `${rounded > 0 ? '+' : ''}${rounded}%`;
  }

  budgetPct(spend: number, budget: number): number {
    return Math.round((spend / budget) * 100);
  }

  budgetFill(spend: number, budget: number): number {
    return Math.min(this.budgetPct(spend, budget), 100);
  }

  budgetState(spend: number, budget: number): 'over' | 'under' {
    return spend > budget ? 'over' : 'under';
  }

  categoryWidth(spend: number, vesselSpend: number): number {
    return Math.max(4, Math.round((spend / vesselSpend) * 100));
  }

  paretoWidth(spend: number): number {
    const max = Math.max(...this.data.pareto.map((item) => item.spendUsd));
    return Math.round((spend / max) * 100);
  }

  cellClass(value: number | null): string {
    if (value === null) {
      return 'empty';
    }
    if (value <= -8) {
      return 'cheap';
    }
    if (value < 0) {
      return 'fair';
    }
    if (value < 10) {
      return 'warm';
    }
    return 'hot';
  }

  alertLabel(kind: AlertKind): string {
    const labels: Record<AlertKind, string> = {
      cover: 'نفاد',
      waste: 'هدر',
      anomaly: 'سعر',
      spike: 'طلب',
      price: 'ارتفاع',
      consolidate: 'تجميع',
    };
    return labels[kind];
  }
}
