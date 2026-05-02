import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_beacon/flutter_beacon.dart';

class RadarService {
  static const String _metUuid = 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0';
  static const String _regionId = 'com.metapp.radar';

  // We add a callback function to handle found users
  static Future<void> initRadar(Function(String uid) onUserFound) async {
    try {
      await flutterBeacon.initializeScanning;
      debugPrint("🚀 Radar Hardware Initialized");
      
      final regions = <Region>[
        Region(
          identifier: _regionId,
          proximityUUID: _metUuid,
        ),
      ];

      // 1. Ranging (Active scanning when app is awake/backgrounded)
      flutterBeacon.ranging(regions).listen((RangingResult result) {
        if (result.beacons.isNotEmpty) {
          for (var beacon in result.beacons) {
            // Usually, the 'minor' or 'major' is used to identify the user ID
            // For now, we assume the proximityUUID matches a specific logic 
            // or the beacon has a way to identify the user.
            // We pass a dummy or extracted ID to the handler.
            _handleFoundBeacon(beacon, onUserFound);
          }
        }
      });

      // 2. Monitoring (Waking up the iPhone 12 from deep sleep)
      if (Platform.isIOS) {
        flutterBeacon.monitoring(regions).listen((MonitoringResult result) {
          if (result.monitoringEventType == MonitoringEventType.didEnterRegion) {
            debugPrint("📱 iPhone 12: Region Entered! Waking up background task...");
            // You can trigger a small scan here
          }
        });
      }
    } catch (e) {
      debugPrint("❌ Radar Init Error: $e");
    }
  }

  static void _handleFoundBeacon(Beacon beacon, Function(String uid) onUserFound) {
    // In a real app, you'd map the beacon.major/minor to a real User UID
    // For this test, we assume the beacon identifies a user.
    debugPrint("📡 Beacon Detected! RSSI: ${beacon.rssi}");
    
    // We only trigger if the signal is strong enough (e.g., closer than -80)
    if (beacon.rssi > -85) {
      // In your real setup, you'd have a way to know WHICH user this beacon belongs to.
      // For now, we pass the beacon's unique signature.
      onUserFound("beacon_user_${beacon.minor}"); 
    }
  }
}