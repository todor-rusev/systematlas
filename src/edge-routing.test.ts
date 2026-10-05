import { test } from "node:test";
import assert from "node:assert/strict";
import { smoothRoute, clipRoute, routeReturn } from "./edge-routing";

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
