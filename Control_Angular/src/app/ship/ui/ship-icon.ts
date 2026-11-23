import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** أيقونة من السبرايت المعرّف في ShipShell. */
@Component({
  selector: 'sc-icon',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use [attr.href]="'#i-' + name()"></use></svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
      }
      svg {
        width: 1.15em;
        height: 1.15em;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `,
  ],
})
export class ShipIcon {
  readonly name = input.required<string>();
}
