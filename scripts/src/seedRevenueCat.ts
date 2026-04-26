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

const ENTITLEMENT_IDENTIFIER = "plus";
const ENTITLEMENT_DISPLAY_NAME = "Met Plus";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Met Plus";

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

const PLANS: PlanSpec[] = [
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
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

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

  const { data: existingProducts, error: listProductsError } =
    await listProducts({
      client,
      path: { project_id: project.id },
      query: { limit: 100 },
    });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    productIdentifier: string,
    plan: PlanSpec,
    isTestStore: boolean,
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) =>
        p.store_identifier === productIdentifier && p.app_id === targetApp.id,
    );
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
      throw new Error(
        `Failed to create ${label} product (${plan.productIdentifier}): ${JSON.stringify(error)}`,
      );
    }
    console.log(`Created ${label} product (${plan.productIdentifier}):`, created.id);
    return created;
  };

  const planRecords: {
    plan: PlanSpec;
    testStoreProduct: Product;
    appStoreProduct: Product;
    playStoreProduct: Product;
  }[] = [];

  for (const plan of PLANS) {
    const testStoreProduct = await ensureProduct(
      app,
      "Test Store",
      plan.productIdentifier,
      plan,
      true,
    );
    const appStoreProduct = await ensureProduct(
      appStoreApp,
      "App Store",
      plan.productIdentifier,
      plan,
      false,
    );
    const playStoreProduct = await ensureProduct(
      playStoreApp,
      "Play Store",
      plan.playStoreProductIdentifier,
      plan,
      false,
    );

    console.log(`Adding test store prices for ${plan.productIdentifier}`);
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testStoreProduct.id },
      body: { prices: plan.prices },
    });
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

  let entitlement: Entitlement;
  const { data: existingEntitlements, error: listEntError } =
    await listEntitlements({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });
  if (listEntError) throw new Error("Failed to list entitlements");

  const existingEnt = existingEntitlements.items?.find(
    (e) => e.lookup_key === ENTITLEMENT_IDENTIFIER,
  );
  if (existingEnt) {
    console.log("Entitlement exists:", existingEnt.id);
    entitlement = existingEnt;
  } else {
    const { data: newEnt, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: {
        lookup_key: ENTITLEMENT_IDENTIFIER,
        display_name: ENTITLEMENT_DISPLAY_NAME,
      },
    });
    if (error) throw new Error("Failed to create entitlement");
    entitlement = newEnt;
    console.log("Created entitlement:", entitlement.id);
  }

  const allProductIds = planRecords.flatMap((r) => [
    r.testStoreProduct.id,
    r.appStoreProduct.id,
    r.playStoreProduct.id,
  ]);
  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: allProductIds },
  });
  if (attachEntErr) {
    if (attachEntErr.type === "unprocessable_entity_error") {
      console.log("Some products already attached to entitlement");
    } else {
      throw new Error("Failed to attach products to entitlement");
    }
  } else {
    console.log("Attached products to entitlement");
  }

  let offering: Offering;
  const { data: existingOfferings, error: listOffErr } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOffErr) throw new Error("Failed to list offerings");

  const existingOff = existingOfferings.items?.find(
    (o) => o.lookup_key === OFFERING_IDENTIFIER,
  );
  if (existingOff) {
    console.log("Offering exists:", existingOff.id);
    offering = existingOff;
  } else {
    const { data: newOff, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: {
        lookup_key: OFFERING_IDENTIFIER,
        display_name: OFFERING_DISPLAY_NAME,
      },
    });
    if (error) throw new Error("Failed to create offering");
    offering = newOff;
    console.log("Created offering:", offering.id);
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

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
      console.log(`Package ${record.plan.packageIdentifier} exists:`, pkg.id);
    } else {
      const { data: newPkg, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: {
          lookup_key: record.plan.packageIdentifier,
          display_name: record.plan.packageDisplayName,
        },
      });
      if (error) throw new Error(`Failed to create package ${record.plan.packageIdentifier}`);
      pkg = newPkg;
      console.log(`Created package ${record.plan.packageIdentifier}:`, pkg.id);
    }

    const { error: attachPkgErr } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
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
    });
    if (attachPkgErr) {
      if (
        attachPkgErr.type === "unprocessable_entity_error" &&
        attachPkgErr.message?.includes("Cannot attach product")
      ) {
        console.log(
          `Skipping attach for ${record.plan.packageIdentifier}: incompatible product`,
        );
      } else {
        throw new Error(
          `Failed to attach products to package ${record.plan.packageIdentifier}`,
        );
      }
    } else {
      console.log(`Attached products to ${record.plan.packageIdentifier}`);
    }
  }

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
  const { data: androidKeys, error: androidKeyErr } = await listAppPublicApiKeys(
    {
      client,
      path: { project_id: project.id, app_id: playStoreApp.id },
    },
  );
  if (androidKeyErr) throw new Error("Failed to list Android keys");

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log("Test Store App ID:", app.id);
  console.log("App Store App ID:", appStoreApp.id);
  console.log("Play Store App ID:", playStoreApp.id);
  console.log("Entitlement Identifier:", ENTITLEMENT_IDENTIFIER);
  for (const r of planRecords) {
    console.log(
      `Plan ${r.plan.productIdentifier} → test:${r.testStoreProduct.id} ios:${r.appStoreProduct.id} android:${r.playStoreProduct.id}`,
    );
  }
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
