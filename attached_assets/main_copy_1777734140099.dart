import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/cupertino.dart'; // Use Cupertino for iOS style
import 'package:Met/screens/auth_screen.dart';
import 'package:Met/screens/main_navigation_page.dart';
import 'package:Met/screens/settings_page.dart';
import 'package:Met/screens/verification_pending_screen.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart' as geo; // Added 'as geo'
import 'package:geoflutterfire_plus/geoflutterfire_plus.dart';
import 'dart:async';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:flutter/foundation.dart';
import 'firebase_options.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:introduction_screen/introduction_screen.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart'; // This file is auto-generated


const Color kMetGreen = Color.fromRGBO(61, 204, 68, 1);
const Color kMetLightBg = Color(0xFFF1F8F0);


// --- MAIN ---
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize Firebase & App Check
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  } catch (e) {
    if (!e.toString().contains('duplicate-app')) debugPrint("Firebase Error: $e");
  }

  try {
   await FirebaseAppCheck.instance.activate(
  androidProvider: AndroidProvider.debug,
);
  } catch (e) {
    debugPrint("App Check error: $e");
  }

  // 2. Check if this is the first time the app is launched
  final prefs = await SharedPreferences.getInstance();
  final bool isFirstTime = prefs.getBool('isFirstTime') ?? true;

  // 3. Start the Background Service
  initializeService().then((_) => debugPrint("Service Started"));

  // 4. THE FIX: Pass the 'isFirstTime' variable to the showOnboarding parameter
  runApp(MetApp(showOnboarding: isFirstTime));
}

// --- GLOBAL HELPERS ---

// This function is now global so it can be called from the Background Service AND the QR Scanner
Future<void> _recordEncounter(String myUid, String theirUid, Map<String, dynamic> theirData) async {
  final userRef = FirebaseFirestore.instance.collection('users').doc(myUid);
  final metRef = userRef.collection('met_people').doc(theirUid);

  try {
    // 1. ENSURE THE PARENT EXISTS: This is the magic fix.
    // We do a 'set' with merge on the main user doc first.
    await userRef.set({
      'lastActive': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));

    // 2. NOW WRITE THE SUB-COLLECTION
    await metRef.set({
      'uid': theirUid,
      'displayName': theirData['displayName'] ?? 'Unknown',
      'lastMet': FieldValue.serverTimestamp(),
      'metCount': FieldValue.increment(1),
      'uidHash': theirData['uidHash'],
    }, SetOptions(merge: true));

    debugPrint("✅ SUCCESS: Sub-collection created under $myUid");
  } catch (e) {
    debugPrint("🚨 RULES OR PATH ERROR: $e");
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

Widget buildSocialButton(String url, IconData icon, Color color, String platformName) {
  if (url.isEmpty) return const SizedBox.shrink();
  return ListTile(
    leading: FaIcon(icon, color: color),
    title: Text(platformName),
    onTap: () => launchSocial(url, platformName),
    trailing: const Icon(Icons.open_in_new, size: 16),
  );
}

class MetApp extends StatelessWidget {
  final bool showOnboarding;

  const MetApp({super.key, required this.showOnboarding});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Met',
      debugShowCheckedModeBanner: false,
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
      // FIX 1: Pass the variable and remove 'const'
      home: AuthWrapper(showOnboarding: showOnboarding),
      
      routes: {
        // FIX 2: Pass 'false' here because if they are at the auth screen, 
        // they've already seen the onboarding. Remove 'const'.
        '/auth': (context) => const AuthWrapper(showOnboarding: false),
        '/main': (context) => const MainNavigationPage(),
        '/settings': (context) => const SettingsPage(),
      },
    );
  }
}

// Create this helper widget to handle the Auth logic cleanly
class AuthWrapper extends StatelessWidget {
  final bool showOnboarding;
  
