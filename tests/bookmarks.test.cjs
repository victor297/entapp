const { test, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { configureStore } = require("@reduxjs/toolkit");

// Exercise the actual RTK endpoints and reducers without a test-only dependency.
const root = path.resolve(__dirname, "..");
const modules = new Map();
function loadSource(filename) {
  filename = path.resolve(root, filename);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const localRequire = (specifier) => {
    if (!specifier.startsWith(".")) return require(specifier);
    let resolved = path.resolve(path.dirname(filename), specifier);
    if (!path.extname(resolved)) resolved += ".ts";
    return loadSource(resolved);
  };
  vm.runInThisContext(`(function(require, module, exports) { ${source}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}

process.env.NEXT_PUBLIC_API_BASE_URL = "https://bookmarks.example.test";
const originalFetch = global.fetch;
const originalWindow = global.window;
const originalLocalStorage = global.localStorage;
const originalSessionStorage = global.sessionStorage;
const storage = new Map([["access_token", "customer-token"]]);
global.window = {};
global.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
const session = new Map();
global.sessionStorage = { getItem: (key) => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) };

const requests = [];
let serverUser;
let nextUser;
let rejectToggle = false;
global.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = input.method || "GET";
  const body = method === "POST" ? await input.json() : undefined;
  requests.push({ url, method, body, authorization: input.headers.get("Authorization"), credentials: input.credentials });
  let result;
  let status = 200;
  if (url.pathname === "/users/login") {
    // The current gateway returns refresh tokens only via an HttpOnly cookie.
    result = { user: serverUser, access_token: "new-access-token" };
  } else if (url.pathname === "/users/bookmark") {
    if (rejectToggle) {
      status = 503;
      result = { message: "Temporarily unavailable" };
    } else {
      serverUser = nextUser;
      result = serverUser;
    }
  } else if (url.pathname.startsWith("/users/")) {
    status = 401;
    result = { message: "Restricted area! you must be an admin" };
  } else {
    result = [{ id: url.searchParams.get("ids"), name: "Saved listing" }];
  }
  return new Response(JSON.stringify(result), { status, headers: { "Content-Type": "application/json" } });
};

const { api } = loadSource("redux/services/authApi.ts");
const { bookmarksApi } = loadSource("redux/services/bookmarksApi.ts");
const bookmarkState = loadSource("lib/bookmark-state.ts");
const stores = [];
function makeStore() {
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (defaults) => defaults().concat(api.middleware),
  });
  stores.push(store);
  requests.length = 0;
  rejectToggle = false;
  for (const id of ["customer-a", "customer-b"]) bookmarkState.clearBookmarkState(id);
  serverUser = { id: "customer-a", eventCenter: ["existing-venue"], catering: [] };
  return store;
}

afterEach(() => {
  for (const store of stores.splice(0)) store.dispatch(api.util.resetApiState());
});
after(() => {
  global.fetch = originalFetch;
  global.window = originalWindow;
  global.localStorage = originalLocalStorage;
  global.sessionStorage = originalSessionStorage;
});

test("customer login supplies safe bookmark state even though the user-read endpoint rejects customers", async () => {
  const store = makeStore();
  await assert.rejects(store.dispatch(api.endpoints.getUserById.initiate("customer-a")).unwrap());
  serverUser = { id: "customer-a", eventCenter: ["saved-venue"], catering: ["saved-catering"], password: "never-persist", refreshToken: "never-persist" };
  const login = await store.dispatch(api.endpoints.login.initiate({ email: "customer@example.test", password: "password" })).unwrap();
  assert.equal(login.refresh_token, undefined);
  assert.equal(requests.at(-1).credentials, "include");
  const stored = JSON.parse(storage.get("listing-bookmarks:customer-a"));
  assert.deepEqual(stored, { userId: "customer-a", eventCenter: ["saved-venue"], catering: ["saved-catering"] });
  // A new module has no in-memory snapshot, matching a page reload.
  modules.delete(path.resolve(root, "lib/bookmark-state.ts"));
  const reloaded = loadSource("lib/bookmark-state.ts");
  assert.deepEqual(reloaded.readBookmarkState("customer-a"), stored);
  assert.equal(reloaded.readBookmarkState("customer-b"), null);
  const snapshot = await store.dispatch(bookmarksApi.endpoints.getBookmarkState.initiate("customer-a")).unwrap();
  assert.deepEqual(snapshot.eventCenter, ["saved-venue"]);
});

test("legacy sessions without a synced snapshot return unknown state without reading the admin endpoint", async () => {
  const store = makeStore();
  const snapshot = await store.dispatch(bookmarksApi.endpoints.getBookmarkState.initiate("legacy-customer")).unwrap();
  assert.equal(snapshot, null);
  assert.equal(requests.length, 0);
});

test("saving sends the backend enum, uses authoritative arrays, and preserves cached profile relations", async () => {
  const store = makeStore();
  await store.dispatch(api.util.upsertQueryData("getUserById", "customer-a", { ...serverUser, serviceProvider: { businessName: "Keep this relation" } }));
  bookmarkState.persistBookmarkState(serverUser);
  await store.dispatch(bookmarksApi.endpoints.getBookmarkState.initiate("customer-a")).unwrap();
  nextUser = { id: "customer-a", eventCenter: ["server-preserved-venue", "new-venue"], catering: [], password: "never-persist", refreshToken: "never-persist" };
  const result = await store.dispatch(bookmarksApi.endpoints.toggleBookmark.initiate({ userId: "customer-a", id: "new-venue", serviceType: "eventcenter" })).unwrap();
  const snapshot = await store.dispatch(bookmarksApi.endpoints.getBookmarkState.initiate("customer-a")).unwrap();
  const request = requests.find(({ method }) => method === "POST");
  assert.deepEqual(request.body, { id: "new-venue", serviceType: "eventcenter" });
  assert.equal(request.authorization, "Bearer customer-token");
  const user = api.endpoints.getUserById.select("customer-a")(store.getState()).data;
  assert.deepEqual(user.eventCenter, ["server-preserved-venue", "new-venue"]);
  assert.deepEqual(snapshot.eventCenter, ["server-preserved-venue", "new-venue"]);
  assert.equal(user.serviceProvider.businessName, "Keep this relation");
  assert.deepEqual(Object.keys(result).sort(), ["catering", "eventCenter", "userId"]);
  assert.equal(requests.some(({ url }) => url.pathname === "/users/customer-a"), false);
});

test("a failed bookmark request preserves the saved state and does not invalidate another customer's cache", async () => {
  const store = makeStore();
  bookmarkState.persistBookmarkState(serverUser);
  bookmarkState.persistBookmarkState({ id: "customer-b", eventCenter: ["private-venue"], catering: [] });
  await store.dispatch(bookmarksApi.endpoints.getBookmarkState.initiate("customer-a")).unwrap();
  await store.dispatch(bookmarksApi.endpoints.getBookmarkState.initiate("customer-b")).unwrap();
  rejectToggle = true;
  await assert.rejects(store.dispatch(bookmarksApi.endpoints.toggleBookmark.initiate({ userId: "customer-a", id: "existing-venue", serviceType: "eventcenter" })).unwrap());
  assert.deepEqual(bookmarksApi.endpoints.getBookmarkState.select("customer-a")(store.getState()).data.eventCenter, ["existing-venue"]);
  assert.deepEqual(bookmarksApi.endpoints.getBookmarkState.select("customer-b")(store.getState()).data.eventCenter, ["private-venue"]);
});

test("saved listing lookups pass an array even for one ID and keep the catalogue unpaginated", async () => {
  const store = makeStore();
  const venues = await store.dispatch(bookmarksApi.endpoints.getSavedEventCenters.initiate({ userId: "customer-a", ids: ["venue-outside-first-page"] })).unwrap();
  const request = requests.at(-1).url;
  assert.equal(request.pathname, "/event-centers/bookmarks");
  assert.deepEqual(request.searchParams.getAll("ids"), ["venue-outside-first-page", "venue-outside-first-page"]);
  assert.equal(request.searchParams.has("limit"), false);
  assert.equal(request.searchParams.has("userId"), false);
  assert.equal(venues[0].id, "venue-outside-first-page");
});

test("saved catering lookups retain every ID and separate query caches by customer", async () => {
  const store = makeStore();
  const ids = ["caterer-a", "caterer-b"];
  await store.dispatch(bookmarksApi.endpoints.getSavedCaterings.initiate({ userId: "customer-a", ids })).unwrap();
  await store.dispatch(bookmarksApi.endpoints.getSavedCaterings.initiate({ userId: "customer-b", ids })).unwrap();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url.pathname, "/catering/bookmarks");
  assert.deepEqual(requests[0].url.searchParams.getAll("ids"), ids);
  assert.equal(bookmarksApi.endpoints.getSavedCaterings.select({ userId: "customer-a", ids })(store.getState()).status, "fulfilled");
  assert.equal(bookmarksApi.endpoints.getSavedCaterings.select({ userId: "customer-b", ids })(store.getState()).status, "fulfilled");
});

test("bookmark changes refresh only the affected customer's cached saved listings", async () => {
  const store = makeStore();
  await store.dispatch(bookmarksApi.endpoints.getSavedEventCenters.initiate({ userId: "customer-a", ids: ["venue-a"] })).unwrap();
  await store.dispatch(bookmarksApi.endpoints.getSavedEventCenters.initiate({ userId: "customer-b", ids: ["venue-b"] })).unwrap();
  requests.length = 0;
  nextUser = { id: "customer-a", eventCenter: [], catering: ["new-catering"] };
  await store.dispatch(bookmarksApi.endpoints.toggleBookmark.initiate({ userId: "customer-a", id: "new-catering", serviceType: "catering" })).unwrap();
  await store.dispatch(bookmarksApi.endpoints.getSavedEventCenters.initiate({ userId: "customer-a", ids: ["venue-a"] })).unwrap();
  assert.equal(requests.some(({ url }) => url.searchParams.getAll("ids").includes("venue-a")), true);
  assert.equal(requests.some(({ url }) => url.searchParams.getAll("ids").includes("venue-b")), false);
});
