                                                                                         
                                                                                          
                                                                                         
                                                             

export interface Tone {
  fill: string;
  outline: string;
  ink: string;
}

export interface VisualTokens {
  canvas: {
    background: string;
    grid: "dots" | "none";
    gridColor: string;
    gridSize: number;
                                                                         
    gridDotSize: number;
  };
  node: {
    radius: number;
    padding: number;
    outlineWidth: number;
    drillOutlineWidth: number;
    iconSize: number;
    iconStroke: number;
                                                                            
    iconChip: boolean;
  };
  label: { family: string; size: number; weight: number; lineHeight: number };
  edge: {
    ink: string;
    width: number;
    head: "open" | "solid";
                                                            
    headSize: number;
    returnDash: string;
    asyncDash: string;
    labelInk: string;
    labelSize: number;
  };
  terminal: Tone;
                                                                                         
  tone: { fill: [number, number]; outline: [number, number]; ink: [number, number] };
}

export const FONT_FAMILY = '"Inter Variable", "Noto Sans", "Segoe UI", system-ui, sans-serif';
const label = { family: FONT_FAMILY, size: 13, weight: 500, lineHeight: 18 };
const dashes = { returnDash: "5 4", asyncDash: "1.5 4" };

export const VISUAL_PRESETS = {
  whiteboard: {
    canvas: { background: "#F7F4EE", grid: "dots", gridColor: "rgba(60,52,40,0.14)", gridSize: 22, gridDotSize: 2 },
    node: { radius: 8, padding: 18, outlineWidth: 0, drillOutlineWidth: 1.5, iconSize: 16, iconStroke: 1.75, iconChip: false },
    label,
    edge: { ink: "#8F897E", width: 1.25, head: "open", headSize: 9, ...dashes, labelInk: "#6A6458", labelSize: 11 },
    terminal: { fill: "#ECE7DE", outline: "#D9D2C5", ink: "#4A453C" },
    tone: { fill: [0.93, 0.036], outline: [0.82, 0.07], ink: [0.4, 0.09] },
  },
  cards: {
    canvas: { background: "#FAF8F4", grid: "dots", gridColor: "rgba(60,52,40,0.14)", gridSize: 22, gridDotSize: 2 },
    node: { radius: 16, padding: 18, outlineWidth: 0, drillOutlineWidth: 1.75, iconSize: 16, iconStroke: 1.75, iconChip: true },
    label: { ...label, weight: 600 },
    edge: { ink: "#B3AC9F", width: 1.5, head: "solid", headSize: 9, ...dashes, labelInk: "#6A6458", labelSize: 11 },
    terminal: { fill: "#FFFFFF", outline: "#E4DED2", ink: "#3B372F" },
    tone: { fill: [0.925, 0.036], outline: [0.8, 0.08], ink: [0.4, 0.1] },
  },
  outline: {
    canvas: { background: "#FAF8F4", grid: "dots", gridColor: "rgba(60,52,40,0.14)", gridSize: 22, gridDotSize: 2 },
    node: { radius: 10, padding: 18, outlineWidth: 1, drillOutlineWidth: 1.75, iconSize: 16, iconStroke: 1.75, iconChip: false },
    label,
    edge: { ink: "#A29B8F", width: 1.25, head: "open", headSize: 9, ...dashes, labelInk: "#6A6458", labelSize: 11 },
    terminal: { fill: "#FFFFFF", outline: "#D9D2C5", ink: "#3B372F" },
    tone: { fill: [0.975, 0.022], outline: [0.82, 0.075], ink: [0.4, 0.09] },
  },
} as const satisfies Record<string, VisualTokens>;

export type PresetName = keyof typeof VISUAL_PRESETS;
export const DEFAULT_PRESET: PresetName = "cards";

                                                                                                      
                                                                                                                                               
                                                                                       
export const PASTELS = [
  { name: "sky", hue: 245 }, { name: "peach", hue: 66 }, { name: "mint", hue: 155 }, { name: "lilac", hue: 335 },
  { name: "butter", hue: 104 }, { name: "aqua", hue: 200 }, { name: "rose", hue: 24 }, { name: "periwinkle", hue: 290 },
] as const;

const baseOf = (hue: number) => fromOklch(0.65, 0.12, hue);

                                                                                                           
export function autoActorColor(index: number): string {
  return baseOf(index < PASTELS.length ? PASTELS[index].hue : (PASTELS[0].hue + index * 137.508) % 360);
}

                                                                                                   
                                                                                                   
                                                                                                          
export function actorBaseColors(actors: readonly { id: string; color?: string }[]): Record<string, string> {
  const free = new Set(PASTELS.map((_, i) => i));
  const out: Record<string, string> = {};
  const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  for (const actor of actors) {
    if (!actor.color || !free.size) continue;
    const [, chroma, hue] = toOklch(actor.color);
    if (chroma < 0.02) continue;                                                   
    const nearest = [...free].sort((a, b) => gap(PASTELS[a].hue, hue) - gap(PASTELS[b].hue, hue))[0];
    free.delete(nearest);
    out[actor.id] = baseOf(PASTELS[nearest].hue);
  }
  let overflow = PASTELS.length;
  for (const actor of actors) {
    if (out[actor.id]) continue;
    const next = [...free].sort((a, b) => a - b)[0];
    if (next !== undefined) { free.delete(next); out[actor.id] = baseOf(PASTELS[next].hue); }
    else out[actor.id] = autoActorColor(overflow++);
  }
  return out;
}

                                                                                             
export function actorTone(base: string, preset: VisualTokens): Tone {
  const [, c, h] = toOklch(base);
  const neutral = c < 0.02;
  const make = ([l, chroma]: readonly [number, number]) => fromOklch(l, neutral ? 0 : chroma, h);
                                                                                                  
                                                                               
  const toYellow = Math.min(Math.abs(h - 104), 360 - Math.abs(h - 104));
  const lift = Math.exp(-((toYellow / 28) ** 2));
  const [fl, fc] = preset.tone.fill;
  const fill = make([Math.min(0.985, fl + 0.02 * lift), fc * (1 + 0.9 * lift)] as const);
  return { fill, outline: make(preset.tone.outline), ink: make(preset.tone.ink) };
}

                                                  
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = rgb(hex).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

                                                                              
export function detailInk(tone: Tone): string {
  const surface = [1, 3, 5].map(i => parseInt(tone.fill.slice(i, i + 2), 16));
  const ink = [1, 3, 5].map(i => parseInt(tone.ink.slice(i, i + 2), 16));
  const mix = (amount: number) => "#" + surface.map((v, i) =>
    Math.round(v + (ink[i] - v) * amount).toString(16).padStart(2, "0")).join("");
  let low = 0, high = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2;
    if (contrastRatio(mix(mid), tone.fill) >= 3) high = mid;
    else low = mid;
  }
  return mix(high);
}

                                                                                           

function rgb(hex: string): [number, number, number] {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  return [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

function linearRgb(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

                                                                                       
function fromOklch(L: number, C: number, H: number): string {
  let chroma = C, lin = linearRgb(L, chroma, H);
  while (chroma > 0 && lin.some((v) => v < 0 || v > 1)) lin = linearRgb(L, (chroma -= 0.002), H);
  return `#${lin
    .map((v) => Math.min(1, Math.max(0, v)))
    .map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
    .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}
