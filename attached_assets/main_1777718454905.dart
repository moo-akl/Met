import 'dart:io';
import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';

// --- FIREBASE & AUTH ---
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'firebase_options.dart'; // Ensure this file exists in your lib folder

// --- LOCATION & GEOSPATIAL ---
import 'package:geolocator/geolocator.dart' as geo;
import 'package:geoflutterfire_plus/geoflutterfire_plus.dart';

// --- SYSTEM SERVICES ---
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:workmanager/workmanager.dart';
import 'package:permission_handler/permission_handler.dart';

// --- UI & UTILS ---
import 'package:url_launcher/url_launcher.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:introduction_screen/introduction_screen.dart';
import 'package:timeago/timeago.dart' as timeago;

// --- LOCALIZATION (LANGUAGES) ---
import 'package:flutter_localizations/flutter_localizations.dart';
import 'l10n/app_localizations.dart'; // New "Physical" way to handle localization without code generation, using ARB files and AppLocalizations class

// --- SCREEN IMPORTS ---
// Ensure these paths match your actual file names
import 'package:Met/screens/auth_screen.dart';
import 'package:Met/screens/main_navigation_page.dart';
import 'package:Met/screens/settings_page.dart';
import 'package:Met/screens/verification_pending_screen.dart';

// --- THEME COLORS ---
const Color kMetGreen = Color.fromRGBO(61, 204, 68, 1);
const Color kMetLightBg = Color(0xFFF1F8F0);

// --- 1. IOS BACKGROUND TASK DISPATCHER ---
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) {
    debugPrint("iOS Native background task running: $task");
    return Future.value(true);
  });
}

// --- 2. MAIN ENTRY POINT ---
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase with auto-generated options
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // APP CHECK: Fix for your iPhone 12 (2026) and Android debugging
  try {
    await FirebaseAppCheck.instance.activate(
      androidProvider: AndroidProvider.debug,
      appleProvider: AppleProvider.debug, // This allows your iPhone 12 to bypass 403 errors
    );
  } catch (e) {
    debugPrint("App Check error: $e");
  }

  // IOS BACKGROUND WORKER: Required for the "Social Radar" to work in pocket
  if (Platform.isIOS) {
    Workmanager().initialize(callbackDispatcher, isInDebugMode: kDebugMode);
  }

  // SHIFT PREFS: Check for first-time launch
  final prefs = await SharedPreferences.getInstance();
  final bool isFirstTime = prefs.getBool('isFirstTime') ?? true;

  // BACKGROUND SERVICE: Starts the tracking engine
  await initializeService();

  runApp(MetApp(showOnboarding: isFirstTime));
}

// --- 3. MAIN APP WIDGET ---
class MetApp extends StatelessWidget {
  final bool showOnboarding;
  const MetApp({super.key, required this.showOnboarding});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Met',
      debugShowCheckedModeBanner: false,
      
      // LOCALIZATION: Sets up multi-language support
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en'), // English
        Locale('es'), // Spanish
        // Add more locales as you create ARB files
      ],

      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: kMetGreen),
        useMaterial3: true,
        primaryColor: kMetGreen,
        appBarTheme: const AppBarTheme(
          backgroundColor: kMetGreen,
          foregroundColor: Colors.white,
          elevation: 0,
        ),
      ),
      
      home: AuthWrapper(showOnboarding: showOnboarding),
      
      routes: {
        '/auth': (context) => const AuthWrapper(showOnboarding: false),
        '/main': (context) => const MainNavigationPage(),
        '/settings': (context) => const SettingsPage(),
      },
    );
  }
}

