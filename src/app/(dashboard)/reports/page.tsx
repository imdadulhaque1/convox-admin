import { PageHeader } from "@/components/PageHeader";
import { ReportsTable } from "@/components/ReportsTable";

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Reports"
        description="Everything users have reported, across the whole app — review and resolve each one."
      />
      <ReportsTable showReported />
    </div>
  );
}
