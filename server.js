/**
 * 吃了吗 - AI健康饮食助手后端服务
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-e4bc3b9e87b841d2ae8a1d301772305a';

const users = new Map();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// 注册 - 支持 /api/register 和 /api/signUp
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

app.post('/api/signUp', (req, res) => {
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

// 登录 - 支持 /api/login 和 /api/signIn
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.get(username);
    if (!user || user.password !== password) {
        return res.json({ error: '用户名或密码错误', success: false });
    }
    res.json({ success: true, username });
});

app.post('/api/signIn', (req, res) => {
    const { username, password } = req.body;
    const user = users.get(username);
    if (!user || user.password !== password) {
        return res.json({ error: '用户名或密码错误', success: false });
    }
    res.json({ success: true, username });
});

app.post('/api/save-health-data', (req, res) => {
    const { username, ...data } = req.body;
    if (users.has(username)) {
        users.get(username).healthData = data;
    }
    res.json({ success: true });
});

app.get('/api/get-health-data', (req, res) => {
    const username = req.query.username;
    if (users.has(username)) {
        res.json(users.get(username).healthData);
    } else {
        res.json({});
    }
});

app.post('/api/analyze-food', async (req, res) => {
    const { image } = req.body;
    if (!image) {
        return res.json({ error: '请上传图片', success: false });
    }

    const foods = ['宫保鸡丁', '清炒西兰花', '米饭', '番茄炒蛋', '红烧肉', '炒时蔬'];
    const selectedFood = foods[Math.floor(Math.random() * foods.length)];
    
    res.json({
        foods: [selectedFood],
        nutrition: { calories: 500, protein: 20, carbs: 60, fat: 15 },
        riskLevel: 'safe',
        riskMessage: '安全',
        dietSuggestions: ['营养均衡，建议细嚼慢咽', '注意适量，不要过饱'],
        lifeSuggestions: ['保持规律饮食', '每天饮水2000ml', '饭后适当运动']
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = app;
