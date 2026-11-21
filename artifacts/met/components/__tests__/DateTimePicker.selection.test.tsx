import React from "react";
import { Platform, Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

const mockCreateCommunityEvent = jest.fn();
const mockUpdateCommunityEvent = jest.fn();
const mockGetVenueEvents = jest.fn();
const mockRouterPush = jest.fn();
const mockOpenVenueManager = jest.fn();
const mockGetLocationPermission = jest.fn();
const mockRequestLocationPermission = jest.fn();
const mockGetCurrentPosition = jest.fn();
let mockOwnerEvents: unknown[] = [];
const mockEventLocationResults = [
  { placeId: "far", label: "Far place", name: "Far place", latitude: 14.75, longitude: 100.5 },
  { placeId: "near", label: "Near place", name: "Near place", latitude: 13.751, longitude: 100.5 },
  { placeId: "middle", label: "Middle place", name: "Middle place", latitude: 13.76, longitude: 100.5 },
];
const mockQueryClient = {
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn().mockResolvedValue(undefined),
};
let mockLocalSearchParams: Record<string, string> = {};

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement(View, props),
    DateTimePickerAndroid: { open: jest.fn() },
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Feather: (props: Record<string, unknown>) => React.createElement(View, props) };
});

jest.mock("@/lib/i18n", () => ({
  useT: () => ({ lang: "en-GB", t: (key: string) => key }),
}));
jest.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "event-owner", encounters: [] }),
}));
jest.mock("@/hooks/useVenueOwner", () => ({
  useVenueOwner: () => ({
    profile: { placeId: "venue-place", isApproved: true },
    isLoading: false,
    error: null,
    branchError: null,
    activeBusinessId: null,
  }),
}));
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fff",
    border: "#ddd",
    card: "#fafafa",
    destructive: "#c00",
    foreground: "#111",
    muted: "#eee",
    mutedForeground: "#666",
    primary: "#30a83c",
    primaryForeground: "#fff",
    primarySoft: "#e5f4e5",
    text: "#111",
  }),
}));
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    const React = require("react");
    React.useEffect(effect, []);
  },
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: mockRouterPush }),
  useLocalSearchParams: () => mockLocalSearchParams,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { locations: mockEventLocationResults },
    isLoading: false,
    isError: false,
    isFetching: false,
  }),
  useQueryClient: () => mockQueryClient,
}));
jest.mock("@workspace/api-client-react", () => ({
  getGetEventDetailsQueryKey: (...args: unknown[]) => ["event-details", ...args],
  getGetEventsFeedQueryKey: () => ["events-feed"],
  getGetCommunityEventCreationUsageQueryKey: () => ["community-event-creation-usage"],
  getGetVenueOwnerMeEventQueryKey: (...args: unknown[]) => ["venue-owner-event", ...args],
  getGetVenueOwnerMeEventsQueryKey: () => ["venue-owner-events"],
  getSearchEventLocationsQueryOptions: () => ({ queryKey: ["event-locations"] }),
  useCreateCommunityEvent: () => ({ mutate: mockCreateCommunityEvent, isPending: false }),
  useCreateCommunityEventInviteLink: () => ({ mutateAsync: jest.fn() }),
  useUpdateCommunityEvent: () => ({ mutate: mockUpdateCommunityEvent, isPending: false }),
  useGetCommunityEventCreationUsage: () => ({ data: { remaining: 5 } }),
  useGetMyVerifiedExplorer: () => ({ data: { isVerifiedExplorer: false }, isLoading: false }),
  useCreateVenueOwnerEventInviteLink: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useGetVenueOwnerMeGuests: () => ({ data: { guests: [] }, isLoading: false }),
  useGetVenueOwnerMeEvent: () => ({ data: null, isLoading: false, isError: false }),
  useGetVenueOwnerMeEvents: () => ({
    data: { events: mockOwnerEvents },
    isLoading: false,
    isError: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  }),
  useCreateVenueOwnerMeEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateVenueOwnerMeEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRevokeVenueOwnerEventInviteLink: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRotateVenueOwnerEventInviteLink: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock("@/components/KeyboardAwareScrollViewCompat", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { KeyboardAwareScrollViewCompat: (props: Record<string, unknown>) => React.createElement(View, props) };
});
jest.mock("@/lib/venueEventImage", () => ({ prepareVenueEventImage: jest.fn() }));
jest.mock("@/lib/eventReminders", () => ({ cancelEventReminder: jest.fn() }));
jest.mock("@/lib/venueManagerLink", () => ({
  openVenueManager: (...args: unknown[]) => mockOpenVenueManager(...args),
}));
jest.mock("expo-image-picker", () => ({ MediaTypeOptions: { Images: "Images" } }));
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetLocationPermission(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestLocationPermission(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPosition(...args),
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("@/lib/api/client", () => ({
  api: {
    uploadVenueEventImage: jest.fn(),
    getVenueEvents: (...args: unknown[]) => mockGetVenueEvents(...args),
  },
  getActiveVenueBusinessHeaders: () => ({}),
  getActiveVenueBusinessId: () => null,
  ApiError: class ApiError extends Error {},
}));

import { DateTimePicker } from "@/components/DateTimePicker";
import CommunityEventForm from "@/components/CommunityEventForm";
import {
  getInitialCommunityEventWebsiteUrl,
  normalizeCommunityEventWebsiteUrl,
} from "@/lib/communityEventWebsite";
import NewVenueEventScreen from "@/app/venue-owner/events/new";
import EditVenueEventScreen from "@/app/venue-owner/events/[id]";
import VenueOwnerEventsScreen from "@/app/venue-owner/events";

function findByTestId(root: renderer.ReactTestRenderer, testID: string) {
  return root.root.find((node) => node.props.testID === testID);
}

function locationResultTestIds(root: renderer.ReactTestRenderer) {
  return root.root
    .findAll((node) =>
      node.props.accessibilityRole === "button" &&
      typeof node.props.testID === "string" &&
      node.props.testID.startsWith("event-location-result-") &&
      typeof node.props.onPress === "function",
    )
    .map((node) => node.props.testID as string);
}

function setPlatformOS(os: "ios" | "android") {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    writable: true,
    value: os,
  });
}

beforeEach(() => {
  setPlatformOS("ios");
  jest.clearAllMocks();
  mockQueryClient.invalidateQueries.mockResolvedValue(undefined);
  mockLocalSearchParams = {};
  mockOwnerEvents = [];
  mockOpenVenueManager.mockResolvedValue(undefined);
  mockGetVenueEvents.mockResolvedValue({ events: [] });
  mockGetLocationPermission.mockResolvedValue({ granted: false });
  mockRequestLocationPermission.mockResolvedValue({ granted: false });
  mockGetCurrentPosition.mockReset();
});

describe("CommunityEventForm location suggestions", () => {
  it("waits for available device coordinates, ranks nearby places, and saves the selected place", async () => {
    setPlatformOS("ios");
    mockGetLocationPermission.mockResolvedValue({ granted: true });
    let resolveCurrentPosition!: (position: {
      coords: { latitude: number; longitude: number };
    }) => void;
    mockGetCurrentPosition.mockImplementation(() => new Promise((resolve) => {
      resolveCurrentPosition = resolve;
    }));

    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<CommunityEventForm mode="create" />);
    });
    const titleInput = root.root.find(
      (node) => node.props.placeholder === "tabs.events.eventName",
    );
    const locationInput = root.root.find(
      (node) => node.props.accessibilityLabel === "tabs.events.location",
    );
    await act(async () => {
      titleInput.props.onChangeText("A nearby gathering");
      locationInput.props.onFocus();
      locationInput.props.onChangeText("City park");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(mockGetLocationPermission).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(locationResultTestIds(root)).toHaveLength(0);
    expect(
      root.root.findAllByType(Text).some(
        (node) => node.props.children === "tabs.events.findingLocation",
      ),
    ).toBe(true);

    await act(async () => {
      resolveCurrentPosition({ coords: { latitude: 13.75, longitude: 100.5 } });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(locationResultTestIds(root)).toEqual([
      "event-location-result-near",
      "event-location-result-middle",
      "event-location-result-far",
    ]);

    await act(async () => {
      root.root.findByProps({ testID: "event-location-result-near" }).props.onPress();
    });
    const shareInviteLinkToggle = root.root.find(
      (node) =>
        node.props.accessibilityRole === "checkbox" &&
        typeof node.props.onPress === "function",
    );
    await act(async () => {
      shareInviteLinkToggle.props.onPress();
    });
    await act(async () => {
      const submit = root.root.findAll(
        (node) =>
          typeof node.props.onPress === "function" &&
          node.props.disabled !== undefined,
      ).at(-1)!;
      submit.props.onPress();
    });
    expect(mockCreateCommunityEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        location: "Near place",
        locationPlaceId: "near",
        latitude: 13.751,
        longitude: 100.5,
      }),
    });
    act(() => root.unmount());
  }, 15000);

  it("shows provider-ordered suggestions when location permission is unavailable", async () => {
    setPlatformOS("ios");
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<CommunityEventForm mode="create" />);
    });
    const locationInput = root.root.find(
      (node) => node.props.accessibilityLabel === "tabs.events.location",
    );
    await act(async () => {
      locationInput.props.onFocus();
      locationInput.props.onChangeText("City park");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(locationResultTestIds(root)).toEqual([
      "event-location-result-far",
      "event-location-result-near",
      "event-location-result-middle",
    ]);
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    act(() => root.unmount());
  }, 15000);
});