// --- 4. AUTH & IOS PERMISSION HANDLER ---
class AuthWrapper extends StatefulWidget {
  final bool showOnboarding;
  const AuthWrapper({super.key, required this.showOnboarding});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  @override
  void initState() {
    super.initState();
    // Trigger iOS permission prompt shortly after app start
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) _checkIOSPermissions(context);
    });
  }

  Future<void> _checkIOSPermissions(BuildContext context) async {
    if (Platform.isIOS) {
      var bluetoothStatus = await Permission.bluetoothScan.status;
      var locationStatus = await Permission.locationAlways.status;

      if (bluetoothStatus.isDenied || locationStatus.isDenied) {
        if (!context.mounted) return;
        showCupertinoDialog(
          context: context,
          builder: (context) => CupertinoAlertDialog(
            title: const Text("Enable Social Radar"),
            content: const Text("Met needs Bluetooth and Location to find people nearby, even when your phone is in your pocket."),
            actions: [
              CupertinoDialogAction(
                child: const Text("Not Now"),
                onPressed: () => Navigator.pop(context),
              ),
              CupertinoDialogAction(
                isDefaultAction: true,
                child: const Text("Settings"),
                onPressed: () {
                  openAppSettings();
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      initialData: FirebaseAuth.instance.currentUser,
      stream: FirebaseAuth.instance.userChanges(),
      builder: (context, snapshot) {
        final user = snapshot.data;

        // User is logged in
        if (user != null) {
          return user.emailVerified 
              ? const MainNavigationPage() 
              : const VerificationPendingScreen();
        }

        // Checking session
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator(color: kMetGreen)),
          );
        }

        // New user or logged out
        return widget.showOnboarding ? const OnboardingScreen() : const AuthScreen();
      },
    );
  }
}

// --- 5. BACKGROUND SERVICE CONFIGURATION ---
Future<void> initializeService() async {
  final service = FlutterBackgroundService();

  // Setup Android Notification Channel
  const AndroidNotificationChannel channel = AndroidNotificationChannel(
    'my_foreground', 
    'MetApp Service', 
    importance: Importance.low
  );

  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

  if (Platform.isAndroid) {
    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: true,
      isForegroundMode: true,
      notificationChannelId: 'my_foreground',
      initialNotificationTitle: 'Met Active',
      initialNotificationContent: 'Tracking encounters...',
    ),
    iosConfiguration: IosConfiguration(
      autoStart: true,
      onForeground: onStart,
      onBackground: onIosBackground, // Handle iOS background handshake
    ),
  );
}

@pragma('vm:entry-point')
bool onIosBackground(ServiceInstance service) {
  WidgetsFlutterBinding.ensureInitialized();
  debugPrint("iOS Background Service Handshake Success");
  return true;
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();
  await Firebase.initializeApp();
  
  final FlutterLocalNotificationsPlugin notifications = FlutterLocalNotificationsPlugin();
  final prefs = await SharedPreferences.getInstance();

  // --- SHARED ENCOUNTER LOGIC ---
  // This handles both GPS matches and Bluetooth matches
  Future<void> processDiscovery(String targetUid, Map<String, dynamic> data) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null || targetUid == user.uid) return;

    final lastMetStr = prefs.getString('last_met_$targetUid');
    bool shouldNotify = true;

    if (lastMetStr != null) {
      final lastMet = DateTime.parse(lastMetStr);
      if (DateTime.now().difference(lastMet).inHours < 2) {
        shouldNotify = false; // Stay quiet if we met less than 2 hours ago
      }
    }

    if (shouldNotify) {
      // 1. Record to Firestore
      await _recordEncounter(user.uid, targetUid, data);
      
      // 2. Save timestamp locally
      await prefs.setString('last_met_$targetUid', DateTime.now().toIso8601String());
      
      // 3. Show Notification
      await notifications.show(
        targetUid.hashCode,
        "New Encounter!",
        "You just crossed paths with ${data['displayName'] ?? 'someone'}",
        const NotificationDetails(
          android: AndroidNotificationDetails('my_foreground', 'Encounters', importance: Importance.high),
          iOS: DarwinNotificationDetails(presentAlert: true, presentBadge: true, presentSound: true),
        ),
      );
    }
  }

  // --- START BLUETOOTH RADAR ---
  await RadarService.initRadar((String beaconUserId) async {
    // When a beacon is found, we quickly fetch their name from Firestore
    final doc = await FirebaseFirestore.instance.collection('users').doc(beaconUserId).get();
    if (doc.exists) {
      await processDiscovery(beaconUserId, doc.data() as Map<String, dynamic>);
    }
  });

  // --- START GPS TRACKING ---
  geo.Geolocator.getPositionStream(
    locationSettings: const geo.LocationSettings(
      accuracy: geo.LocationAccuracy.high, 
      distanceFilter: 30
    ),
  ).listen((geo.Position pos) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final myPoint = GeoFirePoint(GeoPoint(pos.latitude, pos.longitude));
    
    // Update my location for others to find me
    await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
      'location': myPoint.data,
      'last_seen': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));

    // Query GPS nearby (50 meters)
    final List<DocumentSnapshot> nearbyDocs = await GeoCollectionReference(
      FirebaseFirestore.instance.collection('users')
    ).fetchWithin(
      center: myPoint, 
      radiusInKm: 0.05, 
      field: 'location', 
      strictMode: true,
      geopointFrom: (data) => (data['location'] as Map<String, dynamic>)['geopoint'] as GeoPoint,
    );

    for (var doc in nearbyDocs) {
      final data = doc.data() as Map<String, dynamic>?;
      if (data != null && data['isVisible'] == true && doc.id != user.uid) {
        await processDiscovery(doc.id, data);
      }
    }
  });
}
// --- 6. GLOBAL HELPERS ---

