const cloud = require('wx-server-sdk');
// 明确指定环境ID，与小程序端保持一致
cloud.init({
  env: 'cy-test-3giyof3r7d1699ff'
});

// 注意：在生产环境中，应该将API密钥存储在云函数环境变量中
// 在云开发控制台 -> 云函数 -> 环境变量中配置 COZE_API_TOKEN
const COZE_API_TOKEN = process.env.COZE_API_TOKEN || 'pat_7A3SnfbRyMzFBwDRwxsZ97tYlhSJ5GzCjkfNO7Oc6vcui7r3WX5m5ypr0A9OlECw';
const COZE_API_URL = 'https://api.coze.cn/v3/chat';
const COZE_BOT_ID = '7566909917765107746';

exports.main = async (event, context) => {
  const { user_id, additional_messages } = event;
  const wxContext = cloud.getWXContext();
  
  // 如果没有传入user_id，使用openid
  const userId = user_id || wxContext.OPENID || 'user_' + Date.now();
  
  console.log('云函数被调用，参数:', {
    userId: userId,
    messagesCount: additional_messages ? additional_messages.length : 0,
    hasOpenId: !!wxContext.OPENID
  });
  
  try {
    // 构建请求数据
    const requestData = {
      bot_id: COZE_BOT_ID,
      user_id: userId,
      additional_messages: additional_messages || [],
      stream: true // 使用流式响应
    };

    // 调用扣子API
    const https = require('https');
    const url = require('url');
    
    const parsedUrl = url.parse(COZE_API_URL);
    const postData = JSON.stringify(requestData);
    
    console.log('准备调用扣子API:', {
      url: COZE_API_URL,
      botId: COZE_BOT_ID,
      userId: userId,
      messagesCount: requestData.additional_messages.length
    });
    
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${COZE_API_TOKEN}`,
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res) => {
        // 流式响应处理
        const chunks = [];
        let buffer = '';
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
          buffer += chunk.toString();
          
          // 处理SSE格式的数据流
          // SSE格式：data: {...}\n\n
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行
        });
        
        res.on('end', () => {
          const allData = chunks.map(chunk => chunk.toString()).join('');
          
          console.log('扣子API响应:', {
            statusCode: res.statusCode,
            dataLength: allData.length,
            preview: allData.substring(0, 200)
          });
          
          if (res.statusCode === 200) {
            // 先检查是否是JSON错误响应（非流式）
            try {
              const jsonResponse = JSON.parse(allData);
              // 如果包含错误码，说明是错误响应
              if (jsonResponse.code && jsonResponse.code !== 0) {
                console.error('扣子API返回错误:', jsonResponse);
                return reject({
                  success: false,
                  error: jsonResponse.msg || jsonResponse.message || `扣子API错误: ${jsonResponse.code}`,
                  code: jsonResponse.code,
                  rawData: allData
                });
              }
            } catch (e) {
              // 不是JSON格式，继续按SSE流式处理
            }
            
            // 解析所有SSE事件
            // SSE格式：event: xxx\ndata: {...}\n\n 或 event:xxx\ndata:{...}\n\n
            const events = [];
            
            // 按空行分割事件块
            const eventBlocks = allData.split(/\n\n+/);
            
            for (const block of eventBlocks) {
              if (!block.trim()) continue;
              
              const lines = block.split('\n');
              let eventType = null;
              let eventData = null;
              
              for (const line of lines) {
                const trimmed = line.trim();
                
                // 解析event行
                if (trimmed.startsWith('event:')) {
                  eventType = trimmed.substring(6).trim();
                  continue;
                }
                
                // 解析data行
                if (trimmed.startsWith('data:')) {
                  const dataStr = trimmed.substring(5).trim();
                  if (dataStr === '[DONE]' || dataStr === '') {
                    continue;
                  }
                  try {
                    eventData = JSON.parse(dataStr);
                  } catch (e) {
                    console.warn('解析SSE data失败:', dataStr.substring(0, 100), e.message);
                    continue;
                  }
                }
              }
              
              // 如果有数据，添加到事件列表
              if (eventData) {
                // 检查是否是错误响应
                if (eventData.code && eventData.code !== 0) {
                  console.error('扣子API流式响应中包含错误:', eventData);
                  return reject({
                    success: false,
                    error: eventData.msg || eventData.message || `扣子API错误: ${eventData.code}`,
                    code: eventData.code,
                    rawData: allData
                  });
                }
                
                // 保留event类型信息
                const eventWithType = {
                  ...eventData,
                  eventType: eventType || 'unknown'
                };
                events.push(eventWithType);
              }
            }
            
            console.log('解析完成，事件数量:', events.length);
            if (events.length > 0) {
              console.log('第一个事件示例:', JSON.stringify(events[0]).substring(0, 200));
            }
            
            resolve({
              success: true,
              events: events,
              rawData: allData,
              userId: userId
            });
          } else {
            // 读取错误响应
            let errorMessage = `API请求失败: ${res.statusCode}`;
            try {
              const errorData = JSON.parse(allData);
              errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
              // 如果无法解析错误响应，使用原始数据
              if (allData) {
                errorMessage = allData;
              }
            }
            
            reject({
              success: false,
              error: errorMessage,
              data: allData,
              statusCode: res.statusCode
            });
          }
        });
      });
      
      req.on('error', (e) => {
        console.error('请求错误:', e);
        reject({
          success: false,
          error: e.message || '网络请求失败'
        });
      });
      
      req.write(postData);
      req.end();
    });
    
    return result;
  } catch (error) {
    console.error('调用扣子API失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      error: error.error || error.message || '调用扣子API失败',
      errorDetail: error.stack || error.toString()
    };
  }
};

