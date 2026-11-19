export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
      <circle cx="32" cy="32" r="28" />
      <path d="M26 41a6 6 0 0 1 12 0" />
      <path d="M5.5 42h53M8.5 48h47M13 54h38" />
    </svg>
  );
}
