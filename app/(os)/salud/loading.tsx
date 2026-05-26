import { DashboardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <DashboardSkeleton title={150} hero kpis={4} charts={2} />;
}
