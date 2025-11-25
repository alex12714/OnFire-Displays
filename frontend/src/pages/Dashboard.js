import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TaskManagementHUD from './TaskManagementHUD';
import onFireAPI from '../services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { LogOut, RefreshCw } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const userData = onFireAPI.getUserData();

  useEffect(() => {
    if (!onFireAPI.isAuthenticated()) {
      navigate('/');
      return;
    }
    loadConversations();
  }, [navigate]);

  const loadConversations = async () => {
    setLoading(true);
    setError('');
    try {
      const convos = await onFireAPI.getConversations();
      console.log('Loaded conversations:', convos);
      
      if (!convos || convos.length === 0) {
        setError('No conversations found. Please create a conversation first.');
        setConversations([]);
        return;
      }
      
      setConversations(convos);
      
      // Auto-select first conversation if available
      if (convos.length > 0 && !selectedConversation) {
        setSelectedConversation(convos[0].id);
      }
    } catch (err) {
      setError('Failed to load conversations. Please try again.');
      console.error('Conversation loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onFireAPI.logout();
    navigate('/');
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        {/* User Avatar - Left */}
        <div className="user-profile">
          <div className="user-avatar">
            {userData?.avatar_url || userData?.profile_photo_url ? (
              <img 
                src={userData.avatar_url || userData.profile_photo_url} 
                alt={userData.first_name || userData.username} 
                className="user-avatar-image"
              />
            ) : (
              <div className="user-avatar-placeholder">
                {(userData?.first_name || userData?.username || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="user-name">{userData?.first_name || userData?.username || 'User'}</div>
        </div>

        {/* Group Selector - Center */}
        <div className="conversation-selector">
          <Select value={selectedConversation} onValueChange={setSelectedConversation}>
            <SelectTrigger className="select-trigger" id="conversation-select">
              {selectedConversation ? (
                (() => {
                  const selectedConvo = conversations.find(c => c.id === selectedConversation);
                  const displayName = selectedConvo?.name || '';
                  const avatar = selectedConvo?.avatar_url || selectedConvo?.group_photo_url || null;
                  
                  return (
                    <div className="selected-conversation">
                      {avatar ? (
                        <img src={avatar} alt={displayName} className="conversation-avatar" />
                      ) : (
                        <div className="conversation-avatar-placeholder">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="conversation-name">{displayName}</span>
                    </div>
                  );
                })()
              ) : (
                <SelectValue placeholder="Choose a conversation" />
              )}
            </SelectTrigger>
            <SelectContent>
              {conversations.map((convo) => {
                const displayName = convo.name || `Conversation ${convo.id.substring(0, 8)}`;
                const avatar = convo.avatar_url || convo.group_photo_url || null;
                
                return (
                  <SelectItem key={convo.id} value={convo.id}>
                    <div className="conversation-item">
                      {avatar ? (
                        <img src={avatar} alt={displayName} className="conversation-avatar" />
                      ) : (
                        <div className="conversation-avatar-placeholder">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="conversation-name">{displayName}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Controls - Right */}
        <div className="header-controls">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={loadConversations}
            className="refresh-button"
            title="Refresh conversations"
          >
            <RefreshCw size={18} />
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleLogout}
            className="logout-button"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {selectedConversation ? (
        <TaskManagementHUD conversationId={selectedConversation} />
      ) : (
        <div className="no-conversation">
          <p>Please select a conversation to view tasks</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;