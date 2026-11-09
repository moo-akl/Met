import React from "react";
import { render } from "@testing-library/react-native";
import { VerificationBadge } from "../VerificationBadge";

jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

describe("VerificationBadge", () => {
  it("hides Pioneer status but keeps other verification tiers visible", async () => {
    const screen = await render(
      <VerificationBadge
        isPioneer
        trustScore={250}
        hasPhoto
        viewMode="expanded"
      />,
    );

    expect(screen.queryByLabelText("Met Pioneer")).toBeNull();
    expect(screen.getByLabelText("Highly trusted")).toBeTruthy();
    expect(screen.queryByText("PIONEER")).toBeNull();
  });
});
