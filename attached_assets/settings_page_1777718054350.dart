import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _isVisible = true;
  String _userEmail = "";

  @override
  void initState() {
    super.initState();
    _loadUserSettings();
  }

  Future<void> _loadUserSettings() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      setState(() => _userEmail = user.email ?? "No Email Found");
      try {
        final doc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get()
            .timeout(const Duration(seconds: 5));
            
        if (mounted && doc.exists) {
          setState(() => _isVisible = doc.data()?['isVisible'] ?? true);
        }
      } catch (e) {
        debugPrint("Firebase Connection Failed: $e");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Settings")),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            ListTile(
              title: const Text("Account"),
              subtitle: Text(_userEmail),
              leading: const Icon(Icons.person),
            ),
            const Divider(),
            
            SwitchListTile(
              title: const Text("Visible on Radar"),
              subtitle: const Text("Allow others to see your profile when nearby"),
              value: _isVisible,
              onChanged: (val) {
                setState(() => _isVisible = val);
                FirebaseFirestore.instance
                    .collection('users')
                    .doc(FirebaseAuth.instance.currentUser?.uid)
                    .update({'isVisible': val}).catchError((e) => debugPrint(e.toString()));
              },
            ),

            // --- BLOCKED USERS SECTION ---
            ListTile(
              leading: const Icon(Icons.block, color: Colors.orange),
              title: const Text("Blocked Users"),
              subtitle: const Text("Manage people you've hidden"),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const BlockedUsersPage()),
                );
              },
            ),
            
            const SizedBox(height: 50),

            ListTile(
              leading: const Icon(Icons.logout, color: Colors.blueGrey),
              title: const Text("Logout"),
              onTap: () async {
                await FirebaseAuth.instance.signOut();
                Navigator.of(context).pushNamedAndRemoveUntil('/auth', (route) => false);
              },
            ),

            const SizedBox(height: 50),

            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red[50],
                foregroundColor: Colors.red,
                side: const BorderSide(color: Colors.red),
                minimumSize: const Size(double.infinity, 60),
              ),
              icon: const Icon(Icons.delete_forever),
              label: const Text("DELETE ACCOUNT", style: TextStyle(fontWeight: FontWeight.bold)),
              onPressed: () => _handleDeleteAccount(),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleDeleteAccount() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    
    bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Confirm Delete"),
        content: const Text("Are you sure? This is permanent."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("Cancel")),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text("DELETE", style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirm == true) {
       try {
         await FirebaseFirestore.instance.collection('users').doc(user.uid).delete();
         await user.delete();
         await FirebaseAuth.instance.signOut();
         if (mounted) Navigator.of(context).pushNamedAndRemoveUntil('/auth', (route) => false);
       } catch (e) {
         ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: $e")));
       }
    }
  }
}

// --- NEW BLOCKED USERS PAGE ---
class BlockedUsersPage extends StatelessWidget {
  const BlockedUsersPage({super.key});

  @override
  Widget build(BuildContext context) {
    final String myUid = FirebaseAuth.instance.currentUser?.uid ?? "";

    return Scaffold(
      appBar: AppBar(title: const Text("Blocked Users")),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('users')
            .doc(myUid)
            .collection('blocked_users')
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return const Center(child: Text("Something went wrong"));
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.data!.docs.isEmpty) {
            return const Center(
              child: Text("You haven't blocked anyone yet.", style: TextStyle(color: Colors.grey)),
            );
          }

          return ListView.builder(
            itemCount: snapshot.data!.docs.length,
            itemBuilder: (context, index) {
              String blockedUid = snapshot.data!.docs[index].id;

              return FutureBuilder<DocumentSnapshot>(
                future: FirebaseFirestore.instance.collection('users').doc(blockedUid).get(),
                builder: (context, userSnap) {
                  // While waiting for the individual user's name/photo
                  if (!userSnap.hasData) return const ListTile(title: Text("Loading..."));

                  Map<String, dynamic> data = userSnap.data!.data() as Map<String, dynamic>? ?? {};
                  String name = data['displayName'] ?? "Unknown User";
                  String? photo = data['photoUrl'];

                  return ListTile(
                    leading: CircleAvatar(
                      backgroundImage: (photo != null && photo.isNotEmpty) ? NetworkImage(photo) : null,
                      child: (photo == null || photo.isEmpty) ? const Icon(Icons.person) : null,
                    ),
                    title: Text(name),
                    trailing: TextButton(
                      onPressed: () => _unblockUser(context, myUid, blockedUid),
                      child: const Text("Unblock"),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _unblockUser(BuildContext context, String myUid, String theirUid) async {
    await FirebaseFirestore.instance
        .collection('users')
        .doc(myUid)
        .collection('blocked_users')
        .doc(theirUid)
        .delete();
    
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("User unblocked")),
      );
    }
  }
}