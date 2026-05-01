# App Store Connect — Resolution Center Reply

**Submission:** 537e45b6-4512-484e-b837-d6238a11b393 (Build #11)
**New build for review:** Build #12 (uploaded)
**App:** Met: We Crossed Paths (ASC App ID 6764364926)

---

Hello App Review Team,

Thank you for the detailed feedback on Build #11. We have addressed every point and uploaded **Build #12** which is ready for review. Please find our point-by-point response below.

---

## Guideline 5.1.2(i) — Data Use and Sharing

We want to clarify how Met handles user data, since we believe the previous review may have assumed Met displays a real-time location map of other users. **It does not.**

- Met **never displays a map** of other users and **never shows any user's real-time location** to anyone else.
- The app records anonymous Bluetooth proximity events on-device. These are surfaced to the user only as a list of past "encounters" (people they crossed paths with), with **no GPS coordinates, no addresses, and no map view** anywhere in the app.
- A user's profile is only revealed to another user **after both users mutually consent** to connect.
- We have removed any UI element that could be misread as a location map. There is no MapView, no MKMapView, and no third-party map SDK in the binary.
- Data collection is fully disclosed in our Privacy Policy: https://met-app.flycricket.io/privacy.html

## Guideline 1.1 — Objectionable Content

We have rewritten the App Store description to accurately and respectfully describe Met's purpose: a tool to help people reconnect with someone they briefly crossed paths with in real life (a coffee shop, a bookstore, a flight). The app is **not** a dating, hookup, or anonymous-meetup app, and the new description and screenshots reflect this clearly.

Safety controls already in the app:
- **Photo verification** during onboarding to deter fake profiles.
- **Block and report** controls available on every user profile and conversation.
- **Content moderation:** any reported content is reviewed and reported users can be removed within 24 hours via our backend.
- All connections require **mutual consent** before any contact information or messaging is unlocked.

## Guideline 1.2 — Safety / User-Generated Content (EULA + UGC controls)

In Build #12, we have implemented all four required UGC safeguards from Guideline 1.2:

1. **EULA acceptance is now mandatory** before account creation. The onboarding screen presents an explicit checkbox the user must tick (with links to our Terms and Privacy Policy) before any of the auth buttons (Apple, Google, Email) can be used. If the box is unchecked, the auth buttons are disabled and an inline message asks the user to accept the terms.
   - Terms: https://met-app.flycricket.io/terms.html
   - Privacy: https://met-app.flycricket.io/privacy.html
   - We use Apple's standard EULA: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
2. **Filter for objectionable content** — photos go through automated checks during verification.
3. **Block / report** — users can block and report other users from any profile or conversation, with reports queued for moderator review.
4. **Action within 24h** — our moderation team reviews reports daily and removes offending content or users within 24 hours.

---

## Demo Account for Review

Please use the following test account to review the full app, including the EULA gate, the encounter list, and the connection flow:

- **Email:** metapp.contact@gmail.com
- **Password:** testapp

### Suggested test steps

1. Launch the app on a fresh install.
2. On the onboarding screen, attempt to tap **Continue with Apple / Google / Email** without ticking the terms checkbox — you will see the buttons remain disabled and an inline message appear.
3. Tick the terms checkbox; the auth buttons become enabled.
4. Sign in with the demo account credentials above (use the **Email** option).
5. Open the **Recent** tab to see the welcome empty state shown to all new users.
6. Open the **Connections** tab to see the welcome empty state.
7. Open any encounter to see the block / report controls available on each profile.

---

We are committed to running a safe, respectful experience and are happy to provide any further information the team needs. Thank you again for your time and guidance.

Sincerely,
The Met team