Future<void> _recordEncounter(String myUid, String theirUid, Map<String, dynamic> theirData) async {
  final userRef = FirebaseFirestore.instance.collection('users').doc(myUid);
  final metRef = userRef.collection('met_people').doc(theirUid);

  try {
    await userRef.set({
      'lastActive': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));

    await metRef.set({
      'uid': theirUid,
      'displayName': theirData['displayName'] ?? 'Unknown',
      'lastMet': FieldValue.serverTimestamp(),
      'metCount': FieldValue.increment(1),
      'uidHash': theirData['uidHash'],
    }, SetOptions(merge: true));

    debugPrint("Encounter recorded for $myUid");
  } catch (e) {
    debugPrint("Firestore Record Error: $e");
  }
}

Future<void> launchSocial(String input, String platform) async {
  if (input.isEmpty) return;
  String cleanInput = input.trim().replaceAll('@', '');
  Uri uri; Uri fallbackUri;

  switch (platform.toLowerCase()) {
    case 'instagram':
      uri = Uri.parse("instagram://user?username=$cleanInput");
      fallbackUri = Uri.parse("https://www.instagram.com/$cleanInput/");
      break;
    case 'x':
      uri = Uri.parse("twitter://user?screen_name=$cleanInput");
      fallbackUri = Uri.parse("https://x.com/$cleanInput");
      break;
    case 'facebook':
      uri = Uri.parse("fb://facewebmodal/f?href=https://www.facebook.com/$cleanInput");
      fallbackUri = Uri.parse("https://www.facebook.com/$cleanInput");
      break;
    case 'linkedin':
      uri = Uri.parse("https://www.linkedin.com/in/$cleanInput");
      fallbackUri = uri;
      break;
    default:
      uri = Uri.parse(cleanInput.startsWith('http') ? cleanInput : 'https://$cleanInput');
      fallbackUri = uri;
  }

  try {
    bool launched = await launchUrl(uri, mode: LaunchMode.externalNonBrowserApplication);
    if (!launched) await launchUrl(fallbackUri, mode: LaunchMode.externalApplication);
  } catch (e) {
    await launchUrl(fallbackUri, mode: LaunchMode.externalApplication);
  }
}

// --- 7. ADDITIONAL SCREENS & COMPONENTS ---

