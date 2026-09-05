import { type ReactNode, useEffect, useRef } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface SwipeBackViewProps {
  onBack: () => void;
  children: ReactNode;
}

// Leave the true screen edge to Android / Expo Go. Start a bit inward so our
// gesture is not stolen by the OS "leave this app" swipe.
const EDGE_INSET = 22;
const EDGE_WIDTH = 72;
const HEADER_CLEARANCE = 52;
const DISTANCE_THRESHOLD = 64;
const VELOCITY_THRESHOLD = 500;

export const SwipeBackView = ({ onBack, children }: SwipeBackViewProps) => {
  const translateX = useSharedValue(0);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const goBack = () => {
    onBackRef.current();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-1000, 18])
    .failOffsetY([-22, 22])
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const shouldGoBack =
        event.translationX > DISTANCE_THRESHOLD || event.velocityX > VELOCITY_THRESHOLD;
      if (shouldGoBack) {
        translateX.value = 0;
        runOnJS(goBack)();
        return;
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(0, translateX.value) }],
  }));

  return (
    <View style={styles.fill}>
      <Animated.View style={[styles.fill, animatedStyle]}>{children}</Animated.View>
      <GestureDetector gesture={pan}>
        <View style={styles.edge} />
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  edge: {
    position: "absolute",
    left: EDGE_INSET,
    top: HEADER_CLEARANCE,
    bottom: 0,
    width: EDGE_WIDTH,
  },
});
