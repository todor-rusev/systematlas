import type { FlowNode, NodeType } from "./core/types";
import type { NodeShape } from "./core/visual-vocabulary";
import { DEFAULT_PRESET, VISUAL_PRESETS, type PresetName } from "./visual-tokens";

export type VisualMode = "actors" | "classic";
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface VisualGeometry {
  w: number;
  h: number;
  shape: NodeShape;
  path: string;
  decorations: string[];
  outline: Point[];
  content: Rect;
  captionOutside?: boolean;
  anchor?: Point;
  stacked?: boolean;
  symbol?: Rect;
}
export const DEFAULT_SHAPES: Record<NodeType, NodeShape> = {
  terminal: "stadium",
  step: "rounded",
  decision: "diam",
  subflow: "rounded",
  io: "lean-r",
};

                                                                          
                                                                            
const MIN_HEIGHT_RATIO: Partial<Record<NodeShape, number>> = {
  doc: 0.56, docs: 0.56, "lin-doc": 0.56, "tag-doc": 0.56,
  tri: 0.55, "flip-tri": 0.55, person: 0.55,
  cyl: 0.36, "lin-cyl": 0.36, cache: 0.36,
  bucket: 0.4, bang: 0.4,
};

                                                                          
                                                                               
function contour() {
  const points: Point[] = [];
  const commands: string[] = [];
  let at: Point = { x: 0, y: 0 };
  const move = (x: number, y: number) => {
    at = { x, y };
    points.push(at);
    commands.push(`M${x},${y}`);
  };
  const line = (x: number, y: number) => {
    at = { x, y };
    points.push(at);
    commands.push(`L${x},${y}`);
  };
  const curve = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ) => {
    const start = at;
    for (let i = 1; i <= 32; i++) {
      const t = i / 32,
        s = 1 - t;
      points.push({
        x:
          s * s * s * start.x +
          3 * s * s * t * x1 +
          3 * s * t * t * x2 +
          t * t * t * x,
        y:
          s * s * s * start.y +
          3 * s * s * t * y1 +
          3 * s * t * t * y2 +
          t * t * t * y,
      });
    }
    at = { x, y };
    commands.push(`C${x1},${y1} ${x2},${y2} ${x},${y}`);
  };
  return {
    move,
    line,
    curve,
    finish: () => ({ path: commands.join(" ") + " Z", outline: points }),
  };
}

