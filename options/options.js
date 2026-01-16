/**
 * AI Element Selector - Options Script
 * 配置页面逻辑
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 获取所有配置元素
    const elements = {
        // API 配置
        apiEndpoint: document.getElementById('api-endpoint'),
        apiKey: document.getElementById('api-key'),
        model: document.getElementById('model'),
        systemPrompt: document.getElementById('system-prompt'),
        
        // 绕过模式
        bypassMode: document.getElementById('bypass-mode'),
        proxyUrl: document.getElementById('proxy-url'),
        proxyConfig: document.getElementById('proxy-config'),
        
        // 行为设置
        highlightColor: document.getElementById('highlight-color'),
        highlightOpacity: document.getElementById('highlight-opacity'),
        opacityValue: document.getElementById('opacity-value'),
        waitTime: document.getElementById('wait-time'),
        minTextLength: document.getElementById('min-text-length'),
        maxRecursionDepth: document.getElementById('max-recursion-depth'),
        
        // 功能开关
        streamEnabled: document.getElementById('stream-enabled'),
        markdownEnabled: document.getElementById('markdown-enabled'),
        detectDynamic: document.getElementById('detect-dynamic'),
        debugMode: document.getElementById('debug-mode'),
        
        // 网络设置
        timeout: document.getElementById('timeout'),
        retryCount: document.getElementById('retry-count'),
        
        // 按钮
        saveBtn: document.getElementById('save-config'),
        testBtn: document.getElementById('test-api'),
        resetBtn: document.getElementById('reset-config'),
        
        // 测试结果
        testResult: document.getElementById('test-result')
    };

    // 加载配置
    await loadConfig();

    // 事件监听
    elements.bypassMode.addEventListener('change', (e) => {
        elements.proxyConfig.style.display = e.target.value === 'proxy' ? 'block' : 'none';
    });

    // 透明度滑块实时更新
    elements.highlightOpacity.addEventListener('input', (e) => {
        elements.opacityValue.textContent = e.target.value;
    });

    elements.saveBtn.addEventListener('click', saveConfig);
    elements.testBtn.addEventListener('click', testAPI);
    elements.resetBtn.addEventListener('click', resetConfig);

    // 快捷键支持
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveConfig();
        }
    });

    // 将 RGBA 格式转换为 Hex 格式（兼容 color input）
    function rgbaToHex(color) {
        if (!color) return '#007bff';
        
        // 如果已经是 Hex 格式，直接返回
        if (color.startsWith('#')) {
            return color;
        }
        
        // 解析 RGBA 格式
        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgbaMatch) {
            const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
            const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
            const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }
        
        // 解析其他格式（如 rgb()）
        const rgbMatch = color.match(/rgb?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
            const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
            const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }
        
        // 无法解析，返回默认值
        return '#007bff';
    }

    async function loadConfig() {
        chrome.storage.sync.get(['config'], (result) => {
            const config = result.config || {};
            
            // 设置默认值
            elements.apiEndpoint.value = config.apiEndpoint || 'https://real-shark-88.deno.dev/v1/chat/completions';
            elements.apiKey.value = config.apiKey || '';
            elements.model.value = config.model || 'gpt-3.5-turbo';
            elements.systemPrompt.value = config.systemPrompt || '请总结以下内容的核心要点，简洁明了：';
            
            elements.bypassMode.value = config.bypassMode || 'proxy';
            elements.proxyUrl.value = config.proxyUrl || '';
            elements.proxyConfig.style.display = elements.bypassMode.value === 'proxy' ? 'block' : 'none';
            
            // 将 RGBA 转换为 Hex 格式
            elements.highlightColor.value = rgbaToHex(config.highlightColor);
            elements.highlightOpacity.value = config.highlightOpacity || 0.6;
            elements.opacityValue.textContent = config.highlightOpacity || 0.6;
            elements.waitTime.value = config.waitTime || 500;
            elements.minTextLength.value = config.minTextLength || 5;
            elements.maxRecursionDepth.value = config.maxRecursionDepth || 10;
            
            elements.streamEnabled.checked = config.streamEnabled !== false;
            elements.markdownEnabled.checked = config.markdownEnabled !== false;
            elements.detectDynamic.checked = config.detectDynamic !== false;
            elements.debugMode.checked = config.debugMode || false;
            
            elements.timeout.value = config.timeout || 30000;
            elements.retryCount.value = config.retryCount || 0;

            showTestResult('配置已加载', 'info');
        });
    }

    async function saveConfig() {
        const config = {
            // API 配置
            apiEndpoint: elements.apiEndpoint.value.trim(),
            apiKey: elements.apiKey.value.trim(),
            model: elements.model.value.trim(),
            systemPrompt: elements.systemPrompt.value.trim(),
            
            // 绕过模式
            bypassMode: elements.bypassMode.value,
            proxyUrl: elements.proxyUrl.value.trim(),
            
            // 行为设置
            highlightColor: elements.highlightColor.value,
            highlightOpacity: parseFloat(elements.highlightOpacity.value) || 0.6,
            waitTime: parseInt(elements.waitTime.value) || 500,
            minTextLength: parseInt(elements.minTextLength.value) || 5,
            maxRecursionDepth: parseInt(elements.maxRecursionDepth.value) || 10,
            
            // 功能开关
            streamEnabled: elements.streamEnabled.checked,
            markdownEnabled: elements.markdownEnabled.checked,
            detectDynamic: elements.detectDynamic.checked,
            debugMode: elements.debugMode.checked,
            
            // 网络设置
            timeout: parseInt(elements.timeout.value) || 30000,
            retryCount: parseInt(elements.retryCount.value) || 0
        };

        // 验证必填字段
        if (!config.apiEndpoint) {
            showTestResult('❌ API Endpoint 是必填项', 'error');
            return;
        }

        if (!config.apiKey) {
            showTestResult('⚠️ 未设置 API Key，但配置已保存', 'info');
        }

        // 保存到 Chrome Storage
        chrome.storage.sync.set({ config: config }, () => {
            showTestResult('✅ 配置已保存', 'success');
            
            // 发送更新通知到所有标签页
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'configUpdated' }).catch(() => {});
                });
            });
        });
    }

    async function testAPI() {
        const config = {
            apiEndpoint: elements.apiEndpoint.value.trim(),
            apiKey: elements.apiKey.value.trim(),
            model: elements.model.value.trim(),
            bypassMode: elements.bypassMode.value,
            proxyUrl: elements.proxyUrl.value.trim(),
            timeout: parseInt(elements.timeout.value) || 30000
        };

        if (!config.apiEndpoint || !config.apiKey) {
            showTestResult('❌ 请先配置 API Endpoint 和 API Key', 'error');
            return;
        }

        // 显示加载状态
        elements.testBtn.classList.add('loading');
        elements.testBtn.textContent = '测试中...';
        showTestResult('正在测试 API 连接...', 'info');

        try {
            const testText = '这是一段测试文本，用于验证 API 连接是否正常。';
            const messages = [
                { role: 'system', content: '你是一个助手' },
                { role: 'user', content: testText }
            ];

            let response;

            if (config.bypassMode === 'gm-bridge') {
                // 使用 GM_xmlhttpRequest
                response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: 'testAPI',
                        config: config,
                        messages: messages
                    }, (result) => {
                        if (result && result.success) {
                            resolve(result.response);
                        } else {
                            reject(result ? result.error : 'Unknown error');
                        }
                    });
                });
            } else {
                // 使用 fetch
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

                // 根据模式处理
                if (config.bypassMode === 'proxy' && config.proxyUrl) {
                    const proxyUrl = config.proxyUrl.endsWith('/') ? config.proxyUrl : config.proxyUrl + '/';
                    response = await fetch(proxyUrl + config.apiEndpoint, fetchOptions);
                } else {
                    // 使用 background.js 代理请求（真正的 CORS 绕过方案）
                    response = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({
                            action: 'fetchWithBackground',
                            url: config.apiEndpoint,
                            options: fetchOptions
                        }, (result) => {
                            if (result && result.data) {
                                resolve(result.data);
                            } else {
                                reject(result ? result.error : 'Unknown error');
                            }
                        });
                    });
                    return response; // 直接返回，不需要再解析
                }

                if (!response.ok) {
                    if (response.status === 403 || response.status === 401) {
                        throw new Error(`权限错误: ${response.statusText} - 请检查 API 密钥或权限`);
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                response = await response.json();
            }

            // 检查响应
            if (response.choices && response.choices[0] && response.choices[0].message) {
                const resultText = response.choices[0].message.content;
                showTestResult(`✅ API 测试成功\n\n响应: ${resultText.substring(0, 100)}...`, 'success');
            } else {
                showTestResult('⚠️ API 响应格式异常', 'error');
            }

        } catch (error) {
            let errorMsg = error.message;
            
            if (errorMsg.includes('CSP') || errorMsg.includes('Content Security Policy')) {
                errorMsg += '\n\n💡 建议: 尝试切换到 "GM Bridge" 或 "代理模式"';
            } else if (errorMsg.includes('Failed to fetch')) {
                errorMsg += '\n\n💡 建议: 检查网络连接和 API 地址';
            } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
                errorMsg += '\n\n💡 建议: 检查 API Key 是否正确';
            }
            
            showTestResult(`❌ API 测试失败\n\n${errorMsg}`, 'error');
        } finally {
            elements.testBtn.classList.remove('loading');
            elements.testBtn.textContent = '🧪 测试 API';
        }
    }

    async function resetConfig() {
        if (!confirm('确定要重置所有配置吗？此操作不可恢复。')) {
            return;
        }

        // 清除配置
        chrome.storage.sync.remove('config', () => {
            // 重置表单为默认值
            elements.apiEndpoint.value = 'https://real-shark-88.deno.dev/v1/chat/completions';
            elements.apiKey.value = '';
            elements.model.value = 'gpt-3.5-turbo';
            elements.systemPrompt.value = '请总结以下内容的核心要点，简洁明了：';
            elements.bypassMode.value = 'fetch-connect';
            elements.proxyUrl.value = 'https://cors-anywhere.herokuapp.com/';
            elements.proxyConfig.style.display = 'none';
            elements.highlightColor.value = '#007bff';
            elements.waitTime.value = 500;
            elements.minTextLength.value = 5;
            elements.maxRecursionDepth.value = 10;
            elements.streamEnabled.checked = true;
            elements.markdownEnabled.checked = true;
            elements.detectDynamic.checked = true;
            elements.debugMode.checked = false;
            elements.timeout.value = 30000;
            elements.retryCount.value = 0;

            showTestResult('✅ 配置已重置为默认值', 'success');
        });
    }

    function showTestResult(message, type = 'info') {
        elements.testResult.textContent = message;
        elements.testResult.className = `test-result ${type}`;
        elements.testResult.style.display = 'block';

        // 3秒后自动隐藏
        if (type === 'success') {
            setTimeout(() => {
                elements.testResult.style.display = 'none';
            }, 5000);
        }
    }

    // 监听来自背景脚本的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'testAPIResponse') {
            if (request.success) {
                showTestResult(`✅ API 测试成功\n\n响应: ${request.response}`, 'success');
            } else {
                showTestResult(`❌ API 测试失败\n\n${request.error}`, 'error');
            }
            sendResponse({ success: true });
        }
    });
});