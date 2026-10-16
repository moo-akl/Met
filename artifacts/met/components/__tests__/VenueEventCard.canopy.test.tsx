import React from "react";
import { Alert } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { VenueEventCard } from "../VenueEventCard";

const mockRsvp = jest.fn();
jest.mock("@/contexts/AppContext", () => ({ useApp: () => ({ authedUid: "test-guest" }) }));
jest.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isDark: false, theme: "light" }),
}));
jest.mock("@/lib/api/client", () => ({ api: { rsvpEvent: (...args: unknown[]) => mockRsvp(...args) } }));
jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  return { LinearGradient: (props: any) => React.createElement("View", props) };
});

const event = { id: 17, placeId: "venue-17", title: "Community gathering", startsAt: "2026-11-10T10:00:00Z", rsvpCount: 3 };

beforeEach(() => { jest.clearAllMocks(); mockRsvp.mockResolvedValue({}); });

it("saves an RSVP and cancellation through the real card and reports changes", async () => {
  const onChange = jest.fn();
  const screen = await render(<VenueEventCard event={event} onPress={jest.fn()} onRsvpChange={onChange} />);
  await fireEvent.press(screen.getByLabelText("RSVP Going"));
  expect(mockRsvp).toHaveBeenLastCalledWith({ uid: "test-guest" }, 17, "going");
  expect(onChange).toHaveBeenLastCalledWith(17, "going");
  await fireEvent.press(screen.getByLabelText("Cancel RSVP"));
  expect(mockRsvp).toHaveBeenLastCalledWith({ uid: "test-guest" }, 17, "not_going");
});

it("never writes RSVPs from an illustrative sample, even with an authenticated session", async () => {
  const screen = await render(<VenueEventCard event={event} onPress={jest.fn()} readOnly />);
  await fireEvent.press(screen.getByLabelText("RSVP Going"));
  expect(mockRsvp).not.toHaveBeenCalled();
});

it("shows an explicit error when the server rejects the RSVP", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockRsvp.mockRejectedValueOnce(new Error("network failed"));
  const screen = await render(<VenueEventCard event={event} onPress={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText("RSVP Going"));
  expect(alert).toHaveBeenCalledWith("Couldn't update RSVP", "Please try again in a moment.");
  expect(screen.getByLabelText("RSVP Going")).toBeTruthy();
  alert.mockRestore();
});
