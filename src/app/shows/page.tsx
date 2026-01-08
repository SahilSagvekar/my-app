import { Navigation } from '@/components/landing/Navigation';
import { OriginalShows } from '@/components/landing/OriginalShows';
import { Footer } from '@/components/landing/Footer';

export default function OriginalShowsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="pt-16">
        <OriginalShows />
      </div>
      <Footer />
    </div>
  );
}


