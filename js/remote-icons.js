// Original 24-unit pictograms for the remote. Static markup only.
// Shared stroke, optical size and rounded ends keep the small controls legible.
const paths = Object.freeze({
  R: '<path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7"/>',
  C: '<path d="M4 10v11h16V10M3 4h18v6H3zM8 4v6m8-6v6M9 21v-6h6v6"/>',
  I: '<path d="M3 21V11l6-4v5l6-4v13M15 21V3h4l2 18ZM6 16h1m4 0h1"/>',
  M: '<path d="M14 4c4-2 8 2 6 6l-4 6c-2 3-6 2-8 0s-3-6 0-8Z M8 16l-3 3m0 0c-3-1-4 3-1 3 2 0 3-2 1-3"/><circle cx="15" cy="9" r="2"/>',
  road: '<path d="M6 3 3 21M18 3l3 18M12 3v3m0 5v3m0 5v2"/>',
  wall: '<path d="M3 5h18v14H3ZM3 12h18M9 5v7m6 0v7"/>',
  rail: '<path d="M7 3 5 21M17 3l2 18M7 6h10M6 11h12M6 16h12M5 21h14"/>',
  station: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18l-2 3m10-3 2 3M9 6h6"/><circle cx="8" cy="15" r=".7"/><circle cx="16" cy="15" r=".7"/>',
  tree: '<path d="M12 21v-6M9 18h6M7 15a4 4 0 0 1-2-7 7 7 0 0 1 14 0 4 4 0 0 1-2 7Z"/>',
  park: '<path d="M4 11h16v5H4ZM6 7h12M7 7v4m10-4v4M6 16v5m12-5v5"/>',
  zoo: '<path d="M4 21V9a8 8 0 0 1 16 0v12M3 21h18M8 8v13m4-14v14m4-13v13"/>',
  centre: '<circle cx="12" cy="7" r="3"/><path d="M8 13h8l4 7H4ZM12 13v4M2 8h2m16 0h2"/>',
  police: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z"/><path d="m12 7 1.3 3 3.2.3-2.4 2.2.7 3.2-2.8-1.6-2.8 1.6.7-3.2-2.4-2.2 3.2-.3Z"/>',
  fire: '<path d="M13 2c1 6-5 7-3 11 2 0 4-3 4-5 7 6 7 13-2 13-9 0-10-8-5-12 0 3 1 4 2 4-2-5 2-7 4-11Z"/>',
  inspect: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  bulldoze: '<path d="M3 16V8h8l3 8M5 8V4h6v12M14 16h4l3-5v10h-5M3 16h11v4H3Z"/>',
  largePark: '<path d="M2 19h20M3 15l5-9 5 9ZM8 15v4M14 19v-4m-2-3a4 4 0 1 1 8 0c0 3-8 3-8 0Z"/>',
  camera: '<path d="m3 7 12-3 3 9-12 3ZM8 16v4h7m0-7 6-2-2-7-5 1"/>',
  library: '<path d="M12 6C9 4 6 3 3 4v15c3-1 6 0 9 2 3-2 6-3 9-2V4c-3-1-6 0-9 2ZM12 6v15"/>',
  university: '<path d="m2 8 10-5 10 5-10 5ZM6 10v7c4 3 8 3 12 0v-7M22 8v9"/>',
  gallery: '<path d="M3 3h18v18H3ZM5 18l5-6 4 4 3-3 3 5"/><circle cx="16" cy="8" r="2"/>',
  amphitheater: '<path d="M8 4h8v5H8ZM3 11c3 10 15 10 18 0M6 11c2 6 10 6 12 0M9 11c1 2 5 2 6 0"/>',
  farm: '<path d="M12 22V4M12 7C6 7 5 4 5 2c5 0 7 2 7 5Zm0 5c-6 0-7-3-7-5 5 0 7 2 7 5Zm0 5c-6 0-7-3-7-5 5 0 7 2 7 5ZM12 9c6 0 7-3 7-5-5 0-7 2-7 5Zm0 5c6 0 7-3 7-5-5 0-7 2-7 5Z"/>',
  cemetery: '<path d="M6 21V8a6 6 0 0 1 12 0v13M3 21h18M9 10h6m-6 4h6"/>',
  sanitation: '<path d="M12 2c-2 3-6 7-6 10a6 6 0 0 0 12 0c0-3-4-7-6-10ZM3 21c3-3 6 3 9 0s6 3 9 0"/>',
  garbage: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  doctor: '<path d="M5 3v6a5 5 0 0 0 10 0V3M3 3h4m6 0h4M10 14v2a5 5 0 0 0 10 0v-3"/><circle cx="20" cy="10" r="2"/>',
  governor: '<path d="M3 9h18L12 3 3 9Zm2 2v8m5-8v8m4-8v8m5-8v8M3 21h18M2 9h20"/>',
  hospital: '<path d="M4 21V6h16v15M2 21h20M10 21v-5h4v5M12 2v8M8 6h8M7 12h1m8 0h1"/>',
  interview: '<path d="M4 4h16v12H9l-5 4ZM8 9h8m-8 3h5"/>',
  collect: '<circle cx="9" cy="6" r="3"/><path d="M3 21v-4a6 6 0 0 1 10-4M15 17h7m-3-3 3 3-3 3"/>',
});

export function remoteIcon(id) {
  if (!paths[id]) throw new Error(`Missing remote icon: ${id}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[id]}</svg>`;
}
