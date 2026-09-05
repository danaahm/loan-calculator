import { type ReactNode, useEffect, useRef } from "react";
import { BackHandler, StyleSheet, View } from "react-native";

interface SwipeBackViewProps {
  onBack: () => void;
  children: ReactNode;
}

export const SwipeBackView = ({ onBack, children }: SwipeBackViewProps) => {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  return <View style={styles.fill}>{children}</View>;
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
