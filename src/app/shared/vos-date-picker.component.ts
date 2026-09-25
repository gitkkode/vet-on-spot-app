import {
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  computed,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { announceVosOverlayOpen } from './vos-overlay';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

@Component({
  standalone: true,
  selector: 'vos-date-picker',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VosDatePickerComponent),
      multi: true,
    },
  ],
  template: `
    <div class="root" [class.open]="open()" [class.disabled]="disabled()">
      <button
        type="button"
        class="trigger"
        [disabled]="disabled()"
        [attr.aria-expanded]="open()"
        (click)="toggle($event)"
      >
        <span class="value" [class.placeholder]="!display()">{{ display() || placeholder }}</span>
        <span class="icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/>
            <path d="M3 10h18" stroke="currentColor" stroke-width="1.8"/>
            <path d="M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </span>
      </button>

      @if (open()) {
        <div class="panel" role="dialog" aria-label="Choose date" (click)="$event.stopPropagation()">
          <div class="nav">
            <button type="button" class="nav-btn" (click)="shiftMonth(-1)" aria-label="Previous month">‹</button>
            <strong>{{ monthLabel() }}</strong>
            <button type="button" class="nav-btn" (click)="shiftMonth(1)" aria-label="Next month">›</button>
          </div>
          <div class="weekdays">
            @for (d of weekdays; track d) {
              <span>{{ d }}</span>
            }
          </div>
          <div class="grid">
            @for (cell of cells(); track cell.key) {
              @if (cell.blank) {
                <span class="blank"></span>
              } @else {
                <button
                  type="button"
                  class="day"
                  [class.on]="cell.iso === value()"
                  [class.today]="cell.iso === todayIso"
                  [class.muted]="!cell.inMonth"
                  [disabled]="cell.disabled"
                  (click)="pick(cell.iso!)"
                >{{ cell.day }}</button>
              }
            }
          </div>
          <div class="foot">
            <button type="button" class="link" (click)="pick(todayIso)">Today</button>
            @if (value()) {
              <button type="button" class="link" (click)="clear()">Clear</button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      position: relative;
      z-index: 1;
    }
    :host.open { z-index: 80; }

    .root { position: relative; }

    .trigger {
      width: 100%;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid var(--vos-border);
      background: #fff;
      color: var(--vos-ink);
      font: inherit;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .trigger:hover:not(:disabled) { border-color: #d4cfc4; }
    .root.open .trigger,
    .trigger:focus-visible {
      outline: none;
      border-color: var(--vos-brand);
      box-shadow: 0 0 0 3px rgba(253, 74, 41, 0.15);
    }
    .trigger:disabled { opacity: 0.55; cursor: not-allowed; }

    .value.placeholder { color: var(--vos-ink-faint); font-weight: 500; }
    .icon { color: var(--vos-ink-muted); display: inline-flex; }

    .panel {
      position: absolute;
      z-index: 90;
      left: 0;
      top: calc(100% + 6px);
      width: min(100%, 320px);
      padding: 14px;
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(10, 10, 10, 0.16);
      animation: rise 0.16s var(--vos-ease);
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .nav {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .nav strong {
      font-family: var(--vos-display);
      font-size: 1rem;
      letter-spacing: -0.02em;
    }
    .nav-btn {
      width: 36px; height: 36px;
      border-radius: 10px;
      border: 1px solid var(--vos-border);
      background: #fff;
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
      color: var(--vos-ink);
    }
    .nav-btn:hover { background: var(--vos-bg-accent); }

    .weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
      margin-bottom: 4px;
    }
    .weekdays span {
      text-align: center;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--vos-ink-faint);
      font-weight: 700;
      padding: 4px 0;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .blank { min-height: 36px; }
    .day {
      min-height: 36px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      font: inherit;
      font-weight: 600;
      color: var(--vos-ink);
      cursor: pointer;
    }
    .day:hover:not(:disabled) { background: var(--vos-bg-accent); }
    .day.muted { color: var(--vos-ink-faint); font-weight: 500; }
    .day.today { box-shadow: inset 0 0 0 1.5px var(--vos-brand); }
    .day.on {
      background: var(--vos-brand);
      color: #fff;
      box-shadow: none;
    }
    .day:disabled { opacity: 0.35; cursor: not-allowed; }

    .foot {
      display: flex; justify-content: space-between; gap: 12px;
      margin-top: 10px; padding-top: 10px;
      border-top: 1px solid var(--vos-border);
    }
    .link {
      border: 0; background: none; padding: 0;
      color: var(--vos-brand); font: inherit; font-weight: 700;
      cursor: pointer;
    }
  `],
})
export class VosDatePickerComponent implements ControlValueAccessor {
  @Input() placeholder = 'Pick a date';
  /** Inclusive min YYYY-MM-DD */
  @Input() min = '';
  /** Inclusive max YYYY-MM-DD */
  @Input() max = '';

