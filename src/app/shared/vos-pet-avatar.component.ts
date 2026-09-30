import { AfterViewChecked, Component, ElementRef, Input, OnChanges, ViewChild, signal } from '@angular/core';
import { petInitial } from '../utils/health-records';
import { resolvePetPhotoUrl } from '../utils/pet-photo';

/**
 * Profile photo that stays on a shimmer until the image has decoded,
 * then reveals it. Falls back to the name initial when there is no photo.
 */
@Component({
  standalone: true,
  selector: 'vos-pet-avatar',
  template: `
    @if (src()) {
      <img
        #photo
        [src]="src()"
        alt=""
        [class.is-shown]="ready()"
        (load)="onLoad(photo)"
        (error)="failed.set(true)"
      />
    }
    @if (src() && !ready() && !failed()) {
      <span class="buffer" aria-hidden="true"></span>
    }
    @if (!src() || failed()) {
      <span class="letter" [class.letter--inverse]="tone === 'inverse'">{{ letter() }}</span>
    }
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    img, .buffer, .letter { position: absolute; inset: 0; }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      opacity: 0;
    }
    img.is-shown { opacity: 1; }
    .buffer {
      background: linear-gradient(100deg, #f3efe6 20%, #fff 42%, #f3efe6 64%);
      background-size: 220% 100%;
      animation: vos-avatar-shimmer 1.15s ease-in-out infinite;
    }
    .letter {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--vos-display);
      font-weight: 700;
      font-size: 1.35em;
      line-height: 1;
      color: var(--vos-brand);
      text-transform: uppercase;
      user-select: none;
    }
    .letter--inverse { color: #fff; }
    @keyframes vos-avatar-shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .buffer { animation: none; }
    }
  `],
})
export class VosPetAvatarComponent implements OnChanges, AfterViewChecked {
  @Input() pet: any;
  @Input() name = '';
  @Input() tone: 'soft' | 'inverse' = 'soft';

  @ViewChild('photo') photo?: ElementRef<HTMLImageElement>;

  readonly src = signal('');
  readonly ready = signal(false);
  readonly failed = signal(false);

  ngOnChanges() {
    const next = resolvePetPhotoUrl(this.pet) || '';
    if (next === this.src() && (this.ready() || this.failed() || !next)) return;
    this.ready.set(false);
    this.failed.set(false);
    this.src.set(next);
  }

  ngAfterViewChecked() {
    const img = this.photo?.nativeElement;
    if (img?.complete && img.naturalWidth > 0 && !this.ready()) this.ready.set(true);
  }

  onLoad(img: HTMLImageElement) {
    if (img.naturalWidth > 0) this.ready.set(true);
  }

  letter(): string {
    return petInitial(this.pet?.name || this.name);
  }
}
