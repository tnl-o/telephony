const ldap = require('ldapjs');

class LDAPService {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.client = ldap.createClient({
        url: this.config.url,
        connectTimeout: 10000,
      });

      this.client.on('error', (err) => {
        console.error('LDAP connection error:', err);
        reject(err);
      });

      this.client.bind(this.config.bindDN, this.config.bindPassword, (err) => {
        if (err) {
          console.error('LDAP bind error:', err);
          reject(err);
        } else {
          console.log('Connected to LDAP server');
          resolve();
        }
      });
    });
  }

  async authenticate(username, password) {
    return new Promise((resolve, reject) => {
      const searchBase = this.config.baseDN;
      const searchFilter = `(${this.config.userAttribute}=${username})`;
      
      const searchOptions = {
        scope: 'sub',
        attributes: [
          this.config.userAttribute,
          this.config.displayNameAttribute,
          this.config.emailAttribute,
          this.config.departmentAttribute,
          'telephoneNumber'
        ],
      };

      this.client.search(searchBase, searchFilter, searchOptions, (err, res) => {
        if (err) {
          return reject(new Error(`LDAP search error: ${err.message}`));
        }

        let userEntry = null;

        res.on('searchEntry', (entry) => {
          userEntry = entry.object;
        });

        res.on('error', (err) => {
          reject(new Error(`LDAP search entry error: ${err.message}`));
        });

        res.on('end', async () => {
          if (!userEntry) {
            return reject(new Error('User not found in LDAP'));
          }

          // Try to bind with user credentials to verify password
          const userDN = userEntry.dn || `${this.config.userAttribute}=${username},${this.config.baseDN}`;
          
          const authClient = ldap.createClient({ url: this.config.url });
          
          authClient.on('error', () => {
            reject(new Error('Invalid credentials'));
          });

          authClient.bind(userDN, password, (err) => {
            authClient.unbind();
            
            if (err) {
              return reject(new Error('Invalid credentials'));
            }

            // Authentication successful
            resolve({
              username: userEntry[this.config.userAttribute],
              displayName: userEntry[this.config.displayNameAttribute] || 
                          `${userEntry.givenName || ''} ${userEntry.sn || ''}`.trim(),
              email: userEntry[this.config.emailAttribute],
              department: userEntry[this.config.departmentAttribute],
              telephoneNumber: userEntry.telephoneNumber,
              dn: userEntry.dn
            });
          });
        });
      });
    });
  }

  async disconnect() {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.unbind(() => {
          console.log('Disconnected from LDAP');
          resolve();
        });
      });
    }
  }
}

module.exports = LDAPService;
