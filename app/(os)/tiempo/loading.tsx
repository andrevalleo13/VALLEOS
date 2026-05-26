import { DashboardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <DashboardSkeleton title={150} kpis={5} charts={2} />;
}
