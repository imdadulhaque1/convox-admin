/**
 * Shared card + scroll wrapper for every data table in the panel. `overflow-auto` on the
 * inner div gives both axes at once — horizontal so a wide table doesn't force the whole
 * page to scroll sideways on a phone, vertical (capped at `maxHeight`) so a long list
 * scrolls inside its own card with the header pinned, instead of pushing page chrome like
 * filters/tabs off-screen. Pair with `stickyThead` (see the `<thead>` in each table) and a
 * `min-w-[…]` on the `<table>` so columns don't get crushed before the scrollbar kicks in.
 */
export function TableScroll({
  children,
  maxHeight = "70vh",
}: {
  children: React.ReactNode;
  maxHeight?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="overflow-auto" style={{ maxHeight }}>
        {children}
      </div>
    </div>
  );
}

/** Classes for every table's <thead> so it stays pinned while TableScroll's container
 *  scrolls vertically underneath it. Slightly translucent + blurred so scrolled rows
 *  don't show through the gaps between header cells. */
export const STICKY_THEAD =
  "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur text-xs font-medium uppercase tracking-wide text-slate-500";
