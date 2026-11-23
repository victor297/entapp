const { test, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { configureStore } = require("@reduxjs/toolkit");

const root = path.resolve(__dirname, "..");
function sourceLoader(stubs = new Map()) {
  const modules = new Map();
  return function load(filename) {
    filename = path.resolve(root, filename);
    if (stubs.has(filename)) return stubs.get(filename);
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
    }).outputText;
    const localRequire = (specifier) => {
      if (stubs.has(specifier)) return stubs.get(specifier);
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return require(specifier);
      let resolved = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      if (!path.extname(resolved)) resolved += fs.existsSync(`${resolved}.ts`) ? ".ts" : ".tsx";
      return load(resolved);
    };
    vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename })(localRequire, module, module.exports);
    return module.exports;
  };
}

process.env.NEXT_PUBLIC_API_BASE_URL = "https://auth.example.test";
const load = sourceLoader();
const { getApiError } = load("hooks/getApiError.ts");
const { api } = load("redux/services/authApi.ts");
const originalFetch = global.fetch;
const stores = [];
function store() {
  const instance = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: (defaults) => defaults().concat(api.middleware) });
  stores.push(instance);
  return instance;
}
afterEach(() => { stores.splice(0).forEach((instance) => instance.dispatch(api.util.resetApiState())); });
after(() => { global.fetch = originalFetch; });

test("CORS-like fetch failures are connection errors, never invalid credentials", async () => {
  global.fetch = async () => { throw new TypeError("Failed to fetch"); };
  let error;
  try { await store().dispatch(api.endpoints.login.initiate({ email: "customer@example.test", password: "test" })).unwrap(); } catch (caught) { error = caught; }
  assert.equal(error.status, "FETCH_ERROR");
  assert.match(getApiError(error, "Unable to log in. Please try again."), /connect to the server/i);
  assert.doesNotMatch(getApiError(error, "Invalid credentials"), /invalid credentials/i);
});

test("a real credential rejection keeps the server's validation message", async () => {
  global.fetch = async () => new Response(JSON.stringify({ message: "Invalid credentials" }), { status: 401, headers: { "Content-Type": "application/json" } });
  await assert.rejects(store().dispatch(api.endpoints.login.initiate({ email: "customer@example.test", password: "wrong" })).unwrap(), (error) => getApiError(error, "Unable to log in.") === "Invalid credentials");
});

test("expired access tokens refresh once and retry the protected request with credentials", async () => {
  const makeStorage = () => {
    const values = new Map();
    return {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    };
  };
  global.localStorage = makeStorage();
  global.sessionStorage = makeStorage();
  global.localStorage.setItem("access_token", "expired-access-token");
  global.localStorage.setItem("user_id", "customer-1");
  global.window = { dispatchEvent: () => {} };
  const requests = [];
  global.fetch = async input => {
    const url = new URL(input.url);
    requests.push({ path: url.pathname, authorization: input.headers.get("Authorization"), credentials: input.credentials });
    if (url.pathname === "/users/refresh-login") {
      return new Response(JSON.stringify({ access_token: "fresh-access-token" }), { headers: { "Content-Type": "application/json" } });
    }
    if (input.headers.get("Authorization") === "Bearer fresh-access-token") {
      return new Response(JSON.stringify({ id: "customer-1" }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ message: "Restricted area! you must login first" }), { status: 401, headers: { "Content-Type": "application/json" } });
  };

  try {
    const user = await store().dispatch(api.endpoints.getUserById.initiate("customer-1")).unwrap();
    assert.equal(user.id, "customer-1");
    assert.deepEqual(requests.map(request => request.path), ["/users/customer-1", "/users/refresh-login", "/users/customer-1"]);
    assert.equal(requests[1].credentials, "include");
    assert.equal(global.localStorage.getItem("access_token"), "fresh-access-token");
    assert.equal(requests[2].authorization, "Bearer fresh-access-token");
  } finally {
    delete global.localStorage;
    delete global.sessionStorage;
    delete global.window;
  }
});

test("plain-text forgot-password success is accepted by the actual API endpoint", async () => {
  global.fetch = async () => new Response("We sent you an email containing details to reset your password", { status: 201, headers: { "Content-Type": "text/html; charset=utf-8" } });
  const response = await store().dispatch(api.endpoints.forgotPassword.initiate({ email: "customer@example.test" })).unwrap();
  assert.match(response, /sent you an email/);
});

