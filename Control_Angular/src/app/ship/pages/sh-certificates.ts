import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { daysBetween, today } from '../core/ship-calc';
import { certDocStatus, certSummary, CertStatus, newCertificate } from '../core/ship-certs';
import { dateLabel, downloadCsv } from '../core/ship-format';
import { certRegisterPrint } from '../core/ship-print';
import { ShipStore } from '../core/ship-store';
import { CERT_SECTIONS, CertSection, Certificate } from '../core/ship.types';

type Tab = CertSection | 'crew';
type Filter = 'all' | 'expired' | 'soon' | 'empty' | 'nofile';

@Component({
  selector: 'sh-certificates',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>شهادات السفينة — {{ s.vessel().name }}</h1>
          <p>
            سجل بكل أنواع الشهادات زي نموذج «حالة شهادات السفينة» (DE-01). كل نوع شهادة ليه سطر: اكتب بياناته بإيدك وارفع ملف الشهادة (PDF أو صورة).
            النظام بينبّه قبل الانتهاء بـ 3 شهور.
          </p>
        </div>
        <div class="row">
          <button type="button" class="btn" (click)="print()"><sc-icon name="print" /> طباعة النموذج</button>
          <button type="button" class="btn" (click)="exportCsv()"><sc-icon name="down" /> CSV</button>
          @if (s.can('fleet')) {
            <button type="button" class="btn btn-primary" (click)="openNew()"><sc-icon name="plus" /> نوع شهادة جديد</button>
          }
        </div>
      </div>

      <div class="kpis">
        <div class="kpi ok"><label>سارية</label><strong>{{ sum().ok }}</strong><small>من {{ sum().total }} نوع</small></div>
        <div class="kpi warn"><label>تنتهي خلال 3 شهور</label><strong>{{ sum().soon }}</strong></div>
        <div class="kpi bad"><label>منتهية</label><strong>{{ sum().expired }}</strong></div>
        <div class="kpi"><label>لسه ما اتسجلتش</label><strong>{{ sum().empty }}</strong><small>أنواع محتاجة بيانات</small></div>
        <div class="kpi gold"><label>مسجّلة بدون ملف</label><strong>{{ sum().noFile }}</strong><small>محتاجة رفع الملف</small></div>
      </div>

      <div class="tabs">
        @for (sec of sections; track sec.id) {
          <button type="button" class="tab" [class.on]="tab() === sec.id" (click)="setTab(sec.id)">
            {{ sec.label }}
            @if (secAlerts(sec.id); as n) { <span class="badge bad">{{ n }}</span> }
          </button>
        }
        <button type="button" class="tab" [class.on]="tab() === 'crew'" (click)="setTab('crew')">شهادات الطاقم ({{ crewCerts().length }})</button>
      </div>

      @if (tab() !== 'crew') {
        <div class="row between">
          <div class="chips">
            <button type="button" class="chip" [class.on]="filter() === 'all'" (click)="filter.set('all')">الكل ({{ inSection().length }})</button>
            <button type="button" class="chip" [class.on]="filter() === 'expired'" (click)="filter.set('expired')">منتهية ({{ count('expired') }})</button>
            <button type="button" class="chip" [class.on]="filter() === 'soon'" (click)="filter.set('soon')">قريبة الانتهاء ({{ count('soon') }})</button>
            <button type="button" class="chip" [class.on]="filter() === 'empty'" (click)="filter.set('empty')">لم تُسجَّل ({{ count('empty') }})</button>
            <button type="button" class="chip" [class.on]="filter() === 'nofile'" (click)="filter.set('nofile')">بدون ملف ({{ count('nofile') }})</button>
          </div>
          <input class="search" type="search" placeholder="بحث باسم الشهادة أو الجهة" [value]="q()" (input)="q.set($any($event.target).value)" />
        </div>
        <p class="muted small">{{ sectionHint() }}</p>

        <section class="card">
          <div class="card-body flush table-wrap">
            <table class="tbl certs">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ tab() === 'dated' ? 'البند / المكان' : 'الشهادة' }}</th>
                  @if (tab() === 'dated') {
                    <th>الكمية</th><th>النوع</th><th>تاريخ الانتهاء</th><th>تاريخ الصنع</th>
                  } @else {
                    <th>الجهة المانحة</th>
                    <th>الإصدار</th>
                    @if (tab() === 'cert') { <th>آخر معاينة</th><th>الاستحقاق</th> }
                    <th>الانتهاء</th>
                  }
                  <th>الحالة</th>
                  <th>الملف</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of rows(); track c.id) {
                  @let st = status(c);
                  <tr [class.row-empty]="st.key === 'empty' || st.key === 'na'">
                    <td class="muted small"><span class="ltr">{{ c.no }}</span></td>
                    <td><b class="ltr-text">{{ c.title || '—' }}</b>@if (c.docNo) { <div class="muted small"><span class="ltr">{{ c.docNo }}</span></div> }</td>
                    @if (tab() === 'dated') {
                      <td>{{ c.qty || '—' }}</td>
                      <td>{{ c.type || '—' }}</td>
                      <td>{{ dateLabel(c.expiryDate) }}</td>
                      <td>{{ dateLabel(c.mfgDate) }}</td>
                    } @else {
                      <td>{{ c.issuer || '—' }}</td>
                      <td>{{ dateLabel(c.issueDate) }}</td>
                      @if (tab() === 'cert') {
                        <td>{{ dateLabel(c.lastInsp) }}</td>
                        <td>{{ dateLabel(c.dueDate) }}</td>
                      }
                      <td>{{ dateLabel(c.expiryDate) }}</td>
                    }
                    <td><span class="badge" [class]="'badge ' + st.tone">{{ st.label }}</span></td>
                    <td class="tight">
                      @if (c.file) {
                        <button type="button" class="btn btn-sm" (click)="view(c)" [title]="c.file.name"><sc-icon name="file" /> عرض</button>
                      } @else if (canEdit() && st.key !== 'na') {
                        <button type="button" class="btn btn-sm" (click)="pick(c)"><sc-icon name="up" /> رفع</button>
                      } @else {
                        <span class="muted small">—</span>
                      }
                    </td>
                    <td class="end tight">
                      @if (canEdit()) {
                        <button type="button" class="btn btn-sm" (click)="openEdit(c)"><sc-icon name="edit" /> {{ st.key === 'empty' ? 'تسجيل' : 'تعديل' }}</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!rows().length) { <div class="empty"><sc-icon name="shield" /> مفيش سطور بالفلتر ده.</div> }
          </div>
        </section>
      } @else {
        <section class="card">
          <div class="card-body flush table-wrap">
            <table class="tbl">
              <thead><tr><th>الفرد</th><th>الشهادة</th><th>الرقم</th><th>الانتهاء</th><th>الحالة</th></tr></thead>
              <tbody>
                @for (c of crewCerts(); track c.id) {
                  <tr>
                    <td><b>{{ c.member }}</b><div class="muted small">{{ c.rank }}</div></td>
                    <td>{{ c.name }}</td>
                    <td class="small"><span class="ltr">{{ c.number }}</span></td>
                    <td>{{ dateLabel(c.expiry) }}</td>
                    <td><span class="badge" [class]="'badge ' + crewState(c.expiry).tone">{{ crewState(c.expiry).label }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!crewCerts().length) { <div class="empty">لا توجد شهادات طاقم.</div> }
          </div>
        </section>
      }

      <input #picker type="file" accept="application/pdf,image/*" hidden (change)="onPicked($event)" />
    </div>

    @if (form; as f) {
      <div class="modal-back" (click)="form = null">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ isNew ? 'نوع شهادة جديد' : f.title || 'تسجيل بيانات الشهادة' }}</h3>
            <button type="button" class="btn btn-sm" (click)="form = null"><sc-icon name="x" /></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field wide">
                <span>اسم الشهادة / البند</span>
                <input type="text" dir="ltr" [(ngModel)]="f.title" [readOnly]="!s.can('fleet')" />
              </label>
              @if (isNew) {
                <label class="field">
                  <span>القسم</span>
                  <select [ngModel]="f.section" (ngModelChange)="changeSection($event)">
                    @for (sec of sections; track sec.id) {
                      <option [value]="sec.id" [selected]="f.section === sec.id">{{ sec.label }}</option>
                    }
                  </select>
                </label>
              }
              <label class="field"><span>الرقم في النموذج</span><input type="text" dir="ltr" [(ngModel)]="f.no" [readOnly]="!s.can('fleet')" /></label>

              @if (f.section === 'dated') {
                <label class="field"><span>الكمية (أو N/A لو لا ينطبق)</span><input type="text" dir="ltr" [(ngModel)]="f.qty" placeholder="مثال: 12" /></label>
                <label class="field"><span>النوع</span><input type="text" [(ngModel)]="f.type" /></label>
                <label class="field"><span>تاريخ الانتهاء (Exp. Date)</span><input type="date" [(ngModel)]="f.expiryDate" /></label>
                <label class="field"><span>تاريخ الصنع (Manf. Date)</span><input type="date" [(ngModel)]="f.mfgDate" /></label>
              } @else {
                <label class="field"><span>الجهة المانحة (Issued By)</span><input type="text" dir="ltr" [(ngModel)]="f.issuer" /></label>
                <label class="field"><span>رقم الشهادة</span><input type="text" dir="ltr" [(ngModel)]="f.docNo" /></label>
                <label class="field"><span>تاريخ الإصدار (Issue Date)</span><input type="date" [(ngModel)]="f.issueDate" /></label>
                @if (f.section === 'cert') {
                  <label class="field"><span>آخر معاينة (Last Insp.)</span><input type="date" [(ngModel)]="f.lastInsp" /></label>
                  <label class="field"><span>موعد الاستحقاق (Due Date)</span><input type="date" [(ngModel)]="f.dueDate" /></label>
                }
                <label class="field"><span>تاريخ الانتهاء (Exp. Date)</span><input type="date" [(ngModel)]="f.expiryDate" /></label>
              }
              <label class="field wide"><span>ملاحظات</span><input type="text" [(ngModel)]="f.notes" /></label>
            </div>

            <div class="file-box">
              <div class="between row">
                <b>ملف الشهادة</b>
                @if (preview(); as pv) {
                  <span class="badge" [class]="'badge ' + pv.tone">{{ pv.label }}</span>
                }
              </div>
              @if (pending) {
                <div class="alert"><sc-icon name="up" /> هيتم رفع: <b>{{ pending.name }}</b> ({{ sizeLabel(pending.size) }}) عند الحفظ.</div>
              } @else if (f.file && !removeFile) {
                <div class="alert">
                  <sc-icon name="file" /> <b>{{ f.file.name }}</b> · {{ sizeLabel(f.file.size) }} · اترفع {{ dateLabel(f.file.uploadedAt) }}
                </div>
              } @else {
                <div class="muted small">مفيش ملف مرفوع للسطر ده.</div>
              }
              <div class="row">
                <button type="button" class="btn btn-sm" (click)="modalPicker.click()"><sc-icon name="up" /> {{ f.file || pending ? 'استبدال الملف' : 'اختيار ملف (PDF / صورة)' }}</button>
                @if (f.file && !pending && !isNew) {
                  <button type="button" class="btn btn-sm" (click)="view(f)"><sc-icon name="file" /> عرض</button>
                  <button type="button" class="btn btn-sm" (click)="download(f)"><sc-icon name="down" /> تحميل</button>
                  <button type="button" class="btn btn-sm btn-danger" (click)="removeFile = !removeFile">{{ removeFile ? 'تراجع عن الحذف' : 'حذف الملف' }}</button>
                }
                @if (pending) {
                  <button type="button" class="btn btn-sm" (click)="pending = null">إلغاء الاختيار</button>
                }
              </div>
              <input #modalPicker type="file" accept="application/pdf,image/*" hidden (change)="onModalPicked($event)" />
            </div>
          </div>
          <div class="modal-foot">
            @if (!isNew && s.can('fleet')) {
              <button type="button" class="btn btn-danger" (click)="remove(f)"><sc-icon name="trash" /> حذف النوع</button>
              <span style="flex:1"></span>
            }
            @if (!isNew && hasValues(f)) {
              <button type="button" class="btn" (click)="clearValues()">مسح البيانات</button>
            }
            <button type="button" class="btn" (click)="form = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="save()"><sc-icon name="check" /> حفظ</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShCertificates {
  readonly s = inject(ShipStore);
  readonly dateLabel = dateLabel;
  readonly sections = CERT_SECTIONS;
  readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  readonly tab = signal<Tab>('cert');
  readonly filter = signal<Filter>('all');
  readonly q = signal('');

  form: Certificate | null = null;
  isNew = false;
  pending: File | null = null;
  removeFile = false;
  private uploadTarget: string | null = null;

  readonly all = computed(() => this.s.data().certificates);
  readonly sum = computed(() => certSummary(this.all()));

  readonly inSection = computed(() => {
    const t = this.tab();
    return t === 'crew' ? [] : this.all().filter((c) => c.section === t);
  });

  readonly rows = computed(() => {
    const term = this.q().trim().toLowerCase();
    const f = this.filter();
    return this.inSection()
      .filter((c) => !term || c.title.toLowerCase().includes(term) || c.issuer.toLowerCase().includes(term) || c.no.toLowerCase() === term)
      .filter((c) => this.matches(c, f))
      .sort((a, b) => this.order(a) - this.order(b));
  });

  readonly crewCerts = computed(() =>
    this.s
      .crew()
      .filter((m) => m.status !== 'Former')
      .flatMap((m) => m.certs.map((c) => ({ ...c, member: m.name, rank: m.rank })))
      .sort((a, b) => daysBetween(today(), a.expiry || '9999-12-31') - daysBetween(today(), b.expiry || '9999-12-31')),
  );

  sectionHint(): string {
    return CERT_SECTIONS.find((x) => x.id === this.tab())?.hint ?? '';
  }

  canEdit(): boolean {
    return this.s.can('fleet') || this.s.can('crew');
  }

  status(c: Certificate): CertStatus {
    return certDocStatus(c);
  }

  crewState(expiry: string) {
    if (!expiry) return { tone: 'muted', label: 'بدون تاريخ' };
    const left = daysBetween(today(), expiry);
    if (left < 0) return { tone: 'bad', label: `منتهية منذ ${-left} يوم` };
    if (left <= 90) return { tone: 'warn', label: `تنتهي خلال ${left} يوم` };
    return { tone: 'ok', label: 'سارية' };
  }

  preview(): CertStatus | null {
    return this.form ? certDocStatus(this.form) : null;
  }

  private order(c: Certificate): number {
    const n = parseInt(c.no, 10);
    const suffix = /[A-Za-z]$/.test(c.no) ? 0.5 : 0;
    return (Number.isNaN(n) ? 9999 : n) + suffix;
  }

  private matches(c: Certificate, f: Filter): boolean {
    const st = certDocStatus(c);
    switch (f) {
      case 'expired':
        return st.key === 'expired';
      case 'soon':
        return st.key === 'soon';
      case 'empty':
        return st.key === 'empty';
      case 'nofile':
        return !c.file && st.key !== 'empty' && st.key !== 'na';
      default:
        return true;
    }
  }

  count(f: Filter): number {
    return this.inSection().filter((c) => this.matches(c, f)).length;
  }

  secAlerts(sec: CertSection): number {
    return this.all().filter((c) => c.section === sec && certDocStatus(c).key === 'expired').length;
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    this.filter.set('all');
    this.q.set('');
  }

  /* ───────────── الملفات ───────────── */

  sizeLabel(bytes: number): string {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  /** رفع سريع من الجدول. */
  pick(c: Certificate): void {
    this.uploadTarget = c.id;
    this.picker()?.nativeElement.click();
  }

  async onPicked(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    const id = this.uploadTarget;
    input.value = '';
    this.uploadTarget = null;
    if (file && id) await this.s.attachCertFile(id, file);
  }

  onModalPicked(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.pending = file;
    this.removeFile = false;
  }

  async view(c: Certificate): Promise<void> {
    // نفتح التبويب الأول بشكل متزامن عشان المتصفح ما يمنعوش
    const win = window.open('', '_blank');
    const blob = await this.s.getCertFile(c.id);
    if (!blob) {
      win?.close();
      this.s.notify('الملف مش موجود على الجهاز ده — ارفعه تاني.', 'warn');
      return;
    }
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else window.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  }

  async download(c: Certificate): Promise<void> {
    const blob = await this.s.getCertFile(c.id);
    if (!blob || !c.file) {
      this.s.notify('الملف مش موجود على الجهاز ده — ارفعه تاني.', 'warn');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = c.file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /* ───────────── التعديل ───────────── */

  openEdit(c: Certificate): void {
    this.isNew = false;
    this.pending = null;
    this.removeFile = false;
    this.form = { ...c };
  }

  openNew(): void {
    const section = this.tab() === 'crew' ? 'cert' : this.tab();
    this.isNew = true;
    this.pending = null;
    this.removeFile = false;
    this.form = newCertificate(section as CertSection, this.all());
  }

  changeSection(section: CertSection): void {
    if (!this.form) return;
    this.form.section = section;
    this.form.no = newCertificate(section, this.all()).no;
  }

  hasValues(c: Certificate): boolean {
    return Boolean(c.issuer || c.docNo || c.issueDate || c.lastInsp || c.dueDate || c.expiryDate || c.qty || c.type || c.mfgDate || c.notes);
  }

  clearValues(): void {
    const f = this.form;
    if (!f) return;
    Object.assign(f, { issuer: '', docNo: '', issueDate: '', lastInsp: '', dueDate: '', expiryDate: '', qty: '', type: '', mfgDate: '', notes: '' });
  }

  async save(): Promise<void> {
    const f = this.form;
    if (!f) return;
    if (!f.title.trim()) {
      this.s.notify('اسم الشهادة مطلوب.', 'warn');
      return;
    }
    if (f.issueDate && f.expiryDate && f.expiryDate < f.issueDate) {
      this.s.notify('تاريخ الانتهاء قبل تاريخ الإصدار — راجع التواريخ.', 'warn');
      return;
    }
    const file = this.pending;
    const drop = this.removeFile;
    this.form = null;
    this.pending = null;
    this.removeFile = false;
    this.s.saveCertificate({ ...f, title: f.title.trim() });
    if (file) await this.s.attachCertFile(f.id, file);
    else if (drop && f.file) await this.s.removeCertFile(f.id);
  }

  remove(c: Certificate): void {
    if (window.confirm(`حذف «${c.title}» من سجل شهادات السفينة (مع الملف)؟`)) {
      this.form = null;
      this.s.deleteCertificate(c.id);
    }
  }

  /* ───────────── طباعة وتصدير ───────────── */

  print(): void {
    certRegisterPrint(this.s.vessel(), this.all());
  }

  exportCsv(): void {
    const label = (id: CertSection) => CERT_SECTIONS.find((x) => x.id === id)?.label ?? id;
    downloadCsv(`certificates-${this.s.vessel().name}.csv`, [
      ['القسم', 'رقم', 'الشهادة', 'الجهة', 'رقم الشهادة', 'الإصدار', 'آخر معاينة', 'الاستحقاق', 'الانتهاء', 'الكمية', 'النوع', 'تاريخ الصنع', 'الحالة', 'الملف', 'ملاحظات'],
      ...this.all()
        .slice()
        .sort((a, b) => a.section.localeCompare(b.section) || this.order(a) - this.order(b))
        .map((c) => [label(c.section), c.no, c.title, c.issuer, c.docNo, c.issueDate, c.lastInsp, c.dueDate, c.expiryDate, c.qty, c.type, c.mfgDate, certDocStatus(c).label, c.file?.name ?? '', c.notes]),
    ]);
  }
}
