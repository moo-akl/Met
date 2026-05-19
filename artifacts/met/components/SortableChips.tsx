import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutRectangle, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

interface SortableChipsProps {
  items: string[];
  onReorder: (newItems: string[]) => void;
  renderChip: (tag: string, isPlaceholder: boolean) => React.ReactNode;
  style?: ViewStyle;
}

interface ChipProps {
  tag: string;
  isPlaceholder: boolean;
  onLayout: (tag: string, layout: LayoutRectangle) => void;
  gesture: ReturnType<typeof Gesture.Simultaneous>;
  renderChip: (tag: string, isPlaceholder: boolean) => React.ReactNode;
}

const CHIP_SPRING = LinearTransition.springify().damping(20).stiffness(220);

function SortableChip({ tag, isPlaceholder, onLayout, gesture, renderChip }: ChipProps) {
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        layout={CHIP_SPRING}
        onLayout={(e) => onLayout(tag, e.nativeEvent.layout)}
      >
        {renderChip(tag, isPlaceholder)}
      </Animated.View>
    </GestureDetector>
  );
}

export function SortableChips({ items, onReorder, renderChip, style }: SortableChipsProps) {
  const [displayItems, setDisplayItems] = useState<string[]>(items);
  const [draggingTag, setDraggingTag] = useState<string | null>(null);

  const displayItemsRef = useRef<string[]>(items);
  const draggingTagRef = useRef<string | null>(null);
  const pendingOrderRef = useRef<string[]>(items);
  const layouts = useRef<Map<string, LayoutRectangle>>(new Map());
  const containerRef = useRef<View>(null);
  const containerPos = useRef({ x: 0, y: 0 });

  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostW = useSharedValue(50);
  const ghostH = useSharedValue(34);
  const ghostVisible = useSharedValue(false);

  useEffect(() => {
    if (!draggingTagRef.current) {
      setDisplayItems(items);
      displayItemsRef.current = items;
      pendingOrderRef.current = items;
    }
  }, [items]);

  const remeasureContainer = useCallback(() => {
    containerRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      containerPos.current = { x: pageX, y: pageY };
    });
  }, []);

  const handleLayout = useCallback((tag: string, layout: LayoutRectangle) => {
    layouts.current.set(tag, layout);
  }, []);

  const findNearestIndex = useCallback((absX: number, absY: number): number => {
    const relX = absX - containerPos.current.x;
    const relY = absY - containerPos.current.y;
    let bestIdx = -1;
    let bestDist = Infinity;
    displayItemsRef.current.forEach((tag, idx) => {
      const l = layouts.current.get(tag);
      if (!l) return;
      const cx = l.x + l.width / 2;
      const cy = l.y + l.height / 2;
      const dist = Math.hypot(relX - cx, relY - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }, []);

  const makeGesture = useCallback(
    (tag: string) => {
      const longPress = Gesture.LongPress()
        .minDuration(300)
        .runOnJS(true)
        .onStart(() => {
          remeasureContainer();
          const layout = layouts.current.get(tag);
          ghostW.value = layout?.width ?? 70;
          ghostH.value = layout?.height ?? 34;
          draggingTagRef.current = tag;
          pendingOrderRef.current = [...displayItemsRef.current];
          setDraggingTag(tag);
        });

      const pan = Gesture.Pan()
        .activateAfterLongPress(300)
        .runOnJS(true)
        .onUpdate((e) => {
          if (!draggingTagRef.current) return;
          const w = ghostW.value;
          const h = ghostH.value;
          ghostX.value = e.absoluteX - containerPos.current.x - w / 2;
          ghostY.value = e.absoluteY - containerPos.current.y - h / 2;
          ghostVisible.value = true;

          const nearestIdx = findNearestIndex(e.absoluteX, e.absoluteY);
          const activeTag = draggingTagRef.current;
          const order = pendingOrderRef.current;
          const currentIdx = order.indexOf(activeTag);
          if (nearestIdx >= 0 && nearestIdx !== currentIdx) {
            const newOrder = [...order];
            newOrder.splice(currentIdx, 1);
            newOrder.splice(nearestIdx, 0, activeTag);
            pendingOrderRef.current = newOrder;
            displayItemsRef.current = newOrder;
            setDisplayItems([...newOrder]);
          }
        })
        .onEnd(() => {
          ghostVisible.value = false;
          const activeTag = draggingTagRef.current;
          if (activeTag) {
            draggingTagRef.current = null;
            setDraggingTag(null);
            onReorder(pendingOrderRef.current);
          }
        })
        .onFinalize(() => {
          ghostVisible.value = false;
          if (draggingTagRef.current) {
            draggingTagRef.current = null;
            setDraggingTag(null);
            // onEnd may not have fired (e.g. gesture cancelled) — commit order anyway
            onReorder(pendingOrderRef.current);
          }
        });

      return Gesture.Simultaneous(longPress, pan);
    },
    [findNearestIndex, remeasureContainer, onReorder]
  );

  const gestures = useMemo(() => {
    const map = new Map<string, ReturnType<typeof Gesture.Simultaneous>>();
    displayItems.forEach((tag) => {
      map.set(tag, makeGesture(tag));
    });
    return map;
  }, [displayItems, makeGesture]);

  const ghostAnimStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: ghostX.value,
    top: ghostY.value,
    width: ghostW.value,
    height: ghostH.value,
    opacity: ghostVisible.value ? 0.85 : 0,
    zIndex: 999,
    pointerEvents: "none",
  }));

  return (
    <View
      ref={containerRef}
      onLayout={remeasureContainer}
      style={[{ flexDirection: "row", flexWrap: "wrap", gap: 8 }, style]}
    >
      {displayItems.map((tag) => {
        const gesture = gestures.get(tag) ?? makeGesture(tag);
        return (
          <SortableChip
            key={tag}
            tag={tag}
            isPlaceholder={tag === draggingTag}
            onLayout={handleLayout}
            gesture={gesture}
            renderChip={renderChip}
          />
        );
      })}
      <Animated.View style={ghostAnimStyle} pointerEvents="none">
        {draggingTag ? renderChip(draggingTag, false) : null}
      </Animated.View>
    </View>
  );
}
