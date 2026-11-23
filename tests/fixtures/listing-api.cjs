const http = require("node:http");

const states = [
  { id: "state-lagos", name: "Lagos", code: "LA", countryId: "country-ng" },
  { id: "state-abuja", name: "Abuja", code: "AB", countryId: "country-ng" },
  { id: "state-london", name: "London", code: "LDN", countryId: "country-uk" },
];

function common(index) {
  return {
    serviceProviderId: "provider-fixture", name: "", eventTypes: [index % 2 ? "CORPORATE" : "WEDDING"],
    discountPercentage: index === 0 ? 10 : 0, depositPercentage: 20,
    description: "A welcoming listing for memorable weddings, celebrations and business events.",
    images: index === 0 ? [] : ["/eventCard.png"], termsOfUse: "Contact the provider to confirm your event arrangements.",
    cancellationPolicy: "Contact the provider before cancelling.", streetAddress: "12 Celebration Avenue",
    streetAddress2: null, city: index % 2 ? "Abuja" : "Lagos", postal: "100001", status: "ACTIVE",
    paymentRequired: false, rating: 4, contact: "+234 800 000 0000", createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "2026-10-01T12:00:00.000Z", deletedAt: null, deletedBy: null,
    subscriptionStatus: index % 3 ? "ACTIVE" : "EXPIRED", subscriptionExpiry: index % 3 ? "2027-12-01T00:00:00Z" : "2025-12-01T00:00:00Z",
  };
}

const venues = Array.from({ length: 30 }, (_, index) => ({
  ...common(index), id: `venue-${String(index + 1).padStart(2, "0")}`,
  name: index === 24 ? "Beyond First Page Ballroom" : `Venue ${String(index + 1).padStart(2, "0")}`,
  pricingPerSlot: (index + 1) * 10000, sittingCapacity: (index + 1) * 100,
  venueLayout: "Banquet seating", amenities: index % 2 ? ["WIFI"] : ["WIFI", "SECURITY"],
  location: index % 2 ? "state-abuja" : "state-lagos",
}));

const caterings = Array.from({ length: 29 }, (_, index) => ({
  ...common(index), id: `catering-${String(index + 1).padStart(2, "0")}`,
  name: index === 24 ? "Beyond First Page Catering" : `Caterer ${String(index + 1).padStart(2, "0")}`,
  tagLine: "Freshly prepared food for every celebration", startPrice: (index + 1) * 1000,
  minCapacity: 20, maxCapacity: 1000, dishTypes: ["BUFFET"], cuisine: ["Nigerian"],
  location: [index % 2 ? "state-abuja" : "state-lagos"], isFeatured: index === 0, featureExpiringAt: null,
}));

function splitList(params, name) {
  return params.getAll(name).flatMap((value) => value.split(",")).filter(Boolean);
}

function filteredListings(kind, params) {
  const isVenue = kind === "event-centers";
  const text = (params.get("search") || "").toLowerCase();
  const eventTypes = splitList(params, "eventTypes");
  const amenities = splitList(params, "amenities");
  const location = params.get(isVenue ? "location" : "state");
  return (isVenue ? venues : caterings).filter((listing) => {
    if (text && ![listing.name, listing.description, listing.tagLine, ...(isVenue ? [listing.city, listing.venueLayout] : listing.eventTypes)].filter(Boolean).some((value) => value.toLowerCase().includes(text))) return false;
    if (params.get("city") && listing.city.toLowerCase() !== params.get("city").toLowerCase()) return false;
    if (location && (isVenue ? listing.location !== location : !listing.location.includes(location))) return false;
    if (isVenue && eventTypes.length && !eventTypes.some((value) => listing.eventTypes.includes(value))) return false;
    if (isVenue && amenities.length && !amenities.some((value) => listing.amenities.includes(value))) return false;
    if (isVenue && params.get("minCapacity") && listing.sittingCapacity < Number(params.get("minCapacity"))) return false;
    if (isVenue && params.get("maxPrice") && listing.pricingPerSlot > Number(params.get("maxPrice"))) return false;
    return true;
  });
}

function paginate(items, params) {
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const limit = Math.max(1, Number(params.get("limit")) || 12);
  return items.slice(offset, offset + limit);
}

async function createListingFixture({ port = 0, host = "127.0.0.1" } = {}) {
  const requests = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${host}`);
    requests.push(url);
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (request.method === "OPTIONS") { response.statusCode = 204; response.end(); return; }
    const send = (body, status = 200) => { response.statusCode = status; response.end(JSON.stringify(body)); };
    if (url.pathname === "/admin/state") {
      const selected = states.filter((state) => !url.searchParams.get("countryId") || state.countryId === url.searchParams.get("countryId"));
      send({ docs: paginate(selected, url.searchParams), count: selected.length }); return;
    }
    if (url.pathname === "/admin/country") {
      send({ docs: [{ id: "country-ng", name: "Nigeria", code: "NG" }, { id: "country-uk", name: "United Kingdom", code: "UK" }], count: 2 }); return;
    }
    const match = url.pathname.match(/^\/(event-centers|catering)(?:\/([^/]+))?$/);
    if (match) {
      if (match[2]) {
        const item = (match[1] === "event-centers" ? venues : caterings).find((listing) => listing.id === match[2]);
        send(item || { message: "Listing not found" }, item ? 200 : 404); return;
      }
      const selected = filteredListings(match[1], url.searchParams);
      send({ data: paginate(selected, url.searchParams), count: selected.length }); return;
    }
    if (url.pathname.endsWith("/refund-policy")) { send(null); return; }
    send({ message: "Fixture route not found" }, 404);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host, resolve); });
  return {
    server, requests, venues, caterings,
    origin: `http://${host}:${server.address().port}`,
    close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections?.(); }),
  };
}

module.exports = { createListingFixture };
