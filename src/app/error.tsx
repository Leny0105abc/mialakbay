'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container page-content">
      <div className="empty-state">
        <h2>A little detour.</h2>
        <p>We couldn’t load this page. Please try again.</p>
        <button className="btn primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
