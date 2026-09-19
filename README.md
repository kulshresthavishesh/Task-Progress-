# TaskProgress

Plan your tasks for each day, check them off, and TaskProgress calculates your progress
(`completed ÷ total × 100`) and tracks it by day, month and year.

**Stack:** HTML, CSS and vanilla JavaScript on the frontend. Node.js, Express, MongoDB (Mongoose), JWT and bcrypt on the backend.
Chart.js (from a CDN) is the only frontend library, used for the graphs.

## Project structure

```
task-progress/
├── .gitignore
├── README.md
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js              starts Express, connects to MongoDB, serves the API and the frontend
│   ├── models/
│   │   ├── User.js
│   │   └── Task.js
│   ├── middleware/
│   │   └── auth.js            JWT check for private routes
│   ├── routes/
│   │   ├── auth.js            register, login, me, profile, password
│   │   ├── tasks.js           task CRUD + toggle
│   │   └── analytics.js       day / month / year / streak
│   └── utils/
│       ├── asyncHandler.js
│       ├── dates.js           date, percentage and streak maths
│       └── dates.test.js      npm test
└── frontend/
    ├── index.html  login.html  register.html
    ├── dashboard.html  tasks.html  calendar.html  analytics.html  settings.html
    ├── css/style.css
    └── js/
        ├── theme.js           applies the saved theme before the page paints
        ├── common.js          API helper, auth guard, dates, icons, toasts, sidebar
        ├── tasks.js           reusable task list + add/edit dialog
        ├── auth.js            login and register forms
        ├── dashboard.js  tasks-page.js  calendar.js  analytics.js  settings.js
```

## 1. Prerequisites

- Node.js 18 or newer (`node -v`)
- A free MongoDB Atlas account
- Git (only for the GitHub step)

## 2. MongoDB Atlas setup

1. Sign in at https://cloud.mongodb.com and create a free **M0** cluster.
2. **Database Access** → *Add New Database User* → choose a username and password (avoid special characters like `@`, `:` or `/` in the password, or URL-encode them).
3. **Network Access** → *Add IP Address* → *Add Current IP Address*. (For deployment you will also need `0.0.0.0/0`, see section 8.)
4. **Database** → *Connect* → *Drivers* → copy the connection string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`.
   Insert the database name before the `?`: `.../taskprogress?retryWrites=true&w=majority`.

Collections (`users`, `tasks`) and the `userId + date` index are created automatically the first time the app runs.

## 3. Install and configure (PowerShell)

```powershell
cd task-progress\backend
npm install
Copy-Item .env.example .env
```

Open `backend\.env` in VS Code and fill in:

```
PORT=5000
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/taskprogress?retryWrites=true&w=majority
JWT_SECRET=<a long random string>
JWT_EXPIRES_IN=7d
```

Generate a secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. Run it

```powershell
cd task-progress\backend
npm run dev        # auto-restarts on changes (nodemon)
# or
npm start          # plain node
```

You should see `MongoDB connected` and `TaskProgress running at http://localhost:5000`.

The backend also serves the `frontend` folder, so **open http://localhost:5000** in your browser. There is no separate frontend server to run and no CORS setup needed.

If you prefer VS Code Live Server for the frontend, change `API_BASE` at the top of `frontend/js/common.js` to `http://localhost:5000/api`.

Run the maths tests any time:

```powershell
npm test
```

## 5. Testing the API (PowerShell)

```powershell
$base = "http://localhost:5000/api"

# Register (returns a token)
$body = @{ name = "Test User"; email = "test@example.com"; password = "password123" } | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body $body
$h = @{ Authorization = "Bearer $($r.token)" }

# Current user
Invoke-RestMethod -Uri "$base/auth/me" -Headers $h

# Create a task
$t = @{ title = "Study Java"; category = "Study"; priority = "High"; date = "2026-09-19" } | ConvertTo-Json
$task = Invoke-RestMethod -Method Post -Uri "$base/tasks" -Headers $h -ContentType "application/json" -Body $t

# Tasks for a day
Invoke-RestMethod -Uri "$base/tasks/2026-09-19" -Headers $h

# Complete it
Invoke-RestMethod -Method Patch -Uri "$base/tasks/$($task.task._id)/toggle" -Headers $h -ContentType "application/json" -Body '{"completed":true}'

# Analytics
Invoke-RestMethod -Uri "$base/analytics/day/2026-09-19" -Headers $h
Invoke-RestMethod -Uri "$base/analytics/month/2026/9" -Headers $h
Invoke-RestMethod -Uri "$base/analytics/year/2026" -Headers $h
Invoke-RestMethod -Uri "$base/analytics/streak?today=2026-09-19" -Headers $h

# Security checks - each should return an error
Invoke-RestMethod -Uri "$base/tasks/2026-09-19"                                   # 401 no token
Invoke-RestMethod -Uri "$base/tasks/not-a-date" -Headers $h                       # 400 invalid date
Invoke-RestMethod -Method Delete -Uri "$base/tasks/123" -Headers $h               # 404 invalid id
```

