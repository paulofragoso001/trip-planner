import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("ios/App/App/CreateTrip/NativeCreateTripViewController.swift", "utf8");

test("Create Trip keeps one visible Trip Name field and a separate resolved location", () => {
  assert.match(source, /\blet nameField = UITextField\(\)/);
  assert.doesNotMatch(source, /\blet destinationField = UITextField\(\)/);
  assert.match(source, /tripState\.updateTripName\(nameField\.text \?\? ""\)/);
  assert.match(source, /tripState\.confirmLocation\(/);
});
