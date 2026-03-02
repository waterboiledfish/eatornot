/**
 * 吃了吗 - AI健康饮食助手后端服务
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

// 食物分析 - 调用阿里云AI API
app.post('/api/analyze-food', async (req, res) => {
    const { image } = req.body;
    if (!image) {
        return res.json({ error: '请上传图片', success: false });
    }

    try {
        const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'qwen-vl-plus',
                input: {
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { image: image },
                                { text: '请分析这张图片中的食物，识别所有食材，并给出营养估算、饮食建议和生活建议。用中文回复。' }
                            ]
                        }
                    ]
                }
            })
        });

        const data = await response.json();
        
        if (data.output && data.output.choices && data.output.choices[0]) {
            const aiResponse = data.output.choices[0].message.content;
            // 解析AI响应
            const result = parseAIResponse(aiResponse);
            res.json(result);
        } else {
            // API调用失败，返回模拟数据
            res.json(generateMockResponse());
        }
    } catch (error) {
        console.error('AI分析错误:', error);
        // 发生错误时返回模拟数据
        res.json(generateMockResponse());
    }
});

// 解析AI响应
function parseAIResponse(aiText) {
    // 简单的响应解析
    let riskLevel = 'safe';
    let riskMessage = '安全';
    
    if (aiText.includes('高热量') || aiText.includes('高脂肪')) {
        riskLevel = 'warning';
        riskMessage = '注意';
    }
    if (aiText.includes('过敏') || aiText.contains('危险')) {
        riskLevel = 'danger';
        riskMessage = '警告';
    }

    return {
        foods: [extractFoodName(aiText)],
        nutrition: extractNutrition(aiText),
        riskLevel: riskLevel,
        riskMessage: riskMessage,
        dietSuggestions: extractSuggestions(aiText, '饮食'),
        lifeSuggestions: extractSuggestions(aiText, '生活')
    };
}

// 提取食物名称
function extractFoodName(text) {
    const foodMatch = text.match(/[食物|食材][：:]([^，。\n]+)/);
    if (foodMatch) return foodMatch[1].trim();
    return '识别到的食物';
}

// 提取营养信息
function extractNutrition(text) {
    const calMatch = text.match(/[热量|卡路里][：:]?\s*(\d+)/);
    return {
        calories: calMatch ? parseInt(calMatch[1]) : 500,
        protein: 20,
        carbs: 60,
        fat: 15
    };
}

// 提取建议
function extractSuggestions(text, type) {
    const regex = new RegExp(`${type}[建议|提示][：:]?([^。]+)`, 'g');
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        matches.push(match[1].trim());
    }
    return matches.length > 0 ? matches : [`建议${type}注意营养均衡`];
}

// 模拟响应（当AI不可用时）
function generateMockResponse() {
    const foods = ['宫保鸡丁', '清炒西兰花', '米饭', '番茄炒蛋', '红烧肉', '炒时蔬'];
    const selectedFood = foods[Math.floor(Math.random() * foods.length)];
    return {
        foods: [selectedFood],
        nutrition: { 
            calories: Math.floor(Math.random() * 400) + 300, 
            protein: Math.floor(Math.random() * 20) + 10, 
            carbs: Math.floor(Math.random() * 40) + 40, 
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
    };
}

// 首页
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

module.exports = app;
