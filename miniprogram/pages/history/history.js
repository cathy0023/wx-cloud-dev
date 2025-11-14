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
  viewConversation(e) {
    const conversationId = e.currentTarget.dataset.id;
    // 跳转到对话详情或报告页面
    // 先尝试查找是否有对应的报告
    db.collection('reports').where({
      conversationId: conversationId
    }).get().then(res => {
      if (res.data.length > 0) {
        // 有报告，跳转到报告页面
        wx.navigateTo({
          url: `/pages/report/report?reportId=${res.data[0]._id}`
        });
      } else {
        // 没有报告，显示对话详情
        wx.showModal({
          title: '对话详情',
          content: '该对话尚未生成报告',
          showCancel: false
        });
      }
    });
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

