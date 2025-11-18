// pages/chatBot/chatBot.js
const db = wx.cloud.database();

Page({
  data: {
    chatMode: "model",
    showBotAvatar: false, // 不显示头像，避免左侧留白
    patientId: '',
    patientInfo: null,
    conversationId: '',
    startTime: null,
    timeoutTimer: null,
    // 添加 agentConfig 用于语音功能（需要真实的 botId）
    agentConfig: {
      botId: "ibot-asr-ndwwryab2z", // 请替换为您在腾讯云控制台创建的 Bot ID
      allowVoice: true, // 启用语音功能
    },
    modelConfig: {
      modelProvider: "deepseek", // 不显示deepseek，改为显示患者信息
      quickResponseModel: "deepseek-chat", // 使用 deepseek-chat 模型
      logo: "",
      welcomeMsg: "",
    },
    systemPrompt: "",
  },

  async onLoad(options) {
    const patientId = options.patientId;
    if (patientId) {
      await this.loadPatientInfo(patientId);
      await this.createConversation(patientId);
      this.startTimeoutTimer();
    } else {
      wx.showToast({
        title: '请先选择患者角色',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载患者信息
  async loadPatientInfo(patientId) {
    try {
      const res = await db.collection('patients').doc(patientId).get();
      const patient = res.data;
      
      // 设置页面标题
      wx.setNavigationBarTitle({
        title: patient.name
      });

      // 构建欢迎语和systemPrompt
            // welcomeMsg是患者角色的开场白，由AI以患者身份说出
            const welcomeMsg = `${patient.background}\n\n你好，我是${patient.name}，${patient.description}。`;

            // systemPrompt明确告诉AI扮演患者角色，用户是心理咨询师
            const systemPrompt = `你正在扮演一位心理患者角色。以下是你的角色设定：

${patient.prompt}

重要规则：
1. 你是患者，正在接受心理咨询师的咨询
2. 用户（咨询师）会向你提问，你需要以患者的身份回答
3. 保持角色特征的一致性，表现出${patient.symptoms.join('、')}等症状
4. 不要扮演咨询师的角色，不要主动提供建议或分析
5. 以第一人称"我"来回答，就像真正的患者一样
6. 根据咨询师的提问自然地回应，不要过度主动`;

            // 根据患者类型判断使用扣子API还是deepseek
            // 焦虑症患者使用扣子API，其他患者使用deepseek
            const isAnxietyPatient = patient.category === "焦虑症";
            const modelProvider = isAnxietyPatient ? "coze" : "deepseek";
            const quickResponseModel = isAnxietyPatient ? "7566909917765107746" : "deepseek-chat";

            this.setData({
              patientId: patientId,
              patientInfo: patient,
              'modelConfig.welcomeMsg': welcomeMsg,
              'modelConfig.modelProvider': modelProvider,
              'modelConfig.quickResponseModel': quickResponseModel,
              // modelProvider 必须是模型组名称（如 "deepseek" 或 "coze"），不能是患者名称
              // 患者名称只用于显示，在 agent-ui 组件中已经改为显示"背景信息"
              systemPrompt: systemPrompt
            });
    } catch (e) {
      console.error('加载患者信息失败', e);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 创建对话记录
  async createConversation(patientId) {
    try {
      const startTime = new Date();
      // 云数据库会自动获取当前用户的openid，不需要手动传递
      const res = await db.collection('conversations').add({
        data: {
          patientId: patientId,
          patientName: this.data.patientInfo ? this.data.patientInfo.name : '',
          messages: [],
          startTime: startTime,
          status: '进行中'
        }
      });
      this.conversationId = res._id;
      this.setData({ startTime: startTime });
    } catch (e) {
      console.error('创建对话记录失败', e);
    }
  },

  // 监听agent-ui组件的消息添加事件
  onMessageAdd(e) {
    const message = e.detail.message;
    this.saveMessage(message);
  },

  // 监听agent-ui组件的消息完成事件
  onMessageComplete(e) {
    const message = e.detail.message;
    this.saveMessage(message);
  },

  // 保存对话消息到云数据库
  async saveMessage(message) {
    if (!this.conversationId) return;
    
    try {
      // 只保存role和content，简化消息格式
      const messageData = {
        role: message.role,
        content: message.content || '',
        timestamp: new Date()
      };
      
      await db.collection('conversations').doc(this.conversationId).update({
        data: {
          messages: db.command.push(messageData)
        }
      });
    } catch (e) {
      console.error('保存消息失败', e);
    }
  },

  // 开始30分钟超时计时器
  startTimeoutTimer() {
    // 30分钟 = 30 * 60 * 1000 毫秒
    const timeout = 30 * 60 * 1000;
    this.timeoutTimer = setTimeout(() => {
      wx.showModal({
        title: '提示',
        content: '对话已超过30分钟，是否结束对话并生成报告？',
        success: (res) => {
          if (res.confirm) {
            this.endConversation();
          } else {
            // 继续对话，重新计时
            this.startTimeoutTimer();
          }
        }
      });
    }, timeout);
  },

  // 清除超时计时器
  clearTimeoutTimer() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  },

  // 结束对话并生成报告
  async endConversation() {
    this.clearTimeoutTimer();
    
    wx.showLoading({ title: '正在生成报告...' });
    
    try {
      // 获取完整对话记录
      const convRes = await db.collection('conversations').doc(this.conversationId).get();
      const conversation = convRes.data;
      
      if (!conversation.messages || conversation.messages.length === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '对话记录为空',
          icon: 'none'
        });
        return;
      }

      // 调用云函数生成报告
      const res = await wx.cloud.callFunction({
        name: 'analyzeConversation',
        data: {
          conversationId: this.conversationId,
          messages: conversation.messages,
          patientInfo: this.data.patientInfo
        }
      });
      
      wx.hideLoading();
      
      console.log('云函数返回结果:', res);
      
      if (res.result && res.result.success) {
        // 如果云函数返回了完整的报告数据，直接传递过去
        const reportData = res.result.report || null;
        const reportId = res.result.reportId;
        
        // 跳转到报告页面，传递报告ID和报告数据
        wx.redirectTo({
          url: `/pages/report/report?reportId=${reportId}${reportData ? '&hasData=1' : ''}`
        });
        
        // 如果有报告数据，先保存到本地存储作为备用
        if (reportData) {
          wx.setStorageSync(`report_${reportId}`, reportData);
        }
      } else {
        const errorMsg = res.result?.error || res.errMsg || '生成报告失败';
        console.error('生成报告失败:', errorMsg, res);
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 3000
        });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('生成报告失败，异常信息:', e);
      wx.showModal({
        title: '生成报告失败',
        content: e.message || e.errMsg || '请检查云函数是否已正确部署，或查看控制台错误信息',
        showCancel: false
      });
    }
  },

  onUnload() {
    // 页面卸载时清除计时器
    this.clearTimeoutTimer();
  },

  onReady() {},

  onShow() {},

  onHide() {},

  onPullDownRefresh() {},

  onReachBottom() {},

  onShareAppMessage() {},
});
