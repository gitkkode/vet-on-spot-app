import { Pipe, PipeTransform } from '@angular/core';
import { titleCase } from '../utils/health-records';

/**
 * Display helper: Title Case for names and short labels.
 * Keep form inputs as the user typed them; use this only for display.
 */
@Pipe({ name: 'vosTitleCase', standalone: true, pure: true })
export class VosTitleCasePipe implements PipeTransform {
  transform(value: string | null | undefined, fallback = ''): string {
    return titleCase(value) || fallback;
  }
}
