export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M29 9a14 14 0 1 0 0 22"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path
        d="M25 15a7 7 0 1 0 0 10"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity=".5"
      />
      <circle cx="31" cy="20" r="3" fill="currentColor" />
    </svg>
  );
}
