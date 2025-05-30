# Personal Score Board

A web-based score board application that allows you to track points with reasons for each score change, backed by MongoDB Atlas for cloud storage.

## Features

- Add or subtract scores with custom reasons
- Save reasons as reusable cards for quick access
- Edit existing reason cards
- View complete history of score changes
- Undo specific score changes from the history
- Reset the score to any specific value
- Cloud synchronization with MongoDB Atlas
- Access your score board from any device using your unique Sync ID
- Responsive design that works on mobile devices

## Setup

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Set up a free cluster and get your connection string
3. Clone this repository
4. Create a `.env` file based on the provided `.env.example` with your MongoDB URI
5. Install dependencies:
   ```
   npm install
   ```
6. Start the server:
   ```
   npm start
   ```
7. Access the application at `http://localhost:3000`

## MongoDB Atlas Setup Guide

1. Sign up for a free MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new project
3. Build a new cluster (the free tier is sufficient)
4. Once your cluster is created, click "Connect"
5. Choose "Connect your application"
6. Select "Node.js" as the driver and copy the connection string
7. In your connection string, replace `<username>`, `<password>`, and `<dbname>` with your MongoDB Atlas username, password, and database name
8. Create a `.env` file in the root of the project with the following:
   ```
   MONGODB_URI=your_connection_string_here
   PORT=3000
   ```

## Usage

### Basic Use
1. Open the application in your web browser
2. Add new reasons with their associated score values
3. Click on a reason card to select it
4. Use the "Add Score" or "Subtract Score" buttons to update the score
5. View the history of all score changes in the table below

### Reset Score
- Use the reset feature to set your score to any specific value
- Enter the desired score in the input field below the current score
- Click the "Reset" button
- This will be recorded in your history as a "Manual reset"

### Cloud Sync
- Your score board automatically syncs with MongoDB Atlas every 30 seconds
- The sync status is displayed in the top right corner
- Your unique Sync ID is shown - use this ID to access your score board from another device
- You can toggle offline mode if needed, but changes won't be saved to the cloud while offline

### Undoing Actions
- In the history table, each entry has an "Undo" button
- Click this button to reverse that specific score change

## Technical Details
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: MongoDB Atlas
- Uses sessionStorage to maintain your Sync ID during browser sessions