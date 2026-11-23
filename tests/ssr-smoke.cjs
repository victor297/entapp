// Run manually after `npm run build`: node tests/ssr-smoke.cjs
const assert = require("node:assert/strict");
const { startPreview } = require("./preview.cjs");

async function main() {
  const preview = await startPreview();
  const rendered = async (path, options = {}) => {
    const response = await fetch(`${preview.origin}${path}`, { headers: { "User-Agent": "Twitterbot/1.0" }, ...options });
    const html = await response.text();
    return { response, html, visible: html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "") };
  };
  let checks = 0;
  const passed = (label) => { checks += 1; console.log(`PASS ${label}`); };
  try {
    let result = await rendered("/event-center");
    assert.equal(result.response.status, 200);
    assert.match(result.visible, /Venue 01<\/h3>/);
    assert.doesNotMatch(result.visible, /Beyond First Page Ballroom<\/h3>/);
    assert.match(result.visible, /listing-placeholder\.svg/);
    assert.match(result.html, /<title>[^<]*Event Centers/);
    assert.match(result.html, /property="og:title"/);
    assert.match(result.html, /name="description"/);
    passed("catalogue renders real listing text, metadata and fallback image in initial HTML");

    result = await rendered("/event-center?search=Beyond&location=state-lagos&city=Lagos&eventTypes=WEDDING&amenities=SECURITY&minCapacity=2000&maxPrice=300000");
    assert.match(result.visible, /Beyond First Page Ballroom<\/h3>/);
    assert.doesNotMatch(result.visible, /Venue 01<\/h3>/);
    const venueRequest = preview.fixture.requests.findLast((url) => url.pathname === "/event-centers" && url.searchParams.get("search") === "Beyond");
    assert.equal(venueRequest.searchParams.get("location"), "state-lagos");
    assert.equal(venueRequest.searchParams.get("amenities"), "SECURITY");
    assert.equal(venueRequest.searchParams.get("minCapacity"), "2000");
    assert.equal(venueRequest.searchParams.get("maxPrice"), "300000");
    passed("all venue filters find a match outside the unfiltered first page");

    result = await rendered("/cateringServices/allPost?search=Beyond&location=state-lagos&city=Lagos");
    assert.match(result.visible, /Beyond First Page Catering<\/h3>/);
    const cateringRequest = preview.fixture.requests.findLast((url) => url.pathname === "/catering" && url.searchParams.get("search") === "Beyond");
    assert.equal(cateringRequest.searchParams.get("state"), "state-lagos");
    assert.equal(cateringRequest.searchParams.has("location"), false);
    assert.equal(cateringRequest.searchParams.has("country"), false);
    passed("catering search maps location to the backend state parameter");

    result = await rendered("/search?category=all&venuePage=2&cateringPage=3");
    assert.match(result.visible, /Venue 13<\/h3>/);
    assert.match(result.visible, /Beyond First Page Catering<\/h3>/);
    assert.doesNotMatch(result.visible, /Venue 01<\/h3>/);
    assert.doesNotMatch(result.visible, /Caterer 01<\/h3>/);
    assert.match(result.visible, /venuePage=3(?:&amp;|&)cateringPage=3/);
    passed("combined search paginates each catalogue independently");

    result = await rendered("/search?category=EVENTCENTERS&search=Beyond&location=state-lagos");
    assert.match(result.visible, /Beyond First Page Ballroom<\/h3>/);
    assert.doesNotMatch(result.visible, /Beyond First Page Catering<\/h3>/);
    passed("homepage search category, text and location all reach the API");

    result = await rendered("/cateringServices?search=Beyond&location=state-lagos", { redirect: "manual" });
    assert.ok([307, 308].includes(result.response.status));
    assert.match(result.response.headers.get("location"), /allPost\?search=Beyond&location=state-lagos/);
    passed("catering catalogue alias preserves all query fields");

    for (const [url, name] of [["/event-center/venue-01", "Venue 01"], ["/cateringServices/catering-01", "Caterer 01"]]) {
      result = await rendered(url);
      assert.equal(result.response.status, 200);
      assert.ok(result.visible.includes(name));
      assert.match(result.visible, /listing-placeholder\.svg/);
      assert.ok(result.html.includes(`<title>${name} in Lagos`));
      passed(`${url} renders detail content and dynamic metadata`);
    }

    for (const url of ["/event-center/does-not-exist", "/cateringServices/does-not-exist"]) {
      result = await rendered(url);
      assert.equal(result.response.status, 404, `${url} must return HTTP 404`);
      assert.match(result.html, /noindex/);
      passed(`${url} returns an index-safe 404`);
    }
    const accountRoutes = ["/provider/wallet", "/provider/invoices", "/provider/availability", "/provider/subscriptions", "/provider/manual-booking", "/customer/payments?invoiceId=invoice-test", "/customer/disputes", "/quotes", "/bookings", "/admin/bookings", "/admin/fees", "/admin/geography", "/admin/listings/eventcenter/new", "/support", "/notifications", "/payment/success?invoiceId=invoice-test&reference=unverified-reference"];
    for (const url of accountRoutes) {
      result = await rendered(url);
      assert.equal(result.response.status, 200, `${url} must resolve without a route/server error`);
      assert.match(result.visible, /<main|role="status"|animate-spin/);
      assert.doesNotMatch(result.visible, /Your invoice is marked paid by the server/);
      passed(`${url} renders an account/loading state without exposing private data`);
    }
    console.log(`${checks} SSR smoke checks passed.`);
  } finally {
    await preview.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
