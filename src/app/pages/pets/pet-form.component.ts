import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { cropImageRegionToFile, resolvePetPhotoUrl, cachePetPhotoUrl, fileToDataUrl } from '../../utils/pet-photo';
import {
  PET_DOC_CATEGORIES,
  PetDocCategoryId,
  categoryLabel,
  isAllowedPetDocument,
  MAX_PET_DOC_BYTES,
} from '../../utils/pet-documents';
import { VosSelectComponent, VosSelectOption } from '../../shared/vos-select.component';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, VosSelectComponent, VosBackButtonComponent],
  selector: 'app-pet-form',
  template: `
    <div class="top-nav">
      <vos-back-button [fallback]="'/pets'" fallbackLabel="Pets" />
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
            <input type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp" (change)="onFile($event)" />
            @if (preview()) {
              <img class="upload__preview" [src]="preview()" alt="Selected photo preview" />
              <span class="upload__change">Change photo</span>
            } @else if (model.photoUrl) {
              <img class="upload__preview" [src]="model.photoUrl" alt="Current photo" />
              <span class="upload__change">Change photo</span>
            } @else {
              <span class="upload__icon" aria-hidden="true">＋</span>
              <strong>Add a photo</strong>
              <em>Any image · you choose the crop · max 5 MB</em>
            }
          </label>
          <span class="help">Accepted: any common image format. You’ll position and crop the photo yourself. Max 5 MB.</span>
          @if (photoError()) {
            <span class="field-err">{{ photoError() }}</span>
          }
        </div>

        <div class="field docs-field">
          Additional documents <span class="opt">(optional)</span>
          <p class="help docs-help">
            Attach ID papers, past reports, vaccination cards, or extra photos.
            Pick a category for each file — you can add more later from Documents.
          </p>
          <div class="docs-row">
            <label class="docs-cat">
              Category
              <vos-select
                name="pendingDocCategory"
                ariaLabel="Document category"
                [options]="docCategoryOptions"
                [(ngModel)]="pendingDocCategory"
              />
            </label>
            <label class="docs-add">
              <input
                type="file"
                multiple
                [accept]="docAccept()"
                (change)="onExtraDocs($event)"
              />
              <strong>Add files</strong>
            </label>
          </div>
          @if (docError()) {
            <span class="field-err">{{ docError() }}</span>
          }
          @if (pendingDocs.length) {
            <ul class="docs-list">
              @for (d of pendingDocs; track d.key) {
                <li>
                  <div>
                    <strong>{{ d.file.name }}</strong>
                    <span>{{ categoryLabel(d.category) }} · {{ prettySize(d.file.size) }}</span>
                  </div>
                  <button type="button" class="docs-remove" (click)="removePendingDoc(d.key)" aria-label="Remove file">
                    Remove
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <div class="nav">
          @if (!isEdit) {
            <button type="button" class="ghost" (click)="goToStep1()">Back</button>
          }
          <button type="submit" class="btn" [disabled]="saving() || cropOpen() || !canSave()">
            {{ saving() ? 'Saving…' : isEdit ? 'Save changes' : 'Save pet' }}
          </button>
        </div>
      }
    </form>

    @if (cropOpen()) {
      <div class="crop-root" role="dialog" aria-modal="true" aria-label="Crop profile photo">
        <div class="crop-backdrop" (click)="cancelCrop()"></div>
        <div class="crop-sheet">
          <header class="crop-head">
            <h2>Crop photo</h2>
            <p>Drag to reposition, then zoom to frame the portrait.</p>
          </header>
          <div
            class="crop-stage"
            (pointerdown)="onCropPointerDown($event)"
            (pointermove)="onCropPointerMove($event)"
            (pointerup)="onCropPointerUp($event)"
            (pointercancel)="onCropPointerUp($event)"
          >
            <div class="crop-frame" aria-hidden="true">
              <img
                class="crop-img"
                [src]="cropSrc()"
                alt=""
                draggable="false"
                [style.width.px]="cropDisplayW()"
                [style.height.px]="cropDisplayH()"
                [style.transform]="cropTransform()"
              />
            </div>
          </div>
          <label class="crop-zoom">
            Zoom
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              [value]="cropZoom()"
              (input)="onCropZoom($event)"
            />
          </label>
          <div class="crop-actions">
            <button type="button" class="ghost" (click)="cancelCrop()" [disabled]="cropApplying()">Cancel</button>
            <button type="button" class="btn" (click)="applyCrop()" [disabled]="cropApplying()">
              {{ cropApplying() ? 'Applying…' : 'Use photo' }}
            </button>
          </div>
        </div>
      </div>
    }
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
      min-height: 0;
      width: min(100%, 240px);
      aspect-ratio: 1;
      margin-top: 8px;
      border-radius: 50%;
      overflow: hidden;
    }
    .upload__preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    .upload__change {
      position: absolute; left: 12px; bottom: 12px;
      padding: 6px 10px; border-radius: 999px;
      background: rgba(10, 10, 10, 0.72); color: #fff;
      font-size: 0.8rem; font-weight: 700;
      letter-spacing: 0; text-transform: none;
      pointer-events: none;
    }

    .docs-field { margin-top: 4px; }
    .docs-help { margin: 6px 0 10px; }
    .docs-row {
      display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;
    }
    .docs-cat {
      display: flex; flex-direction: column; gap: 6px; flex: 1 1 160px;
      font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--vos-ink-muted);
    }
    .docs-cat vos-select {
      text-transform: none; letter-spacing: 0; font-weight: 600;
    }
    .docs-add {
      position: relative; display: inline-flex; align-items: center; justify-content: center;
      min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer;
      border: 1px solid var(--vos-border); background: #fff; color: var(--vos-ink);
      font-weight: 700; flex: 0 0 auto;
    }
    .docs-add input {
      position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
    }
    .docs-list {
      list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px;
    }
    .docs-list li {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 12px; border-radius: 12px; border: 1px solid var(--vos-border);
      background: #faf8f4;
    }
    .docs-list strong {
      display: block; font-size: 0.92rem; color: var(--vos-ink);
      text-transform: none; letter-spacing: 0;
    }
    .docs-list span {
      display: block; font-size: 0.8rem; color: var(--vos-ink-muted);
      text-transform: none; letter-spacing: 0; font-weight: 600; margin-top: 2px;
    }
    .docs-remove {
      border: 0; background: transparent; color: var(--vos-brand);
      font-weight: 700; cursor: pointer; font: inherit; padding: 4px 6px;
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

    .crop-root {
      position: fixed; inset: 0; z-index: 1200;
      display: grid; place-items: center;
      padding: 16px;
    }
    .crop-backdrop {
      position: absolute; inset: 0;
      background: rgba(10, 10, 10, 0.55);
    }
    .crop-sheet {
      position: relative;
      width: min(100%, 420px);
      padding: 20px 18px 18px;
      border-radius: 20px;
      background: #fff;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
      display: flex; flex-direction: column; gap: 14px;
    }
    .crop-head h2 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.02em;
    }
    .crop-head p {
      margin: 4px 0 0;
      color: var(--vos-ink-muted);
      font-size: 0.92rem;
      font-weight: 600;
    }
    .crop-stage {
      touch-action: none;
      user-select: none;
      display: grid;
      place-items: center;
    }
    .crop-frame {
      position: relative;
      width: 280px; height: 280px;
      border-radius: 50%;
      overflow: hidden;
      background: #111;
      border: 2px solid rgba(253, 74, 41, 0.55);
      cursor: grab;
    }
    .crop-frame:active { cursor: grabbing; }
    .crop-img {
      position: absolute;
      left: 50%; top: 50%;
      max-width: none;
      pointer-events: none;
      transform-origin: center center;
    }
    .crop-zoom {
      display: grid;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--vos-ink-muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .crop-zoom input[type='range'] {
      width: 100%;
      accent-color: var(--vos-brand, #FD4A29);
    }
    .crop-actions {
      display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;
    }
  `],
})
export class PetFormComponent implements OnInit, OnDestroy {
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
  readonly allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/heif'];
  model: any = {
    name: '', species: '', breed: '', gender: '', ageOrDob: '', colorMarks: '',
    weight: '', microchip: '', allergies: '', medicalNotes: '', specialNeeds: '',
  };
  photoFile: File | null = null;
  pendingDocs: Array<{ key: string; file: File; category: PetDocCategoryId }> = [];
  pendingDocCategory: PetDocCategoryId = 'id';
  readonly docCategories = PET_DOC_CATEGORIES.filter((c) => c.id !== 'clinical');
  readonly docCategoryOptions: VosSelectOption[] = this.docCategories.map((c) => ({
    value: c.id,
    label: c.label,
  }));
  categoryLabel = categoryLabel;
  readonly stage = signal(1);
  readonly preview = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ok = signal('');
  readonly microchipError = signal('');
  readonly photoError = signal('');
  readonly docError = signal('');
  readonly cropOpen = signal(false);
  readonly cropSrc = signal('');
  readonly cropZoom = signal(1);
  readonly cropPanX = signal(0);
  readonly cropPanY = signal(0);
  readonly cropApplying = signal(false);
  readonly cropViewport = 280;
  private siblingPets: Array<{ id: string; name?: string }> = [];
  private cropRawFile: File | null = null;
  private cropNaturalW = 0;
  private cropNaturalH = 0;
  private cropBaseScale = 1;
  private cropDragging = false;
  private cropDragOrigin = { x: 0, y: 0, panX: 0, panY: 0 };

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
      this.siblingPets = Array.isArray(list) ? list : [];
    } catch {
      this.siblingPets = [];
    }
    if (this.isEdit) {
      this.stage.set(2);
      try {
        this.model = { ...this.model, ...(await this.api.pet(this.id)) };
        const url = resolvePetPhotoUrl(this.model);
        if (url) this.model.photoUrl = url;
        this.hydrateIdentityFields();
        this.hydrateSpeciesChoice();
        this.hydrateWeight();
      } catch (e: any) {
        this.error.set(e?.message || 'Load failed');
      }
    }
  }

  ngOnDestroy() {
    this.revokePreview();
    this.revokeCropSrc();
  }

  /** Normalize API aliases so edit Save isn't blocked by missing mapped fields. */
  private hydrateIdentityFields() {
    if (!String(this.model.gender || '').trim()) {
      this.model.gender = String(this.model.sex || '').trim();
    }
    if (!String(this.model.ageOrDob || '').trim()) {
      this.model.ageOrDob = String(
        this.model.age || this.model.dob || this.model.dateOfBirth || this.model.date_of_birth || '',
      ).trim();
    }
    if (!String(this.model.species || '').trim() && this.model.type) {
      this.model.species = String(this.model.type).trim();
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
    const gender = String(this.model.gender || this.model.sex || '').trim();
    const age = String(
      this.model.ageOrDob || this.model.age || this.model.dob || this.model.dateOfBirth || '',
    ).trim();
    return !!(this.model.name?.trim() && this.resolvedSpecies() && gender && age);
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
    if (this.photoError() || !this.isMicrochipOk()) return false;
    // Edit: pet already exists — don't block photo/notes saves on optional identity aliases.
    if (this.isEdit) {
      return !!(String(this.model.name || '').trim() && this.resolvedSpecies());
    }
    return this.step1Valid();
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

  private revokePreview() {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.preview.set('');
  }

  private revokeCropSrc() {
    const url = this.cropSrc();
    if (url) URL.revokeObjectURL(url);
    this.cropSrc.set('');
  }

  cropDisplayW(): number {
    return this.cropNaturalW * this.cropBaseScale * this.cropZoom();
  }

  cropDisplayH(): number {
    return this.cropNaturalH * this.cropBaseScale * this.cropZoom();
  }

  cropTransform(): string {
    return `translate(calc(-50% + ${this.cropPanX()}px), calc(-50% + ${this.cropPanY()}px))`;
  }

  onCropZoom(ev: Event) {
    const v = Number((ev.target as HTMLInputElement).value);
    if (!Number.isFinite(v)) return;
    this.cropZoom.set(Math.min(3, Math.max(1, v)));
    this.clampCropPan();
  }

  onCropPointerDown(ev: PointerEvent) {
    if (this.cropApplying()) return;
    const el = ev.currentTarget as HTMLElement;
    el.setPointerCapture?.(ev.pointerId);
    this.cropDragging = true;
    this.cropDragOrigin = {
      x: ev.clientX,
      y: ev.clientY,
      panX: this.cropPanX(),
      panY: this.cropPanY(),
    };
  }

  onCropPointerMove(ev: PointerEvent) {
    if (!this.cropDragging) return;
    const dx = ev.clientX - this.cropDragOrigin.x;
    const dy = ev.clientY - this.cropDragOrigin.y;
    this.cropPanX.set(this.cropDragOrigin.panX + dx);
    this.cropPanY.set(this.cropDragOrigin.panY + dy);
    this.clampCropPan();
  }

  onCropPointerUp(ev: PointerEvent) {
    if (!this.cropDragging) return;
    this.cropDragging = false;
    try {
      (ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId);
    } catch {
      /* ignore */
    }
  }

  private clampCropPan() {
    const dw = this.cropDisplayW();
    const dh = this.cropDisplayH();
    const maxX = Math.max(0, (dw - this.cropViewport) / 2);
    const maxY = Math.max(0, (dh - this.cropViewport) / 2);
    this.cropPanX.set(Math.min(maxX, Math.max(-maxX, this.cropPanX())));
    this.cropPanY.set(Math.min(maxY, Math.max(-maxY, this.cropPanY())));
  }

  cancelCrop() {
    if (this.cropApplying()) return;
    this.cropOpen.set(false);
    this.cropRawFile = null;
    this.revokeCropSrc();
    this.cropDragging = false;
  }

  async applyCrop() {
    if (!this.cropRawFile || this.cropApplying()) return;
    this.cropApplying.set(true);
    this.photoError.set('');
    try {
      const scale = this.cropBaseScale * this.cropZoom();
      const displayW = this.cropNaturalW * scale;
      const displayH = this.cropNaturalH * scale;
      const left = (this.cropViewport - displayW) / 2 + this.cropPanX();
      const top = (this.cropViewport - displayH) / 2 + this.cropPanY();
      const sx = Math.max(0, -left / scale);
      const sy = Math.max(0, -top / scale);
      const sw = Math.min(this.cropNaturalW - sx, this.cropViewport / scale);
      const sh = Math.min(this.cropNaturalH - sy, this.cropViewport / scale);
      const side = Math.min(sw, sh);
      const cropped = await cropImageRegionToFile(
        this.cropRawFile,
        { sx, sy, sw: side, sh: side },
        1024,
        0.9,
        this.cropRawFile.name,
      );
      this.revokePreview();
      this.photoFile = cropped;
      this.preview.set(URL.createObjectURL(cropped));
      if (this.isEdit && this.id) {
        try {
          const dataUrl = await fileToDataUrl(cropped);
          cachePetPhotoUrl(this.id, dataUrl);
        } catch {
          /* ignore */
        }
      }
      this.cropOpen.set(false);
      this.cropRawFile = null;
      this.revokeCropSrc();
      this.error.set('');
    } catch {
      this.photoError.set('Could not crop that image. Try another photo.');
    } finally {
      this.cropApplying.set(false);
    }
  }

  docAccept(): string {
    return this.docCategories.find((c) => c.id === this.pendingDocCategory)?.accept || 'image/*,.pdf';
  }

  prettySize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onExtraDocs(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    this.docError.set('');
    if (!files.length) return;

    const next = [...this.pendingDocs];
    for (const file of files) {
      if (!isAllowedPetDocument(file)) {
        this.docError.set(
          file.size > MAX_PET_DOC_BYTES
            ? `“${file.name}” is larger than ${Math.round(MAX_PET_DOC_BYTES / (1024 * 1024))} MB.`
            : `“${file.name}” isn’t a supported file type.`,
        );
        continue;
      }
      if (next.length >= 12) {
        this.docError.set('You can attach up to 12 documents here. Add more later from Documents.');
        break;
      }
      next.push({
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
        file,
        category: this.pendingDocCategory,
      });
    }
    this.pendingDocs = next;
  }

  removePendingDoc(key: string) {
    this.pendingDocs = this.pendingDocs.filter((d) => d.key !== key);
  }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.photoError.set('');
    input.value = '';

    if (!file) return;

    const typeOk =
      file.type.startsWith('image/') ||
      this.allowedPhotoTypes.includes(file.type) ||
      /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name);
    if (!typeOk) {
      this.photoError.set('Please choose an image file.');
      return;
    }
    if (file.size > this.maxPhotoBytes) {
      this.photoError.set('Photo must be 5 MB or smaller.');
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
        img.onerror = () => reject(new Error('Could not read image'));
        img.src = objectUrl;
      });
      if (!dims.w || !dims.h) {
        URL.revokeObjectURL(objectUrl);
        this.photoError.set('Could not read that image. Try another file.');
        return;
      }
      this.revokeCropSrc();
      this.cropRawFile = file;
      this.cropNaturalW = dims.w;
      this.cropNaturalH = dims.h;
      this.cropBaseScale = Math.max(this.cropViewport / dims.w, this.cropViewport / dims.h);
      this.cropZoom.set(1);
      this.cropPanX.set(0);
      this.cropPanY.set(0);
      this.cropSrc.set(objectUrl);
      this.cropOpen.set(true);
    } catch {
      this.photoError.set('Could not open that image. Try a JPG or PNG.');
    }
  }

  async save() {
    if (this.cropOpen()) {
      this.error.set('Finish cropping the photo first, or cancel.');
      return;
    }
    this.hydrateIdentityFields();
    if (this.isEdit) {
      if (!String(this.model.name || '').trim() || !this.resolvedSpecies()) {
        this.error.set('Name and species are required.');
        return;
      }
    } else if (!this.step1Valid()) {
      this.error.set('Please fill in Name, Species, Sex, and Age / date of birth.');
      this.stage.set(1);
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
      if (!this.model.gender && this.model.sex) this.model.gender = this.model.sex;
      if (!this.model.ageOrDob) {
        this.model.ageOrDob = String(
          this.model.age || this.model.dob || this.model.dateOfBirth || '',
        ).trim();
      }
      const body = { ...this.model };
      delete body.photoUrl;
      const saved = this.isEdit
        ? await this.api.updatePet(this.id, body)
        : await this.api.createPet(body);
      const petId = String(saved?.id || this.id || '').trim();
      if (!petId) {
        throw new Error('Pet saved but no id was returned — cannot upload photo.');
      }

      let photoUrl = resolvePetPhotoUrl(saved) || '';
      if (this.photoFile) {
        try {
          const uploaded = await this.api.uploadPetPhoto(petId, this.photoFile);
          photoUrl = resolvePetPhotoUrl(uploaded) || photoUrl;
          if (!photoUrl) {
            photoUrl = await fileToDataUrl(this.photoFile);
          }
          cachePetPhotoUrl(petId, photoUrl);
          this.model.photoUrl = photoUrl;
          if (this.preview()) URL.revokeObjectURL(this.preview());
          this.preview.set(photoUrl);
        } catch (photoErr: any) {
          try {
            const local = this.preview() || (await fileToDataUrl(this.photoFile));
            cachePetPhotoUrl(petId, local);
            photoUrl = local;
          } catch {
            /* ignore */
          }
          const msg =
            photoErr?.error?.message ||
            photoErr?.message ||
            'Photo could not be saved to the server';
          this.error.set(
            /route not found/i.test(String(msg))
              ? 'Pet details saved, but the photo upload API is missing on the server. See API_README.md.'
              : `Pet details saved, but photo upload failed: ${msg}`,
          );
          this.activePet.set(petId);
          return;
        }
      }

      if (this.pendingDocs.length) {
        const result = await this.api.uploadPetDocuments(
          petId,
          this.pendingDocs.map((d) => ({ file: d.file, category: d.category })),
        );
        if (result.failed) {
          const detail = result.errors.slice(0, 2).join(' · ');
          this.error.set(
            result.ok
              ? `Pet saved. ${result.ok} document(s) uploaded, ${result.failed} failed. ${detail}`
              : /route not found/i.test(detail)
                ? 'Pet saved, but document upload API is missing on the server. See API_README.md.'
                : `Pet saved, but documents failed to upload. ${detail}`,
          );
          this.activePet.set(petId);
          if (!result.ok) return;
          // Partial success — still navigate, but user saw the warning briefly; keep ok message via state
        } else {
          this.pendingDocs = [];
        }
      }

      this.activePet.set(petId);
      await this.router.navigate(['/pets', petId], {
        state: photoUrl ? { photoUrl } : undefined,
      });
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Save failed');
    } finally {
      this.saving.set(false);
    }
  }
}
