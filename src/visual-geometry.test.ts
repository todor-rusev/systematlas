import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHAPE_NAMES, ICON_NAMES, LINE_STYLES } from "./core/visual-vocabulary";
import { nodeGeometry, shapeGeometry, clipToOutline } from "./visual-geometry";
import { validateFlow } from "./core/validate";
import { buildGraph, DIMS } from "./layout";
import type { FlowDocument } from "./core/types";
import type { NodeData } from "./model";
import { VISUAL_PRESETS, type PresetName } from "./visual-tokens";
import {
  buildActorColors,
  PASTEL_PALETTE,
  drillStroke,
  FLOW_LABEL,
} from "./theme";

const doc = (): FlowDocument => ({
  version: "2",
  id: "visual-test",
  title: "Visual test",
  actors: [{ id: "a", label: "Owner", kind: "service" }],
  nodes: [
    {
      id: "n",
      type: "step",
      text: "Save the result",
      details: "Persists the result.",
      owner: "a",
    },
  ],
  edges: [],
});

test("every catalog shape, built-in icon and line style is accepted by the canonical schema", () => {
  const schema = JSON.parse(
    readFileSync(
      new URL("../schema/flow.schema.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(schema.$defs.node.properties.shape.enum, SHAPE_NAMES);
  assert.deepEqual(
    schema.$defs.nodeIcon.oneOf[0].properties.name.enum,
    ICON_NAMES,
  );
  for (const shape of SHAPE_NAMES) {
    const d = doc();
    d.nodes[0].shape = shape;
    assert.equal(validateFlow(d).ok, true, shape);
  }
  for (const name of ICON_NAMES) {
    const d = doc();
    d.nodes[0].icon = { kind: "builtin", name };
    assert.equal(validateFlow(d).ok, true, name);
  }
  for (const line of LINE_STYLES) {
    const d = doc();
    d.edges = [
      {
        from: "n",
        to: "n",
        type: "return",
        style: { line, width: "thick", start: "circle", end: "cross" },
      },
    ];
    assert.equal(validateFlow(d).ok, true, line);
  }
});

test("custom icons accept bounded vector data but refuse executable markup, URLs and invalid dimensions", () => {
  const good = {
    kind: "svg",
    viewBox: [0, 0, 24, 24],
    paths: [{ d: "M2 2L22 2L12 22Z", fill: "currentColor", strokeWidth: 1.5 }],
  };
  for (const icon of [good, { kind: "emoji", text: "👩‍💻" }]) {
    const d = doc();
    d.nodes[0].icon = icon as never;
    assert.equal(validateFlow(d).ok, true);
  }
  for (const icon of [
    { ...good, svg: "<svg onload='alert(1)'/>" },
    { ...good, viewBox: [0, 0, 0, 24] },
    { ...good, paths: [{ d: "<script/>" }] },
    { ...good, paths: [{ d: "M0 0", fill: "url(https://example.com/a.svg)" }] },
    { ...good, paths: [{ d: "M0 0", onload: "alert(1)" }] },
    { kind: "builtin", name: "unknown" },
    { kind: "emoji", text: "" },
  ]) {
    const d = doc();
    d.nodes[0].icon = icon as never;
    assert.equal(validateFlow(d).ok, false, JSON.stringify(icon));
  }
});

function inside(x: number, y: number, pts: { x: number; y: number }[]) {
  let yes = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
    if (Math.abs(cross) < 1e-7 && x >= Math.min(a.x, b.x) - 1e-7 && x <= Math.max(a.x, b.x) + 1e-7 &&
      y >= Math.min(a.y, b.y) - 1e-7 && y <= Math.max(a.y, b.y) + 1e-7) return true;
    if (
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
test("shape caption boxes stay inside the rendered outline for all non-symbol shapes", () => {
  for (const shape of SHAPE_NAMES) {
    const g = nodeGeometry({
      type: "step",
      shape,
      text: "Save result",
      icon: { kind: "builtin", name: "database" },
    });
    assert.ok(g.w > 0 && g.h > 0 && Number.isFinite(g.w + g.h), shape);
    const c = g.content;
    if (g.captionOutside) continue;                                                        
    for (const [x, y] of [
      [c.x, c.y],
      [c.x + c.w, c.y],
      [c.x, c.y + c.h],
      [c.x + c.w, c.y + c.h],
    ]) {
      assert.ok(inside(x, y, g.outline), `${shape}: caption corner ${x},${y}`);
    }
  }
});

test("labels grow the reserved node dimensions, icons and drill controls have separate space", () => {
  const short = nodeGeometry({ type: "step", text: "Save" });
  const long = nodeGeometry({
    type: "step",
    text:
      "A considerably longer explanation of all application checkpoints and the next stage of processing",
  });
  const token = nodeGeometry({
    type: "step",
    text: "SomeExtremelyLongButReadableIdentifierForAPublicMethodCall",
  });
  assert.ok(long.h > short.h);
  assert.ok(token.w > short.w);
  const withExtras = nodeGeometry({
    type: "step",
    text: "Save",
    icon: { kind: "builtin", name: "database" },
    sequence: "details",
  });
  assert.ok(withExtras.w > short.w);
  assert.ok(
    nodeGeometry({ type: "step", text: "One\nTwo\nThree" }).h > short.h,
  );
});

test("all shapes keep captions, icons and drill controls inside across presets", () => {
  for (const preset of Object.keys(VISUAL_PRESETS) as PresetName[]) {
    for (const shape of SHAPE_NAMES) {
      for (const label of ["Store", "A longer caption\nwith a second line and details"]) {
        const g = nodeGeometry({ type: "subflow", shape, text: label,
          icon: { kind: "builtin", name: "database" }, subflow: "details" }, undefined, preset);
        const c = g.content;
        for (const x of [c.x, c.x + c.w]) for (const y of [c.y, c.y + c.h]) {
          assert.ok(inside(x, y, g.outline), `${preset}/${shape}: ${x},${y}`);
        }
        assert.ok(g.outline.every(p => p.x >= -1e-7 && p.x <= g.w + 1e-7 && p.y >= -1e-7 && p.y <= g.h + 1e-7), `${preset}/${shape}`);
      }
    }
  }
});

test("bucket rim belongs to the filled silhouette and folded cards have a real cut corner", () => {
  const bucket = shapeGeometry("bucket", 300, 120);
  const rim = clipToOutline({ x: 0, y: 0, ...bucket }, { x: 150, y: -120 }, 0);
  assert.ok(rim.y < 2, "fill reaches the upper rim instead of starting below a floating ellipse");
  const tag = shapeGeometry("tag-rect", 300, 120);
  assert.equal(inside(299, 1, tag.outline), false, "the fold replaces the rounded card corner");
  assert.equal(inside(270, 30, tag.outline), true, "the area below the fold remains filled");
});

test("drill cards retain explicit shapes and reserve a readable Open control on every shape", () => {
  const subflow = nodeGeometry({
    type: "subflow",
    text: "Charge payment",
    subflow: "payment",
  });
  assert.equal(subflow.shape, "rounded");
  for (const shape of SHAPE_NAMES) {
    const g = nodeGeometry({
      type: "subflow",
      shape,
      text: "Inspect result",
      subflow: "payment",
      icon: { kind: "builtin", name: "file" },
    });
    assert.equal(g.shape, shape);
    assert.ok(g.content.w >= (g.symbol ? 140 + 66 : g.stacked ? 100 : 140 + 38 + 66 + 18) - 1, shape);
    assert.ok(g.content.h >= (g.symbol ? 28 : 28 + 12), shape);
  }
  for (const fill of PASTEL_PALETTE) {
    const stroke = drillStroke(fill);
    assert.match(stroke, /^#[0-9a-f]{6}$/);
    assert.ok(
      [1, 3, 5].every(
        (offset) =>
          parseInt(stroke.slice(offset, offset + 2), 16) <
          parseInt(fill.slice(offset, offset + 2), 16),
      ),
    );
  }
});

test("multilingual captions reserve all explicit lines with icons and drill controls", () => {
  const example = JSON.parse(
    readFileSync(new URL("../examples/multilingual.flow.json", import.meta.url), "utf8"),
  ) as FlowDocument;
  assert.equal(validateFlow(example).ok, true);
  for (const node of example.nodes) {
    for (const shape of ["rounded", "diam", "cyl"] as const) {
      const g = nodeGeometry({
        ...node,
        shape,
        icon: { kind: "builtin", name: "file" },
        sequence: "details",
      });
      assert.ok(
        g.content.h >= 2 * FLOW_LABEL.lineHeight + 12,
        `${node.id}/${shape}`,
      );
      assert.ok(g.content.w >= 100, `${node.id}/${shape}`);
    }
  }
});

test("large actor sets avoid repeating the base palette and short hex works with alpha suffixes", () => {
  const actors = Array.from({ length: 100 }, (_, i) => ({
    id: `a${i}`,
    label: `Actor ${i}`,
    kind: "service" as const,
  }));
  assert.equal(new Set(Object.values(buildActorColors(actors))).size, 100);
  assert.equal(
    buildActorColors([{ id: "a", label: "A", kind: "service", color: "#abc" }])
      .a,
    "#aabbcc",
  );
});

test("filled actor colors stay in the pastel palette, including explicit saturated colors, with readable dark text", () => {
  assert.equal(new Set(PASTEL_PALETTE).size, 72);
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((offset) => {
      const s = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const color of PASTEL_PALETTE) {
    assert.ok(
      (luminance(color) + 0.05) / (luminance("#2a2722") + 0.05) >= 7,
      color,
    );
  }
  const actors = Array.from({ length: 150 }, (_, index) => ({
    id: `owner-${index}`,
    label: `Owner ${index}`,
    kind: "service" as const,
    color:
      index < 8
        ? [
            "#f00",
            "#00f",
            "#0f0",
            "#000",
            "#fff",
            "#abc",
            "#c71566",
            "#087f78",
          ][index]
        : undefined,
  }));
  const colors = buildActorColors(actors, "pastel");
  for (const color of Object.values(colors))
    assert.ok(PASTEL_PALETTE.includes(color), color);
  assert.equal(buildActorColors(actors)["owner-0"], "#ff0000");
  assert.equal(buildActorColors(actors)["owner-1"], "#0000ff");
  assert.equal(buildActorColors(actors)["owner-2"], "#00ff00");
  assert.ok(
    parseInt(colors["owner-0"].slice(1, 3), 16) >
      parseInt(colors["owner-0"].slice(3, 5), 16),
  );
  assert.ok(
    parseInt(colors["owner-1"].slice(5, 7), 16) >
      parseInt(colors["owner-1"].slice(1, 3), 16),
  );
});

test("soft polygon corners and capsule caps share their real curves with edge clipping", () => {
  for (const shape of ["rect", "lean-r", "diam"] as const) {
    const g = shapeGeometry(shape, 200, 80);
    assert.ok(g.path.includes("C"), shape);
    assert.ok(
      g.outline.every((p) => Number.isFinite(p.x + p.y)),
      shape,
    );
  }
  const rect = shapeGeometry("rect", 200, 80);
  const corner = clipToOutline(
    { x: 0, y: 0, w: 200, h: 80, outline: rect.outline },
    { x: 300, y: -40 },
    0,
  );
  assert.ok(corner.x < 200 && corner.y > 0);
  assert.ok(Math.abs(Math.hypot(corner.x - 192, corner.y - 8) - 8) < 0.1,
    "the endpoint lies on the real 8px corner, not the bounding rectangle");
  const capsule = shapeGeometry("stadium", 200, 80);
  const cap = clipToOutline(
    { x: 0, y: 0, w: 200, h: 80, outline: capsule.outline },
    { x: 300, y: -40 },
    0,
  );
  assert.ok(Math.abs(Math.hypot(cap.x - 160, cap.y - 40) - 40) < 0.1);
});

test("edge endpoints clip to a diamond and ellipse instead of their bounding rectangle", () => {
  const diamond = shapeGeometry("diam", 200, 200);
  const out = clipToOutline(
    { x: 0, y: 0, w: 200, h: 200, outline: diamond.outline },
    { x: 300, y: 300 },
    0,
  );
  assert.ok(Math.abs(out.x - 150) < 0.01 && Math.abs(out.y - 150) < 0.01);
  const circle = shapeGeometry("circle", 200, 200);
  const p = clipToOutline(
    { x: 0, y: 0, w: 200, h: 200, outline: circle.outline },
    { x: 300, y: 300 },
    0,
  );
  assert.ok(Math.abs(Math.hypot(p.x - 100, p.y - 100) - 100) < 0.1);
  const dot = nodeGeometry({
    type: "step",
    shape: "sm-circ",
    text: "Connector caption",
  });
  const exit = clipToOutline(
    { x: 0, y: 0, w: dot.w, h: dot.h, outline: dot.outline },
    { x: dot.w / 2, y: dot.h * 2 },
    0,
  );
  assert.ok(
    exit.y >= dot.content.y + dot.content.h - 1,
    "outgoing route clears the external caption",
  );
});

test("extended layout reserves actual geometry and classic keeps the legacy appearance on old documents", () => {
  const d = doc();
  d.nodes.push({ ...d.nodes[0], id: "end", type: "terminal", text: "Done" });
  d.edges.push({ from: "n", to: "end", type: "flow" });
  const modern = buildGraph(d, { a: "#abc" });
  for (const n of modern.nodes) {
    const g = (n.data as NodeData).geometry!;
    assert.equal(n.width, g.w);
    assert.equal(n.height, g.h);
  }
  const old = buildGraph(d, { a: "#abc" }, { visualMode: "classic" });
  assert.equal(old.nodes[0].type, "step");
  assert.equal((old.nodes[0].data as NodeData).geometry, undefined);
  assert.equal(DIMS.step.w, 200);
  d.nodes[0].shape = "cyl";
  assert.equal(
    buildGraph(d, { a: "#abc" }, { visualMode: "classic" }).nodes[0].type,
    "visual",
  );
});
