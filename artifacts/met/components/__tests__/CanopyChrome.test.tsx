import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { CanopyHeader, CanopyMapCard, CanopyVisibility } from "../CanopyChrome";

jest.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock("@/lib/i18n", () => ({ useT: () => ({ t: (key: string) => key }) }));
jest.mock("expo-image", () => {
  const React = require("react");
  return { Image: (props: any) => React.createElement("View", props) };
});
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  return { Feather: (props: any) => React.createElement("View", props) };
});

describe("Canopy Home controls", () => {
  it("expands and collapses the same map without remounting its location/polling effects", async () => {
    const mount = jest.fn();
    const unmount = jest.fn();
    function MapInstance() {
      useEffect(() => { mount(); return unmount; }, []);
      return <View testID="real-map" />;
    }
    const screen = await render(<CanopyMapCard><MapInstance /></CanopyMapCard>);
    expect(StyleSheet.flatten(screen.getByTestId("home-map-card").props.style).height).toBe(232);
    await fireEvent.press(screen.getByLabelText("Expand map"));
    expect(StyleSheet.flatten(screen.getByTestId("home-map-card").props.style).height).toBe(470);
    await fireEvent.press(screen.getByLabelText("Collapse map"));
    expect(screen.getByTestId("real-map")).toBeTruthy();
    expect(mount).toHaveBeenCalledTimes(1);
    expect(unmount).not.toHaveBeenCalled();
  });

  it("forwards the visibility switch to the real visibility handler", async () => {
    const onToggle = jest.fn();
    const screen = await render(<CanopyVisibility visible={false} onToggle={onToggle} title="Visibility paused" subtitle="Your choice" />);
    expect(screen.getByTestId("home-visibility-switch").props.value).toBe(false);
    await fireEvent(screen.getByTestId("home-visibility-switch"), "valueChange", true);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("keeps language and connection requests independently accessible", async () => {
    const onLanguage = jest.fn();
    const onRequests = jest.fn();
    const screen = await render(<CanopyHeader onLanguage={onLanguage} onRequests={onRequests} requestCount={2} />);
    await fireEvent.press(screen.getByLabelText("Change language"));
    await fireEvent.press(screen.getByLabelText("Connection requests, 2 pending"));
    expect(onLanguage).toHaveBeenCalledTimes(1);
    expect(onRequests).toHaveBeenCalledTimes(1);
  });

  it("keeps chat unread state on Messages and general counts on Notifications", async () => {
    const screen = await render(
      <CanopyHeader
        onLanguage={jest.fn()}
        onRequests={jest.fn()}
        hasUnreadMessages
        notificationCount={0}
      />,
    );

    expect(screen.getByTestId("home-messages-button").props.accessibilityHint)
      .toBe("Unread messages");
    expect(screen.getByTestId("home-notifications-button").props.accessibilityHint)
      .toBeUndefined();

    const notifications = await render(
      <CanopyHeader
        onLanguage={jest.fn()}
        onRequests={jest.fn()}
        hasUnreadMessages={false}
        notificationCount={2}
      />,
    );
    expect(notifications.getByTestId("home-messages-button").props.accessibilityHint)
      .toBeUndefined();
    expect(notifications.getByTestId("home-notifications-button").props.accessibilityHint)
      .toBe("2 unread");
  });
});
