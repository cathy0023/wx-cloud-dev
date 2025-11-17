// 数据库初始化工具

// 预设患者角色数据
const defaultPatients = [
  {
    name: "焦虑症患者-谢女士",
    description: "23岁，未婚的小学老师，深陷工作完美主义漩涡近半年",
    symptoms: ["焦虑", "健康受损", "完美主义","工作压力大"],
    background: "最近项目deadline临近，经常加班到深夜，感到压力很大，晚上难以入睡，白天注意力难以集中。",
    prompt: "一位 23 岁未婚的小学老师。成长于双中学老师家庭，从小受父母 “需付出 120% 努力” 的高压要求影响，深陷工作完美主义漩涡近半年。因完美主义，健康受损（如气短、偏头痛），恋爱关系也受到严重影响，渴望找到工作与生活的平衡，前来向心理咨询师寻求帮助。",
    avatar: "",
    category: "焦虑症"
  },
  {
    name: "抑郁症患者-小王",
    description: "25岁，大学生，情绪低落持续2个月",
    symptoms: ["情绪低落", "兴趣减退", "疲劳乏力"],
    background: "最近两个月情绪一直很低落，对以前喜欢的事情都提不起兴趣，感觉做什么都没意思，经常感到疲劳。",
    prompt: "你是一位25岁的大学生，最近两个月情绪一直很低落，对以前喜欢的事情都提不起兴趣，感觉做什么都没意思，经常感到疲劳。在咨询中，你会表现出情绪低落、语速较慢、声音低沉，经常说'没意思'、'不想做'、'很累'等。你正在接受心理咨询，咨询师会向你提问，你需要以患者的身份如实回答。",
    avatar: "",
    category: "抑郁症"
  },
  {
    name: "强迫症患者-小张",
    description: "30岁，会计，反复检查行为",
    symptoms: ["反复检查", "强迫思维", "焦虑不安"],
    background: "总是担心工作出错，反复检查账目，即使检查了很多遍还是不放心，明知道没必要但控制不住。",
    prompt: "你是一位30岁的会计，总是担心工作出错，反复检查账目，即使检查了很多遍还是不放心，明知道没必要但控制不住。在咨询中，你会表现出焦虑、反复确认、担心出错，经常提到'不放心'、'再检查一遍'、'万一错了怎么办'等。你正在接受心理咨询，咨询师会向你提问，你需要以患者的身份如实回答。",
    avatar: "",
    category: "强迫症"
  },
  {
    name: "社交恐惧症患者-小陈",
    description: "22岁，应届毕业生，害怕社交场合",
    symptoms: ["社交回避", "紧张焦虑", "自我评价低"],
    background: "害怕在公共场合说话，担心被别人评价，面试时紧张得说不出话来，平时也尽量避免社交活动。",
    prompt: "你是一位22岁的应届毕业生，害怕在公共场合说话，担心被别人评价，面试时紧张得说不出话来，平时也尽量避免社交活动。在咨询中，你会表现出紧张、声音小、回避眼神接触，经常提到'害怕'、'紧张'、'不知道说什么'、'别人会怎么看我'等。你正在接受心理咨询，咨询师会向你提问，你需要以患者的身份如实回答。",
    avatar: "",
    category: "社交恐惧症"
  },
  {
    name: "创伤后应激障碍患者-小刘",
    description: "35岁，经历过交通事故，出现闪回和回避",
    symptoms: ["闪回", "回避", "警觉性增高"],
    background: "半年前经历了一次严重的交通事故，现在经常想起当时的场景，不敢开车，听到汽车鸣笛声就会紧张。",
    prompt: "你是一位35岁的上班族，半年前经历了一次严重的交通事故，现在经常想起当时的场景，不敢开车，听到汽车鸣笛声就会紧张。在咨询中，你会表现出对相关话题的回避、情绪激动、描述创伤经历时的紧张，经常提到'不敢'、'想起就害怕'、'控制不住'等。你正在接受心理咨询，咨询师会向你提问，你需要以患者的身份如实回答。",
    avatar: "",
    category: "创伤后应激障碍"
  }
];

// 初始化patients集合并插入预设数据
async function initPatients() {
  try {
    const db = wx.cloud.database();
    const countRes = await db.collection('patients').count();
    if (countRes.total === 0) {
      console.log('开始初始化患者角色数据...');
      // 批量插入预设患者角色数据
      for (let patient of defaultPatients) {
        try {
          await db.collection('patients').add({
            data: {
              ...patient,
              createTime: db.serverDate()
            }
          });
        } catch (e) {
          console.error('插入患者角色失败', e);
        }
      }
      console.log('患者角色数据初始化完成');
    } else {
      console.log('患者角色数据已存在，跳过初始化');
    }
  } catch (e) {
    // 集合不存在时会自动创建
    console.log('初始化patients集合', e);
    // 如果集合不存在，尝试创建并插入数据
    try {
      const db = wx.cloud.database();
      for (let patient of defaultPatients) {
        await db.collection('patients').add({
          data: {
            ...patient,
            createTime: db.serverDate()
          }
        });
      }
      console.log('患者角色数据初始化完成（首次创建）');
    } catch (err) {
      console.error('初始化失败', err);
    }
  }
}