describe("CommunityEventForm website visibility", () => {
  it("does not ask for a website when creating a Plan or Hangout", () => {
    let planRoot!: renderer.ReactTestRenderer;
    act(() => {
      planRoot = renderer.create(<CommunityEventForm mode="create" />);
    });
    expect(planRoot.root.findAllByProps({ testID: "community-event-website" })).toHaveLength(0);
    act(() => planRoot.unmount());

    let hangoutRoot!: renderer.ReactTestRenderer;
    act(() => {
      hangoutRoot = renderer.create(
        <CommunityEventForm mode="create" planKind="hangout" />,
      );
    });
    expect(hangoutRoot.root.findAllByProps({ testID: "community-event-website" })).toHaveLength(0);
    act(() => hangoutRoot.unmount());
  });

  it("keeps a legacy Plan website hidden and unchanged while editing", async () => {
    const websiteUrl = "https://events.example.com/summer?source=invite";
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <CommunityEventForm
          mode="edit"
          initial={{
            id: 42,
            title: "Existing event",
            description: null,
            imageUrl: null,
            galleryPhotos: [],
            repeatFrequency: null,
            recurrenceTimeZone: "UTC",
            recurrenceEndDate: null,
            contactPhone: null,
            websiteUrl,
            publicEmail: null,
            startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            endsAt: null,
            location: null,
            locationPlaceId: null,
            latitude: null,
            longitude: null,
            visibility: "invite_only",
            joinApprovalRequired: false,
            verifiedExplorersOnly: false,
            inviteeUids: [],
            inviteLinkEnabled: true,
            invitePasscodeRequired: false,
          }}
        />,
      );
    });

    expect(root.root.findAllByProps({ testID: "community-event-website" })).toHaveLength(0);
    await act(async () => {
      root.root.findAll(
        (node) => typeof node.props.onPress === "function" && node.props.disabled !== undefined,
      ).at(-1)!.props.onPress();
    });

    expect(mockUpdateCommunityEvent).toHaveBeenCalledWith({
      eventId: 42,
      data: expect.objectContaining({ websiteUrl }),
    });
    act(() => root.unmount());
  });

  it("normalizes bare domains, preserves complete URLs, and omits an untouched prefix", () => {
    expect(getInitialCommunityEventWebsiteUrl()).toBe("https://");
    expect(getInitialCommunityEventWebsiteUrl(null)).toBe("https://");
    expect(getInitialCommunityEventWebsiteUrl("https://example.com")).toBe(
      "https://example.com",
    );
    expect(normalizeCommunityEventWebsiteUrl("example.com/path")).toBe(
      "https://example.com/path",
    );
    expect(normalizeCommunityEventWebsiteUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
    expect(normalizeCommunityEventWebsiteUrl("https://")).toBeNull();
  });
});

