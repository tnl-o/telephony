# Master Plan: Corporate WebRTC Telephony System

## 1. Overview
A corporate telephony system allowing 3000-5000 users to make internal WebRTC calls and external calls via FreePBX trunk. Authentication and user data are synchronized with Microsoft Active Directory (LDAP).

### Key Features
- **Authentication**: MS Active Directory (LDAP) via `sAMAccountName`.
- **User Data**: Synced from LDAP (`displayName`, `department`) on first login only. Manual edits allowed in JSON.
- **Internal Numbering**: Auto-assigned from range **1000-5999** on first login.
- **Calling**:
  - **Internal**: WebRTC (Browser-to-Browser) via FreeSWITCH using **Opus** codec.
  - **External**: Via SIP Trunk to FreePBX (Opus -> G.711 PCMU/PCMA transcoding). Dial prefix: `9`.
- **Incoming Calls**: Handled by **FreePBX IVR** (asks for extension) -> routed to FreeSWITCH extension.
- **Status**: Online/Offline presence via **WebSocket** (tracked by active login session + BLF from FreeSWITCH ESL).
- **Storage**: User data stored in `data/users.json` (file-based DB).
- **Network**: Docker internal network using CGNAT range `100.64.0.0/10` + IPv6 ULA.
- **No Recording**: Call recording disabled to save resources.
- **Permissions**: All users can call all extensions. No department restrictions.

## 2. Architecture & Stack

### Components
1.  **Frontend**: React + Vite + TailwindCSS + JsSIP (WebRTC client over WSS).
2.  **Backend**: Node.js (Express) + `ldapjs`/`activedirectory2` + WebSocket server + FreeSWITCH ESL client.
3.  **Media Server**: FreeSWITCH (SIP/WSS Gateway, Opus transcoding, Internal Routing, BLF events).
4.  **Web Server/Proxy**: Nginx (SSL Termination, Reverse Proxy for HTTP/WSS, Static Files).
5.  **Directory**: MS Active Directory (External, port 389/636).
6.  **PBX**: FreePBX (External, SIP Trunk provider for PSTN/Mobile).

### Docker Network Topology
**Network Name**: `telephony_net`  
**IPv4 Subnet**: `100.64.0.0/24` (CGNAT - non-routable, isolated)  
**IPv6 Subnet**: `fd00:telephony::/64` (ULA - Unique Local Address)

| Service | Container Name | IPv4 Address | IPv6 Address | Ports (Internal) | Ports (Host) | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Nginx** | `nginx` | `100.64.0.5` | `fd00:telephony::5` | 80, 443 | 80, 443 | Reverse Proxy, SSL Termination |
| **FreeSWITCH** | `freeswitch` | `100.64.0.10` | `fd00:telephony::a` | 5060 (SIP), 7443 (WSS), 8021 (ESL), 16384-16448 (RTP) | 5060, 7443, 16384-16448 | Media Core, Transcoding, BLF |
| **Backend** | `backend` | `100.64.0.20` | `fd00:telephony::14` | 3000 (API/WS) | 3000 | Auth (LDAP), User DB, Presence |
| **Frontend** | `frontend` | `100.64.0.30` | `fd00:telephony::1e` | 80 (Vite/Nginx internal) | - | UI (served via Nginx) |

*Note: Host ports mapping depends on deployment. Internal communication uses container IPs directly. Only Nginx ports (80/443) exposed to LAN.*

## 3. Data Specifications

### User Data Structure (`data/users.json`)
```json
{
  "users": [
    {
      "id": "uuid-v4",
      "extension": "1001",
      "ldapUsername": "ivanov.i",
      "fullName": "Ivanov Ivan Ivanovich",
      "department": "IT Department",
      "sipPassword": "a1b2c3d4e5f6g7h8i9j0",
      "createdAt": "2025-01-15T10:00:00Z",
      "lastLogin": "2025-01-15T12:30:00Z",
      "isActive": true
    }
  ],
  "nextExtension": 1002,
  "usedExtensions": ["1001"]
}
```

### LDAP Configuration (`config/ldap.json`)
```json
{
  "url": "ldap://ad.company.local:389",
  "baseDN": "DC=company,DC=local",
  "bindDN": "CN=TelephonyService,OU=ServiceAccounts,DC=company,DC=local",
  "bindCredentials": "StrongPassword123!",
  "searchBase": "OU=Users,DC=company,DC=local",
  "attributes": {
    "username": "sAMAccountName",
    "displayName": "displayName",
    "department": "department",
    "email": "mail"
  },
  "tlsOptions": {
    "rejectUnauthorized": false
  }
}
```

### FreeSWITCH Trunk Config (`config/freeswitch/sip_profiles/external.xml`)
- **Type**: SIP (Trust-based, no auth required from FreePBX)
- **Codec**: Opus (Internal), G.711 PCMU/PCMA (Trunk)
- **Context**: `public` for incoming from FreePBX, `internal` for users
- **Gateway**: Points to FreePBX IP with codec negotiation

### API Endpoints Specification
- `POST /api/auth/login` - LDAP authentication, returns user data + SIP credentials
- `GET /api/user/me` - Current user info (extension, name, department)
- `GET /api/contacts` - Phonebook (all active users with status)
- `GET /api/status/ws` - WebSocket endpoint for presence updates
- `PUT /api/admin/users/:id` - Admin: update user (extension, name manually)
- `DELETE /api/admin/users/:id` - Admin: deactivate user (free up extension)

