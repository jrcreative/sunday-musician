// Tiny stand-alone SVG sparkline. Pure server component — no state.

export function Sparkline({
  data,
  width = 140,
  height = 32,
  color = "var(--sm-accent)",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const linePath = `M ${points.join(" L ")}`;
  const fillPath = `${linePath} L ${width.toFixed(2)},${height} L 0,${height} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <path d={fillPath} fill={color} fillOpacity={0.08} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
