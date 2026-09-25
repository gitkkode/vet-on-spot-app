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
          <span class="brand__mark">VetonSpot</span>
          <span class="brand__sub">Pet Parent Portal</span>
        </a>
        <a class="back" [routerLink]="backLink()">← {{ backLabel() }}</a>
      </header>

      <article class="doc">
        <p class="eyebrow">Legal</p>
        <h1>{{ title() }}</h1>
        <p class="lede">{{ lede() }}</p>
        <p class="updated">Last updated: {{ updated }}</p>

        @for (section of sections(); track section.heading) {
          <section>
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
      </article>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh;
      background:
        radial-gradient(ellipse 80% 50% at 10% -10%, rgba(253, 74, 41, 0.08), transparent 55%),
        radial-gradient(ellipse 60% 40% at 100% 0%, rgba(10, 10, 10, 0.04), transparent 50%),
        var(--vos-bg);
      color: var(--vos-ink);
    }
    .top {
      max-width: 820px;
      margin: 0 auto;
      padding: 22px var(--vos-gutter) 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand { text-decoration: none; color: inherit; }
    .brand__mark {
      display: block;
      font-family: var(--vos-display);
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -0.03em;
    }
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
      text-decoration: none;
      color: var(--vos-ink-muted);
      font-weight: 600;
      font-size: 0.92rem;
    }
    .back:hover { color: var(--vos-brand); }

    .doc {
      max-width: 820px;
      margin: 0 auto;
      padding: 28px var(--vos-gutter) 64px;
    }
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
      margin: 0 0 10px;
      font-family: var(--vos-display);
      font-size: clamp(1.75rem, 4vw, 2.35rem);
      letter-spacing: -0.04em;
      line-height: 1.15;
    }
    .lede {
      margin: 0 0 8px;
      color: var(--vos-ink-muted);
      font-size: 1.05rem;
      line-height: 1.5;
      max-width: 52ch;
    }
    .updated {
      margin: 0 0 28px;
      font-size: 0.85rem;
      color: var(--vos-ink-faint);
    }
    section { margin-bottom: 22px; }
    h2 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }
    section p {
      margin: 0 0 10px;
      color: var(--vos-ink-muted);
      line-height: 1.55;
    }
    .contact {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid var(--vos-border);
      color: var(--vos-ink-muted);
      line-height: 1.5;
    }
    .contact a {
      color: var(--vos-brand);
      font-weight: 600;
      text-decoration: none;
    }
    .contact a:hover { text-decoration: underline; }
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
