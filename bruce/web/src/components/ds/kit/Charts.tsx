"use client";

import { useId, useState } from "react";
import type { Datum } from "@/lib/ds/series";

const W = 640;
const H = 180;
const PAD = { t: 12, r: 8, b: 22, l: 8 };

function gridLines(max: number, ticks = 4) {
  return Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * i);
}

/** Smooth path through points (Catmull-Rom -> cubic Bézier). */
function smooth(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}


export function BarChart({ data, barRatio = 0.55, title }: { data: Datum[]; barRatio?: number; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value)) * 1.1;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const step = iw / data.length;
  const bw = step * barRatio;
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-auto w-full">
        {gridLines(max).map((g) => {
          const y = PAD.t + ih - (g / max) * ih;
          return <line key={g} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#E6E7EA" strokeWidth="1" strokeDasharray="3 4" />;
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * ih;
          const x = PAD.l + i * step + (step - bw) / 2;
          const y = PAD.t + ih - h;
          return (
            <g key={d.label + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={PAD.l + i * step} y={PAD.t} width={step} height={ih} fill="transparent" />
              <rect x={x} y={y} width={bw} height={h} rx="1.5" fill="#2169E8" opacity={hover === null || hover === i ? 1 : 0.55} />
              {hover === i && (
                <g>
                  <rect x={Math.min(Math.max(x + bw / 2 - 26, 2), W - 54)} y={Math.max(y - 26, 0)} width="52" height="20" rx="3" fill="#14102A" />
                  <text x={Math.min(Math.max(x + bw / 2, 28), W - 28)} y={Math.max(y - 12, 14)} textAnchor="middle" fontSize="11" fill="#fff">
                    {d.value}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {data.map(
          (d, i) =>
            (data.length <= 14 || i % 3 === 0) && (
              <text key={"l" + i} x={PAD.l + i * step + step / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#7F8190">
                {d.label}
              </text>
            ),
        )}
      </svg>
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}

export function LineChart({ data, title, area = true, tooltip = true }: { data: Datum[]; title: string; area?: boolean; tooltip?: boolean }) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value)) * 1.1;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const step = iw / (data.length - 1);
  const pts: [number, number][] = data.map((d, i) => [PAD.l + i * step, PAD.t + ih - (d.value / max) * ih]);
  const path = smooth(pts);
  const hp = hover !== null ? pts[hover] : null;

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-auto w-full" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2169E8" stopOpacity="0.22" />
            <stop offset="1" stopColor="#2169E8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines(max).map((g) => {
          const y = PAD.t + ih - (g / max) * ih;
          return <line key={g} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#E6E7EA" strokeWidth="1" strokeDasharray="3 4" />;
        })}
        {area && <path d={`${path} L ${pts[pts.length - 1][0]} ${PAD.t + ih} L ${pts[0][0]} ${PAD.t + ih} Z`} fill={`url(#${gid})`} />}
        <path d={path} fill="none" stroke="#2169E8" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {tooltip &&
          pts.map((p, i) => (
            <rect key={i} x={p[0] - step / 2} y={PAD.t} width={step} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        {hp && (
          <g pointerEvents="none">
            <line x1={hp[0]} x2={hp[0]} y1={PAD.t} y2={PAD.t + ih} stroke="#2169E8" strokeOpacity="0.4" strokeDasharray="2 3" />
            <circle cx={hp[0]} cy={hp[1]} r="4" fill="#fff" stroke="#2169E8" strokeWidth="2" />
            <rect x={Math.min(Math.max(hp[0] - 34, 2), W - 70)} y={Math.max(hp[1] - 34, 0)} width="68" height="22" rx="3" fill="#14102A" />
            <text x={Math.min(Math.max(hp[0], 36), W - 36)} y={Math.max(hp[1] - 19, 14)} textAnchor="middle" fontSize="11" fill="#fff">
              {data[hover!].label}: {data[hover!].value}
            </text>
          </g>
        )}
        {data.map(
          (d, i) =>
            i % Math.ceil(data.length / 10) === 0 && (
              <text key={"l" + i} x={pts[i][0]} y={H - 6} textAnchor="middle" fontSize="10" fill="#7F8190">
                {d.label}
              </text>
            ),
        )}
      </svg>
    </figure>
  );
}
