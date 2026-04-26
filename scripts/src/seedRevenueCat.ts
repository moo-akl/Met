import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

import { getUncachableRevenueCatClient } from "./revenueCatClient.ts";

const PROJECT_NAME = "Met";

const APP_STORE_APP_NAME = "Met (iOS)";
const APP_STORE_BUNDLE_ID = "com.metapp.ios";
const PLAY_STORE_APP_NAME = "Met (Android)";
const PLAY_STORE_PACKAGE_NAME = "com.metapp.android";

type PlanSpec = {
  productIdentifier: string;
  playStoreProductIdentifier: string;
  productDisplayName: string;
  productUserFacingTitle: string;
  productDuration: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
  packageIdentifier: string;
  packageDisplayName: string;
  prices: { amount_micros: number; currency: string }[];
};

type TierSpec = {
  // Lookup keys
  entitlementIdentifier: string;
  entitlementDisplayName: string;
  // Other entitlements that purchasing this tier ALSO grants (so Pro grants Plus too)
  alsoGrantsEntitlementIdentifiers: string[];
  offeringIdentifier: string;
  offeringDisplayName: string;
  isCurrent: boolean;
  plans: PlanSpec[];
};

const PLUS_TIER: TierSpec = {
  entitlementIdentifier: "plus",
  entitlementDisplayName: "Met Plus",
  alsoGrantsEntitlementIdentifiers: [],
  offeringIdentifier: "default",
  offeringDisplayName: "Met Plus",
  isCurrent: true,
  plans: [
    {
      productIdentifier: "met_plus_monthly",
      playStoreProductIdentifier: "met_plus_monthly:monthly",
      productDisplayName: "Met Plus Monthly",
      productUserFacingTitle: "Met Plus",
      productDuration: "P1M",
      packageIdentifier: "$rc_monthly",
      packageDisplayName: "Monthly",
      prices: [
        { amount_micros: 4990000, currency: "USD" },
        { amount_micros: 4490000, currency: "EUR" },
      ],
    },
    {
      productIdentifier: "met_plus_yearly",
      playStoreProductIdentifier: "met_plus_yearly:yearly",
      productDisplayName: "Met Plus Yearly",
      productUserFacingTitle: "Met Plus",
      productDuration: "P1Y",
      packageIdentifier: "$rc_annual",
      packageDisplayName: "Yearly",
      prices: [
        { amount_micros: 39990000, currency: "USD" },
        { amount_micros: 35990000, currency: "EUR" },
      ],
    },
  ],
};

const PRO_TIER: TierSpec = {
  entitlementIdentifier: "pro",
  entitlementDisplayName: "Met Pro",
  // Pro purchases also unlock all Plus features
  alsoGrantsEntitlementIdentifiers: ["plus"],
  offeringIdentifier: "pro",
  offeringDisplayName: "Met Pro",
  isCurrent: false,
  plans: [
    {
      productIdentifier: "met_pro_monthly",
      playStoreProductIdentifier: "met_pro_monthly:monthly",
      productDisplayName: "Met Pro Monthly",
      productUserFacingTitle: "Met Pro",
      productDuration: "P1M",
      packageIdentifier: "$rc_monthly",
      packageDisplayName: "Monthly",
      prices: [
        { amount_micros: 8990000, currency: "USD" },
        { amount_micros: 7990000, currency: "EUR" },
      ],
    },
    {
      productIdentifier: "met_pro_yearly",
      playStoreProductIdentifier: "met_pro_yearly:yearly",
      productDisplayName: "Met Pro Yearly",
      productUserFacingTitle: "Met Pro",
      productDuration: "P1Y",
      packageIdentifier: "$rc_annual",
      packageDisplayName: "Yearly",
      prices: [
        { amount_micros: 69990000, currency: "USD" },
        { amount_micros: 62990000, currency: "EUR" },
      ],
    },
  ],
};