describe("DateTimePicker platform behavior", () => {
  it("requires a selected place before creating a public hangout", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <CommunityEventForm mode="create" planKind="hangout" />,
      );
    });

    expect(findByTestId(root, "date-time-picker-datetime")).toBeTruthy();
    expect(root.root.findByType(DateTimePicker).props.timePickerPresentation).toBe("inline");
    expect(root.root.findByType(DateTimePicker).props.valueColor).toBe("#111");
    expect(root.root.findByType(DateTimePicker).props.chevronColor).toBe("#666");
    const textLabels = root.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .filter((child): child is string => typeof child === "string");
    expect(textLabels).toContain("tabs.events.createHangout");
    expect(
      root.root.findByProps({ accessibilityLabel: "tabs.events.addHangoutPhoto" }),
    ).toBeTruthy();
    expect(textLabels).toContain("tabs.events.addPhotos");
    expect(root.root.findByProps({ testID: "button-add-hangout-cover" })).toBeTruthy();
    expect(textLabels).not.toContain("tabs.events.editEvent");
    expect(textLabels).not.toContain("tabs.events.eventName");
    expect(textLabels).not.toContain("tabs.events.addEventPhoto");
    const titleInput = root.root.find(
      (node) => node.props.placeholder === "tabs.events.hangoutName",
    );
    expect(
      root.root.find((node) => node.props.placeholder === "tabs.events.hangoutDescription"),
    ).toBeTruthy();
    expect(
      root.root.findAllByType(Text).filter((node) =>
        node.props.children === "tabs.events.hangoutName" ||
        node.props.children === "tabs.events.hangoutDescription",
      ),
    ).toHaveLength(2);
    const locationInput = root.root.find(
      (node) => node.props.accessibilityLabel === "tabs.events.location",
    );
    await act(async () => {
      titleInput.props.onChangeText("Coffee after work");
      locationInput.props.onChangeText("Lumphini Park");
    });

    await act(async () => {
      const submit = root.root.findAll(
        (node) => typeof node.props.onPress === "function" && node.props.disabled !== undefined,
      ).at(-1)!;
      submit.props.onPress();
    });

    expect(
      root.root.find((node) =>
        node.props.accessibilityRole === "alert" &&
        node.props.children === "tabs.events.planPlaceSelectionRequired",
      ),
    ).toBeTruthy();
    expect(mockCreateCommunityEvent).not.toHaveBeenCalled();
    act(() => root.unmount());
  }, 15000);

  it("preserves the chosen time when the iOS calendar date changes and saves that exact value", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<CommunityEventForm mode="create" />);
    });

    const titleInput = root.root.find(
      (node) => node.props.placeholder === "tabs.events.eventName",
    );
    await act(async () => {
      titleInput.props.onChangeText("A day out");
    });

    await act(async () => {
      findByTestId(root, "date-time-picker-datetime").props.onPress();
    });

    const initial = findByTestId(root, "date-time-picker-datetime-calendar").props.value as Date;
    const pickedDay = new Date(initial);
    pickedDay.setDate(pickedDay.getDate() + 2);
    await act(async () => {
      findByTestId(root, "date-time-picker-datetime-calendar")
        .props.onChange({ type: "set" }, pickedDay);
    });

    const dateAfterSelection = findByTestId(root, "date-time-picker-datetime-calendar").props.value as Date;
    expect(dateAfterSelection.getFullYear()).toBe(pickedDay.getFullYear());
    expect(dateAfterSelection.getMonth()).toBe(pickedDay.getMonth());
    expect(dateAfterSelection.getDate()).toBe(pickedDay.getDate());
    expect(dateAfterSelection.getHours()).toBe(initial.getHours());
    expect(dateAfterSelection.getMinutes()).toBe(initial.getMinutes());

    const pickedTime = new Date(2000, 0, 1, 21, 37, 0, 0);
    await act(async () => {
      findByTestId(root, "date-time-picker-edit-time").props.onPress();
    });
    await act(async () => {
      findByTestId(root, "date-time-picker-time")
        .props.onChange({ type: "set" }, pickedTime);
    });
    const textBeforeSave = findByTestId(root, "date-time-picker-edit-time")
      .findAll((node) => typeof node.props.children === "string")
      .map((node) => node.props.children)
      .join(" ");
    expect(textBeforeSave).toContain(initial.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }));
    await act(async () => {
      findByTestId(root, "date-time-picker-time-save").props.onPress();
    });

    const expected = new Date(dateAfterSelection);
    expected.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
    const displayedText = findByTestId(root, "date-time-picker-datetime")
      .findAll((node) => typeof node.props.children === "string")
      .map((node) => node.props.children)
      .join(" ");
    expect(displayedText).toContain(expected.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }));
    expect(displayedText).toContain(expected.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }));

    const shareInviteLinkToggle = root.root.find(
      (node) =>
        node.props.accessibilityRole === "checkbox" &&
        typeof node.props.onPress === "function",
    );
    await act(async () => {
      shareInviteLinkToggle.props.onPress();
    });

    await act(async () => {
      const submit = root.root.findAll(
        (node) => typeof node.props.onPress === "function" && node.props.disabled !== undefined,
      ).at(-1)!;
      submit.props.onPress();
    });
    expect(mockCreateCommunityEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({ startsAt: expected.toISOString() }),
    });
  });

  it("commits the selected date and time only after saving the wheel picker", async () => {
    const onChange = jest.fn();
    const initial = new Date(2031, 5, 10, 18, 42, 0, 0);
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <DateTimePicker
          label="Starts"
          mode="datetime"
          onChange={onChange}
          primaryColor="#30a83c"
          timePickerPresentation="wheels"
          value={initial}
        />,
      );
    });

    await act(async () => {
      findByTestId(root, "date-time-picker-datetime").props.onPress();
    });
    const pickedDay = new Date(2031, 5, 14, 0, 0, 0, 0);
    await act(async () => {
      findByTestId(root, "date-time-picker-date-wheel")
        .props.onChange({ type: "set" }, pickedDay);
    });
    const pickedTime = new Date(2031, 0, 1, 9, 25, 0, 0);
    await act(async () => {
      findByTestId(root, "date-time-picker-time-wheel")
        .props.onChange({ type: "set" }, pickedTime);
    });
    expect(onChange).not.toHaveBeenCalled();

    const expected = new Date(2031, 5, 14, 9, 25, 0, 0);
    await act(async () => {
      findByTestId(root, "date-time-picker-wheels-save").props.onPress();
    });
    expect(onChange).toHaveBeenLastCalledWith(expected);
    act(() => root.unmount());
  });

  it("keeps the selected date and dismisses the iOS calendar when tapped outside", async () => {
    const onChange = jest.fn();
    const initial = new Date(2031, 5, 10, 18, 42, 0, 0);
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <DateTimePicker
          label="Starts"
          mode="datetime"
          onChange={onChange}
          primaryColor="#30a83c"
          value={initial}
        />,
      );
    });

    await act(async () => {
      findByTestId(root, "date-time-picker-datetime").props.onPress();
    });
    const pickedDay = new Date(initial);
    pickedDay.setDate(pickedDay.getDate() + 1);
    await act(async () => {
      findByTestId(root, "date-time-picker-datetime-calendar")
        .props.onChange({ type: "set" }, pickedDay);
    });
    const expected = new Date(initial);
    expected.setDate(expected.getDate() + 1);
    expect(onChange).toHaveBeenLastCalledWith(expected);

    await act(async () => {
      findByTestId(root, "date-time-picker-calendar-backdrop").props.onPress();
    });
    expect(root.root.findAllByProps({ testID: "date-time-picker-datetime-calendar" })).toHaveLength(0);
    expect(findByTestId(root, "date-time-picker-datetime")).toBeTruthy();
    act(() => root.unmount());
  });

  it("keeps Android on its native date-then-time picker flow", async () => {
    setPlatformOS("android");
    const onChange = jest.fn();
    let root!: renderer.ReactTestRenderer;
    const initial = new Date(2031, 5, 10, 18, 42, 0, 0);
    act(() => {
      root = renderer.create(
        <DateTimePicker
          label="Starts"
          mode="datetime"
          onChange={onChange}
          primaryColor="#30a83c"
          value={initial}
        />,
      );
    });

    await act(async () => {
      findByTestId(root, "date-time-picker-datetime").props.onPress();
    });
    expect(DateTimePickerAndroid.open).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "date", value: initial }),
    );

    const pickedDay = new Date(2031, 5, 14, 0, 0, 0, 0);
    const datePickerOptions = (DateTimePickerAndroid.open as jest.Mock).mock.calls[0]![0] as {
      onChange: (event: unknown, date?: Date) => void;
    };
    await act(async () => {
      datePickerOptions.onChange({ type: "set" }, pickedDay);
    });
    expect(DateTimePickerAndroid.open).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "time",
        value: new Date(2031, 5, 14, 18, 42, 0, 0),
      }),
    );

    const timePickerOptions = (DateTimePickerAndroid.open as jest.Mock).mock.calls[1]![0] as {
      onChange: (event: unknown, date?: Date) => void;
    };
    const pickedTime = new Date(2000, 0, 1, 20, 15, 0, 0);
    await act(async () => {
      timePickerOptions.onChange({ type: "set" }, pickedTime);
    });
    const expected = new Date(2031, 5, 14, 20, 15, 0, 0);
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it("expands the community event time control and saves only when confirmed", async () => {
    const onChange = jest.fn();
    let root!: renderer.ReactTestRenderer;
    const initial = new Date(2031, 5, 10, 18, 42, 0, 0);
    act(() => {
      root = renderer.create(
        <DateTimePicker
          label="Starts"
          mode="datetime"
          onChange={onChange}
          primaryColor="#30a83c"
          timePickerPresentation="dropdown"
          value={initial}
        />,
      );
    });

    const toggle = findByTestId(root, "date-time-picker-time-toggle");
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    await act(async () => {
      toggle.props.onPress();
    });
    expect(findByTestId(root, "date-time-picker-time-dropdown")).toBeTruthy();

    await act(async () => {
      findByTestId(root, "date-time-picker-time").props.onChange(
        { type: "set" },
        new Date(2000, 0, 1, 21, 10, 0, 0),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      findByTestId(root, "date-time-picker-time-save").props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith(
      new Date(2031, 5, 10, 21, 10, 0, 0),
    );
    expect(root.root.findAll((node) =>
      node.props.testID === "date-time-picker-time-dropdown",
    )).toHaveLength(0);
  });

  it("uses the expanded time dropdown with Android's native time picker", async () => {
    setPlatformOS("android");
    const onChange = jest.fn();
    let root!: renderer.ReactTestRenderer;
    const initial = new Date(2031, 5, 10, 18, 42, 0, 0);
    const renderPicker = (value: Date) => (
      <DateTimePicker
        label="Starts"
        mode="datetime"
        onChange={onChange}
        primaryColor="#30a83c"
        timePickerPresentation="dropdown"
        value={value}
      />
    );
    act(() => {
      root = renderer.create(renderPicker(initial));
    });

    await act(async () => {
      findByTestId(root, "date-time-picker-datetime").props.onPress();
    });
    expect(DateTimePickerAndroid.open).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "date", value: initial }),
    );

    const pickedDay = new Date(2031, 5, 14, 0, 0, 0, 0);
    const datePickerOptions = (DateTimePickerAndroid.open as jest.Mock).mock.calls[0]![0] as {
      onChange: (event: unknown, date?: Date) => void;
    };
    await act(async () => {
      datePickerOptions.onChange({ type: "set" }, pickedDay);
    });
    const pickedDayWithCurrentTime = new Date(2031, 5, 14, 18, 42, 0, 0);
    expect(onChange).toHaveBeenCalledWith(pickedDayWithCurrentTime);
    await act(async () => {
      root.update(renderPicker(pickedDayWithCurrentTime));
    });

    await act(async () => {
      findByTestId(root, "date-time-picker-time-toggle").props.onPress();
    });
    await act(async () => {
      findByTestId(root, "date-time-picker-time-open").props.onPress();
    });
    expect(DateTimePickerAndroid.open).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "time",
        value: pickedDayWithCurrentTime,
      }),
    );

    const timePickerOptions = (DateTimePickerAndroid.open as jest.Mock).mock.calls[1]![0] as {
      onChange: (event: unknown, date?: Date) => void;
    };
    await act(async () => {
      timePickerOptions.onChange({ type: "set" }, new Date(2000, 0, 1, 20, 15, 0, 0));
    });
    expect(onChange).toHaveBeenLastCalledWith(new Date(2031, 5, 14, 20, 15, 0, 0));
  });

  it("edits Hangout time without stacking an iOS modal", async () => {
    const onChange = jest.fn();
    let root!: renderer.ReactTestRenderer;
    const initial = new Date(2031, 5, 10, 18, 42, 0, 0);
    act(() => {
      root = renderer.create(
        <DateTimePicker
          label="Starts"
          mode="datetime"
          onChange={onChange}
          primaryColor="#30a83c"
          timePickerPresentation="inline"
          value={initial}
        />,
      );
    });
    await act(async () => {
      findByTestId(root, "date-time-picker-datetime").props.onPress();
    });
    await act(async () => {
      findByTestId(root, "date-time-picker-edit-time").props.onPress();
    });
    expect(findByTestId(root, "date-time-picker-time-editor")).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "date-time-picker-time-modal" })).toHaveLength(0);
    await act(async () => {
      findByTestId(root, "date-time-picker-time").props.onChange(
        { type: "set" },
        new Date(2000, 0, 1, 21, 10, 0, 0),
      );
    });
    await act(async () => {
      findByTestId(root, "date-time-picker-time-save").props.onPress();
    });
    const expected = new Date(initial);
    expected.setHours(21, 10, 0, 0);
    expect(onChange).toHaveBeenLastCalledWith(expected);
    act(() => root.unmount());
  });

  it("discards an unconfirmed iOS time and closes the time sheet on cancel", async () => {
    const onChange = jest.fn();
    let root!: renderer.ReactTestRenderer;
    const initial = new Date(2031, 5, 10, 18, 42, 0, 0);
    act(() => {
      root = renderer.create(
        <DateTimePicker
          label="Starts"
          mode="datetime"
          onChange={onChange}
          primaryColor="#30a83c"
          value={initial}
        />,
      );
    });
    await act(async () => {
      findByTestId(root, "date-time-picker-datetime").props.onPress();
    });
    await act(async () => {
      findByTestId(root, "date-time-picker-edit-time").props.onPress();
    });
    expect(root.root.findByProps({ testID: "date-time-picker-time-modal" }).props.visible).toBe(true);
    expect(root.root.findAllByProps({ testID: "date-time-picker-time-editor" })).toHaveLength(0);
    await act(async () => {
      findByTestId(root, "date-time-picker-time").props.onChange(
        { type: "set" },
        new Date(2000, 0, 1, 21, 10, 0, 0),
      );
    });
    await act(async () => {
      findByTestId(root, "date-time-picker-time-cancel").props.onPress();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(findByTestId(root, "date-time-picker-edit-time")).toBeTruthy();
    expect(root.root.findAll((node) => node.props.testID === "date-time-picker-time").length).toBe(0);
    act(() => root.unmount());
  });

  it("opens Venue Manager from the retired mobile create and edit routes", async () => {
    for (const Screen of [NewVenueEventScreen, EditVenueEventScreen]) {
      let root!: renderer.ReactTestRenderer;
      act(() => {
        root = renderer.create(<Screen />);
      });
      await act(async () => {
        findByTestId(root, "open-venue-manager").props.onPress();
      });
      expect(mockOpenVenueManager).toHaveBeenCalled();
      act(() => root.unmount());
    }
    expect(mockOpenVenueManager).toHaveBeenCalledTimes(2);
  });

  it("keeps RSVP access and ignores old edit links in the mobile event list", async () => {
    mockLocalSearchParams = { editEventId: "84" };
    mockOwnerEvents = [{
        id: 84,
        ownerUid: "event-owner",
        title: "Owner event",
        startsAt: "2032-03-10T18:00:00.000Z",
        endsAt: null,
        description: null,
        imageUrl: null,
        contactPhone: null,
        websiteUrl: null,
        publicEmail: null,
        capacityLimit: null,
        isPublished: true,
        visibility: "public",
        inviteLinkEnabled: false,
        invitePasscodeRequired: false,
        rsvpCount: 3,
      }];

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<VenueOwnerEventsScreen />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(findByTestId(root, "venue-owner-event-rsvps-84")).toBeTruthy();
    expect(root.root.findAllByProps({ testID: "venue-owner-event-edit-84" })).toHaveLength(0);
    expect(root.root.findAllByProps({ testID: "venue-owner-event-delete-84" })).toHaveLength(0);

    await act(async () => {
      findByTestId(root, "venue-owner-event-rsvps-84").props.onPress();
    });
    expect(mockRouterPush).toHaveBeenCalledWith(expect.objectContaining({
      pathname: "/event-attendees/[eventType]/[id]",
      params: expect.objectContaining({ eventType: "venue", id: "84" }),
    }));
    act(() => root.unmount());
  }, 20_000);
});

