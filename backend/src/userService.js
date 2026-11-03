const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

function xmlAttribute(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

class UserService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.users = [];
    this.usedNumbers = new Set();
    this.directoryWrites = Promise.resolve();
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

    const sipPassword =
      process.env.AUTH_MODE === 'simple' && process.env.DEV_SIP_PASSWORD
        ? process.env.DEV_SIP_PASSWORD
        : Math.random().toString(36).slice(-8) +
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
    if (!Number.isInteger(newExtension) || newExtension < 1000 || newExtension > 5999) {
      throw new Error('Extension must be an integer between 1000 and 5999');
    }
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

  /**
   * Generate FreeSWITCH directory XML file for all users.
   * Writes to <directoryPath>/users.xml (directoryPath should be the FreeSWITCH directory folder).
   * @param {string} directoryPath — path to FreeSWITCH directory folder (e.g. /etc/freeswitch/directory/default)
   */
  generateFreeSwitchDirectory(directoryPath) {
    const write = this.directoryWrites.then(() => this.writeFreeSwitchDirectory(directoryPath));
    // A failed write must reach its caller without blocking later recovery.
    this.directoryWrites = write.catch(() => {});
    return write;
  }

  async writeFreeSwitchDirectory(directoryPath) {
    try {
      await fs.mkdir(directoryPath, { recursive: true });

      // Build XML for each user
      const xmlEntries = this.users.map((u) => {
        if (!Number.isInteger(u.extension) || u.extension < 1000 || u.extension > 5999) {
          throw new Error(`Invalid SIP extension for ${u.username}`);
        }
        const name = xmlAttribute(u.displayName || u.username);
        return `  <user id="${u.extension}">
    <params>
      <param name="password" value="${xmlAttribute(u.sipPassword)}"/>
      <param name="vm-password" value="${xmlAttribute(u.sipPassword)}"/>
    </params>
    <variables>
      <variable name="user_context" value="default"/>
      <variable name="effective_caller_id_name" value="${name}"/>
      <variable name="effective_caller_id_number" value="${u.extension}"/>
      <variable name="directory-visible" value="true"/>
    </variables>
  </user>`;
      });

      const content = `<?xml version="1.0" encoding="utf-8"?>
<!-- Auto-generated by backend userService — DO NOT EDIT MANUALLY -->
<include>
${xmlEntries.join('\n')}
</include>
`;

      const outputPath = path.join(directoryPath, 'users.xml');
      // A reload must see the previous complete file or the new complete file.
      // Keep temporary files outside the *.xml include pattern.
      const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporaryPath, content, { encoding: 'utf-8', mode: 0o644 });
        await fs.rename(temporaryPath, outputPath);
      } finally {
        await fs.rm(temporaryPath, { force: true });
      }
      console.log(`FreeSWITCH directory generated: ${outputPath} (${this.users.length} users)`);
    } catch (err) {
      console.error('Failed to generate FreeSWITCH directory:', err.message);
      throw err;
    }
  }
}

module.exports = UserService;