const TIERS: TierSpec[] = [PLUS_TIER, PRO_TIER];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isRateLimit = (e: unknown): e is { backoff_ms?: number } =>
  !!e && typeof e === "object" && "type" in e && (e as { type?: string })["type"] === "rate_limit_error";

async function withRetry<T>(label: string, fn: () => Promise<{ data?: T; error?: unknown }>): Promise<{ data?: T; error?: unknown }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await fn();
    if (!result.error || !isRateLimit(result.error)) return result;
    const backoff = (result.error.backoff_ms ?? 5000) + 500;
    console.log(`Rate limited on ${label}, sleeping ${backoff}ms (attempt ${attempt + 1}/5)`);
    await sleep(backoff);
  }
  return fn();
}

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  let project: Project;
  const { data: existingProjects, error: listProjectsError } =
    await listProjects({ client, query: { limit: 20 } });
  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find(
    (p) => p.name === PROJECT_NAME,
  );
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  let app: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find(
    (a) => a.type === "app_store",
  );
  let playStoreApp: App | undefined = apps.items.find(
    (a) => a.type === "play_store",
  );

  if (!app) throw new Error("No app with test store found");
  console.log("Test store app:", app.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app found:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app found:", playStoreApp.id);
  }

  const refetchProducts = async () => {
    const { data, error } = await listProducts({
      client,
      path: { project_id: project.id },
      query: { limit: 100 },
    });
    if (error) throw new Error("Failed to list products");
    return data;
  };
  let existingProducts = await refetchProducts();

  const ensureProduct = async (
    targetApp: App,
    label: string,
    productIdentifier: string,
    plan: PlanSpec,
    isTestStore: boolean,
  ): Promise<Product> => {
    const findExisting = () =>
      existingProducts.items?.find(
        (p) =>
          p.store_identifier === productIdentifier && p.app_id === targetApp.id,
      );
    const existing = findExisting();
    if (existing) {
      console.log(`${label} ${plan.productIdentifier} exists:`, existing.id);
      return existing;
    }
    const body: CreateProductData["body"] = {
      store_identifier: productIdentifier,
      app_id: targetApp.id,
      type: "subscription",
      display_name: plan.productDisplayName,
    };
    if (isTestStore) {
      body.subscription = { duration: plan.productDuration };
      body.title = plan.productUserFacingTitle;
    }
    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) {
      if (
        typeof error === "object" &&
        error &&
        "type" in error &&
        error["type"] === "resource_already_exists"
      ) {
        console.log(
          `${label} product (${plan.productIdentifier}) already exists, refetching`,
        );
        existingProducts = await refetchProducts();
        const refound = findExisting();
        if (refound) return refound;
      }
      throw new Error(
        `Failed to create ${label} product (${plan.productIdentifier}): ${JSON.stringify(error)}`,
      );
    }
    console.log(`Created ${label} product (${plan.productIdentifier}):`, created.id);
    return created;
  };

  type PlanRecord = {
    plan: PlanSpec;
    testStoreProduct: Product;
    appStoreProduct: Product;
    playStoreProduct: Product;
  };

  const ensureTier = async (tier: TierSpec) => {
    console.log(`\n=== Ensuring tier: ${tier.entitlementIdentifier} ===`);

    const planRecords: PlanRecord[] = [];
    for (const plan of tier.plans) {
      const testStoreProduct = await ensureProduct(
        app!,
        "Test Store",
        plan.productIdentifier,
        plan,
        true,
      );
      const appStoreProduct = await ensureProduct(
        appStoreApp!,
        "App Store",
        plan.productIdentifier,
        plan,
        false,
      );
      const playStoreProduct = await ensureProduct(
        playStoreApp!,
        "Play Store",
        plan.playStoreProductIdentifier,
        plan,
        false,
      );

      console.log(`Adding test store prices for ${plan.productIdentifier}`);
      const { error: priceError } = await withRetry(
        `prices ${plan.productIdentifier}`,
        () =>
          client.post<TestStorePricesResponse>({
            url: "/projects/{project_id}/products/{product_id}/test_store_prices",
            path: { project_id: project.id, product_id: testStoreProduct.id },
            body: { prices: plan.prices },
          }),
      );
      if (priceError) {
        if (
          priceError &&
          typeof priceError === "object" &&
          "type" in priceError &&
          priceError["type"] === "resource_already_exists"
        ) {
          console.log("Test store prices already exist");
        } else {
          throw new Error(
            `Failed to add test store prices: ${JSON.stringify(priceError)}`,
          );
        }
      } else {
        console.log("Added test store prices");
      }

      planRecords.push({
        plan,
        testStoreProduct,
        appStoreProduct,
        playStoreProduct,
      });
    }

    // Ensure entitlement
    const { data: existingEntitlements, error: listEntError } =
      await listEntitlements({
        client,
        path: { project_id: project.id },
        query: { limit: 20 },
      });
    if (listEntError) throw new Error("Failed to list entitlements");

    let entitlement: Entitlement;
    const existingEnt = existingEntitlements.items?.find(
      (e) => e.lookup_key === tier.entitlementIdentifier,
    );
    if (existingEnt) {
      console.log("Entitlement exists:", existingEnt.id);
      entitlement = existingEnt;
    } else {
      const { data: newEnt, error } = await createEntitlement({
        client,
        path: { project_id: project.id },
        body: {
          lookup_key: tier.entitlementIdentifier,
          display_name: tier.entitlementDisplayName,
        },
      });
      if (error) throw new Error("Failed to create entitlement");
      entitlement = newEnt;
      console.log("Created entitlement:", entitlement.id);
    }

    // All entitlements granted by this tier's products: itself + escalations
    const allEntitlementKeys = [
      tier.entitlementIdentifier,
      ...tier.alsoGrantsEntitlementIdentifiers,
    ];
    const tierProductIds = planRecords.flatMap((r) => [
      r.testStoreProduct.id,
      r.appStoreProduct.id,
      r.playStoreProduct.id,
    ]);

    for (const entKey of allEntitlementKeys) {
      const ent = existingEntitlements.items?.find(
        (e) => e.lookup_key === entKey,
      );
      const targetEnt =
        entKey === tier.entitlementIdentifier ? entitlement : ent;
      if (!targetEnt) {
        console.log(
          `Skipping attach to ${entKey}: entitlement not yet created (will be picked up on next run)`,
        );
        continue;
      }
      const { error: attachEntErr } = await withRetry(
        `attach ent ${entKey}`,
        () =>
          attachProductsToEntitlement({
            client,
            path: { project_id: project.id, entitlement_id: targetEnt.id },
            body: { product_ids: tierProductIds },
          }),
      );
      if (attachEntErr) {
        if (attachEntErr.type === "unprocessable_entity_error") {
          console.log(`Some products already attached to ${entKey}`);
        } else {
          throw new Error(
            `Failed to attach products to entitlement ${entKey}: ${JSON.stringify(attachEntErr)}`,
          );
        }
      } else {
        console.log(`Attached products to entitlement ${entKey}`);
      }
    }

    // Ensure offering
    const { data: existingOfferings, error: listOffErr } = await listOfferings({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });
    if (listOffErr) throw new Error("Failed to list offerings");

    let offering: Offering;
    const existingOff = existingOfferings.items?.find(
      (o) => o.lookup_key === tier.offeringIdentifier,
    );
    if (existingOff) {
      console.log("Offering exists:", existingOff.id);
      offering = existingOff;
    } else {
      const { data: newOff, error } = await createOffering({
        client,
        path: { project_id: project.id },
        body: {
          lookup_key: tier.offeringIdentifier,
          display_name: tier.offeringDisplayName,
        },
      });
      if (error) throw new Error("Failed to create offering");
      offering = newOff;
      console.log("Created offering:", offering.id);
    }

    if (tier.isCurrent && !offering.is_current) {
      const { error } = await updateOffering({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { is_current: true },
      });
      if (error) throw new Error("Failed to set offering as current");
      console.log("Set offering as current");
    }

    // Ensure packages
    const { data: existingPackages, error: listPkgErr } = await listPackages({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      query: { limit: 20 },
    });
    if (listPkgErr) throw new Error("Failed to list packages");

    for (const record of planRecords) {
      let pkg: Package | undefined = existingPackages.items?.find(
        (p) => p.lookup_key === record.plan.packageIdentifier,
      );
      if (pkg) {
        console.log(
          `Package ${record.plan.packageIdentifier} exists:`,
          pkg.id,
        );
      } else {
        const { data: newPkg, error } = await createPackages({
          client,
          path: { project_id: project.id, offering_id: offering.id },
          body: {
            lookup_key: record.plan.packageIdentifier,
            display_name: record.plan.packageDisplayName,
          },
        });
        if (error)
          throw new Error(
            `Failed to create package ${record.plan.packageIdentifier}`,
          );
        pkg = newPkg;
        console.log(
          `Created package ${record.plan.packageIdentifier}:`,
          pkg.id,
        );
      }

      const { error: attachPkgErr } = await withRetry(
        `attach pkg ${record.plan.packageIdentifier}`,
        () =>
          attachProductsToPackage({
            client,
            path: { project_id: project.id, package_id: pkg!.id },
            body: {
              products: [
                {
                  product_id: record.testStoreProduct.id,
                  eligibility_criteria: "all",
                },
                {
                  product_id: record.appStoreProduct.id,
                  eligibility_criteria: "all",
                },
                {
                  product_id: record.playStoreProduct.id,
                  eligibility_criteria: "all",
                },
              ],
            },
          }),
      );
      if (attachPkgErr) {
        if (
          attachPkgErr.type === "unprocessable_entity_error" &&
          attachPkgErr.message?.includes("Cannot attach product")
        ) {
          console.log(
            `Skipping attach for ${record.plan.packageIdentifier}: incompatible product`,
          );
        } else if (attachPkgErr.type === "unprocessable_entity_error") {
          console.log(
            `Some products already attached to ${record.plan.packageIdentifier}`,
          );
        } else {
          throw new Error(
            `Failed to attach products to package ${record.plan.packageIdentifier}: ${JSON.stringify(attachPkgErr)}`,
          );
        }
      } else {
        console.log(`Attached products to ${record.plan.packageIdentifier}`);
      }
    }

    return { tier, planRecords };
  };

  // Run twice: first pass creates all entitlements & products. Second pass
  // re-attaches products to entitlements (handles the case where Pro is being
  // created for the first time and the Plus entitlement already existed).
  for (const tier of TIERS) await ensureTier(tier);
  console.log("\n--- Reconciling cross-tier entitlement attachments ---");
  for (const tier of TIERS) await ensureTier(tier);

  const { data: testKeys, error: testKeyErr } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: app.id },
  });
  if (testKeyErr) throw new Error("Failed to list test store keys");
  const { data: iosKeys, error: iosKeyErr } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: appStoreApp.id },
  });
  if (iosKeyErr) throw new Error("Failed to list iOS keys");
  const { data: androidKeys, error: androidKeyErr } =
    await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: playStoreApp.id },
    });
  if (androidKeyErr) throw new Error("Failed to list Android keys");

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log(
    "Public API Keys - Test Store:",
    testKeys?.items.map((i) => i.key).join(", ") ?? "N/A",
  );
  console.log(
    "Public API Keys - App Store:",
    iosKeys?.items.map((i) => i.key).join(", ") ?? "N/A",
  );
  console.log(
    "Public API Keys - Play Store:",
    androidKeys?.items.map((i) => i.key).join(", ") ?? "N/A",
  );
  console.log("====================\n");
}

seedRevenueCat().catch((err) => {
  console.error(err);
  process.exit(1);
});
