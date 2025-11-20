import axios from 'axios';

const API_BASE_URL = 'https://api2.onfire.so';

class OnFireAPI {
  constructor() {
    this.accessToken = localStorage.getItem('onfire_access_token');
    this.refreshToken = localStorage.getItem('onfire_refresh_token');
    this.userData = JSON.parse(localStorage.getItem('onfire_user_data') || 'null');
  }

  // Authentication
  async login(email, password) {
    try {
      const response = await axios.post(`${API_BASE_URL}/rpc/login_user`, {
        p_email: email,
        p_password: password
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = response.data[0];
      if (data.success) {
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.userData = data.user_data;

        localStorage.setItem('onfire_access_token', this.accessToken);
        localStorage.setItem('onfire_refresh_token', this.refreshToken);
        localStorage.setItem('onfire_user_data', JSON.stringify(this.userData));

        return { success: true, userData: this.userData };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed. Please try again.' 
      };
    }
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userData = null;
    localStorage.removeItem('onfire_access_token');
    localStorage.removeItem('onfire_refresh_token');
    localStorage.removeItem('onfire_user_data');
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  getUserData() {
    return this.userData;
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Conversations
  async getConversations() {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/rpc/get_user_conversations`,
        {
          p_conversation_type: 'group'
        },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  // Tasks
  async getTasks(conversationId) {
    try {
      let url = `${API_BASE_URL}/tasks?select=id,title,description,status,priority,cover_image_url,attachment_urls,assignee_user_ids,completed_by_user_id,created_at,updated_at,chat_id,estimated_time_minutes`;
      
      if (conversationId) {
        url += `&chat_id=eq.${conversationId}`;
      }
      
      url += '&order=created_at.desc';

      const response = await axios.get(url, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  async updateTask(taskId, updates) {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/tasks?id=eq.${taskId}`,
        updates,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async completeTask(taskId, userId) {
    return this.updateTask(taskId, {
      status: 'completed',
      completed_by_user_id: userId,
      progress_percentage: 100,
      updated_at: new Date().toISOString()
    });
  }

  async uncompleteTask(taskId) {
    return this.updateTask(taskId, {
      status: 'pending',
      completed_by_user_id: null,
      progress_percentage: 0,
      updated_at: new Date().toISOString()
    });
  }
}

export default new OnFireAPI();