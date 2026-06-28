---
name: Jest mock isDevice in expo-met tests
description: How to control Device.isDevice and handle dynamic import() mocking in jest-expo CJS test environment
---

## Problem 1: `Device.isDevice` mutations don't propagate

Babel's `_interopRequireWildcard` **copies** the value of `isDevice` into the namespace wrapper at module load time. Mutating `require("expo-device").isDevice` or doing `(Device as any).isDevice = false` afterward has no effect on the namespace object held by the module under test.

**Solution**: Use a getter-based mock factory with a `var mockIsDevice` variable. `mock`-prefixed variables are allowed in `jest.mock` factories after hoisting (babel-plugin-jest-hoist exception). Getters are copied by-descriptor, not by-value, so the getter closure propagates mutations at call time.

```ts
// eslint-disable-next-line no-var
var mockIsDevice = true; // must use var (not let/const) for hoist safety

jest.mock("expo-device", () => ({
  get isDevice() { return mockIsDevice; },
}));

// In test: mockIsDevice = false;
```

**Why `var` and not `let`**: `let` has TDZ (Temporal Dead Zone). Even though the factory is called lazily, jest.mock hoisting means there's a risk the variable is uninitialized when the factory is registered. `var` is initialized to `undefined` immediately, and assigned before the factory is actually invoked.

## Problem 2: Dynamic `import()` inside source files cannot be mocked in jest-expo CJS mode

jest-expo uses `caller: { name: "metro", bundler: "metro" }` in its babel-jest transform. `babel-preset-expo` in Metro mode does NOT transform dynamic `import()` to `require()`. As a result, Jest's module registry cannot intercept the dynamic import and Node throws: `TypeError: A dynamic import callback was invoked without --experimental-vm-modules`.

This affects any function that uses `await import("./some-module")` as a lazy load.

**Solution**: Add an optional `_uploadOverride` parameter (dependency injection seam) to the function. Tests pass a mock function directly; production callers use the default (which falls through to the dynamic import).

```ts
export async function registerAndUploadPushToken(
  uid: string,
  _uploadOverride?: (opts: { uid: string }, token: string) => Promise<void>,
): Promise<string | null> {
  ...
  if (_uploadOverride) {
    await _uploadOverride({ uid }, token);
  } else {
    const { api } = await import("./api/client");
    await api.registerPushToken({ uid }, token);
  }
}
```

**Why:** Dynamic imports in the expo/Metro Babel pipeline bypass Jest's require-interception. Changing `caller.supportsStaticESM: false` in jest.config.js does not fix it — babel-preset-expo uses the caller name, not the ESM flag, to decide which module transform to apply.

## Applied in
- `artifacts/met/lib/__tests__/notifications.test.ts`
- `artifacts/met/lib/notifications.ts` (added `_uploadOverride` parameter + `PushTokenUploader` type)
