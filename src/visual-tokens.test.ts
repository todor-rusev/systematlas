import { test } from "node:test";
import assert from "node:assert/strict";
import { PASTELS, VISUAL_PRESETS, actorBaseColors, actorTone, autoActorColor, contrastRatio, detailInk } from "./visual-tokens";

const hsl = (h: number, s: number, l: number) => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};
const hues = Array.from({ length: 72 }, (_, i) => i * 5);

test("every hue in every preset gives readable ink and a visible outline", () => {
  for (const [name, preset] of Object.entries(VISUAL_PRESETS)) {
    for (const hue of hues) {
      for (const base of [hsl(hue, 0.55, 0.55), hsl(hue, 0.9, 0.8), hsl(hue, 0.4, 0.3)]) {
        const t = actorTone(base, preset);
        assert.ok(contrastRatio(t.ink, t.fill) >= 4.5, `${name} ${base} ink ${t.ink} on ${t.fill}`);
        assert.ok(contrastRatio(t.outline, t.fill) >= 1.25, `${name} ${base} outline ${t.outline} on ${t.fill}`);
        assert.ok(contrastRatio(detailInk(t), t.fill) >= 3, `${name} ${base} detail on fill`);
        assert.ok(contrastRatio(t.ink, preset.canvas.background) >= 4.5, `${name} ${base} ink on canvas`);
      }
    }
    assert.ok(contrastRatio(preset.terminal.ink, preset.terminal.fill) >= 4.5, `${name} terminal`);
    assert.ok(contrastRatio(detailInk(preset.terminal), preset.terminal.fill) >= 3, `${name} terminal detail`);
    assert.ok(contrastRatio(preset.edge.labelInk, preset.canvas.background) >= 4.5, `${name} edge label`);
  }
});

test("automatic actors are told apart by hue: the first eight never collide in any preset", () => {
  const lab = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const dE = (a: string, b: string) => { const x = lab(a), y = lab(b); return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  const bases = Array.from({ length: 8 }, (_, i) => autoActorColor(i));
  for (const [name, preset] of Object.entries(VISUAL_PRESETS)) {
    const tones = bases.map((b) => actorTone(b, preset));
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
                                                                                                      
      const carrier = Math.max(dE(tones[i].fill, tones[j].fill), preset.node.outlineWidth ? dE(tones[i].outline, tones[j].outline) : 0);
      assert.ok(carrier >= 2.5, `${name} actors ${i}/${j}: fill/outline ΔE ${carrier.toFixed(1)}`);
      assert.ok(dE(tones[i].ink, tones[j].ink) >= 5, `${name} ink ${i}/${j}`);
    }
  }
  assert.notEqual(autoActorColor(8), autoActorColor(0));
});

test("every actor lands in the predefined palette; explicit colours take the nearest free pastel", () => {
  const pastel = (name: string) => autoActorColor(PASTELS.findIndex((p) => p.name === name));
  const colors = actorBaseColors([
    { id: "a", color: "#ff0000" },                        
    { id: "b", color: "#ee1111" },                                                                
    { id: "c" }, { id: "d", color: "#808080" },                                            
  ]);
  assert.equal(colors.a, pastel("rose"));
  assert.notEqual(colors.b, colors.a);
  assert.equal(colors.c, pastel("sky"));
  assert.equal(colors.d, pastel("mint"), "grey has no hue: it takes the next free pastel (peach went to the second red)");
  assert.equal(new Set(Object.values(colors)).size, 4);
  const many = actorBaseColors(Array.from({ length: 10 }, (_, i) => ({ id: `x${i}` })));
  assert.equal(new Set(Object.values(many)).size, 10, "beyond the palette: golden-angle hues, still distinct");
});

test("tones keep the actor's hue family; grey stays neutral; shorthand hex works", () => {
  const p = VISUAL_PRESETS.cards;
  const red = actorTone("#d04040", p), blue = actorTone("#4060d0", p);
  assert.notEqual(red.fill, blue.fill);
  assert.ok(parseInt(red.fill.slice(1, 3), 16) > parseInt(red.fill.slice(5, 7), 16), "red fill leans red");
  assert.ok(parseInt(blue.fill.slice(5, 7), 16) > parseInt(blue.fill.slice(1, 3), 16), "blue fill leans blue");
  const grey = actorTone("#808080", p);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(grey.fill.slice(i, i + 2), 16));
  assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 2, `grey fill ${grey.fill}`);
  assert.deepEqual(actorTone("#c44", p), actorTone("#cc4444", p));
});
