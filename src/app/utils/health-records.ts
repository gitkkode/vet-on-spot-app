/** Normalize API payloads that may be arrays or wrapped objects. */
export function asList(raw: unknown, keys: string[] = ['items', 'data']): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(obj[k])) return obj[k] as any[];
    }
  }
  return [];
}

/**
 * Title Case for display (pet names, person names, breeds, etc.).
 * Does not mutate stored/API values — apply only when rendering UI text.
 */
export function titleCase(v: string | null | undefined): string {
  const raw = String(v || '').trim();
  if (!raw) return '';
  return raw
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      // Preserve hyphenated names: "mary-jane" → "Mary-Jane"
      return part
        .split('-')
        .map((w) => {
          if (!w) return w;
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join('-');
    })
    .join('');
}

/** Pet name for UI; empty → fallback. */
export function displayPetName(
  name: string | null | undefined,
  fallback = 'Pet',
): string {
  return titleCase(name) || fallback;
}

export function doctorLabel(name: string | null | undefined): string {
  let n = String(name || '').trim();
  if (!n) return '';
  n = n.replace(/^(Dr\.?\s*)+/i, '').trim();
  return n ? `Dr. ${n}` : '';
}

export function petInitial(name: string | null | undefined): string {
  const n = String(name || '?').trim();
  return (n.charAt(0) || '?').toUpperCase();
}

/** Pull vaccination rows from timeline visits when the dedicated endpoint is empty. */
export function vaccinationsFromTimeline(timeline: any): any[] {
  const events = asList(timeline?.events, ['events']);
  const out: any[] = [];
  for (const e of events) {
    const reason = String(e?.reason || '');
    const title = String(e?.title || '');
    const treatments = asList(e?.treatments);
    const vaxTreatments = treatments.filter((t) => /vaccin|immuni|rabies|dhpp|bordetella/i.test(String(t?.name || '')));
    const looksLikeVax = /vaccin|immuni/i.test(reason) || /vaccin|immuni/i.test(title) || vaxTreatments.length > 0;
    if (!looksLikeVax) continue;

    if (vaxTreatments.length) {
      for (const t of vaxTreatments) {
        out.push({
          id: t.id || `${e.displayId}-vax-${t.name}`,
          vaccineName: t.name || 'Vaccination',
          givenOn: String(e.date || '').slice(0, 10) || null,
          nextDueOn: t.nextDueOn || null,
          providerName: doctorLabel(e.doctorName),
          notes: t.instructions || e.summary || '',
          source: 'visit',
          visitId: e.displayId,
        });
      }
    } else {
      out.push({
        id: `visit-vax-${e.displayId || e.id}`,
        vaccineName: reason.replace(/^vaccination[:\s-]*/i, '').trim() || 'Vaccination',
        givenOn: String(e.date || '').slice(0, 10) || null,
        nextDueOn: null,
        providerName: doctorLabel(e.doctorName),
        notes: e.summary || `Recorded from home visit${e.displayId ? ` ${e.displayId}` : ''}.`,
        source: 'visit',
        visitId: e.displayId,
      });
    }
  }
  return out;
}

/** Pull conditions from diagnoses on timeline visits. */
export function conditionsFromTimeline(timeline: any): any[] {
  const events = asList(timeline?.events, ['events']);
  const out: any[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    for (const d of asList(e?.diagnoses)) {
      const name = String(d?.diagnosis || d?.name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: d.id || `${e.displayId}-${key}`,
        name,
        status: String(d?.kind || d?.status || 'active').replace(/_/g, ' '),
        firstDiagnosedOn: String(e.date || '').slice(0, 10) || null,
        customerVisibleNotes: e.summary || '',
        source: 'visit',
        visitId: e.displayId,
      });
    }
    // Chief complaint as soft condition hint when no formal diagnoses
    const reason = String(e?.reason || '').trim();
    if (!asList(e?.diagnoses).length && reason && !/vaccin|checkup|wellness|follow.?up/i.test(reason)) {
      const key = reason.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          id: `reason-${e.displayId || e.id}`,
          name: reason.charAt(0).toUpperCase() + reason.slice(1),
          status: 'from visit',
          firstDiagnosedOn: String(e.date || '').slice(0, 10) || null,
          customerVisibleNotes: e.summary || 'Noted as the reason for a completed visit.',
          source: 'visit',
          visitId: e.displayId,
        });
      }
    }
  }
  return out;
}

/** Build care-plan-like cards from follow-ups and treatment instructions. */
export function carePlansFromTimeline(timeline: any): any[] {
  const events = asList(timeline?.events, ['events']);
  const followUps = asList(timeline?.upcomingFollowUps, ['upcomingFollowUps', 'followUps']);
  const out: any[] = [];

  if (followUps.length) {
    out.push({
      id: 'derived-followups',
      title: 'Follow-up care',
      status: 'active',
      goals: 'Next steps shared after your visits.',
      instructions: '',
      source: 'visit',
      items: followUps.map((f: any, i: number) => ({
        id: f.id || `fu-${i}`,
        title: f.reason || 'Recheck',
        status: 'pending',
        details: f.instructions || '',
        dueOn: String(f.dueAt || '').slice(0, 10) || null,
      })),
    });
  }

  for (const e of events) {
    const treatments = asList(e?.treatments).filter((t) => t?.instructions || t?.name);
    const hasPlanBits = treatments.length || e?.summary;
    if (!hasPlanBits) continue;
    // Skip pure vaccination visits without extra instructions
    const reason = String(e?.reason || '');
    if (/vaccin/i.test(reason) && !treatments.some((t) => t?.instructions) && !e?.summary) continue;

    out.push({
      id: `plan-${e.displayId || e.id}`,
      title: e.title || 'Visit care plan',
      status: /complet/i.test(String(e.status || '')) ? 'completed' : 'active',
      goals: e.summary || reason || '',
      instructions: '',
      visitId: e.displayId,
      source: 'visit',
      items: treatments.map((t: any, i: number) => ({
        id: t.id || `t-${e.displayId}-${i}`,
        title: t.name || 'Treatment',
        status: 'pending',
        details: t.instructions || '',
        dueOn: null,
      })),
    });
  }

  return out;
}

/** Virtual clinical documents from completed visits (summaries / prescriptions). */
export function documentsFromTimeline(timeline: any, petName?: string): any[] {
  const events = asList(timeline?.events, ['events']);
  const out: any[] = [];
  for (const e of events) {
    const date = String(e.date || '').slice(0, 10);
    const visitId = e.displayId || e.id;
    if (!visitId) continue;
    out.push({
      id: `visit-doc-${visitId}`,
      fileName: `Visit summary · ${e.title || e.reason || visitId}`,
      category: 'visit_summary',
      createdAt: date,
      petName: petName || timeline?.pet?.name || '',
      kind: 'link',
      link: ['/visits', visitId],
      source: 'visit',
    });
    const hasRx =
      e.prescription ||
      e.hasPrescription ||
      asList(e?.prescription?.items).length > 0 ||
      /prescription|rx|medicine|meds/i.test(String(e.summary || ''));
    if (hasRx || asList(e.treatments).some((t) => /med|dose|tablet|syrup/i.test(String(t?.name || '')))) {
      out.push({
        id: `rx-doc-${visitId}`,
        fileName: `Prescription · ${date || visitId}`,
        category: 'prescription',
        createdAt: date,
        petName: petName || timeline?.pet?.name || '',
        kind: 'link',
        link: ['/visits', visitId],
        source: 'visit',
      });
    }
  }
  return out;
}

export function isPetPhotoDoc(d: any): boolean {
  const cat = String(d?.category || d?.type || '').toLowerCase();
  const name = String(d?.fileName || d?.name || '').toLowerCase();
  return /pet_?photo|avatar|profile.?photo|profile.?image/.test(cat) || /pet.?photo/.test(name);
}

/** Soft reminders from follow-ups and vaccination visits when API list is empty. */
export function remindersFromTimeline(timeline: any): any[] {
  const out: any[] = [];
  const followUps = asList(timeline?.upcomingFollowUps, ['upcomingFollowUps', 'followUps']);
  for (const f of followUps) {
    out.push({
      id: f.id || `fu-rem-${f.dueAt}`,
      kind: 'follow_up',
      title: f.reason || 'Follow-up visit',
      body: f.instructions || 'Recheck recommended after your recent visit.',
      dueAt: f.dueAt || null,
      status: 'open',
      source: 'visit',
      derived: true,
    });
  }

  const events = asList(timeline?.events, ['events']);
  for (const e of events) {
    const reason = String(e?.reason || '');
    const title = String(e?.title || '');
    const treatments = asList(e?.treatments);
    const looksLikeVax =
      /vaccin|immuni/i.test(reason) ||
      /vaccin|immuni/i.test(title) ||
      treatments.some((t) => /vaccin|immuni|rabies|dhpp/i.test(String(t?.name || '')));
    if (!looksLikeVax) continue;

    const given = String(e.date || '').slice(0, 10);
    let due: string | null = null;
    for (const t of treatments) {
      if (t?.nextDueOn) {
        due = String(t.nextDueOn).slice(0, 10);
        break;
      }
    }
    if (!due && given) {
      const d = new Date(`${given}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setFullYear(d.getFullYear() + 1);
        due = d.toISOString().slice(0, 10);
      }
    }
    const vaxName =
      treatments.find((t) => /vaccin|immuni|rabies|dhpp/i.test(String(t?.name || '')))?.name ||
      reason.replace(/^vaccination[:\s-]*/i, '').trim() ||
      'Vaccination';
    out.push({
      id: `vax-rem-${e.displayId || e.id}`,
      kind: 'vaccination',
      title: `${vaxName} booster`,
      body: given
        ? `Last recorded around ${given}. Ask your vet when the next dose is due.`
        : 'Schedule the next vaccine dose with your care team.',
      dueAt: due,
      status: 'open',
      source: 'visit',
      derived: true,
      visitId: e.displayId,
    });
  }
  return out;
}

export function parsePetWeight(raw: string | null | undefined): { value: number; unit: string } | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/([\d.]+)\s*(kg|kgs|lb|lbs)?/i);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = (m[2] || 'kg').toLowerCase();
  const unit = u.startsWith('lb') ? 'lbs' : 'kg';
  return { value, unit };
}
