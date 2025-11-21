import React, { useState, useEffect } from 'react';
import './TaskManagementHUD.css';
import { Coins } from 'lucide-react';
import onFireAPI from '../services/api';

const TaskManagementHUD = ({ conversationId }) => {
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ personName: '', taskTitle: '', coins: 0 });
  const [transactionSummaries, setTransactionSummaries] = useState({});

  useEffect(() => {
    if (conversationId) {
      loadTasks();
    }
  }, [conversationId]);

  useEffect(() => {
    if (people.length > 0) {
      loadTransactionSummaries();
    }
  }, [people]);

  const loadTransactionSummaries = async () => {
    console.log('Loading transaction summaries for people:', people);
    const summaries = {};
    
    for (const person of people) {
      try {
        const summary = await onFireAPI.getTransactionSummary(person.id);
        if (summary) {
          summaries[person.id] = summary;
          console.log(`Transaction summary for ${person.name}:`, summary);
        }
      } catch (error) {
        console.error(`Error loading summary for ${person.name}:`, error);
      }
    }
    
    setTransactionSummaries(summaries);
    console.log('All transaction summaries loaded:', summaries);
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      console.log('Loading tasks for conversation:', conversationId);
      const apiTasks = await onFireAPI.getTasks(conversationId);
      console.log('Loaded tasks:', apiTasks);
      
      if (!apiTasks || apiTasks.length === 0) {
        console.log('No tasks found for this conversation');
        setTasks([]);
        setCompletedTasks([]);
        setPeople([]);
        return;
      }
      
      // Separate completed and active tasks
      const completed = apiTasks.filter(t => t.status === 'completed');
      const active = apiTasks.filter(t => t.status !== 'completed');
      
      console.log(`Found ${active.length} active tasks and ${completed.length} completed tasks`);
      
      setTasks(active);
      setCompletedTasks(completed);
      
      // Extract unique user IDs
      const uniqueUserIds = new Set();
      const userData = onFireAPI.getUserData();
      
      if (userData?.id) {
        uniqueUserIds.add(userData.id);
      }
      
      apiTasks.forEach(task => {
        if (task.assignee_user_ids && Array.isArray(task.assignee_user_ids)) {
          task.assignee_user_ids.forEach(id => uniqueUserIds.add(id));
        }
        if (task.completed_by_user_id) {
          uniqueUserIds.add(task.completed_by_user_id);
        }
        if (task.created_by_user_id) {
          uniqueUserIds.add(task.created_by_user_id);
        }
      });
      
      // Fetch actual user profiles with avatars
      console.log('Fetching user profiles for:', Array.from(uniqueUserIds));
      const userProfiles = await onFireAPI.getUserProfiles(Array.from(uniqueUserIds));
      console.log('Fetched user profiles:', userProfiles);
      
      // Create user profile map for quick lookup (keyed by user_id)
      const profileMap = {};
      userProfiles.forEach(profile => {
        profileMap[profile.user_id] = profile;
      });
      
      // Generate people list with actual user data and avatars
      const colors = ['#ff6b35', '#ff8c42', '#ff9a56', '#ffa86b', '#ffb680', '#ffc494', '#ffd2a8'];
      const peopleList = Array.from(uniqueUserIds).map((userId, index) => {
        const profile = profileMap[userId];
        const currentUserData = userId === userData?.id ? userData : null;
        
        let name = `User ${userId.substring(0, 8)}`;
        let initial = String.fromCharCode(65 + (index % 26));
        let avatar = null;
        
        if (profile) {
          // Extract first name only from display_name
          const displayName = profile.display_name || name;
          name = displayName.split(' ')[0]; // Get only first word (first name)
          initial = name[0].toUpperCase();
          // Use profile_photo_url from user_profiles
          avatar = profile.profile_photo_url || null;
        } else if (currentUserData) {
          // Fallback to current user data from login
          name = currentUserData.first_name || currentUserData.username || name;
          // Extract first name if username contains spaces
          name = name.split(' ')[0];
          initial = name[0].toUpperCase();
        }
        
        return {
          id: userId,
          name: name,
          initial: initial,
          avatar: avatar,
          color: colors[index % colors.length]
        };
      });
      
      console.log('Generated people list with avatars:', peopleList);
      setPeople(peopleList);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
      setCompletedTasks([]);
      setPeople([]);
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskId, personId) => {
    const task = tasks.find(t => t.id === taskId);
    const person = people.find(p => p.id === personId);
    
    if (!task || !person) return;
    
    // Prevent duplicate calls
    if (showModal) return;
    
    const coins = Math.ceil((task.estimated_time_minutes || 30) / 10);
    const amount = task.budget_cost || coins;
    
    setModalData({
      personName: person.name,
      taskTitle: task.title,
      coins: coins
    });
    setShowModal(true);
    
    try {
      // 1. Mark task as completed
      await onFireAPI.completeTask(taskId, personId);
      console.log('Task marked as completed');
      
      // 2. Immediately update local state to move task to completed section
      const updatedTask = {
        ...task,
        status: 'completed',
        completed_by_user_id: personId,
        updated_at: new Date().toISOString()
      };
      
      // Remove from active tasks and add to completed
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
      setCompletedTasks(prevCompleted => [...prevCompleted, updatedTask]);
      
      console.log('UI updated - task moved to completed section');
      
      // 3. Create transaction for the budget_cost
      console.log('Preparing transaction data...');
      console.log('Task creator ID:', task.created_by_user_id);
      console.log('Completer ID:', personId);
      console.log('Amount:', amount);
      console.log('Task ID:', taskId);
      
      // Validate required fields before creating transaction
      if (!task.created_by_user_id) {
        console.error('Cannot create transaction: task.created_by_user_id is missing');
        console.log('Full task object:', task);
        return;
      }
      
      if (!personId) {
        console.error('Cannot create transaction: personId is missing');
        return;
      }
      
      if (!amount || amount <= 0) {
        console.error('Cannot create transaction: invalid amount', amount);
        return;
      }
      
      const transactionData = {
        from_user_id: task.created_by_user_id,
        to_user_id: personId,
        amount: amount,
        fee: 0,
        net_amount: amount,
        related_entity_type: 'task',
        related_entity_id: taskId,
        description: `Payment for completing task: ${task.title}`,
        notes: `Task completed by ${person.name}`,
        metadata: {
          task_id: taskId,
          task_title: task.title,
          completed_by: personId,
          conversation_id: conversationId
        }
      };
      
      console.log('Transaction data prepared:', JSON.stringify(transactionData, null, 2));
      
      try {
        const result = await onFireAPI.createTransaction(transactionData);
        console.log('✅ Transaction created successfully:', result);
      } catch (txError) {
        console.error('❌ Transaction creation failed:', txError.message);
        console.error('Full error:', txError);
      }
      
    } catch (error) {
      console.error('Error completing task or creating transaction:', error);
      // Revert UI change on error
      loadTasks();
    }

    // Close modal after 3 seconds
    setTimeout(() => {
      setShowModal(false);
    }, 3000);
  };

  const uncompleteTask = async (taskId) => {
    try {
      console.log('Uncompleting task:', taskId);
      
      // Get task data before uncompleting
      const completedTask = completedTasks.find(t => t.id === taskId);
      
      if (!completedTask) {
        console.error('Task not found in completed list');
        return;
      }
      
      // Store data for reversal transaction
      const coins = Math.ceil((completedTask.estimated_time_minutes || 30) / 10);
      const amount = completedTask.budget_cost || coins;
      const person = people.find(p => p.id === completedTask.completed_by_user_id);
      
      // 1. Update API - change status to not_started
      await onFireAPI.uncompleteTask(taskId);
      console.log('Task status changed to not_started');
      
      // 2. Immediately update local state
      const revertedTask = {
        ...completedTask,
        status: 'not_started',
        completed_by_user_id: null,
        progress_percentage: 0,
        updated_at: new Date().toISOString()
      };
      
      // Remove from completed tasks
      setCompletedTasks(prevCompleted => prevCompleted.filter(t => t.id !== taskId));
      
      // Add back to active tasks
      setTasks(prevTasks => [revertedTask, ...prevTasks]);
      
      console.log('UI updated - task moved back to active section');
      
      // 3. Create reversal transaction with type "unsend"
      const reversalData = {
        from_user_id: completedTask.created_by_user_id,
        to_user_id: completedTask.completed_by_user_id,
        amount: amount,
        fee: 0,
        net_amount: amount,
        related_entity_type: 'task',
        description: `Reversal for uncompleted task: ${completedTask.title}`,
        notes: `Task uncompleted by ${person?.name || 'user'}`,
        metadata: {
          task_id: taskId,
          task_title: completedTask.title,
          uncompleted_by: completedTask.completed_by_user_id,
          conversation_id: conversationId,
          reversal: true
        }
      };
      
      console.log('Creating reversal transaction:', reversalData);
      
      try {
        const result = await onFireAPI.createReversalTransaction(reversalData);
        console.log('✅ Reversal transaction created:', result);
      } catch (txError) {
        console.error('❌ Reversal transaction failed:', txError.message);
        console.error('Continuing with task uncomplete despite transaction error');
      }
      
    } catch (error) {
      console.error('Error uncompleting task:', error);
      // Revert UI change by reloading from API
      loadTasks();
    }
  };

  const handleTaskThumbnailClick = (task) => {
    // Directly uncomplete without confirmation
    uncompleteTask(task.id);
  };

  const getPersonProgress = (personId) => {
    const summary = transactionSummaries[personId];
    
    if (summary) {
      // Use API data
      const today = new Date().toISOString().split('T')[0];
      const dailyAmount = Math.abs(summary.daily_summary?.[today] || 0);
      
      // Get most recent week amount
      const weekKeys = Object.keys(summary.weekly_summary || {});
      const latestWeek = weekKeys.length > 0 ? weekKeys[weekKeys.length - 1] : null;
      const weeklyAmount = latestWeek ? Math.abs(summary.weekly_summary[latestWeek]) : 0;
      
      // Get current month amount
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const monthlyAmount = Math.abs(summary.monthly_summary?.[currentMonth] || 0);
      
      return {
        total: Math.abs(summary.total_amount || 0),
        daily: dailyAmount,
        weekly: weeklyAmount,
        monthly: monthlyAmount,
        dayHeight: Math.min((dailyAmount / 10) * 100, 100),
        weekHeight: Math.min((weeklyAmount / 50) * 100, 100),
        monthHeight: Math.min((monthlyAmount / 200) * 100, 100)
      };
    }
    
    // Fallback to calculated values if API data not available
    const personTasks = completedTasks.filter(t => t.completed_by_user_id === personId);
    const totalCoins = personTasks.reduce((sum, t) => {
      return sum + Math.ceil((t.estimated_time_minutes || 30) / 10);
    }, 0);
    
    return {
      total: totalCoins,
      daily: totalCoins,
      weekly: totalCoins,
      monthly: totalCoins,
      dayHeight: Math.min((totalCoins / 10) * 100, 100),
      weekHeight: Math.min((totalCoins / 50) * 100, 100),
      monthHeight: Math.min((totalCoins / 200) * 100, 100)
    };
  };

  const getCompletedByPerson = () => {
    const grouped = {};
    completedTasks.forEach(task => {
      const personId = task.completed_by_user_id;
      if (!personId) return;
      
      if (!grouped[personId]) {
        const person = people.find(p => p.id === personId);
        grouped[personId] = {
          person: person || { id: personId, name: 'Unknown', initial: 'U', color: '#999' },
          tasks: []
        };
      }
      grouped[personId].tasks.push(task);
    });
    return grouped;
  };

  const getTaskCoins = (task) => {
    return Math.ceil((task.estimated_time_minutes || 30) / 10);
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const taskDate = new Date(timestamp);
    const diffMinutes = Math.floor((now - taskDate) / 60000);
    
    if (diffMinutes === 0) return 'Now';
    if (diffMinutes === 1) return '1m';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    return `${Math.floor(diffMinutes/60)}h`;
  };

  if (loading) {
    return (
      <div className="task-hud-loading">
        <div className="loading-spinner"></div>
        <p>Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="task-hud-container">
      <div className="task-hud-content">
        <h1 className="task-hud-title">Task Management HUD</h1>
        
        {/* Conversation Info */}
        <div className="conversation-info">
          <div className="info-text">
            Showing tasks for conversation: <strong>{conversationId?.substring(0, 8)}...</strong>
          </div>
          <div className="info-stats">
            {tasks.length} active • {completedTasks.length} completed • {people.length} people
          </div>
        </div>

        {/* Progress Section */}
        <div className="progress-section">
          <div className="progress-title">Earnings Progress</div>
          <div className="person-progress-grid">
            {people.map(person => {
              const progress = getPersonProgress(person.id);
              return (
                <div key={person.id} className="person-progress-card">
                  <div className="person-avatar-section">
                    <div className="person-progress-name">{person.name}</div>
                    <div className="avatar" style={{ background: person.avatar ? 'transparent' : person.color }}>
                      {person.avatar ? (
                        <img src={person.avatar} alt={person.name} className="avatar-image" />
                      ) : (
                        person.initial
                      )}
                    </div>
                  </div>
                  <div className="vertical-bars-container">
                    <div className="vertical-bar-wrapper">
                      <div className="bar-amount">${progress.total}</div>
                      <div className="vertical-bar">
                        <div className="vertical-bar-fill" style={{ height: `${progress.dayHeight}%` }}></div>
                      </div>
                      <div className="bar-label">D</div>
                    </div>
                    <div className="vertical-bar-wrapper">
                      <div className="bar-amount">${progress.total}</div>
                      <div className="vertical-bar">
                        <div className="vertical-bar-fill" style={{ height: `${progress.weekHeight}%` }}></div>
                      </div>
                      <div className="bar-label">W</div>
                    </div>
                    <div className="vertical-bar-wrapper">
                      <div className="bar-amount">${progress.total}</div>
                      <div className="vertical-bar">
                        <div className="vertical-bar-fill" style={{ height: `${progress.monthHeight}%` }}></div>
                      </div>
                      <div className="bar-label">M</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Available Tasks Section */}
        <div className="tasks-section">
          <div className="section-title">Available Tasks</div>
          {tasks.length === 0 ? (
            <div className="no-tasks-message">
              <div style={{ fontSize: '3em', marginBottom: '20px' }}>📋</div>
              <p>No active tasks found for this conversation</p>
              <p style={{ fontSize: '0.9em', marginTop: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>
                Tasks with chat_id matching this conversation will appear here
              </p>
            </div>
          ) : (
            <div className="task-grid">
              {tasks.map(task => (
                <div key={task.id} className="task-card">
                  <div className="task-coins">
                    <Coins size={20} />
                    <span>{getTaskCoins(task)}</span>
                  </div>
                  <img 
                    src={task.cover_image_url || task.attachment_urls?.[0] || 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400'} 
                    alt={task.title} 
                    className="task-image" 
                  />
                  <div className="task-content">
                    <div className="task-title">{task.title}</div>
                    <div className="avatars-row">
                      {people.map(person => (
                        <div
                          key={person.id}
                          className="avatar"
                          style={{ background: person.avatar ? 'transparent' : person.color }}
                          onClick={(e) => {
                            e.stopPropagation();
                            completeTask(task.id, person.id);
                          }}
                          title={`Mark as completed by ${person.name}`}
                        >
                          {person.avatar ? (
                            <img src={person.avatar} alt={person.name} className="avatar-image" />
                          ) : (
                            person.initial
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Tasks Section */}
        <div className="completed-section">
          <div className="section-title">Completed Tasks</div>
          {completedTasks.length === 0 ? (
            <div className="empty-gallery">
              <div className="empty-gallery-icon">📸</div>
              <p>No completed tasks yet</p>
              <p style={{ fontSize: '0.9em', marginTop: '10px' }}>
                Click on avatars above to assign and complete tasks!
              </p>
            </div>
          ) : (
            <div className="completed-gallery">
              {Object.entries(getCompletedByPerson()).map(([personId, data]) => {
                const totalCoins = data.tasks.reduce((sum, t) => sum + getTaskCoins(t), 0);
                return (
                  <div key={personId} className="completed-person-row">
                    <div className="completed-person-avatar">
                      <div className="avatar" style={{ background: data.person.avatar ? 'transparent' : data.person.color }}>
                        {data.person.avatar ? (
                          <img src={data.person.avatar} alt={data.person.name} className="avatar-image" />
                        ) : (
                          data.person.initial
                        )}
                      </div>
                      <div className="completed-person-name">{data.person.name}</div>
                      <div style={{ color: '#FFD700', fontSize: '0.8em', fontWeight: '700' }}>
                        {totalCoins} total
                      </div>
                    </div>
                    <div className="completed-tasks-gallery">
                      {data.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="completed-task-thumbnail"
                          onClick={() => handleTaskThumbnailClick(task)}
                          title={task.title}
                        >
                          <img 
                            src={task.cover_image_url || task.attachment_urls?.[0] || 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400'} 
                            alt={task.title} 
                          />
                          <div className="task-coins-badge">{getTaskCoins(task)}</div>
                          <div className="task-time-badge">{getTimeAgo(task.updated_at)}</div>
                          <div className="task-tooltip">{task.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {showModal && (
        <div className={`success-modal ${showModal ? 'active' : ''}`} onClick={() => setShowModal(false)}>
          <div className="success-content" onClick={(e) => e.stopPropagation()}>
            <div className="checkmark-container">
              <div className="checkmark-circle-bg"></div>
              <svg className="checkmark-circle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="60"/>
              </svg>
              <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
              </svg>
            </div>
            <div className="success-message">Congratulations {modalData.personName}!</div>
            <div className="success-task">You completed "{modalData.taskTitle}"</div>
            <div className="success-coins">
              <Coins size={24} />
              <span>{modalData.coins}</span>
              <span>earned!</span>
            </div>
          </div>
          {/* Confetti */}
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                background: ['#ff6b35', '#ff9a56', '#FFD700', '#FFA500', '#ff8c42'][Math.floor(Math.random() * 5)],
                animationDelay: `${Math.random() * 0.5}s`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskManagementHUD;