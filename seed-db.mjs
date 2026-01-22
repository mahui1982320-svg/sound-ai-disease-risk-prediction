import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('开始生成种子数据...');

  // 清空现有数据
  await connection.execute('DELETE FROM review_logs');
  await connection.execute('DELETE FROM alarm_records');
  await connection.execute('DELETE FROM elderly');

  // 插入虚拟老人数据
  const elderlyData = [
    {
      name: '张大爷',
      roomNumber: '101',
      address: '北京市朝阳区某小区',
      healthStatus: '高血压，行动缓慢，需要护理员协助',
      carerName: '李护理',
      carerPhone: '13800138001',
      emergencyContact: '张女士',
      emergencyPhone: '13900139001',
      notes: '每天下午3点需要服用降压药'
    },
    {
      name: '王奶奶',
      roomNumber: '102',
      address: '北京市朝阳区某小区',
      healthStatus: '糖尿病，行动不便，容易跌倒',
      carerName: '王护理',
      carerPhone: '13800138002',
      emergencyContact: '王先生',
      emergencyPhone: '13900139002',
      notes: '需要定期检查血糖'
    },
    {
      name: '李爷爷',
      roomNumber: '103',
      address: '北京市朝阳区某小区',
      healthStatus: '心脏病，行动能力一般',
      carerName: '陈护理',
      carerPhone: '13800138003',
      emergencyContact: '李儿子',
      emergencyPhone: '13900139003',
      notes: '随身携带硝酸甘油'
    },
    {
      name: '刘奶奶',
      roomNumber: '104',
      address: '北京市朝阳区某小区',
      healthStatus: '阿尔茨海默病早期，记忆力下降',
      carerName: '孙护理',
      carerPhone: '13800138004',
      emergencyContact: '刘女儿',
      emergencyPhone: '13900139004',
      notes: '容易走失，需要24小时监护'
    },
    {
      name: '陈爷爷',
      roomNumber: '105',
      address: '北京市朝阳区某小区',
      healthStatus: '腰椎间盘突出，行动困难',
      carerName: '周护理',
      carerPhone: '13800138005',
      emergencyContact: '陈孙子',
      emergencyPhone: '13900139005',
      notes: '不能弯腰，需要帮助穿衣'
    }
  ];

  const elderlyIds = [];
  for (const elderly of elderlyData) {
    const [result] = await connection.execute(
      `INSERT INTO elderly (name, roomNumber, address, health_status, carer_name, carer_phone, emergencyContact, emergencyPhone, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [elderly.name, elderly.roomNumber, elderly.address, elderly.healthStatus, elderly.carerName, elderly.carerPhone, elderly.emergencyContact, elderly.emergencyPhone, elderly.notes]
    );
    elderlyIds.push(result.insertId);
  }

  console.log(`✅ 已插入 ${elderlyIds.length} 个老人档案`);

  // 插入虚拟报警数据
  const alarmData = [
    { elderlyId: elderlyIds[0], eventType: 'fall', confidenceScore: 85, audioUrl: 'https://example.com/audio/fall_1.mp3', reviewStatus: 'pending' },
    { elderlyId: elderlyIds[0], eventType: 'cough', confidenceScore: 72, audioUrl: 'https://example.com/audio/cough_1.mp3', reviewStatus: 'confirmed' },
    { elderlyId: elderlyIds[1], eventType: 'scream', confidenceScore: 92, audioUrl: 'https://example.com/audio/scream_1.mp3', reviewStatus: 'confirmed' },
    { elderlyId: elderlyIds[1], eventType: 'moan', confidenceScore: 68, audioUrl: 'https://example.com/audio/moan_1.mp3', reviewStatus: 'falseAlarm' },
    { elderlyId: elderlyIds[2], eventType: 'fall', confidenceScore: 88, audioUrl: 'https://example.com/audio/fall_2.mp3', reviewStatus: 'pending' },
    { elderlyId: elderlyIds[2], eventType: 'cough', confidenceScore: 65, audioUrl: 'https://example.com/audio/cough_2.mp3', reviewStatus: 'confirmed' },
    { elderlyId: elderlyIds[3], eventType: 'scream', confidenceScore: 78, audioUrl: 'https://example.com/audio/scream_2.mp3', reviewStatus: 'pending' },
    { elderlyId: elderlyIds[3], eventType: 'moan', confidenceScore: 55, audioUrl: 'https://example.com/audio/moan_2.mp3', reviewStatus: 'falseAlarm' },
    { elderlyId: elderlyIds[4], eventType: 'fall', confidenceScore: 91, audioUrl: 'https://example.com/audio/fall_3.mp3', reviewStatus: 'confirmed' },
    { elderlyId: elderlyIds[4], eventType: 'cough', confidenceScore: 70, audioUrl: 'https://example.com/audio/cough_3.mp3', reviewStatus: 'pending' },
  ];

  for (const alarm of alarmData) {
    await connection.execute(
      `INSERT INTO alarm_records (elderly_id, event_type, confidence_score, audio_url, review_status) 
       VALUES (?, ?, ?, ?, ?)`,
      [alarm.elderlyId, alarm.eventType, alarm.confidenceScore, alarm.audioUrl, alarm.reviewStatus]
    );
  }

  console.log(`✅ 已插入 ${alarmData.length} 条报警记录`);
  console.log('✅ 种子数据生成完成！');

} catch (error) {
  console.error('❌ 错误:', error);
} finally {
  await connection.end();
}
