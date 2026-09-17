import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cartesianSource = readFileSync(new URL("./cards/CartesianChartCard.tsx", import.meta.url), "utf8");
const chartFrameSource = readFileSync(new URL("./cards/chart-utils.tsx", import.meta.url), "utf8");

test("cartesian charts disable entry animation for every series type", () => {
  assert.match(cartesianSource, /<Bar[^>]+isAnimationActive=\{false\}/);
  assert.match(cartesianSource, /<Line[^>]+isAnimationActive=\{false\}/);
  assert.match(cartesianSource, /<Area[^>]+isAnimationActive=\{false\}/);
});

test("chart minimum width is applied outside ResponsiveContainer", () => {
  assert.match(chartFrameSource, /className="visual-chart-inner" style=\{canvasStyle\}/);
  assert.doesNotMatch(chartFrameSource, /<ResponsiveContainer[\s\S]*?style=\{canvasStyle\}/);
  assert.match(cartesianSource, /minWidth=\{Math\.max\(320, card\.labels\.length \* 52 \+ 80\)\}/);
});
