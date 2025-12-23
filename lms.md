# lms.md

## Application structure

- `lms/` - Main LMS module (74+ DocTypes)
- `job/` - Job opportunities module (3 DocTypes)
- `www/` - Web routes
- `templates/` - Jinja2 templates
- `frontend/` - Vue.js SPA

## Key concepts

- Course - Main learning content
- Chapter - Course sections
- Lesson - Individual learning units
- Batch - Group of students
- Live Class - Scheduled live sessions
- Quiz - Assessment questions
- Certificate - Course completion certificates

## Key DocTypes

- LMS Course, LMS Chapter, LMS Lesson
- LMS Batch, LMS Batch Student
- LMS Live Class, LMS Live Class Member
- LMS Quiz, LMS Quiz Question, LMS Quiz Result
- LMS Certificate, LMS Certificate Request