export function shapeGeometry(
  shape: NodeShape,
  w: number,
  h: number,
  radius = VISUAL_PRESETS[DEFAULT_PRESET].node.radius,
): VisualGeometry {
  const p = contour(),
    marks: string[] = [];
                                                                               
  let inset = { x: 0.07, y: 0.12, w: 0.86, h: 0.76 };
  const polygon = (xy: number[]) => {
                                                                               
                                                                           
    const vertices = Array.from({ length: xy.length / 2 }, (_, i) => ({
      x: xy[i * 2],
      y: xy[i * 2 + 1],
    }));
    const length = (a: Point, b: Point) =>
      Math.hypot(((a.x - b.x) * w) / 100, ((a.y - b.y) * h) / 100);
                                                                              
                                                          
    const cornerRadius = shape === "bolt" ? 2 : shape === "bang" ? 6
      : ["notch-rect", "notch-pent", "folder"].includes(shape) ? Math.min(6, radius)
      : ["tri", "flip-tri", "hourglass", "sl-rect"].includes(shape) ? Math.min(10, radius)
      : radius * 1.5;
    const corners = vertices.map((at, i) => {
      const prev = vertices[(i + vertices.length - 1) % vertices.length],
        next = vertices[(i + 1) % vertices.length];
      const beforeLength = length(at, prev),
        afterLength = length(at, next);
      const trim = Math.min(cornerRadius, beforeLength * 0.25, afterLength * 0.25);
      const toward = (other: Point, distance: number) => ({
        x: at.x + ((other.x - at.x) * trim) / distance,
        y: at.y + ((other.y - at.y) * trim) / distance,
      });
      return {
        at,
        before: toward(prev, beforeLength),
        after: toward(next, afterLength),
      };
    });
    const last = corners[corners.length - 1].after;
    p.move(last.x, last.y);
    for (const { at, before, after } of corners) {
      p.line(before.x, before.y);
      p.curve(
        before.x + ((at.x - before.x) * 2) / 3,
        before.y + ((at.y - before.y) * 2) / 3,
        after.x + ((at.x - after.x) * 2) / 3,
        after.y + ((at.y - after.y) * 2) / 3,
        after.x,
        after.y,
      );
    }
  };
  const rect = () => round(Math.min(8, radius) * 100 / w, Math.min(8, radius) * 100 / h);
  const round = (rx: number, ry: number) => {
    const k = 0.55228475;                                                       
    p.move(rx, 0);
    p.line(100 - rx, 0);
    p.curve(100 - rx + k * rx, 0, 100, ry - k * ry, 100, ry);
    p.line(100, 100 - ry);
    p.curve(100, 100 - ry + k * ry, 100 - rx + k * rx, 100, 100 - rx, 100);
    p.line(rx, 100);
    p.curve(rx - k * rx, 100, 0, 100 - ry + k * ry, 0, 100 - ry);
    p.line(0, ry);
    p.curve(0, ry - k * ry, rx - k * rx, 0, rx, 0);
  };
  const ellipse = () => {
    p.move(50, 0);
    p.curve(77.614, 0, 100, 22.386, 100, 50);
    p.curve(100, 77.614, 77.614, 100, 50, 100);
    p.curve(22.386, 100, 0, 77.614, 0, 50);
    p.curve(0, 22.386, 22.386, 0, 50, 0);
  };
  const oval = (cx: number, cy: number, rx: number, ry: number) => {
    const kx = rx * 0.55228475, ky = ry * 0.55228475;
    return `M${cx - rx},${cy} C${cx - rx},${cy - ky} ${cx - kx},${cy - ry} ${cx},${cy - ry}` +
      ` C${cx + kx},${cy - ry} ${cx + rx},${cy - ky} ${cx + rx},${cy}` +
      ` C${cx + rx},${cy + ky} ${cx + kx},${cy + ry} ${cx},${cy + ry}` +
      ` C${cx - kx},${cy + ry} ${cx - rx},${cy + ky} ${cx - rx},${cy} Z`;
  };
  const stack = (paper = false) => {
                                                                               
                                                                             
    const rx = Math.min(4, radius * 100 / w), ry = Math.min(4, radius * 100 / h);
    p.move(16 + rx, 0);
    p.line(100 - rx, 0);
    p.curve(100, 0, 100, 0, 100, ry);
    p.line(100, 84 - ry);
    p.curve(100, 84, 100, 84, 100 - rx, 84);
    p.line(92, 84);
    p.line(92, 92 - ry);
    p.curve(92, 92, 92, 92, 92 - rx, 92);
    p.line(84, 92);
    if (paper) p.curve(58, 78, 26, 106, 0, 92);
    else {
      p.line(84, 100 - ry);
      p.curve(84, 100, 84, 100, 84 - rx, 100);
      p.line(rx, 100);
      p.curve(0, 100, 0, 100, 0, 100 - ry);
    }
    p.line(0, 16 + ry);
    p.curve(0, 16, 0, 16, rx, 16);
    p.line(8, 16);
    p.line(8, 8 + ry);
    p.curve(8, 8, 8, 8, 8 + rx, 8);
    p.line(16, 8);
    p.line(16, ry);
    p.curve(16, 0, 16, 0, 16 + rx, 0);
    marks.push(`M${rx},16 L${84 - rx},16 C84,16 84,16 84,${16 + ry} L84,92`,
      `M${8 + rx},8 L${92 - rx},8 C92,8 92,8 92,${8 + ry} L92,84`);
    inset = paper ? { x: 0.09, y: 0.42, w: 0.66, h: 0.37 }
      : { x: 0.08, y: 0.3, w: 0.68, h: 0.58 };
  };
  switch (shape) {
    case "diam":
      polygon([50, 0, 100, 50, 50, 100, 0, 50]);
      inset = { x: 0.26, y: 0.26, w: 0.48, h: 0.48 };
      break;
    case "lean-r":
      polygon([14, 0, 100, 0, 86, 100, 0, 100]);
      inset = { x: 0.17, y: 0.12, w: 0.66, h: 0.76 };
      break;
    case "lean-l":
      polygon([0, 0, 86, 0, 100, 100, 14, 100]);
      inset = { x: 0.17, y: 0.12, w: 0.66, h: 0.76 };
      break;
    case "hex":
      polygon([18, 0, 82, 0, 100, 50, 82, 100, 18, 100, 0, 50]);
      inset = { x: 0.2, y: 0.13, w: 0.6, h: 0.74 };
      break;
    case "trap-t":
      polygon([0, 0, 100, 0, 82, 100, 18, 100]);
      inset = { x: 0.2, y: 0.12, w: 0.6, h: 0.76 };
      break;
    case "trap-b":
      polygon([18, 0, 82, 0, 100, 100, 0, 100]);
      inset = { x: 0.2, y: 0.12, w: 0.6, h: 0.76 };
      break;
    case "notch-pent":
      polygon([18, 0, 82, 0, 100, 25, 100, 100, 0, 100, 0, 25]);
      inset = { x: 0.12, y: 0.3, w: 0.76, h: 0.58 };
      break;
    case "notch-rect":
      polygon([18, 0, 100, 0, 100, 100, 0, 100, 0, 36]);
      inset = { x: 0.2, y: 0.15, w: 0.7, h: 0.7 };
      break;
    case "sl-rect":
      polygon([0, 22, 100, 0, 100, 100, 0, 100]);
      inset = { x: 0.08, y: 0.3, w: 0.84, h: 0.58 };
      break;
    case "tri":
      polygon([50, 0, 100, 100, 0, 100]);
      inset = { x: 0.3, y: 0.55, w: 0.4, h: 0.32 };
      break;
    case "flip-tri":
      polygon([0, 0, 100, 0, 50, 100]);
      inset = { x: 0.3, y: 0.12, w: 0.4, h: 0.32 };
      break;
    case "hourglass":
                                                                          
      polygon([50 - 2800 / w, 400 / h, 50 + 2800 / w, 400 / h,
        50 + 800 / w, 2800 / h, 50 + 2800 / w, 5200 / h,
        50 - 2800 / w, 5200 / h, 50 - 800 / w, 2800 / h]);
      inset = { x: 0.07, y: 0.58, w: 0.86, h: 0.36 };
      break;
    case "bolt":
      polygon([55, 0, 41, 24, 49, 24, 45, 40, 59, 16, 51, 16]);
      inset = { x: 0.07, y: 0.5, w: 0.86, h: 0.42 };
      break;
    case "bang":
                                                                            
      polygon(Array.from({ length: 20 }, (_, i) => {
        const angle = -Math.PI / 2 + i * Math.PI / 10;
        const r = i % 2 ? 38 : 50;
        return [50 + Math.cos(angle) * r, 50 + Math.sin(angle) * r];
      }).flat());
      inset = { x: 0.27, y: 0.28, w: 0.46, h: 0.44 };
      break;
    case "odd":
      polygon([16, 0, 100, 0, 100, 100, 16, 100, 0, 50]);
      inset = { x: 0.2, y: 0.12, w: 0.72, h: 0.76 };
      break;
    case "circle":
    case "dbl-circ":
    case "fr-circ":
    case "cross-circ":
    case "timer":
      ellipse();
      inset = { x: 0.18, y: 0.23, w: 0.64, h: 0.54 };
      if (shape === "dbl-circ" || shape === "fr-circ")
        marks.push(
          "M50,7 C74,7 93,26 93,50 C93,74 74,93 50,93 C26,93 7,74 7,50 C7,26 26,7 50,7 Z",
        );
      if (shape === "cross-circ") {
        marks.push("M15,15 L85,85 M85,15 L15,85");
        inset = { x: 0.28, y: 0.28, w: 0.44, h: 0.44 };
      }
      if (shape === "timer") {
        marks.push("M50,7 L50,13 M50,87 L50,93 M7,50 L13,50 M87,50 L93,50",
          "M50,25 L50,50 L65,42");
        inset = { x: 0.27, y: 0.68, w: 0.46, h: 0.18 };
      }
      break;
    case "cyl":
    case "lin-cyl":
    case "cache":
      p.move(0, 15);
      p.curve(0, -5, 100, -5, 100, 15);
      p.line(100, 85);
      p.curve(100, 105, 0, 105, 0, 85);
      p.line(0, 15);
      marks.push("M0,15 C0,35 100,35 100,15");
      inset = { x: 0.08, y: 0.32, w: 0.84, h: 0.48 };
      if (shape === "lin-cyl")
        marks.push("M0,79 C0,99 100,99 100,79 M0,73 C0,93 100,93 100,73");
      if (shape === "cache")
      {
        marks.push("M90,36 L80,50 L89,50 L82,65 L95,47 L87,47 Z");
        inset.w = 0.65;
      }
      break;
    case "h-cyl": {
      const cap = Math.min(15, h * 20 / w), k = cap * 0.55228475;
      p.move(cap, 0);
      p.line(100 - cap, 0);
      p.curve(100 - cap + k, 0, 100, 22.386, 100, 50);
      p.curve(100, 77.614, 100 - cap + k, 100, 100 - cap, 100);
      p.line(cap, 100);
      p.curve(cap - k, 100, 0, 77.614, 0, 50);
      p.curve(0, 22.386, cap - k, 0, cap, 0);
      marks.push(oval(cap, 50, cap, 50));
      inset = { x: 0.23, y: 0.12, w: 0.64, h: 0.76 };
      break;
    }
    case "doc":
    case "docs":
    case "lin-doc":
    case "tag-doc":
      {
        if (shape === "docs") {
          stack(true);
          marks.push("M12,26 L37,26 M12,32 L30,32");
          break;
        }
        const rx = Math.min(10, radius * 100 / w), ry = Math.min(15, radius * 100 / h);
        p.move(rx, 0);
        if (shape === "tag-doc") {
          p.line(80, 0);
          p.line(100, 24);
          marks.push("M80,0 L80,24 L100,24");
        } else {
          p.line(100 - rx, 0);
          p.curve(100, 0, 100, 0, 100, ry);
        }
        p.line(100, 88);
        p.curve(66, 68, 34, 108, 0, 88);
        p.line(0, ry);
        p.curve(0, 0, 0, 0, rx, 0);
        inset = { x: 0.1, y: 0.38, w: 0.8, h: 0.42 };
        if (shape === "lin-doc") {
          marks.push("M14,10 L14,81", "M23,15 L46,15 M23,22 L39,22");
          inset.x = 0.23;
          inset.w = 0.67;
        } else marks.push("M12,15 L37,15 M12,22 L30,22");
      }
      break;
    case "flag":
      p.move(0, 18);
      p.curve(0, 13, 0, 13, 6, 10);
      p.curve(35, -5, 65, 31, 94, 16);
      p.curve(100, 13, 100, 13, 100, 19);
      p.line(100, 82);
      p.curve(100, 87, 100, 87, 94, 90);
      p.curve(65, 105, 35, 69, 6, 84);
      p.curve(0, 87, 0, 87, 0, 81);
      p.line(0, 18);
      for (const x of [12, 24, 36]) marks.push(oval(x, 26, 150 / w, 150 / h));
      inset = { x: 0.1, y: 0.32, w: 0.8, h: 0.36 };
      break;
    case "bow-rect": {
      const rx = Math.min(4, radius) * 100 / w, ry = Math.min(4, radius) * 100 / h;
      p.move(rx, 0);
      p.line(100 - rx, 0);
      p.curve(100, 0, 100, ry / 2, 100 - rx / 2, ry);
      p.curve(82, 30, 82, 70, 100 - rx / 2, 100 - ry);
      p.curve(100, 100 - ry / 2, 100, 100, 100 - rx, 100);
      p.line(rx, 100);
      p.curve(0, 100, 0, 100 - ry / 2, rx / 2, 100 - ry);
      p.curve(18, 70, 18, 30, rx / 2, ry);
      p.curve(0, ry / 2, 0, 0, rx, 0);
      inset = { x: 0.19, y: 0.12, w: 0.62, h: 0.76 };
      break;
    }
    case "delay": {
      const cap = Math.min(35, h * 50 / w), k = cap * 0.55228475;
      const rx = Math.min(6, radius * 100 / w), ry = Math.min(10, radius * 100 / h);
      p.move(rx, 0);
      p.line(100 - cap, 0);
      p.curve(100 - cap + k, 0, 100, 22.386, 100, 50);
      p.curve(100, 77.614, 100 - cap + k, 100, 100 - cap, 100);
      p.line(rx, 100);
      p.curve(0, 100, 0, 100, 0, 100 - ry);
      p.line(0, ry);
      p.curve(0, 0, 0, 0, rx, 0);
      inset = { x: 0.08, y: 0.16, w: 0.65, h: 0.68 };
      break;
    }
    case "curv-trap":
      p.move(18, 0);
      p.line(75, 0);
      p.curve(88.807, 0, 100, 22.386, 100, 50);
      p.curve(100, 77.614, 88.807, 100, 75, 100);
      p.line(18, 100);
      p.line(2, 54);
      p.curve(0, 52, 0, 48, 2, 46);
      p.line(18, 0);
      inset = { x: 0.22, y: 0.15, w: 0.55, h: 0.7 };
      break;
    case "bucket":
                                                                              
                                                                  
      p.move(0, 14);
      p.curve(0, -4, 100, -4, 100, 14);
      p.curve(98, 38, 87, 89, 78, 96);
      p.curve(74, 100, 26, 100, 22, 96);
      p.curve(13, 89, 2, 38, 0, 14);
      marks.push("M0,14 C0,32 100,32 100,14");
      inset = { x: 0.23, y: 0.35, w: 0.54, h: 0.52 };
      break;
    case "st-rect": {
      stack();
      break;
    }
    case "tag-rect": {
      const rx = Math.min(12, radius * 100 / w), ry = Math.min(22, radius * 100 / h);
      p.move(rx, 0);
      p.line(80, 0);
      p.line(100, 22);
      p.line(100, 100 - ry);
      p.curve(100, 100, 100, 100, 100 - rx, 100);
      p.line(rx, 100);
      p.curve(0, 100, 0, 100, 0, 100 - ry);
      p.line(0, ry);
      p.curve(0, 0, 0, 0, rx, 0);
      marks.push("M80,0 L80,22 L100,22");
      inset = { x: 0.09, y: 0.3, w: 0.82, h: 0.58 };
      break;
    }
    case "folder":
      polygon([0, 0, 38, 0, 50, 18, 100, 18, 100, 100, 0, 100]);
      inset = { x: 0.08, y: 0.3, w: 0.84, h: 0.58 };
      break;
    case "cloud":
      p.move(18, 95);
      p.curve(-6, 95, -6, 48, 18, 48);
      p.curve(12, 22, 35, 8, 48, 23);
      p.curve(52, -5, 87, -1, 88, 39);
      p.curve(100, 40, 100, 95, 82, 95);
      p.line(18, 95);
      inset = { x: 0.22, y: 0.48, w: 0.56, h: 0.32 };
      break;
    case "person": {
                                                                           
                                                                               
      const cy = 18, ry = 16, rx = Math.min(16, ry * h / w), k = 0.55228475;
      p.move(23, 42);
      p.curve(2, 42, 2, 100, 23, 100);
      p.line(77, 100);
      p.curve(98, 100, 98, 42, 77, 42);
      p.line(50 + rx / 2, 42);
      p.line(50 + rx / 2, cy + ry * 0.866);
      p.curve(50 + rx * 0.85, cy + ry * 0.65, 50 + rx, cy + ry * 0.35, 50 + rx, cy);
      p.curve(50 + rx, cy - ry * k, 50 + rx * k, cy - ry, 50, cy - ry);
      p.curve(50 - rx * k, cy - ry, 50 - rx, cy - ry * k, 50 - rx, cy);
      p.curve(50 - rx, cy + ry * 0.35, 50 - rx * 0.85, cy + ry * 0.65, 50 - rx / 2, cy + ry * 0.866);
      p.line(50 - rx / 2, 42);
      p.line(23, 42);
      inset = { x: 0.23, y: 0.52, w: 0.54, h: 0.35 };
      break;
    }
    case "rounded":
    case "api":
      round(Math.min(24, radius * 100 / w), Math.min(40, radius * 100 / h));
      if (shape === "api") {
        marks.push("M10,28 L5,50 L10,72 M90,28 L95,50 L90,72");
        inset = { x: 0.15, y: 0.12, w: 0.7, h: 0.76 };
      }
      break;
    case "stadium":
      round(Math.min(50, (50 * h) / w), 50);
      inset = { x: 0.16, y: 0.15, w: 0.68, h: 0.7 };
      break;
    case "icon":
    case "image": {
                                                                             
                                                                                 
      round(Math.min(radius, w * 0.15) * 100 / w, Math.min(radius, h * 0.15) * 100 / h);
      const size = shape === "image" ? 48 : 32;
      inset = { x: 16 / w, y: (16 + size + 8) / h, w: 1 - 32 / w, h: 1 - (16 + size + 8 + 16) / h };
      break;
    }
    case "sm-circ":
    case "f-circ":
    case "fork":
                                                                                  
                                                            
      inset = { x: 0.07, y: 0.5, w: 0.86, h: 0.42 };
      if (shape === "fork") polygon([15, 8, 85, 8, 85, 25, 15, 25]);
      else if (shape === "sm-circ" || shape === "f-circ") {
        const rx = 800 / w,
          ry = 800 / h,
          cy = 20;
        p.move(50, cy - ry);
        p.curve(50 + 0.552285 * rx, cy - ry, 50 + rx, cy - 0.552285 * ry, 50 + rx, cy);
        p.curve(50 + rx, cy + 0.552285 * ry, 50 + 0.552285 * rx, cy + ry, 50, cy + ry);
        p.curve(50 - 0.552285 * rx, cy + ry, 50 - rx, cy + 0.552285 * ry, 50 - rx, cy);
        p.curve(50 - rx, cy - 0.552285 * ry, 50 - 0.552285 * rx, cy - ry, 50, cy - ry);
      } else polygon([42, 2, 58, 2, 58, 38, 42, 38]);
      break;
    default:
      rect();
      if (shape === "fr-rect") {
        marks.push("M6,0 L6,100 M94,0 L94,100");
        inset = { x: 0.12, y: 0.12, w: 0.76, h: 0.76 };
      }
      if (shape === "lin-rect") {
        marks.push("M8,0 L8,100");
        inset = { x: 0.15, y: 0.12, w: 0.77, h: 0.76 };
      }
      if (shape === "div-rect" || shape === "win-pane") {
        marks.push("M0,22 L100,22");
        inset = { x: 0.09, y: 0.33, w: 0.82, h: 0.55 };
      }
      if (shape === "win-pane") {
        marks.push("M16,0 L16,100");
        inset.x = 0.24;
        inset.w = 0.67;
      }
      if (shape === "browser" || shape === "console") {
        marks.push("M0,25 L100,25");
        if (shape === "browser") for (const x of [8, 14, 20]) marks.push(oval(x, 12, 150 / w, 150 / h));
        else marks.push("M8,8 L12,14 L8,20 M16,20 L23,20");
        inset = { x: 0.08, y: 0.34, w: 0.84, h: 0.54 };
      }
      if (shape === "queue") {
        for (const x of [12, 38, 64]) marks.push(`M${x},8 L${x + 20},8 L${x + 20},24 L${x},24 Z M${x},8 L${x + 10},17 L${x + 20},8`);
        inset = { x: 0.08, y: 0.36, w: 0.84, h: 0.5 };
      }
      if (shape === "datastore") {
        marks.push("M8,10 L92,10 M8,90 L92,90");
        inset = { x: 0.09, y: 0.22, w: 0.82, h: 0.56 };
      }
      if (shape === "brace" || shape === "braces") {
        marks.push("M16,10 C6,10 16,40 6,50 C16,60 6,90 16,90");
        inset.x = 0.18;
        inset.w = 0.64;
      }
      if (shape === "brace-r" || shape === "braces") {
        marks.push("M84,10 C94,10 84,40 94,50 C84,60 94,90 84,90");
        inset.x = 0.18;
        inset.w = 0.64;
      }
  }
  const result = p.finish();
  const captionOutside = [
    "sm-circ",
    "f-circ",
    "fork",
    "bolt",
    "hourglass",
  ].includes(shape);
  const symbolSize = Math.min(shape === "image" ? 48 : 32, w - 32);
  const symbol = ["icon", "image"].includes(shape)
    ? {
        x: w / 2 - symbolSize / 2,
        y: 16,
        w: symbolSize,
        h: symbolSize,
      }
    : undefined;
                                                                               
                                                                                
  const outline = captionOutside
    ? convexHull([
        ...result.outline,
        ...(symbol
          ? [
              { x: (symbol.x / w) * 100, y: (symbol.y / h) * 100 },
              { x: ((symbol.x + symbol.w) / w) * 100, y: (symbol.y / h) * 100 },
              { x: (symbol.x / w) * 100, y: ((symbol.y + symbol.h) / h) * 100 },
              { x: ((symbol.x + symbol.w) / w) * 100, y: ((symbol.y + symbol.h) / h) * 100 },
            ]
          : []),
        { x: inset.x * 100, y: inset.y * 100 },
        { x: (inset.x + inset.w) * 100, y: inset.y * 100 },
        { x: inset.x * 100, y: (inset.y + inset.h) * 100 },
        { x: (inset.x + inset.w) * 100, y: (inset.y + inset.h) * 100 },
      ])
    : result.outline;
  return {
    w,
    h,
    shape,
    path: result.path,
    decorations: marks,
    captionOutside,
    symbol,
    outline: outline.map((pt) => ({
      x: (pt.x * w) / 100,
      y: (pt.y * h) / 100,
    })),
    content: { x: inset.x * w, y: inset.y * h, w: inset.w * w, h: inset.h * h },
  };
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (pts: Point[]) => {
    const out: Point[] = [];
    for (const p of pts) {
      while (
        out.length >= 2 &&
        turn(out[out.length - 2], out[out.length - 1], p) <= 0
      )
        out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = half(sorted),
    upper = half([...sorted].reverse());
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

                                                                            
                                                                                   
export function nodeGeometry(
  node: Pick<
    FlowNode,
    "type" | "shape" | "label" | "icon" | "subflow" | "sequence"
  >,
  measure: ((s: string) => number) | undefined = undefined,
  preset: PresetName = DEFAULT_PRESET,
): VisualGeometry {
  const label = VISUAL_PRESETS[preset].label;
  const measureText = measure ?? ((s: string) => Array.from(s).length * label.size);
  const shape = node.shape ?? DEFAULT_SHAPES[node.type];
  const stacked = [
    "diam",
    "tri",
    "flip-tri",
    "circle",
    "dbl-circ",
    "fr-circ",
    "cross-circ",
    "timer",
    "bang",
  ].includes(shape);
  const picture = shape === "image" || shape === "icon";
  const iconW = node.icon && !stacked && !picture ? 38 : 0;
  const badge = (node.subflow || node.sequence) && !stacked ? 66 : 0;
  const words = node.label.split(/\s+/);
  const longest = Math.max(...words.map(measureText), 0);
  const preferred = shape === "diam" && !node.icon && !node.subflow && !node.sequence ? 60 : stacked ? 100 : 140;
  const textW = Math.min(
    420,
    Math.max(
      preferred,
      Math.min(measureText(node.label), stacked ? 120 : 240),
      longest,
    ),
  );
                                                                                 
  let lines = 0;
  for (const paragraph of node.label.split(/\r?\n/)) {
    let paragraphLines = 1,
      line = 0;
    for (const word of paragraph.split(/\s+/)) {
      const width = measureText(word),
        space = line ? measureText(" ") : 0;
      if (line && line + space + width > textW) {
        paragraphLines++;
        line = 0;
      }
      if (width > textW) {
        paragraphLines += Math.ceil(width / textW) - 1;
        line = width % textW || textW;
      } else line += (line ? measureText(" ") : 0) + width;
    }
    lines += paragraphLines;
  }
  const textH = stacked
    ? lines * label.lineHeight +
      (node.icon || node.subflow || node.sequence ? 36 : 0)
    : Math.max(node.icon ? 28 : 0, lines * label.lineHeight);
  const radius = VISUAL_PRESETS[preset].node.radius;
  const ref = shapeGeometry(shape, 100, 100, radius).content;
  if (picture) {
    const size = shape === "image" ? 48 : 32;
    const captionHeight = Math.max(lines * label.lineHeight, badge ? 28 : 0);
    return {
      ...shapeGeometry(shape, Math.max(192, textW + badge + 32), 16 + size + 8 + captionHeight + 16, radius),
      stacked: false,
    };
  }
  let w = Math.ceil((textW + iconW + badge + 18) / (ref.w / 100));
  let h = Math.ceil((textH + 14) / (ref.h / 100));
  h = Math.max(h, Math.ceil(w * (MIN_HEIGHT_RATIO[shape] ?? 0)));
  if (
    ["circle", "dbl-circ", "fr-circ", "cross-circ", "timer"].includes(
      shape,
    )
  )
    w = h = Math.max(w, h);
  return {
    ...shapeGeometry(
      shape,
      Math.max(160, w),
      Math.max(shape === "diam" ? 96 : 58, h),
      radius,
    ),
    stacked,
  };
}

                                                                                    
export function clipToOutline(
  box: Rect & { outline?: Point[]; anchor?: Point },
  from: Point,
  gap: number,
): Point {
  const cx = box.x + (box.anchor?.x ?? box.w / 2),
    cy = box.y + (box.anchor?.y ?? box.h / 2);
  const dx = from.x - cx,
    dy = from.y - cy;
  if (Math.hypot(dx, dy) < 0.001) return from;
  const pts = box.outline ?? [
    { x: 0, y: 0 },
    { x: box.w, y: 0 },
    { x: box.w, y: box.h },
    { x: 0, y: box.h },
  ];
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    const ex = b.x - a.x,
      ey = b.y - a.y,
      ax = box.x + a.x - cx,
      ay = box.y + a.y - cy;
    const cross = dx * ey - dy * ex;
    if (Math.abs(cross) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / cross,
      u = (ax * dy - ay * dx) / cross;
    if (t >= 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  if (!Number.isFinite(best)) return from;
  const t = best + gap / Math.hypot(dx, dy);
  return { x: cx + dx * t, y: cy + dy * t };
}