To confirm users are isolated: register a second user and try to toggle or delete the first user's task id with the second token. You will get `404 Task not found`.

## 6. API reference

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account, returns `{ token, user }` |
| POST | `/api/auth/login` | Log in, returns `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/profile` | Update name |
| PUT | `/api/auth/password` | Change password |
| POST | `/api/tasks` | Create task `{ title, category, priority, date }` |
| GET | `/api/tasks` | List tasks (optional `?from=&to=`) |
| GET | `/api/tasks/:date` | Tasks for one day, plus total, completed and progress |
| PUT | `/api/tasks/:id` | Edit title, category, priority or date |
| PATCH | `/api/tasks/:id/toggle` | Complete or uncomplete (`{ "completed": true }` optional) |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/analytics/day/:date` | Total, completed, remaining, progress |
| GET | `/api/analytics/month/:year/:month` | Month totals, best and worst day, one entry per day |
| GET | `/api/analytics/year/:year` | Year totals, best and worst month, 12 monthly entries |
| GET | `/api/analytics/streak?today=YYYY-MM-DD` | Current and longest streak |

## 7. How progress is calculated

- **Day:** `completed ÷ total × 100`, rounded. No tasks gives 0%, never NaN.
- **Month and year:** total completed ÷ total tasks in that period. Percentages are never averaged for this.
  Example: day 1 is 1/1 and day 2 is 1/10, so the month is 2/11 = 18%, not 55%.
- **Average daily progress** (monthly page) is shown separately and does average the daily percentages,
  because there every day deliberately counts equally.
- **Streak:** a day counts when at least one task is completed on it. The current streak stays alive
  if today has nothing completed yet but yesterday did. Dates are stored as `YYYY-MM-DD` strings, so
  timezones can't shift a task onto the wrong day.

## 8. Deployment (Render, free tier)

Because the backend serves the frontend, you deploy **one** service.

1. Push the project to GitHub (section 9).
2. In MongoDB Atlas → **Network Access**, add `0.0.0.0/0` (Render's IPs change).
3. At https://render.com → **New → Web Service** → connect your GitHub repo.
4. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables: `MONGO_URI`, `JWT_SECRET` (a new, long secret), `JWT_EXPIRES_IN=7d`. Render sets `PORT` itself.
6. Deploy, then open the `https://<your-service>.onrender.com` URL.

The free tier sleeps after inactivity, so the first request can take about 30 seconds.
Railway, Fly.io or any Node host work the same way: root `backend`, start `npm start`, same environment variables.

## 9. GitHub setup

```powershell
cd task-progress
git init
git add .
git commit -m "Initial commit: TaskProgress"
git branch -M main
```

Create an empty repository on https://github.com/new (no README), then:

```powershell
git remote add origin https://github.com/<your-username>/task-progress.git
git push -u origin main
```

`.gitignore` already excludes `node_modules` and `.env`. Before pushing, run `git status` and make sure `.env` is not listed.
If you ever commit a real secret by mistake, rotate the MongoDB password and `JWT_SECRET`.

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `MongoDB connection failed` | Check the password, that the URI includes `/taskprogress`, and that your IP is allowed in Atlas Network Access |
| `Missing MONGO_URI or JWT_SECRET` | You didn't create `backend\.env` (`Copy-Item .env.example .env`) |
| `npm install` fails on `bcrypt` | Use Node 18 or 20 LTS; delete `node_modules` and run `npm install` again |
| Blank charts | Chart.js loads from cdnjs, so check your internet connection |
| Page can't reach the API | Open the app at `http://localhost:5000`, not by double-clicking the HTML files |