  readonly weekdays = WEEKDAYS;
  readonly todayIso = toIso(new Date());

  readonly value = signal('');
  readonly open = signal(false);
  readonly disabled = signal(false);
  readonly view = signal(startOfMonth(new Date()));

  @HostBinding('class.open')
  get hostOpen(): boolean {
    return this.open();
  }

  readonly monthLabel = computed(() => {
    const d = this.view();
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  });

  readonly cells = computed(() => buildCells(this.view(), this.min, this.max));

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>) {}

  display(): string {
    const v = this.value();
    if (!v) return '';
    const d = parseIso(v);
    if (!d) return v;
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  toggle(ev: Event): void {
    ev.stopPropagation();
    if (this.disabled()) return;
    const next = !this.open();
    if (next) announceVosOverlayOpen(this);
    this.open.set(next);
    if (next) {
      const cur = parseIso(this.value()) || new Date();
      this.view.set(startOfMonth(cur));
    }
    this.onTouched();
  }

  shiftMonth(delta: number): void {
    const d = new Date(this.view());
    d.setMonth(d.getMonth() + delta);
    this.view.set(startOfMonth(d));
  }

  pick(iso: string): void {
    this.value.set(iso);
    this.onChange(iso);
    this.open.set(false);
    this.onTouched();
  }

  clear(): void {
    this.value.set('');
    this.onChange('');
    this.open.set(false);
    this.onTouched();
  }

  writeValue(v: string | null): void {
    this.value.set(v ?? '');
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:vos-overlay-open', ['$event'])
  onOverlayOpen(ev: Event): void {
    const detail = (ev as CustomEvent).detail;
    if (detail !== this) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.open.set(false);
  }
}

type Cell = {
  key: string;
  blank?: boolean;
  day?: number;
  iso?: string;
  inMonth?: boolean;
  disabled?: boolean;
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function buildCells(view: Date, min: string, max: string): Cell[] {
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: Cell[] = [];

  for (let i = 0; i < firstDow; i++) {
    const day = prevDays - firstDow + 1 + i;
    const dt = new Date(year, month - 1, day);
    const iso = toIso(dt);
    cells.push({
      key: iso,
      day,
      iso,
      inMonth: false,
      disabled: isOutOfRange(iso, min, max),
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toIso(new Date(year, month, day));
    cells.push({
      key: iso,
      day,
      iso,
      inMonth: true,
      disabled: isOutOfRange(iso, min, max),
    });
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    const day = cells.length - (firstDow + daysInMonth) + 1;
    const dt = new Date(year, month + 1, day);
    const iso = toIso(dt);
    cells.push({
      key: iso + '-n',
      day,
      iso,
      inMonth: false,
      disabled: isOutOfRange(iso, min, max),
    });
    if (cells.length >= 42) break;
  }

  return cells;
}

function isOutOfRange(iso: string, min: string, max: string): boolean {
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}
