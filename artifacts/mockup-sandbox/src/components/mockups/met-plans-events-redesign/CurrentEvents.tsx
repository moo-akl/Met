import React from "react";
import "./_group.css";
import { EventsAndHangouts } from "./EventsAndHangouts";

export function CurrentEvents() {
  return <EventsAndHangouts initialView="events" />;
}
