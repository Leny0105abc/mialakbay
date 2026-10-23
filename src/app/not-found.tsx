import Link from 'next/link';
import { Compass } from 'lucide-react';
export default function NotFound() {
  return (
    <div className="container page-content">
      <div className="empty-state">
        <Compass size={42} />
        <span className="eyebrow">A LITTLE OFF THE BEATEN PATH</span>
        <h1 style={{ fontSize: 38 }}>This place isn’t on the map.</h1>
        <p>
          The page may have moved or the experience is no longer published. Let’s find somewhere
          new.
        </p>
        <Link className="btn primary" href="/packages">
          Explore experiences
        </Link>
      </div>
    </div>
  );
}