test("forgot-password HTTP and transport failures reject instead of supplying success data", async () => {
  global.fetch = async () => new Response(JSON.stringify({ message: "Reset service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
  await assert.rejects(store().dispatch(api.endpoints.forgotPassword.initiate({ email: "customer@example.test" })).unwrap(), (error) => getApiError(error, "Unable to send.") === "Reset service unavailable");
  global.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(store().dispatch(api.endpoints.forgotPassword.initiate({ email: "customer@example.test" })).unwrap(), (error) => error.status === "FETCH_ERROR");
});

test("shared errors distinguish timeout, bad response, validation arrays and gateway failures", () => {
  assert.match(getApiError({ status: "TIMEOUT_ERROR" }, "Invalid credentials"), /too long/);
  assert.match(getApiError({ status: "PARSING_ERROR", data: "<html>Gateway error</html>" }, "Invalid credentials"), /unexpected response/);
  assert.equal(getApiError({ status: 400, data: { message: ["Email is required", "Password is required"] } }, "Failed"), "Email is required Password is required");
  assert.match(getApiError({ status: 502, data: "<html>Bad gateway</html>" }, "Failed"), /temporarily unavailable/);
});

async function submitForgot(result) {
  const states = [];
  const stateChanges = [];
  const trigger = () => {
    const response = Promise.resolve(result);
    response.unwrap = async () => { if (result.error) throw result.error; return result.data; };
    return response;
  };
  const stubs = new Map([
    ["react", { ...require("react"), useState: (initial) => { const index = states.push(initial) - 1; return [initial, (value) => { states[index] = value; stateChanges.push({ index, value }); }]; } }],
    ["react-hook-form", { useForm: () => ({ register: () => ({}), handleSubmit: (handler) => handler, formState: { errors: {} } }) }],
    [path.join(root, "redux/services/authApi.ts"), { useForgotPasswordMutation: () => [trigger, { isLoading: false }] }],
    ["next/image", () => null], ["next/link", () => null],
  ]);
  const Page = sourceLoader(stubs)("app/(auth)/forgotpassword/page.tsx").default;
  const tree = Page();
  function findForm(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "form") return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = findForm(child); if (found) return found; }
  }
  await findForm(tree).props.onSubmit({ email: "customer@example.test" });
  return { notification: states[0], isSubmitting: states[1], stateChanges };
}

test("the real forgot-password submit handler shows an error for RTK's resolved error result", async () => {
  const result = await submitForgot({ error: { status: "FETCH_ERROR", error: "TypeError: Failed to fetch" } });
  assert.equal(result.notification.type, "error");
  assert.match(result.notification.message, /connect to the server/);
  assert.equal(result.isSubmitting, false);
  assert.equal(result.stateChanges.some(({ value }) => value?.type === "success"), false);
});

test("the real forgot-password submit handler only shows email sent after confirmed success", async () => {
  const result = await submitForgot({ data: "Reset email accepted" });
  assert.deepEqual(result.notification, { type: "success", message: "Reset email accepted" });
  assert.equal(result.isSubmitting, false);
});

test("login redirects unverified users to email verification without storing their tokens", async () => {
  const values = new Map();
  global.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  global.window = {
    location: { origin: "https://example.test", search: "" },
    dispatchEvent: () => {},
  };
  const states = [];
  const routes = [];
  const resendCalls = [];
  const user = { id: "unverified-user", email: "pending@example.test", isEmailVerified: false, userType: "CUSTOMER" };
  const trigger = () => ({ unwrap: async () => ({ user, access_token: "do-not-store", refresh_token: "do-not-store-either" }) });
  const resend = ({ id }) => {
    resendCalls.push(id);
    return { unwrap: async () => ({ id }) };
  };
  const stubs = new Map([
    ["react", { ...require("react"), useState: initial => { const index = states.push(initial === true ? false : initial) - 1; return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; }, useEffect: () => {} }],
    ["react-hook-form", { useForm: () => ({ register: () => ({}), handleSubmit: handler => handler, formState: { errors: {} } }) }],
    ["next/navigation", { useRouter: () => ({ replace: route => routes.push(route) }) }],
    ["next/image", () => null],
    ["next/link", () => null],
    ["lucide-react", { Eye: () => null, EyeOff: () => null, Lock: () => null, Mail: () => null, Loader2: () => null }],
    [path.join(root, "redux/services/authApi.ts"), {
      useLoginMutation: () => [trigger, { isLoading: false, error: null }],
      useRefreshTokenMutation: () => [() => {}, { isLoading: false }],
      useResendVerificationMutation: () => [resend, { isLoading: false }],
      UserType: { CUSTOMER: "CUSTOMER", ADMIN: "ADMIN", STAFF: "STAFF", SERVICE_PROVIDER: "SERVICE_PROVIDER" },
      ServiceType: { CATERING: "CATERING" },
    }],
    [path.join(root, "components/ui/Notification.tsx"), () => null],
    [path.join(root, "hooks/getApiError.ts"), { getApiError }],
    [path.join(root, "lib/bookmark-state.ts"), { persistBookmarkState: () => {} }],
    [path.join(root, "lib/current-user.ts"), { currentUserSnapshot: () => "" }],
  ]);
  const Page = sourceLoader(stubs)("app/(auth)/login/page.tsx").default;
  const tree = Page();
  function findForm(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "form") return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = findForm(child);
      if (found) return found;
    }
  }
  await findForm(tree).props.onSubmit({ email: user.email, password: "password", rememberMe: false });
  assert.deepEqual(resendCalls, [user.id]);
  assert.deepEqual(routes, [`/verify-email?email=${encodeURIComponent(user.email)}`]);
  assert.equal(localStorage.getItem("userId"), user.id);
  assert.equal(localStorage.getItem("access_token"), null);
  assert.equal(localStorage.getItem("refresh_token"), null);
  delete global.localStorage;
  delete global.sessionStorage;
  delete global.window;
});
