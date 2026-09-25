// Post-processes Orval's Zod output to import from `zod/v4`.
//
// The project standardizes on Zod v4 (`zod/v4`). Orval emits
// `import * as zod from "zod"`, whose default (v3) export lacks APIs like
// `zod.int()`. This rewrites the import in the generated Zod module.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = path.resolve(root, "api-zod", "src", "generated", "api.ts");

const source = readFileSync(target, "utf8");
const patched = source
  .replace(/from ['"]zod['"]/g, 'from "zod/v4"')
  .replace(/from ['"]zod\/v4\/v4['"]/g, 'from "zod/v4"');

if (patched !== source) {
  writeFileSync(target, patched);
  console.log("[fix-zod-v4] Rewrote Zod import to 'zod/v4' in", path.relative(root, target));
} else {
  console.log("[fix-zod-v4] No changes needed.");
}
