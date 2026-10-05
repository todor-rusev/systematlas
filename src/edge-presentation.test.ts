import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Position, ReactFlowProvider, type EdgeProps } from "@xyflow/react";
import { FtEdge } from "./edges";
import { LINE_STYLES } from "./core/visual-vocabulary";
import { VISUAL_PRESETS, type PresetName } from "./visual-tokens";
import { routeReturn } from "./edge-routing";

test("default and explicit arrowheads have fixed dimensions for thick, double and selected edges", () => {
  for (const visualPreset of Object.keys(VISUAL_PRESETS) as PresetName[]) {
    for (const line of LINE_STYLES) {
      for (const width of ["normal", "thick"] as const) {
        for (const selected of [false, true]) {
          for (const explicit of [false, true]) {
            const props = {
              id: "edge", source: "a", target: "b", sourceX: 0, sourceY: 0,
              targetX: 0, targetY: 120, sourcePosition: Position.Bottom,
              targetPosition: Position.Top, selected,
              data: { edgeType: "flow", visualPreset, style: { line, width, ...(explicit ? { start: "arrow", end: "arrow" } : {}) } },
            } as EdgeProps;
            const markup = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement("svg", null, createElement(FtEdge, props))));
            assert.match(markup, /markerUnits="userSpaceOnUse"/);
            const headSize = VISUAL_PRESETS[visualPreset].edge.headSize;
            assert.match(markup, new RegExp(`markerWidth="${headSize}" markerHeight="${headSize}"`));
            assert.doesNotMatch(markup, /markerUnits="strokeWidth"/);
            if (line === "invisible" && !selected) assert.doesNotMatch(markup, /marker-end=/);
            else assert.match(markup, /marker-end="url\(#ft-marker-/);
          }
        }
      }
    }
  }
});

test("feedback corridors avoid tall siblings and stay separate from forward routes in both directions", () => {
  const vertical = [
    { x: 0, y: 0, w: 200, h: 80 },
    { x: 0, y: 150, w: 180, h: 60 },
    { x: 230, y: 130, w: 150, h: 100 },
    { x: 0, y: 300, w: 200, h: 80 },
  ];
  for (const dir of ["TB", "LR"] as const) {
    const boxes = dir === "TB" ? vertical : vertical.map(b => ({ x: b.y, y: b.x, w: b.h, h: b.w }));
    const route = routeReturn(boxes, boxes[1], boxes[0], dir, 450);
    assert.equal(dir === "TB" ? route.label.x : route.label.y, 450);
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i];
      assert.ok(a.x === b.x || a.y === b.y, "orthogonal route");
      for (const box of boxes) {
        const crosses = a.x === b.x
          ? a.x > box.x && a.x < box.x + box.w && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.h
          : a.y > box.y && a.y < box.y + box.h && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.w;
        assert.equal(crosses, false, `${dir}: a sibling obstructs the feedback route`);
      }
    }
  }
});
