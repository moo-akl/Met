import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:geolocator/geolocator.dart' as geo;

class DatabaseService {
  static final FirebaseFirestore _db = FirebaseFirestore.instance;

  static Future<void> recordEncounter(String currentUid, String targetUid, geo.Position pos) async {
    final geoPoint = GeoPoint(pos.latitude, pos.longitude);
    
    // Use a Batch write for better reliability
    WriteBatch batch = _db.batch();
    
    DocumentReference encounterRef = _db
        .collection('users')
        .doc(currentUid)
        .collection('met_people')
        .doc(targetUid);

    batch.set(encounterRef, {
      'uid': targetUid,
      'lastMet': FieldValue.serverTimestamp(),
      'location': geoPoint,
    }, SetOptions(merge: true));

    await batch.commit();
  }
}