const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadSource(filename, requireMock) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, filename), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: requireMock,
    URL,
    console: { log() {} },
    process: { env: {} },
    window: { location: { origin: "https://payments.example.test" } },
    sessionStorage: { setItem() {} },
  }, { filename });
  return module.exports;
}

const errorHelper = loadSource("hooks/getApiError.ts", () => {
  throw new Error("Unexpected error helper import");
});

// Execute the real component handlers with controlled hook state and gateway
// responses. No Stripe network calls, card data or browser globals are required.
function paymentHarness(filename) {
  const states = [];
  let hookIndex = 0;
  let response = "pi_test_secret_example";
  let rejection;
  let successCount = 0;
  const reportedErrors = [];
  const react = {
    useState(initial) {
      const index = hookIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => {
        states[index] = typeof value === "function" ? value(states[index]) : value;
      }];
    },
    useEffect() {},
  };
  const Component = loadSource(`components/ui/${filename}`, (specifier) => {
    if (specifier === "react") return react;
    if (specifier === "react/jsx-runtime") return {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    };
    if (specifier === "lucide-react") return { X: "X", AlertCircle: "AlertCircle" };
    if (specifier === "@stripe/stripe-js") return { loadStripe: () => Promise.resolve(null) };
    if (specifier === "@stripe/react-stripe-js") return { Elements: "Elements" };
    if (specifier === "./StripePaymentForm") return { default: "StripePaymentForm", __esModule: true };
    if (specifier === "@/hooks/getApiError") return errorHelper;
    if (specifier === "@/redux/services/book") return {
      PaymentReason: { SERVICEREQUEST: "SERVICEREQUEST" },
      useInitiatePaymentMutation: () => [() => ({ unwrap: async () => {
        if (rejection) throw rejection;
        return response;
      } })],
    };
    throw new Error(`Unexpected payment import: ${specifier}`);
  }).default;
  const props = {
    isOpen: true,
    onClose() {},
    amountDue: 1000,
    depositAmount: 1000,
    depositPercentage: 100,
    invoiceId: "invoice-test",
    userId: "customer-test",
    userEmail: "customer@example.test",
    onPaymentSuccess() { successCount++; },
    onPaymentError(error) { reportedErrors.push(error); },
  };
  function render() {
    hookIndex = 0;
    return Component(props);
  }
  function nodes(node, result = []) {
    if (Array.isArray(node)) node.forEach((child) => nodes(child, result));
    else if (node && typeof node === "object") {
      result.push(node);
      nodes(node.props?.children, result);
    }
    return result;
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join(" ");
    if (node && typeof node === "object") return text(node.props?.children);
    return typeof node === "string" || typeof node === "number" ? String(node) : "";
  }
  function paymentButton() {
    return nodes(render()).find((node) => node.type === "button" && node.props.onClick?.name === "processPayment");
  }
  return {
    select(method) {
      const button = nodes(render()).find((node) => node.type === "button" && text(node).includes(method));
      assert.equal(Boolean(button.props.disabled), false);
      button.props.onClick();
    },
    async pay() {
      const button = paymentButton();
      assert.equal(button.props.disabled, false, "the customer can retry payment");
      await button.props.onClick();
    },
    form: () => nodes(render()).find((node) => node.type === "StripePaymentForm"),
    retryEnabled: () => paymentButton()?.props.disabled === false,
    processing: () => states[1],
    text: () => text(render()),
    respond(value) { rejection = undefined; response = value; },
    reject(error) { rejection = error; },
    successes: () => successCount,
    reportedErrors,
  };
}

for (const filename of ["paymentModal.tsx", "BookingPaymentModal.tsx", "QuotePaymentModal.tsx"]) {
  test(`${filename}: Stripe stays active until completion, cancellation or error, then permits retry`, async () => {
    const modal = paymentHarness(filename);
    modal.select("Stripe");
    await modal.pay();
    assert.equal(modal.processing(), true);
    modal.form().props.onCancel();
    assert.equal(modal.retryEnabled(), true);

    await modal.pay();
    modal.form().props.onError("Card declined");
    assert.match(modal.text(), /Card declined/);
    assert.equal(modal.retryEnabled(), true);
    assert.equal(modal.successes(), 0);

    await modal.pay();
    modal.form().props.onSuccess("pi_test");
    assert.equal(modal.successes(), 1);
    assert.equal(modal.processing(), false);
    assert.equal(modal.form(), undefined);
  });

  test(`${filename}: initiation failures show useful errors and leave payment retry available`, async () => {
    const modal = paymentHarness(filename);
    modal.select("Stripe");
    modal.reject({ status: "FETCH_ERROR", error: "TypeError: Failed to fetch" });
    await modal.pay();
    assert.match(modal.text(), /Unable to connect to the server/);
    assert.equal(modal.retryEnabled(), true);

    modal.reject({ status: 400, data: { message: ["First error", "Second error"] } });
    await modal.pay();
    assert.match(modal.text(), /First error Second error/);
    assert.equal(modal.retryEnabled(), true);

    modal.select("Paystack");
    modal.respond("Unexpected provider response");
    await modal.pay();
    assert.match(modal.text(), /payment provider returned an unexpected response/);
    assert.equal(modal.retryEnabled(), true);
    assert.equal(modal.successes(), 0);
    assert.equal(modal.reportedErrors.length, 3);
  });
}
