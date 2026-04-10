const fs = require('fs').promises;

class UserService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.users = [];
    this.usedNumbers = new Set();
  }

  async load() {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      this.users = JSON.parse(data);
      
      // Build used numbers set
      this.usedNumbers = new Set(
        this.users.map(u => u.extension).filter(e => e !== null && e !== undefined)
      );
      
      console.log(`Loaded ${this.users.length} users from database`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('Users database not found, starting with empty database');
        this.users = [];
      } else {
        console.error('Error loading users database:', err);
        throw err;
      }
    }
  }

  async save() {
    await fs.writeFile(this.dbPath, JSON.stringify(this.users, null, 2), 'utf-8');
  }

  findByUsername(username) {
    return this.users.find(u => u.username === username);
  }

  findByExtension(extension) {
    return this.users.find(u => u.extension === parseInt(extension));
  }

  getAllUsers() {
    return this.users.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      extension: u.extension,
      department: u.department,
      email: u.email,
      online: u.online || false,
      lastSeen: u.lastSeen
    }));
  }

  async createUser(userData) {
    // Find available extension in range 1000-5999
    let extension = null;
    for (let i = 1000; i <= 5999; i++) {
      if (!this.usedNumbers.has(i)) {
        extension = i;
        break;
      }
    }

    if (!extension) {
      throw new Error('No available extensions in range 1000-5999');
    }

    // Generate random SIP password
    const sipPassword = Math.random().toString(36).slice(-8) + 
                       Math.random().toString(36).slice(-8).toUpperCase();

    const newUser = {
      id: userData.username.toLowerCase(),
      username: userData.username,
      displayName: userData.displayName,
      email: userData.email,
      department: userData.department,
      extension: extension,
      sipPassword: sipPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      online: false,
      lastSeen: null
    };

    this.users.push(newUser);
    this.usedNumbers.add(extension);
    
    await this.save();
    
    console.log(`Created user ${userData.username} with extension ${extension}`);
    
    return newUser;
  }

  async updateUserExtension(username, newExtension) {
    const user = this.findByUsername(username);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if extension is already used
    if (this.usedNumbers.has(newExtension) && user.extension !== newExtension) {
      throw new Error('Extension already in use');
    }

    // Remove old extension from used set
    if (user.extension) {
      this.usedNumbers.delete(user.extension);
    }

    // Update user
    user.extension = newExtension;
    user.updatedAt = new Date().toISOString();
    
    // Add new extension to used set
    this.usedNumbers.add(newExtension);
    
    await this.save();
    
    return user;
  }

  async updateUserInfo(username, ldapData) {
    const user = this.findByUsername(username);
    if (!user) {
      return null;
    }

    // Update display name and department from LDAP
    user.displayName = ldapData.displayName;
    user.department = ldapData.department;
    user.email = ldapData.email;
    user.updatedAt = new Date().toISOString();
    
    await this.save();
    
    return user;
  }

  async setOnlineStatus(username, isOnline) {
    const user = this.findByUsername(username);
    if (!user) {
      return null;
    }

    user.online = isOnline;
    user.lastSeen = isOnline ? new Date().toISOString() : user.lastSeen;
    
    return user;
  }

  async persistOnlineStatus() {
    await this.save();
  }

  getStatistics() {
    return {
      totalUsers: this.users.length,
      onlineUsers: this.users.filter(u => u.online).length,
      usedExtensions: this.usedNumbers.size,
      availableExtensions: 5000 - this.usedNumbers.size
    };
  }
}

module.exports = UserService;
