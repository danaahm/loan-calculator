import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Shared timing so a card's header and body move together. */
export const COLLAPSE_DURATION_MS = 300;
export const COLLAPSE_EASING = Easing.inOut(Easing.quad);

interface CollapsibleSectionProps {
  collapsed: boolean;
  children: ReactNode;
}

/**
 * Animates a card body between its natural height and zero.
 *
 * The animated pixel height is only in force *during* a transition. Once an
 * expand finishes the height constraint is dropped entirely, so the body sits
 * at its natural height and a stale or wrong measurement can never leave a card
 * stuck shut. Children unmount only after a collapse completes (charts and the
 * amortization grid are expensive to keep alive) and remount when an expand
 * starts.
 */
export const CollapsibleSection = ({
  collapsed,
  children,
}: CollapsibleSectionProps) => {
  const [rendered, setRendered] = useState(!collapsed);
  const [constrained, setConstrained] = useState(collapsed);
  const progress = useSharedValue(collapsed ? 0 : 1);
  const contentHeight = useSharedValue(0);
  const isFirstRun = useRef(true);

  const finishCollapse = useCallback(() => setRendered(false), []);
  const finishExpand = useCallback(() => setConstrained(false), []);

  useEffect(() => {
    // Mount: adopt the starting state without animating it.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      progress.value = collapsed ? 0 : 1;
      return;
    }

    // The height is measured while unconstrained, so pinning it here matches
    // what is already on screen and the animation starts without a jump.
    setRendered(true);
    setConstrained(true);
    progress.value = withTiming(
      collapsed ? 0 : 1,
      { duration: COLLAPSE_DURATION_MS, easing: COLLAPSE_EASING },
      (finished) => {
        if (!finished) {
          return;
        }
        if (collapsed) {
          runOnJS(finishCollapse)();
        } else {
          runOnJS(finishExpand)();
        }
      }
    );
  }, [collapsed, finishCollapse, finishExpand, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: progress.value,
  }));

  if (!rendered) {
    return null;
  }

  return (
    <Animated.View style={constrained ? [styles.clip, animatedStyle] : null}>
      <View
        onLayout={(event) => {
          const next = event.nativeEvent.layout.height;
          if (next > 0) {
            contentHeight.value = next;
          }
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
});
