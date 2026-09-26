/** Shared pet document categories for upload + grouping. */

export type PetDocCategoryId =
  | 'id'
  | 'photos'
  | 'past_reports'
  | 'vaccination'
  | 'prescription'
  | 'clinical'
  | 'other';

export interface PetDocCategory {
  id: PetDocCategoryId;
  label: string;
  hint: string;
  /** Accept attribute for file input */
  accept: string;
}

export const PET_DOC_CATEGORIES: PetDocCategory[] = [
  {
    id: 'id',
    label: 'ID & registration',
    hint: 'Pet ID, license, microchip certificate, registration papers',
    accept: 'image/*,.pdf,.jpg,.jpeg,.png,.webp',
  },
  {
    id: 'photos',
    label: 'Photos',
    hint: 'Extra photos of your pet (not the profile avatar)',
    accept: 'image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp',
  },
  {
    id: 'past_reports',
    label: 'Past reports',
    hint: 'Lab results, radiology, discharge summaries from other clinics',
    accept: 'image/*,.pdf,.jpg,.jpeg,.png,.webp',
  },
  {
    id: 'vaccination',
    label: 'Vaccination records',
    hint: 'Vaccine cards and immunization certificates',
    accept: 'image/*,.pdf,.jpg,.jpeg,.png,.webp',
  },
  {
    id: 'prescription',
    label: 'Prescriptions',
    hint: 'Rx slips and medication instructions from past care',
    accept: 'image/*,.pdf,.jpg,.jpeg,.png,.webp',
  },
  {
    id: 'clinical',
    label: 'Clinical notes',
    hint: 'Visit summaries and clinical files from VetOnSpot care',
    accept: 'image/*,.pdf,.jpg,.jpeg,.png,.webp',
  },
  {
    id: 'other',
    label: 'Other',
    hint: 'Anything else useful for the care team',
    accept: 'image/*,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp',
  },
];

const CATEGORY_ALIASES: Record<string, PetDocCategoryId> = {
  id: 'id',
  pet_id: 'id',
  identification: 'id',
  registration: 'id',
  license: 'id',
  microchip: 'id',
  photos: 'photos',
  photo: 'photos',
  pet_photo: 'photos',
  avatar: 'photos',
  profile_photo: 'photos',
  profile_image: 'photos',
  past_reports: 'past_reports',
  past_report: 'past_reports',
  report: 'past_reports',
  reports: 'past_reports',
  lab: 'past_reports',
  labs: 'past_reports',
  radiology: 'past_reports',
  discharge: 'past_reports',
  vaccination: 'vaccination',
  vaccine: 'vaccination',
  vaccines: 'vaccination',
  immunization: 'vaccination',
  prescription: 'prescription',
  prescriptions: 'prescription',
  rx: 'prescription',
  clinical: 'clinical',
  visit_summary: 'clinical',
  visit_summaries: 'clinical',
  summary: 'clinical',
  other: 'other',
  document: 'other',
  documents: 'other',
  file: 'other',
};

export function normalizeDocCategory(raw: unknown): PetDocCategoryId {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!key) return 'other';
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  if (/pet_?photo|avatar|profile.?photo|profile.?image|^photo/.test(key)) return 'photos';
  if (/vaccin|immuni/.test(key)) return 'vaccination';
  if (/prescription|rx|medicine/.test(key)) return 'prescription';
  if (/lab|radiolog|report|discharge|patholog/.test(key)) return 'past_reports';
  if (/id|license|registr|microchip|passport/.test(key)) return 'id';
  if (/visit|clinical|summary|care/.test(key)) return 'clinical';
  return 'other';
}

export function categoryLabel(id: PetDocCategoryId | string): string {
  const norm = normalizeDocCategory(id);
  return PET_DOC_CATEGORIES.find((c) => c.id === norm)?.label || 'Other';
}

export function groupDocumentsByCategory(docs: any[]): { category: PetDocCategory; items: any[] }[] {
  const buckets = new Map<PetDocCategoryId, any[]>();
  for (const cat of PET_DOC_CATEGORIES) buckets.set(cat.id, []);

  for (const d of docs || []) {
    const id = normalizeDocCategory(d?.category || d?.type || d?.kind);
    const list = buckets.get(id) || buckets.get('other')!;
    list.push({
      ...d,
      category: id,
      fileName: d?.fileName || d?.name || d?.originalName || 'Document',
    });
  }

  return PET_DOC_CATEGORIES.map((category) => ({
    category,
    items: buckets.get(category.id) || [],
  })).filter((g) => g.items.length > 0);
}

export const MAX_PET_DOC_BYTES = 10 * 1024 * 1024;

export function isAllowedPetDocument(file: File): boolean {
  if (!file) return false;
  if (file.size > MAX_PET_DOC_BYTES) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (type.startsWith('image/') || type === 'application/pdf') return true;
  if (/msword|officedocument|text\/plain/.test(type)) return true;
  return /\.(jpe?g|png|webp|gif|bmp|pdf|docx?|txt)$/i.test(name);
}
