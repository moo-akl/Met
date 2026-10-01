require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoMetBle'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'UNLICENSED'
  s.author         = ''
  s.homepage       = 'n/a'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.swift_version  = '5.0'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Firebase Firestore + Auth are needed by MetBleModule.swift so the
  # native background scanner can write ble_detections docs and verify
  # the user is authenticated before writing. These pods are already
  # present in the project via @react-native-firebase/firestore and
  # @react-native-firebase/auth; declaring the dependency here tells
  # CocoaPods to link them to the ExpoMetBle target so the Swift
  # `import FirebaseFirestore` and `import FirebaseAuth` statements
  # resolve at compile time. Without this, EAS iOS builds fail with
  # "No such module 'FirebaseFirestore'".
  s.dependency 'FirebaseFirestore'
  s.dependency 'FirebaseAuth'

  # Swift/Objective-C compatibility flags shared by every Expo module.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
