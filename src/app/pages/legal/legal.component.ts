import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type DocKind = 'privacy' | 'terms';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-legal',
  template: `
    <div class="page">
      <header class="top">
        <a routerLink="/" class="brand">
          <span class="brand__mark">Vetonsp<span class="o">●</span>t</span>
          <span class="brand__sub">Pet Parent Portal</span>
        </a>
        <a class="back" [routerLink]="backLink()">
          <span class="back__chev" aria-hidden="true">‹</span>
          {{ backLabel() }}
        </a>
      </header>

      <div class="frame">
        <article class="doc">
          <aside class="rail">
            <p class="eyebrow">Legal</p>
            <h1>{{ title() }}</h1>
            <p class="updated">Last updated {{ updated }}</p>
            <nav class="toc" [attr.aria-label]="title()">
              @for (section of sections(); track section.heading) {
                <a [href]="'#' + slug(section.heading)">{{ section.heading }}</a>
              }
            </nav>
          </aside>

          <div class="body">
            <p class="lede">{{ lede() }}</p>
            @for (section of sections(); track section.heading) {
              <section [id]="slug(section.heading)">
                <h2>{{ section.heading }}</h2>
                @for (p of section.paragraphs; track $index) {
                  <p>{{ p }}</p>
                }
              </section>
            }
            <p class="contact">
              Questions? Reach us at
              <a href="mailto:hello@vetonspot.com">hello@vetonspot.com</a>
              or through
              <a routerLink="/support">Support</a>
              in the portal.
            </p>
          </div>
        </article>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; }
    .page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      color: var(--vos-ink);
      font-family: var(--vos-font);
      background:
        radial-gradient(ellipse 55% 32% at 100% 0%, rgba(253, 74, 41, 0.06) 0%, transparent 60%),
        var(--vos-bg);
    }
    .top, .frame {
      width: 100%;
      max-width: var(--vos-max);
      margin: 0 auto;
      padding-left: var(--vos-gutter);
      padding-right: var(--vos-gutter);
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-top: 18px;
      padding-bottom: 14px;
    }
    .brand { text-decoration: none; color: inherit; }
    .brand__mark {
      display: block;
      font-family: var(--vos-display);
      font-weight: 700;
      font-size: 1.35rem;
      letter-spacing: -0.04em;
    }
    .brand__mark .o { color: var(--vos-brand); }
    .brand__sub {
      display: block;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      margin-top: 2px;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 14px 0 8px;
      border-radius: 999px;
      border: 1px solid var(--vos-border);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 4px 14px rgba(10, 10, 10, 0.04);
      color: var(--vos-ink);
      text-decoration: none;
      font-weight: 700;
      font-size: 0.92rem;
    }
    .back:hover { border-color: rgba(253, 74, 41, 0.28); }
    .back__chev {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(145deg, #fff 0%, var(--vos-brand-soft) 100%);
      border: 1px solid rgba(253, 74, 41, 0.18);
      color: var(--vos-brand);
      font-size: 15px;
      line-height: 1;
      font-weight: 800;
    }

    .frame {
      flex: 1;
      display: flex;
      padding-bottom: 28px;
    }
    .doc {
      flex: 1;
      width: 100%;
      display: grid;
      grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
      gap: 28px;
      align-items: start;
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 28px;
      box-shadow: var(--vos-shadow-sm);
      padding: 28px 28px 32px;
    }
    .rail { position: sticky; top: 18px; }
    .eyebrow {
      margin: 0 0 8px;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--vos-brand);
      font-weight: 700;
    }
    h1 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: clamp(1.7rem, 3vw, 2.2rem);
      letter-spacing: -0.04em;
      line-height: 1.1;
    }
    .updated {
      margin: 0 0 16px;
      font-size: 0.85rem;
      color: var(--vos-ink-faint);
    }
    .toc { display: grid; gap: 6px; }
    .toc a {
      color: var(--vos-ink-muted);
      text-decoration: none;
      font-weight: 650;
      font-size: 0.92rem;
      line-height: 1.35;
      padding: 8px 10px;
      border-radius: 12px;
    }
    .toc a:hover { background: var(--vos-brand-soft); color: var(--vos-brand); }

    .lede {
      margin: 0 0 22px;
      color: var(--vos-ink-muted);
      font-size: 1.05rem;
      line-height: 1.5;
    }
    section {
      margin: 0 0 14px;
      padding: 16px 18px;
      border-radius: 18px;
      background: var(--vos-bg-accent);
      border: 1px solid var(--vos-border);
    }
    h2 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: 1.12rem;
      letter-spacing: -0.02em;
    }
    section p {
      margin: 0 0 10px;
      color: var(--vos-ink-muted);
      line-height: 1.6;
    }
    section p:last-child { margin-bottom: 0; }
    .contact {
      margin: 8px 0 0;
      padding: 16px 18px;
      border-radius: 18px;
      border: 1px solid var(--vos-border);
      color: var(--vos-ink-muted);
      line-height: 1.5;
    }
    .contact a {
      color: var(--vos-brand);
      font-weight: 700;
      text-decoration: none;
    }
    .contact a:hover { text-decoration: underline; }

    @media (max-width: 800px) {
      .doc {
        grid-template-columns: 1fr;
        padding: 20px 16px 24px;
        border-radius: 22px;
      }
      .rail { position: static; }
    }
  `],
})
export class LegalComponent implements OnInit {
  readonly updated = 'September 2026';
  private readonly kind = signal<DocKind>('privacy');
  readonly title = signal('Privacy Policy');
  readonly lede = signal('');
  readonly sections = signal<{ heading: string; paragraphs: string[] }[]>([]);
  readonly backLink = signal<string[]>(['/']);
  readonly backLabel = signal('Home');

