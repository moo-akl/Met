import 'dart:async';

import 'package:Met/screens/home_screen.dart';
import 'package:Met/screens/met_feed_page.dart';
import 'package:Met/screens/profile_page.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dchs_flutter_beacon/dchs_flutter_beacon.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart' as geo;
import 'package:permission_handler/permission_handler.dart';

class MainNavigationPage extends StatefulWidget {
  const MainNavigationPage({super.key});

  @override
  State<MainNavigationPage> createState() => _MainNavigationPageState();
}

class _MainNavigationPageState extends State<MainNavigationPage> {
  int _selectedIndex = 0;
  Timer? _locationTimer;
  StreamSubscription<RangingResult>? _streamRanging;
  
  final String _appUUID = "eb2a1103-b8c5-4384-9549-c18428511674";
  final Set<String> _recentlyMet = {}; 

  // --- 1. THE STABLE HASH FUNCTION ---
  int _getStableHash(String input) {
    int hash = 0;
    for (int i = 0; i < input.length; i++) {
      hash = (31 * hash + input.codeUnitAt(i)) % 65535;
    }
    return hash;
  }

  @override
  void initState() {
    super.initState();
    _initEngine(); 
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    _streamRanging?.cancel();
    flutterBeacon.stopBroadcast();
    super.dispose();
  }

  // --- 2. ENGINE STARTUP ---
  Future<void> _initEngine() async {
    final String myUid = FirebaseAuth.instance.currentUser?.uid ?? "";
    if (myUid.isEmpty) return;

    try {
      await _ensureUserHasHash(myUid);

      bool permissionsGranted = await _requestPermissions();
      if (!permissionsGranted) {
        debugPrint("⚠️ Engine stopped: Missing permissions.");
        return;
      }

      _startBroadcasting(myUid);
      _startScanning(myUid);

      _locationTimer = Timer.periodic(const Duration(minutes: 2), (timer) {
        _updateAndCheckLocation(myUid);
      });
      _updateAndCheckLocation(myUid);
      
      debugPrint("✅ Met Engine Active. Local Stable ID: ${_getStableHash(myUid)}");
    } catch (e) {
      debugPrint("❌ Engine Failure: $e");
    }
  }

  Future<void> _ensureUserHasHash(String myUid) async {
    final userRef = FirebaseFirestore.instance.collection('users').doc(myUid);
    await userRef.set({
      'uidHash': _getStableHash(myUid),
    }, SetOptions(merge: true));
  }

  // --- 3. PERMISSION HANDLER ---
  Future<bool> _requestPermissions() async {
    await [
      Permission.bluetoothScan,
      Permission.bluetoothAdvertise,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();

    var bgStatus = await Permission.locationAlways.request();
    return bgStatus.isGranted;
  }

  // --- 4. LOCATION ENGINE (GPS) ---
  Future<void> _updateAndCheckLocation(String myUid) async {
    try {
      geo.Position position = await geo.Geolocator.getCurrentPosition(desiredAccuracy: geo.LocationAccuracy.high);
      GeoPoint myPoint = GeoPoint(position.latitude, position.longitude);
      
      await FirebaseFirestore.instance.collection('users').doc(myUid).update({
        'uidHash': _getStableHash(myUid),
        'location': {
          'geopoint': myPoint,
          'timestamp': FieldValue.serverTimestamp(),
        }
      });

      var nearbyQuery = await FirebaseFirestore.instance.collection('users').get();

      for (var doc in nearbyQuery.docs) {
        if (doc.id == myUid) continue; 

        Map<String, dynamic> data = doc.data();
        
        if (data['location'] == null || data['location']['geopoint'] == null) continue;

        double distance = geo.Geolocator.distanceBetween(
          myPoint.latitude, myPoint.longitude,
          data['location']['geopoint'].latitude, data['location']['geopoint'].longitude
        );

        if (distance < 100) { 
          _recordEncounter(myUid, doc.id, data);
        }
      }
    } catch (e) {
      debugPrint("❌ GPS Engine Error: $e");
    }
  }

  // --- 5. BLUETOOTH ENGINE (Beacons) ---
  void _startBroadcasting(String myUid) async {
    int majorId = _getStableHash(myUid); 
    try {
      await flutterBeacon.startBroadcast(BeaconBroadcast(
        proximityUUID: _appUUID,
        major: majorId,
        minor: 1,
        identifier: 'MetBeacon',
      ));
    } catch (e) {
      debugPrint("Broadcast Error: $e");
    }
  }

  void _startScanning(String myUid) async {
    await flutterBeacon.initializeScanning;
    final regions = <Region>[Region(proximityUUID: _appUUID, identifier: 'MetAppRegion')];

    _streamRanging = flutterBeacon.ranging(regions).listen((RangingResult result) {
      for (var beacon in result.beacons) {
        _handleFoundUser(myUid, beacon.major);
      }
    });
  }

  Future<void> _handleFoundUser(String myUid, int foundMajorId) async {
    var query = await FirebaseFirestore.instance
        .collection('users')
        .where('uidHash', isEqualTo: foundMajorId)
        .limit(1)
        .get();

    if (query.docs.isNotEmpty) {
      var userDoc = query.docs.first;
      if (userDoc.id != myUid) {
        _recordEncounter(myUid, userDoc.id, userDoc.data());
      }
    }
  }

  // --- 6. RECORDING LOGIC ---
  Future<void> _recordEncounter(String myUid, String theirUid, Map<String, dynamic> theirData) async {
    if (_recentlyMet.contains(theirUid)) return;
    _recentlyMet.add(theirUid);
    Timer(const Duration(minutes: 10), () => _recentlyMet.remove(theirUid));

    final blockDoc = await FirebaseFirestore.instance
        .collection('users').doc(myUid)
        .collection('blocked_users').doc(theirUid).get();

    if (blockDoc.exists) {
      debugPrint("🚫 Skipping blocked user: $theirUid");
      return; 
    }

    await FirebaseFirestore.instance
        .collection('users').doc(myUid)
        .collection('met_people').doc(theirUid).set({
      'uid': theirUid,
      'displayName': theirData['displayName'] ?? 'Unknown',
      'photoUrl': theirData['photoUrl'] ?? '',
      'lastMet': FieldValue.serverTimestamp(),
      'metCount': FieldValue.increment(1),
      'firstMet': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  // --- UI BUILDING ---
  late final List<Widget> _pages = [
    const HomeScreen(),
    const MetFeedPage(), 
    const ProfilePage(), 
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Met", style: TextStyle(fontWeight: FontWeight.bold)), 
        centerTitle: true
      ),
      // --- THE LAST FIX: IndexedStack keeps pages in memory ---
      body: IndexedStack(
        index: _selectedIndex,
        children: _pages,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        selectedItemColor: Colors.green,
        onTap: (index) => setState(() => _selectedIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: "Home"),
          BottomNavigationBarItem(icon: Icon(Icons.people), label: "Recent"),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: "Profile"),
        ],
      ),
    );
  }
}