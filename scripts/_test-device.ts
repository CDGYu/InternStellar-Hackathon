import { strict as assert } from "node:assert";

import { isMobileUserAgent } from "../lib/device";

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${label}`);
    passed += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL ${label}\n       ${message}`);
    failed += 1;
  }
}

console.log("lib/device.isMobileUserAgent");

check("null UA → false", () => {
  assert.equal(isMobileUserAgent(null), false);
});

check("undefined UA → false", () => {
  assert.equal(isMobileUserAgent(undefined), false);
});

check("empty string → false", () => {
  assert.equal(isMobileUserAgent(""), false);
});

check("Chrome desktop → false", () => {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  assert.equal(isMobileUserAgent(ua), false);
});

check("Firefox desktop → false", () => {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
  assert.equal(isMobileUserAgent(ua), false);
});

check("Safari iPhone → true", () => {
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
  assert.equal(isMobileUserAgent(ua), true);
});

check("Chrome Android → true", () => {
  const ua =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
  assert.equal(isMobileUserAgent(ua), true);
});

check("iPad Safari → true", () => {
  const ua =
    "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
  assert.equal(isMobileUserAgent(ua), true);
});

check("googlebot-mobile → true", () => {
  const ua =
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 " +
    "(compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  assert.equal(isMobileUserAgent(ua), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
