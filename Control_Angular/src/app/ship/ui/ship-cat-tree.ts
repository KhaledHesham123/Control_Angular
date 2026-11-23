import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Category } from '../core/ship.types';

/** شجرة الأقسام (رئيسي ← فرعي) تُستخدم في الطلبات والمخزن والكتالوج. */
@Component({
  selector: 'sc-cat-tree',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cat-tree">
      @if (allLabel()) {
        <button type="button" class="cat-btn" [class.on]="selected() === null" (click)="picked.emit(null)">
          <sc-icon name="list" /> {{ allLabel() }}
          @if (counts()['*'] != null) {
            <span class="count">{{ counts()['*'] }}</span>
          }
        </button>
      }
      @for (root of roots(); track root.id) {
        <button type="button" class="cat-btn" [class.on]="selected() === root.id" (click)="picked.emit(root.id)">
          <sc-icon [name]="root.icon || 'tag'" /> {{ root.name }}
          @if (counts()[root.id] != null) {
            <span class="count">{{ counts()[root.id] }}</span>
          }
        </button>
        @for (child of childrenOf(root.id); track child.id) {
          <button type="button" class="cat-btn sub" [class.on]="selected() === child.id" (click)="picked.emit(child.id)">
            {{ child.name }}
            @if (counts()[child.id] != null) {
              <span class="count">{{ counts()[child.id] }}</span>
            }
          </button>
        }
      }
    </div>
  `,
})
export class ShipCatTree {
  readonly categories = input.required<Category[]>();
  readonly selected = input<string | null>(null);
  readonly counts = input<Record<string, number>>({});
  readonly allLabel = input<string | null>('كل الأقسام');
  readonly picked = output<string | null>();

  readonly roots = computed(() => this.categories().filter((c) => !c.parentId));

  childrenOf(id: string): Category[] {
    return this.categories().filter((c) => c.parentId === id);
  }
}
