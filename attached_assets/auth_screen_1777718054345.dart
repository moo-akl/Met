import 'package:Met/screens/loading_screen.dart';
import 'package:Met/screens/main_navigation_page.dart';
import 'package:Met/screens/verification_pending_screen.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';


// Ensure this matches your actual color definition file
// If kMetGreen is defined in main.dart, use: import 'main.dart';
const Color kMetGreen = Color(0xFF2E7D32); 

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _isLoginMode = true;
  
  // 1. ADD THIS VARIABLE: Tracks whether to hide or show password
  bool _obscurePassword = true;

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.error_outline, color: Colors.red),
            SizedBox(width: 10),
            Text("Error"),
          ],
        ),
        content: Text(message),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text("OK", style: TextStyle(color: kMetGreen, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _authenticate() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    
    if (email.isEmpty || password.isEmpty) {
      _showErrorDialog("Please fill in all fields.");
      return;
    }
    
    setState(() => _isLoading = true);
    try {
      if (_isLoginMode) {
        await FirebaseAuth.instance.signInWithEmailAndPassword(
          email: email, 
          password: password
        );
      } else {
        UserCredential userCredential = await FirebaseAuth.instance.createUserWithEmailAndPassword(
          email: email, 
          password: password
        );
        
        await userCredential.user?.sendEmailVerification();
        
        if (mounted) {
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text("Verify your email"),
              content: const Text("A verification link has been sent to your email. Please verify your account before logging in."),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text("OK")),
              ],
            ),
          );
          setState(() => _isLoginMode = true);
        }
      }
    } catch (e) {
      _showErrorDialog("Please check your email and password.");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleForgotPassword() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      _showErrorDialog("Please enter your email address first.");
      return;
    }
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text("Reset Email Sent"),
            content: Text("A password reset link has been sent to $email. Please check your spam folder if you don't see it."),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text("OK")),
            ],
          ),
        );
      }
    } on FirebaseAuthException catch (_) {
      _showErrorDialog("Please check your email address and password.");
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 30.0, vertical: 20.0),
            child: Column(
              children: [
                const Icon(Icons.radar, size: 100, color: kMetGreen),
                const Text(
                  "Met", 
                  style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: kMetGreen)
                ),
                const SizedBox(height: 40),
                
                TextField(
                  controller: _emailController, 
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: "Email", 
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.email),
                  )
                ),
                const SizedBox(height: 15),
                
                // 2. UPDATED PASSWORD FIELD
                TextField(
                  controller: _passwordController, 
                  obscureText: _obscurePassword, // Use the variable here
                  decoration: InputDecoration(
                    labelText: "Password", 
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock),
                    // Add the toggle button here
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off : Icons.visibility,
                        color: Colors.grey,
                      ),
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                    ),
                  )
                ),
                
                if (_isLoginMode)
                  Container(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero, 
                        minimumSize: const Size(50, 30),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: _handleForgotPassword,
                      child: const Text(
                        "Forgot Password?", 
                        style: TextStyle(color: kMetGreen, fontWeight: FontWeight.bold)
                      ),
                    ),
                  ),
                  
                const SizedBox(height: 25),
                
                if (_isLoading) 
                  const CircularProgressIndicator() 
                else ...[
                  SizedBox(
                    width: double.infinity, 
                    height: 50, 
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kMetGreen,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _authenticate, 
                      child: Text(_isLoginMode ? "Login" : "Sign Up")
                    )
                  ),
                  const SizedBox(height: 15),
                  
                  TextButton(
                    onPressed: () => setState(() => _isLoginMode = !_isLoginMode), 
                    child: Text(
                      _isLoginMode 
                        ? "Don't have an account? Create one" 
                        : "Already have an account? Login"
                    ),
                  ),
                ]
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Create this helper widget to handle the Auth logic cleanly
class AuthWrapper extends StatelessWidget {
  final bool showOnboarding;
  
  // Accept showOnboarding from your main.dart logic
  const AuthWrapper({super.key, required this.showOnboarding});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      // Listens to the user's login state
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        
        // 1. FAST STARTUP:
        // While checking the connection, show a blank white screen.
        // This makes the transition from the phone's splash screen feel seamless.
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(backgroundColor: Colors.white);
        }
        
        final user = snapshot.data;

        // 2. USER IS LOGGED IN
        if (user != null) {
          // Check if they have verified their email address
          if (user.emailVerified) {
            return const MainNavigationPage();
          } else {
            // User exists but hasn't clicked the verification link yet
            return const VerificationPendingScreen();
          }
        }
        
        // 3. NO USER FOUND
        // If showOnboarding is true, show the tutorial. Otherwise, go to Login.
        return showOnboarding ? const LoadingScreen() : const AuthScreen();
      },
    );
  }
}
