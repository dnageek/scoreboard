# Personal Score Board

A comprehensive web-based score board application that allows you to track points with reasons for each score change, complete with advanced analytics and visualizations, backed by MongoDB Atlas for cloud storage.

## Features

### Core Functionality
- Create multiple password-protected score boards with custom IDs
- Add and subtract scores with reasons that have dedicated action buttons 
- Drag and rearrange reason cards to organize them as you prefer
- View complete history of all score changes with pagination (10 entries per page)
- Undo specific score changes directly from the history
- Reset the score to any specific value
- Random card selection feature with visual highlighting

### Advanced Analytics & Statistics
- **Score Trends Over Time**: Interactive line chart showing your score progression
- **Activity Analysis**: Stacked bar chart displaying daily positive vs negative activities
- **Reason Usage Statistics**: Dual doughnut charts separating positive and negative score reasons
- **Summary Cards**: Key metrics including total entries, average daily change, win rate, and score range
- **Time Filtering**: View statistics for last 7/30/90 days or all time
- **Toggle Charts**: Show/hide statistics section to save space

### Enhanced User Experience
- **Pagination Controls**: Navigate through history with page numbers, previous/next buttons
- **Entry Information**: "Showing X-Y of Z entries" display
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Interactive Charts**: Built with Chart.js for professional visualizations
- **No Data Handling**: Graceful display when no data is available for selected time periods

### Security & Synchronization
- Cloud synchronization with MongoDB Atlas
- Secure password protection for each board
- Ability to change board passwords
- Password confirmation required to delete boards
- Persistent login with cookie-based session management

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
5. Use the "Randomly Select a Card" feature to get a highlighted random reason

### Score Management
1. Click the action button on any reason card to update the score
2. View the complete history of all score changes with paginated table (10 entries per page)
3. Navigate through history pages using page numbers or previous/next buttons
4. Use the undo button next to any history entry to reverse that change
5. Reset the score to any specific value using the reset feature

### Statistics & Analytics
1. View comprehensive statistics below the history table
2. **Score Trends**: Line chart showing your score progression over time
3. **Activity Analysis**: Stacked bar chart showing daily positive (green) vs negative (red) activities
4. **Reason Usage**: Two doughnut charts separating positive and negative score reasons
5. **Summary Cards**: Quick overview of total entries, average daily change, win rate, and score range
6. Filter statistics by time period (7/30/90 days or all time)
7. Toggle charts visibility to save screen space

### Board Security
1. Each board is password protected
2. Change your board's password using the "Change Password" button
3. Password confirmation is required to delete a board
4. Automatic cloud synchronization with your MongoDB Atlas database

### Offline Support
- The app automatically detects network issues and shows appropriate status messages
- Changes made while offline will sync when connection is restored

## Technical Details

### Frontend Technologies
- **HTML5**: Semantic markup with modern web standards
- **CSS3**: Custom styling with CSS Grid, Flexbox, and responsive design
- **JavaScript (ES6+)**: Modern JavaScript with async/await, modules, and DOM manipulation
- **Chart.js**: Professional chart library for interactive data visualizations
- **Font Awesome**: Icon library for UI elements

### Backend Technologies
- **Node.js**: JavaScript runtime for server-side development
- **Express.js**: Web framework for API endpoints and routing
- **MongoDB Atlas**: Cloud database for data persistence
- **bcrypt**: Secure password hashing

### Key Features Implementation
- **Pagination**: Custom pagination system with page numbers and navigation controls
- **Statistics Engine**: Real-time data analysis with time-based filtering
- **Drag & Drop**: HTML5 Drag and Drop API for reason card reordering
- **Responsive Design**: Mobile-first approach with CSS Grid and Flexbox
- **Session Management**: Cookie-based persistent login with secure storage
- **Real-time Sync**: Automatic cloud synchronization with retry logic
- **Chart Animations**: Smooth transitions and interactive data visualizations

### Security Features
- **Password Hashing**: bcrypt for secure password storage
- **Input Validation**: Server-side validation for all user inputs
- **Session Security**: Secure cookie configuration with SameSite protection
- **Database Security**: MongoDB Atlas with built-in security features

### Performance Optimizations
- **Chart Memory Management**: Proper cleanup to prevent memory leaks
- **Efficient Data Processing**: Optimized algorithms for statistics calculations
- **Responsive Loading**: Progressive enhancement for better user experience
- **Caching Strategy**: Smart caching for improved performance