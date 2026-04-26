import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'connection_card.dart';
// NOTE: You will need to create this file next!
// import 'profile_detail_page.dart'; 

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid ?? "";

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        centerTitle: false,
        title: const Text(
          "My Connections",
          style: TextStyle(
            color: Colors.black, 
            fontWeight: FontWeight.bold, 
            fontSize: 24
          ),
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('users')
            .doc(uid)
            .collection('requests')
            .where('status', isEqualTo: 'accepted')
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return Center(child: Text("Error: ${snapshot.error}"));
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          
          final acceptedDocs = snapshot.data!.docs;
          if (acceptedDocs.isEmpty) {
            return _buildEmptyState();
          }

          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, 
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 0.85,
            ),
            itemCount: acceptedDocs.length,
            itemBuilder: (context, index) {
              final String friendUid = acceptedDocs[index].id;

              return StreamBuilder<DocumentSnapshot>(
                stream: FirebaseFirestore.instance
                    .collection('users')
                    .doc(uid)
                    .collection('met_people')
                    .doc(friendUid)
                    .snapshots(),
                builder: (context, metSnap) {
                  if (!metSnap.hasData) return const SizedBox.shrink();
                  final data = metSnap.data!.data() as Map<String, dynamic>? ?? {};

                  // --- FIX STARTS HERE ---
                  return InkWell(
                    onTap: () {
                      // This navigates to the detailed profile page
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ConnectionCard(
                            friendUid: friendUid,
                            friendData: data, data: {},
                          ),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: ConnectionCard(data: data, friendUid: friendUid, friendData: {},),
                  );
                  // --- FIX ENDS HERE ---
                },
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.person_add_alt_1_rounded, size: 100, color: Colors.blue.withOpacity(0.2)),
          const SizedBox(height: 20),
          const Text(
            "No Connections Yet",
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.black87),
          ),
          const SizedBox(height: 10),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              "Encounters you've accepted will appear here as permanent contacts.",
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}

// --- PLACEHOLDER FOR THE DETAIL PAGE ---
// Create a new file named 'profile_detail_page.dart' and move this there!
class ProfileDetailPage extends StatelessWidget {
  final String friendUid;
  final Map<String, dynamic> friendData;

  const ProfileDetailPage({
    super.key, 
    required this.friendUid, 
    required this.friendData
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(friendData['name'] ?? "User Profile")),
      body: Center(
        child: Column(
          children: [
            const SizedBox(height: 20),
            CircleAvatar(
              radius: 60,
              backgroundImage: NetworkImage(friendData['photoUrl'] ?? ''),
            ),
            const SizedBox(height: 20),
            Text(
              friendData['name'] ?? 'Unknown',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            // Add more details here like 'About Me' or 'Social Links'
          ],
        ),
      ),
    );
  }
}