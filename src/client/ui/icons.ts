/** Small line glyphs (16×16, stroke = currentColor) for map markers and the map tooltip. */
const P: Record<string, string> = {
  // event kinds
  prehistory: '<path d="M5.5 2.8h5M6.2 2.8c0 2-2.7 3-2.7 6.2 0 2.6 2 4.3 4.5 4.3s4.5-1.7 4.5-4.3c0-3.2-2.7-4.2-2.7-6.2M4.2 8h7.6"/>',
  politics: '<path d="M2.8 12.5h10.4M3.2 12.5 2.6 5.2l3 2.6L8 3.2l2.4 4.6 3-2.6-.6 7.3"/>',
  war: '<path d="M3 3l8.6 8.6M13 3 4.4 11.6M2.6 10.2l3.2 3.2M13.4 10.2l-3.2 3.2"/>',
  reform: '<path d="M12.6 6.2A5 5 0 0 0 3.6 5.4M3.4 9.8a5 5 0 0 0 9 .8M12.8 2.8v3.4H9.4M3.2 13.2V9.8h3.4"/>',
  culture: '<path d="M8 4.6C6.4 3.5 4.4 3.2 2.4 3.5v9c2-.3 4 0 5.6 1.1 1.6-1.1 3.6-1.4 5.6-1.1v-9c-2-.3-4 0-5.6 1.1zM8 4.6v9"/>',
  science: '<circle cx="8" cy="8" r="5.6"/><path d="M10.6 5.4 9.2 9.2 5.4 10.6l1.4-3.8z"/>',
  economy: '<circle cx="8" cy="8" r="5.6"/><path d="M6.3 6.3h3.4v3.4H6.3z"/>',
  diplomacy: '<circle cx="5.9" cy="8" r="3.4"/><circle cx="10.1" cy="8" r="3.4"/>',
  revolution: '<path d="M4 14V2.4M4 3h8.4l-2.2 3 2.2 3H4"/>',
  // life kinds
  person: '<circle cx="8" cy="4.6" r="2.3"/><path d="M3.4 14c.4-3.4 2.2-5.3 4.6-5.3s4.2 1.9 4.6 5.3z"/>',
  building: '<path d="M1.8 7.2 8 3l6.2 4.2M3.2 6.6c0 .9-.4 1.4-1 1.6M12.8 6.6c0 .9.4 1.4 1 1.6M4.2 7.4v5.8h7.6V7.4M6.8 13.2v-3h2.4v3"/>',
  custom: '<path d="M8 1.8v1.6M5.6 3.4h4.8M4.4 6.2c0-1.7 1.6-2.8 3.6-2.8s3.6 1.1 3.6 2.8v2.6c0 1.7-1.6 2.8-3.6 2.8s-3.6-1.1-3.6-2.8zM8 3.4v8.2M5.6 11.6h4.8M7 11.6l-.4 2.6M9 11.6l.4 2.6"/>',
  food: '<path d="M2.4 8.2h11.2a5.6 5.6 0 0 1-11.2 0zM6 13.8h4M8.4 6.4l4.4-4.4M6.6 6.4l3.6-4.6"/>',
  capital: '<path d="M1.6 6.4 8 2.6l6.4 3.8M3 6.2h10M4 6.2v6.6M12 6.2v6.6M6.7 6.2v6.6M9.3 6.2v6.6M2.2 13h11.6"/>',
  place: '<circle cx="8" cy="8" r="4.5"/><circle cx="8" cy="8" r="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2"/>',
};

export const glyph = (k: string): string =>
  `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${P[k] ?? P.politics}</svg>`;
