import React from "react";
import "./_group.css";
import { EventsAndHangouts } from "./EventsAndHangouts";

export function CurrentHangouts() {
  return <EventsAndHangouts initialView="hangouts" />;
}
