// pages/index/index.js
Page({
  data: {
    patients: [], // 患者角色列表
    loading: true
  },

  onLoad() {
    this.loadPatients();
  },

  onShow() {
    // 每次显示页面时刷新列表
    this.loadPatients();
  },

  // 从云数据库加载患者角色列表
  async loadPatients() {
    wx.showLoading({ title: '加载中...' });
    try {
      const db = wx.cloud.database();
      const res = await db.collection('patients').get();
      this.setData({ 
        patients: res.data,
        loading: false
      });
      wx.hideLoading();
    } catch (e) {
      console.error('加载患者角色失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },

  // 选择患者角色，跳转到对话页面
  selectPatient(e) {
    const patientId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/chatBot/chatBot?patientId=${patientId}`
    });
  },

  // 跳转到历史记录页面
  goToHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  }
});
