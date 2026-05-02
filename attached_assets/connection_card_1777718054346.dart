import 'package:Met/screens/encounter_detail_screen.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
// Ensure the import below matches your new file structure
// import 'main.dart'; 

// Use a fallback for the color if the constant isn't imported
const Color kMetGreen = Color(0xFF2E7D32);

class ConnectionCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final String friendUid;

  // FIXED: Added super.key to the constructor
  const ConnectionCard({
    super.key, 
    required this.data, 
    required this.friendUid, required Map<String, dynamic> friendData,
  });

  @override
  Widget build(BuildContext context) {
    final String myUid = FirebaseAuth.instance.currentUser?.uid ?? "";

    return GestureDetector(
      onTap: () {
        // Note: Ensure EncounterDetailScreen is imported or defined
      
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => EncounterDetailScreen(
              theirUid: friendUid,
              status: 'accepted',
              lat: (data['meetLat'] as num?)?.toDouble(),
              lng: (data['meetLng'] as num?)?.toDouble(),
              metCount: data['metCount'] as int? ?? 1,
            ),
          ),
        );
        
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Stack(
          children: [
            // --- MAIN CARD UI ---
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Hero(
                    tag: 'profile_$friendUid',
                    child: CircleAvatar(
                      radius: 35,
                      backgroundColor: Colors.grey[200],
                      backgroundImage: (data['photoUrl'] != null && data['photoUrl'].toString().isNotEmpty)
                          ? NetworkImage(data['photoUrl'])
                          : null,
                      child: (data['photoUrl'] == null || data['photoUrl'].toString().isEmpty)
                          ? Icon(Icons.person, size: 35, color: Colors.grey[400])
                          : null,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    data['displayName'] ?? "New Connection",
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.verified_user, size: 12, color: Colors.blueAccent),
                      const SizedBox(width: 4),
                      Text(
                        "Met ${data['metCount'] ?? 1}x",
                        style: TextStyle(color: Colors.grey[600], fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // --- THE POPUP MENU ---
            Positioned(
              top: 4,
              right: 4,
              child: PopupMenuButton<String>(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                icon: const Icon(Icons.more_vert, size: 20, color: Colors.grey),
                onSelected: (value) {
                  if (value == 'remove') _showRemoveDialog(context, myUid, friendUid);
                  if (value == 'block') _showBlockDialog(context, myUid, friendUid);
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'remove',
                    child: Row(
                      children: [
                        Icon(Icons.person_remove_outlined, size: 18),
                        SizedBox(width: 8),
                        Text("Remove Connection"),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'block',
                    child: Row(
                      children: [
                        Icon(Icons.block, size: 18, color: Colors.red),
                        SizedBox(width: 8),
                        Text("Block User", style: TextStyle(color: Colors.red)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- 1. REMOVE CONNECTION ---
  void _showRemoveDialog(BuildContext context, String myUid, String theirUid) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Remove Connection?"),
        content: const Text(
          "This will hide their social IDs from your list. They will remain in your 'Recent' history if you ever want to reconnect."
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel", style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () async {
              await FirebaseFirestore.instance
                  .collection('users')
                  .doc(myUid)
                  .collection('requests')
                  .doc(theirUid)
                  .delete();
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text("Remove", style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // --- 2. BLOCK USER ---
  void _showBlockDialog(BuildContext context, String myUid, String theirUid) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Block User?"),
        content: const Text(
          "This permanently hides them from your Radar and your Connections. You will effectively be invisible to each other."
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel", style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () {
              _blockUser(myUid, theirUid);
              Navigator.pop(context);
            },
            child: const Text("Block", style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _blockUser(String myUid, String theirUid) async {
    final batch = FirebaseFirestore.instance.batch();

    // 1. Remove from Connections
    batch.delete(FirebaseFirestore.instance
        .collection('users')
        .doc(myUid)
        .collection('requests')
        .doc(theirUid));

    // 2. Remove from Recent Feed
    batch.delete(FirebaseFirestore.instance
        .collection('users')
        .doc(myUid)
        .collection('met_people')
        .doc(theirUid));

    // 3. Add to Permanent Block List
    batch.set(
        FirebaseFirestore.instance
            .collection('users')
            .doc(myUid)
            .collection('blocked_users')
            .doc(theirUid),
        {
          'blockedAt': FieldValue.serverTimestamp(),
        });

    await batch.commit();
  }
}