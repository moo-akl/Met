import 'package:Met/1st%20working%20dart%20.d';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:timeago/timeago.dart' as timeago;

class MetFeedPage extends StatelessWidget {
  const MetFeedPage({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid ?? "";

    return Scaffold(
      appBar: AppBar(
        title: const Text("Recent Encounters"),
        actions: [
          StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance
                .collection('users')
                .doc(uid)
                .collection('requests')
                .where('status', isEqualTo: 'pending')
                .snapshots(),
            builder: (context, snapshot) {
              bool hasNotifications = snapshot.hasData && snapshot.data!.docs.isNotEmpty;

              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications_none_rounded),
                    onPressed: () {
                      Navigator.push(
                        context, 
                        MaterialPageRoute(builder: (context) => const NotificationsPage())
                      );
                    },
                  ),
                  if (hasNotifications)
                    Positioned(
                      right: 12,
                      top: 12,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),

      // --- THE FLOATED SCANNER ICON ---
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const QRScannerPage()),
          );
        },
        backgroundColor: const Color.fromARGB(255, 40, 244, 104),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.qr_code_scanner_rounded),
        label: const Text("Scan QR"),
      ),

      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('users')
            .doc(uid)
            .collection('met_people')
            .orderBy('lastMet', descending: true)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return Center(child: Text("Error: ${snapshot.error}"));
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          
          final docs = snapshot.data!.docs;
          if (docs.isEmpty) return const Center(child: Text("No encounters yet."));

          return ListView.builder(
            // Padding added at bottom to prevent FAB from overlapping list items
            padding: const EdgeInsets.only(bottom: 80),
            itemCount: docs.length,
            itemBuilder: (context, index) {
              final data = docs[index].data() as Map<String, dynamic>;
              final theirUid = data['uid'] ?? "";

              return StreamBuilder<DocumentSnapshot>(
                stream: FirebaseFirestore.instance
                    .collection('users')
                    .doc(uid)
                    .collection('requests')
                    .doc(theirUid)
                    .snapshots(),
                builder: (context, reqSnapshot) {
                  final reqData = reqSnapshot.data?.data() as Map<String, dynamic>?;
                  final status = reqData?['status'] ?? 'none';

                  // If accepted, they move to the Home/Connections screen
                  if (status == 'accepted') return const SizedBox.shrink();

                  final timestamp = data['lastMet'] as Timestamp?;

                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    leading: Hero(
                      tag: 'avatar_$theirUid', 
                      child: CircleAvatar(
                        radius: 28,
                        backgroundImage: (data['photoUrl'] != null && data['photoUrl'].isNotEmpty) 
                          ? NetworkImage(data['photoUrl']) 
                          : null,
                        child: (data['photoUrl'] == null || data['photoUrl'].isEmpty) 
                          ? const Icon(Icons.person) 
                          : null,
                      ),
                    ),
                    title: Text(
                      data['displayName'] ?? "Stranger", 
                      style: const TextStyle(fontWeight: FontWeight.bold)
                    ),
                    subtitle: Text(
                      timestamp != null 
                        ? "Met ${timeago.format(timestamp.toDate())}" 
                        : "Just met"
                    ),
                    trailing: PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert),
                      onSelected: (value) {
                        if (value == 'delete') {
                          _showDeleteConfirmation(context, uid, theirUid);
                        } else if (value == 'block') {
                          _blockUser(uid, theirUid);
                        }
                      },
                      itemBuilder: (context) => [
                        const PopupMenuItem(value: 'delete', child: Text("Remove from list")),
                        const PopupMenuItem(
                          value: 'block', 
                          child: Text("Block & Hide", style: TextStyle(color: Colors.red))
                        ),
                      ],
                    ),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => EncounterDetailScreen(
                            theirUid: theirUid,
                            status: status,
                            lat: (data['meetLat'] as num?)?.toDouble(),
                            lng: (data['meetLng'] as num?)?.toDouble(),
                            metCount: data['metCount'] as int?,
                            firstMet: data['firstMet'] as Timestamp?,
                          ),
                        ),
                      );
                    },
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  // --- HELPER FUNCTIONS ---
  void _showDeleteConfirmation(BuildContext context, String myUid, String theirUid) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Delete Encounter?"),
        content: const Text("This will remove them from your list. If you meet again, you'll need to send a new reveal request."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          TextButton(
            onPressed: () {
              _deleteEncounter(myUid, theirUid);
              Navigator.pop(context);
            },
            child: const Text("Delete", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteEncounter(String myUid, String theirUid) async {
    final batch = FirebaseFirestore.instance.batch();
    DocumentReference encounterRef = FirebaseFirestore.instance.collection('users').doc(myUid).collection('met_people').doc(theirUid);
    DocumentReference myRequestRef = FirebaseFirestore.instance.collection('users').doc(myUid).collection('requests').doc(theirUid);
    batch.delete(encounterRef);
    batch.delete(myRequestRef);
    try { await batch.commit(); } catch (e) { debugPrint("🚨 Error: $e"); }
  }

  Future<void> _blockUser(String myUid, String theirUid) async {
    await FirebaseFirestore.instance.collection('users').doc(myUid).collection('blocked_users').doc(theirUid).set({'blockedAt': FieldValue.serverTimestamp()});
    await _deleteEncounter(myUid, theirUid);
  }
}