/**
 * AI Summary - Background Script
 * 处理 API 调用、消息传递和配置管理
 */

// 监听安装事件
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // 首次安装，设置默认配置
        chrome.storage.sync.get(['config'], (result) => {
            if (!result.config) {
                const defaultConfig = {
                    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
                    apiKey: '',
                    model: 'gpt-3.5-turbo',
                    systemPrompt: '请总结以下内容的核心要点，简洁明了：',
                    highlightColor: 'rgba(0, 123, 255, 0.3)',
                    debugMode: true,
                    streamEnabled: true,
                    markdownEnabled: true,
                    timeout: 30000,
                    retryCount: 0,
                    bypassMode: 'fetch-connect',
                    proxyUrl: 'https://cors-anywhere.herokuapp.com/',
                    waitTime: 500,
                    detectDynamic: true,
                    minTextLength: 5,
                    maxRecursionDepth: 10
                };
                chrome.storage.sync.set({ config: defaultConfig });
            }
        });

        // 打开欢迎页面
        chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    }
});

// 监听快捷键命令
chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-selection') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSelection' });
            }
        });
    } else if (command === 'open-config') {
        chrome.runtime.openOptionsPage();
    }
});

// 监听来自内容脚本和弹出页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 处理文本处理请求（支持流式）
    if (request.action === 'processText') {
        // 使用端口进行流式通信
        const port = {
            postMessage: (msg) => {
                // 发送到请求方
                if (sender.tab) {
                    chrome.tabs.sendMessage(sender.tab.id, msg).catch(() => {});
                } else {
                    chrome.runtime.sendMessage(msg).catch(() => {});
                }
            }
        };
        
        processTextWithAI(request.text, request.source, port)
            .then(result => {
                // 保存最终结果
                chrome.storage.local.set({ lastResult: result });
                
                // 发送完成消息
                if (sender.tab) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'complete',
                        result: result
                    }).catch(() => {});
                }
                
                sendResponse({ success: true, result: result });
            })
            .catch(error => {
                // 发送错误消息
                if (sender.tab) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'error',
                        error: error.message
                    }).catch(() => {});
                }
                sendResponse({ success: false, error: error.message });
            });
        
        return true; // 保持消息通道开放
    }
    
    // 处理停止流式请求
    if (request.action === 'stopStreaming') {
        // 这里可以实现取消逻辑
        console.log('[AI Selector] 收到停止流式请求');
        sendResponse({ success: true });
        return true;
    }

    // 处理 API 测试请求
    if (request.action === 'testAPI') {
        testAPIConnection(request.config, request.messages)
            .then(response => {
                sendResponse({ success: true, response: response });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        
        return true;
    }

    // 打开选项页面
    if (request.action === 'openOptions') {
        chrome.runtime.openOptionsPage();
        sendResponse({ success: true });
    }

    // 显示通知
    if (request.action === 'showNotification') {
        showNotification(request.message, request.type);
        sendResponse({ success: true });
    }

    // 获取配置
    if (request.action === 'getConfig') {
        chrome.storage.sync.get(['config'], (result) => {
            sendResponse({ config: result.config });
        });
        return true;
    }

    // 更新状态
    if (request.action === 'updateStatus') {
        // 广播到所有弹出页面
        chrome.runtime.sendMessage({
            action: 'updateStatus',
            status: request.status
        }).catch((error) => {
            // 忽略接收端不存在的错误
            if (error.message && !error.message.includes('Receiving end does not exist')) {
                console.log('[AI Selector] 更新状态失败:', error.message);
            }
        });
        
        sendResponse({ success: true });
    }
    
    // 使用 background.js 代理 fetch 请求（真正的 CORS 绕过）
    if (request.action === 'fetchWithBackground') {
        const { url, options } = request;
        
        fetch(url, options)
            .then(response => {
                if (!response.ok) {
                    sendResponse({ 
                        error: `HTTP ${response.status}: ${response.statusText}`,
                        status: response.status
                    });
                    return;
                }
                return response.json();
            })
            .then(data => {
                if (data) {
                    sendResponse({ data: data });
                }
            })
            .catch(error => {
                // 识别 CORS 错误
                let errorMessage = error.message;
                let userMessage = '请求失败';
                
                if (error.message && (
                    error.message.includes('Failed to fetch') ||
                    error.message.includes('CORS') ||
                    error.message.includes('NetworkError')
                )) {
                    userMessage = 'CORS 跨域错误：浏览器阻止了请求。\n\n' +
                        '解决方案：\n' +
                        '1. 使用代理模式（推荐）\n' +
                        '2. 配置 API 服务器支持 CORS\n' +
                        '3. 使用支持 CORS 的 API 网关';
                }
                
                sendResponse({ 
                    error: `${userMessage}\n\n技术详情: ${errorMessage}`
                });
            });
        
        return true; // 保持消息通道开放
    }
    
    return true;
});

