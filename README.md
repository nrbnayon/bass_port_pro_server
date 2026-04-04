# QuickHire Job Board API

This is the backend RESTful API built with Node.js, Express, and MongoDB for the QuickHire application.

## 🚀 Features
- **Jobs API**: Full CRUD (Create, Read, Update, Delete) for handling job listings.
- **Advanced Filtering**: Enables robust frontend search through category, location, job type matches, and raw text queries.
- **Dynamic Pagination**: Structured metadata in responses returning items and total pages.
- **Applications API**: Validate and store job applications securely.
- **Validation**: Strict schema validation using Zod for requests and Mongoose for atomic DB constraints.

## 🛠 Prerequisites
- Node.js (v18+)
- MongoDB connection string (provided via `.env`)

## ⚙️ Installation

1. Install all dependencies:
```bash
npm install
```

2. Make sure your `.env` file is present in the `backend` root folder:
```
PORT=5000
DATABASE_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/aski-db?retryWrites=true&w=majority
```

## 🚗 Running the API

Start the backend standard server:
```bash
node server.js
```

Or run via `nodemon` if you have it installed globally for hot-reloading:
```bash
npx nodemon server.js
```

The server will automatically boot up on `http://localhost:5000`.

## 📡 Endpoints Overview

### Jobs
* `GET /api/jobs`: Fetches all jobs.
  * *Query params:* `page`, `limit`, `category`, `type`, `location`, `search`, `featured`
* `GET /api/jobs/:id`: Fetch a single job by its ID.
* `POST /api/jobs`: Create a new job listing.
* `PUT /api/jobs/:id`: Update an existing job. 
* `DELETE /api/jobs/:id`: Remove a job.

### Applications
* `POST /api/applications`: Submit a candidate's job application. 
* `GET /api/applications`: Get applications list (Admin).

## 🧰 Tech Stack
- Express.js
- Mongoose
- Zod
- Cors
- dotenv
