/**
 * We need to call useSlideUpModal directly (not via renderHook) to reliably
 * capture the panGesture onEnd callback in the jest-expo test environment.
 * Mocking useState / useEffect lets us invoke the hook as a plain function
 * without triggering "hooks outside component" errors.
 */
jest.mock("react", () => {
  const actual = jest.requireActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: jest.fn((initial: unknown) => [initial, jest.fn()]),
    useEffect: jest.fn(),
  };
});

jest.mock("react-native-reanimated", () => ({
  useSharedValue: jest.fn((initial: number) => ({ value: initial })),
  useAnimatedStyle: jest.fn(() => ({})),
  withSpring: jest.fn(),
  interpolate: jest.fn(),
  runOnJS: jest.fn((fn: unknown) => fn),
  Extrapolation: { CLAMP: "CLAMP" },
}));

jest.mock("react-native-gesture-handler", () => ({
  Gesture: {
    Pan: jest.fn(() => {
      const pan: any = {};
      pan.activeOffsetY = jest.fn(() => pan);
      pan.failOffsetY = jest.fn(() => pan);
      pan.onUpdate = jest.fn(() => pan);
      pan.onEnd = jest.fn(() => pan);
      pan.onFinalize = jest.fn(() => pan);
      return pan;
    }),
  },
}));

import { withSpring, useSharedValue } from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";
import { exitSpringConfig, useSlideUpModal } from "../useSlideUpModal";

const DISMISS_VELOCITY = 800;
const SPRING_OUT = { damping: 22, stiffness: 280 } as const;

describe("exitSpringConfig", () => {
  it("returns the original SPRING_OUT for velocity below DISMISS_VELOCITY", () => {
    const result = exitSpringConfig(DISMISS_VELOCITY - 1);
    expect(result).toEqual(SPRING_OUT);
    expect(result).not.toHaveProperty("velocity");
  });

  it("returns the original SPRING_OUT for velocity exactly at DISMISS_VELOCITY", () => {
    const result = exitSpringConfig(DISMISS_VELOCITY);
    expect(result).toEqual(SPRING_OUT);
    expect(result).not.toHaveProperty("velocity");
  });

  it("returns scaled stiffness/damping and a velocity seed at 2× DISMISS_VELOCITY", () => {
    const v = DISMISS_VELOCITY * 2;
    const factor = 2;
    const result = exitSpringConfig(v);
    expect(result).toEqual({
      stiffness: SPRING_OUT.stiffness * factor,
      damping: SPRING_OUT.damping / Math.sqrt(factor),
      velocity: v,
    });
  });

  it("caps the multiplier at 4× even when velocity is much higher", () => {
    const v = DISMISS_VELOCITY * 10;
    const factor = 4;
    const result = exitSpringConfig(v);
    expect(result).toEqual({
      stiffness: SPRING_OUT.stiffness * factor,
      damping: SPRING_OUT.damping / Math.sqrt(factor),
      velocity: v,
    });
  });

  it("seeds velocity with the actual finger speed (not the cap) when capped", () => {
    const v = DISMISS_VELOCITY * 10;
    const result = exitSpringConfig(v) as { velocity: number };
    expect(result.velocity).toBe(v);
  });
});

/**
 * Tests for the panGesture onEnd decision logic.
 *
 * Three behaviour branches verified:
 *   1. Slow drag below threshold           → snap back  (dragY springs to 0)
 *   2. Slow drag that exceeds threshold    → dismiss    (translateY springs to PANEL_OFFSCREEN)
 *   3. Fast flick regardless of distance   → dismiss    (velocityY alone triggers)
 *
 * Strategy: override the mocks inside beforeAll with mockImplementation so that
 * callbacks and shared-value refs are captured in plain local variables — no
 * module-hoisting or closure-scope ambiguity.  React's useState/useEffect are
 * mocked at the file level so useSlideUpModal can be called as a plain function
 * without triggering "hooks outside component" errors.
 */
