import { DashboardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <DashboardSkeleton title={200} kpis={5} charts={1} />;
}
