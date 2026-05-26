export function Skeleton({
  w = "100%",
  h = 14,
  r = 6,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: React.CSSProperties;
}) {
  return <span className="skeleton-block" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function SkelKpi() {
  return (
    <div className="card">
      <Skeleton w={90} h={10} style={{ marginBottom: 10 }} />
      <Skeleton w={120} h={22} />
    </div>
  );
}

export function DashboardSkeleton({
  eyebrow = 110,
  title = 220,
  kpis = 4,
  hero = false,
  charts = 2,
}: {
  eyebrow?: number;
  title?: number;
  kpis?: number;
  hero?: boolean;
  charts?: number;
}) {
  return (
    <div>
      <div className="page-header">
        <Skeleton w={eyebrow} h={10} style={{ marginBottom: 12 }} />
        <Skeleton w={title} h={34} r={8} />
      </div>

      <div className="page-body">
        {hero && (
          <div className="card mb-6">
            <Skeleton w={120} h={10} style={{ marginBottom: 12 }} />
            <Skeleton w={260} h={40} r={10} />
          </div>
        )}

        {kpis > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
            {Array.from({ length: kpis }).map((_, i) => (
              <SkelKpi key={i} />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: charts }).map((_, i) => (
            <div key={i} className="card">
              <Skeleton w={140} h={10} style={{ marginBottom: 18 }} />
              <Skeleton w="100%" h={180} r={10} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
