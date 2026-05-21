import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const localesDir = path.resolve(
  __dirname,
  "../../artifacts/met/lib/i18n/locales"
);

type NestedValue = string | NestedObject;
type NestedObject = { [key: string]: NestedValue };

function collectKeyPaths(obj: NestedObject, prefix = ""): string[] {
  const paths: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      paths.push(...collectKeyPaths(value as NestedObject, fullPath));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

const LOCALES = ["ar", "es", "fr", "nl", "pt", "ru", "vi", "zh"] as const;

async function main(): Promise<void> {
  const { en } = (await import(`${localesDir}/en.ts`)) as {
    en: NestedObject;
  };

  const enPaths = new Set(collectKeyPaths(en));

  let hasErrors = false;

  for (const locale of LOCALES) {
    const mod = (await import(`${localesDir}/${locale}.ts`)) as Record<
      string,
      NestedObject
    >;
    const localeObj = mod[locale];

    if (!localeObj) {
      console.error(`\n✗ ${locale}: could not load locale object`);
      hasErrors = true;
      continue;
    }

    const localePaths = new Set(collectKeyPaths(localeObj));
    const missing = [...enPaths].filter((p) => !localePaths.has(p));

    if (missing.length > 0) {
      hasErrors = true;
      console.error(`\n✗ ${locale} — ${missing.length} missing key(s):`);
      for (const key of missing) {
        console.error(`    • ${key}`);
      }
    } else {
      console.log(`✓ ${locale} — all keys present`);
    }
  }

  if (hasErrors) {
    console.error(
      "\ni18n check failed. Add the missing keys to the locale files listed above."
    );
    process.exit(1);
  } else {
    console.log(`\nAll ${LOCALES.length} locales are complete.`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
