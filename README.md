# Personal Score Board

A comprehensive web-based score board application designed for tracking points with customizable reasons, featuring advanced analytics, interactive visualizations, and secure cloud storage through MongoDB Atlas.

![Score Board Application](https://img.shields.io/badge/Node.js-Score%20Board-green)
![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-blue)
![Chart.js](https://img.shields.io/badge/Charts-Chart.js-orange)

## ✨ Features

### 🎯 Core Functionality
- **Multi-Board Management**: Create multiple password-protected score boards with custom IDs
- **Dynamic Score Tracking**: Add and subtract scores with customizable reasons and dedicated action buttons 
- **Intuitive Organization**: Drag and rearrange reason cards to organize them as you prefer
- **Complete History**: View full history of all score changes with pagination (10 entries per page)
- **Flexible Undo System**: Undo specific score changes directly from the history
- **Score Reset**: Reset the score to any specific value
- **Random Selection**: Random card selection feature with visual highlighting

### 📊 Advanced Analytics & Statistics
- **Score Trends Over Time**: Interactive line chart showing your score progression
- **Activity Analysis**: Stacked bar chart displaying daily positive vs negative activities
- **Reason Usage Statistics**: Dual doughnut charts separating positive and negative score reasons
- **Summary Cards**: Key metrics including total entries, average daily change, win rate, and score range
- **Time Filtering**: View statistics for last 7/30/90 days or all time
- **Toggle Charts**: Show/hide statistics section to optimize screen space

### 🎨 Enhanced User Experience
- **Smart Pagination**: Navigate through history with page numbers and previous/next buttons
- **Entry Information**: Clear "Showing X-Y of Z entries" display
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Interactive Charts**: Built with Chart.js for professional visualizations
- **Graceful Fallbacks**: Elegant display when no data is available for selected time periods

### 🔒 Security & Synchronization
- **Cloud Synchronization**: Real-time sync with MongoDB Atlas
- **Password Protection**: Secure password protection for each board
- **Password Management**: Change board passwords with confirmation
- **Secure Deletion**: Password confirmation required to delete boards
- **Persistent Sessions**: Cookie-based session management with automatic login

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dnageek/scoreboard.git
   cd scoreboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Update the MongoDB Atlas connection string in `.env`
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
   PORT=3000
   ```

4. **Start the application**
   ```bash
   npm start
   # For development with auto-reload
   npm run dev
   ```

5. **Access the application**
   Open your browser to `http://localhost:3000`

## 🗄️ MongoDB Atlas Setup Guide

### Step-by-Step Configuration

1. **Create Account**: Sign up for a free MongoDB Atlas account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

2. **Create Project**: Set up a new project in your Atlas dashboard

3. **Build Cluster**: Create a new cluster (free tier M0 is sufficient for most use cases)

4. **Network Access**: Configure IP whitelist (allow access from anywhere: `0.0.0.0/0` for development)

5. **Database User**: Create a database user with read/write permissions

6. **Get Connection String**:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Select "Node.js" driver
   - Copy the connection string

7. **Configure Environment**:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
   PORT=3000
   ```

> **Note**: Replace `<username>`, `<password>`, `<cluster>`, and `<database>` with your actual values

## 💡 Usage Guide

### 🏗️ Creating and Accessing Boards
1. **New Board**: Create a board by providing a unique Board ID and secure password
2. **Access Board**: Use existing Board ID and password to access your data
3. **Board List**: View and quickly access your available boards from the dashboard

### ⚙️ Managing Reasons
1. **Add Reasons**: Create new reasons with description, score value, and type (positive/negative)
2. **Action Buttons**: Each reason card has a dedicated button for quick score updates
3. **Drag & Drop**: Rearrange reasons in any order that works best for you
4. **Edit Reasons**: Modify text, score values, or types of existing reasons
5. **Random Selection**: Use the random card feature to get highlighted suggestions

### 📈 Score Management
1. **Quick Updates**: Click action buttons on reason cards to instantly update scores
2. **History Tracking**: Browse paginated history (10 entries per page) of all changes
3. **Easy Navigation**: Use page numbers or previous/next buttons to navigate history
4. **Selective Undo**: Reverse specific changes using the undo button next to any entry
5. **Score Reset**: Reset to any specific value when needed

### 📊 Statistics & Analytics
1. **Comprehensive Stats**: View detailed analytics below the history section
2. **Score Trends**: Interactive line chart tracking your progress over time
3. **Activity Analysis**: Stacked bar chart showing daily positive vs negative activities
4. **Usage Patterns**: Dual doughnut charts for positive and negative reason frequency
5. **Key Metrics**: Summary cards with totals, averages, win rates, and score ranges
6. **Time Filtering**: Analyze data for different periods (7/30/90 days or all time)
7. **Space Management**: Toggle chart visibility to optimize screen real estate

### 🛡️ Security Features
1. **Password Protection**: Each board secured with individual passwords
2. **Password Updates**: Change board passwords with current password verification
3. **Secure Deletion**: Confirm password before permanently deleting boards
4. **Auto Sync**: Seamless cloud synchronization with MongoDB Atlas
5. **Session Persistence**: Stay logged in with secure cookie management

### 🌐 Offline Support
- **Connection Monitoring**: Automatic detection of network status
- **Status Messages**: Clear feedback on connection issues
- **Sync Recovery**: Automatic synchronization when connection is restored

## 🛠️ Technical Architecture

### Frontend Stack
| Technology | Purpose | Version |
|------------|---------|---------|
| **HTML5** | Semantic markup with modern web standards | Latest |
| **CSS3** | Custom styling with Grid, Flexbox, responsive design | Latest |
| **JavaScript (ES6+)** | Modern JS with async/await, modules, DOM manipulation | Latest |
| **Chart.js** | Interactive data visualizations and charts | Latest |
| **Font Awesome** | Professional icon library for UI elements | Latest |

### Backend Stack
| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | JavaScript runtime environment | v14+ |
| **Express.js** | Web application framework | ^4.18.2 |
| **MongoDB Atlas** | Cloud database for data persistence | Latest |
| **Mongoose** | MongoDB object modeling | ^7.5.0 |
| **bcrypt** | Secure password hashing | ^6.0.0 |

### Development Dependencies
- **nodemon** (^3.0.1): Development server with auto-reload
- **cors** (^2.8.5): Cross-Origin Resource Sharing middleware  
- **dotenv** (^16.3.1): Environment variable management

### Key Implementation Features

#### 🎯 Advanced Pagination System
- Custom pagination with page numbers and navigation controls
- Efficient data loading with 10 entries per page
- Smart pagination UI with ellipsis for large datasets

#### 📈 Real-time Statistics Engine
- Dynamic data analysis with time-based filtering
- Memory-efficient chart rendering with proper cleanup
- Responsive chart updates based on user interactions

#### 🎨 Modern User Interface
- HTML5 Drag and Drop API for intuitive card reordering
- Mobile-first responsive design with CSS Grid and Flexbox
- Progressive enhancement for optimal user experience

#### 🔒 Security Implementation
- **Password Security**: bcrypt hashing with salt rounds
- **Input Validation**: Comprehensive server-side validation
- **Session Security**: Secure cookie configuration with SameSite protection
- **Database Security**: MongoDB Atlas built-in security features

#### ⚡ Performance Optimizations
- **Compression**: Gzip compression for reduced bandwidth
- **Memory Management**: Proper chart cleanup to prevent memory leaks
- **Efficient Algorithms**: Optimized data processing for statistics
- **Smart Caching**: Strategic caching for improved response times
- **Connection Resilience**: Automatic retry logic for database connections

## 📂 Project Structure

```
score-board/
├── 📁 public/                 # Frontend assets
│   ├── index.html            # Main application page
│   ├── fallback.html         # Offline fallback page
│   ├── script.js             # Main application logic
│   ├── styles.css            # Application styles
│   └── js-cookie.min.js      # Cookie management library
├── 📄 server.js              # Express server and API endpoints
├── 📄 package.json           # Project dependencies and scripts
├── 📄 .env.example           # Environment variables template
├── 📄 README.md              # Project documentation
└── 📄 index.html             # Server fallback page
```

## 🎯 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/boards` | Create a new score board |
| `POST` | `/api/boards/:id/access` | Access existing board with password |
| `GET` | `/api/boards/:id` | Get board data |
| `PUT` | `/api/boards/:id` | Update board data |
| `DELETE` | `/api/boards/:id` | Delete board |
| `POST` | `/api/boards/:id/change-password` | Change board password |
| `GET` | `/api/boards` | List available boards |

## 🧪 Development

### Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server with auto-reload
```

### Development Setup
1. Install development dependencies: `npm install`
2. Set up environment variables in `.env`
3. Run with `npm run dev` for auto-reload during development
4. Access at `http://localhost:3000`

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages
5. Push to your fork and submit a pull request

## 🔧 Configuration

### Environment Variables
- `MONGODB_URI`: MongoDB Atlas connection string (required)
- `PORT`: Server port (default: 3000)

### Browser Support
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## 📈 Performance

- **Bundle Size**: Optimized for fast loading
- **Database**: Efficient MongoDB queries with indexing
- **Caching**: Strategic caching for improved response times
- **Compression**: Gzip compression enabled
- **Memory**: Proper cleanup prevents memory leaks

## 🐛 Troubleshooting

### Common Issues

**Connection Issues**
- Verify MongoDB Atlas connection string
- Check network connectivity
- Ensure IP whitelist includes your address

**Authentication Problems**
- Verify correct Board ID and password
- Clear browser cookies if persistent issues
- Check for typos in credentials

**Performance Issues**
- Clear browser cache
- Check network connection
- Verify MongoDB Atlas cluster status

## 📋 Changelog

### v1.0.0 (Current)
- ✅ Initial release with full feature set
- ✅ MongoDB Atlas integration
- ✅ Advanced analytics and statistics
- ✅ Responsive design
- ✅ Security features
- ✅ Offline support

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Review existing issues on GitHub
3. Create a new issue with detailed description
4. Include relevant error messages and system information

---

**Made with ❤️ by [dnageek](https://github.com/dnageek)**