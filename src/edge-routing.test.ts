import { test } from "node:test";
import assert from "node:assert/strict";
import { smoothRoute, clipRoute, curvedRoute, loopRoute, routeReturn } from "./edge-routing";

const bend = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

test("short endpoint legs cannot be rounded underneath an arrowhead", () => {
  assert.doesNotMatch(smoothRoute([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 6, y: 100 }]), /Q/);
  assert.doesNotMatch(smoothRoute([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 100 }]), /Q/);
});

test("feedback paths keep a straight marker shaft after contour clipping in TB and LR", () => {
  for (const dir of ["TB", "LR"] as const) {
    const base = [{ x: 0, y: 0, w: 200, h: 60 }, { x: 0, y: 150, w: 200, h: 60 }];
    const boxes = dir === "TB" ? base : base.map(b => ({ x: b.y, y: b.x, w: b.h, h: b.w }));
    const route = routeReturn(boxes, boxes[1], boxes[0], dir, 400);
    const path = smoothRoute(clipRoute(route.points, boxes[1], boxes[0]), boxes);
    const numbers = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const [ax, ay, bx, by] = numbers.slice(-4);
    assert.ok(Math.hypot(bx - ax, by - ay) >= 12 - 1e-7, `${dir}: ${path}`);
    assert.ok(dir === "TB" ? ay === by && bx < ax : ax === bx && by < ay);
  }
});

test("clear bends become smooth while straight runs remain straight", () => {
  assert.match(smoothRoute(bend), /Q 100,0/);
  assert.doesNotMatch(smoothRoute([{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 0, y: 100 }]), /Q/);
});

test("smoothing shrinks or stops before entering a node or an edge label", () => {
  const blocked = smoothRoute(bend, [{ x: 99, y: 0, w: 10, h: 10 }]);
  assert.doesNotMatch(blocked, /Q/);
  const constrained = smoothRoute(bend, [{ x: 65, y: 8, w: 15, h: 10 }]);
  assert.notEqual(constrained, smoothRoute(bend));
  assert.match(constrained, /Q/);
});

test("other lines and their possible rounded bends constrain the curve envelope", () => {
  const crossing = [{ x: 98, y: -20 }, { x: 98, y: 50 }];
  assert.doesNotMatch(smoothRoute(bend, [], [crossing]), /Q/);
                                                                                
                                                                                
  const otherBend = [{ x: 50, y: 50 }, { x: 120, y: 50 }, { x: 120, y: -20 }];
  assert.notEqual(smoothRoute(bend, [], [otherBend]), smoothRoute(bend));
});

test("curved lines start and end on the route, and a straight route stays straight", () => {
  const route = [{ x: 0, y: 0 }, { x: 0, y: 60 }, { x: 80, y: 60 }, { x: 80, y: 140 }];
  const { path, clear } = curvedRoute(route, [], [], 12);
  assert.equal(clear, true);
  assert.match(path, /^M 0,0 /);
  assert.match(path, / L 80,140$/);
  assert.ok(path.includes(" C "), "bends become cubic pieces");
                                                                                             
  assert.match(path, / L 80,128 L 80,140$/);
  const straight = curvedRoute([{ x: 5, y: 0 }, { x: 5, y: 50 }, { x: 5, y: 100 }]).path;
  assert.ok([...straight.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].every((m) => Number(m[1]) === 5), straight);
});

test("a curve that would touch a node or another route is reported, a distant one on the same line is not", () => {
  const route = [{ x: 0, y: 0 }, { x: 0, y: 60 }, { x: 80, y: 60 }, { x: 80, y: 140 }];
                                                                                             
  assert.equal(curvedRoute(route, [{ x: 4, y: 40, w: 20, h: 16 }]).clear, false);
  assert.equal(curvedRoute(route, [{ x: 200, y: 0, w: 40, h: 40 }]).clear, true);
                                                                                  
  const upper = [{ x: 171, y: 82 }, { x: 171, y: 107 }, { x: 171, y: 132 }];
  const lower = [{ x: 171, y: 190 }, { x: 171, y: 240 }];
  assert.equal(curvedRoute(upper, [], [lower]).clear, true);
                                                                      
  assert.equal(curvedRoute(upper, [], [[{ x: 171, y: 100 }, { x: 171, y: 200 }]]).clear, true);
});

