import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class EncounterMapScreen extends StatelessWidget {
  final GeoPoint location;
  final String name;

  const EncounterMapScreen({
    super.key, 
    required this.location, 
    required this.name
  });

  @override
  Widget build(BuildContext context) {
    final LatLng position = LatLng(location.latitude, location.longitude);

    return Scaffold(
      appBar: AppBar(title: Text("Met $name here")),
      body: GoogleMap(
        initialCameraPosition: CameraPosition(
          target: position,
          zoom: 16.0,
        ),
        markers: {
          Marker(
            markerId: const MarkerId('met_loc'),
            position: position,
            infoWindow: InfoWindow(title: "Encounter Location"),
          ),
        },
      ),
    );
  }
}