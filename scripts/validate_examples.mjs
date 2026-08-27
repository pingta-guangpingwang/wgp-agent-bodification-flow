/** Run the v0.6 schema and cross-document closure validator.
 * SPDX-License-Identifier: Apache-2.0
 */

import { runV06Validation } from "./validate_v06_closure.mjs";

const failures = await runV06Validation();
if (failures > 0) {
  console.error(`\n${failures} validation failure(s).`);
  process.exitCode = 1;
} else {
  console.log("\nAll v0.6 examples and semantic closure gates passed.");
}
