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
