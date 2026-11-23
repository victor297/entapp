// Optional local preview using deterministic public API fixtures. No accounts or
// backend services are needed. Build the frontend before invoking this script.
const http = require("node:http");
const path = require("node:path");
const { createListingFixture } = require("./fixtures/listing-api.cjs");

async function startPreview({ port = Number(process.env.LISTINGS_PREVIEW_PORT) || 3100, apiPort = 0 } = {}) {
  const fixture = await createListingFixture({ port: apiPort });
  const previousApi = process.env.API_BASE_URL;
  process.env.API_BASE_URL = fixture.origin;
  // The built browser bundle keeps its build-time public API setting; all SSR
  // public listing requests use the process-local fixture override above.
  const next = require("next");
  const app = next({ dev: false, dir: path.resolve(__dirname, ".."), hostname: "127.0.0.1", port });
  let server;
  const close = async () => {
    if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections?.(); });
    await app.close();
    await fixture.close();
    if (previousApi === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previousApi;
  };
  try {
    await app.prepare();
    const handler = app.getRequestHandler();
    server = http.createServer((request, response) => handler(request, response));
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
    return { origin: `http://127.0.0.1:${server.address().port}`, fixture, close };
  } catch (error) {
    await close();
    throw error;
  }
}

if (require.main === module) {
  startPreview().then((preview) => {
    console.log(`Listing fixture preview: ${preview.origin}/event-center`);
    console.log(`Fixture API: ${preview.fixture.origin}`);
    console.log("Press Ctrl+C to stop both servers.");
    const stop = () => preview.close().then(() => process.exit(0));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}

module.exports = { startPreview };
