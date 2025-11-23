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
      // Fetch all active conversations (both direct GET and RPC endpoint)
      const response = await axios.get(
        `${API_BASE_URL}/conversations?status=eq.active&order=last_message_at.desc,created_at.desc&select=id,name,conversation_type,status,description,avatar,message_count,last_message_at,created_at`,
        { headers: this.getAuthHeaders() }
      );
      return response.data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // Fallback to RPC endpoint if direct access fails
      try {
        const rpcResponse = await axios.post(
          `${API_BASE_URL}/rpc/get_user_conversations`,
          {},
          { headers: this.getAuthHeaders() }
        );
        return rpcResponse.data || [];
      } catch (rpcError) {
        console.error('Error fetching conversations via RPC:', rpcError);
        throw error;
      }
    }
  }

  // User Profiles
  async getUserProfiles(userIds = []) {
    try {
      if (!userIds || userIds.length === 0) return [];
      
      // Build query to fetch multiple user profiles
      const idsFilter = userIds.map(id => `user_id.eq.${id}`).join(',');
      const response = await axios.get(
        `${API_BASE_URL}/user_profiles?or=(${idsFilter})&select=user_id,display_name,profile_photo_url`,
        { headers: this.getAuthHeaders() }
      );
      return response.data || [];
    } catch (error) {
      console.error('Error fetching user profiles:', error);
      return [];
    }
  }

  async getUserProfile(userId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/user_profiles?user_id=eq.${userId}&select=user_id,display_name,profile_photo_url`,
        { headers: this.getAuthHeaders() }
      );
      return response.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  // Conversation Participants
  async getConversationParticipants(conversationId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/conversation_participants_extended?conversation_id=eq.${conversationId}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data || [];
    } catch (error) {
      console.error('Error fetching participants:', error);
      return [];
    }
  }

  // Tasks
  async getTasks(conversationId) {
    try {
      let url = `${API_BASE_URL}/tasks?select=id,title,description,status,priority,cover_image_url,attachment_urls,assignee_user_ids,completed_by_user_id,created_at,updated_at,chat_id,estimated_time_minutes,created_by_user_id,budget_cost`;
      
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
      status: 'not_started',
      completed_by_user_id: null,
      progress_percentage: 0,
      updated_at: new Date().toISOString()
    });
  }

  // Transactions
  async createTransaction(transactionData) {
    // Build payload matching the working curl format
    // NOTE: related_entity_id expects INTEGER, not UUID, so we exclude it
    const payload = {
      transaction_type: 'send',
      status: 'completed',
      from_user_id: transactionData.from_user_id,
      to_user_id: transactionData.to_user_id,
      amount: transactionData.amount,
      currency: 'PRF',
      fee: transactionData.fee || 0,
      net_amount: transactionData.net_amount || transactionData.amount,
      related_entity_type: transactionData.related_entity_type || 'task',
      description: transactionData.description || '',
      notes: transactionData.notes || ''
    };
    
    // Store task reference in metadata instead of related_entity_id
    // since related_entity_id expects integer but task IDs are UUIDs
    if (transactionData.metadata && Object.keys(transactionData.metadata).length > 0) {
      payload.metadata = transactionData.metadata;
    }
    
    console.log('Creating transaction with payload:', JSON.stringify(payload, null, 2));
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/transactions`,
        payload,
        { 
          headers: {
            ...this.getAuthHeaders(),
            'Prefer': 'return=representation'
          }
        }
      );
      console.log('Transaction created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating transaction:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Request payload was:', JSON.stringify(payload, null, 2));
      throw error;
    }
  }

  // Get transaction summary for a user
  async getTransactionSummary(userId) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/rpc/transactions_summary`,
        {
          p_user_uuid: userId
        },
        { headers: this.getAuthHeaders() }
      );
      return response.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching transaction summary:', error);
      return null;
    }
  }

  // Reversal Transaction (for uncomplete)
  async createReversalTransaction(transactionData) {
    // Same as createTransaction but with transaction_type: 'unsend'
    const payload = {
      transaction_type: 'unsend',
      status: 'completed',
      from_user_id: transactionData.from_user_id,
      to_user_id: transactionData.to_user_id,
      amount: transactionData.amount,
      currency: 'PRF',
      fee: transactionData.fee || 0,
      net_amount: transactionData.net_amount || transactionData.amount,
      related_entity_type: transactionData.related_entity_type || 'task',
      description: transactionData.description || '',
      notes: transactionData.notes || ''
    };
    
    if (transactionData.metadata && Object.keys(transactionData.metadata).length > 0) {
      payload.metadata = transactionData.metadata;
    }
    
    console.log('Creating reversal transaction with payload:', JSON.stringify(payload, null, 2));
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/transactions`,
        payload,
        { 
          headers: {
            ...this.getAuthHeaders(),
            'Prefer': 'return=representation'
          }
        }
      );
      console.log('Reversal transaction created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating reversal transaction:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Request payload was:', JSON.stringify(payload, null, 2));
      throw error;
    }
  }
}

export default new OnFireAPI();