/**
 * 使用 AI 处理文本（支持流式输出）
 * 通过消息传递实现实时更新
 */
async function processTextWithAI(text, source, port) {
    const config = await getConfig();
    
    if (!config.apiKey) {
        throw new Error('未配置 API Key，请先在选项页面设置');
    }

    if (!config.apiEndpoint) {
        throw new Error('未配置 API Endpoint');
    }

    const messages = [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: text }
    ];

    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: messages,
            stream: config.streamEnabled  // 启用流式输出
        })
    };

    // 根据绕过模式处理
    let response;
    let usedMode = 'direct';
    
    try {
        if (config.bypassMode === 'proxy' && config.proxyUrl) {
            usedMode = 'proxy';
            const proxyUrl = config.proxyUrl.endsWith('/') ? config.proxyUrl : config.proxyUrl + '/';
            response = await fetch(proxyUrl + config.apiEndpoint, fetchOptions);
        } else if (config.bypassMode === 'gm-bridge') {
            usedMode = 'gm-bridge';
            console.warn('[AI Selector] GM Bridge 模式在纯 Chrome 扩展中无法绕过 CORS');
            response = await fetch(config.apiEndpoint, fetchOptions);
        } else {
            usedMode = 'direct';
            response = await fetch(config.apiEndpoint, fetchOptions);
        }
    } catch (error) {
        // CORS 错误识别
        let errorMessage = error.message;
        let userMessage = '网络请求失败';
        
        if (error.message && (
            error.message.includes('Failed to fetch') ||
            error.message.includes('CORS') ||
            error.message.includes('NetworkError') ||
            error.message.includes('TypeError')
        )) {
            userMessage = 'CORS 跨域错误：浏览器阻止了请求';
            
            if (usedMode === 'direct') {
                userMessage += '。请在选项中选择绕过模式：\n' +
                    '1. 代理模式（需要代理服务器）\n' +
                    '2. GM Bridge 模式（需要 Tampermonkey 等扩展）';
            } else if (usedMode === 'proxy') {
                userMessage += '。代理服务器可能不可用或配置错误';
            }
        } else if (error.message && error.message.includes('401')) {
            userMessage = '认证失败：API Key 不正确或已过期';
        } else if (error.message && error.message.includes('402')) {
            userMessage = '余额不足：请检查 API 账户余额';
        } else if (error.message && error.message.includes('429')) {
            userMessage = '请求过于频繁：请稍后重试';
        } else if (error.message && error.message.includes('50')) {
            userMessage = '服务器错误：API 服务暂时不可用';
        }
        
        throw new Error(`${userMessage}\n\n技术详情: ${errorMessage}\n模式: ${usedMode}`);
    }

    if (!response.ok) {
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        
        if (response.status === 401) {
            errorMsg = '认证失败：API Key 不正确';
        } else if (response.status === 402) {
            errorMsg = '余额不足：请充值后重试';
        } else if (response.status === 429) {
            errorMsg = '请求过于频繁：请等待一段时间再试';
        } else if (response.status >= 500) {
            errorMsg = `服务器错误 (${response.status})：API 服务暂时不可用`;
        } else if (response.status === 403) {
            errorMsg = '访问被拒绝：可能是 CORS 或权限问题';
        }
        
        throw new Error(errorMsg);
    }

    // 流式处理
    if (config.streamEnabled && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                // 解码 chunk
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                // 处理 SSE 格式数据
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 保留未完成的行
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6); // 移除 "data: "
                        
                        if (dataStr === '[DONE]') {
                            // 流式结束
                            if (port) {
                                port.postMessage({
                                    type: 'stream_end',
                                    fullText: fullText,
                                    metadata: {
                                        source: source,
                                        timestamp: new Date().toISOString(),
                                        model: config.model,
                                        inputLength: text.length,
                                        outputLength: fullText.length
                                    }
                                });
                            }
                            return {
                                text: fullText,
                                source: source,
                                timestamp: new Date().toISOString(),
                                model: config.model,
                                inputLength: text.length,
                                outputLength: fullText.length
                            };
                        }
                        
                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices?.[0]?.delta?.content || '';
                            
                            if (content) {
                                fullText += content;
                                
                                // 实时发送增量更新
                                if (port) {
                                    port.postMessage({
                                        type: 'stream_delta',
                                        delta: content,
                                        fullText: fullText,
                                        isThinking: data.choices?.[0]?.delta?.thinking || false
                                    });
                                }
                            }
                            
                            // 检查是否有思考内容
                            if (data.choices?.[0]?.delta?.thinking) {
                                if (port) {
                                    port.postMessage({
                                        type: 'thinking',
                                        content: data.choices[0].delta.thinking
                                    });
                                }
                            }
                        } catch (e) {
                            // JSON 解析失败，忽略
                        }
                    }
                }
            }
        } catch (error) {
            if (port) {
                port.postMessage({
                    type: 'error',
                    error: `流式读取失败: ${error.message}`
                });
            }
            throw error;
        }
        
        return {
            text: fullText,
            source: source,
            timestamp: new Date().toISOString(),
            model: config.model,
            inputLength: text.length,
            outputLength: fullText.length
        };
        
    } else {
        // 非流式处理（兼容旧 API）
        const data = await response.json();
        const resultText = data.choices?.[0]?.message?.content || '未获取到响应';
        
        if (port) {
            port.postMessage({
                type: 'complete',
                text: resultText,
                metadata: {
                    source: source,
                    timestamp: new Date().toISOString(),
                    model: config.model,
                    inputLength: text.length,
                    outputLength: resultText.length
                }
            });
        }
        
        return {
            text: resultText,
            source: source,
            timestamp: new Date().toISOString(),
            model: config.model,
            inputLength: text.length,
            outputLength: resultText.length
        };
    }
}

