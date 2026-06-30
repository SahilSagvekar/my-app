import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';
import { E8AppHero } from '@/components/e8app/E8AppHero';
import { E8AppRoles } from '@/components/e8app/E8AppRoles';
import { E8AppFeatures } from '@/components/e8app/E8AppFeatures';
import { E8AppCTA } from '@/components/e8app/E8AppCTA';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'E8 App — The Platform Powering Your Content',
  description:
    'One platform for clients, editors, and QC. Review videos, track tasks, manage billing, and monitor performance — all in one place.',
  pathname: '/e8-app',
});

export default function E8AppPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div>
        <E8AppHero />
        <E8AppRoles />
        <E8AppFeatures />
        <E8AppCTA />
      </div>
      <Footer />
    </div>
  );
}
