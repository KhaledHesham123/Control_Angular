import { activeLines, today } from './ship-calc';
import { certDocStatus, hasData } from './ship-certs';
import { CERT_SECTIONS, Certificate, Hold, ReqLine, Requisition, Supplier, VesselProfile } from './ship.types';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PRINT_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Cairo","Segoe UI",Tahoma,sans-serif; color:#12222e; font-size:12.5px; line-height:1.55; margin:0; }
  header.doc { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0e2238; padding-bottom:10px; margin-bottom:14px; }
  header.doc h1 { margin:0; font-size:20px; color:#0e2238; }
  header.doc p { margin:2px 0 0; color:#62727f; }
  .tag { display:inline-block; padding:2px 10px; border-radius:999px; background:#fbf3e0; color:#7a5a14; font-weight:700; }
  table { width:100%; border-collapse:collapse; margin:10px 0; }
  th { background:#0e2238; color:#fff; padding:7px 8px; text-align:right; font-size:11.5px; }
  td { border:1px solid #cfd8dd; padding:7px 8px; vertical-align:top; }
  td.blank { min-width:80px; }
  .meta { display:grid; grid-template-columns:repeat(3,1fr); gap:6px 18px; margin-bottom:10px; }
  .meta div b { display:block; color:#62727f; font-size:11px; }
  .note { margin-top:14px; padding:10px 12px; background:#f3f6f7; border-radius:8px; }
  .sign { display:flex; justify-content:space-between; margin-top:36px; }
  .sign div { width:30%; border-top:1px solid #12222e; padding-top:4px; text-align:center; color:#62727f; }
  h2 { font-size:14px; color:#0e2238; margin:16px 0 4px; }
`;

export function openPrint(title: string, body: string): void {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    window.alert('المتصفح منع النافذة المنبثقة. اسمح بها ثم أعد المحاولة.');
    return;
  }
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 350);
}

/** نموذج الطلب لطباعته وتوقيع صاحب المركب قبل اعتماد الإدارة. */
export function ownerSignPrint(vessel: VesselProfile, req: Requisition, groupName: (id: string) => string): void {
  const lines = req.lines.filter((line) => !line.removed);
  const rows = lines
    .map(
      (line, index) =>
        `<tr><td>${index + 1}</td><td>${esc(line.name)}</td><td>${esc(groupName(line.groupId))}</td><td>${esc(line.description) || '—'}</td><td>${esc(line.unit)}</td><td><b>${line.qty}</b></td></tr>`,
    )
    .join('');
  openPrint(
    `توقيع صاحب المركب — ${req.no}`,
    `<header class="doc"><div><h1>طلب شراء للاعتماد</h1><p>يُطبع ويُوقَّع من صاحب المركب قبل اعتماد الإدارة</p></div><div style="text-align:left"><span class="tag">${esc(req.no)}</span><p>تاريخ الطلب: ${esc(req.createdAt)}</p></div></header>
     <div class="meta">
       <div><b>السفينة</b>${esc(vessel.name)}</div>
       <div><b>IMO</b>${esc(vessel.imo)}</div>
       <div><b>مقدّم الطلب</b>${esc(req.createdBy)}</div>
       <div><b>الأولوية</b>${req.priority === 'urgent' ? 'عاجل' : 'عادي'}</div>
       <div><b>عدد البنود</b>${lines.length}</div>
       <div><b>تاريخ الطباعة</b>${esc(today())}</div>
     </div>
     <table><thead><tr><th>#</th><th>الصنف</th><th>القسم</th><th>الوصف</th><th>الوحدة</th><th>الكمية</th></tr></thead><tbody>${rows}</tbody></table>
     ${req.notes ? `<div class="note"><b>ملاحظات الطلب:</b> ${esc(req.notes)}</div>` : ''}
     <div class="sign"><div>توقيع صاحب المركب</div><div>التاريخ</div><div>ختم السفينة</div></div>`,
  );
}

/** ملف طلب عرض سعر (RFQ) لقسم واحد. */
export function rfqPrint(vessel: VesselProfile, req: Requisition, groupId: string, groupName: string, withPrices = true): void {
  const lines = activeLines(req, groupId);
  const rows = lines
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td>${esc(l.description) || '—'}</td><td>${esc(l.unit)}</td><td><b>${l.qty}</b></td>${
          withPrices ? '<td class="blank"></td><td class="blank"></td>' : ''
        }</tr>`,
    )
    .join('');
  openPrint(
    `RFQ ${req.no} — ${groupName}`,
    `<header class="doc"><div><h1>طلب عرض سعر — ${esc(groupName)}</h1><p>Request for Quotation</p></div><div style="text-align:left"><span class="tag">${esc(req.no)}</span><p>التاريخ: ${esc(req.createdAt)}</p></div></header>
     <div class="meta">
       <div><b>السفينة</b>${esc(vessel.name)}</div>
       <div><b>IMO</b>${esc(vessel.imo)}</div>
       <div><b>العلم</b>${esc(vessel.flag)}</div>
       <div><b>الأولوية</b>${req.priority === 'urgent' ? 'عاجل' : 'عادي'}</div>
       <div><b>الموقع الحالي</b>${esc(vessel.location)}</div>
       <div><b>مقدّم الطلب</b>${esc(req.createdBy)}</div>
     </div>
     <table><thead><tr><th>#</th><th>الصنف</th><th>الوصف / المواصفات</th><th>الوحدة</th><th>الكمية</th>${
       withPrices ? '<th>سعر الوحدة</th><th>الإجمالي</th>' : ''
     }</tr></thead><tbody>${rows}</tbody></table>
     <div class="note"><b>المطلوب من المورد:</b> السعر للوحدة، مدة التوريد بالأيام، شروط الدفع، وصلاحية العرض.<br>يرجى الرد على نفس البريد مع ذكر رقم الطلب ${esc(req.no)}.${req.notes ? `<br><b>ملاحظات:</b> ${esc(req.notes)}` : ''}</div>
     <div class="sign"><div>ختم وتوقيع المورد</div><div>التاريخ</div><div>اعتماد الشركة</div></div>`,
  );
}

export function mailtoFor(vessel: VesselProfile, req: Requisition, groupId: string, groupName: string, supplier: Supplier): string {
  const lines: ReqLine[] = activeLines(req, groupId);
  const list = lines.map((l, i) => `${i + 1}. ${l.name}${l.description ? ` (${l.description})` : ''} — ${l.qty} ${l.unit}`).join('\n');
  const subject = `طلب عرض سعر ${req.no} — ${groupName} — ${vessel.name}`;
  const body = `السادة ${supplier.company}،\n\nتحية طيبة،\nنرجو تزويدنا بعرض سعركم للأصناف التالية (${groupName}) للسفينة ${vessel.name} (IMO ${vessel.imo}):\n\n${list}\n\nالمطلوب: سعر الوحدة، مدة التوريد، شروط الدفع، وصلاحية العرض.\nمرفق ملف PDF بالتفاصيل.\nرقم الطلب: ${req.no}\n\nمع التحية`;
  return `mailto:${encodeURIComponent(supplier.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** بطاقة مواصفات السفينة. */
export function particularsPrint(v: VesselProfile, certs: Certificate[], holds: Hold[] = []): void {
  const row = (k: string, val: unknown) => `<tr><td style="width:34%;background:#f3f6f7;font-weight:700">${esc(k)}</td><td>${esc(val) || '—'}</td></tr>`;
  const certRows = certs
    .filter((c) => c.section === 'cert' && hasData(c))
    .map((c) => `<tr><td>${esc(c.title)}</td><td>${esc(c.issuer)}</td><td>${esc(c.issueDate)}</td><td>${esc(c.expiryDate || c.dueDate)}</td></tr>`)
    .join('');
  openPrint(
    `Ship Particulars — ${v.name}`,
    `<header class="doc"><div><h1>${esc(v.name)}</h1><p>Ship Particulars — بطاقة مواصفات السفينة</p></div></header>
     <table><tbody>
      ${row('الاسم السابق', v.formerName)}${row('إشارة النداء', v.callSign)}${row('IMO', v.imo)}${row('العلم', v.flag)}${row('النوع', v.type)}
      ${row('هيئة التصنيف', v.classSociety)}${row('سنة البناء', v.buildYear)}${row('المالك / المشغّل', v.owner)}
      ${row('DWT', v.dwt)}${row('GRT / NRT', `${v.grt} / ${v.nrt}`)}${row('الأبعاد (LOA × Beam × Draft)', `${v.loa ?? '—'} × ${v.beam ?? '—'} × ${v.draft ?? '—'} م`)}
      ${row('سعة الحبوب / البالة', `${v.grainCapacity ?? '—'} / ${v.baleCapacity ?? '—'} م³`)}${row('المحرك الرئيسي', v.mainEngine)}${row('الأوناش', v.cranes)}
      ${row('السرعة', `${v.speedKn} عقدة`)}
     </tbody></table>
     ${holds.length ? holds.some((h) => h.name.includes('Fore Peak'))
       ? `<h2>سعة الخزانات</h2><table><thead><tr><th>الخزان</th><th>السعة (م³)</th></tr></thead><tbody>${holds.map((h) => `<tr><td>${esc(h.name)}</td><td>${esc(h.capacity)}</td></tr>`).join('')}<tr><td><b>الإجمالي</b></td><td><b>${esc(Math.round(holds.reduce((sum, h) => sum + h.capacity, 0) * 100) / 100)}</b></td></tr></tbody></table>`
       : `<h2>سعة العنابر</h2><table><thead><tr><th>العنبر</th><th>السعة (طن)</th><th>المحمّل (طن)</th><th>المتاح (طن)</th></tr></thead><tbody>${holds.map((h) => `<tr><td>${esc(h.name)}</td><td>${esc(h.capacity)}</td><td>${esc(h.loaded)}</td><td>${esc(h.capacity - h.loaded)}</td></tr>`).join('')}</tbody></table>` : ''}
     ${certRows ? `<h2>الشهادات</h2><table><thead><tr><th>الشهادة</th><th>الجهة</th><th>الإصدار</th><th>الانتهاء / الاستحقاق</th></tr></thead><tbody>${certRows}</tbody></table>` : ''}
     ${v.notes ? `<div class="note">${esc(v.notes)}</div>` : ''}`,
  );
}

/** نموذج حالة شهادات السفينة (Vessel's Certificate Status) — نفس ترتيب النموذج الورقي DE-01. */
export function certRegisterPrint(v: VesselProfile, certs: Certificate[]): void {
  const date = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  };
  const status = (c: Certificate) => {
    const st = certDocStatus(c);
    if (st.key === 'expired') return `<b style="color:#b3261e">Expired ${-(st.days ?? 0)} days</b>`;
    if (st.key === 'soon') return `<b style="color:#8a5a00">Due ${st.days} days</b>`;
    return '';
  };
  const parts = CERT_SECTIONS.map((sec) => {
    const rows = certs.filter((c) => c.section === sec.id);
    if (!rows.length) return '';
    const head =
      sec.id === 'cert'
        ? '<th>NO</th><th>DOCUMENTS</th><th>Issued By</th><th>Issue Date</th><th>Last Insp.</th><th>Due Date</th><th>Exp. Date</th><th>STATUS</th><th>File</th>'
        : sec.id === 'lsa'
          ? '<th>NO</th><th>DOCUMENTS</th><th>Issued By</th><th>Issue Date</th><th>Exp. Date</th><th>STATUS</th><th>File</th>'
          : '<th>NO</th><th>ITEM / LOCATION / NO.</th><th>Quantity</th><th>Type</th><th>Exp. Date</th><th>Manf. Date</th><th>STATUS</th>';
    const body = rows
      .map((c) => {
        const file = c.file ? '✓' : '';
        const cells =
          sec.id === 'cert'
            ? `<td>${esc(c.issuer)}</td><td>${date(c.issueDate)}</td><td>${date(c.lastInsp)}</td><td>${date(c.dueDate)}</td><td>${date(c.expiryDate)}</td><td>${status(c)}</td><td>${file}</td>`
            : sec.id === 'lsa'
              ? `<td>${esc(c.issuer)}</td><td>${date(c.issueDate)}</td><td>${date(c.expiryDate)}</td><td>${status(c)}</td><td>${file}</td>`
              : `<td>${esc(c.qty)}</td><td>${esc(c.type)}</td><td>${date(c.expiryDate)}</td><td>${date(c.mfgDate)}</td><td>${status(c)}</td>`;
        return `<tr><td>${esc(c.no)}</td><td style="text-align:left;direction:ltr">${esc(c.title)}</td>${cells}</tr>`;
      })
      .join('');
    return `<h2 style="page-break-before:${sec.id === 'cert' ? 'auto' : 'always'}">${esc(sec.label)} — ${esc(sec.short)}</h2><table class="reg"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }).join('');
  openPrint(
    `Vessel's Certificate Status — ${v.name}`,
    `<style>table.reg th,table.reg td{font-size:10px;padding:3px 4px;text-align:center}table.reg td:nth-child(2){font-weight:600}</style>
     <header class="doc"><div><h1>VESSEL’S CERTIFICATE STATUS</h1><p>حالة شهادات السفينة — DE-01</p></div>
     <div style="text-align:left"><span class="tag">${esc(v.name)}</span><p>GRT: ${esc(v.grt)} · IMO: ${esc(v.imo)}<br>Date: ${date(today())}</p></div></header>
     ${parts}
     <div class="note">STATUS: يظهر لو الشهادة منتهية أو في خلال 3 شهور من الانتهاء / الاستحقاق.</div>
     <div class="sign"><div>Approved By Master</div><div>Issue No. 0</div><div>DE-01</div></div>`,
  );
}