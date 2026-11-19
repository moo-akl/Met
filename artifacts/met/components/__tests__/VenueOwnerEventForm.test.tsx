import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockCreateEvent = jest.fn();
const mockUpdateEvent = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);
let mockRouteParams: { id?: string } = {};
let mockEventResponse: { event?: Record<string, unknown> } = {};

jest.mock("@workspace/api-client-react", () => ({
  getGetVenueOwnerMeEventQueryKey: (id: number) => ["venue-event", id],
  getGetVenueOwnerMeEventsQueryKey: () => ["venue-owner-events"],
  useGetVenueOwnerMeEvent: () => ({
    data: mockEventResponse,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useCreateVenueOwnerMeEvent: () => ({
    mutateAsync: mockCreateEvent,
    isPending: false,
  }),
  useUpdateVenueOwnerMeEvent: () => ({
    mutateAsync: mockUpdateEvent,
    isPending: false,
  }),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "venue-owner-uid" }),
}));

jest.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fbfcf8",
    card: "#ffffff",
    text: "#19351f",
    foreground: "#19351f",
    muted: "#f3f4f6",
    mutedForeground: "#68776c",
    border: "#e2eae0",
    input: "#ffffff",
    primary: "#3dcc44",
    primaryForeground: "#19351f",
    primarySoft: "#e8f5e5",
    destructive: "#ef4444",
  }),
}));

jest.mock("@/hooks/useVenueOwner", () => ({
  useVenueOwner: () => ({
    profile: { isApproved: true, placeId: "place-1" },
    isLoading: false,
    error: null,
    branchError: null,
    activeBusinessId: 1,
  }),
}));

jest.mock("@/lib/api/client", () => ({
  api: { uploadVenueEventImage: jest.fn() },
  getActiveVenueBusinessHeaders: () => ({ "X-Met-Venue-Business-Id": "1" }),
}));

jest.mock("@/lib/venueEventImage", () => ({
  prepareVenueEventImage: jest.fn(),
}));

jest.mock("@/components/VenueOwnerHeader", () => ({
  VenueOwnerHeader: ({ title }: { title: string }) => {
    const { Text } = require("react-native");
    return <Text>{title}</Text>;
  },
}));

jest.mock("@/components/DateTimePicker", () => ({
  DateTimePicker: ({ label }: { label: string }) => {
    const { Text } = require("react-native");
    return <Text>{label}</Text>;
  },
}));

jest.mock("@/components/KeyboardAwareScrollViewCompat", () => ({
  KeyboardAwareScrollViewCompat: ({ children }: { children: React.ReactNode }) => {
    const { ScrollView } = require("react-native");
    return <ScrollView>{children}</ScrollView>;
  },
}));

jest.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "images" },
  launchImageLibraryAsync: jest.fn(),
}));

describe("VenueOwnerEventForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
    mockEventResponse = {};
    mockCreateEvent.mockResolvedValue({ event: { id: 42 } });
    mockUpdateEvent.mockResolvedValue({ event: { id: 42 } });
  });

  it("creates a venue event with its visibility and reminder settings", async () => {
    const screen = await render(<VenueOwnerEventForm mode="create" />);
    expect(screen.getByLabelText("Public event website").props.value).toBe("https://");
    await fireEvent.changeText(
      screen.getByTestId("venue-event-title"),
      "Friday opening",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Public event website"),
      "met-app.org/events",
    );
    await fireEvent.press(screen.getByTestId("venue-event-save"));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Friday opening",
          visibility: "public",
          isPublished: true,
          reminderOffsetsHours: [24, 2],
          websiteUrl: "https://met-app.org/events",
        }),
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/venue-owner/events");
  });

  it("edits an existing venue event in the app", async () => {
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    mockRouteParams = { id: "42" };
    mockEventResponse = {
      event: {
        id: 42,
        title: "Existing event",
        description: null,
        imageUrl: null,
        galleryPhotos: [],
        contactPhone: null,
        websiteUrl: "https://met-app.org/events",
        publicEmail: null,
        startsAt,
        endsAt: null,
        capacityLimit: null,
        reminderOffsetsHours: [24, 2],
        isPublished: false,
        visibility: "public",
      },
    };

    const screen = await render(<VenueOwnerEventForm mode="edit" />);
    expect(screen.getByDisplayValue("Existing event")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("venue-event-save"));

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledWith({
        eventId: 42,
        data: expect.objectContaining({
          title: "Existing event",
          isPublished: false,
          startsAt,
          websiteUrl: "https://met-app.org/events",
        }),
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/venue-owner/events");
  });
});

import VenueOwnerEventForm from "../VenueOwnerEventForm";
