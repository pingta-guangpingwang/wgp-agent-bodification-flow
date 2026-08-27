import { spawnSync } from "node:child_process";

export const runChecker = (checkerPath, inputPath, expectedPath, resultPath) => spawnSync(
  process.execPath,
  [checkerPath, inputPath, expectedPath, resultPath],
  { encoding: "utf8" },
);
