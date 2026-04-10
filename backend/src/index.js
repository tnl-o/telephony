const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const LDAPService = require('./ldap');
const UserService = require('./userService');

// Configuration
const config = {
  port: process.env.PORT || 3000,
  ldap: {
    url: process.env.LDAP_URL,
    baseDN: process.env.LDAP_BASE_DN,
    bindDN: process.env.LDAP_BIND_DN,
    bindPassword: process.env.LDAP_BIND_PASSWORD,
    userAttribute: process.env.LDAP_USER_ATTRIBUTE || 'sAMAccountName',
    displayNameAttribute: process.env.LDAP_DISPLAY_NAME_ATTRIBUTE || 'displayName',
    emailAttribute: process.env.LDAP_EMAIL_ATTRIBUTE || 'mail',
    departmentAttribute: process.env.LDAP_DEPARTMENT_ATTRIBUTE || 'department'
  },
  usersDbPath: process.env.USERS_DB_PATH || '/app/data/users.json'
};

// Initialize services
const ldapService = new LDAPService(config.ldap);
const userService = new UserService(config.usersDbPath);

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// HTTP server
const server = http.createServer(app);

// WebSocket server for online status
const wss = new WebSocket.Server({ server, path: '/ws/status' });

// Track connected clients for broadcasting status
const statusClients = new Set();

wss.on('connection', (ws) => {
  console.log('Status client connected');
  statusClients.add(ws);

  ws.on('close', () => {
    console.log('Status client disconnected');
    statusClients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    statusClients.delete(ws);
  });
});

// Broadcast status update to all connected clients
function broadcastStatusUpdate(userData) {
  const message = JSON.stringify({
    type: 'status_update',
    user: userData
  });

  statusClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Middleware to load users DB on startup
async function initialize() {
  try {
    await userService.load();
    await ldapService.connect();
    console.log('Backend initialized successfully');
  } catch (err) {
    console.error('Failed to initialize backend:', err);
    process.exit(1);
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    statistics: userService.getStatistics()
  });
});

// LDAP Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Authenticate with LDAP
    const ldapUser = await ldapService.authenticate(username, password);

    // Check if user exists in our database
    let user = userService.findByUsername(ldapUser.username);

    if (!user) {
      // Create new user with auto-assigned extension
      user = await userService.createUser(ldapUser);
    } else {
      // Update user info from LDAP
      user = await userService.updateUserInfo(ldapUser.username, ldapUser);
    }

    // Set user as online
    user = await userService.setOnlineStatus(user.username, true);
    
    // Persist changes
    await userService.persistOnlineStatus();

    // Broadcast online status
    broadcastStatusUpdate({
      username: user.username,
      online: true,
      lastSeen: user.lastSeen
    });

    // Return user data without SIP password in most cases
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        extension: user.extension,
        department: user.department,
        email: user.email,
        online: true
      },
      sipCredentials: {
        extension: user.extension.toString(),
        password: user.sipPassword,
        wssUrl: `wss://${process.env.HOSTNAME || 'localhost'}:7443`
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(401).json({ 
      error: 'Authentication failed', 
      message: err.message 
    });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await userService.setOnlineStatus(username, false);
    
    if (user) {
      await userService.persistOnlineStatus();
      
      // Broadcast offline status
      broadcastStatusUpdate({
        username: user.username,
        online: false,
        lastSeen: user.lastSeen
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed', message: err.message });
  }
});

// Get all contacts (phone book)
app.get('/api/contacts', (req, res) => {
  try {
    const contacts = userService.getAllUsers();
    res.json({ contacts });
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ error: 'Failed to get contacts', message: err.message });
  }
});

// Get current user info
app.get('/api/user/me', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = userService.findByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        extension: user.extension,
        department: user.department,
        email: user.email,
        online: user.online,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user', message: err.message });
  }
});

// Admin: Update user extension
app.post('/api/admin/user/:username/extension', async (req, res) => {
  try {
    const { username } = req.params;
    const { extension } = req.body;

    if (!extension || extension < 1000 || extension > 5999) {
      return res.status(400).json({ error: 'Extension must be between 1000 and 5999' });
    }

    const user = await userService.updateUserExtension(username, parseInt(extension));
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        extension: user.extension,
        department: user.department
      }
    });
  } catch (err) {
    console.error('Update extension error:', err);
    res.status(400).json({ error: 'Failed to update extension', message: err.message });
  }
});

// Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = userService.getStatistics();
    res.json(stats);
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to get statistics', message: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  await initialize();

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`Backend server running on port ${config.port}`);
    console.log(`WebSocket status endpoint: ws://localhost:${config.port}/ws/status`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Mark all users as offline
  const allUsers = userService.getAllUsers();
  for (const user of allUsers) {
    if (user.online) {
      await userService.setOnlineStatus(user.username, false);
      broadcastStatusUpdate({
        username: user.username,
        online: false,
        lastSeen: new Date().toISOString()
      });
    }
  }
  await userService.persistOnlineStatus();

  server.close(() => {
    console.log('HTTP server closed');
    ldapService.disconnect().then(() => {
      console.log('LDAP disconnected');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  process.emit('SIGTERM');
});

start();
