import { DashboardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <DashboardSkeleton title={110} kpis={4} charts={2} />;
}
