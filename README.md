# HomeSchool Firebase Netlify System

This package is a **real Firebase-based starter system** for a homeschool management platform with three roles:

- Parent
- Tutor
- Student

## Exact backend stack used

- **Authentication:** Firebase Authentication (Email/Password)
- **Database:** Cloud Firestore
- **File uploads:** Firebase Storage
- **Hosting:** Netlify

This project is **not** using Supabase.
This project is **not** using Firebase Realtime Database.
It uses **Cloud Firestore**.

## Main role responsibilities

### Tutor
The tutor is responsible for:
- uploading learning materials
- creating assignments
- creating assessments
- creating lesson plans
- recording attendance
- preparing report summaries

### Student
The student can:
- log in
- view assignments
- upload completed work
- see assessments
- access tutor resources
- upload portfolio work

### Parent
The parent can:
- log in
- add/manage child profiles
- monitor assignment progress
- see attendance
- see assessments
- review portfolio evidence
- view report cards

## Before deployment

1. Create a Firebase project
2. Add a Web App
3. Copy web config into `assets/js/firebase-config.js`
4. Enable Authentication (email/password)
5. Create Cloud Firestore
6. Create Firebase Storage
7. Optionally paste the included rules
8. Deploy to Netlify

## Important note about real account creation

This starter includes public registration for all roles.  
In a stricter production setup, you may want:
- tutors created manually
- students created only by parent/tutor invitation
- role claims managed by Cloud Functions

This version keeps setup simpler while still using real Firebase services.

## Files

- `docs/firebase-setup.html` → step-by-step setup page
- `docs/firestore.rules.txt` → suggested Firestore rules
- `docs/storage.rules.txt` → suggested Storage rules
- `assets/js/firebase-config.sample.js` → copy into real config

## Netlify

No build process is needed.  
Just deploy the folder as a static site.


## New collections used in this version
- `activityLogs` for daily tutor notes, highs, lows, behaviour, character growth, and support steps
- `classrooms` and `classroomMembers` for learner grouping
- `submissions` with review fields: `status`, `grade`, `feedback`, `reviewNotes`, `reviewedAt`, `reviewedBy`

## Tutor review workflow
1. Tutor opens **Review Work**
2. Selects a learner submission
3. Adds grade, feedback, and review notes
4. Marks it as **Reviewed** or **Needs Revision**
5. Student can see the updated status, grade, and feedback immediately from their portal
