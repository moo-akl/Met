import 'package:Met/main.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LoadingScreen extends StatefulWidget {
  const LoadingScreen({super.key});

  @override
  State<LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<LoadingScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();

    // 1. FIXED: Initialize the animation controller for the rotating radar
    _controller = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(); // This starts the rotation immediately

    // 2. Check for the location disclosure after the first frame is drawn
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkDisclosure();
    });
  }

  @override
  void dispose() {
    _controller.dispose(); // Always dispose controllers to prevent memory leaks
    super.dispose();
  }

  // --- DISCLOSURE LOGIC ---
  Future<void> _checkDisclosure() async {
    final prefs = await SharedPreferences.getInstance();
    
    // Check if they've already accepted the disclosure in the past
    bool hasAcceptedDisclosure = prefs.getBool('location_disclosure_accepted') ?? false;
    
    // Check the actual OS permission status
    var status = await Permission.location.status;

    // FIXED: Only show if they haven't accepted it AND don't have the permission yet
    if (!hasAcceptedDisclosure && !status.isGranted) {
      if (mounted) _showLocationDisclosure();
    }
  }

  void _showLocationDisclosure() {
    showDialog(
      context: context,
      barrierDismissible: false, // User must interact
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Location Usage"),
        content: const Text(
          "This app collects location data to enable finding people you've encountered nearby, "
          "even when the app is closed or not in use. This data is used solely to match you "
          "with others you've physically met."
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Not Now"),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kMetGreen,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              // Request the actual System Permission
              PermissionStatus status = await Permission.location.request();
              
              if (status.isGranted) {
                final prefs = await SharedPreferences.getInstance();
                // SAVE the fact that they accepted so it doesn't show again
                await prefs.setBool('location_disclosure_accepted', true);
                if (context.mounted) Navigator.pop(context);
              }
            },
            child: const Text("Accept & Continue"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // The radar icon will now rotate correctly without crashing
            RotationTransition(
              turns: _controller,
              child: const Icon(Icons.radar, size: 90, color: kMetGreen),
            ),
            const SizedBox(height: 24),
            const Text(
              "Syncing with Met...", 
              style: TextStyle(color: kMetGreen, fontWeight: FontWeight.bold)
            ),
          ],
        ),
      ),
    );
  }
}