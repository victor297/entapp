const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Load the application's actual TypeScript without a separate test dependency.
const root = path.resolve(__dirname, "..");
const modules = new Map();
function loadSource(filename) {
  filename = path.resolve(root, filename);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText;
  const localRequire = (specifier) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return require(specifier);
    let resolved = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
    if (!path.extname(resolved)) resolved += ".ts";
    return loadSource(resolved);
  };
  vm.runInThisContext(`(function(require, module, exports) { ${source}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}

process.env.NEXT_PUBLIC_API_BASE_URL = "https://listings.example.test";
process.env.API_BASE_URL = "https://listings.example.test";
const originalFetch = global.fetch;
const requests = [];
let responseBody = { data: [], count: 0 };
let responseStatus = 200;
global.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  requests.push(url);
  const body = typeof responseBody === "function" ? responseBody(url) : responseBody;
  return new Response(JSON.stringify(body), { status: responseStatus, headers: { "Content-Type": "application/json" } });
};
after(() => { global.fetch = originalFetch; });

const filters = loadSource("lib/listing-filters.ts");
const listings = loadSource("lib/public-listings.ts");

test("venue search reaches a match beyond the unfiltered first page, with all filters before pagination", async () => {
  responseStatus = 200;
  responseBody = { data: [{ id: "venue-27", name: "Garden & Hall" }], count: 1 };
  const selection = filters.parseListingFilters({ search: "Garden & Hall", city: "Lagos", location: "state-id", eventTypes: ["wedding", "CONFERENCE"], amenities: "wifi,security", minCapacity: "150", maxPrice: "450000" });
  const result = await listings.getPublicEventCenters(selection, 1);
  assert.equal(result.data[0].id, "venue-27");
  const query = requests.at(-1).searchParams;
  assert.equal(query.get("search"), "Garden & Hall");
  assert.equal(query.get("city"), "Lagos");
  assert.equal(query.get("location"), "state-id");
  assert.equal(query.get("eventTypes"), "WEDDING,CONFERENCE");
  assert.equal(query.get("amenities"), "WIFI,SECURITY");
  assert.equal(query.get("minCapacity"), "150");
  assert.equal(query.get("maxPrice"), "450000");
  assert.equal(query.get("limit"), "12");
  assert.equal(query.get("offset"), "0");
  assert.equal(result.count, 1);
});

test("later result pages retain search filters and use the backend count", async () => {
  responseBody = { data: [{ id: "venue-25" }], count: 25 };
  const selection = filters.parseListingFilters({ search: "Hall", eventTypes: "BIRTHDAY", page: "3" });
  const result = await listings.getPublicEventCenters(selection, selection.page);
  assert.equal(requests.at(-1).searchParams.get("offset"), "24");
  assert.equal(requests.at(-1).searchParams.get("eventTypes"), "BIRTHDAY");
  assert.equal(result.count, 25);
  const next = new URL(filters.listingHref("/event-center", { search: "Hall", eventTypes: ["WEDDING", "BIRTHDAY"], page: "2" }, { page: 3 }), "https://frontend.test");
  assert.equal(next.searchParams.get("search"), "Hall");
  assert.deepEqual(next.searchParams.getAll("eventTypes"), ["WEDDING", "BIRTHDAY"]);
  assert.equal(next.searchParams.get("page"), "3");
});

test("catering uses state IDs and never sends unsupported country/venue filters", async () => {
  responseBody = { data: [{ id: "caterer-40" }], count: 40 };
  const selection = filters.parseListingFilters({ search: "Small chops", location: "lagos-id", country: "Nigeria", city: "Ikeja", minCapacity: "100", maxPrice: "50000", amenities: "WIFI", eventTypes: "WEDDING" });
  await listings.getPublicCaterings(selection, 2);
  const query = requests.at(-1).searchParams;
  assert.equal(query.get("search"), "Small chops");
  assert.equal(query.get("state"), "lagos-id");
  assert.equal(query.get("city"), "Ikeja");
  assert.equal(query.get("offset"), "12");
  for (const key of ["location", "country", "minCapacity", "maxPrice", "amenities", "eventTypes"]) assert.equal(query.has(key), false, key);
});

test("invalid and repeated URL values cannot produce invalid numeric or enum API filters", () => {
  const selection = filters.parseListingFilters({ page: "-2", minCapacity: "NaN", maxPrice: "Infinity", eventTypes: ["wedding,unknown", "WEDDING"], amenities: "wifi,bogus", category: "CATERING" });
  assert.equal(selection.page, 1);
  assert.equal(selection.category, "CATERING");
  assert.equal(selection.minCapacity, undefined);
  assert.equal(selection.maxPrice, undefined);
  assert.deepEqual(selection.eventTypes, ["WEDDING"]);
  assert.deepEqual(selection.amenities, ["WIFI"]);
});

test("location options include states beyond the first backend page", async () => {
  responseBody = (url) => url.searchParams.get("offset") === "0" ? { docs: [{ id: "a", name: "Zamfara" }], count: 2 } : { docs: [{ id: "b", name: "Abia" }], count: 2 };
  const states = await listings.getPublicStates();
  assert.deepEqual(states.map((state) => state.name), ["Abia", "Zamfara"]);
  assert.equal(requests.at(-1).searchParams.get("offset"), "1");
});

test("failed API requests produce an explicit error instead of a successful empty catalogue", async () => {
  responseStatus = 503;
  responseBody = { message: "Unavailable" };
  const result = await listings.getPublicEventCenters(filters.parseListingFilters({}));
  assert.ok(result.error);
  assert.equal(result.data.length, 0);
  responseStatus = 200;
});

test("missing listing detail is distinguished from an API failure", async () => {
  responseBody = { message: "Not found" };
  responseStatus = 404;
  assert.equal(await listings.getPublicEventCenter("missing"), null);
  responseStatus = 500;
  await assert.rejects(listings.getPublicEventCenter("broken"));
  responseStatus = 200;
});

test("dynamic metadata contains listing title, description, canonical, and social images", () => {
  const { buildMetadata } = loadSource("lib/seo.ts");
  const metadata = buildMetadata({ title: "Garden Hall", description: "A garden venue in Lagos", path: "/event-center/venue-27", images: ["https://images.test/hall.jpg"] });
  assert.equal(metadata.title, "Garden Hall");
  assert.equal(metadata.description, "A garden venue in Lagos");
  assert.equal(metadata.alternates.canonical, "/event-center/venue-27");
  assert.deepEqual(metadata.openGraph.images, ["https://images.test/hall.jpg"]);
  assert.equal(metadata.twitter.card, "summary_large_image");
});

test("provider subscription badges show active, expired, and absent subscription states accurately", () => {
  const { renderToStaticMarkup } = require("react-dom/server");
  const { createElement } = require("react");
  const Status = loadSource("components/providers/ListingSubscriptionStatus.tsx").default;
  const render = (props) => renderToStaticMarkup(createElement(Status, props));
  assert.match(render({ status: "ACTIVE", expiry: "2099-01-01T00:00:00Z" }), />Active</);
  assert.match(render({ status: "ACTIVE", expiry: "2000-01-01T00:00:00Z" }), />Expired</);
  assert.match(render({ status: "EXPIRED" }), />Expired</);
  assert.match(render({}), />No subscription</);
});
