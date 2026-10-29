export default function TentacleFigure({ angle, caption }) {
  const bend = (angle - 90) / 90;
  const rad = (angle * Math.PI) / 180;
  const needleX = 120 + Math.cos(Math.PI - rad) * 34;
  const needleY = 120 - Math.sin(Math.PI - rad) * 34;

  const tentacles = Array.from({ length: 8 }, (_, index) => {
    const direction = (Math.PI * 2 * index) / 8 - Math.PI / 2;
    const baseX = 120 + Math.cos(direction) * 26;
    const baseY = 120 + Math.sin(direction) * 26;
    const tipX = 120 + Math.cos(direction) * 104;
    const tipY = 120 + Math.sin(direction) * 104;
    const sideX = -Math.sin(direction);
    const sideY = Math.cos(direction);
    const controlX = 120 + Math.cos(direction) * 66 + sideX * bend * 36;
    const controlY = 120 + Math.sin(direction) * 66 + sideY * bend * 36;
    return {
      index,
      tipX,
      tipY,
      d: `M ${baseX.toFixed(1)} ${baseY.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`,
    };
  });

  return (
    <figure className="m-0">
      <svg
        aria-hidden="true"
        viewBox="0 0 240 240"
        className="mx-auto h-auto w-full max-w-[280px]"
      >
        <path
          d="M 78 120 A 42 42 0 0 0 162 120"
          fill="none"
          stroke="#d2c7b4"
          strokeWidth="2"
        />
        {tentacles.map((tentacle) => (
          <g key={tentacle.index}>
            <path
              d={tentacle.d}
              fill="none"
              stroke="#1b1814"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx={tentacle.tipX} cy={tentacle.tipY} r="3.5" fill="#b45324" />
          </g>
        ))}
        <circle cx="120" cy="120" r="22" fill="#1b1814" />
        <line
          x1="120"
          y1="120"
          x2={needleX}
          y2={needleY}
          stroke="#f7f3ea"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="120" cy="120" r="4" fill="#b45324" />
      </svg>
      <figcaption className="mt-3 text-center text-sm leading-6 text-ink-soft">
        {caption}
      </figcaption>
    </figure>
  );
}
