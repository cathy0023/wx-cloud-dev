// pages/report/report.js
const db = wx.cloud.database();

Page({
  data: {
    reportId: '',
    report: null,
    loading: true
  },

  onLoad(options) {
    const reportId = options.reportId;
    if (reportId) {
      this.setData({ reportId: reportId });
      
      // 先尝试从本地存储加载（如果云函数返回了数据）
      const cachedReport = wx.getStorageSync(`report_${reportId}`);
      if (cachedReport) {
        console.log('从本地存储加载报告数据');
        // 格式化日期
        if (cachedReport.createTime) {
          const date = cachedReport.createTime instanceof Date ? cachedReport.createTime : new Date(cachedReport.createTime);
          cachedReport.formattedDate = this.formatDate(date);
        }
        this.setData({
          report: cachedReport,
          loading: false
        });
        // 清除缓存
        wx.removeStorageSync(`report_${reportId}`);
        return;
      }
      
      // 如果是临时ID（以temp_开头），说明报告未保存到数据库，不应该尝试加载
      if (reportId.startsWith('temp_')) {
        wx.showModal({
          title: '提示',
          content: '报告数据未保存到数据库，请重新生成报告。',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
        return;
      }
      
      // 从数据库加载
      this.loadReport(reportId);
    } else {
      wx.showToast({
        title: '报告ID不存在',
        icon: 'none'
      });
    }
  },

  // 加载报告数据
  async loadReport(reportId) {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await db.collection('reports').doc(reportId).get();
      const report = res.data;
      
      if (!report) {
        throw new Error('报告数据为空');
      }
      
      // 格式化日期
      if (report.createTime) {
        const date = report.createTime instanceof Date ? report.createTime : new Date(report.createTime);
        report.formattedDate = this.formatDate(date);
      }
      
      this.setData({
        report: report,
        loading: false
      });
      wx.hideLoading();
    } catch (e) {
      console.error('加载报告失败', e);
      wx.hideLoading();
      
      // 检查是否是文档不存在或权限问题
      const errorMsg = e.errMsg || e.message || '';
      if (errorMsg.includes('cannot find document') || errorMsg.includes('not exist')) {
        wx.showModal({
          title: '报告不存在',
          content: '报告可能尚未保存成功，或您没有权限访问此报告。请返回历史记录查看。',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      } else {
        wx.showToast({
          title: '加载失败: ' + (errorMsg || '未知错误'),
          icon: 'none',
          duration: 3000
        });
      }
    }
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 返回历史记录
  goToHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  // 返回首页
  goToIndex() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});