  constructor(private route: ActivatedRoute) {}

  slug(heading: string): string {
    return String(heading || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  ngOnInit(): void {
    const doc = (this.route.snapshot.data['doc'] as DocKind) || 'privacy';
    this.kind.set(doc);
    if (doc === 'terms') {
      this.title.set('Terms of Service');
      this.lede.set('The rules that apply when you use the VetonSpot Pet Parent Portal and related care services.');
      this.sections.set(TERMS);
    } else {
      this.title.set('Privacy Policy');
      this.lede.set('How VetonSpot collects, uses, and protects information about you and your pets.');
      this.sections.set(PRIVACY);
    }

    const from = this.route.snapshot.queryParamMap.get('from');
    if (from === 'login') {
      this.backLink.set(['/login']);
      this.backLabel.set('Sign in');
    } else if (from === 'landing') {
      this.backLink.set(['/']);
      this.backLabel.set('Home');
    } else if (from === 'settings' || from === 'profile') {
      this.backLink.set(['/' + from]);
      this.backLabel.set(from === 'settings' ? 'Settings' : 'Profile');
    }
  }
}

const PRIVACY: { heading: string; paragraphs: string[] }[] = [
  {
    heading: 'What we collect',
    paragraphs: [
      'We collect account details you provide (such as name, phone, email, and addresses), pet profiles, booking and visit history, health records you add or that clinicians record during care, support messages, and basic device or usage data needed to run the portal securely.',
    ],
  },
  {
    heading: 'How we use information',
    paragraphs: [
      'We use this information to schedule and deliver veterinary visits, tele-vet, and related services; send visit updates and care reminders you opt into; improve product reliability and safety; and meet legal or regulatory obligations.',
      'We do not sell your personal information. Marketing messages are optional and can be turned off in Settings.',
    ],
  },
  {
    heading: 'Sharing',
    paragraphs: [
      'Care teams and partner clinicians involved in your booking may access the information needed to treat your pet. Service providers who host, message, or process payments for us may process data under contract. We may disclose information when required by law or to protect safety.',
    ],
  },
  {
    heading: 'Retention & security',
    paragraphs: [
      'We retain records as long as needed for care continuity, account history, and legal requirements. We use industry-standard safeguards to protect data in transit and at rest, though no system can be guaranteed fully secure.',
    ],
  },
  {
    heading: 'Your choices',
    paragraphs: [
      'You can update profile and notification preferences in the portal, request access or correction of your data, or ask us to delete account information where legally allowed. Some care records may need to be retained for clinical or legal reasons.',
    ],
  },
];

const TERMS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: 'Using VetonSpot',
    paragraphs: [
      'By creating an account or booking care, you agree to use the Pet Parent Portal lawfully and accurately. You are responsible for keeping login credentials secure and for information you submit about yourself and your pets.',
    ],
  },
  {
    heading: 'Services & clinical care',
    paragraphs: [
      'VetonSpot facilitates veterinary services. Clinical decisions are made by licensed professionals. Tele-vet and remote advice are not a substitute for emergency care or an in-person exam when clinically required.',
      'Availability of visits, diagnostics, pharmacy, and other services may vary by location and capacity.',
    ],
  },
  {
    heading: 'Bookings, fees & cancellations',
    paragraphs: [
      'Booking details, fees, and cancellation or reschedule rules are shown during checkout or in your appointment confirmation. Missed visits or late changes may incur fees as disclosed at booking.',
    ],
  },
  {
    heading: 'Acceptable use',
    paragraphs: [
      'You may not misuse the portal, attempt unauthorized access, upload harmful content, or use the service for anything other than legitimate pet care coordination.',
    ],
  },
  {
    heading: 'Limitation of liability',
    paragraphs: [
      'To the fullest extent permitted by law, VetonSpot is not liable for indirect or consequential damages arising from portal use. Nothing in these terms limits liability that cannot be limited under applicable law.',
    ],
  },
  {
    heading: 'Changes',
    paragraphs: [
      'We may update these terms as services evolve. Continued use after changes means you accept the updated terms. Material updates will be reflected on this page with a revised date.',
    ],
  },
];