/**
 * 测试 API 连接
 */
async function testAPIConnection(config, messages) {
    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: messages,
            stream: false
        })
    };

    let response;
    let usedMode = 'direct';
    
    try {
        if (config.bypassMode === 'proxy' && config.proxyUrl) {
            usedMode = 'proxy';
            const proxyUrl = config.proxyUrl.endsWith('/') ? config.proxyUrl : config.proxyUrl + '/';
            response = await fetch(proxyUrl + config.apiEndpoint, fetchOptions);
        } else if (config.bypassMode === 'gm-bridge') {
            usedMode = 'gm-bridge';
            console.warn('[AI Selector] GM Bridge 模式在纯 Chrome 扩展中无法绕过 CORS');
            response = await fetch(config.apiEndpoint, fetchOptions);
        } else {
            usedMode = 'direct';
            response = await fetch(config.apiEndpoint, fetchOptions);
        }
    } catch (error) {
        // 识别 CORS 错误
        let userMessage = '连接失败';
        
        if (error.message && (
            error.message.includes('Failed to fetch') ||
            error.message.includes('CORS') ||
            error.message.includes('NetworkError') ||
            error.message.includes('TypeError')
        )) {
            userMessage = 'CORS 跨域错误：浏览器阻止了请求';
            
            if (usedMode === 'direct') {
                userMessage += '。\n\n解决方案：\n' +
                    '1. 使用代理模式（推荐）\n' +
                    '   - 需要一个支持 CORS 的代理服务器\n' +
                    '   - 例如: https://api-proxy.example.com/\n\n' +
                    '2. 使用 GM Bridge 模式\n' +
                    '   - 安装 Tampermonkey 或 Violentmonkey\n' +
                    '   - 启用 GM_xmlhttpRequest 权限\n\n' +
                    '3. 配置服务器允许 CORS\n' +
                    '   - 添加 Access-Control-Allow-Origin: *';
            } else if (usedMode === 'proxy') {
                userMessage += '。\n\n可能原因：\n' +
                    '- 代理服务器地址错误\n' +
                    '- 代理服务器不支持该 API\n' +
                    '- 代理服务器需要认证';
            } else if (usedMode === 'gm-bridge') {
                userMessage += '。\n\n需要：\n' +
                    '- 安装 Tampermonkey 或 Violentmonkey\n' +
                    '- 在脚本中启用 GM_xmlhttpRequest';
            }
        } else if (error.message && error.message.includes('401')) {
            userMessage = '认证失败：API Key 不正确';
        } else if (error.message && error.message.includes('402')) {
            userMessage = '余额不足：请检查账户';
        } else if (error.message && error.message.includes('429')) {
            userMessage = '请求过于频繁：请等待';
        }
        
        throw new Error(`${userMessage}\n\n错误详情: ${error.message}\n模式: ${usedMode}`);
    }

    if (!response.ok) {
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        
        if (response.status === 401) {
            errorMsg = '认证失败：API Key 不正确';
        } else if (response.status === 402) {
            errorMsg = '余额不足：请充值';
        } else if (response.status === 429) {
            errorMsg = '请求过于频繁：请等待';
        } else if (response.status >= 500) {
            errorMsg = `服务器错误 (${response.status})`;
        } else if (response.status === 403) {
            errorMsg = '访问被拒绝：可能是 CORS 或权限问题';
        }
        
        throw new Error(errorMsg);
    }

    return await response.json();
}

