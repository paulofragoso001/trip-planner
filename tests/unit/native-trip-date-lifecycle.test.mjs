import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  "ios/App/App/CreateTrip/NativeCreateTripViewController+Dates.swift",
  "utf8",
);

function methodBody(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

test("date picker updates the existing Create Trip controller instead of reconstructing it", () => {
  const body = methodBody(
    "@objc func setDates()",
    "func submissionDateValues()"
  );
  assert.match(body, /startDate: dateContext\.startDate/);
  assert.match(body, /endDate: dateContext\.endDate/);
  assert.match(body, /self\?\.dateContext\.startDate = start/);
  assert.match(body, /self\?\.dateContext\.endDate = end/);
  assert.match(body, /self\?\.updateDateLabel\(\)/);
  assert.doesNotMatch(body, /NativeCreateTripViewController\(/);
});
