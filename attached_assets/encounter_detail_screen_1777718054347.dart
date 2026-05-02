import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

class EncounterDetailScreen extends StatelessWidget {
  final String theirUid;
  final String status;
  final double? lat;
  final double? lng;
  // Added metCount to the constructor
  final int? metCount; 
  final Timestamp? firstMet; // Add this line

  const EncounterDetailScreen({
    super.key,
    required this.theirUid,
    required this.status,
    this.lat,
    this.lng,
    this.metCount,
    this.firstMet,
  });

  Future<void> _blockUser(BuildContext context, String myUid, String theirUid) async {
  final batch = FirebaseFirestore.instance.batch();

  // 1. Reference to the encounter in your feed
  DocumentReference encounterRef = FirebaseFirestore.instance
      .collection('users').doc(myUid)
      .collection('met_people').doc(theirUid);

  // 2. Reference to your "Blocked" list
  DocumentReference blockRef = FirebaseFirestore.instance
      .collection('users').doc(myUid)
      .collection('blocked_users').doc(theirUid);

  batch.delete(encounterRef);
  batch.set(blockRef, {
    'blockedAt': FieldValue.serverTimestamp(),
    'uid': theirUid,
  });

  try {
    await batch.commit();
    if (context.mounted) {
      Navigator.pop(context); // Close the profile screen
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("User blocked and removed from feed.")),
      );
    }
  } catch (e) {
    debugPrint("Error blocking user: $e");
  }
}

  Future<void> _launchSocialUrl(String urlString) async {
    final Uri url = Uri.parse(urlString);
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(
          url,
          mode: LaunchMode.externalApplication,
        );
      } else {
        debugPrint("Could not launch $urlString");
      }
    } catch (e) {
      debugPrint("Error launching social: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    final String myUid = FirebaseAuth.instance.currentUser?.uid ?? "";

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance.collection('users').doc(theirUid).snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Scaffold(body: Center(child: CircularProgressIndicator()));

        final liveData = snapshot.data!.data() as Map<String, dynamic>?;
        if (liveData == null) return const Scaffold(body: Center(child: Text("User not found")));

        final String photoUrl = liveData['photoUrl'] ?? "";
        final String name = liveData['displayName'] ?? "Stranger";
        final String bio = liveData['bio'] ?? "No bio provided.";
        
        // Use updatedAt as a version for the cache key
        final Timestamp? lastUpdate = liveData['updatedAt'] as Timestamp?;
        final String cacheVersion = lastUpdate != null ? lastUpdate.millisecondsSinceEpoch.toString() : "1";

        return Scaffold(
          body: CustomScrollView(
            slivers: [
              _buildAppBar(name, photoUrl, theirUid, cacheVersion, context),
              SliverToBoxAdapter(
                child: Container(
                  padding: const EdgeInsets.all(24.0),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // --- Met Count Badge ---
                      Row(
                        children: [
                          const Icon(Icons.repeat, color: Colors.green, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            "Met ${metCount ?? 1} times",
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green, fontSize: 16),
                          ),
                        ],
                      ),
                      if (firstMet != null) ...[
  const SizedBox(height: 8),
  Row(
    children: [
      const Icon(Icons.calendar_today, color: Colors.grey, size: 16),
      const SizedBox(width: 8),
      Text(
        "First met on ${_formatDate(firstMet!)}",
        style: const TextStyle(color: Colors.grey, fontSize: 14),
      ),
    ],
  ),
],
                      const SizedBox(height: 20),
                      
                      const Text("Bio", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey)),
                      const SizedBox(height: 8),
                      Text(bio, style: const TextStyle(fontSize: 16, height: 1.5)),
                      const SizedBox(height: 30),

                      if (status == 'accepted') ...[
                        const Text("Social Links", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey)),
                        const SizedBox(height: 16),
                        _buildSocialGrid(liveData),
                      ] else ...[
                        _buildLockedView(context, myUid, theirUid, status),
                      ],
                      const SizedBox(height: 30),

                      if (lat != null && lng != null) ...[
                        const Text("Meeting Spot", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey)),
                        const SizedBox(height: 16),
                        _buildMeetingMap(),
                      ],
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAppBar(String name, String photoUrl, String uid, String version, BuildContext context) {
  final String myUid = FirebaseAuth.instance.currentUser?.uid ?? "";

  return SliverAppBar(
    expandedHeight: 400.0,
    pinned: true,
    actions: [
      PopupMenuButton<String>(
        icon: const Icon(Icons.more_vert, color: Colors.white),
        onSelected: (value) {
          if (value == 'block') {
            _showBlockConfirmation(context, myUid, uid);
          }
        },
        itemBuilder: (context) => [
          const PopupMenuItem(
            value: 'block',
            child: Text("Block & Remove", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    ],
    flexibleSpace: FlexibleSpaceBar(
      title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, shadows: [Shadow(blurRadius: 10, color: Colors.black)])),
      background: Hero(
        tag: 'profile_$uid',
        child: photoUrl.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: photoUrl,
                cacheKey: "$photoUrl?v=$version",
                fit: BoxFit.cover,
              )
            : Container(color: Colors.grey[300], child: const Icon(Icons.person, size: 100)),
      ),
    ),
  );
}

  Widget _buildLockedView(BuildContext context, String myUid, String theirUid, String status) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(20)),
      child: Column(
        children: [
          Icon(status == 'pending' ? Icons.hourglass_top : Icons.lock_outline, size: 40, color: Colors.grey),
          const SizedBox(height: 12),
          Text(status == 'pending' ? "Request Pending..." : "Socials are hidden", style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 20),
          if (status != 'pending')
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))),
              onPressed: () => _sendRequest(myUid, theirUid, context),
              child: const Text("SEND REVEAL REQUEST"),
            ),
        ],
      ),
    );
  }

  Widget _buildMeetingMap() {
    return GestureDetector(
      onTap: () => _openMapApp(lat!, lng!),
      child: Container(
        height: 120,
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [Colors.green.shade400, Colors.green.shade700]),
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Center(child: Text("Tap to view on Maps", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
      ),
    );
  }
void _showBlockConfirmation(BuildContext context, String myUid, String theirUid) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text("Block User?"),
      content: const Text("They will be removed from your feed and you will not see them again, even if you cross paths."),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
        TextButton(
          onPressed: () {
            Navigator.pop(context);
            _blockUser(context, myUid, theirUid);
          },
          child: const Text("Block", style: TextStyle(color: Colors.red)),
        ),
      ],
    ),
  );
}
  void _sendRequest(String myUid, String theirUid, BuildContext context) {
    FirebaseFirestore.instance
        .collection('users').doc(theirUid)
        .collection('requests').doc(myUid)
        .set({'status': 'pending', 'from': myUid}, SetOptions(merge: true));

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Reveal Request Sent!"), backgroundColor: Colors.green),
    );
  }

  Widget _buildSocialGrid(Map<String, dynamic> data) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        if (data['instagram'] != null && data['instagram'].toString().isNotEmpty)
          _miniSocial(FontAwesomeIcons.instagram, Colors.pink, "https://instagram.com/${data['instagram']}"),
        if (data['linkedin'] != null && data['linkedin'].toString().isNotEmpty)
          _miniSocial(FontAwesomeIcons.linkedin, Colors.blue, data['linkedin']),
        if (data['x_twitter'] != null && data['x_twitter'].toString().isNotEmpty)
          _miniSocial(FontAwesomeIcons.xTwitter, Colors.black, "https://x.com/${data['x_twitter']}"),
        if (data['facebook'] != null && data['facebook'].toString().isNotEmpty)
          _miniSocial(FontAwesomeIcons.facebook, const Color(0xFF1877F2), "https://facebook.com/${data['facebook']}"),
      ],
    );
  }

  Widget _miniSocial(IconData icon, Color color, String? url) {
    return GestureDetector(
      onTap: () {
        if (url != null && url.isNotEmpty) {
          _launchSocialUrl(url);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: color),
      ),
    );
  }

  Future<void> _openMapApp(double lat, double lng) async {
    final String googleMapsUrl = "https://www.google.com/maps/search/?api=1&query=$lat,$lng";
    if (await canLaunchUrl(Uri.parse(googleMapsUrl))) {
      await launchUrl(Uri.parse(googleMapsUrl), mode: LaunchMode.externalApplication);
    }
  }

String _formatDate(Timestamp timestamp) {
  DateTime date = timestamp.toDate();
  return DateFormat('MMMM d, y').format(date); // e.g., March 6, 2026
}
}