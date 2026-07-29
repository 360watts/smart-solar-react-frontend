import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }
  return (
    <div className="sq-pagination">
      <button className="sq-page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft style={{ width: 14, height: 14 }} />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="sq-page-ellipsis">…</span>
        ) : (
          <button key={p} className={`sq-page-btn ${page === p ? 'active' : ''}`} onClick={() => onChange(p as number)}>{p}</button>
        )
      )}
      <button className="sq-page-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        <ChevronRight style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
