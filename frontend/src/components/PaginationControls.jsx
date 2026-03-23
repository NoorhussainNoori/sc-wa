export default function PaginationControls({
  count,
  currentPage,
  pageSize,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}) {
  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));

  return (
    <div className="pagination-controls">
      <div className="pagination-meta">
        Page {currentPage} of {totalPages} ({count || 0} total)
      </div>
      <div className="pagination-actions">
        <button
          className="button button-outline"
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
        >
          Previous
        </button>
        <button
          className="button button-outline"
          type="button"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}

