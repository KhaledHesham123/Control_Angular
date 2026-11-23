import { ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { certState, crewVoyageCount, daysBetween, num, onboardIntervals, overlapDays, today, uid } from '../core/ship-calc';
import { dateLabel, fmt, usd } from '../core/ship-format';
import { ShipStore } from '../core/ship-store';
import { CREW_DEPT_LABEL, CREW_RANKS, CREW_STATUS_LABEL, CrewDept, CrewMember, CrewStatus } from '../core/ship.types';

type Tab = CrewStatus | 'all' | 'schedule';
type Action = 'leave' | 'return' | 'sign-off' | 'sign-on';

const ACTION_TITLE: Record<Action, string> = {
  leave: 'تسجيل إجازة',
  return: 'عودة من الإجازة',
  'sign-off': 'نزول من السفينة (إنهاء الخدمة)',
  'sign-on': 'صعود للسفينة',
};

interface CrewForm extends CrewMember {
  signOnDate: string;
}

const RELIEF_DAYS = 270;

@Component({
  selector: 'sh-crew',
  standalone: false,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>طاقم السفينة</h1>
          <p>بيانات كل فرد، حالته (في الخدمة / في إجازة / سابق)، تواريخ الصعود والنزول، وعدد الرحلات اللي اشتغلها.</p>
        </div>
        @if (s.can('crew')) {
          <button type="button" class="btn btn-primary" (click)="openEdit()"><sc-icon name="userplus" /> إضافة فرد</button>
        }
      </div>

      <div class="kpis">
        <div class="kpi ok"><label>في الخدمة</label><strong>{{ count('OnBoard') }}</strong></div>
        <div class="kpi warn"><label>في إجازة</label><strong>{{ count('OnLeave') }}</strong></div>
        <div class="kpi"><label>سابقون</label><strong>{{ count('Former') }}</strong></div>
        <div class="kpi" [class.bad]="reliefDue().length > 0"><label>يستحق تبديل (+9 شهور)</label><strong>{{ reliefDue().length }}</strong></div>
        @if (s.can('costs')) {
          <div class="kpi gold"><label>رواتب الشهر (في الخدمة)</label><strong>{{ usd(payroll()) }}</strong></div>
        }
      </div>

      <div class="row between">
        <div class="tabs">
          <button type="button" class="tab" [class.on]="tab() === 'OnBoard'" (click)="tab.set('OnBoard')">في الخدمة</button>
          <button type="button" class="tab" [class.on]="tab() === 'OnLeave'" (click)="tab.set('OnLeave')">في إجازة</button>
          <button type="button" class="tab" [class.on]="tab() === 'Former'" (click)="tab.set('Former')">سابقون</button>
          <button type="button" class="tab" [class.on]="tab() === 'all'" (click)="tab.set('all')">الكل</button>
          <button type="button" class="tab" [class.on]="tab() === 'schedule'" (click)="tab.set('schedule')">جدول الإجازات والتبديل</button>
        </div>
        @if (tab() !== 'schedule') {
          <div class="row">
            <select [value]="dept()" (change)="dept.set($any($event.target).value)">
              <option value="">كل الأقسام</option>
              @for (d of depts; track d.id) {
                <option [value]="d.id">{{ d.label }}</option>
              }
            </select>
            <input class="search" type="search" placeholder="بحث بالاسم أو الجواز" [value]="q()" (input)="q.set($any($event.target).value)" />
          </div>
        }
      </div>

      @if (tab() !== 'schedule') {
        <div class="grid auto" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))">
          @for (m of rows(); track m.id) {
            <article class="person">
              <div class="row">
                <span class="avatar">
                  @if (m.photo) { <img [src]="m.photo" alt="" /> } @else { {{ initials(m.name) }} }
                </span>
                <div style="min-width:0">
                  <b>{{ m.name }}</b>
                  <div class="muted small">{{ m.rank }} · {{ deptLabel(m.dept) }}</div>
                </div>
                <span class="badge" [class]="'badge ' + statusTone(m.status)" style="margin-inline-start:auto">{{ statusLabel(m.status) }}</span>
              </div>
              <dl class="kv" style="grid-template-columns: 110px 1fr">
                <dt>جواز البحار</dt><dd class="small"><span class="ltr">{{ m.seamanBookNo || '—' }}</span></dd>
                <dt>الهاتف</dt><dd class="small"><span class="ltr">{{ m.phone || '—' }}</span></dd>
                <dt>الرحلات</dt><dd>{{ voyages(m) }} رحلة</dd>
                @if (m.status === 'OnBoard') {
                  <dt>على السفينة منذ</dt><dd [style.color]="onboardDays(m) > relief ? '#c0392b' : null">{{ onboardDays(m) }} يوم</dd>
                }
                @if (expiring(m) > 0) {
                  <dt>شهادات</dt><dd><span class="badge warn">{{ expiring(m) }} تحتاج تجديد</span></dd>
                }
              </dl>
              <div class="row">
                <button type="button" class="btn btn-sm" (click)="detail.set(m.id)"><sc-icon name="eye" /> الملف</button>
                @if (s.can('crew')) {
                  <button type="button" class="btn btn-sm" (click)="openEdit(m)"><sc-icon name="edit" /></button>
                  @if (m.status === 'OnBoard') {
                    <button type="button" class="btn btn-sm" (click)="openAction(m, 'leave')">إجازة</button>
                    <button type="button" class="btn btn-sm btn-danger" (click)="openAction(m, 'sign-off')">نزول</button>
                  }
                  @if (m.status === 'OnLeave') {
                    <button type="button" class="btn btn-sm btn-primary" (click)="openAction(m, 'return')">عودة</button>
                    <button type="button" class="btn btn-sm btn-danger" (click)="openAction(m, 'sign-off')">إنهاء</button>
                  }
                  @if (m.status === 'Former') {
                    <button type="button" class="btn btn-sm btn-primary" (click)="openAction(m, 'sign-on')">صعود مجدداً</button>
                  }
                }
              </div>
            </article>
          }
        </div>
        @if (!rows().length) {
          <div class="card"><div class="empty"><sc-icon name="users" /> لا يوجد أفراد بهذه الفلاتر.</div></div>
        }
      } @else {
        <div class="grid g2">
          <section class="card">
            <div class="card-head"><h2>في إجازة حالياً</h2></div>
            <div class="card-body flush table-wrap">
              <table class="tbl">
                <thead><tr><th>الفرد</th><th>بدأت</th><th>المدة</th><th></th></tr></thead>
                <tbody>
                  @for (m of onLeave(); track m.id) {
                    <tr>
                      <td><b>{{ m.name }}</b><div class="muted small">{{ m.rank }}</div></td>
                      <td>{{ dateLabel(lastEvent(m, 'leave')) }}</td>
                      <td class="num">{{ daysSince(lastEvent(m, 'leave')) }} يوم</td>
                      <td class="end">@if (s.can('crew')) { <button type="button" class="btn btn-sm btn-primary" (click)="openAction(m, 'return')">عودة</button> }</td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (!onLeave().length) { <div class="empty">لا أحد في إجازة.</div> }
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2>مستحقون للتبديل</h2><small>على السفينة أكثر من {{ relief }} يوم</small></div>
            <div class="card-body flush table-wrap">
              <table class="tbl">
                <thead><tr><th>الفرد</th><th>صعد في</th><th>المدة</th><th></th></tr></thead>
                <tbody>
                  @for (m of reliefDue(); track m.id) {
                    <tr>
                      <td><b>{{ m.name }}</b><div class="muted small">{{ m.rank }}</div></td>
                      <td>{{ dateLabel(boardedAt(m)) }}</td>
                      <td class="num"><b>{{ onboardDays(m) }}</b> يوم</td>
                      <td class="end">@if (s.can('crew')) { <button type="button" class="btn btn-sm" (click)="openAction(m, 'leave')">إجازة</button> }</td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (!reliefDue().length) { <div class="empty"><sc-icon name="check" /> لا أحد تجاوز المدة.</div> }
            </div>
          </section>
        </div>
      }
    </div>

    @if (form) {
      <div class="modal-back" (click)="form = null">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ isNew ? 'فرد جديد' : 'تعديل بيانات الفرد' }}</h3><button type="button" class="btn btn-sm btn-ghost" (click)="form = null"><sc-icon name="x" /></button></div>
          <div class="modal-body">
            <div class="row">
              <span class="avatar lg">@if (form.photo) { <img [src]="form.photo" alt="" /> } @else { {{ initials(form.name) }} }</span>
              <label class="btn btn-sm">
                <sc-icon name="plus" /> رفع صورة
                <input type="file" accept="image/*" hidden (change)="onPhoto($event)" />
              </label>
              @if (form.photo) {
                <button type="button" class="btn btn-sm btn-ghost" (click)="form.photo = null">إزالة</button>
              }
            </div>
            <div class="form-grid">
              <label class="field wide"><span>الاسم الكامل</span><input type="text" [(ngModel)]="form.name" /></label>
              <label class="field">
                <span>الرتبة</span>
                <input type="text" list="ranks" [(ngModel)]="form.rank" (ngModelChange)="onRank()" />
                <datalist id="ranks">
                  @for (r of ranks; track r.rank) {
                    <option [value]="r.rank"></option>
                  }
                </datalist>
              </label>
              <label class="field">
                <span>القسم</span>
                <select [(ngModel)]="form.dept">
                  @for (d of depts; track d.id) {
                    <option [value]="d.id">{{ d.label }}</option>
                  }
                </select>
              </label>
              <label class="field"><span>الجنسية</span><input type="text" [(ngModel)]="form.nationality" /></label>
              <label class="field"><span>رقم جواز السفر</span><input type="text" dir="ltr" [(ngModel)]="form.passportNo" /></label>
              <label class="field"><span>رقم جواز البحار (Seaman Book)</span><input type="text" dir="ltr" [(ngModel)]="form.seamanBookNo" /></label>
              <label class="field"><span>الهاتف</span><input type="text" dir="ltr" [(ngModel)]="form.phone" /></label>
              @if (s.can('costs')) {
                <label class="field"><span>الراتب الشهري (USD)</span><input type="number" min="0" [(ngModel)]="form.salary" /></label>
              }
              @if (isNew) {
                <label class="field"><span>تاريخ الصعود للسفينة</span><input type="date" [(ngModel)]="form.signOnDate" /></label>
              }
              <label class="field wide"><span>ملاحظات</span><textarea rows="2" [(ngModel)]="form.notes"></textarea></label>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="form = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="save()"><sc-icon name="check" /> حفظ</button>
          </div>
        </div>
      </div>
    }

    @if (action) {
      <div class="modal-back" (click)="action = null">
        <div class="modal narrow" (click)="$event.stopPropagation()">
          <div class="modal-head"><h3>{{ actionTitle() }} — {{ action.member.name }}</h3></div>
          <div class="modal-body">
            <label class="field"><span>التاريخ</span><input type="date" [(ngModel)]="action.date" /></label>
            <label class="field"><span>ملاحظة</span><input type="text" [(ngModel)]="action.note" /></label>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn" (click)="action = null">إلغاء</button>
            <button type="button" class="btn btn-primary" (click)="doAction()">تأكيد</button>
          </div>
        </div>
      </div>
    }

    @if (current(); as m) {
      <div class="modal-back" (click)="detail.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="row">
              <span class="avatar lg">@if (m.photo) { <img [src]="m.photo" alt="" /> } @else { {{ initials(m.name) }} }</span>
              <div>
                <h3>{{ m.name }}</h3>
                <div class="muted">{{ m.rank }} · {{ deptLabel(m.dept) }} · <span class="badge" [class]="'badge ' + statusTone(m.status)">{{ statusLabel(m.status) }}</span></div>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" (click)="detail.set(null)"><sc-icon name="x" /></button>
          </div>
          <div class="modal-body">
            <div class="grid g3">
              <div class="kpi"><label>عدد الرحلات</label><strong>{{ voyages(m) }}</strong></div>
              <div class="kpi"><label>إجمالي أيام الخدمة</label><strong>{{ totalDays(m) }}</strong></div>
              <div class="kpi gold"><label>الراتب</label><strong>{{ s.can('costs') ? usd(m.salary) : '—' }}</strong></div>
            </div>
            <dl class="kv">
              <dt>الجنسية</dt><dd>{{ m.nationality || '—' }}</dd>
              <dt>جواز السفر</dt><dd><span class="ltr">{{ m.passportNo || '—' }}</span></dd>
              <dt>جواز البحار</dt><dd><span class="ltr">{{ m.seamanBookNo || '—' }}</span></dd>
              <dt>الهاتف</dt><dd><span class="ltr">{{ m.phone || '—' }}</span></dd>
              @if (m.notes) { <dt>ملاحظات</dt><dd>{{ m.notes }}</dd> }
            </dl>
            <div class="grid g2">
              <div class="stack">
                <div class="between row"><h4>الشهادات</h4></div>
                <div class="table-wrap">
                  <table class="tbl">
                    <tbody>
                      @for (c of m.certs; track c.id) {
                        <tr>
                          <td>{{ c.name }}<div class="muted small">{{ c.number }}</div></td>
                          <td><span class="badge" [class]="'badge ' + cert(c.expiry).tone">{{ cert(c.expiry).label }}</span></td>
                          <td class="end">@if (s.can('crew')) { <button type="button" class="btn btn-sm btn-ghost btn-danger" (click)="s.removeCrewCert(m.id, c.id)"><sc-icon name="trash" /></button> }</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  @if (!m.certs.length) { <div class="empty small">لا توجد شهادات.</div> }
                </div>
                @if (s.can('crew')) {
                  <div class="row">
                    <input type="text" placeholder="اسم الشهادة" [(ngModel)]="certName" style="flex:1;min-width:120px" />
                    <input type="text" placeholder="الرقم" [(ngModel)]="certNo" style="width:110px" />
                    <input type="date" [(ngModel)]="certExpiry" style="width:150px" />
                    <button type="button" class="btn btn-sm btn-primary" (click)="addCert(m.id)"><sc-icon name="plus" /></button>
                  </div>
                }
              </div>
              <div class="stack">
                <h4>تاريخ الصعود والنزول</h4>
                <ul class="timeline">
                  @for (e of history(m); track e.id) {
                    <li><b>{{ eventLabel(e.type) }}</b> — {{ dateLabel(e.date) }}<small>{{ e.note }}</small></li>
                  }
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShCrew {
  readonly s = inject(ShipStore);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly usd = usd;
  readonly dateLabel = dateLabel;
  readonly relief = RELIEF_DAYS;
  readonly ranks = CREW_RANKS;
  readonly depts = (Object.keys(CREW_DEPT_LABEL) as CrewDept[]).map((id) => ({ id, label: CREW_DEPT_LABEL[id] }));

  readonly tab = signal<Tab>('OnBoard');
  readonly dept = signal('');
  readonly q = signal('');
  readonly detail = signal<string | null>(null);
  readonly current = computed(() => this.s.crew().find((c) => c.id === this.detail()) ?? null);

  form: CrewForm | null = null;
  isNew = false;
  action: { member: CrewMember; type: Action; date: string; note: string } | null = null;
  certName = '';
  certNo = '';
  certExpiry = '';

  readonly rows = computed(() => {
    const t = this.tab();
    const d = this.dept();
    const term = this.q().trim().toLowerCase();
    return this.s
      .crew()
      .filter((m) => (t === 'all' || m.status === t) && (!d || m.dept === d) && (!term || m.name.toLowerCase().includes(term) || m.passportNo.toLowerCase().includes(term) || m.seamanBookNo.toLowerCase().includes(term)));
  });

  readonly onLeave = computed(() => this.s.crew().filter((m) => m.status === 'OnLeave'));
  readonly reliefDue = computed(() => this.s.crew().filter((m) => m.status === 'OnBoard' && this.onboardDays(m) > RELIEF_DAYS));
  readonly payroll = computed(() => this.s.crewOnBoard().reduce((sum, m) => sum + m.salary, 0));

  count(st: CrewStatus): number {
    return this.s.crew().filter((m) => m.status === st).length;
  }

  statusLabel(st: CrewStatus): string {
    return CREW_STATUS_LABEL[st];
  }

  statusTone(st: CrewStatus): string {
    return st === 'OnBoard' ? 'ok' : st === 'OnLeave' ? 'warn' : 'muted';
  }

  deptLabel(d: CrewDept): string {
    return CREW_DEPT_LABEL[d];
  }

  initials(name: string): string {
    return (name || '؟').trim().charAt(0);
  }

  voyages(m: CrewMember): number {
    return crewVoyageCount(m, this.s.voyages());
  }

  boardedAt(m: CrewMember): string {
    const open = onboardIntervals(m).find((i) => i.to === null);
    return open?.from ?? '';
  }

  onboardDays(m: CrewMember): number {
    const from = this.boardedAt(m);
    return from ? Math.max(0, daysBetween(from, today())) : 0;
  }

  totalDays(m: CrewMember): number {
    return overlapDays(onboardIntervals(m), '1990-01-01', today());
  }

  lastEvent(m: CrewMember, type: string): string {
    return [...m.events].reverse().find((e) => e.type === type)?.date ?? '';
  }

  daysSince(iso: string): number {
    return iso ? Math.max(0, daysBetween(iso, today())) : 0;
  }

  expiring(m: CrewMember): number {
    return m.certs.filter((c) => ['warn', 'bad'].includes(certState(c.expiry).tone)).length;
  }

  cert(expiry: string) {
    return certState(expiry);
  }

  history(m: CrewMember) {
    return [...m.events].sort((a, b) => b.date.localeCompare(a.date));
  }

  eventLabel(t: string): string {
    return t === 'sign-on' ? 'صعود' : t === 'sign-off' ? 'نزول' : t === 'leave' ? 'بدء إجازة' : 'عودة';
  }

  actionTitle(): string {
    return this.action ? ACTION_TITLE[this.action.type] : '';
  }

  openEdit(m?: CrewMember): void {
    this.isNew = !m;
    this.form = m
      ? { ...m, signOnDate: today(), certs: [...m.certs], events: [...m.events] }
      : {
          id: uid('crew'),
          name: '',
          rank: '',
          dept: 'deck',
          nationality: 'مصري',
          passportNo: '',
          seamanBookNo: '',
          phone: '',
          salary: 0,
          photo: null,
          status: 'OnBoard',
          certs: [],
          events: [],
          notes: '',
          signOnDate: today(),
        };
  }

  onRank(): void {
    const f = this.form;
    const r = CREW_RANKS.find((x) => x.rank === f?.rank);
    if (f && r) f.dept = r.dept;
  }

  onPhoto(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 180;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.width, img.height);
        ctx?.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        if (this.form) this.form.photo = canvas.toDataURL('image/jpeg', 0.8);
        this.cdr.markForCheck();
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  save(): void {
    const f = this.form;
    if (!f) return;
    if (!f.name.trim() || !f.rank.trim()) {
      this.s.notify('الاسم والرتبة مطلوبان.', 'warn');
      return;
    }
    const { signOnDate, ...member } = f;
    const saved: CrewMember = { ...member, name: member.name.trim(), salary: num(member.salary) };
    if (this.isNew) {
      saved.events = [{ id: uid('ev'), date: signOnDate || today(), type: 'sign-on', note: 'صعود للسفينة' }];
    }
    this.s.saveCrew(saved);
    this.form = null;
  }

  openAction(member: CrewMember, type: Action): void {
    this.action = { member, type, date: today(), note: '' };
  }

  doAction(): void {
    const a = this.action;
    if (!a) return;
    const id = a.member.id;
    if (a.type === 'leave') this.s.startLeave(id, a.date, a.note);
    else if (a.type === 'return') this.s.endLeave(id, a.date, a.note);
    else if (a.type === 'sign-off') this.s.signOff(id, a.date, a.note);
    else this.s.signOn(id, a.date, a.note);
    this.action = null;
  }

  addCert(id: string): void {
    if (!this.certName.trim()) return;
    this.s.addCrewCert(id, { name: this.certName.trim(), number: this.certNo, expiry: this.certExpiry });
    this.certName = '';
    this.certNo = '';
    this.certExpiry = '';
  }
}
