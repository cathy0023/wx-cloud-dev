// pages/history/history.js
const db = wx.cloud.database();

Page({
  data: {
    conversations: [],
    loading: true,
    filterCategory: '', // 筛选的患者类型
    categories: ['全部', '焦虑症', '抑郁症', '强迫症', '社交恐惧症', '创伤后应激障碍']
  },

  onLoad() {
    this.loadConversations();
  },

  onShow() {
    // 每次显示时刷新列表
    this.loadConversations();
  },

  // 加载历史对话记录
  async loadConversations() {
    wx.showLoading({ title: '加载中...' });
    try {
      // 云数据库会自动根据当前用户权限过滤，不需要手动指定userId
      let query = db.collection('conversations')
        .orderBy('startTime', 'desc')
        .limit(50);

      const res = await query.get();
      
      // 应用筛选和格式化日期
      let conversations = res.data;
      if (this.data.filterCategory && this.data.filterCategory !== '全部') {
        conversations = conversations.filter(conv => {
          // 需要从patients集合查询category，这里简化处理
          return conv.patientName && conv.patientName.includes(this.data.filterCategory);
        });
      }

      // 格式化日期
      conversations = conversations.map(conv => {
        if (conv.startTime) {
          const date = conv.startTime instanceof Date ? conv.startTime : new Date(conv.startTime);
          conv.formattedTime = this.formatDate(date);
        }
        return conv;
      });

      this.setData({
        conversations: conversations,
        loading: false
      });
      wx.hideLoading();
    } catch (e) {
      console.error('加载历史记录失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 筛选患者类型
  onFilterChange(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ filterCategory: category });
    this.loadConversations();
  },

  // 查看对话详情
  async viewConversation(e) {
    const conversationId = e.currentTarget.dataset.id;
    wx.showLoading({ title: '查询中...' });
    
    try {
      // 先检查对话记录状态
      const convRes = await db.collection('conversations').doc(conversationId).get();
      const conversation = convRes.data;
      
      console.log('对话记录信息:', {
        conversationId: conversationId,
        status: conversation.status,
        hasMessages: !!conversation.messages,
        messageCount: conversation.messages ? conversation.messages.length : 0
      });
      
      // 如果对话未结束，提示用户
      if (conversation.status !== '已结束') {
        wx.hideLoading();
        wx.showModal({
          title: '对话详情',
          content: '该对话尚未结束，无法查看报告',
          showCancel: false
        });
        return;
      }
      
      // 使用云函数查询报告，避免小程序端权限问题
      const reportRes = await wx.cloud.callFunction({
        name: 'getReport',
        data: {
          conversationId: conversationId
        }
      });
      
      wx.hideLoading();
      
      console.log('查询报告结果（云函数）:', {
        conversationId: conversationId,
        result: reportRes.result
      });
      
      if (reportRes.result && reportRes.result.success && reportRes.result.reportId) {
        // 有报告，将报告数据保存到本地存储，避免报告页面再次查询时权限问题
        if (reportRes.result.report) {
          wx.setStorageSync(`report_${reportRes.result.reportId}`, reportRes.result.report);
          console.log('报告数据已保存到本地存储');
        }
        
        // 跳转到报告页面
        wx.navigateTo({
          url: `/pages/report/report?reportId=${reportRes.result.reportId}`
        });
      } else {
        // 没有报告，显示对话详情
        const errorMsg = reportRes.result?.error || '未找到报告';
        console.warn('报告查询失败:', errorMsg);
        
        wx.showModal({
          title: '对话详情',
          content: `该对话尚未生成报告。\n\n错误信息：${errorMsg}`,
          showCancel: false,
          confirmText: '确定',
          success: (res) => {
            if (res.confirm) {
              console.warn('报告查询失败，可能的原因：');
              console.warn('1. 报告确实未生成');
              console.warn('2. 报告生成时保存失败');
              console.warn('3. 数据库权限或索引问题');
            }
          }
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('查询报告失败:', error);
      
      // 详细记录错误信息
      const errorInfo = {
        errCode: error.errCode,
        errMsg: error.errMsg,
        message: error.message,
        conversationId: conversationId
      };
      console.error('错误详情:', errorInfo);
      
      // 如果查询失败，可能是权限问题或网络问题
      wx.showModal({
        title: '查询失败',
        content: `查询报告时出错：${error.errMsg || error.message || '未知错误'}\n\n请检查：\n1. 网络连接是否正常\n2. 数据库权限是否正确\n3. 索引是否已创建`,
        showCancel: false
      });
    }
  },

  // 删除对话记录
  deleteConversation(e) {
    const conversationId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条对话记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 删除对话记录
            await db.collection('conversations').doc(conversationId).remove();
            // 删除关联的报告
            const reports = await db.collection('reports').where({
              conversationId: conversationId
            }).get();
            for (let report of reports.data) {
              await db.collection('reports').doc(report._id).remove();
            }
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            this.loadConversations();
          } catch (e) {
            console.error('删除失败', e);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
});

