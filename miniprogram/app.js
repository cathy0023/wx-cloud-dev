// app.js
const { initPatients } = require('./utils/dbInit.js');

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: "cy-test-3giyof3r7d1699ff",
        traceUser: true,
      });
      
      // 初始化数据库和预设患者角色数据
      initPatients();
      
      // 初始化其他数据库集合（确保集合存在）
      const { initReportsCollection, initConversationsCollection } = require('./utils/dbInit.js');
      initReportsCollection();
      initConversationsCollection();
    }
  },
});
