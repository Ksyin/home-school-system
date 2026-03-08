
Firebase Secure Setup

1. Create Firebase project
2. Enable Authentication (Email/Password)
3. Create Firestore database
4. Upload firestore.rules from firebase/firestore.rules
5. Replace firebase-config.js with your config
6. Deploy folder to Netlify

Security Model

Students:
- can read only their own assignments, submissions, activity logs

Parents:
- can read only documents where parentId == their UID

Tutors:
- can create classrooms, assignments, and activity logs
- manage students linked to their classrooms
