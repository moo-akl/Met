import 'package:Met/main.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

class VerificationPendingScreen extends StatelessWidget {
  const VerificationPendingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Verify Your Email")),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(25.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.mark_email_read_outlined, size: 100, color: kMetGreen),
              const SizedBox(height: 24),
              const Text(
                "Check your inbox!",
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              const Text(
                "We sent a verification link to your email. Once you've clicked it, tap the button below to continue.",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kMetGreen,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () async {
                    // 1. Force refresh the user data from Firebase
                    await FirebaseAuth.instance.currentUser?.reload();
                    
                    // 2. Get the updated user object
                    final user = FirebaseAuth.instance.currentUser;

                    // 3. Check if they are now verified
                    if (user != null && user.emailVerified) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("Email verified! Logging you in..."),
                            backgroundColor: kMetGreen,
                          ),
                        );
                        // 4. Force the AuthWrapper to rebuild by navigating to the root
                        Navigator.of(context).pushNamedAndRemoveUntil('/auth', (route) => false);
                      }
                    } else {
                      // Still not verified
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("We couldn't verify your email yet. Please click the link in your inbox."),
                            backgroundColor: Colors.orange,
                          ),
                        );
                      }
                    }
                  },
                  child: const Text("I have verified"),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () async {
                  await FirebaseAuth.instance.currentUser?.sendEmailVerification();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Verification email resent!")),
                    );
                  }
                },
                child: const Text("Resend Email"),
              ),
              TextButton(
                onPressed: () => FirebaseAuth.instance.signOut(),
                child: const Text("Logout", style: TextStyle(color: Colors.red)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}