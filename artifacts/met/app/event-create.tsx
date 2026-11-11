import React from "react";
import { useLocalSearchParams } from "expo-router";

import CommunityEventForm from "@/components/CommunityEventForm";

export default function CreateEventScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const planKind = mode === "hangout" || mode === "plan" ? "hangout" : "friends";
  return <CommunityEventForm mode="create" planKind={planKind} />;
}
