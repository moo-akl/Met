import { defineConfig, InputTransformerFn } from "orval";
import path from "path";
import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");
const specPath = path.resolve(__dirname, "openapi.yaml");

// Orval cleans outputs before parsing its input. Validate while loading the
// config so neither project can delete working files for invalid/ambiguous YAML.
// Keep uniqueKeys strict even for identical duplicates: never choose a contract
// by silently overwriting a mapping.
const document = parseDocument(readFileSync(specPath, "utf8"), {
  uniqueKeys: true,
});
if (document.errors.length > 0) {
  throw new Error(
    `Invalid API specification ${specPath}; generated files were not changed.\n` +
      document.errors.map((error) => error.message).join("\n"),
  );
}

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: specPath,
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        query: {
          // Do not auto-detect from api-spec: the client package owns this runtime.
          version: 5,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: specPath,
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          // Orval itself depends on Zod 4; our generated schemas must use Zod 3.
          version: 3,
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
