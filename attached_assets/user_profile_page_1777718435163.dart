import 'package:Met/1st%20working%20dart%20.d';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class UserProfileView extends StatelessWidget {
  final String uid;
  const UserProfileView({super.key, required this.uid});

  Future<void> _sendRevealRequest(BuildContext context, String theirUid) async {
    final myUid = FirebaseAuth.instance.currentUser?.uid;
    if (myUid == null) return;

    try {
      final userDoc = await FirebaseFirestore.instance.collection('users').doc(theirUid).get();
      final theirData = userDoc.data() ;
      if (theirData != null) {
        await _recordEncounter(myUid, theirUid, theirData);
        
        final encounterRef = FirebaseFirestore.instance.collection('users').doc(theirUid).collection('requests').doc(myUid);
        final myRequestRef = FirebaseFirestore.instance.collection('users').doc(myUid).collection('requests').doc(theirUid);
        
        final existingReq = await myRequestRef.get();

        if (existingReq.exists) {
          await FirebaseFirestore.instance.runTransaction((transaction) async {
            transaction.set(encounterRef, {'status': 'accepted'}, SetOptions(merge: true));
            transaction.set(myRequestRef, {'status': 'accepted'}, SetOptions(merge: true));
          });
        } else {
          await encounterRef.set({'status': 'pending', 'from': myUid}, SetOptions(merge: true));
        }

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Reveal Request Sent!")),
          );
          Navigator.pop(context); 
        }
      }
    } catch (e) {
      debugPrint("Error sending request: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Met Profile")),
      body: FutureBuilder<DocumentSnapshot>(
        future: FirebaseFirestore.instance.collection('users').doc(uid).get(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final data = snapshot.data!.data() as Map<String, dynamic>?;
          if (data == null) return const Center(child: Text("User not found"));

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 65,
                  backgroundImage: (data['photoUrl'] != null && data['photoUrl'].isNotEmpty) 
                      ? NetworkImage(data['photoUrl']) 
                      : null,
                  child: (data['photoUrl'] == null) ? const Icon(Icons.person, size: 65) : null,
                ),
                const SizedBox(height: 20),
                Text(data['displayName'] ?? "No Name", style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 10),
                const Text("Scan successful! Send a reveal request to see their socials.", textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                const SizedBox(height: 30),
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: kMetGreen, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    onPressed: () => _sendRevealRequest(context, uid),
                    icon: const Icon(Icons.lock_open),
                    label: const Text("REVEAL REQUEST"),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }}
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