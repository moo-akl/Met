// Deliberately independent of theme, app context, fonts and routing.
const React = require("react");
const {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} = require("react-native");
const { registerRootComponent } = require("expo");
const SplashScreen = require("expo-splash-screen");
const { PHASES, startupTracker } = require("./state");
const buildNumber = require("../app.json").expo.ios.buildNumber;

startupTracker.enable();
startupTracker.installErrorHandler(global.ErrorUtils);

// System-independent colors are intentional: loading the app theme could be
// the startup failure being diagnosed. No profile, storage or network access
// is performed here; reports contain stages and a redacted error message.
const palette = {
  background: "#F5F7F2",
  surface: "#FFFFFF",
  text: "#172117",
  muted: "#485448",
  primary: "#365D2C",
  border: "#CED8C8",
};

const waitForPaint = () => new Promise((resolve) => {
  requestAnimationFrame(() => setTimeout(resolve, 80));
});

function DiagnosticScreen({ state, onLayout }) {
  const failed = Boolean(state.error || state.timedOut);
  const report = startupTracker.formatReport(buildNumber);
  return (
    <SafeAreaView style={styles.safe} onLayout={onLayout}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>MET · STARTUP CHECK · BUILD {buildNumber}</Text>
        <Text style={styles.title}>{state.error ? "Met could not start" : state.timedOut ? "Met is taking longer to start" : "Starting Met"}</Text>
        {!failed && <ActivityIndicator color={palette.primary} style={styles.spinner} />}
        <Text style={styles.body}>{PHASES[state.phase] || state.phase}</Text>
        {failed && (
          <>
            <Text style={styles.body}>Please share this report or take a screenshot. Nothing is uploaded automatically.</Text>
            {!state.error && <Text style={styles.body}>The app is still trying to start. This screen will close if startup finishes.</Text>}
            <View style={styles.report}><Text selectable style={styles.reportText}>{report}</Text></View>
            <TouchableOpacity
              accessibilityRole="button"
              testID="share-startup-report"
              style={styles.button}
              onPress={() => {
                void Share.share({ title: "Met startup report", message: report }).catch(() => {});
              }}
            >
              <Text style={styles.buttonText}>Share startup report</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

class StartupBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { startupTracker.captureError(error); }
  render() { return this.state.error ? null : this.props.children; }
}

function DiagnosticRoot() {
  const [state, setState] = React.useState(startupTracker.getSnapshot);
  const [RouterApp, setRouterApp] = React.useState(null);
  const started = React.useRef(false);

  React.useEffect(() => startupTracker.subscribe(setState), []);
  React.useEffect(() => {
    const timeout = setTimeout(() => startupTracker.markTimedOut(), 20_000);
    return () => clearTimeout(timeout);
  }, []);

  const startApp = React.useCallback(() => {
    if (started.current) return;
    started.current = true;
    startupTracker.markPhase("diagnostic-screen");
    void (async () => {
      try {
        // Dismiss only after a real native view exists, before app imports.
        await SplashScreen.hideAsync();
        startupTracker.markPhase("firebase-background-handler");
        await waitForPaint();
        const messaging = require("@react-native-firebase/messaging").default;
        messaging().setBackgroundMessageHandler(async () => {});

        startupTracker.markPhase("router-import");
        await waitForPaint();
        // Same App and native root registration used by Router's stock entry.
        const { App } = require("expo-router/build/qualified-entry");
        startupTracker.markPhase("router-render");
        setRouterApp(() => App);
      } catch (error) {
        startupTracker.captureError(error);
      }
    })();
  }, []);

  return (
    <View style={styles.root}>
      {RouterApp && <StartupBoundary><RouterApp /></StartupBoundary>}
      {!state.ready && (
        <View style={StyleSheet.absoluteFill}>
          <DiagnosticScreen state={state} onLayout={startApp} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, padding: 24, justifyContent: "center" },
  eyebrow: { color: palette.muted, fontSize: 11, fontWeight: "600", marginBottom: 16 },
  title: { color: palette.text, fontSize: 26, fontWeight: "700", marginBottom: 16 },
  body: { color: palette.muted, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  spinner: { alignSelf: "flex-start", marginBottom: 16 },
  report: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 16, marginVertical: 12 },
  reportText: { color: palette.text, fontSize: 12, lineHeight: 19, fontFamily: "Menlo" },
  button: { backgroundColor: palette.primary, borderRadius: 12, padding: 16, alignItems: "center" },
  buttonText: { color: palette.surface, fontWeight: "600", fontSize: 16 },
});

registerRootComponent(DiagnosticRoot);
