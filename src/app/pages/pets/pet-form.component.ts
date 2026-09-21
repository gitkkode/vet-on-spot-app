import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-pet-form',
  template: `
    <a routerLink="/pets" class="back">← Pets</a>

    <header class="head">
      <p class="kicker">{{ isEdit ? 'Update profile' : 'New family member' }}</p>
      <h1>{{ isEdit ? 'Edit pet' : stage() === 1 ? 'Who are we meeting?' : 'A few more details' }}</h1>
      <p class="sub">
        {{
          isEdit
            ? 'Keep their story accurate so every visit starts informed.'
            : stage() === 1
              ? 'Just the basics — name, species, and a little personality.'
              : 'Optional, but gold for the vet. Skip anything you don’t know yet.'
        }}
      </p>
      @if (!isEdit) {
        <div class="progress" role="progressbar" [attr.aria-valuenow]="stage()" aria-valuemin="1" aria-valuemax="2">
          <span [style.width.%]="(stage() / 2) * 100"></span>
        </div>
        <p class="progress__label">Step {{ stage() }} of 2</p>
      }
    </header>

    @if (error()) { <div class="vos-err">{{ error() }}</div> }
    @if (ok()) { <div class="vos-ok">{{ ok() }}</div> }

    <form class="panel" (ngSubmit)="save()">
      @if (stage() === 1) {
        <label class="field">
          Name
          <input [(ngModel)]="model.name" name="name" required autocomplete="off" placeholder="e.g. Jimmy" />
        </label>

        <p class="hint">Species</p>
        <div class="pills">
          @for (s of speciesOpts; track s) {
            <button type="button" class="pill" [class.on]="model.species === s" (click)="model.species = s">{{ s }}</button>
          }
        </div>

        <label class="field">
          Breed
          <input [(ngModel)]="model.breed" name="breed" placeholder="Optional" />
        </label>

        <p class="hint">Sex</p>
        <div class="pills">
          @for (g of sexOpts; track g) {
            <button type="button" class="pill" [class.on]="model.gender === g" (click)="model.gender = g">{{ g }}</button>
          }
        </div>

        <label class="field">
          Age / date of birth
          <input [(ngModel)]="model.ageOrDob" name="ageOrDob" placeholder="e.g. 3 years or 2021-05-01" />
        </label>

        @if (!isEdit) {
          <div class="nav">
            <button type="button" class="btn" [disabled]="!model.name.trim()" (click)="stage.set(2)">Continue</button>
          </div>
        }
      }

      @if (stage() === 2 || isEdit) {
        <div class="fields-2">
          <label class="field">
            Color / marks
            <input [(ngModel)]="model.colorMarks" name="colorMarks" placeholder="e.g. brown with white chest" />
          </label>
          <label class="field">
            Weight
            <input [(ngModel)]="model.weight" name="weight" placeholder="e.g. 12 kg" />
          </label>
        </div>

        <label class="field">
          Microchip
          <input [(ngModel)]="model.microchip" name="microchip" placeholder="Optional" />
        </label>
        <label class="field">
          Allergies
          <textarea [(ngModel)]="model.allergies" name="allergies" rows="2" placeholder="Food, meds, environment…"></textarea>
        </label>
        <label class="field">
          Medical notes
          <textarea [(ngModel)]="model.medicalNotes" name="medicalNotes" rows="2" placeholder="Conditions, past surgeries…"></textarea>
        </label>
        <label class="field">
          Special needs
          <textarea [(ngModel)]="model.specialNeeds" name="specialNeeds" rows="2" placeholder="Anxiety, mobility, diet…"></textarea>
        </label>

        <label class="field file">
          Photo <span>(optional)</span>
          <input type="file" accept="image/*" (change)="onFile($event)" />
        </label>
        @if (preview()) {
          <img class="preview" [src]="preview()" alt="Preview" />
        } @else if (model.photoUrl) {
          <img class="preview" [src]="model.photoUrl" alt="Current photo" />
        }

        <div class="nav">
          @if (!isEdit) {
            <button type="button" class="ghost" (click)="stage.set(1)">Back</button>
          }
          <button type="submit" class="btn" [disabled]="saving() || !model.name.trim()">
            {{ saving() ? 'Saving…' : isEdit ? 'Save changes' : 'Save pet' }}
          </button>
        </div>
      }
    </form>
  `,
  styles: [`
    .back {
      display: inline-block; margin-bottom: 10px;
      font-weight: 700; color: var(--vos-brand); text-decoration: none;
    }
    .head { margin-bottom: 18px; }
    .kicker {
      margin: 0 0 6px;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--vos-brand);
      font-weight: 600;
    }
    h1 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: clamp(1.7rem, 4vw, 2.3rem);
      letter-spacing: -0.04em;
      line-height: 1.1;
    }
    .sub {
      margin: 0 0 14px;
      color: var(--vos-ink-muted);
      font-size: 1.05rem;
      line-height: 1.4;
      max-width: 42ch;
    }
    .progress {
      height: 6px; border-radius: 999px;
      background: rgba(20, 16, 12, 0.08); overflow: hidden;
    }
    .progress span {
      display: block; height: 100%;
      background: linear-gradient(90deg, #FD4A29, #E03E20);
      transition: width 0.25s ease;
    }
    .progress__label {
      margin: 8px 0 0;
      font-family: var(--vos-mono);
      font-size: 11px;
      color: var(--vos-ink-muted);
    }

    .panel {
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 24px;
      padding: 22px 20px 20px;
      box-shadow: 0 12px 32px rgba(20, 16, 12, 0.05);
      margin-bottom: 28px;
      display: grid;
      gap: 14px;
    }

    .hint {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
    }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; }
    .pill {
      border: 1px solid var(--vos-border);
      background: #faf8f4;
      border-radius: 999px;
      padding: 10px 16px;
      min-height: 42px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      color: var(--vos-ink);
    }
    .pill.on {
      background: #0a0a0a;
      color: #fff;
      border-color: #0a0a0a;
    }

    .fields-2 { display: grid; gap: 12px; }
    @media (min-width: 640px) {
      .fields-2 { grid-template-columns: 1fr 1fr; }
    }
    .field {
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
    }
    .field span { text-transform: none; letter-spacing: 0; font-weight: 600; color: #9a968e; }
    .field input, .field textarea {
      width: 100%;
      margin-top: 7px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid transparent;
      background: #eef2f7;
      font-size: 1rem;
      font-family: inherit;
      color: var(--vos-ink);
      box-sizing: border-box;
      min-height: 48px;
    }
    .field textarea { min-height: 72px; resize: vertical; }
    .field input:focus, .field textarea:focus {
      outline: none;
      background: #fff;
      border-color: rgba(253, 74, 41, 0.45);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
    }
    .field.file input {
      padding: 10px;
      background: #fff;
      border: 1px dashed var(--vos-border);
    }
    .preview {
      width: 112px; height: 112px; object-fit: cover;
      border-radius: 18px; display: block;
      box-shadow: 0 8px 20px rgba(20, 16, 12, 0.1);
    }

    .nav {
      display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;
      margin-top: 6px;
    }
    .btn, .ghost {
      min-height: 48px;
      padding: 12px 22px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      font-family: inherit;
      border: 0;
    }
    .btn {
      background: linear-gradient(135deg, #FD4A29, #E03E20);
      color: #fff;
      box-shadow: 0 10px 24px rgba(253, 74, 41, 0.3);
    }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .ghost {
      background: transparent;
      color: var(--vos-ink-muted);
      border: 1px solid var(--vos-border);
    }
  `],
})
export class PetFormComponent implements OnInit {
  id = '';
  isEdit = false;
  speciesOpts = ['Dog', 'Cat', 'Other'];
  sexOpts = ['Male', 'Female'];
  model: any = {
    name: '', species: '', breed: '', gender: '', ageOrDob: '', colorMarks: '',
    weight: '', microchip: '', allergies: '', medicalNotes: '', specialNeeds: '',
  };
  photoFile: File | null = null;
  readonly stage = signal(1);
  readonly preview = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ok = signal('');

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private router: Router,
    private activePet: ActivePetService,
  ) {}

  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.isEdit = !!(this.id && this.route.snapshot.url.some((s) => s.path === 'edit'));
    if (this.isEdit) {
      this.stage.set(2);
      try {
        this.model = { ...this.model, ...(await this.api.pet(this.id)) };
      } catch (e: any) {
        this.error.set(e?.message || 'Load failed');
      }
    }
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.photoFile = file;
    if (this.preview()) URL.revokeObjectURL(this.preview());
    this.preview.set(file ? URL.createObjectURL(file) : '');
  }

  async save() {
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      const body = { ...this.model };
      delete body.photoUrl;
      const saved = this.isEdit
        ? await this.api.updatePet(this.id, body)
        : await this.api.createPet(body);
      if (this.photoFile && saved?.id) {
        try {
          await this.api.uploadPetPhoto(saved.id, this.photoFile);
        } catch {
          this.ok.set('Pet saved — photo upload failed, you can retry from Edit.');
        }
      }
      if (saved?.id) this.activePet.set(saved.id);
      await this.router.navigate(['/pets', saved.id]);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Save failed');
    } finally {
      this.saving.set(false);
    }
  }
}
