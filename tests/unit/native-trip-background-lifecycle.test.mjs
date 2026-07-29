import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  "ios/App/App/CreateTrip/NativeCreateTripViewController+Background.swift",
  "utf8",
);

function methodBody(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

test("automatic background query uses only the resolved location", () => {
  const body = methodBody(
    "var destinationBackgroundQuery: String",
    "func transitionToBackgroundImage"
  );
  assert.match(body, /tripState\.resolvedLocation\?\.title/);
  assert.doesNotMatch(body, /nameField|tripState\.tripName/);
});
