import { clipToOutline, type Point, type Rect } from "./visual-geometry";

export type RouteBox = Rect & { outline?: Point[]; anchor?: Point };

                                                                                   
export function clipRoute(points: Point[], source: RouteBox, target: RouteBox, gap = 2): Point[] {
  const out = points.map(p => ({ ...p }));
  if (out.length < 2) return out;
  out[0] = clipToOutline(source, points[1], gap);
  out[out.length - 1] = clipToOutline(target, points[points.length - 2], 6);
  return out;
}

                                                                              
                                                                                        
                                                                                        
                                                                                     
                                                      
function intersects(a: Point[], b: Point[], alongEdges = false): boolean {
  const separated = (nx: number, ny: number) => {
    const aa = a.map(v => v.x * nx + v.y * ny), bb = b.map(v => v.x * nx + v.y * ny);
    return Math.max(...aa) < Math.min(...bb) - 1e-7 || Math.max(...bb) < Math.min(...aa) - 1e-7;
  };
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const dx = q.x - p.x, dy = q.y - p.y;
      if (!dx && !dy) continue;
      if (separated(dy, -dx) || (alongEdges && separated(dx, dy))) return false;
    }
  }
  return true;
}

                                                                              
                                                                            
                                                                                 
                                                                           
export function smoothRoute(points: Point[], boxes: Rect[] = [], otherRoutes: Point[][] = [], radius = 36, terminalShaft = 12): string {
  if (points.length < 2) return "";
  const obstacles = boxes.map(b => [
    { x: b.x - 3, y: b.y - 3 }, { x: b.x + b.w + 3, y: b.y - 3 },
    { x: b.x + b.w + 3, y: b.y + b.h + 3 }, { x: b.x - 3, y: b.y + b.h + 3 },
  ]);
  const segments = otherRoutes.flatMap(route => [
    ...route.slice(1).map((b, i) => [route[i], b]),
                                                                            
                                                                                 
    ...route.slice(1, -1).flatMap((at, i) => {
      const prev = route[i], next = route[i + 2];
      const cross = (at.x - prev.x) * (next.y - at.y) - (at.y - prev.y) * (next.x - at.x);
      return Math.abs(cross) < 1e-7 ? [] : [[prev, at, next]];
    }),
  ]);
  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], at = points[i], next = points[i + 1];
    const before = Math.hypot(at.x - prev.x, at.y - prev.y), after = Math.hypot(next.x - at.x, next.y - at.y);
    const cross = (at.x - prev.x) * (next.y - at.y) - (at.y - prev.y) * (next.x - at.x);
                                                                           
                                                                               
    let trim = Math.abs(cross) < 1e-7 ? 0 : Math.max(0, Math.min(radius, before / 2, after / 2,
      i === 1 ? before - terminalShaft : Infinity,
      i === points.length - 2 ? after - terminalShaft : Infinity));
                                                                                 
    const own = [
      ...points.slice(1).flatMap((b, j) => j === i - 1 || j === i ? [] : [[points[j], b]]),
      ...points.slice(1, -1).flatMap((at, j) => Math.abs(j + 1 - i) <= 1 ? [] : [[points[j], at, points[j + 2]]]),
    ];
    let a = at, b = at;
    while (trim >= 2) {
      a = { x: at.x + (prev.x - at.x) * trim / before, y: at.y + (prev.y - at.y) * trim / before };
      b = { x: at.x + (next.x - at.x) * trim / after, y: at.y + (next.y - at.y) * trim / after };
      const hull = [a, at, b];
      if (![...obstacles, ...segments, ...own].some(obstacle => intersects(hull, obstacle))) break;
      trim /= 2;
    }
    path += trim >= 2 ? ` L ${a.x},${a.y} Q ${at.x},${at.y} ${b.x},${b.y}` : ` L ${at.x},${at.y}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${last.x},${last.y}`;
}

                                                                                    
function flatten(pieces: Point[][], steps: number): Point[] {
  const out = [pieces[0][0]];
  for (const piece of pieces) {
    if (piece.length === 2) { out.push(piece[1]); continue; }
    const [a, b, c, d] = piece;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      out.push({ x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x, y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y });
    }
  }
  return out;
}

