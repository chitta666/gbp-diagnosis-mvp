import assert from "node:assert/strict";
import fs from "node:fs/promises";

const openapi = JSON.parse(await fs.readFile("public/openapi.json", "utf8"));

assert.equal(openapi.openapi, "3.1.0");
assert.equal(openapi.info.title, "Flowmetric API");
assert.ok(openapi.paths, "paths must exist");
assert.ok(openapi.components?.schemas?.ErrorResponse, "ErrorResponse schema must exist");

const requiredOperations = new Set([
  "diagnoseListing",
  "getSavedReport",
  "getWeeklyReport",
  "listSavedListings",
  "saveListing",
  "deleteSavedListing",
  "createSavedAction",
  "updateSavedActionStatus",
  "trackEvent",
  "getFeedbackSummary",
  "getEventsSummary",
  "runHealthCheck",
  "getHealthStatus",
]);

const foundOperations = new Set();
for (const pathItem of Object.values(openapi.paths)) {
  for (const operation of Object.values(pathItem)) {
    if (operation?.operationId) {
      foundOperations.add(operation.operationId);
    }
  }
}

for (const operationId of requiredOperations) {
  assert.ok(foundOperations.has(operationId), `missing operationId: ${operationId}`);
}

assert.ok(
  openapi.paths["/api/saved-listings"]?.post?.["x-agent-notes"]?.mutatesState,
  "saveListing must declare mutation semantics"
);
assert.ok(
  openapi.paths["/api/health-check"]?.post?.security?.length,
  "runHealthCheck must declare security"
);

console.log("api contract smoke passed");
