# HomeSchool Management System

Netlify-ready static frontend with a real Supabase backend for three roles:

- Parent
- Tutor
- Student

## Included modules

- Secure login / registration
- Role-based dashboards
- Child linking for parents
- Classroom and learner linking for tutors
- Assignment creation and student submission
- Assessments
- Attendance
- Portfolio uploads
- Resources
- Lesson plans
- Report cards
- Messaging
- Settings

## Pages included

### Shared
- `/index.html`
- `/login.html`
- `/register.html`

### Parent
- `/parent/dashboard.html`
- `/parent/children.html`
- `/parent/assignments.html`
- `/parent/assessments.html`
- `/parent/portfolio.html`
- `/parent/attendance.html`
- `/parent/report-cards.html`
- `/parent/resources.html`
- `/parent/messages.html`
- `/parent/settings.html`

### Tutor
- `/tutor/dashboard.html`
- `/tutor/learners.html`
- `/tutor/classrooms.html`
- `/tutor/assignments.html`
- `/tutor/assessments.html`
- `/tutor/portfolios.html`
- `/tutor/attendance.html`
- `/tutor/report-cards.html`
- `/tutor/lesson-plans.html`
- `/tutor/resources.html`
- `/tutor/messages.html`
- `/tutor/settings.html`

### Student
- `/student/dashboard.html`
- `/student/assignments.html`
- `/student/assessments.html`
- `/student/portfolio.html`
- `/student/attendance.html`
- `/student/report-card.html`
- `/student/resources.html`
- `/student/messages.html`
- `/student/settings.html`

## Supabase setup

1. Create a new Supabase project.
2. Open the SQL editor and run `sql/schema.sql`.
3. Copy `assets/js/config.example.js` to `assets/js/config.js`.
4. Add your project URL and anon key inside `assets/js/config.js`.
5. In Authentication settings, keep Email sign-in enabled.
6. Deploy the folder to Netlify.

## Netlify deployment

1. Zip the project folder.
2. In Netlify, choose **Add new site**.
3. Drag and drop the zip contents or connect a repo.
4. No build command is required.
5. Publish directory: root folder.

## Important note

This package uses a real database, but you must provide your own Supabase project keys before deployment.
