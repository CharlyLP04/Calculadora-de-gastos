import { startVitest } from "vitest/node";
import { transformAsync } from "@babel/core";
import ts from "@babel/plugin-transform-typescript";
const ctx = await startVitest(
  "test",
  [],
  {
    config: false,
    run: true,
    pool: "threads",
    maxWorkers: 1,
    include: ["src/**/*.test.ts"],
  },
  {
    resolve: { preserveSymlinks: true },
    esbuild: false,
    plugins: [
      {
        name: "test-typescript",
        enforce: "pre",
        async transform(code, id) {
          if (id.endsWith(".ts"))
            return await transformAsync(code, {
              filename: id,
              plugins: [ts],
              babelrc: false,
              configFile: false,
            });
        },
      },
    ],
  },
);
await ctx?.close();