async function selectDateTime(
  root: renderer.ReactTestRenderer,
  index: number,
  dayOffset: number,
  hours: number,
  minutes: number,
): Promise<Date> {
  const row = root.root.findAll((node) =>
    node.props.testID === "date-time-picker-datetime" &&
    typeof node.props.onPress === "function",
  )[index]!;
  await act(async () => {
    row.props.onPress();
  });
  const calendar = root.root.findAll((node) =>
    node.props.testID === "date-time-picker-datetime-calendar" &&
    typeof node.props.onChange === "function",
  )[0]!;
  const start = calendar.props.value as Date;
  const pickedDay = new Date(start);
  pickedDay.setDate(pickedDay.getDate() + dayOffset);
  await act(async () => {
    calendar.props.onChange({ type: "set" }, pickedDay);
  });
  const pickedTime = new Date(2000, 0, 1, hours, minutes, 0, 0);
  await act(async () => {
    findByTestId(root, "date-time-picker-edit-time").props.onPress();
  });
  const timePicker = root.root.findAll((node) =>
    node.props.testID === "date-time-picker-time" &&
    typeof node.props.onChange === "function",
  )[0]!;
  await act(async () => {
    timePicker.props.onChange({ type: "set" }, pickedTime);
  });
  await act(async () => {
    findByTestId(root, "date-time-picker-time-save").props.onPress();
  });
  const expected = new Date(pickedDay);
  expected.setHours(hours, minutes, 0, 0);
  return expected;
}

function expectDateTimeDisplayed(root: renderer.ReactTestRenderer, date: Date) {
  const rows = root.root.findAll((node) =>
    node.props.testID === "date-time-picker-datetime" &&
    typeof node.props.onPress === "function",
  );
  const value = rows.map((row) => row.findAll((node) => typeof node.props.children === "string")
    .map((node) => node.props.children).join(" ")).join(" | ");
  expect(value).toContain(date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }));
  expect(value).toContain(date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }));
}
