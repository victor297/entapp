const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { configureStore } = require("@reduxjs/toolkit");
process.env.TZ = "Africa/Lagos";

const root = path.resolve(__dirname, "..");
const modules = new Map();
function loadSource(file) {
  const filename = path.resolve(root, file);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
  }).outputText;
  const localRequire = specifier => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return require(specifier);
    let resolved = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
    if (!path.extname(resolved)) resolved += ".ts";
    return loadSource(resolved);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}
const storage = () => { const rows = new Map(); return { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, String(value)), removeItem: key => rows.delete(key) }; };
global.window = {};
global.localStorage = storage();
global.sessionStorage = storage();
localStorage.setItem("access_token", "test-token");
process.env.NEXT_PUBLIC_API_BASE_URL = "https://operations.example.test";
const requests = [];
let respond;
const originalFetch = global.fetch;
global.fetch = async input => {
  const url = new URL(input.url);
  requests.push({ url, authorization: input.headers.get("Authorization") });
  return new Response(JSON.stringify(await respond(url)), { headers: { "Content-Type": "application/json" } });
};
after(() => { global.fetch = originalFetch; delete global.window; delete global.localStorage; delete global.sessionStorage; });

const { operationsApi } = loadSource("redux/services/operationsApi.ts");
const { filterRecords, recordPage, money, bookingStatus } = loadSource("lib/operations.ts");
function store() { requests.length = 0; return configureStore({ reducer: { [operationsApi.reducerPath]: operationsApi.reducer }, middleware: getDefault => getDefault().concat(operationsApi.middleware) }); }
async function query(app, endpoint, args) { const request = app.dispatch(operationsApi.endpoints[endpoint].initiate(args)); try { return await request.unwrap(); } finally { request.unsubscribe(); app.dispatch(operationsApi.util.resetApiState()); } }

test("provider booking retrieval includes later pages and every owned listing before filters run", async () => {
  const bookings = Array.from({ length: 205 }, (_, i) => ({ id: `booking-${i}`, serviceProvider: "provider-1", serviceId: i === 204 ? "venue-2" : "venue-1", createdAt: i === 204 ? "2026-11-09T22:30:00Z" : "2026-10-01T12:00:00Z", status: "CONFIRMED" }));
  respond = url => { assert.equal(url.pathname, "/booking"); assert.equal(url.searchParams.get("serviceProvider"), "provider-1"); const offset = Number(url.searchParams.get("offset")); return { count: bookings.length, data: bookings.slice(offset, offset + 100) }; };
  const rows = await query(store(), "operationList", { resource: "/booking", params: { serviceProvider: "provider-1" } });
  assert.equal(rows.length, 205);
  assert.deepEqual(requests.map(row => row.url.searchParams.get("offset")), ["0", "100", "200"]);
  assert.ok(requests.every(row => row.authorization === "Bearer test-token"));
  assert.deepEqual(filterRecords(rows, { serviceId: "venue-2", start: "2026-11-09", end: "2026-11-09" }).map(row => row.id), ["booking-204"]);
});

test("date filters use the same local calendar day as the displayed booking date", () => {
  const rows = [{ id: "late-evening", createdAt: "2026-11-09T22:59:59Z" }, { id: "next-day", createdAt: "2026-11-09T23:00:00Z" }, { id: "start-day", createdAt: "2026-11-08T23:00:00Z" }];
  assert.deepEqual(filterRecords(rows, { start: "2026-11-09", end: "2026-11-09" }).map(row => row.id), ["late-evening", "start-day"]);
});

test("duplicate or incomplete pagination rejects instead of silently hiding records", async () => {
  respond = () => ({ count: 2, docs: [{ id: "repeated" }] });
  await assert.rejects(query(store(), "operationList", { resource: "/subscriptions", params: { serviceProviderId: "provider-1" } }), error => error.status === "CUSTOM_ERROR" && /paginate/.test(error.error));
  respond = () => ({ count: 2, data: [] });
  await assert.rejects(query(store(), "operationList", { resource: "/invoice", params: { userId: "customer-1" } }), error => /incomplete/.test(error.error));
  assert.throws(() => recordPage({ data: [], count: "invalid" }), /invalid result count/);
});

test("bare array endpoints paginate until their last page", async () => {
  const fees = Array.from({ length: 201 }, (_, index) => ({ id: `fee-${index}` }));
  respond = url => fees.slice(Number(url.searchParams.get("offset")), Number(url.searchParams.get("offset")) + 100);
  const rows = await query(store(), "operationList", { resource: "/fees" });
  assert.equal(rows.length, 201);
  assert.equal(rows.at(-1).id, "fee-200");
});

