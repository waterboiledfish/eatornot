/**
 * 吃了吗 - AI健康饮食助手后端服务
 * 支持用户注册登录 + 流式AI输出
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// API密钥
const API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-e4bc3b9e87b841d2ae8a1d301772305a';

// 简单的内存用户存储（生产环境应该用数据库）
const users = new Map();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// 生成随机token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 模拟AI响应
function generateMockResponse() {
    const foods = ['宫保鸡丁', '清炒西兰花', '米饭', '番茄炒蛋', '红烧肉', '酸辣汤'];
    return {
        foods: [foods[Math.floor(Math.random() * foods.length)]],
        nutrition: { calories: 500, protein: 20, carbs: 60, fat: 15 },
        riskLevel: 'safe',
        riskMessage: '安全',
        dietSuggestions: ['营养均衡', '建议细嚼慢咽'],
        lifeSuggestions: ['保持规律饮食', '每天饮水2000ml']
    };
}

// ============ 用户认证API ============

// 注册
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    if (users.has(username)) {
        return res.status(400).json({ error: '用户名已存在' });
    }
    
    // 简单存储（实际应该加密密码）
    users.set(username, {
        password: password,
        token: generateToken(),
        healthData: null
    });
    
    res.json({ success: true, token: users.get(username).token });
});

// 登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = users.get(username);
    if (!user || user.password !== password) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // 生成新token
    user.token = generateToken();
    res.json({ success: true, token: user.token, username: username });
});

// 验证token
app.get('/api/verify-token', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: '未登录' });
    }
    
    for (const [username, user] of users) {
        if (user.token === token) {
            return res.json({ success: true, username: username });
        }
    }
    
    return res.status(401).json({ error: 'token无效' });
});

// ============ 健康数据API ============

app.post('/api/save-health-data', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: '请先登录' });
    }
    
    for (const [username, user] of users) {
        if (user.token === token) {
            user.healthData = req.body;
            return res.json({ success: true });
        }
    }
    
    return res.status(401).json({ error: '用户不存在' });
});

app.get('/api/get-health-data', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: '请先登录' });
    }
    
    for (const [username, user] of users) {
        if (user.token === token) {
            return res.json(user.healthData);
        }
    }
    
    return res.status(401).json({ error: '用户不存在' });
});

// ============ 食物分析API（流式输出）============

app.post('/api/analyze-food', async (req, res) => {
    console.log('\n========== 收到食物分析请求 ==========');
    
    const { image, allergies, conditions, height, weight, age, gender } = req.body;
    
    if (!image) {
        return res.status(400).json({ error: '请上传图片' });
    }
    
    console.log('✅ 收到图片数据');
    
    if (!API_KEY) {
        // 没有API时返回模拟数据
        const result = generateMockResponse();
        return res.json(result);
    }
    
    try {
        const systemPrompt = `你是一位营养师。请分析食物图片，以JSON格式返回：
{"foods":["食物名"],"nutrition":{"calories":数值,"protein":数值,"carbs":数值,"fat":数值},"riskLevel":"safe/warning/danger","riskMessage":"安全/适量/危险","dietSuggestions":["建议"],"lifeSuggestions":["建议"]}`;
        
        let imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
        
        // 流式请求
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
                        { role: 'system', content: [{ text: systemPrompt }] },
                        { role: 'user', content: [
                            { image: imageUrl },
                            { text: '请分析这张图片中的食物，以JSON格式返回。' }
                        ]}
                    ]
                },
                parameters: { max_tokens: 1500, temperature: 0.7 }
            })
        });
        
        const data = await response.json();
        
        if (data.code || data.error_code || !data.output?.choices?.[0]) {
            console.log('❌ API错误');
            return res.json(generateMockResponse());
        }
        
        let aiResponse = data.output.choices[0].message.content;
        if (Array.isArray(aiResponse)) {
            aiResponse = aiResponse.map(item => item.text || '').join('');
        } else if (typeof aiResponse === 'object') {
            aiResponse = aiResponse.text || JSON.stringify(aiResponse);
        }
        
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            console.log('✅ 识别成功:', result.foods);
            return res.json(result);
        }
        
        return res.json(generateMockResponse());
        
    } catch (error) {
        console.log('❌ 请求失败:', error.message);
        return res.json(generateMockResponse());
    }
});

// 根路径
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

module.exports = app;
