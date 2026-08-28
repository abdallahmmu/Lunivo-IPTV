import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LoginDialog } from '../../shared/components/login-dialog/login-dialog';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';

interface Feature {
  title: string;
  description: string;
  icon: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Live TV',
    description: 'Every channel your provider offers, browsable by category and ready to watch instantly.',
    icon: 'M4 6h16v11H4zM8 20h8M12 17v3',
  },
  {
    title: 'Movies & Series',
    description: 'A real catalog with posters, ratings, and full season/episode browsing — not a flat file list.',
    icon: 'M4 5h16v12H4zM8 21h8M9 8l5 3-5 3z',
  },
  {
    title: 'One Player. Every Stream.',
    description: 'Adaptive HLS playback with quality switching, resume, and picture-in-picture, built in.',
    icon: 'M8 5v14l11-7z',
  },
  {
    title: 'Your Data Stays Yours',
    description: 'No backend, no accounts to make. Lunivo talks directly to your server from your browser.',
    icon: 'M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.6 6.6 4.6 5.1c2.4-1.2 5 .1 7.4 3 2.4-2.9 5-4.2 7.4-3 3 1.5 3.6 5 1.9 7.7C18.7 16.65 12 21 12 21z',
  },
];

@Component({
  selector: 'app-landing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoginDialog, LogoMark],
  templateUrl: './landing-page.html',
})
export class LandingPage {
  protected readonly features = FEATURES;
  protected readonly showDialog = signal(false);
}
