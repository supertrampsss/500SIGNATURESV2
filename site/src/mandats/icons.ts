/** Small, consistent interface drawings; labels always carry the meaning. */
const drawings = {
 decision:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',
 territory:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
 finance:'<path d="m3 8 9-5 9 5H3Zm2 3v6m5-6v6m4-6v6m5-6v6M3 21h18M5 18h14"/>',
 journal:'<path d="M12 5C8 2 4 3 3 4v15c4-2 7-1 9 1 2-2 5-3 9-1V4c-1-1-5-2-9 1Zm0 0v15"/>',
 plan:'<path d="M5 5h14M5 12h14M5 19h14"/><circle cx="9" cy="5" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="11" cy="19" r="2"/>',
 balance:'<path d="M12 3v17M6 21h12M4 7h16M6 7l-4 7h8L6 7Zm12 0-4 7h8l-4-7Z"/>',
 people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5v1"/>',
 leaf:'<path d="M20 3C10 2 3 6 4 13c1 7 11 9 14 2 2-4 1-8 2-12ZM3 22 15 9"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
};
export type IconName=keyof typeof drawings;
export function icon(name:IconName):string{return `<svg class="ui-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawings[name]}</svg>`;}
