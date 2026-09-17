export function LoadMoreButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex justify-center py-4">
      <button
        onClick={onClick}
        disabled={loading}
        className="focus-ring rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}
