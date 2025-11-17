const cloud = require('wx-server-sdk');
cloud.init({
  env: 'cy-test-3giyof3r7d1699ff'
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { conversationId, reportId } = event;
  const wxContext = cloud.getWXContext();
  
  try {
    // 如果提供了reportId，直接通过reportId查询
    if (reportId) {
      console.log('通过reportId查询报告:', {
        reportId: reportId,
        openid: wxContext.OPENID
      });
      
      try {
        const res = await db.collection('reports').doc(reportId).get();
        if (res.data) {
          console.log('通过reportId找到报告');
          return {
            success: true,
            report: res.data,
            reportId: res.data._id
          };
        }
      } catch (docError) {
        console.warn('通过reportId查询失败，尝试通过conversationId查询:', docError);
        // 如果通过reportId查询失败，继续尝试通过conversationId查询
      }
    }
    
    // 如果没有提供reportId或通过reportId查询失败，通过conversationId查询
    if (!conversationId) {
      return {
        success: false,
        error: '请提供conversationId或reportId'
      };
    }
    
    console.log('查询报告，参数:', {
      conversationId: conversationId,
      openid: wxContext.OPENID
    });
    
    // 在云函数中查询报告，使用当前用户的openid
    const res = await db.collection('reports').where({
      conversationId: conversationId,
      _openid: wxContext.OPENID
    }).get();
    
    console.log('查询结果:', {
      conversationId: conversationId,
      reportCount: res.data.length,
      reports: res.data.map(r => ({
        _id: r._id,
        conversationId: r.conversationId
      }))
    });
    
    if (res.data && res.data.length > 0) {
      return {
        success: true,
        report: res.data[0],
        reportId: res.data[0]._id
      };
    }
    
    // 如果没有找到，尝试不指定_openid查询（云函数有更高权限）
    // 这样可以找到所有匹配conversationId的报告
    const res2 = await db.collection('reports').where({
      conversationId: conversationId
    }).get();
    
    console.log('不指定_openid的查询结果:', {
      conversationId: conversationId,
      reportCount: res2.data.length,
      queryOpenid: wxContext.OPENID,
      reportOpenids: res2.data.map(r => r._openid)
    });
    
    if (res2.data && res2.data.length > 0) {
      // 优先返回匹配当前用户openid的报告
      const matchedReport = res2.data.find(r => r._openid === wxContext.OPENID);
      if (matchedReport) {
        console.log('找到匹配_openid的报告');
        return {
          success: true,
          report: matchedReport,
          reportId: matchedReport._id
        };
      } else {
        // 如果没有匹配的，返回第一个找到的报告（可能是权限问题导致的_openid不一致）
        console.warn('找到报告但_openid不匹配，返回第一个报告:', {
          queryOpenid: wxContext.OPENID,
          reportOpenid: res2.data[0]._openid
        });
        return {
          success: true,
          report: res2.data[0],
          reportId: res2.data[0]._id,
          warning: '报告_openid与当前用户不一致，但已返回报告'
        };
      }
    }
    
    // 完全没有找到报告
    return {
      success: false,
      error: '未找到报告',
      reportCount: 0,
      conversationId: conversationId
    };
  } catch (error) {
    console.error('查询报告失败:', error);
    return {
      success: false,
      error: error.message || error.errMsg || '查询失败',
      errCode: error.errCode
    };
  }
};