## 4. Implementation Steps

### Phase 1: Infrastructure & Docker ✅ (Current Step)
- [x] Define `docker-compose.yml` with static IPs in `100.64.0.0/24` + IPv6
- [ ] Create directory structure (`config`, `data`, `logs`, `scripts`)
- [ ] Create SSL generation script (`scripts/generate-ssl.sh`) for WSS/Nginx
- [ ] Configure Nginx reverse proxy (`config/nginx/nginx.conf`) with WS support
- [ ] Commit all infra files to Git

### Phase 2: FreeSWITCH Configuration
- [ ] Base `freeswitch/conf/autoload_configs/*.xml` configuration
- [ ] Enable WSS (TLS) profile on port 7443
- [ ] Configure Internal SIP Profile (LAN, Opus codec preferred)
- [ ] Configure External SIP Profile (Trunk to FreePBX, G.711)
- [ ] Dialplan:
  - [ ] Internal routing (Extension 1000-5999 to Extension)
  - [ ] Outbound routing (prefix `9` to Trunk, strip 9)
  - [ ] Codec negotiation (Opus <-> PCMA/PCMU transcoding)
- [ ] ESL (Event Socket Layer) setup for BLF events (port 8021)
- [ ] Generate SIP credentials dynamically via API or FS CLI

### Phase 3: Backend Development (Node.js)
- [ ] Setup Express server with TypeScript
- [ ] Implement LDAP Authentication (`activedirectory2` library)
- [ ] Implement User Logic:
  - [ ] Check `users.json` on login by `ldapUsername`
  - [ ] If missing: Assign next free number (1000-5999), generate SIP password, save to JSON
  - [ ] If exists: Update `lastLogin`, keep existing extension
  - [ ] Manual edit support: respect changes in JSON
- [ ] WebSocket Server:
  - [ ] Track connected users (session-based online status)
  - [ ] Subscribe to FreeSWITCH ESL for BLF (registration events)
  - [ ] Broadcast presence status (Online/Offline/Busy) to all clients
- [ ] API Endpoints implementation
- [ ] Error handling and logging

### Phase 4: Frontend Development (React)
- [ ] Login Screen: LDAP Credentials form (username/password)
- [ ] Dashboard:
  - [ ] Integrate JsSIP with WSS (auto-connect after login)
  - [ ] Phonebook UI (Search, Filter by Department, Click-to-Call)
  - [ ] Presence Indicators (Green=Online, Gray=Offline, Red=Busy)
  - [ ] Dialpad for manual entry (internal/ext numbers)
- [ ] Call Interface: Mute, Hold, Hangup, Transfer, DTMF
- [ ] Settings: Audio device selection (mic/speaker)
- [ ] Preserve existing Glassmorphism design (Tailwind CSS)
- [ ] Responsive design for mobile/desktop

### Phase 5: Integration & Testing
- [ ] Test LDAP Bind with MS AD
- [ ] Test Internal Calls (Browser A -> Browser B via FreeSWITCH)
- [ ] Test External Calls (Browser -> prefix 9 -> FreePBX Trunk -> PSTN)
- [ ] Test Incoming Calls (FreePBX IVR -> ask extension -> FreeSWITCH)
- [ ] Test Presence (BLF updates on login/logout/call)
- [ ] Load Test (Simulate 100+ concurrent registrations)
- [ ] Security Audit (no open relay, rate limiting on API)

## 5. Security Considerations
- **Network**: Services isolated in Docker network `100.64.0.0/24`. Only Nginx exposed to LAN on 80/443.
- **SSL**: Self-signed certs generated automatically. Browsers require manual trust exception for LAN.
- **LDAP**: Service account with read-only access to necessary OUs (Users/Computers).
- **SIP**: Strong random passwords (20 chars hex) generated for each extension.
- **Fraud Prevention**: 
  - Rate limiting on `/api/auth/login` (max 5 attempts/min/IP)
  - No open relay on FreeSWITCH (only authenticated users can call out)
  - External calls require prefix `9` (easy to block/audit)
- **Data**: `users.json` file permissions restricted to backend container only.

## 6. AI Agent Instructions
- **Agent A (Infra)**: Manages Docker Compose, Nginx config, SSL scripts. Ensures network `100.64.0.0/24` and IPv6 are respected. Verifies ports mapping.
- **Agent B (FreeSWITCH)**: Maintains `config/freeswitch/` XMLs. Handles codec transcoding rules (Opus<->G.711), dialplan logic, ESL setup. Tests SIP registration.
- **Agent C (Backend)**: Owns `server/` code (Node.js/TS). Manages LDAP logic, JSON DB consistency, WebSocket presence, API endpoints. Implements rate limiting.
- **Agent D (Frontend)**: Owns `client/` code (React/TS). Integrates JsSIP, manages UI state, preserves design. Implements BLF indicators and call controls.

## 7. Deployment Checklist
1. Clone repository to server
2. Edit `config/ldap.json` with AD credentials
3. Edit `config/freeswitch/gateways/freepbx.xml` with FreePBX IP
4. Run `./scripts/generate-ssl.sh`
5. `docker compose up -d`
6. Verify logs: `docker compose logs -f`
7. Open `https://<server-ip>` in browser, accept SSL warning
8. Login with AD credentials
9. Test internal call between two browsers
10. Test external call with prefix `9`

---
*Generated for Project Initialization. Last Updated: 2025-01-15*
*Version: 1.1 (Updated with CGNAT addressing, IPv6, BLF details)*
