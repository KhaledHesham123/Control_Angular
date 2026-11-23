import { Component, inject } from '@angular/core';
import { uid } from '../core/ship-calc';
import { ShipStore } from '../core/ship-store';
import { ROLE_PERMS, SHIP_ROLES, ShipPerm, ShipRole, ShipUser } from '../core/ship.types';

const PERM_LABEL: Record<ShipPerm, string> = {
  request: 'إنشاء طلبات الشراء',
  review: 'مراجعة الطلبات وإرسالها للموردين وتسجيل العروض',
  approve: 'اعتماد العروض وتحديد موعد التوريد',
  receive: 'تأكيد استلام الأصناف وتحديث المخزن',
  issue: 'الصرف من المخزن',
  daily: 'التقرير اليومي وقياس الخزانات',
  bunker: 'تسجيل تزويد الوقود',
  catalog: 'إدارة الأقسام والأصناف',
  suppliers: 'إدارة الموردين والموانئ',
  voyages: 'إدارة الرحلات والشحنات',
  crew: 'إدارة الطاقم',
  fleet: 'إدارة الأسطول والمواصفات',
  costs: 'رؤية التكاليف والرواتب',
};

@Component({
  selector: 'sh-users',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>المستخدمون والصلاحيات</h1>
          <p>
            الأدمن بيدير الكتالوج والموردين والموافقات. اللي على السفينة يعمل شيئين أساسيين: طلبات الشراء وتحديث بيانات الصرف والتقرير اليومي.
          </p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openEdit()"><sc-icon name="userplus" /> مستخدم جديد</button>
      </div>

      <div class="alert warn"><sc-icon name="info" /> إدارة المستخدمين هنا محلية للعرض. تسجيل الدخول الفعلي بيتم من خلال نظام الدخول الأساسي للتطبيق.</div>

      <section class="card">
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead><tr><th>الاسم</th><th>الإيميل</th><th>الدور</th><th>السفينة</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              @for (u of s.users(); track u.id) {
                <tr [class.dim]="!u.active">
                  <td><b>{{ u.name }}</b></td>
                  <td class="small"><span class="ltr">{{ u.email }}</span></td>
                  <td><span class="badge info">{{ roleLabel(u.role) }}</span></td>
                  <td>{{ vesselName(u.vesselId) }}</td>
                  <td><span class="badge" [class]="'badge ' + (u.active ? 'ok' : 'muted')">{{ u.active ? 'نشط' : 'موقوف' }}</span></td>
                  <td class="end tight">
                    <button type="button" class="btn btn-sm" (click)="openEdit(u)"><sc-icon name="edit" /></button>
                    <button type="button" class="btn btn-sm btn-danger" (click)="remove(u)"><sc-icon name="trash" /></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>مصفوفة الصلاحيات</h2></div>
        <div class="card-body flush table-wrap">
          <table class="tbl">
            <thead>
              <tr><th>الصلاحية</th>@for (r of roles; track r.id) { <th>{{ r.label }}</th> }</tr>
            </thead>
            <tbody>
              @for (p of perms; track p) {
                <tr>
                  <td>{{ permLabel(p) }}</td>
                  @for (r of roles; track r.id) {
                    <td>
                      @if (has(r.id, p)) { <span class="badge ok">نعم</span> } @else { <span class="badge muted">—</span> }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>

    @if (form) {
      <div class="modal-back" (click)="form = null">
        <div class="modal narrow" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ isNew ? 'مستخدم جديد' : 'تعديل المستخدم' }}</h3></div>
          <div class="modal-body">
            <label class="field"><span>الاسم</span><input type="text" [(ngModel)]="form.name" /></label>
            <label class="field"><span>الإيميل</span><input type="email" dir="ltr" [(ngModel)]="form.email" /></label>
            <label class="field">
              <span>الدور</span>
              <select [(ngModel)]="form.role">
                @for (r of roles; track r.id) { <option [value]="r.id">{{ r.label }}</option> }
              </select>
            </label>
            <label class="field">
              <span>السفينة</span>
              <select [(ngModel)]="form.vesselId">
                @for (v of s.vessels(); track v.id) { <option [value]="v.id">{{ v.name }}</option> }
              </select>
            </label>
            <label class="check"><input type="checkbox" [(ngModel)]="form.active" /> نشط</label>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="form = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="save()">حفظ</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShUsers {
  readonly s = inject(ShipStore);
  readonly roles = SHIP_ROLES.filter((r) => r.id !== 'Viewer');
  readonly perms = Object.keys(PERM_LABEL) as ShipPerm[];
  form: ShipUser | null = null;
  isNew = false;

  roleLabel(r: ShipRole): string {
    return SHIP_ROLES.find((x) => x.id === r)?.label ?? r;
  }

  vesselName(id: string): string {
    return this.s.vessels().find((v) => v.id === id)?.name ?? '—';
  }

  permLabel(p: ShipPerm): string {
    return PERM_LABEL[p];
  }

  has(role: ShipRole, p: ShipPerm): boolean {
    return ROLE_PERMS[role].includes(p);
  }

  openEdit(u?: ShipUser): void {
    this.isNew = !u;
    this.form = u ? { ...u } : { id: uid('usr'), name: '', email: '', role: 'Captain', vesselId: this.s.vessel().id, active: true };
  }

  save(): void {
    const f = this.form;
    if (!f || !f.name.trim() || !f.email.trim()) {
      this.s.notify('الاسم والإيميل مطلوبان.', 'warn');
      return;
    }
    this.s.saveUser(f);
    this.form = null;
  }

  remove(u: ShipUser): void {
    if (window.confirm(`حذف المستخدم «${u.name}»؟`)) this.s.deleteUser(u.id);
  }
}
