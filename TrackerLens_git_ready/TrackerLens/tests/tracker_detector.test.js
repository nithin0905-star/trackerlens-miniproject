import { extractDomain, getRegistrableDomain } from '../detection/tracker_detector.js';

function runTests() {
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, name) {
    if (actual === expected) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} (Expected: "${expected}", Got: "${actual}")`);
      failed++;
    }
  }

  console.log("--- Running TrackerLens Domain Parsing Tests ---");

  // 1. extractDomain
  assertEqual(extractDomain("http://example.com/path"), "example.com", "extractDomain: Basic http");
  assertEqual(extractDomain("https://www.example.com"), "www.example.com", "extractDomain: Basic https with www");
  assertEqual(extractDomain("https://sub.domain.example.co.uk"), "sub.domain.example.co.uk", "extractDomain: Subdomain");
  // punycode test
  assertEqual(extractDomain("https://xn--bcher-kva.example.com"), "xn--bcher-kva.example.com", "extractDomain: Punycode");
  // invalid url
  assertEqual(extractDomain("not a url"), null, "extractDomain: Invalid URL");

  // 2. getRegistrableDomain (naive TLD parsing)
  assertEqual(getRegistrableDomain("example.com"), "example.com", "getRegistrableDomain: Standard .com");
  assertEqual(getRegistrableDomain("www.example.com"), "example.com", "getRegistrableDomain: www strip");
  assertEqual(getRegistrableDomain("sub.example.com"), "example.com", "getRegistrableDomain: Subdomain");
  assertEqual(getRegistrableDomain("a.b.c.example.com"), "example.com", "getRegistrableDomain: Deep subdomain");
  assertEqual(getRegistrableDomain("example.co.uk"), "example.co.uk", "getRegistrableDomain: ccTLD .co.uk");
  assertEqual(getRegistrableDomain("sub.example.co.uk"), "example.co.uk", "getRegistrableDomain: ccTLD Subdomain");

  console.log(`\nTests Complete: ${passed} Passed, ${failed} Failed.`);
}

runTests();
