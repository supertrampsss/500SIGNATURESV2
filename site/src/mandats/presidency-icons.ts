/** Compact inline symbols stay legible on the board without an icon font. */
const paths: Record<string, string> = {
  health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor" stroke="none"/>',
  housing: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
  transport: '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 11h14M8 21l2-3m6 3-2-3M9 14h.01M15 14h.01"/>',
  energy: '<path d="m14 2-10 12h7l-1 8L20 9h-7z" fill="currentColor" stroke="none"/>',
  education: '<path d="m2 9 10-6 10 6-10 6zM6 12v6c4 3 8 3 12 0v-6M22 9v9"/>',
  administration: '<path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7"/>',
  government: '<path d="m2 8 10-6 10 6zM3 22h18M5 10v9m5-9v9m5-9v9m5-9v9"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 9-9m-5 0h5v5"/>',
  people: '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="8" r="2"/><path d="M2 21v-5a6 6 0 0 1 12 0v5zm13-9a5 5 0 0 1 7 4v5h-5"/>',
  coins: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v5c0 4 16 4 16 0V5M4 10v5c0 4 16 4 16 0v-5M4 15v4c0 4 16 4 16 0v-4"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  play: '<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  link: '<path d="m9 15 6-6M8 17l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 10a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" transform="translate(1 0) scale(.92)"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  'trend-up': '<path d="m4 18 15-12m-8 0h8v8"/>',
  'trend-down': '<path d="m4 6 15 12m-8 0h8v-8"/>',
  'trend-steady': '<path d="M3 12h17m-6-6 6 6-6 6"/>',
};

export function presidencyIcon(name: string, className = ""): string {
  return `<svg class="pr-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.government}</svg>`;
}