// 更新患者角色数据（根据name字段匹配并更新，添加新的患者）
async function updatePatients(forceUpdate = false) {
  try {
    const db = wx.cloud.database();
    console.log('开始更新患者角色数据...');
    
    // 获取所有现有患者
    const existingRes = await db.collection('patients').get();
    const existingPatients = existingRes.data;
    
    let updatedCount = 0;
    let addedCount = 0;
    let deletedCount = 0;
    
    // 遍历默认患者数据
    for (let patient of defaultPatients) {
      const existingPatient = existingPatients.find(p => p.name === patient.name);
      
      if (existingPatient) {
        // 如果存在，根据forceUpdate决定是否更新
        if (forceUpdate) {
          try {
            // 先删除旧记录
            await db.collection('patients').doc(existingPatient._id).remove();
            // 再添加新记录（这样可以确保完全替换，包括删除旧字段）
            await db.collection('patients').add({
              data: {
                ...patient,
                createTime: db.serverDate()
              }
            });
            updatedCount++;
            console.log(`已更新患者: ${patient.name}`);
          } catch (e) {
            console.error(`更新患者失败 ${patient.name}:`, e);
          }
        } else {
          console.log(`患者已存在，跳过: ${patient.name}`);
        }
      } else {
        // 如果不存在，添加新患者
        try {
          await db.collection('patients').add({
            data: {
              ...patient,
              createTime: db.serverDate()
            }
          });
          addedCount++;
          console.log(`已添加新患者: ${patient.name}`);
        } catch (e) {
          console.error(`添加患者失败 ${patient.name}:`, e);
        }
      }
    }
    
    // 如果forceUpdate为true，删除不在defaultPatients中的患者
    if (forceUpdate) {
      const defaultNames = defaultPatients.map(p => p.name);
      for (let existingPatient of existingPatients) {
        if (!defaultNames.includes(existingPatient.name)) {
          try {
            await db.collection('patients').doc(existingPatient._id).remove();
            deletedCount++;
            console.log(`已删除不在默认列表中的患者: ${existingPatient.name}`);
          } catch (e) {
            console.error(`删除患者失败 ${existingPatient.name}:`, e);
          }
        }
      }
    }
    
    console.log(`患者角色数据更新完成: 更新 ${updatedCount} 条，新增 ${addedCount} 条，删除 ${deletedCount} 条`);
    return {
      success: true,
      updated: updatedCount,
      added: addedCount,
      deleted: deletedCount
    };
  } catch (e) {
    console.error('更新患者角色数据失败', e);
    return {
      success: false,
      error: e.message || e.errMsg
    };
  }
}

// 强制重置患者角色数据（删除所有现有数据并重新插入）
async function resetPatients() {
  try {
    const db = wx.cloud.database();
    console.log('开始重置患者角色数据...');
    
    // 获取所有现有患者
    const existingRes = await db.collection('patients').get();
    const existingPatients = existingRes.data;
    
    // 删除所有现有患者
    for (let patient of existingPatients) {
      try {
        await db.collection('patients').doc(patient._id).remove();
      } catch (e) {
        console.error(`删除患者失败 ${patient.name}:`, e);
      }
    }
    
    console.log(`已删除 ${existingPatients.length} 条现有患者数据`);
    
    // 重新插入默认患者数据
    for (let patient of defaultPatients) {
      try {
        await db.collection('patients').add({
          data: {
            ...patient,
            createTime: db.serverDate()
          }
        });
      } catch (e) {
        console.error(`插入患者角色失败 ${patient.name}:`, e);
      }
    }
    
    console.log(`患者角色数据重置完成，已插入 ${defaultPatients.length} 条数据`);
    return {
      success: true,
      deleted: existingPatients.length,
      added: defaultPatients.length
    };
  } catch (e) {
    console.error('重置患者角色数据失败', e);
    return {
      success: false,
      error: e.message || e.errMsg
    };
  }
}

// 初始化reports集合（确保集合存在）
async function initReportsCollection() {
  try {
    const db = wx.cloud.database();
    // 先尝试添加一条空记录来触发集合创建（如果不存在）
    try {
      await db.collection('reports').add({
        data: {
          _temp: true,
          createTime: db.serverDate()
        }
      });
      // 立即删除这条临时记录
      const tempRes = await db.collection('reports').where({
        _temp: true
      }).get();
      if (tempRes.data.length > 0) {
        await db.collection('reports').doc(tempRes.data[0]._id).remove();
      }
      console.log('reports集合已创建');
    } catch (addError) {
      // 如果添加失败，尝试查询（集合可能已存在）
      try {
        await db.collection('reports').limit(1).get();
        console.log('reports集合已存在');
      } catch (queryError) {
        console.log('初始化reports集合失败', queryError);
      }
    }
  } catch (e) {
    console.log('初始化reports集合', e);
  }
}

// 初始化conversations集合（确保集合存在）
async function initConversationsCollection() {
  try {
    const db = wx.cloud.database();
    // 尝试查询一次，如果集合不存在会自动创建
    await db.collection('conversations').limit(1).get();
    console.log('conversations集合已就绪');
  } catch (e) {
    console.log('初始化conversations集合', e);
  }
}

module.exports = {
  initPatients: initPatients,
  updatePatients: updatePatients,
  resetPatients: resetPatients,
  initReportsCollection: initReportsCollection,
  initConversationsCollection: initConversationsCollection
};