describe("panGesture onEnd — dismiss / snap-back decision", () => {
  const PANEL_OFFSCREEN = 800;
  const DISMISS_THRESHOLD = 120;
  const SPRING_IN = { damping: 20, stiffness: 220 };

  let dragYSv: { value: number };
  let onEndCb: (e: { velocityY: number }) => void;
  const onDismissMock = jest.fn();

  beforeAll(() => {
    // ── 1. Control shared values so we can inspect / mutate them later ──────
    let svCount = 0;
    (useSharedValue as jest.Mock).mockImplementation((initial: number) => {
      const sv = { value: initial };
      // Hook creates: index 0 → translateY, index 1 → dragY
      if (svCount === 1) dragYSv = sv;
      svCount++;
      return sv;
    });

    // ── 2. Capture the onEnd callback via a local closure ───────────────────
    let capturedCb: ((e: { velocityY: number }) => void) | null = null;
    (Gesture.Pan as jest.Mock).mockImplementationOnce(() => {
      const pan: any = {};
      pan.activeOffsetY = jest.fn(() => pan);
      pan.failOffsetY = jest.fn(() => pan);
      pan.onUpdate = jest.fn(() => pan);
      pan.onEnd = jest.fn((cb: (e: { velocityY: number }) => void) => {
        capturedCb = cb;
        return pan;
      });
      pan.onFinalize = jest.fn(() => pan);
      return pan;
    });

    // ── 3. Call the hook directly — React hooks are mocked above ────────────
    useSlideUpModal(false, onDismissMock);

    if (!dragYSv!) throw new Error("dragY shared-value was not captured — useSharedValue was not called");
    if (!capturedCb) throw new Error("onEnd callback was not registered — Gesture.Pan().onEnd() was not called");
    onEndCb = capturedCb;
  });

  beforeEach(() => {
    onDismissMock.mockClear();
    (withSpring as jest.Mock).mockClear();
  });

  it("snaps back when drag is below threshold and velocity is slow", () => {
    // 50 px < DISMISS_THRESHOLD (120) and 100 px/s < DISMISS_VELOCITY (800)
    dragYSv.value = 50;
    onEndCb({ velocityY: 100 });

    // snap-back branch: dragY should spring to 0
    expect(withSpring).toHaveBeenCalledWith(0, SPRING_IN);
    // dismiss branch must not be entered
    expect(withSpring).not.toHaveBeenCalledWith(
      PANEL_OFFSCREEN,
      expect.anything(),
      expect.any(Function),
    );
    expect(onDismissMock).not.toHaveBeenCalled();
  });

  it("dismisses when drag exceeds threshold even with slow velocity", () => {
    // 150 px > DISMISS_THRESHOLD (120) — distance alone triggers dismiss
    dragYSv.value = 150;
    onEndCb({ velocityY: 100 });

    // dismiss branch: translateY should spring to PANEL_OFFSCREEN
    expect(withSpring).toHaveBeenCalledWith(
      PANEL_OFFSCREEN,
      expect.anything(),
      expect.any(Function),
    );
    // snap-back must not be triggered
    expect(withSpring).not.toHaveBeenCalledWith(0, expect.anything());
  });

  it("dismisses on a fast flick regardless of drag distance", () => {
    // 30 px — well below DISMISS_THRESHOLD — but 1200 px/s > DISMISS_VELOCITY (800)
    dragYSv.value = 30;
    onEndCb({ velocityY: 1200 });

    // velocity alone must trigger the dismiss branch
    expect(withSpring).toHaveBeenCalledWith(
      PANEL_OFFSCREEN,
      expect.anything(),
      expect.any(Function),
    );
    expect(withSpring).not.toHaveBeenCalledWith(0, expect.anything());
  });
});

/**
 * Tests for the panGesture onFinalize snap-back handler.
 *
 * onFinalize fires after every gesture attempt (including ones where onEnd
 * never fires — e.g. the gesture was cancelled by an incoming call or stolen
 * by a parent handler).  Three branches:
 *   1. cancelled (success=false) + dragY ≠ 0  → spring dragY back to 0
 *   2. cancelled (success=false) + dragY = 0  → no-op (no withSpring call)
 *   3. completed normally (success=true)       → onFinalize leaves dragY alone
 */
describe("panGesture onFinalize — cancelled gesture snap-back", () => {
  const SPRING_IN = { damping: 20, stiffness: 220 };

  let dragYSv: { value: number };
  let onFinalizeCb: (e: object, success: boolean) => void;

  beforeAll(() => {
    // Reset the useSharedValue mock so we get fresh shared-value instances.
    let svCount = 0;
    (useSharedValue as jest.Mock).mockImplementation((initial: number) => {
      const sv = { value: initial };
      // Hook creates: index 0 → translateY, index 1 → dragY
      if (svCount === 1) dragYSv = sv;
      svCount++;
      return sv;
    });

    // Capture the onFinalize callback.
    let capturedCb: ((e: object, success: boolean) => void) | null = null;
    (Gesture.Pan as jest.Mock).mockImplementationOnce(() => {
      const pan: any = {};
      pan.activeOffsetY = jest.fn(() => pan);
      pan.failOffsetY = jest.fn(() => pan);
      pan.onUpdate = jest.fn(() => pan);
      pan.onEnd = jest.fn(() => pan);
      pan.onFinalize = jest.fn((cb: (e: object, success: boolean) => void) => {
        capturedCb = cb;
        return pan;
      });
      return pan;
    });

    useSlideUpModal(false, jest.fn());

    if (!dragYSv!) throw new Error("dragY shared-value was not captured");
    if (!capturedCb) throw new Error("onFinalize callback was not registered");
    onFinalizeCb = capturedCb;
  });

  beforeEach(() => {
    (withSpring as jest.Mock).mockClear();
  });

  it("springs dragY back to 0 when gesture is cancelled and dragY is non-zero", () => {
    dragYSv.value = 80;
    onFinalizeCb({}, false);

    expect(withSpring).toHaveBeenCalledTimes(1);
    expect(withSpring).toHaveBeenCalledWith(0, SPRING_IN);
  });

  it("does not call withSpring when gesture is cancelled but dragY is already 0", () => {
    dragYSv.value = 0;
    onFinalizeCb({}, false);

    expect(withSpring).not.toHaveBeenCalled();
  });

  it("does not touch dragY when the gesture completed normally (success=true)", () => {
    dragYSv.value = 60;
    onFinalizeCb({}, true);

    expect(withSpring).not.toHaveBeenCalled();
  });
});