test("a return between adjacent ranks crosses their shared corridor instead of looping out and back", () => {
                                                                         
  const boxes = [{ x: 0, y: 0, w: 100, h: 40 }, { x: 200, y: 0, w: 100, h: 40 }, { x: 400, y: 0, w: 100, h: 40 }];
  const route = routeReturn(boxes, boxes[0], boxes[1], "LR", 600);
  assert.ok(route.points.every((p) => p.y <= 40 + 24), "stays beside the row, never down to the outer lane");
  const xs = route.points.map((p) => p.x);
  assert.ok(Math.min(...xs) >= 50 && Math.max(...xs) <= 250, "between the two node centres");
  for (let i = 1; i < route.points.length; i++) assert.notDeepEqual(route.points[i], route.points[i - 1]);
                                                          
  const far = routeReturn(boxes, boxes[0], boxes[2], "LR", 600);
  assert.ok(far.points.some((p) => p.y === 600));
});

                                                             
const loopPoints = (path: string) => {
  const n = path.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)!.map(Number);
  return [0, 2, 4, 6, 8].map((i) => ({ x: n[i], y: n[i + 1] }));
};
const cubicAt = ([s, c1, c2, e]: { x: number; y: number }[], t: number) => ({
  x: (1 - t) ** 3 * s.x + 3 * (1 - t) ** 2 * t * c1.x + 3 * (1 - t) * t ** 2 * c2.x + t ** 3 * e.x,
  y: (1 - t) ** 3 * s.y + 3 * (1 - t) ** 2 * t * c1.y + 3 * (1 - t) * t ** 2 * c2.y + t ** 3 * e.y,
});

test("a feedback loop is one arc whose apex reaches the route's farthest point", () => {
  for (const [start, end, axis] of [
    [{ x: 300, y: 400 }, { x: 320, y: 120 }, "x"],
    [{ x: 100, y: 300 }, { x: 420, y: 300 }, "y"],
  ] as const) {
    const reach = axis === "x" ? 420 : 340;
    const along = axis === "x" ? 260 : 260;
    const loop = loopRoute([start, end], reach, along, axis);
    assert.equal(loop.path.match(/ C /g)?.length, 1);
    const [s, c1, c2, neck, last] = loopPoints(loop.path);
    assert.deepEqual(s, start);
    assert.deepEqual(last, end);
    assert.ok(Math.abs(cubicAt([s, c1, c2, neck], 0.5)[axis] - reach) < 0.5, "apex on the reach");
                                                                               
    const tangent = Math.atan2(neck.y - c2.y, neck.x - c2.x), shaft = Math.atan2(end.y - neck.y, end.x - neck.x);
    assert.ok(Math.abs(tangent - shaft) < 1e-3);
    assert.ok(Math.abs(Math.hypot(end.x - neck.x, end.y - neck.y) - 12) < 1e-6);
                                                                     
    const cross = axis === "x" ? "y" : "x";
    assert.ok(Math.abs(loop.label[cross] - along) < 1e-6);
    const onArc = Array.from({ length: 2001 }, (_, i) => cubicAt([s, c1, c2, neck], i / 2000))
      .some((p) => Math.hypot(p.x - loop.label.x, p.y - loop.label.y) < 0.5);
    assert.ok(onArc);
    assert.equal(loop.clear, true);
  }
});

test("a feedback loop is checked along the arc itself, not its control polygon", () => {
  const route = [{ x: 300, y: 400 }, { x: 320, y: 120 }];
                                 
  assert.equal(loopRoute(route, 420, 260, "x", [{ x: 400, y: 240, w: 40, h: 30 }]).clear, false);
                                                                                           
  assert.equal(loopRoute(route, 420, 260, "x", [{ x: 380, y: 240, w: 30, h: 30 }]).clear, true);
                                 
  assert.equal(loopRoute(route, 420, 260, "x", [{ x: 600, y: 240, w: 30, h: 30 }]).clear, true);
});

test("a curve may keep a crossing its route already has, never add one", () => {
  const crossing = [{ x: 360, y: 0 }, { x: 360, y: 500 }];
                                                                                          
  assert.equal(loopRoute([{ x: 300, y: 400 }, { x: 320, y: 120 }], 420, 260, "x", [], [crossing]).clear, false);
                                                                                    
  const lane = [{ x: 300, y: 400 }, { x: 324, y: 400 }, { x: 324, y: 380 }, { x: 420, y: 380 },
    { x: 420, y: 140 }, { x: 344, y: 140 }, { x: 344, y: 120 }, { x: 320, y: 120 }];
  assert.equal(loopRoute(lane, 420, 260, "x", [], [crossing]).clear, true);
                                                   
  const bend = [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 200, y: 100 }];
  assert.equal(curvedRoute(bend, [], [[{ x: 100, y: 50 }, { x: 100, y: 150 }]]).clear, true);
  assert.equal(curvedRoute(bend, [], [[{ x: 40, y: 50 }, { x: 40, y: 95 }]]).clear, false);
});

test("a feedback route reports how far out it goes", () => {
  const boxes = [
    { x: 0, y: 0, w: 100, h: 40 },
    { x: 0, y: 100, w: 140, h: 40 },
    { x: 0, y: 200, w: 100, h: 40 },
  ];
  assert.equal(routeReturn(boxes, boxes[2], boxes[0], "TB", 500).reach, 500);
                                                     
  assert.equal(routeReturn(boxes, boxes[0], boxes[1], "TB", 500).reach, 140 + 24);
});
