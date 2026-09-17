import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { VISUAL_CARD_CATALOG } = await jiti.import("./catalog.ts");
const {
  dataTableStatusOptions,
  deriveDataTableRows,
  neutralizeSpreadsheetFormula,
  serializeDataTableCsv,
  serializeDataTableTsv,
} = await jiti.import("./data-table.ts");

function table(overrides = {}) {
  return {
    ...structuredClone(VISUAL_CARD_CATALOG["data-table"].example),
    ...overrides,
  };
}

test("filters data table rows by query and status before sorting", () => {
  const card = table({
    rows: [
      { suite: "Unit", passed: 12, status: "success" },
      { suite: "Integration", passed: 7, status: "warning" },
      { suite: "Browser", passed: 21, status: "success" },
    ],
  });

  assert.deepEqual(
    deriveDataTableRows(card, "br", {}, null).map(({ row }) => row.suite),
    ["Browser"],
  );
  assert.deepEqual(
    deriveDataTableRows(card, "", { status: "success" }, { columnId: "passed", direction: "descending" })
      .map(({ row }) => row.suite),
    ["Browser", "Unit"],
  );
  assert.deepEqual(dataTableStatusOptions(card, "status"), ["success", "warning"]);
});

test("sorts typed values stably and always leaves null values last", () => {
  const card = table({
    rows: [
      { suite: "First", passed: 2, status: "success" },
      { suite: "Second", passed: null, status: "neutral" },
      { suite: "Third", passed: 10, status: "warning" },
      { suite: "Fourth", passed: 2, status: "error" },
    ],
  });

  assert.deepEqual(
    deriveDataTableRows(card, "", {}, { columnId: "passed", direction: "ascending" })
      .map(({ row }) => row.suite),
    ["First", "Fourth", "Third", "Second"],
  );
  assert.deepEqual(
    deriveDataTableRows(card, "", {}, { columnId: "passed", direction: "descending" })
      .map(({ row }) => row.suite),
    ["Third", "First", "Fourth", "Second"],
  );
});

test("serializes all derived rows and neutralizes spreadsheet formulas", () => {
  const card = table({
    rows: [
      { suite: "=cmd|' /C calc'!A0", passed: 1, status: "warning" },
      { suite: "quoted, value", passed: 2, status: "success" },
      { suite: "Negative", passed: -12, status: "error" },
    ],
  });
  const rows = deriveDataTableRows(card, "", {}, null);
  const csv = serializeDataTableCsv(card, rows);
  const tsv = serializeDataTableTsv(card, rows);

  assert.ok(csv.startsWith("\uFEFFSuite,Passed,Status\r\n"));
  assert.match(csv, /'=cmd\|' \/C calc'!A0,1,warning/);
  assert.match(csv, /"quoted, value",2,success/);
  assert.match(csv, /Negative,-12,error/);
  assert.doesNotMatch(csv, /Negative,'-12/);
  assert.ok(csv.endsWith("\r\n"));
  assert.match(tsv, /^Suite\tPassed\tStatus/m);
  assert.match(tsv, /^'=cmd\|' \/C calc'!A0\t1\twarning/m);
  assert.match(tsv, /^Negative\t-12\terror/m);
  assert.equal(neutralizeSpreadsheetFormula("  +SUM(A1:A2)"), "  '+SUM(A1:A2)");
});
