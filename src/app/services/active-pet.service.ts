import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'vos.activePetId';

@Injectable({ providedIn: 'root' })
export class ActivePetService {
  readonly activePetId = signal<string | null>(this.read());

  private read(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }

  get(): string | null {
    return this.activePetId();
  }

  set(petId: string | null) {
    const next = petId || null;
    this.activePetId.set(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore quota / private mode */
    }
  }

  /** Prefer stored id if still in the list; otherwise first pet. */
  syncFromPets(pets: Array<{ id: string }>, preferredId?: string | null): string | null {
    const list = pets || [];
    if (!list.length) {
      this.set(null);
      return null;
    }
    const want = preferredId || this.get();
    const match = want ? list.find((p) => p.id === want) : null;
    const id = match?.id || list[0].id;
    this.set(id);
    return id;
  }
}
