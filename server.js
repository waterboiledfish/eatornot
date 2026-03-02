/**
 * 吃了吗 - AI健康饮食助手后端服务
 * 简化版 - 确保Vercel能正常工作
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// API密钥
const API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-e4bc3b9e87b841d2ae8a1d301772305a';

// 内存存储
const users = new Map();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 模拟响应
function generateMockResponse() {
    const foods = ['宫保鸡丁', '清炒西兰花', '米饭', '番茄炒蛋'];
    return {
        foods: [foods[Math.floor(Math.random() * foods.length)]],
        nutrition: { calories: 500, protein: 20, carbs: 60, fat: 15 },
        riskLevel: 'safe',
        riskMessage: '安全',
        dietSuggestions: ['营养均衡', '建议细嚼慢咽'],
        lifeSuggestions: ['保持规律饮食', '每天饮水2000ml']
    };
}

// 注册
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ error: '请输入用户名和密码', success: false });
    }
    if (users.has(username)) {
        return res.json({ error: '用户名已存在', success: false });
    }
    users.set(username, { password, healthData: {} });
    res.json({ success: true });
});

// 登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.get(username);
    if (!user || user.password !== password) {
        return res.json({ error: '用户名或密码错误', success: false });
    }
    res.json({ success: true, username });
});

// 保存健康数据
app.post('/api/save-health-data', (req, res) => {
    const { username, ...data } = req.body;
    if (users.has(username)) {
        users.get(username).healthData = data;
    }
    res.json({ success: true });
});

// 获取健康数据
app.get('/api/get-health-data', (req, res) => {
    const username = req.query.username;
    if (users.has(username)) {
        res.json(users.get(username).healthData);
    } else {
        res.json({});
    }
});

// 食物分析
app.post('/api/analyze-food', async (req, res) => {
    const { image } = req.body;
    if (!image) {
        return res.json({ error: '请上传图片', success: false });
    }
    
    // 直接返回模拟数据（简单快速）
    return res.json(generateMockResponse());
});

// 首页
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

module.exports = app;
