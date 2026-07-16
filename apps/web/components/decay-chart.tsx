// Reusable premium-decay chart. The curve is illustrative (premium halves each
// day over 21 days); the authoritative price is always a contract read (rentPrice).

export default function DecayChart({
  nowDay = 13,
  height = 200,
  showMarker = true,
}: {
  nowDay?: number;
  height?: number;
  showMarker?: boolean;
}) {
  const W = 620;
  const H = height;
  const PAD = 12;
  const DAYS = 21;

  const x = (d: number) => PAD + (d / DAYS) * (W - 2 * PAD);
  const val = (d: number) => Math.pow(0.5, d);
  const y = (d: number) => PAD + (1 - val(d)) * (H - 2 * PAD);

  const pts = Array.from({ length: DAYS + 1 }, (_, d) => [x(d), y(d)] as const);
  const line = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${x(DAYS).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Premium price decay curve">
      <defs>
        <linearGradient id="dc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6bff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#2f6bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={PAD + f * (H - 2 * PAD)} y2={PAD + f * (H - 2 * PAD)} stroke="#eef1f7" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#dc-fill)" />
      <path d={line} fill="none" stroke="#2f6bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {showMarker && (
        <>
          <line x1={x(nowDay)} x2={x(nowDay)} y1={y(nowDay)} y2={H - PAD} stroke="#2f6bff" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.5" />
          <circle cx={x(nowDay)} cy={y(nowDay)} r="6" fill="#fff" stroke="#2f6bff" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}
