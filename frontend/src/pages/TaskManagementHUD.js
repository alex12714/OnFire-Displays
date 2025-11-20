import React, { useState, useEffect } from 'react';
import './TaskManagementHUD.css';
import { Coins } from 'lucide-react';

const TaskManagementHUD = () => {
  const defaultPeople = [
    { id: 1, name: 'Alex', initial: 'A', color: '#ff6b35' },
    { id: 2, name: 'Sam', initial: 'S', color: '#ff8c42' },
    { id: 3, name: 'Jordan', initial: 'J', color: '#ff9a56' },
    { id: 4, name: 'Taylor', initial: 'T', color: '#ffa86b' },
    { id: 5, name: 'Morgan', initial: 'M', color: '#ffb680' }
  ];

  const defaultTasks = [
    { id: 1, title: 'Clean Kitchen', coins: 5, image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400' },
    { id: 2, title: 'Do Laundry', coins: 4, image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400' },
    { id: 3, title: 'Vacuum Living Room', coins: 3, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400' },
    { id: 4, title: 'Wash Dishes', coins: 3, image: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400' },
    { id: 5, title: 'Take Out Trash', coins: 2, image: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=400' },
    { id: 6, title: 'Clean Bathroom', coins: 5, image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400' },
    { id: 7, title: 'Mow Lawn', coins: 6, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400' },
    { id: 8, title: 'Organize Closet', coins: 4, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400' }
  ];

  const [people] = useState(() => {
    const saved = localStorage.getItem('taskHUD_people');
    return saved ? JSON.parse(saved) : defaultPeople;
  });

  const [tasks] = useState(() => {
    const saved = localStorage.getItem('taskHUD_tasks');
    return saved ? JSON.parse(saved) : defaultTasks;
  });

  const [completedTasks, setCompletedTasks] = useState(() => {
    const saved = localStorage.getItem('taskHUD_completed');
    return saved ? JSON.parse(saved) : [];
  });

  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ personName: '', taskTitle: '', coins: 0 });

  useEffect(() => {
    localStorage.setItem('taskHUD_people', JSON.stringify(people));
  }, [people]);

  useEffect(() => {
    localStorage.setItem('taskHUD_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('taskHUD_completed', JSON.stringify(completedTasks));
  }, [completedTasks]);

  const completeTask = (taskId, personId) => {
    const task = tasks.find(t => t.id === taskId);
    const person = people.find(p => p.id === personId);
    
    if (task && person) {
      setModalData({
        personName: person.name,
        taskTitle: task.title,
        coins: task.coins
      });
      setShowModal(true);
      
      setTimeout(() => {
        setCompletedTasks(prev => [...prev, {
          taskId: task.id,
          personId: person.id,
          taskTitle: task.title,
          personName: person.name,
          personInitial: person.initial,
          personColor: person.color,
          coins: task.coins,
          completedAt: Date.now()
        }]);
      }, 500);

      setTimeout(() => {
        setShowModal(false);
      }, 3000);
    }
  };

  const uncompleteTask = (taskId) => {
    setCompletedTasks(prev => prev.filter(ct => ct.taskId !== taskId));
  };

  const handleTaskThumbnailClick = (taskId, personName, completedAt) => {
    const canUncomplete = (Date.now() - completedAt) < 3600000;
    const task = tasks.find(t => t.id === taskId);
    
    if (canUncomplete && task && window.confirm(`Remove "${task.title}" from ${personName}'s completed tasks?`)) {
      uncompleteTask(taskId);
    } else if (!canUncomplete) {
      alert(`This task was completed more than 1 hour ago and cannot be undone.`);
    }
  };

  const getActiveTasks = () => {
    return tasks.filter(task => 
      !completedTasks.some(ct => ct.taskId === task.id)
    );
  };

  const getCompletedByPerson = () => {
    const grouped = {};
    completedTasks.forEach(ct => {
      if (!grouped[ct.personId]) grouped[ct.personId] = [];
      grouped[ct.personId].push(ct);
    });
    return grouped;
  };

  const getPersonProgress = (personId) => {
    const personTasks = completedTasks.filter(ct => ct.personId === personId);
    const totalCoins = personTasks.reduce((sum, ct) => sum + ct.coins, 0);
    
    return {
      total: totalCoins,
      dayHeight: Math.min((totalCoins / 10) * 100, 100),
      weekHeight: Math.min((totalCoins / 50) * 100, 100),
      monthHeight: Math.min((totalCoins / 200) * 100, 100)
    };
  };

  const getTimeAgo = (timestamp) => {
    const timeAgo = Math.floor((Date.now() - timestamp) / 60000);
    if (timeAgo === 0) return 'Now';
    if (timeAgo === 1) return '1m';
    if (timeAgo < 60) return `${timeAgo}m`;
    return `${Math.floor(timeAgo/60)}h`;
  };

  return (
    <div className="task-hud-container">
      <div className="task-hud-content">
        <h1 className="task-hud-title">Task Management HUD</h1>

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
                    <div className="avatar" style={{ background: person.color }}>
                      {person.initial}
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
          <div className="task-grid">
            {getActiveTasks().map(task => (
              <div key={task.id} className="task-card">
                <div className="task-coins">
                  <Coins size={20} />
                  <span>{task.coins}</span>
                </div>
                <img src={task.image} alt={task.title} className="task-image" />
                <div className="task-content">
                  <div className="task-title">{task.title}</div>
                  <div className="avatars-row">
                    {people.map(person => (
                      <div
                        key={person.id}
                        className="avatar"
                        style={{ background: person.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          completeTask(task.id, person.id);
                        }}
                        title={`Mark as completed by ${person.name}`}
                      >
                        {person.initial}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
              {Object.entries(getCompletedByPerson()).map(([personId, personTasks]) => {
                const person = personTasks[0];
                const totalCoins = personTasks.reduce((sum, ct) => sum + ct.coins, 0);
                return (
                  <div key={personId} className="completed-person-row">
                    <div className="completed-person-avatar">
                      <div className="avatar" style={{ background: person.personColor }}>
                        {person.personInitial}
                      </div>
                      <div className="completed-person-name">{person.personName}</div>
                      <div style={{ color: '#FFD700', fontSize: '0.8em', fontWeight: '700' }}>
                        {totalCoins} total
                      </div>
                    </div>
                    <div className="completed-tasks-gallery">
                      {personTasks.map((ct, index) => {
                        const task = tasks.find(t => t.id === ct.taskId);
                        return (
                          <div
                            key={`${ct.taskId}-${index}`}
                            className="completed-task-thumbnail"
                            onClick={() => handleTaskThumbnailClick(ct.taskId, ct.personName, ct.completedAt)}
                            title={ct.taskTitle}
                          >
                            <img src={task?.image} alt={ct.taskTitle} />
                            <div className="task-coins-badge">{ct.coins}</div>
                            <div className="task-time-badge">{getTimeAgo(ct.completedAt)}</div>
                            <div className="task-tooltip">{ct.taskTitle}</div>
                          </div>
                        );
                      })}
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