test("customer bookings follow only owned invoices and never request a global customer-filtered booking list", async () => {
  respond = url => {
    if (url.pathname === "/invoice") { assert.equal(url.searchParams.get("userId"), "customer-1"); return { count: 4, data: [{ id: "i1", userId: "customer-1", bookingId: "b1" }, { id: "i2", userId: "customer-1", bookingId: "b1" }, { id: "i3", userId: "customer-1", bookingId: "b2" }, { id: "i4", userId: "other-customer", bookingId: "private" }] }; }
    if (url.pathname === "/booking/b1") return { id: "b1", customerId: "customer-1" };
    if (url.pathname === "/booking/b2") return { id: "b2", customerId: "other-customer" };
    throw new Error(`Unexpected data access: ${url}`);
  };
  const rows = await query(store(), "customerBookings", "customer-1");
  assert.deepEqual(rows.map(row => row.id), ["b1"]);
  assert.deepEqual(requests.map(row => row.url.pathname), ["/invoice", "/booking/b1", "/booking/b2"]);
});

test("provider invoices combine own subscription invoices and invoices from all provider bookings", async () => {
  respond = url => {
    if (url.pathname === "/booking") { assert.equal(url.searchParams.get("serviceProvider"), "provider-1"); return { data: [{ id: "b1", serviceProvider: "provider-1" }, { id: "b2", serviceProvider: "provider-1" }], count: 2 }; }
    if (url.searchParams.get("userId") === "provider-1") return { data: [{ id: "subscription-invoice" }], count: 1 };
    const booking = url.searchParams.get("bookingId");
    assert.ok(["b1", "b2"].includes(booking));
    return { data: [{ id: `invoice-${booking}` }], count: 1 };
  };
  const rows = await query(store(), "providerInvoices", "provider-1");
  assert.deepEqual(rows.map(row => row.id), ["subscription-invoice", "invoice-b1", "invoice-b2"]);
});

test("transport failures remain connection errors through paginated operation requests", async () => {
  respond = () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(query(store(), "operationList", { resource: "/booking", params: { serviceProvider: "provider-1" } }), error => error.status === "FETCH_ERROR");
  await assert.rejects(query(store(), "providerInvoices", "provider-1"), error => error.status === "FETCH_ERROR");
});

test("invoice outstanding amounts use only real invoice-payment debits and server-paid status", () => {
  const { invoiceRemaining, isPaymentConfirmed, isInvoicePayable } = loadSource("lib/payment-status.ts");
  const invoice = { id: "invoice-1", userId: "customer-1", status: "PARTIALLY_PAID", amountDue: 10000 };
  const transactions = [
    { id: "1", invoiceId: "invoice-1", type: "DEBIT", reason: "INVOICE_PAYMENT", amount: 2500 },
    { id: "2", invoiceId: "other", type: "DEBIT", reason: "INVOICE_PAYMENT", amount: 4000 },
    { id: "3", invoiceId: "invoice-1", type: "CREDIT", reason: "TOPUP", amount: 2500 },
  ];
  assert.equal(invoiceRemaining(invoice, transactions), 7500);
  assert.equal(isPaymentConfirmed({ ...invoice, reference: "successful-provider-reference" }, "customer-1"), false);
  assert.equal(isPaymentConfirmed({ ...invoice, status: "PAID" }, "other-customer"), false);
  assert.equal(isPaymentConfirmed({ ...invoice, status: "PAID" }, "customer-1"), true);
  assert.equal(invoiceRemaining({ ...invoice, status: "PAID" }, []), 0);
  assert.equal(isInvoicePayable({ ...invoice, status: "REFUNDED" }), false);
  assert.equal(isInvoicePayable(invoice), true);
  assert.equal(money(undefined), "Unavailable");
  assert.equal(bookingStatus("COMPLETED"), "Completed");
  assert.equal(bookingStatus("PAID"), "PAID");
});

