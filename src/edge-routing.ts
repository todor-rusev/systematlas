import { clipToOutline, type Point, type Rect } from "./visual-geometry";

export type RouteBox = Rect & { outline?: Point[]; anchor?: Point };

                                                                                   
export function clipRoute(points: Point[], source: RouteBox, target: RouteBox, gap = 2): Point[] {
  const out = points.map(p => ({ ...p }));
  if (out.length < 2) return out;
  out[0] = clipToOutline(source, points[1], gap);
  out[out.length - 1] = clipToOutline(target, points[points.length - 2], 6);
  return out;
}

                                                                                 
function intersects(a: Point[], b: Point[]): boolean {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const nx = q.y - p.y, ny = p.x - q.x;
      if (!nx && !ny) continue;
      const aa = a.map(v => v.x * nx + v.y * ny), bb = b.map(v => v.x * nx + v.y * ny);
      if (Math.max(...aa) < Math.min(...bb) - 1e-7 || Math.max(...bb) < Math.min(...aa) - 1e-7) return false;
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
  points: Point[]; label: Point;
} {
  const horizontal = dir === "TB";
  const axis = horizontal ? "y" : "x";
  const from = corridors(boxes, axis, source), to = corridors(boxes, axis, target);
  const stem = 24;                                                                      
  if (horizontal) {
    const sx = source.x + source.w, sy = source.y + source.h / 2;
    const tx = target.x + target.w, ty = target.y + target.h / 2;
    return {
      points: [{ x: sx, y: sy }, { x: sx + stem, y: sy }, { x: sx + stem, y: from.after },
        { x: lane, y: from.after }, { x: lane, y: to.before }, { x: tx + stem, y: to.before },
        { x: tx + stem, y: ty }, { x: tx, y: ty }],
      label: { x: lane, y: (from.after + to.before) / 2 },
    };
  }
  const sx = source.x + source.w / 2, sy = source.y + source.h;
  const tx = target.x + target.w / 2, ty = target.y + target.h;
  return {
    points: [{ x: sx, y: sy }, { x: sx, y: sy + stem }, { x: from.after, y: sy + stem },
      { x: from.after, y: lane }, { x: to.before, y: lane }, { x: to.before, y: ty + stem },
      { x: tx, y: ty + stem }, { x: tx, y: ty }],
    label: { x: (from.after + to.before) / 2, y: lane },
  };
}
