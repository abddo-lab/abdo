export default function Logo({ size = 22, radius }: { size?: number; radius?: number }) {
  const r = radius ?? 66;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      role="img"
      aria-label="Caret Labs"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="tcaret" x1="128" y1="0" x2="128" y2="256" gradientUnits="userSpaceOnUse">
          <stop stopColor="#212429" />
          <stop offset=".55" stopColor="#131518" />
          <stop offset="1" stopColor="#0a0b0c" />
        </linearGradient>
        <linearGradient id="gcaret" x1="80" y1="70" x2="200" y2="190" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e6e9ec" />
          <stop offset="1" stopColor="#7d848b" />
        </linearGradient>
        <linearGradient id="scaret" x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity=".07" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="256" height="256" rx={r} fill="url(#tcaret)" />
      <rect x="0" y="0" width="256" height="256" rx={r} fill="url(#scaret)" />
      <rect x="1" y="1" width="254" height="254" rx={r - 1} fill="none" stroke="#3a3f45" strokeOpacity=".55" strokeWidth="2" />
      <path d="M92 82 L142 128 L92 174" fill="none" stroke="url(#gcaret)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="152" y="163" width="52" height="21" rx="10.5" fill="url(#gcaret)" />
    </svg>
  );
}