test("quote details retain numeric budgets and requirements without inventing accepted statuses", () => {
  const { parseQuoteDetails, formatQuoteBudget, quoteStatus } = loadSource("lib/quote-details.ts");
  const details = { version: 1, minBudget: 100000, maxBudget: 200000, currency: "NGN", eventDate: "2026-12-01", guests: 100, eventType: "WEDDING", menu: "Vegetarian", dietary: "Vegan", allergies: "Peanuts", drinks: "Juice", staffing: "4 servers", equipment: "Tables", notes: "Outdoor" };
  assert.deepEqual(parseQuoteDetails(JSON.stringify(details)), details);
  assert.equal(parseQuoteDetails("Older free text note"), null);
  assert.equal(parseQuoteDetails('{"version":1,"minBudget":"100","maxBudget":200}'), null);
  assert.equal(formatQuoteBudget("100000-200000"), "100000 – 200000 NGN");
  assert.equal(formatQuoteBudget("Negotiable"), "Negotiable");
  assert.equal(quoteStatus("GENERATED"), "Quote requested");
  const quotesPage = fs.readFileSync(path.join(root, "components/operations/QuotesPage.tsx"), "utf8");
  assert.match(quotesPage, /activeRole === "provider" \? \{ serviceProvider: userId \} : \{ customerId: userId \}/);
  assert.match(quotesPage, /row\.customerId === userId/);
  assert.doesNotMatch(quotesPage, /knownQuoteIds/);
});

test("current-user snapshots persist identity fields without passwords or session tokens", () => {
  const { persistCurrentUser, currentUserSnapshot } = loadSource("lib/current-user.ts");
  localStorage.setItem("user_id", "customer-1");
  persistCurrentUser({ id: "customer-1", firstName: "Ada", lastName: "Okafor", email: "ada@example.test", userType: "CUSTOMER", status: "ACTIVE", isEmailVerified: true, password: "secret-password", access_token: "secret-token", serviceProvider: null });
  const snapshot = currentUserSnapshot();
  assert.match(snapshot, /Ada/);
  assert.doesNotMatch(snapshot, /secret-password|secret-token|access_token/);
  localStorage.removeItem("access_token");
  assert.equal(currentUserSnapshot(), "");
});

test("private caches reset on account/token changes, including sign-out in another tab", () => {
  const { watchSessionCache } = loadSource("lib/session-cache.ts");
  const listeners = new Map();
  window.addEventListener = (event, handler) => listeners.set(event, handler);
  window.removeEventListener = event => listeners.delete(event);
  localStorage.setItem("user_id", "first-account");
  localStorage.setItem("access_token", "first-token");
  let resets = 0;
  const unsubscribe = watchSessionCache(() => resets++);
  listeners.get("auth-change")();
  assert.equal(resets, 0, "profile-only updates do not clear ongoing operations");
  localStorage.setItem("user_id", "second-account");
  localStorage.setItem("access_token", "second-token");
  listeners.get("auth-change")();
  assert.equal(resets, 1);
  localStorage.removeItem("access_token");
  listeners.get("storage")();
  assert.equal(resets, 2);
  unsubscribe();
  assert.equal(listeners.size, 0);
  delete window.addEventListener;
  delete window.removeEventListener;
});

test("the real payment status screen shows success only for a paid invoice owned by the current account", () => {
  let response = { id: "invoice-1", userId: "customer-1", status: "PENDING", reference: "gateway-success-reference" };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(root, "components/operations/PaymentStatusPage.tsx"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mock = specifier => {
    if (specifier === "react") return { useState: initial => [initial, () => {}], useEffect() {} };
    if (specifier === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (specifier === "next/link") return { __esModule: true, default: "Link" };
    if (specifier === "@/hooks/useCurrentUser") return { useCurrentUser: () => ({ userId: "customer-1", user: { userType: "CUSTOMER" } }) };
    if (specifier === "@/redux/services/operationsApi") return { useOperationRecordQuery: () => ({ data: response, refetch() {} }) };
    if (specifier === "./Workspace") return { Workspace: "Workspace", Message: "Message", ApiError: "ApiError", buttonClass: "button" };
    if (specifier === "@/lib/payment-status") return loadSource("lib/payment-status.ts");
    throw new Error(`Unexpected status screen import ${specifier}`);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(mock, module, module.exports);
  const Component = module.exports.default;
  assert.equal(Component({ invoiceId: "invoice-1" }).props.title, "Checking your payment");
  response = { ...response, status: "PAID", userId: "other-customer" };
  assert.equal(Component({ invoiceId: "invoice-1" }).props.title, "Checking your payment");
  response = { ...response, userId: "customer-1" };
  assert.equal(Component({ invoiceId: "invoice-1" }).props.title, "Payment confirmed");
});
