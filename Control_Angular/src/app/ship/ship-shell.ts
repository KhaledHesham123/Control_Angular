import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ShipStore } from './core/ship-store';
import { NavSection, SHIP_NAV, SHIP_ROLES, ShipRole } from './core/ship.types';

@Component({
  selector: 'app-ship-shell',
  standalone: false,
  templateUrl: './ship-shell.html',
})
export class ShipShell implements OnInit {
  readonly store = inject(ShipStore);
  readonly roles = SHIP_ROLES;
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = signal(typeof window !== 'undefined' && window.matchMedia('(min-width: 961px)').matches);
  private readonly url = signal(this.router.url);

  /** عدد الطلبات اللي محتاجة إجراء من الدور الحالي. */
  readonly pending = computed(() => {
    const reqs = this.store.requests();
    if (this.store.can('review')) {
      return reqs.filter((r) => r.status === 'submitted' || r.status === 'offers' || r.status === 'sent' || r.status === 'ready').length;
    }
    return reqs.filter((r) => r.status === 'approved').length;
  });

  readonly sections = computed<NavSection[]>(() =>
    SHIP_NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || this.store.can(i.perm)) })).filter((s) => s.items.length > 0),
  );

  readonly roleLabel = computed(() => SHIP_ROLES.find((r) => r.id === this.store.role())?.label ?? '');

  constructor() {
    // لو الدور الحالي ملوش صلاحية على الصفحة المفتوحة، نرجعه للوحة المتابعة.
    effect(() => {
      const path = this.url().split(/[?#]/)[0] ?? '';
      const role = this.store.role();
      if (!role) return;
      const item = SHIP_NAV.flatMap((s) => s.items)
        .filter((i) => i.perm && (path === i.route || path.startsWith(i.route + '/')))
        .sort((a, b) => b.route.length - a.route.length)[0];
      if (item?.perm && !this.store.can(item.perm)) {
        void this.router.navigateByUrl('/ship');
        this.store.notify('الصفحة دي مش متاحة للدور الحالي.', 'warn');
      }
    });
  }

  ngOnInit(): void {
    this.title.setTitle('إدارة السفن | Falcon Shipping');
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (!window.matchMedia('(min-width: 961px)').matches) this.open.set(false);
        this.url.set(this.router.url);
      });
  }

  onRole(value: string): void {
    this.store.setRole(value as ShipRole);
  }

  onVessel(value: string): void {
    this.store.selectVessel(value);
  }
}
