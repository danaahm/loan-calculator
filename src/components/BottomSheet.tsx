import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";

const SHEET_DURATION_MS = 250;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The sheet's own look: background, corners, padding, height cap. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * A sheet that slides up over a dimmed screen.
 *
 * The Modal's own "slide" animation moves everything inside it, so the dimmed
 * backdrop used to travel up the screen with the sheet. Here the Modal does not
 * animate at all: the backdrop fades in place and only the sheet slides. The
 * Modal stays mounted until the closing slide has finished.
 */
export const BottomSheet = ({ visible, onClose, style, children }: BottomSheetProps) => {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  // Starts a screen away so the sheet is out of sight until it is measured.
  const sheetHeight = useSharedValue(windowHeight);
  // The slide distance is the sheet's height, so opening waits for its layout.
  const awaitingLayout = useRef(false);

  const finishClose = useCallback(() => setMounted(false), []);

  const slideIn = useCallback(() => {
    progress.value = withTiming(1, {
      duration: SHEET_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  useEffect(() => {
    if (visible) {
      if (mounted) {
        // Reopened mid-close: the sheet is already measured.
        slideIn();
      } else {
        awaitingLayout.current = true;
        setMounted(true);
      }
      return;
    }
    awaitingLayout.current = false;
    progress.value = withTiming(
      0,
      { duration: SHEET_DURATION_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        }
      }
    );
    // `mounted` is read, not reacted to: only `visible` drives the animation.
  }, [visible]);

  const handleSheetLayout = (event: LayoutChangeEvent) => {
    sheetHeight.value = event.nativeEvent.layout.height;
    if (awaitingLayout.current) {
      awaitingLayout.current = false;
      slideIn();
    }
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value }],
  }));

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.modalBackdrop },
            backdropStyle,
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[style, sheetStyle]} onLayout={handleSheetLayout}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
});
