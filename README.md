# Personal Score Board

A web-based score board application that allows you to track points with reasons for each score change, backed by MongoDB Atlas for cloud storage.

## Features

- Create multiple password-protected score boards with custom IDs
- Add and subtract scores with reasons that have dedicated action buttons 
- Drag and rearrange reason cards to organize them as you prefer
- View complete history of all score changes
- Undo specific score changes directly from the history
- Reset the score to any specific value
- Cloud synchronization with MongoDB Atlas
- Secure password protection for each board
- Ability to change board passwords
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

### Creating and Accessing Boards
1. Create a new board by providing a unique Board ID and password
2. Access existing boards using their ID and password
3. The app shows a list of available boards for easy access

### Managing Reasons
1. Add new reasons with a description, score value, and type (add or subtract)
2. Each reason card has a dedicated button for its action (either add or subtract)
3. Drag and drop reasons to rearrange them in any order you prefer
4. Edit reasons to change their text, score value, or type

### Score Management
1. Click the action button on any reason card to update the score
2. View the complete history of all score changes in the table
3. Use the undo button next to any history entry to reverse that change
4. Reset the score to any specific value using the reset feature

### Board Security
1. Each board is password protected
2. Change your board's password using the "Change Password" button
3. Password confirmation is required to delete a board
4. Automatic cloud synchronization with your MongoDB Atlas database

### Offline Support
- The app automatically detects network issues and shows appropriate status messages
- Changes made while offline will sync when connection is restored

## Technical Details
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: MongoDB Atlas
- Passwords are securely hashed before storage
- Uses sessionStorage to maintain your login session during browser sessions
- Drag and drop using the HTML5 Drag and Drop API
- Responsive design for both desktop and mobile devices