// (RequestsListPage and NotificationsPage logic should follow your existing implementation)
class RequestBadgeIcon extends StatelessWidget {
  const RequestBadgeIcon({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid ?? "";

    return StreamBuilder<QuerySnapshot>(
      // We listen to the "requests" subcollection for status "pending"
      stream: FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .collection('requests')
          .where('status', isEqualTo: 'pending')
          .snapshots(),
      builder: (context, snapshot) {
        int count = snapshot.hasData ? snapshot.data!.docs.length : 0;

        return Stack(
          alignment: Alignment.center,
          children: [
            IconButton(
              icon: const Icon(Icons.notifications_none_rounded, size: 28),
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const RequestsListPage()),
              ),
            ),
            if (count > 0)
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(10)),
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  child: Text('$count', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                ),
              ),
          ],
        );
      },
    );
  }
}
class EncounterMapScreen extends StatelessWidget {
  final double lat; final double lng; final String userName;
  const EncounterMapScreen({super.key, required this.lat, required this.lng, required this.userName});

  @override
  Widget build(BuildContext context) {
    final LatLng meetingPoint = LatLng(lat, lng);
    return Scaffold(
      appBar: AppBar(title: Text("Met $userName here")),
      body: GoogleMap(
        initialCameraPosition: CameraPosition(target: meetingPoint, zoom: 16),
        markers: {Marker(markerId: const MarkerId('m1'), position: meetingPoint, infoWindow: InfoWindow(title: "Met $userName"))},
      ),
    );
  }
}

class RequestsListPage extends StatelessWidget {
  const RequestsListPage({super.key});

  @override
  Widget build(BuildContext context) {
    final myUid = FirebaseAuth.instance.currentUser?.uid ?? "";

    return Scaffold(
      appBar: AppBar(title: const Text("Reveal Requests")),
      body: StreamBuilder<QuerySnapshot>(
        // Ensure this path matches your button ('requests')
        stream: FirebaseFirestore.instance
            .collection('users')
            .doc(myUid)
            .collection('requests') 
            .where('status', isEqualTo: 'pending')
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
            return const Center(child: Text("No pending requests"));
          }

          final docs = snapshot.data!.docs;

          return ListView.builder(
            itemCount: docs.length,
            itemBuilder: (context, index) {
              final senderUid = docs[index].id;
              // --- THIS IS WHERE YOU CALL THE CLASS ---
              return _RequestTile(senderUid: senderUid, myUid: myUid);
            },
          );
        },
      ),
    );
  }
}
class _RequestTile extends StatelessWidget {
  final String senderUid;
  final String myUid;
  const _RequestTile({required this.senderUid, required this.myUid});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<DocumentSnapshot>(
      future: FirebaseFirestore.instance.collection('users').doc(senderUid).get(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const ListTile(title: Text("Loading..."));
        
        final userData = snapshot.data!.data() as Map<String, dynamic>?;
        final name = userData?['displayName'] ?? "Stranger";
        final photo = userData?['photoUrl'];

        return ListTile(
          leading: CircleAvatar(
            backgroundImage: photo != null && photo.isNotEmpty ? NetworkImage(photo) : null,
            child: photo == null ? const Icon(Icons.person) : null,
          ),
          title: Text(name),
          subtitle: const Text("wants to see your socials"),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.check_circle, color: Colors.green),
                onPressed: () => _handleResponse(context, 'accepted'),
              ),
              IconButton(
                icon: const Icon(Icons.cancel, color: Colors.red),
                onPressed: () => _handleResponse(context, 'declined'),
              ),
            ],
          ),
        );
      },
    );
  }

  void _handleResponse(BuildContext context, String status) async {
  final batch = FirebaseFirestore.instance.batch();

  // 1. Path to MY record of this person (Receiver)
  DocumentReference myRef = FirebaseFirestore.instance
      .collection('users')
      .doc(myUid) // your UID
      .collection('requests')
      .doc(senderUid); // their UID

  // 2. Path to THEIR record of me (Sender)
  DocumentReference theirRef = FirebaseFirestore.instance
      .collection('users')
      .doc(senderUid) // their UID
      .collection('requests')
      .doc(myUid); // your UID

  // Update BOTH at the same time
  batch.set(myRef, {'status': status}, SetOptions(merge: true));
  batch.set(theirRef, {'status': status}, SetOptions(merge: true));

  try {
    await batch.commit();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Request $status"), backgroundColor: status == 'accepted' ? Colors.green : Colors.red),
      );
    }
  } catch (e) {
    debugPrint("Batch Error: $e");
  }
}
}