const bounds = (points: Point[]) => {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

                                                                                         
function touches(a: Point[], b: Point[]): boolean {
  const sb = b.slice(1).map((q, i) => ({ seg: [b[i], q], box: bounds([b[i], q]) }));
  for (let i = 1; i < a.length; i++) {
    const seg = [a[i - 1], a[i]], box = bounds(seg);
    for (const other of sb) {
      if (box.x1 < other.box.x0 || other.box.x1 < box.x0 || box.y1 < other.box.y0 || other.box.y1 < box.y0) continue;
      if (intersects(seg, other.seg, true)) return true;
    }
  }
  return false;
}

   
                                                                                      
                                                                                     
                                                                                        
                                                                                       
                                                     
   
function pathClear(curve: Point[], route: Point[], boxes: Rect[], otherRoutes: Point[][]): boolean {
  const curveBox = bounds(curve);
  for (const b of boxes) {
    if (b.x - 3 > curveBox.x1 || curveBox.x0 > b.x + b.w + 3 || b.y - 3 > curveBox.y1 || curveBox.y0 > b.y + b.h + 3) continue;
    const rect = [
      { x: b.x - 3, y: b.y - 3 }, { x: b.x + b.w + 3, y: b.y - 3 },
      { x: b.x + b.w + 3, y: b.y + b.h + 3 }, { x: b.x - 3, y: b.y + b.h + 3 },
    ];
    if (curve.slice(1).some((q, i) => intersects([curve[i], q], rect, true))) return false;
  }
  return otherRoutes.every(other => !touches(curve, other) || touches(route, other));
}

   
                                                                                   
                                                                                    
                                                                                      
                                                                                    
                                   
   
export function curvedRoute(points: Point[], boxes: Rect[] = [], otherRoutes: Point[][] = [], terminalShaft = 12): { path: string; clear: boolean } {
  if (points.length < 2) return { path: "", clear: true };
  const end = points[points.length - 1], before = points[points.length - 2];
  const length = Math.hypot(end.x - before.x, end.y - before.y) || 1;
  const shaft = Math.min(terminalShaft, length / 2);
                                                                              
  const neck = { x: end.x - ((end.x - before.x) / length) * shaft, y: end.y - ((end.y - before.y) / length) * shaft };
  const p = [...points.slice(0, -1), neck];
  const at = (a: Point, b: Point, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const pieces: Point[][] = [];
  if (p.length === 2) pieces.push([p[0], p[1]]);
  else {
                                                                                          
                                                                                           
    const knot = (a: Point, b: Point, c: Point) => ({ x: (a.x + 4 * b.x + c.x) / 6, y: (a.y + 4 * b.y + c.y) / 6 });
    const n = p.length - 1;
    let from = at(p[0], p[1], 1 / 6);
    pieces.push([p[0], from]);
    for (let j = 0; j < n; j++) {
      const to = j < n - 1 ? knot(p[j], p[j + 1], p[j + 2]) : at(p[n - 1], p[n], 5 / 6);
      pieces.push([from, at(p[j], p[j + 1], 1 / 3), at(p[j], p[j + 1], 2 / 3), to]);
      from = to;
    }
    pieces.push([from, p[n]]);
  }
  const clear = pathClear([...flatten(pieces, 12), end], points, boxes, otherRoutes);
  let path = `M ${p[0].x},${p[0].y}`;
  for (const piece of pieces) {
    path += piece.length === 2 ? ` L ${piece[1].x},${piece[1].y}` : ` C ${piece[1].x},${piece[1].y} ${piece[2].x},${piece[2].y} ${piece[3].x},${piece[3].y}`;
  }
  return { path: `${path} L ${end.x},${end.y}`, clear };
}

   
                                                                                          
                                                                                         
                                                                                          
                                                                                      
                                                                                       
                                                                                          
                                                                                        
                                                                  
   
export function loopRoute(route: Point[], reach: number, along: number, axis: "x" | "y", boxes: Rect[] = [],
  otherRoutes: Point[][] = [], terminalShaft = 12): { path: string; clear: boolean; label: Point } {
  const start = route[0], end = route[route.length - 1];
  const cross = axis === "x" ? "y" : "x";
  const point = (a: number, c: number): Point => (axis === "x" ? { x: a, y: c } : { x: c, y: a });
  const controls = (to: Point) => {
                                                                                                     
    const level = (reach - (start[axis] + to[axis]) / 8) / 0.75;
    const third = (to[cross] - start[cross]) / 3;
    return [point(level, start[cross] + third), point(level, to[cross] - third)];
  };
                                                                                      
                                                       
  let neck = end;
  for (let i = 0; i < 4; i++) {
    const [, c2] = controls(neck);
    const length = Math.hypot(c2.x - end.x, c2.y - end.y) || 1;
    neck = { x: end.x + ((c2.x - end.x) / length) * terminalShaft, y: end.y + ((c2.y - end.y) / length) * terminalShaft };
  }
  const [c1, c2] = controls(neck);
                                                                                        
                                                               
  const span = neck[cross] - start[cross];
  const t = span ? Math.min(1, Math.max(0, (along - start[cross]) / span)) : 0.5;
  const bezier = (k: "x" | "y") =>
    (1 - t) ** 3 * start[k] + 3 * (1 - t) ** 2 * t * c1[k] + 3 * (1 - t) * t ** 2 * c2[k] + t ** 3 * neck[k];
  const label = { x: bezier("x"), y: bezier("y") };
  const clear = pathClear(flatten([[start, c1, c2, neck], [neck, end]], 48), route, boxes, otherRoutes);
  return {
    path: `M ${start.x},${start.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${neck.x},${neck.y} L ${end.x},${end.y}`,
    clear,
    label,
  };
}

                                                                                  
function corridors(boxes: Rect[], axis: "x" | "y", box: Rect) {
  const size = axis === "x" ? "w" : "h";
  const groups: { start: number; end: number }[] = [];
  for (const item of [...boxes].sort((a, b) => a[axis] - b[axis])) {
    const start = item[axis], end = start + item[size];
    const last = groups[groups.length - 1];
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else groups.push({ start, end });
  }
  const middle = box[axis] + box[size] / 2;
  const index = groups.findIndex(group => middle >= group.start && middle <= group.end);
  const group = groups[index];
  return {
    before: index > 0 ? (groups[index - 1].end + group.start) / 2 : group.start - 32,
    after: index + 1 < groups.length ? (group.end + groups[index + 1].start) / 2 : group.end + 32,
  };
}

                                                                               
                                                                                     
                                                                                     
                                      
export function routeReturn(boxes: Rect[], source: Rect, target: Rect, dir: "TB" | "LR", lane: number): {
  points: Point[]; label: Point; reach: number;
} {
  const horizontal = dir === "TB";
  const axis = horizontal ? "y" : "x";
  const from = corridors(boxes, axis, source), to = corridors(boxes, axis, target);
  const stem = 24;                                                                      
                                                                                      
                                                                                   
                                                                               
  const shared = from.after === to.before ? from.after : undefined;
                                                                                        
  const distinct = (points: Point[]) => points.filter((p, i) => !i || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  if (horizontal) {
    const sx = source.x + source.w, sy = source.y + source.h / 2;
    const tx = target.x + target.w, ty = target.y + target.h / 2;
    if (shared !== undefined) {
      return {
        points: distinct([{ x: sx, y: sy }, { x: sx + stem, y: sy }, { x: sx + stem, y: shared },
          { x: tx + stem, y: shared }, { x: tx + stem, y: ty }, { x: tx, y: ty }]),
        label: { x: (sx + tx) / 2 + stem, y: shared },
        reach: Math.max(sx, tx) + stem,
      };
    }
    return {
      points: [{ x: sx, y: sy }, { x: sx + stem, y: sy }, { x: sx + stem, y: from.after },
        { x: lane, y: from.after }, { x: lane, y: to.before }, { x: tx + stem, y: to.before },
        { x: tx + stem, y: ty }, { x: tx, y: ty }],
      label: { x: lane, y: (from.after + to.before) / 2 },
      reach: lane,
    };
  }
  const sx = source.x + source.w / 2, sy = source.y + source.h;
  const tx = target.x + target.w / 2, ty = target.y + target.h;
  if (shared !== undefined) {
    return {
      points: distinct([{ x: sx, y: sy }, { x: sx, y: sy + stem }, { x: shared, y: sy + stem },
        { x: shared, y: ty + stem }, { x: tx, y: ty + stem }, { x: tx, y: ty }]),
      label: { x: shared, y: (sy + ty) / 2 + stem },
      reach: Math.max(sy, ty) + stem,
    };
  }
  return {
    points: [{ x: sx, y: sy }, { x: sx, y: sy + stem }, { x: from.after, y: sy + stem },
      { x: from.after, y: lane }, { x: to.before, y: lane }, { x: to.before, y: ty + stem },
      { x: tx, y: ty + stem }, { x: tx, y: ty }],
    label: { x: (from.after + to.before) / 2, y: lane },
    reach: lane,
  };
}
