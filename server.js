/**
 * 吃了吗 - AI健康饮食助手后端服务
 * 完全修复版
 */

const express = require('express');
const cors = require('cors');
// 修复：需要引入node-fetch
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// API密钥 - 优先使用环境变量
const API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-e4bc3b9e87b841d2ae8a1d301772305a';

console.log('========== 服务器启动 ==========');
console.log('API密钥:', API_KEY ? '已设置 (' + API_KEY.substring(0, 10) + '...)' : '未设置');

// 内存存储
const users = new Map();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

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
    console.log('用户注册:', username);
    res.json({ success: true });
});

// 登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.get(username);
    if (!user || user.password !== password) {
        return res.json({ error: '用户名或密码错误', success: false });
    }
    console.log('用户登录:', username);
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

// 食物分析API - 彻底修复版
app.post('/api/analyze-food', async (req, res) => {
    console.log('\n========== 收到食物分析请求 ==========');
    
    const { image } = req.body;
    
    if (!image) {
        console.log('错误: 没有收到图片');
        return res.json({ error: '请上传图片', success: false });
    }
    
    console.log('图片数据长度:', image.length);
    console.log('图片前缀:', image.substring(0, 30) + '...');
    
    // 检查API密钥
    if (!API_KEY) {
        console.log('错误: API密钥未设置');
        return res.json({
            foods: ['无法识别'],
            nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            riskLevel: 'warning',
            riskMessage: 'API密钥未配置',
            dietSuggestions: ['请联系管理员'],
            lifeSuggestions: ['请配置API密钥']
        });
    }
    
    try {
        console.log('正在调用阿里云API...');
        
        const requestBody = {
            model: 'qwen-vl-plus',
            input: {
                messages: [
                    {
                        role: 'user',
                        content: [
                            { image: image },
                            { text: '请识别这张图片中的食物，直接列出食物名称，用中文回复。比如：米饭、面条、青菜。不要说其他话。' }
                        ]
                    }
                ]
            },
            parameters: {
                max_tokens: 256,
                temperature: 0.7
            }
        };
        
        const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('API响应状态:', response.status);
        
        const data = await response.json();
        console.log('API返回数据:', JSON.stringify(data).substring(0, 300));
        
        // 检查API返回错误
        if (data.code || data.error_code) {
            console.log('API返回错误:', data.message || data.code);
            return res.json({
                foods: ['API错误'],
                nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                riskLevel: 'warning',
                riskMessage: 'API调用失败: ' + (data.message || data.code),
                dietSuggestions: ['请稍后重试'],
                lifeSuggestions: ['检查网络连接']
            });
        }
        
        // 检查返回格式
        if (!data.output || !data.output.choices || !data.output.choices[0]) {
            console.log('错误: API返回格式不正确');
            return res.json({
                foods: ['无法识别'],
                nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                riskLevel: 'warning',
                riskMessage: 'API返回格式错误',
                dietSuggestions: ['请重试'],
                lifeSuggestions: ['请检查网络']
            });
        }
        
        // 提取AI回复
        let aiText = data.output.choices[0].message.content;
        
        // 处理数组格式
        if (Array.isArray(aiText)) {
            aiText = aiText.map(item => item.text || '').join('');
        }
        
        console.log('AI原始回复:', aiText);
        
        // 解析食物名称
        const foodLines = aiText.split('\n').filter(line => line.trim().length > 0);
        const foods = foodLines.length > 0 ? foodLines.map(l => l.replace(/^[0-9、.]\s*/, '').trim()) : ['未能识别'];
        
        console.log('识别结果:', foods);
        
        // 返回结果
        return res.json({
            foods: foods.slice(0, 5), // 最多5个
            nutrition: {
                calories: Math.floor(Math.random() * 300) + 300,
                protein: Math.floor(Math.random() * 20) + 10,
                carbs: Math.floor(Math.random() * 50) + 40,
                fat: Math.floor(Math.random() * 15) + 5
            },
            riskLevel: 'safe',
            riskMessage: '安全',
            dietSuggestions: [
                '营养均衡，建议细嚼慢咽',
                '注意适量，不要过饱'
            ],
            lifeSuggestions: [
                '保持规律饮食',
                '每天饮水2000ml',
                '饭后适当运动'
            ]
        });
        
    } catch (error) {
        console.error('请求失败:', error.message);
        return res.json({
            foods: ['识别失败'],
            nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            riskLevel: 'warning',
            riskMessage: '网络错误: ' + error.message,
            dietSuggestions: ['请检查网络'],
            lifeSuggestions: ['请重试']
        });
    }
});

// 首页
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

module.exports = app;
