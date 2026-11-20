---
name: Jest Expo native API mocks
description: Control Expo and React Native native APIs reliably in the jest-expo CJS environment
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

## Problem 3: Switching `Platform.OS` branches in Jest

In the jest-expo environment, `Platform.OS` is a data property, not a getter. `jest.spyOn(Platform, "OS", "get")` fails. Spreading the entire `jest.requireActual("react-native")` module to mock it can evaluate lazy native exports such as `DevMenu` and crash.

**Solution:** Override only the platform property with `Object.defineProperty(Platform, "OS", { configurable: true, writable: true, value: "ios" | "android" })`. Restore the expected platform in `beforeEach`.

**Why:** The iOS and Android UI branches can be exercised in one test process without replacing React Native's exports or loading unsupported native modules.

**How to apply:** For components that branch on `Platform.OS`, keep the real React Native module and temporarily redefine only `Platform.OS`; test iOS and Android behavior explicitly.

## Problem 4: Mock function values captured before initialization

When a `jest.mock` factory assigns a hoisted `mockFn` variable directly to a property, the property can capture `undefined` before the variable's initializer runs.

**Solution:** Create simple mock functions inline in the factory (`scheduleNotificationAsync: jest.fn()...`) or expose a getter that reads the variable at call time. Avoid relying on a later assignment to replace a value already captured by the mock object.

**Why:** The factory property assignment evaluates once; a getter defers the lookup until after the test module has initialized its mock function.

## Problem 5: React Query mocks must survive repeated renders

In React 19 test rendering, screen components may render more than once. A `useQuery` mock that returns results by shifting through an array can give later renders the wrong result and make the screen appear to lose loaded data.

**Solution:** Return stable mock results based on the query key (or another stable query identifier), rather than consuming a sequence on each hook call.

**Why:** Query hooks are invoked again during rerenders; their mocked data should represent the same query consistently across those renders.

## Problem 6: React Native Testing Library events are asynchronous

**Solution:** Await `fireEvent.press`, `fireEvent.changeText`, and custom
`fireEvent(element, eventName)` calls in tests using the current React Native
Testing Library version.

**Why:** An unawaited event can leave React's async `act()` work running after a
test ends, causing overlapping-act warnings and making later tests unable to
find their rendered elements.

**How to apply:** When a component test starts failing with missing elements
after an interaction, first verify that every `fireEvent` promise is awaited.
