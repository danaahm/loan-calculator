import { type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_PADDING = 16;

interface ModalPageProps {
  /** The page's own look, such as its background. Padding is set here. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * The body of a full-screen Modal, kept clear of the notch, status bar and
 * home indicator.
 *
 * SafeAreaView cannot do this on iOS. A Modal is presented in its own view
 * hierarchy, out of reach of the app's SafeAreaProvider, so the view measures
 * its own insets once as it is attached. With a slide animation it is still
 * below the notch at that moment, so it finds none and keeps that. A
 * full-screen Modal covers the whole device, so the app's own insets are the
 * right ones and are applied instead. Android lays Modals out where
 * SafeAreaView measures correctly, so it keeps that.
 */
export const ModalPage = ({ style, children }: ModalPageProps) => {
  const insets = useSafeAreaInsets();

  if (Platform.OS !== "ios") {
    return <SafeAreaView style={[styles.page, style]}>{children}</SafeAreaView>;
  }

  return (
    <View
      style={[
        styles.page,
        style,
        {
          paddingTop: PAGE_PADDING + insets.top,
          paddingBottom: PAGE_PADDING + insets.bottom,
          paddingLeft: PAGE_PADDING + insets.left,
          paddingRight: PAGE_PADDING + insets.right,
        },
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: PAGE_PADDING,
  },
});
