# Recruitment Strategic Dashboard

A live, boardroom-ready recruitment analytics dashboard for FY 2025–26. It pulls data in real time from Google Sheets (published as CSV) and visualises the full hiring pipeline, source efficiency, business unit performance, recruiter metrics, and vacancy tracking.

## Tech Stack

- **Framework**: TanStack Start (React, Vite)
- **Styling**: Custom CSS design system (amber/teal/warm palette, Playfair Display + DM Sans fonts)
- **Charts**: Chart.js via react-chartjs-2
- **Backend**: Netlify Serverless Function (`dashboard-data`) that fetches, parses, and processes CSV data
- **Hosting**: Netlify

## Running Locally

```bash
npm install
netlify dev
```

The app runs at `http://localhost:8888` (Netlify Dev proxies the function at `/.netlify/functions/dashboard-data`).

## Data Sources

Two Google Sheets published as CSV:
- **Applicants**: candidate pipeline data (status, source, BU, recruiter, position, date)
- **Vacancies**: open positions with status tracking

On first load, a dialog lets you confirm or override the CSV URLs. The dashboard auto-refreshes every 5 minutes.
