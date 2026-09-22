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
    <div class="top-nav">
      <a routerLink="/pets" class="back">← Pets</a>
      @if (!isEdit && stage() === 2) {
        <button type="button" class="back back--step" (click)="goToStep1()">← Step 1</button>
      }
    </div>

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
          Name <span class="req" aria-hidden="true">*</span>
          <input [(ngModel)]="model.name" name="name" required autocomplete="off" placeholder="e.g. Jimmy" />
        </label>

        <p class="hint">Species <span class="req" aria-hidden="true">*</span></p>
        <div class="pills" role="group" aria-label="Species">
          @for (s of speciesOpts; track s) {
            <button type="button" class="pill" [class.on]="speciesChoice === s" (click)="selectSpecies(s)">{{ s }}</button>
          }
        </div>
        @if (speciesChoice === 'Other') {
          <label class="field">
            Please specify <span class="req" aria-hidden="true">*</span>
            <input
              [(ngModel)]="speciesOther"
              name="speciesOther"
              required
              autocomplete="off"
              placeholder="e.g. Rabbit, Bird, Reptile"
            />
          </label>
        }

        <label class="field">
          Breed <span class="opt">(optional)</span>
          <input [(ngModel)]="model.breed" name="breed" placeholder="Optional" />
        </label>

        <p class="hint">Sex <span class="req" aria-hidden="true">*</span></p>
        <div class="pills" role="group" aria-label="Sex">
          @for (g of sexOpts; track g) {
            <button type="button" class="pill" [class.on]="model.gender === g" (click)="model.gender = g">{{ g }}</button>
          }
        </div>

        <label class="field">
          Age / date of birth <span class="req" aria-hidden="true">*</span>
          <input [(ngModel)]="model.ageOrDob" name="ageOrDob" required placeholder="e.g. 3 years or 2021-05-01" />
        </label>

        @if (!isEdit) {
          <div class="nav">
            <button type="button" class="btn" [disabled]="!step1Valid()" (click)="goToStep2()">Continue</button>
          </div>
        }
      }

      @if (stage() === 2 || isEdit) {
        <div class="fields-2">
          <label class="field">
            Color / marks <span class="opt">(optional)</span>
            <input [(ngModel)]="model.colorMarks" name="colorMarks" placeholder="e.g. brown with white chest" />
          </label>
          <div class="field">
            Weight <span class="opt">(optional)</span>
            <div class="weight-row">
              <input
                type="number"
                inputmode="decimal"
                min="0"
                step="0.1"
                [(ngModel)]="weightValue"
                name="weightValue"
                placeholder="e.g. 12"
                (ngModelChange)="syncWeight()"
              />
              <div class="unit-toggle" role="group" aria-label="Weight unit">
                @for (u of weightUnits; track u) {
                  <button
                    type="button"
                    class="unit"
                    [class.on]="weightUnit === u"
                    (click)="setWeightUnit(u)"
                  >{{ u }}</button>
                }
              </div>
            </div>
          </div>
        </div>

        <label class="field">
          Microchip <span class="opt">(optional)</span>
          <input
            [(ngModel)]="model.microchip"
            name="microchip"
            inputmode="numeric"
            autocomplete="off"
            maxlength="15"
            placeholder="9, 10, or 15-digit ID"
            (ngModelChange)="onMicrochipInput($event)"
          />
          <span class="help">Digits only — usually 15 (ISO), sometimes 9 or 10.</span>
          @if (microchipError()) {
            <span class="field-err">{{ microchipError() }}</span>
          }
        </label>
        <label class="field">
          Allergies <span class="opt">(optional)</span>
          <textarea [(ngModel)]="model.allergies" name="allergies" rows="2" placeholder="Food, meds, environment…"></textarea>
        </label>
        <label class="field">
          Medical notes <span class="opt">(optional)</span>
          <textarea [(ngModel)]="model.medicalNotes" name="medicalNotes" rows="2" placeholder="Conditions, past surgeries…"></textarea>
        </label>
        <label class="field">
          Special needs <span class="opt">(optional)</span>
          <textarea [(ngModel)]="model.specialNeeds" name="specialNeeds" rows="2" placeholder="Anxiety, mobility, diet…"></textarea>
        </label>

        <div class="field">
          Photo <span class="opt">(optional)</span>
          <label class="upload" [class.upload--has]="!!preview() || !!model.photoUrl">
            <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" (change)="onFile($event)" />
            @if (preview()) {
              <img class="upload__preview" [src]="preview()" alt="Selected photo preview" />
              <span class="upload__change">Change photo</span>
            } @else if (model.photoUrl) {
              <img class="upload__preview" [src]="model.photoUrl" alt="Current photo" />
              <span class="upload__change">Change photo</span>
            } @else {
              <span class="upload__icon" aria-hidden="true">＋</span>
              <strong>Add a photo</strong>
              <em>JPG, PNG, or WEBP · max 5 MB</em>
            }
          </label>
          <span class="help">Accepted: JPG, PNG, WEBP. Maximum size 5 MB.</span>
          @if (photoError()) {
            <span class="field-err">{{ photoError() }}</span>
          }
        </div>

        <div class="nav">
          @if (!isEdit) {
            <button type="button" class="ghost" (click)="goToStep1()">Back</button>
          }
          <button type="submit" class="btn" [disabled]="saving() || !canSave()">
            {{ saving() ? 'Saving…' : isEdit ? 'Save changes' : 'Save pet' }}
          </button>
        </div>
      }
    </form>
  `,
  styles: [`
    .top-nav {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px;
      margin-bottom: 10px;
    }
    .back {
      display: inline-block;
      font-weight: 700; color: var(--vos-brand); text-decoration: none;
      background: none; border: 0; padding: 0; cursor: pointer;
      font-family: inherit; font-size: inherit;
    }
    .back--step { color: var(--vos-ink-muted); }
    .back--step:hover { color: var(--vos-brand); }
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
    .field span, .hint .opt { text-transform: none; letter-spacing: 0; font-weight: 600; color: #9a968e; }
    .field .req, .hint .req {
      color: var(--vos-brand, #FD4A29);
      font-weight: 800;
      margin-left: 2px;
      letter-spacing: 0;
      text-transform: none;
    }
    .field .opt { margin-left: 4px; }
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
    .help {
      display: block;
      margin-top: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
      color: #9a968e;
    }
    .field-err {
      display: block;
      margin-top: 6px;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
      color: #B42318;
    }

    .weight-row {
      display: flex; gap: 8px; align-items: stretch;
      margin-top: 7px;
    }
    .weight-row input {
      margin-top: 0;
      flex: 1;
      min-width: 0;
    }
    .unit-toggle {
      display: flex;
      flex-shrink: 0;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--vos-border);
      background: #faf8f4;
    }
    .unit {
      min-width: 52px;
      border: 0;
      background: transparent;
      padding: 0 14px;
      font-weight: 700;
      font-family: inherit;
      font-size: 0.95rem;
      color: var(--vos-ink-muted);
      cursor: pointer;
    }
    .unit.on {
      background: #0a0a0a;
      color: #fff;
    }

    .upload {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 7px;
      min-height: 140px;
      padding: 18px 14px;
      border-radius: 16px;
      border: 1.5px dashed var(--vos-border);
      background: #faf8f4;
      text-align: center;
      cursor: pointer;
      overflow: hidden;
    }
    .upload:hover { border-color: rgba(253, 74, 41, 0.45); }
    .upload input {
      position: absolute; inset: 0;
      opacity: 0; cursor: pointer;
      width: 100%; height: 100%;
      margin: 0; padding: 0; min-height: 0;
      border: 0; background: transparent;
    }
    .upload__icon {
      width: 36px; height: 36px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--vos-brand-soft, #ffe8e2); color: var(--vos-brand, #FD4A29);
      font-size: 1.2rem; font-weight: 700;
    }
    .upload strong {
      font-family: var(--vos-display);
      font-size: 1.05rem;
      letter-spacing: -0.02em;
      text-transform: none;
      color: var(--vos-ink);
      font-weight: 700;
    }
    .upload em {
      font-style: normal;
      font-size: 0.88rem;
      color: var(--vos-ink-muted);
      letter-spacing: 0;
      text-transform: none;
      font-weight: 600;
    }
    .upload--has {
      padding: 0;
      border-style: solid;
      min-height: 160px;
    }
    .upload__preview {
      width: 100%; height: 160px; object-fit: cover; display: block;
    }
    .upload__change {
      position: absolute; left: 12px; bottom: 12px;
      padding: 6px 10px; border-radius: 999px;
      background: rgba(10, 10, 10, 0.72); color: #fff;
      font-size: 0.8rem; font-weight: 700;
      letter-spacing: 0; text-transform: none;
      pointer-events: none;
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
  sexOpts = ['Male', 'Female', 'Unknown'];
  weightUnits = ['kg', 'lbs'] as const;
  /** Pill selection; when Other, real value lives in speciesOther. */
  speciesChoice: '' | 'Dog' | 'Cat' | 'Other' = '';
  speciesOther = '';
  weightValue: number | null = null;
  weightUnit: 'kg' | 'lbs' = 'kg';
  readonly maxPhotoBytes = 5 * 1024 * 1024;
  readonly allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];
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
  readonly microchipError = signal('');
  readonly photoError = signal('');
  private siblingPets: Array<{ id: string; name?: string }> = [];

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private router: Router,
    private activePet: ActivePetService,
  ) {}

  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.isEdit = !!(this.id && this.route.snapshot.url.some((s) => s.path === 'edit'));
    try {
      const list = await this.api.pets();
      this.siblingPets = Array.isArray(list) ? list : list?.pets || [];
    } catch {
      this.siblingPets = [];
    }
    if (this.isEdit) {
      this.stage.set(2);
      try {
        this.model = { ...this.model, ...(await this.api.pet(this.id)) };
        this.hydrateSpeciesChoice();
        this.hydrateWeight();
        if (this.model.sex && !this.model.gender) this.model.gender = this.model.sex;
      } catch (e: any) {
        this.error.set(e?.message || 'Load failed');
      }
    }
  }

  private isDuplicateName(name: string): boolean {
    const key = name.trim().toLowerCase();
    if (!key) return false;
    return this.siblingPets.some(
      (p) => p.id !== this.id && String(p.name || '').trim().toLowerCase() === key,
    );
  }

  selectSpecies(s: string) {
    this.speciesChoice = s as 'Dog' | 'Cat' | 'Other';
    if (s === 'Other') {
      this.model.species = this.speciesOther.trim();
    } else {
      this.speciesOther = '';
      this.model.species = s;
    }
  }

  /** Sync pill UI from loaded pet.species (Dog/Cat vs custom). */
  private hydrateSpeciesChoice() {
    const sp = String(this.model.species || '').trim();
    if (sp === 'Dog' || sp === 'Cat') {
      this.speciesChoice = sp;
      this.speciesOther = '';
    } else if (sp) {
      this.speciesChoice = 'Other';
      this.speciesOther = sp === 'Other' ? '' : sp;
    } else {
      this.speciesChoice = '';
      this.speciesOther = '';
    }
  }

  private hydrateWeight() {
    const raw = String(this.model.weight || '').trim();
    if (!raw) {
      this.weightValue = null;
      this.weightUnit = 'kg';
      return;
    }
    const match = raw.match(/^([\d.]+)\s*(kg|lbs|lb|g)?$/i);
    if (match) {
      this.weightValue = Number(match[1]);
      const u = (match[2] || 'kg').toLowerCase();
      this.weightUnit = u === 'lb' || u === 'lbs' ? 'lbs' : 'kg';
    } else {
      const n = Number(raw);
      this.weightValue = Number.isFinite(n) ? n : null;
      this.weightUnit = 'kg';
    }
    this.syncWeight();
  }

  setWeightUnit(u: 'kg' | 'lbs') {
    this.weightUnit = u;
    this.syncWeight();
  }

  syncWeight() {
    if (this.weightValue == null || Number.isNaN(Number(this.weightValue))) {
      this.model.weight = '';
      return;
    }
    const n = Number(this.weightValue);
    if (!Number.isFinite(n) || n < 0) {
      this.model.weight = '';
      return;
    }
    this.model.weight = `${n} ${this.weightUnit}`;
  }

  resolvedSpecies(): string {
    if (this.speciesChoice === 'Other') return this.speciesOther.trim();
    if (this.speciesChoice === 'Dog' || this.speciesChoice === 'Cat') return this.speciesChoice;
    return String(this.model.species || '').trim();
  }

  step1Valid(): boolean {
    return !!(
      this.model.name?.trim() &&
      this.resolvedSpecies() &&
      this.model.gender?.trim() &&
      this.model.ageOrDob?.trim()
    );
  }

  microchipValid(): boolean {
    const chip = String(this.model.microchip || '').trim();
    if (!chip) {
      this.microchipError.set('');
      return true;
    }
    if (!/^\d+$/.test(chip)) {
      this.microchipError.set('Microchip ID must contain digits only.');
      return false;
    }
    if (![9, 10, 15].includes(chip.length)) {
      this.microchipError.set('Enter a 9, 10, or 15-digit microchip ID.');
      return false;
    }
    this.microchipError.set('');
    return true;
  }

  /** Non-mutating check for template bindings. */
  isMicrochipOk(): boolean {
    const chip = String(this.model.microchip || '').trim();
    if (!chip) return true;
    return /^\d+$/.test(chip) && [9, 10, 15].includes(chip.length);
  }

  onMicrochipInput(value: string) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 15);
    if (digits !== this.model.microchip) this.model.microchip = digits;
    this.microchipValid();
  }

  canSave(): boolean {
    return this.step1Valid() && this.isMicrochipOk() && !this.photoError();
  }

  goToStep1() {
    this.error.set('');
    this.stage.set(1);
  }

  goToStep2() {
    if (!this.step1Valid()) {
      this.error.set('Please fill in Name, Species, Sex, and Age / date of birth.');
      return;
    }
    this.error.set('');
    this.model.species = this.resolvedSpecies();
    this.stage.set(2);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.photoError.set('');
    if (this.preview()) URL.revokeObjectURL(this.preview());
    this.preview.set('');
    this.photoFile = null;

    if (!file) return;

    const typeOk =
      this.allowedPhotoTypes.includes(file.type) ||
      /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!typeOk) {
      this.photoError.set('Please choose a JPG, PNG, or WEBP image.');
      input.value = '';
      return;
    }
    if (file.size > this.maxPhotoBytes) {
      this.photoError.set('Photo must be 5 MB or smaller.');
      input.value = '';
      return;
    }

    this.photoFile = file;
    this.preview.set(URL.createObjectURL(file));
  }

  async save() {
    if (!this.step1Valid()) {
      this.error.set('Please fill in Name, Species, Sex, and Age / date of birth.');
      if (!this.isEdit) this.stage.set(1);
      return;
    }
    if (!this.microchipValid()) {
      this.error.set(this.microchipError() || 'Please check the microchip ID.');
      return;
    }
    if (this.photoError()) {
      this.error.set(this.photoError());
      return;
    }
    const name = String(this.model.name || '').trim();
    if (this.isDuplicateName(name)) {
      this.error.set(
        `You already have a pet named “${name}” (names aren’t case-sensitive). Pick a different name or edit the existing profile.`,
      );
      if (!this.isEdit) this.stage.set(1);
      return;
    }
    this.syncWeight();
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      this.model.species = this.resolvedSpecies();
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
