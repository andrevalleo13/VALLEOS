import { DashboardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <DashboardSkeleton title={120} kpis={5} charts={2} />;
}