/**
 * 使用 GM Bridge 模式 (通过 Chrome API)
 * 注意：这仍然受 CORS 限制，除非使用代理
 */
function fetchWithGMBridge(url, options) {
    return new Promise((resolve, reject) => {
        // 在 Manifest V3 中，background.js 的 fetch 仍然受 CORS 限制
        // 除非目标服务器支持 CORS 或使用代理
        
        // 尝试使用 fetch
        fetch(url, options)
            .then(response => {
                resolve(response);
            })
            .catch(error => {
                // 如果 fetch 失败，说明存在 CORS 问题
                const corsError = new Error(
                    `CORS 错误：无法直接访问 ${url}\n\n` +
                    `解决方案：\n` +
                    `1. 使用代理模式（推荐）\n` +
                    `   - 在选项中设置代理服务器 URL\n` +
                    `   - 例如: https://cors-anywhere.herokuapp.com/\n\n` +
                    `2. 配置 API 服务器支持 CORS\n` +
                    `   - 添加 Access-Control-Allow-Origin: *\n` +
                    `   - 或添加你的域名到白名单\n\n` +
                    `3. 使用支持 CORS 的 API 网关\n` +
                    `   - 例如: Cloudflare Workers, AWS API Gateway`
                );
                corsError.originalError = error;
                reject(corsError);
            });
    });
}

/**
 * 真正的 CORS 绕过方案：通过 background.js 发送请求
 * 这样可以利用扩展的跨域权限
 */
async function fetchWithExtensionPermission(url, options) {
    // 在 Manifest V3 中，background.js 可以访问任何 URL
    // 只要 manifest.json 中有正确的 host_permissions
    
    try {
        const response = await fetch(url, options);
        return response;
    } catch (error) {
        // 如果仍然失败，说明是网络问题而非 CORS
        throw error;
    }
}

/**
 * 获取配置
 */
function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['config'], (result) => {
            resolve(result.config || {});
        });
    });
}

/**
 * 显示通知 - 改进版：添加安全检查
 */
function showNotification(message, type = 'info') {
    // 如果 notifications API 不可用，使用 console 输出
    if (!chrome.notifications) {
        console.log(`[AI Selector ${type.toUpperCase()}] ${message}`);
        return;
    }

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };

    // 创建通知
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'AI Element Selector',
        message: message,
        priority: 2,
        buttons: type === 'error' ? [{ title: '查看详情' }] : []
    }).catch((error) => {
        // 如果创建通知失败，降级到 console 输出
        console.log(`[AI Selector ${type.toUpperCase()}] ${message}`, error);
    });

    // 如果是错误，同时在控制台输出
    if (type === 'error') {
        console.error('[AI Selector Background]', message);
    }
}

// 监听通知按钮点击 - 添加安全检查
if (chrome.notifications && chrome.notifications.onButtonClicked) {
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
        if (buttonIndex === 0) {
            chrome.runtime.openOptionsPage();
        }
    });
}

// 监听存储变化，用于调试
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.config) {
        console.log('[AI Selector] 配置已更新:', changes.config.newValue);
    }
});

// 错误处理
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update') {
        console.log('[AI Selector] 插件已更新到版本:', chrome.runtime.getManifest().version);
    }
});

// 监听错误
chrome.runtime.onStartup.addListener(() => {
    console.log('[AI Selector] 浏览器启动，插件已加载');
});

// 全局错误捕获 - 改进版
self.addEventListener('error', (event) => {
    const error = event.error;
    // 过滤掉常见的、无害的错误
    if (error && error.message && (
        error.message.includes('Receiving end does not exist') ||
        error.message.includes('Could not establish connection')
    )) {
        // 这些错误是正常的，因为接收端可能已关闭
        console.log('[AI Selector] 正常断开:', error.message);
    } else {
        console.error('[AI Selector Background Error]', error);
    }
});

self.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    // 过滤掉常见的、无害的错误
    if (reason && reason.message && (
        reason.message.includes('Receiving end does not exist') ||
        reason.message.includes('Could not establish connection')
    )) {
        console.log('[AI Selector] 正常断开:', reason.message);
    } else {
        console.error('[AI Selector Background Unhandled]', reason);
    }
});