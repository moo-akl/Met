
import 'dart:io';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:Met/main.dart';
import 'package:Met/screens/settings_page.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:qr_flutter/qr_flutter.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _nameController = TextEditingController();
  final _bioController = TextEditingController();
  final _instaController = TextEditingController();
  final _xController = TextEditingController();
  final _linkedinController = TextEditingController();
  final _fbController = TextEditingController();

  String? _photoUrl;
  File? _imageFile;
  bool _isLoading = false;
  bool _isEditing = false;
  bool _isVisible = true;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    final doc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
    if (doc.exists && mounted) {
      final data = doc.data();
      setState(() {
        _nameController.text = data?['displayName'] ?? "";
        _bioController.text = data?['bio'] ?? "";
        _instaController.text = data?['instagram'] ?? "";
        _xController.text = data?['x_twitter'] ?? "";
        _linkedinController.text = data?['linkedin'] ?? "";
        _fbController.text = data?['facebook'] ?? "";
        _isVisible = data?['isVisible'] ?? true;
        _photoUrl = data?['photoUrl'];
      });
    }
  }

  Future<void> _pickAndVerifyImage() async {
  final ImagePicker picker = ImagePicker();
  
  // 1. Pick the image
  final XFile? image = await picker.pickImage(source: ImageSource.gallery);
  if (image == null) return;

  setState(() => _isLoading = true);

  // 2. Prepare the image for ML Kit
  final inputImage = InputImage.fromFilePath(image.path);
  
  // 3. Initialize the Face Detector
  final faceDetector = FaceDetector(options: FaceDetectorOptions());

  try {
    // 4. Process the image
    final List<Face> faces = await faceDetector.processImage(inputImage);

    if (faces.isEmpty) {
      // NO FACE FOUND: Reject the photo
      if (mounted) {
        _showErrorDialog("No face detected! Please use a clear photo of yourself.");
      }
    } else if (faces.length > 1) {
      // TOO MANY FACES: Reject the photo
      if (mounted) {
        _showErrorDialog("Multiple faces detected. Please upload a photo of only yourself.");
      }
    } else {
      // SUCCESS: Exactly one face found. Proceed to upload.
      _imageFile = File(image.path);
      await _uploadProfilePicture(); // Your existing upload function
    }
  } catch (e) {
    debugPrint("ML Kit Error: $e");
  } finally {
    faceDetector.close();
    if (mounted) setState(() => _isLoading = false);
  }
}

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

  // Fixes: '_uploadProfilePicture' isn't defined
  // This handles sending the file to Firebase Storage
  Future<void> _uploadProfilePicture() async {
    if (_imageFile == null) return;
    
    setState(() => _isLoading = true);
    try {
      final uid = FirebaseAuth.instance.currentUser?.uid;
      final ref = FirebaseStorage.instance
          .ref()
          .child('user_profiles')
          .child('$uid.jpg');

      await ref.putFile(_imageFile!);
      final url = await ref.getDownloadURL();

      await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .update({'photoUrl': url});

      setState(() {
        _photoUrl = url;
        _isLoading = false;
      });
      
      _showSuccessSnackBar("Profile picture updated!");
    } catch (e) {
      setState(() => _isLoading = false);
      _showErrorDialog("Upload failed: $e");
    }
  }

  void _showSuccessSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  void _showQRCodeModal(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text("My Met Code", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            QrImageView(data: user.uid, version: QrVersions.auto, size: 200.0),
            const SizedBox(height: 20),
            TextButton(onPressed: () => Navigator.pop(context), child: const Text("Close")),
          ],
        ),
      ),
    );
  }

  Future<void> _updateProfile() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    setState(() => _isLoading = true);

    String? finalUrl = _photoUrl;
    if (_imageFile != null) {
      final ref = FirebaseStorage.instance.ref().child('users/${user.uid}/profile.jpg');
      await ref.putFile(_imageFile!);
      finalUrl = await ref.getDownloadURL();
    }

    await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
      'displayName': _nameController.text.trim(),
      'bio': _bioController.text.trim(),
      'instagram': _instaController.text.trim(),
      'x_twitter': _xController.text.trim(),
      'linkedin': _linkedinController.text.trim(),
      'facebook': _fbController.text.trim(),
      'isVisible': _isVisible,
      'photoUrl': finalUrl,
    }, SetOptions(merge: true));

    setState(() {
      _isEditing = false;
      _photoUrl = finalUrl;
      _imageFile = null;
      _isLoading = false;
    });
  }

  Widget _buildSocialInput({required TextEditingController controller, required IconData icon, required String label}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: kMetGreen),
          labelText: "$label (optional)",
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("My Profile"),
        actions: [
          IconButton(icon: const Icon(Icons.qr_code_2), onPressed: () => _showQRCodeModal(context)),
          IconButton(icon: const Icon(Icons.settings), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (context) => const SettingsPage()))),
        ],
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator()) : SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Stack(
  children: [
    // The Main Profile Photo
    CircleAvatar(
      radius: 65,
      backgroundColor: Colors.grey[200],
      child: ClipOval(
        child: _imageFile != null
            // 1. If you just picked a photo, show the local file instantly
            ? Image.asset(
                _imageFile!.path, 
                width: 130, 
                height: 130, 
                fit: BoxFit.cover
              )
            : _photoUrl != null
                // 2. If no new photo is picked, use the Fast Cached Network Image
                ? CachedNetworkImage(
                    imageUrl: _photoUrl!,
                    width: 130,
                    height: 130,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => const CircularProgressIndicator(strokeWidth: 2),
                    errorWidget: (context, url, error) => const Icon(Icons.person, size: 65),
                  )
                // 3. Fallback if both are null
                : const Icon(Icons.person, size: 65, color: Colors.grey),
      ),
    ),
    
    // The Edit Camera Icon
    if (_isEditing)
      Positioned(
        bottom: 0,
        right: 0,
        child: GestureDetector(
          onTap: _pickAndVerifyImage,
          child: const CircleAvatar(
            backgroundColor: kMetGreen,
            radius: 20,
            child: Icon(Icons.camera_alt, color: Colors.white, size: 20),
          ),
        ),
      ),
  ],
),
            const SizedBox(height: 20),
            if (_isEditing) ...[
              TextField(controller: _nameController, decoration: const InputDecoration(labelText: "Name")),
              TextField(controller: _bioController, decoration: const InputDecoration(labelText: "Bio")),
              const SizedBox(height: 20),
              _buildSocialInput(controller: _instaController, icon: FontAwesomeIcons.instagram, label: "Instagram"),
              _buildSocialInput(controller: _linkedinController, icon: FontAwesomeIcons.linkedin, label: "LinkedIn"),
              _buildSocialInput(controller: _xController, icon: FontAwesomeIcons.xTwitter, label: "X"),
              _buildSocialInput(controller: _fbController, icon: FontAwesomeIcons.facebook, label: "Facebook"),
              const SizedBox(height: 20),
              SizedBox(width: double.infinity, child: ElevatedButton(onPressed: _updateProfile, child: const Text("Save Changes"))),
            ] else ...[
              Text(_nameController.text.isEmpty ? "No Name" : _nameController.text, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
              Text(_bioController.text),
              const Divider(),
              buildSocialButton(_instaController.text, FontAwesomeIcons.instagram, const Color(0xFFE4405F), "Instagram"),
              buildSocialButton(_linkedinController.text, FontAwesomeIcons.linkedin, const Color(0xFF0A66C2), "LinkedIn"),
              buildSocialButton(_xController.text, FontAwesomeIcons.xTwitter, Colors.black, "X"),
              buildSocialButton(_fbController.text, FontAwesomeIcons.facebook, const Color(0xFF1877F2), "Facebook"),
              const SizedBox(height: 30),
              SizedBox(width: double.infinity, child: ElevatedButton(onPressed: () => setState(() => _isEditing = true), child: const Text("Edit Profile"))),
            ]
          ],
        ),
      ),
    );
  }
}