class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid ?? "";

    return Scaffold(
      appBar: AppBar(title: const Text("Reveal Requests")),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('users')
            .doc(uid)
            .collection('requests')
            .where('status', isEqualTo: 'pending')
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return Center(child: Text("Error: ${snapshot.error}"));
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          
          final docs = snapshot.data!.docs;
          if (docs.isEmpty) {
            return const Center(
              child: Text("No new requests. Go out and meet people!"),
            );
          }

          return ListView.builder(
            itemCount: docs.length,
            itemBuilder: (context, index) {
              final reqData = docs[index].data() as Map<String, dynamic>;
              final senderUid = docs[index].id;
              
              // FIX: Used the 'time' variable to remove the Lint warning
              final Timestamp? time = reqData['timestamp'] as Timestamp?; 
              
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: const Text("Reveal Request"),
                  // Use timeago to show exactly when the request arrived
                  subtitle: Text(time != null 
                    ? "Received ${timeago.format(time.toDate())}" 
                    : "Someone you met wants to connect!"),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.check_circle, color: Colors.green),
                        onPressed: () => _handleRequest(uid, senderUid, 'accepted'),
                      ),
                      IconButton(
                        icon: const Icon(Icons.cancel, color: Colors.red),
                        onPressed: () => _handleRequest(uid, senderUid, 'declined'),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _handleRequest(String myUid, String senderUid, String newStatus) async {
  try {
    final batch = FirebaseFirestore.instance.batch();

    // Reference to YOUR copy of the request record
    DocumentReference myRequestRef = FirebaseFirestore.instance
        .collection('users')
        .doc(myUid)
        .collection('requests')
        .doc(senderUid);

    // Reference to THEIR copy of the request record
    DocumentReference theirRequestRef = FirebaseFirestore.instance
        .collection('users')
        .doc(senderUid)
        .collection('requests')
        .doc(myUid);

    // Use SET with MERGE: This forces the status change and prevents looping/failure 
    // if the document doesn't strictly exist on one side yet.
    batch.set(myRequestRef, {
      'status': newStatus,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));

    batch.set(theirRequestRef, {
      'status': newStatus,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));

    await batch.commit();
    debugPrint("✅ Handshake successful: Status set to $newStatus");
  } catch (e) {
    debugPrint("🚨 Error handling request: $e");
  }
}
}

class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return IntroductionScreen(
      pages: [
        PageViewModel(
          title: "Discover Nearby People",
          body: "MetApp uses Bluetooth and location services to find other users nearby, please turn on bluetooth or allow location all the time for no more missed connections!",
          image: const Center(child: Icon(Icons.radar, size: 100, color: Colors.blue)),
          decoration: const PageDecoration(titleTextStyle: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
        ),
        PageViewModel(
          title: "Stay Private & Secure",
          body: "We never share your exact GPS. Only your 'Encounter ID' is exchanged locally.",
          image: const Center(child: Icon(Icons.shield_outlined, size: 100, color: Colors.green)),
          decoration: const PageDecoration(titleTextStyle: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
        ),
        PageViewModel(
          title: "Create Your Identity",
          body: "Let's set up your profile so people know who they've met.",
          image: const Center(child: Icon(Icons.account_circle_outlined, size: 100, color: Colors.orange)),
          decoration: const PageDecoration(titleTextStyle: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
        ),
      ],
      onDone: () {
  // This sends them to the Auth/Login screen after the tutorial
  Navigator.of(context).pushReplacementNamed('/auth');
},
      showSkipButton: true,
      skip: const Text("Skip"),
      next: const Icon(Icons.arrow_forward),
      done: const Text("Get Started", style: TextStyle(fontWeight: FontWeight.w600)),
      dotsDecorator: DotsDecorator(
        size: const Size.square(10.0),
        activeSize: const Size(20.0, 10.0),
        activeColor: Theme.of(context).primaryColor,
        spacing: const EdgeInsets.symmetric(horizontal: 3.0),
        activeShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25.0)),
      ),
    );
  }
}