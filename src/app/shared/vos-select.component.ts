import {
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  forwardRef,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { announceVosOverlayOpen } from './vos-overlay';

export type VosSelectOption = { value: string; label: string };

@Component({
  standalone: true,
  selector: 'vos-select',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VosSelectComponent),
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
        [attr.aria-haspopup]="'listbox'"
        (click)="toggle($event)"
      >
        <span class="value" [class.placeholder]="!selectedLabel()">{{ selectedLabel() || placeholder }}</span>
        <span class="chev" aria-hidden="true"></span>
      </button>

      @if (open()) {
        <ul class="menu" role="listbox" [attr.aria-label]="ariaLabel || 'Options'">
          @for (opt of options; track opt.value) {
            <li role="option" [attr.aria-selected]="opt.value === value()">
              <button type="button" class="opt" [class.on]="opt.value === value()" (click)="pick(opt, $event)">
                {{ opt.label }}
              </button>
            </li>
          }
        </ul>
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
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--vos-border);
      background: #fff;
      color: var(--vos-ink);
      font-family: inherit;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
      line-height: 1.35;
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

    .value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .value.placeholder { color: var(--vos-ink-faint); font-weight: 500; }

    .chev {
      width: 10px; height: 10px; flex-shrink: 0;
      border-right: 2px solid var(--vos-ink-muted);
      border-bottom: 2px solid var(--vos-ink-muted);
      transform: rotate(45deg) translateY(-2px);
      transition: transform 0.15s ease;
    }
    .root.open .chev { transform: rotate(225deg) translateY(-1px); }

    .menu {
      position: absolute;
      z-index: 90;
      left: 0; right: 0;
      top: calc(100% + 6px);
      margin: 0;
      padding: 6px;
      list-style: none;
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 14px;
      box-shadow: 0 16px 40px rgba(10, 10, 10, 0.12);
      max-height: 260px;
      overflow: auto;
      animation: rise 0.16s var(--vos-ease);
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .opt {
      width: 100%;
      display: block;
      text-align: left;
      border: 0;
      background: transparent;
      padding: 10px 12px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
      line-height: 1.35;
      color: var(--vos-ink);
      cursor: pointer;
    }
    .opt:hover { background: var(--vos-bg-accent); }
    .opt.on {
      background: var(--vos-brand-soft);
      color: var(--vos-brand);
    }
  `],
})
export class VosSelectComponent implements ControlValueAccessor {
  @Input({ required: true }) options: VosSelectOption[] = [];
  @Input() placeholder = 'Select…';
  @Input() ariaLabel = '';

  readonly value = signal('');
  readonly open = signal(false);
  readonly disabled = signal(false);

  @HostBinding('class.open')
  get hostOpen(): boolean {
    return this.open();
  }

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>) {}

  selectedLabel(): string {
    const v = this.value();
    return this.options.find((o) => o.value === v)?.label || '';
  }

  toggle(ev: Event): void {
    ev.stopPropagation();
    if (this.disabled()) return;
    const next = !this.open();
    if (next) announceVosOverlayOpen(this);
    this.open.set(next);
    this.onTouched();
  }

  pick(opt: VosSelectOption, ev: Event): void {
    ev.stopPropagation();
    this.value.set(opt.value);
    this.onChange(opt.value);
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