  const AuthWrapper({super.key, required this.showOnboarding});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      // 1. Synchronously check if a user is already saved on the device
      initialData: FirebaseAuth.instance.currentUser,
      // 2. Listen for future changes (logout/login)
      stream: FirebaseAuth.instance.userChanges(),
      builder: (context, snapshot) {
        final user = snapshot.data;

        // --- LOGGED IN LOGIC ---
        // If initialData found a user, this block runs IMMEDIATELY, skipping the loading screen
        if (user != null) {
          if (user.emailVerified) {
            return const MainNavigationPage();
          } else {
            return const VerificationPendingScreen();
          }
        }

        // --- NOT LOGGED IN / WAITING LOGIC ---
        // If no user was found initially, we show the loading screen while 
        // Firebase double-checks the connection.
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: Colors.white,
            body: Center(
              child: CircularProgressIndicator(color: kMetGreen),
            ),
          );
        }

        // --- NO USER FOUND ---
        // Once the check is done and no session exists, show Onboarding or Login
        return showOnboarding ? const OnboardingScreen() : const AuthScreen();
      },
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

// --- BACKGROUND SERVICE ---
Future<void> initializeService() async {
  final service = FlutterBackgroundService();
  const AndroidNotificationChannel channel = AndroidNotificationChannel('my_foreground', 'MetApp Service', importance: Importance.low);
  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();
  await flutterLocalNotificationsPlugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(channel);

  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: true,
      isForegroundMode: true,
      notificationChannelId: 'my_foreground',
      initialNotificationTitle: 'Met Active',
      initialNotificationContent: 'Tracking encounters...',
    ),
    iosConfiguration: IosConfiguration(),
  );
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  await Firebase.initializeApp();
  final FlutterLocalNotificationsPlugin notifications = FlutterLocalNotificationsPlugin();

  geo.Geolocator.getPositionStream(
  locationSettings: const geo.LocationSettings(accuracy: geo.LocationAccuracy.high, 
      distanceFilter: 30
    ),
  ).listen((geo.Position pos) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final geoPoint = GeoPoint(pos.latitude, pos.longitude);
    final myPoint = GeoFirePoint(geoPoint);
    
    await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
      'location': myPoint.data,
      'last_seen': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));

    final collectionReference = FirebaseFirestore.instance.collection('users');

    final List<DocumentSnapshot> nearbyDocs = await GeoCollectionReference(collectionReference)
        .fetchWithin(
          center: myPoint, 
          radiusInKm: 0.05, 
          field: 'location', 
          strictMode: true,
          geopointFrom: (data) {
            final Map<String, dynamic> locationData = data['location'] as Map<String, dynamic>;
            return locationData['geopoint'] as GeoPoint;
          },
        );

    final validNearbyDocs = nearbyDocs.where((doc) {
      final data = doc.data() as Map<String, dynamic>?;
      return data != null && 
             data['isVisible'] == true && 
             doc.id != user.uid;
    }).toList();

    for (var doc in validNearbyDocs) {
      final prefs = await SharedPreferences.getInstance();
      final lastMetStr = prefs.getString('last_met_${doc.id}');
      bool shouldNotify = true;

      if (lastMetStr != null) {
        final lastMet = DateTime.parse(lastMetStr);
        if (DateTime.now().difference(lastMet).inHours < 2) shouldNotify = false;
      }

      if (shouldNotify) {
        await _recordEncounter(user.uid, doc.id, doc.data() as Map<String, dynamic>);
        await prefs.setString('last_met_${doc.id}', DateTime.now().toIso8601String());
        
        await notifications.show(
          id: doc.id.hashCode,
          title: "New Encounter!",
          body: "You just crossed paths with ${doc['displayName'] ?? 'someone'}",
          notificationDetails: const NotificationDetails(
            android: AndroidNotificationDetails(
              'my_foreground', 
              'Encounters',
              importance: Importance.high,
              priority: Priority.high,
            ),
          ),
        );
      }
    }
  });
}



// --- MAP SCREEN ---
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

// --- PROFILE PAGE ---



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


Future<void> checkIOSPermissions(BuildContext context) async {
  if (Platform.isIOS) {
    // Check if we already have permission
    var bluetoothStatus = await Permission.bluetoothScan.status;
    var locationStatus = await Permission.locationAlways.status;

    if (bluetoothStatus.isDenied || locationStatus.isDenied) {
      // Show an iOS-style alert before the system popup
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

void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) {
    print("iOS Native background task running...");
    // Trigger a quick 10-second Bluetooth scan here
    return Future.value(true);
  });
}

// Inside your main()
if (Platform.isIOS) {
  Workmanager().initialize(callbackDispatcher);
}