jest.mock("react-native-reanimated", () => ({
  useSharedValue: jest.fn(() => ({ value: 0 })),
  useAnimatedStyle: jest.fn(() => ({})),
  withSpring: jest.fn(),
  interpolate: jest.fn(),
  runOnJS: jest.fn((fn: unknown) => fn),
  Extrapolation: { CLAMP: "CLAMP" },
}));

jest.mock("react-native-gesture-handler", () => ({
  Gesture: {
    Pan: jest.fn(() => ({
      activeOffsetY: jest.fn().mockReturnThis(),
      failOffsetY: jest.fn().mockReturnThis(),
      onUpdate: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
      onFinalize: jest.fn().mockReturnThis(),
    })),
  },
}));

import { exitSpringConfig } from "../useSlideUpModal";

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
