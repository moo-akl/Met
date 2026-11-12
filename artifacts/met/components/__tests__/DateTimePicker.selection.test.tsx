import React from "react";
import { Platform, Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

const mockCreateCommunityEvent = jest.fn();
const mockUpdateCommunityEvent = jest.fn();
const mockCreateVenueEvent = jest.fn();
const mockUpdateVenueEvent = jest.fn();
const mockGetVenueEvents = jest.fn();
const mockRouterPush = jest.fn();
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
    profile: { placeId: "venue-place" },
    isLoading: false,
    error: null,
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
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useQueryClient: () => mockQueryClient,
}));
jest.mock("@workspace/api-client-react", () => ({
  getGetEventDetailsQueryKey: (...args: unknown[]) => ["event-details", ...args],
  getGetEventsFeedQueryKey: () => ["events-feed"],
  getSearchEventLocationsQueryOptions: () => ({ queryKey: ["event-locations"] }),
  useCreateCommunityEvent: () => ({ mutate: mockCreateCommunityEvent, isPending: false }),
  useCreateCommunityEventInviteLink: () => ({ mutateAsync: jest.fn() }),
  useUpdateCommunityEvent: () => ({ mutate: mockUpdateCommunityEvent, isPending: false }),
  useGetMyVerifiedExplorer: () => ({ data: { isVerifiedExplorer: false }, isLoading: false }),
  useCreateVenueOwnerEventInviteLink: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useGetVenueOwnerMeGuests: () => ({ data: { guests: [] }, isLoading: false }),
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
jest.mock("expo-image-picker", () => ({ MediaTypeOptions: { Images: "Images" } }));
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("@/lib/api/client", () => ({
  api: {
    uploadVenueEventImage: jest.fn(),
    createVenueEvent: (...args: unknown[]) => mockCreateVenueEvent(...args),
    updateVenueEvent: (...args: unknown[]) => mockUpdateVenueEvent(...args),
    getVenueEvents: (...args: unknown[]) => mockGetVenueEvents(...args),
  },
  ApiError: class ApiError extends Error {},
}));

import { DateTimePicker } from "@/components/DateTimePicker";
import CommunityEventForm from "@/components/CommunityEventForm";
import NewVenueEventScreen from "@/app/venue-owner/events/new";
import EditVenueEventScreen from "@/app/venue-owner/events/[id]";
import VenueOwnerEventsScreen from "@/app/venue-owner/events";

function findByTestId(root: renderer.ReactTestRenderer, testID: string) {
  return root.root.find((node) => node.props.testID === testID);
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
  mockCreateVenueEvent.mockResolvedValue({ event: { id: 48 } });
  mockUpdateVenueEvent.mockResolvedValue({});
  mockGetVenueEvents.mockResolvedValue({ events: [] });
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
    expect(root.root.findByType(DateTimePicker).props.timePickerPresentation).toBe("sheet");
    expect(root.root.findByType(DateTimePicker).props.valueColor).toBe("#111");
    expect(root.root.findByType(DateTimePicker).props.chevronColor).toBe("#666");
    const textLabels = root.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .filter((child): child is string => typeof child === "string");
    expect(textLabels).toContain("tabs.events.createHangout");
    expect(textLabels).toContain("tabs.events.addHangoutPhoto");
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
    expect(root.root.findAll((node) => node.props.accessibilityRole === "radio")).toHaveLength(0);
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
  });

  it("saves the selected start and end values when creating a venue event", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<NewVenueEventScreen />);
    });

    const titleInput = root.root.find((node) => node.props.placeholder === "Friday Night Quiz");
    await act(async () => {
      titleInput.props.onChangeText("Quiz night");
    });

    const expectedStart = await selectDateTime(root, 0, 2, 20, 10);
    const expectedEnd = await selectDateTime(root, 1, 1, 23, 25);
    expectDateTimeDisplayed(root, expectedStart);
    expectDateTimeDisplayed(root, expectedEnd);

    await act(async () => {
      const submit = root.root.findAll(
        (node) => typeof node.props.onPress === "function" && node.props.disabled !== undefined,
      ).at(-1)!;
      await submit.props.onPress();
    });

    expect(mockCreateVenueEvent).toHaveBeenCalledWith(
      { uid: "event-owner" },
      expect.objectContaining({
        title: "Quiz night",
        startsAt: expectedStart.toISOString(),
        endsAt: expectedEnd.toISOString(),
      }),
    );
  });

  it("saves the selected start and end values when editing a venue event", async () => {
    mockLocalSearchParams = {
      id: "73",
      title: "Existing event",
      startsAt: new Date(2031, 6, 10, 18, 0, 0, 0).toISOString(),
      endsAt: new Date(2031, 6, 10, 21, 0, 0, 0).toISOString(),
      isPublished: "true",
      visibility: "public",
    };
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<EditVenueEventScreen />);
    });

    const expectedStart = await selectDateTime(root, 0, 2, 19, 40);
    const expectedEnd = await selectDateTime(root, 1, 3, 22, 55);
    expectDateTimeDisplayed(root, expectedStart);
    expectDateTimeDisplayed(root, expectedEnd);

    await act(async () => {
      const submit = root.root.findAll(
        (node) => typeof node.props.onPress === "function" && node.props.disabled !== undefined,
      ).at(-1)!;
      await submit.props.onPress();
    });

    expect(mockUpdateVenueEvent).toHaveBeenCalledWith(
      { uid: "event-owner" },
      73,
      expect.objectContaining({
        startsAt: expectedStart.toISOString(),
        endsAt: expectedEnd.toISOString(),
      }),
    );
  });

  it("returns to the same start and end times after reopening an event", async () => {
    mockLocalSearchParams = {
      id: "84",
      title: "Round-trip event",
      startsAt: new Date(2032, 2, 10, 18, 0, 0, 0).toISOString(),
      endsAt: new Date(2032, 2, 10, 21, 0, 0, 0).toISOString(),
      isPublished: "true",
      visibility: "public",
    };
    let editRoot!: renderer.ReactTestRenderer;
    act(() => {
      editRoot = renderer.create(<EditVenueEventScreen />);
    });

    const expectedStart = await selectDateTime(editRoot, 0, 2, 19, 35);
    const expectedEnd = await selectDateTime(editRoot, 1, 3, 22, 50);
    await act(async () => {
      const save = editRoot.root.findAll(
        (node) => typeof node.props.onPress === "function" && node.props.disabled !== undefined,
      ).at(-1)!;
      await save.props.onPress();
    });
    expect(mockUpdateVenueEvent).toHaveBeenCalledWith(
      { uid: "event-owner" },
      84,
      expect.objectContaining({
        startsAt: expectedStart.toISOString(),
        endsAt: expectedEnd.toISOString(),
      }),
    );

    mockGetVenueEvents.mockResolvedValue({
      events: [{
        id: 84,
        title: "Round-trip event",
        startsAt: expectedStart.toISOString(),
        endsAt: expectedEnd.toISOString(),
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
        rsvpCount: 0,
      }],
    });
    let listRoot!: renderer.ReactTestRenderer;
    await act(async () => {
      listRoot = renderer.create(<VenueOwnerEventsScreen />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockGetVenueEvents).toHaveBeenCalledWith(
      { uid: "event-owner" },
      "venue-place",
    );

    const editButton = findByTestId(listRoot, "venue-owner-event-edit-84");
    await act(async () => {
      editButton.props.onPress();
    });
    const route = mockRouterPush.mock.calls[0]![0] as {
      params: Record<string, string>;
    };
    expect(route.params).toMatchObject({
      startsAt: expectedStart.toISOString(),
      endsAt: expectedEnd.toISOString(),
    });

    mockLocalSearchParams = route.params;
    let reopenedEditRoot!: renderer.ReactTestRenderer;
    act(() => {
      reopenedEditRoot = renderer.create(<EditVenueEventScreen />);
    });
    expectDateTimeDisplayed(reopenedEditRoot, expectedStart);
    expectDateTimeDisplayed(reopenedEditRoot, expectedEnd);
  });

  it("shows an error and blocks creating an event whose end precedes its start", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<NewVenueEventScreen />);
    });
    const titleInput = root.root.find((node) => node.props.placeholder === "Friday Night Quiz");
    await act(async () => {
      titleInput.props.onChangeText("Quiz night");
    });

    const start = await selectDateTime(root, 0, 2, 20, 10);
    const end = await selectDateTime(root, 1, 0, 20, 9);
    expect(end.getTime()).toBeLessThan(start.getTime());
    expect(findByTestId(root, "venue-event-schedule-error").props.children)
      .toBe("End date and time must be after the start date and time.");
    const submit = root.root.findAll(
      (node) => typeof node.props.onPress === "function" && node.props.disabled !== undefined,
    ).at(-1)!;
    expect(submit.props.disabled).toBe(true);
    await act(async () => {
      await submit.props.onPress();
    });
    expect(mockCreateVenueEvent).not.toHaveBeenCalled();
  });

  it("shows an error and blocks saving an event whose end precedes its start", async () => {
    mockLocalSearchParams = {
      id: "85",
      title: "Existing event",
      startsAt: new Date(2032, 2, 10, 18, 0, 0, 0).toISOString(),
      endsAt: new Date(2032, 2, 10, 21, 0, 0, 0).toISOString(),
      isPublished: "true",
      visibility: "public",
    };
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<EditVenueEventScreen />);
    });

    const start = await selectDateTime(root, 0, 2, 20, 10);
    const end = await selectDateTime(root, 1, 0, 20, 9);
    expect(end.getTime()).toBeLessThan(start.getTime());
    expect(findByTestId(root, "venue-event-schedule-error").props.children)
      .toBe("End date and time must be after the start date and time.");
    const submit = root.root.findAll(
      (node) => typeof node.props.onPress === "function" && node.props.disabled !== undefined,
    ).at(-1)!;
    expect(submit.props.disabled).toBe(true);
    await act(async () => {
      await submit.props.onPress();
    });
    expect(mockUpdateVenueEvent).not.toHaveBeenCalled();
  });
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
