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
        <div className="header-left">
          <h2 className="user-greeting">Welcome, {userData?.first_name || userData?.username || 'User'}!</h2>
        </div>
        <div className="header-controls">
          <div className="conversation-selector">
            <label htmlFor="conversation-select">Select Conversation:</label>
            <Select value={selectedConversation} onValueChange={setSelectedConversation}>
              <SelectTrigger className="select-trigger" id="conversation-select">
                <SelectValue placeholder="Choose a conversation" />
              </SelectTrigger>
              <SelectContent>
                {conversations.map((convo) => {
                  const displayName = convo.name || `Conversation ${convo.id.substring(0, 8)}`;
                  const typeEmoji = convo.conversation_type === 'group' ? '👥' : 
                                   convo.conversation_type === 'channel' ? '📢' : '💬';
                  const messageCount = convo.message_count > 0 ? ` (${convo.message_count} msgs)` : '';
                  
                  return (
                    <SelectItem key={convo.id} value={convo.id}>
                      {typeEmoji} {displayName}{messageCount}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
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