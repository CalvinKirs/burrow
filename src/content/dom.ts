type Attrs = Record<string, string | boolean | undefined>;

/** Small hyperscript helper: `h('a.bw-row', { href }, 'text')`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  spec: K | `${K}.${string}`,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag as K);
  if (classes.length) el.className = classes.join(' ');
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children);
  return el;
}

export function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'bw-icon');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

export const ICONS = {
  outline: 'M2 3h12v1.5H2zm3 4h9v1.5H5zm0 4h9v1.5H5zM2 7h1.5v1.5H2zm0 4h1.5v1.5H2z',
  files: 'M1.5 3A1.5 1.5 0 0 1 3 1.5h3.2l1.5 1.5H13A1.5 1.5 0 0 1 14.5 4.5v8A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5zM3 3v9.5h10v-8H7.1L5.6 3z',
  folder: 'M1.5 3.5A1.5 1.5 0 0 1 3 2h3.2l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5v7.5A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5z',
  file: 'M3.5 1.5h6l3 3v10h-9zM9 2.6V5h2.4zM5 7.5h6v1H5zm0 2.5h6v1H5z',
  caret: 'M6 4l4 4-4 4z',
  up: 'M8 2.5l5 5-1.1 1.1L8.8 5.4V13.5H7.2V5.4L4.1 8.6 3 7.5z',
  home: 'M8 1.8l6.5 5.7-1 1.1-.5-.4V14H9.5v-4h-3v4H3V8.2l-.5.4-1-1.1z',
  refresh: 'M8 2.5a5.5 5.5 0 1 0 5.3 7h-1.6A4 4 0 1 1 8 4c1.1 0 2.1.5 2.8 1.2L8.5 7.5h5v-5l-1.6 1.6A5.5 5.5 0 0 0 8 2.5z',
  theme: 'M8 1.5a6.5 6.5 0 1 0 0 13zm0 1.5v10a5 5 0 0 1 0-10z',
  raw: 'M5.2 3.6L1 8l4.2 4.4 1.1-1L3.1 8l3.2-3.4zm5.6 0l-1.1 1L12.9 8l-3.2 3.4 1.1 1L15 8z',
};
