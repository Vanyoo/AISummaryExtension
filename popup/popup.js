/**
 * AI Element Selector - Popup Script
 * 弹出页面逻辑
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 获取 DOM 元素
    const statusMode = document.getElementById('status-mode');
    const pageSupport = document.getElementById('page-support');
    const btnToggleSelect = document.getElementById('btn-toggle-select');
    const btnOpenOptions = document.getElementById('btn-open-options');
    const resultSection = document.getElementById('result-section');
    const resultPreview = document.getElementById('result-preview');
    const btnCopyResult = document.getElementById('btn-copy-result');
    const apiStatus = document.getElementById('api-status');
    const apiBadge = document.getElementById('api-badge');
    const apiInfo = document.getElementById('api-info');

    let isSelecting = false;
    let lastResult = null;

    // 初始化
    await initialize();

    // 按钮事件监听
    btnToggleSelect.addEventListener('click', toggleSelection);
    btnOpenOptions.addEventListener('click', openOptions);
    btnCopyResult.addEventListener('click', copyResult);

    // 监听来自背景脚本的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateStatus') {
            updateStatus(request.status);
            sendResponse({ success: true });
        } else if (request.action === 'showResult') {
            displayResult(request.result);
            sendResponse({ success: true });
        }
    });

    // 监听快捷键
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            toggleSelection();
        } else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            openOptions();
        }
    });

    async function initialize() {
        // 检查 API 配置
        await checkAPIConfig();

        // 检查页面支持
        await checkPageSupport();

        // 获取最近结果
        await loadRecentResult();

        // 获取选择状态
        await getSelectionStatus();
    }

    async function checkAPIConfig() {
        chrome.storage.sync.get(['config'], (result) => {
            const config = result.config || {};
            
            if (config.apiKey && config.apiEndpoint) {
                apiBadge.textContent = '已配置';
                apiBadge.className = 'status-badge ready';
                apiInfo.textContent = `${config.model} - ${new URL(config.apiEndpoint).hostname}`;
            } else {
                apiBadge.textContent = '未配置';
                apiBadge.className = 'status-badge pending';
                apiInfo.textContent = '点击配置按钮设置 API';
            }
        });
    }

    async function checkPageSupport() {
        // 发送消息到内容脚本检查页面
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        // 检查页面是否支持 Shadow DOM
                        const hasShadow = document.querySelector('*[shadowroot], [shadowrootmode]');
                        const hasCustomElements = customElements?.getDefinitions?.().length > 0;
                        
                        return {
                            hasShadow: !!hasShadow || hasCustomElements,
                            hasReact: !!document.querySelector('[data-reactroot]'),
                            hasVue: !!document.querySelector('[data-v-app]'),
                            hasAngular: !!document.querySelector('[ng-version]')
                        };
                    }
                }, (results) => {
                    if (results && results[0]) {
                        const info = results[0].result;
                        let supportText = '基础支持';
                        let supportClass = 'status-badge pending';
                        
                        if (info.hasShadow || info.hasReact || info.hasVue || info.hasAngular) {
                            supportText = '完整支持';
                            supportClass = 'status-badge ready';
                        }
                        
                        if (info.hasShadow) supportText += ' + Shadow DOM';
                        if (info.hasReact) supportText += ' + React';
                        if (info.hasVue) supportText += ' + Vue';
                        if (info.hasAngular) supportText += ' + Angular';
                        
                        pageSupport.innerHTML = `<span class="${supportClass}">${supportText}</span>`;
                    }
                });
            }
        });
    }

    async function loadRecentResult() {
        chrome.storage.local.get(['lastResult'], (result) => {
            if (result.lastResult) {
                lastResult = result.lastResult;
                displayResult(lastResult);
            }
        });
    }

    async function getSelectionStatus() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectionStatus' }, (response) => {
                    if (chrome.runtime.lastError) {
                        // 内容脚本未注入或页面不支持
                        return;
                    }
                    if (response && response.isSelecting) {
                        isSelecting = true;
                        updateUIForSelecting();
                    }
                });
            }
        });
    }

    function toggleSelection() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                // 确保内容脚本已注入
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['content.js']
                }, () => {
                    if (chrome.runtime.lastError) {
                        showNotification('无法注入内容脚本，请刷新页面重试', 'error');
                        return;
                    }
                    
                    // 发送切换命令 - 直接进入选择模式
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSelection' }, (response) => {
                        if (chrome.runtime.lastError) {
                            showNotification('无法连接到页面，请刷新重试', 'error');
                            return;
                        }
                        
                        if (response && response.success) {
                            isSelecting = !isSelecting;
                            updateUIForSelecting();
                            
                            // 如果是第一次进入选择模式，自动关闭 popup
                            if (isSelecting) {
                                setTimeout(() => {
                                    window.close();
                                }, 300);
                            }
                        }
                    });
                });
            }
        });
    }

    function updateUIForSelecting() {
        if (isSelecting) {
            btnToggleSelect.textContent = '⏹️ 停止选择';
            btnToggleSelect.classList.add('active');
            statusMode.textContent = '选择中...';
            statusMode.style.color = '#10b981';
            statusMode.style.fontWeight = '700';
        } else {
            btnToggleSelect.textContent = '🎯 开始选择元素';
            btnToggleSelect.classList.remove('active');
            statusMode.textContent = '待机';
            statusMode.style.color = '#1e293b';
            statusMode.style.fontWeight = '600';
        }
    }

    function updateStatus(status) {
        if (status === 'selecting') {
            isSelecting = true;
            updateUIForSelecting();
        } else if (status === 'idle') {
            isSelecting = false;
            updateUIForSelecting();
        }
    }

    function displayResult(result) {
        if (!result) return;

        lastResult = result;

        // 显示结果区域
        resultSection.style.display = 'block';

        // 更新预览
        const previewText = result.text.length > 150
            ? result.text.substring(0, 150) + '...'
            : result.text;

        resultPreview.textContent = previewText;

        // 保存到本地存储
        chrome.storage.local.set({ lastResult: result });

        // 不显示通知，避免打开时弹出多余提示
        // showNotification('AI 总结完成！', 'success');
    }

    function copyResult() {
        if (!lastResult) {
            showNotification('没有可复制的结果', 'error');
            return;
        }
        
        navigator.clipboard.writeText(lastResult.text).then(() => {
            showNotification('已复制到剪贴板', 'success');
        }).catch(() => {
            showNotification('复制失败', 'error');
        });
    }

    function openOptions() {
        chrome.runtime.openOptionsPage();
    }

    function showNotification(message, type = 'info') {
        // 创建临时通知
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            z-index: 10000;
            animation: slideDown 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes slideUp {
            from { transform: translateX(-50%) translateY(0); opacity: 1; }
            to { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});