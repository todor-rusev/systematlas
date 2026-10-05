import type { Actor } from "./model";
import { DEFAULT_PRESET, VISUAL_PRESETS } from "./visual-tokens";

                                                             
                                                                        
                                                                           
const PALETTE = [
  "#5B8DB8",        
  "#8B7EC8",          
  "#D9A05B",         
  "#5BA8A0",        
  "#C77B9A",         
  "#7FA659",         
  "#C98A5E",        
  "#6C8A9C",         
];

                                                             
export const NEUTRAL = "#b9b2a4";

export type ActorColors = Record<string, string>;

                                                                               
                                                                                  
export const FLOW_LABEL = VISUAL_PRESETS[DEFAULT_PRESET].label;

                                                                           
export function drillStroke(color: string): string {
  const rgb = channels(color),
    min = Math.min(...rgb),
    span = Math.max(...rgb) - min;
  if (span < 4) return "#8e887c";
                                                                               
                                                                             
  return `#${rgb
    .map((c) =>
      Math.round(255 * (0.3 + ((c - min) / span) * 0.34))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

                                                                       
                                                                  
                                                                       
const PAPER_COLORS = [
  "#b8efd3",
  "#ffe4cc",
  "#fbd1e1",
  "#ece5fc",
  "#fff0d1",
  "#d9ecfc",
  "#d2f1ef",
  "#dce3fc",
  "#e6efcc",
  "#f9ddce",
  "#e3d9f7",
  "#f4daf4",
  "#d0edc9",
  "#e2f2d0",
  "#ccefe0",
  "#d4eff8",
  "#d7e6f7",
  "#e7dffc",
  "#f0dcf9",
  "#f9dceb",
  "#f8dcd9",
  "#f8e7cd",
  "#efebd5",
  "#dcecdf",
];
export const PASTEL_PALETTE = Array.from(
  { length: 72 },
  (_, index) =>
    `#${channels(PAPER_COLORS[index % PAPER_COLORS.length])
      .map((c) =>
        Math.round(
          c + (255 - c) * Math.floor(index / PAPER_COLORS.length) * 0.04,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`,
);

export function buildActorColors(
  actors: Actor[],
  presentation: "classic" | "pastel" = "classic",
): ActorColors {
  const colors: ActorColors = {};
  actors.forEach((a, i) => {
    const given = a.color;
    const original = given
      ? given.length === 4
        ? `#${given[1]}${given[1]}${given[2]}${given[2]}${given[3]}${given[3]}`
        : given
      : (PALETTE[i] ?? extendedColor(i));
    colors[a.id] =
      presentation === "pastel" ? pastelColor(original, i, !!given) : original;
  });
  return colors;
}

                                                                                
                                                                                 
function pastelColor(color: string, index: number, explicit: boolean): string {
  if (!explicit) return PASTEL_PALETTE[index % PASTEL_PALETTE.length];
  const rgb = channels(color);
  const max = Math.max(...rgb),
    min = Math.min(...rgb);
  if (max - min < 10) return PASTEL_PALETTE[index % PASTEL_PALETTE.length];
  const hue = hueOf(rgb);
  const distance = (hex: string) => {
    const delta = Math.abs(hue - hueOf(channels(hex)));
    return Math.min(delta, 360 - delta);
  };
  let family = 0;
  PAPER_COLORS.forEach((hex, i) => {
    if (distance(hex) < distance(PAPER_COLORS[family])) family = i;
  });
  const band = max + min > 420 ? 2 : max + min > 330 ? 1 : 0;
  return PASTEL_PALETTE[band * PAPER_COLORS.length + family];
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function hueOf([r, g, b]: number[]): number {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  if (!delta) return 0;
  return (
    ((max === r
      ? (g - b) / delta
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4) *
      60 +
      360) %
    360
  );
}

                                                                                
                                                                                    
function extendedColor(index: number): string {
  const hue = ((index * 137.508 + 31) % 360) / 60;
  const chroma = 0.5,
    x = chroma * (1 - Math.abs((hue % 2) - 1)),
    m = 0.25;
  const rgb =
    hue < 1
      ? [chroma, x, 0]
      : hue < 2
        ? [x, chroma, 0]
        : hue < 3
          ? [0, chroma, x]
          : hue < 4
            ? [0, x, chroma]
            : hue < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return `#${rgb
    .map((c) =>
      Math.round((c + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
