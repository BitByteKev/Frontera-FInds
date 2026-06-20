// The Agave Star — Frontera Finds primary mark.
// A top-down agave rosette of twelve radial leaves that also reads as a
// starburst "X marks the spot." Default colors are the light-on-dark variant
// used on the agave-green header/footer; pass props for other surfaces.
export default function AgaveMark({
  size = 32,
  outer = "#8FE6A3",
  inner = "#5BD074",
  core = "#E2A33C",
}: {
  size?: number;
  outer?: string;
  inner?: string;
  core?: string;
}) {
  const leaves = Array.from({ length: 12 }, (_, i) => i);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ display: "block", overflow: "visible", flex: "none" }}
      aria-hidden="true"
    >
      {leaves.map((i) => (
        <polygon
          key={`o${i}`}
          points="50,5 44,33 50,50 56,33"
          transform={`rotate(${i * 30} 50 50)`}
          fill={outer}
        />
      ))}
      {leaves.map((i) => (
        <polygon
          key={`n${i}`}
          points="50,24 46,41 50,50 54,41"
          transform={`rotate(${i * 30 + 15} 50 50)`}
          fill={inner}
        />
      ))}
      <circle cx="50" cy="50" r="4.2" fill={core} />
    </svg>
  );
}
