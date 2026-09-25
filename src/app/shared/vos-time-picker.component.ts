import {
  Component,
  ElementRef,
  HostListener,
  Input,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'vos-time-picker',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VosTimePickerComponent),
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
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/>
            <path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </button>

      @if (open()) {
        <div class="panel" role="listbox" aria-label="Choose time" (click)="$event.stopPropagation()">
          <div class="cols">
            <div class="col">
              <p class="col-label">Hour</p>
              <div class="list">
                @for (h of hours; track h) {
                  <button
                    type="button"
                    class="slot"
                    [class.on]="hour() === h"
                    (click)="setHour(h)"
                  >{{ h }}</button>
                }
              </div>
            </div>
            <div class="col">
              <p class="col-label">Min</p>
              <div class="list">
                @for (m of minutes; track m) {
                  <button
                    type="button"
                    class="slot"
                    [class.on]="minute() === m"
                    (click)="setMinute(m)"
                  >{{ m }}</button>
                }
              </div>
            </div>
          </div>
          <button type="button" class="done" (click)="confirm()">Done</button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

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
      z-index: 40;
      left: 0;
      top: calc(100% + 6px);
      width: min(100%, 280px);
      padding: 12px;
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(10, 10, 10, 0.12);
      animation: rise 0.16s var(--vos-ease);
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .col-label {
      margin: 0 0 6px;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--vos-ink-faint);
      font-weight: 700;
      text-align: center;
    }
    .list {
      max-height: 180px;
      overflow: auto;
      border: 1px solid var(--vos-border);
      border-radius: 12px;
      padding: 4px;
    }
    .slot {
      width: 100%;
      border: 0;
      background: transparent;
      padding: 8px;
      border-radius: 8px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: var(--vos-ink);
    }
    .slot:hover { background: var(--vos-bg-accent); }
    .slot.on {
      background: var(--vos-brand-soft);
      color: var(--vos-brand);
    }

    .done {
      width: 100%;
      margin-top: 10px;
      min-height: 40px;
      border: 0;
      border-radius: 12px;
      background: var(--vos-brand);
      color: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .done:hover { background: var(--vos-brand-hover); }
  `],
})
export class VosTimePickerComponent implements ControlValueAccessor {
  @Input() placeholder = 'Pick a time';
  /** Minute step: 5 | 15 | 30 */
  @Input() step = 15;

  readonly open = signal(false);
  readonly disabled = signal(false);
  readonly value = signal('');
  readonly hour = signal('09');
  readonly minute = signal('00');

  hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

  get minutes(): string[] {
    const step = this.step || 15;
    const out: string[] = [];
    for (let m = 0; m < 60; m += step) {
      out.push(String(m).padStart(2, '0'));
    }
    return out;
  }

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>) {}

  display(): string {
    const v = this.value();
    if (!v) return '';
    const [h, m] = v.split(':');
    const hourNum = Number(h);
    if (Number.isNaN(hourNum)) return v;
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const h12 = hourNum % 12 || 12;
    return `${h12}:${m || '00'} ${ampm}`;
  }

  toggle(ev: Event): void {
    ev.stopPropagation();
    if (this.disabled()) return;
    const next = !this.open();
    this.open.set(next);
    if (next) this.syncFromValue();
    this.onTouched();
  }

  setHour(h: string): void {
    this.hour.set(h);
  }

  setMinute(m: string): void {
    this.minute.set(m);
  }

  confirm(): void {
    const v = `${this.hour()}:${this.minute()}`;
    this.value.set(v);
    this.onChange(v);
    this.open.set(false);
    this.onTouched();
  }

  writeValue(v: string | null): void {
    this.value.set(v ?? '');
    this.syncFromValue();
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

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.open.set(false);
  }

  private syncFromValue(): void {
    const v = this.value();
    if (v && /^\d{1,2}:\d{2}/.test(v)) {
      const [h, m] = v.split(':');
      this.hour.set(String(Number(h)).padStart(2, '0'));
      const step = this.step || 15;
      const mins = Math.round(Number(m) / step) * step;
      this.minute.set(String(Math.min(mins, 60 - step)).padStart(2, '0'));
    }
  }
}
