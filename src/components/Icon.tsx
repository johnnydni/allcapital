import type { JSX } from "react";

/**
 * Line icons on a 24 grid. These are hand-drawn approximations of the Figma
 * icons and should be replaced by the exported originals.
 */
const P: Record<string, JSX.Element> = {
  arrowRight: <><circle cx="12" cy="12" r="10" /><path d="M7 12h10M13 8l4 4-4 4" /></>,
  arrowLeft: <><circle cx="12" cy="12" r="10" /><path d="M17 12H7M11 8l-4 4 4 4" /></>,
  user: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="9.5" r="3.5" /><path d="M5.5 19.5c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5" /></>,
  userAdd: <><circle cx="10" cy="8" r="4.5" /><path d="M2.5 21c.8-4.5 3.7-7 7.5-7 1.3 0 2.4.3 3.4.8" /><circle cx="17.5" cy="17.5" r="4.5" /><path d="M17.5 15.5v4M15.5 17.5h4" /></>,
  close: <><circle cx="12" cy="12" r="11" fill="currentColor" stroke="none" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth="2" /></>,
  person: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.6-4 3.1-6 6.5-6s5.9 2 6.5 6" /></>,
  mail: <><rect x="3.5" y="6" width="17" height="12" rx="1.5" /><path d="M4 7l8 6 8-6" /></>,
  phone: <><rect x="7.5" y="3" width="9" height="18" rx="2" /><path d="M11 18h2" /></>,
  lock: <><rect x="5.5" y="10.5" width="13" height="9.5" rx="1.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.6" />,
  chevronLeft: <path d="M15.5 3.5L7 12l8.5 8.5" strokeWidth="1.6" />,
  gear: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  plus: <path d="M12 6v12M6 12h12" strokeWidth="1.8" />,
  play: <path d="M7 4l13 8-13 8z" fill="currentColor" />,
  hub: <><circle cx="12" cy="12" r="6" /><path d="M8 13.5c1.2-2.5 2.6-2.5 4 0s2.8 2.5 4 0M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4" /></>,
  tutorial: <><circle cx="9" cy="8" r="4" fill="currentColor" /><path d="M2 22c.5-5.5 3-8 7-8s6.5 2.5 7 8z" fill="currentColor" /><path d="M17 3.5c2-1 3.5.5 2.5 2-.6.9-1.5 1-1.5 2.3M18 10v.2" /></>,
  // onboarding: position
  pupil: <><circle cx="12" cy="5.5" r="2" /><path d="M12 8v8M9.5 21l2.5-5 2.5 5M9 11.5l3-1.5 3 1.5" /></>,
  student: <><path d="M3 9l9-4 9 4-9 4z" /><path d="M7 11.5V16c1.5 1.5 8.5 1.5 10 0v-4.5M21 9v5" /></>,
  worker: <><circle cx="10" cy="7.5" r="3" /><path d="M3.5 20c.5-4 3-6 6.5-6 1.2 0 2.2.2 3.1.7" /><rect x="13.5" y="15" width="7.5" height="5.5" rx="1" /><path d="M16 15v-1.5h2.5V15" /></>,
  retired: <><circle cx="11" cy="5" r="2" /><path d="M11 7.5V15M11 15l-2.5 6M11 15l2.5 6M11 10.5l4 2M16 11v10" /></>,
  // onboarding: assets
  bank: <><rect x="2.5" y="6" width="9" height="12" rx="1" /><path d="M8.5 9.5c-2.5-1-4 .5-4 2.5s1.5 3.5 4 2.5M4 11.5h3M4 13h3" /><path d="M13.5 18h8M14 10l3.8-3 3.7 3zM15 10.5V17M17.8 10.5V17M20.5 10.5V17" /></>,
  stocks: <><path d="M4 19h16" /><path d="M5 15l4-4 3 2.5L18 7" /><path d="M6.5 19v-2M10 19v-4.5M13.5 19v-3M17 19v-7" /></>,
  crypto: <><circle cx="10" cy="14" r="6" /><path d="M9 11v6M9 11h1.5a1.5 1.5 0 0 1 0 3H9M9 14h2a1.5 1.5 0 0 1 0 3H9" /><path d="M12.5 4.8A6 6 0 0 1 19.3 14" /><path d="M9.5 6.2A6 6 0 0 1 17.8 11" opacity=".6" /></>,
  shield: <path d="M12 3l7.5 2.5v6c0 4.5-3 7.8-7.5 9.5-4.5-1.7-7.5-5-7.5-9.5v-6z" strokeWidth="1.7" />,
  property: <><path d="M10 20V10.5L15.5 6 21 10.5V20z" fill="currentColor" /><path d="M7 20c-3 0-4.5-2-4.5-4.2 0-1.8 1-3 2.3-3.6C5 9.5 6.5 8 8.5 8" strokeWidth="2.2" /><path d="M6.5 20v-5" /></>,
  mobility: <><circle cx="7" cy="6" r="2.2" /><circle cx="14" cy="6" r="2.2" /><path d="M7 6l3-3h2l2 3" /><path d="M3 19v-4l1.5-4h9L15 15v4zM3 15h12" /><circle cx="6" cy="17" r=".6" /><circle cx="12" cy="17" r=".6" /><path d="M17.5 20.5h4M20 20.5l-1.5-8" /></>,
  tech: <><rect x="3.5" y="5" width="17" height="11" rx="1.2" /><path d="M9 20h6M12 16v4" /></>,
  valuables: <><circle cx="9" cy="14" r="2.2" /><circle cx="15" cy="14" r="2.2" /><path d="M5.5 20h13M7 17.5h10" /><path d="M12 4v2M6.5 6l1.2 1.6M17.5 6l-1.2 1.6M3.5 10.5l2 .6M20.5 10.5l-2 .6" /></>,
  // onboarding: hobbies
  gaming: <><rect x="4" y="5" width="7" height="6" rx="1" /><path d="M6 8h3M7.5 6.5v3" /><circle cx="16" cy="6.5" r="1.3" fill="currentColor" /><circle cx="19" cy="9" r="1.3" fill="currentColor" /><path d="M5 15h5l1 4H4zM14 15h5l1 4h-7z" fill="currentColor" /></>,
  movies: <><rect x="4" y="7" width="10" height="8" rx="1" fill="currentColor" /><path d="M14 10l4-2v6l-4-2" fill="currentColor" /><rect x="12" y="14" width="8" height="6" rx="1" fill="#fff" /><path d="M14.5 16l3 1.2-3 1.2z" fill="currentColor" /></>,
  sport: <><circle cx="6" cy="5" r="1.3" /><path d="M6 6.5V11M4 8h4M4.5 14L6 11l1.5 3" /><circle cx="12" cy="5" r="1.3" /><path d="M9.5 8l2.5-1 2.5 1M12 7v4l-2 3M12 11l2 3" /><path d="M17 4l4 5M21 4l-4 5" /><path d="M4 17h3M4 19h3M10 16l2 3 2-3M17 17l2 2 2-2" /></>,
  travel: <><circle cx="9" cy="9" r="3.5" /><path d="M9 12.5V20M5 20h8" /><path d="M17 4v5M14.5 6.5h5" /></>,
  cooking: <><path d="M7 13c-2.5 0-3.5-1.8-3.5-3.3C3.5 7.5 5.5 6 7.5 6.8 8.3 5 10 4 12 4s3.7 1 4.5 2.8c2-.8 4 .7 4 2.9 0 1.5-1 3.3-3.5 3.3" /><path d="M7 13v6h10v-6" /></>,
  wrench: <path d="M5 5l14 14M19 5l-6.5 6.5M8.5 15.5L5 19M16 4l4 4M4 8l4-4" strokeWidth="2" />,
  photo: <><path d="M4 9h3l1.5-2.5h5L15 9h5v10H4z" fill="currentColor" /><circle cx="11.5" cy="14" r="2.5" fill="#fff" stroke="none" /></>,
  other: <><circle cx="7" cy="8" r="3" /><circle cx="7" cy="8" r=".8" fill="currentColor" /><rect x="13" y="12" width="7" height="8" rx="1" fill="currentColor" /><path d="M15 4h5M17.5 4v5M4 15h5M4 18h5" /></>,
  // onboarding: goals
  overview: <><rect x="6" y="4" width="12" height="16" rx="1.5" /><path d="M9 9h6M9 12.5h6M9 16h3" /></>,
  manage: <><path d="M5 8h14M5 12h14M5 16h14" strokeDasharray="1.5 2.3" /><path d="M6 5h2M11 5h2M16 5h2" /></>,
  better: <><rect x="3.5" y="6" width="13" height="9" rx="1.5" /><path d="M3.5 9.5h13" /><circle cx="17" cy="16.5" r="4" fill="#fff" /><path d="M17 14.5v4M15.5 15.5h2.3" /></>,
  // finance book
  book: <><rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="currentColor" /><path d="M6 18.5h14" stroke="#fff" /><circle cx="12" cy="9" r="2.5" stroke="#fff" /><path d="M12 5v8.5" stroke="#fff" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
