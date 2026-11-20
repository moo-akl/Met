import React, { useState } from "react";
import "./_group.css";
import { DateTimePicker } from "./DateTimePicker";
import { useColors, View } from "./rnDom";

export function CurrentEventTime() {
  const colors = useColors();
  const [startsAt, setStartsAt] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(19, 0, 0, 0);
    return date;
  });
  return (
    <View className="met-plans-events" style={{ padding: 20, backgroundColor: colors.background, maxWidth: 460, minHeight: "100vh" }}>
      <DateTimePicker
        label="Starts"
        mode="datetime"
        value={startsAt}
        onChange={setStartsAt}
        primaryColor={colors.primary}
        labelColor={colors.mutedForeground}
        rowBg={colors.card}
        isDark={false}
      />
    </View>
  );
}
