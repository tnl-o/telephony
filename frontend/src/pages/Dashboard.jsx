import { useState, useEffect } from 'react';
import { authAPI, contactsAPI } from '../services/auth';
import webrtcService from '../services/webrtc';
import { useWebSocket } from '../hooks/useWebSocket';

function Dashboard({ user, onLogout }) {
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCall, setActiveCall] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, ringing, active, ended
  const { onlineUsers, isConnected } = useWebSocket();

  useEffect(() => {
    loadContacts();
    
    webrtcService.setOnNewRTCSession((session) => {
      setActiveCall(session);
      setCallState('ringing');
    });

    webrtcService.setOnCallStateChange((state, session) => {
      setCallState(state);
      if (state === 'active') {
        setActiveCall(session);
      } else if (state === 'ended' || state === 'failed') {
        setActiveCall(null);
      }
    });

    return () => {
      webrtcService.disconnect();
    };
  }, []);

  const loadContacts = async () => {
    try {
      const data = await contactsAPI.getAll();
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const handleCall = (extension) => {
    if (extension === user.extension) {
      alert('Cannot call yourself');
      return;
    }
    
    try {
      webrtcService.call(extension);
      setCallState('ringing');
    } catch (error) {
      alert('Failed to initiate call: ' + error.message);
    }
  };

  const handleAnswer = () => {
    webrtcService.answer();
  };

  const handleHangup = () => {
    webrtcService.hangup();
    setActiveCall(null);
    setCallState('idle');
  };

  const handleMute = (muted) => {
    webrtcService.mute(muted);
  };

  const filteredContacts = contacts.filter(contact => 
    contact.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.extension.includes(searchTerm)
  );

  const handleLogout = async () => {
    await authAPI.logout();
    webrtcService.disconnect();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      {/* Header */}
      <div className="glass-panel rounded-xl p-4 mb-6 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-purple-500/30 flex items-center justify-center text-white font-bold text-xl">
            {user.displayName.charAt(0)}
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">{user.displayName}</h2>
            <p className="text-gray-300 text-sm">Extension: {user.extension}</p>
            {user.department && <p className="text-gray-400 text-xs">{user.department}</p>}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'status-online' : 'status-offline'}`}></div>
          <button
            onClick={handleLogout}
            className="glass-button text-white px-4 py-2 rounded-lg text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Active Call Panel */}
      {activeCall && (
        <div className="glass-panel rounded-xl p-6 mb-6 bg-purple-500/20">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-2">
              {callState === 'ringing' && 'Calling...'}
              {callState === 'active' && 'In Call'}
              {callState === 'ended' && 'Call Ended'}
            </h3>
            <p className="text-gray-300 mb-4">
              {activeCall.remote_identity?.display_name || activeCall.remote_identity?.uri?.user || 'Unknown'}
            </p>
            
            <div className="flex justify-center space-x-4">
              {callState === 'ringing' && (
                <button
                  onClick={handleAnswer}
                  className="glass-button bg-green-500/30 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Answer
                </button>
              )}
              <button
                onClick={handleHangup}
                className="glass-button bg-red-500/30 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Hangup
              </button>
              {callState === 'active' && (
                <button
                  onClick={() => handleMute(true)}
                  className="glass-button text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Mute
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, department, or extension..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full glass-panel text-white px-4 py-3 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Contacts List */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-semibold text-lg">Phone Book ({filteredContacts.length})</h3>
        </div>
        
        <div className="max-h-[600px] overflow-y-auto">
          {filteredContacts.map((contact) => (
            <div
              key={contact.username}
              className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-blue-500/30 flex items-center justify-center text-white font-semibold">
                    {contact.displayName.charAt(0)}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-purple-900 ${
                    onlineUsers.has(contact.username) ? 'status-online' : 'status-offline'
                  }`}></div>
                </div>
                
                <div>
                  <h4 className="text-white font-medium">{contact.displayName}</h4>
                  <p className="text-gray-400 text-sm">
                    Ext: {contact.extension} {contact.department && `• ${contact.department}`}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => handleCall(contact.extension)}
                disabled={callState !== 'idle'}
                className="glass-button text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📞 Call
              </button>
            </div>
          ))}
          
          {filteredContacts.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No contacts found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
