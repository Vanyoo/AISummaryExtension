/**
 * AI Summary - Content Script
 * 核心功能: 文本提取 + UI 交互
 */

// ==================== 引入 marked.js ====================
// 在需要时动态加载 marked.js
// 使用 window 属性避免重复声明，并使用 Promise 锁防止并发加载
if (typeof window.markedLoading === 'undefined') {
    window.markedLoading = null; // Promise 锁
}
if (typeof window.markedLoaded === 'undefined') {
    window.markedLoaded = false;
}

function ensureMarkedLoaded() {
    // 如果已经加载完成，直接返回
    if (window.markedLoaded && window.markedInstance) {
        return Promise.resolve();
    }
    
    // 如果正在加载，等待加载完成
    if (window.markedLoading) {
        return window.markedLoading;
    }
    
    // 创建加载 Promise
    window.markedLoading = new Promise(async (resolve) => {
        // 再次检查（防止并发）
        if (window.markedLoaded && window.markedInstance) {
            resolve();
            return;
        }
        
        // 查找已存在的脚本
        const existingScript = document.querySelector('script[src*="marked.min.js"]');
        
        // 检查 marked 是否已经可用
        const checkMarked = () => {
            const markedObj = window.markedInstance || window.marked || (typeof marked !== 'undefined' ? marked : undefined);
            if (typeof markedObj !== 'undefined' && typeof markedObj.parse === 'function') {
                return markedObj;
            }
            return null;
        };
        
        // 如果已有脚本但 marked 还未就绪，等待
        if (existingScript) {
            for (let i = 0; i < 50; i++) {
                await new Promise(r => setTimeout(r, 50));
                const markedObj = checkMarked();
                if (markedObj) {
                    try {
                        if (typeof markedObj.setOptions === 'function') {
                            markedObj.setOptions({
                                gfm: true,
                                breaks: true,
                                headerIds: false,
                                mangle: false
                            });
                        }
                        window.markedInstance = markedObj;
                        window.markedLoaded = true;
                        window.markedLoading = null;
                        log('[AI Selector] marked.js 已就绪（现有脚本）');
                    } catch (e) {
                        error('[AI Selector] marked 配置警告:', e);
                    }
                    resolve();
                    return;
                }
            }
            // 超时
            window.markedLoading = null;
            resolve();
            return;
        }
        
        // 创建新脚本
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('marked.min.js');
        
        // 等待脚本加载
        await new Promise((loadResolve, loadReject) => {
            script.onload = loadResolve;
            script.onerror = loadReject;
            document.head.appendChild(script);
        });
        
        // 等待 marked 对象可用
        for (let i = 0; i < 50; i++) {
            await new Promise(r => setTimeout(r, 50));
            const markedObj = checkMarked();
            if (markedObj) {
                try {
                    if (typeof markedObj.setOptions === 'function') {
                        markedObj.setOptions({
                            gfm: true,
                            breaks: true,
                            headerIds: false,
                            mangle: false
                        });
                    }
                    window.markedInstance = markedObj;
                    window.markedLoaded = true;
                    log('[AI Selector] marked.js 已加载并配置完成');
                } catch (e) {
                    error('[AI Selector] marked 配置失败:', e);
                }
                window.markedLoading = null;
                resolve();
                return;
            }
        }
        
        error('[AI Selector] marked.js 加载超时');
        window.markedLoading = null;
        resolve();
    });
    
    return window.markedLoading;
}

/**
 * 获取可用的 marked 实例
 */
function getMarked() {
    if (window.markedInstance) {
        return window.markedInstance;
    }
    if (typeof window.marked !== 'undefined') {
        return window.marked;
    }
    if (typeof marked !== 'undefined') {
        return marked;
    }
    return null;
}


// ==================== 配置管理 (从 Chrome Storage 读取) ====================
// 使用 window 避免重复声明，同时避免 let 重复声明问题
if (typeof window.aiSelectorConfig === 'undefined') {
    window.aiSelectorConfig = {
        highlightColor: 'rgba(0, 123, 255, 0.3)',
        highlightOpacity: 0.6,
        debugMode: true,
        streamEnabled: true,
        markdownEnabled: true,
        minTextLength: 5,
        maxRecursionDepth: 10,
        waitTime: 500,
        detectDynamic: true
    };
}
// 使用 window.config 避免重复声明
// 注意：不要使用 let/var/const 声明局部变量 config
// 因为脚本可能多次执行，会导致重复声明错误
window.config = window.aiSelectorConfig;

// 从 Chrome Storage 加载配置（确保只执行一次）
if (!window.configLoaded) {
    window.configLoaded = true;
    chrome.storage.sync.get(['config'], (result) => {
        if (result.config) {
            window.config = { ...window.config, ...result.config };
            // config 已同步到 window.config
            log('配置已加载:', config);
        }
    });

    // 监听配置更新
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.config) {
            window.config = { ...window.config, ...changes.window.config.newValue };
            // config 已同步到 window.config
            log('配置已更新:', config);
        }
    });
}

function log(...args) {
    if (window.config.debugMode) {
        console.log('[AI Selector Content]', ...args);
    }
}

function error(...args) {
    console.error('[AI Selector Content ERROR]', ...args);
}

// ==================== 核心文本提取逻辑 (修复版) ====================

/**
 * 从节点提取所有文本内容 (支持 Shadow DOM)
 * 不使用 getSelection()，直接提取文本节点
 */
function extractTextFromNode(node, depth = 0) {
    if (!node || depth > window.config.maxRecursionDepth) {
        return '';
    }

    let text = '';

    // 1. 处理文本节点
    if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent.trim();
        if (content.length >= window.config.minTextLength) {
            text += content + ' ';
        }
        return text;
    }

    // 2. 处理元素节点
    if (node.nodeType === Node.ELEMENT_NODE) {
        // 跳过脚本和样式
        const tagName = node.tagName?.toLowerCase();
        if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
            return text;
        }

        // 3. 检查并提取 Shadow Root 内容
        if (node.shadowRoot) {
            log(`发现 Shadow Root: <${tagName}>`, {
                mode: node.shadowRoot.mode,
                childCount: node.shadowRoot.children.length
            });
            
            // 递归提取 Shadow Root 的所有子节点
            for (const child of node.shadowRoot.childNodes) {
                text += extractTextFromNode(child, depth + 1);
            }
        }

        // 4. 递归提取当前元素的子节点
        for (const child of node.childNodes) {
            text += extractTextFromNode(child, depth + 1);
        }
    }

    return text;
}

/**
 * 从元素及其所有子元素中提取文本
 */
function extractAllTextFromElement(element) {
    if (!element) return null;

    log('开始提取元素文本:', element.tagName);
    
    const startTime = Date.now();
    const text = extractTextFromNode(element);
    const duration = Date.now() - startTime;

    if (text.trim()) {
        log(`✅ 提取成功`, {
            textLength: text.length,
            duration: duration + 'ms',
            preview: text.substring(0, 100)
        });
        
        return {
            text: text.trim(),
            source: element.tagName,
            duration: duration
        };
    }

    log('❌ 未提取到文本');
    return null;
}

/**
 * 从当前选区提取文本 (Light DOM)
 */
function extractFromSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // 如果选区是文本节点，直接返回
    if (container.nodeType === Node.TEXT_NODE) {
        const text = container.textContent.trim();
        if (text.length >= window.config.minTextLength) {
            return {
                text: text,
                source: 'selection-text',
                coords: getRangeCoords(range)
            };
        }
    }

    // 如果选区是元素，提取其内容
    if (container.nodeType === Node.ELEMENT_NODE) {
        const text = extractTextFromNode(container);
        if (text) {
            return {
                text: text,
                source: 'selection-element',
                coords: getRangeCoords(range)
            };
        }
    }

    return null;
}

/**
 * 获取选区坐标
 */
function getRangeCoords(range) {
    if (!range) return null;
    const rects = range.getClientRects();
    if (rects.length > 0) {
        return rects[rects.length - 1];
    }
    return null;
}

/**
 * 主提取函数 - 整合所有策略
 */
function extractAllTextEnhanced(event) {
    log('=== 开始文本提取 ===');

    // 策略 1: 从当前选区提取
    const selectionResult = extractFromSelection();
    if (selectionResult) {
        log('✅ 策略 1: 从选区提取成功');
        return selectionResult;
    }

    // 策略 2: 从事件目标递归提取
    if (event && event.target) {
        const target = event.target;
        log('策略 2: 从事件目标提取', target.tagName);
        
        const result = extractAllTextFromElement(target);
        if (result) {
            // 尝试获取坐标
            const rect = target.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                result.coords = rect;
            }
            return result;
        }
    }

    // 策略 3: 遍历整个页面
    if (window.config.detectDynamic) {
        log('策略 3: 遍历整个页面...');
        const allElements = document.querySelectorAll('*');
        
        for (const el of allElements) {
            if (el.shadowRoot) {
                const result = extractAllTextFromElement(el);
                if (result) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        result.coords = rect;
                    }
                    return result;
                }
            }
        }
    }

    log('❌ 所有策略失败');
    return null;
}

/**
 * 等待文本出现 - 增强版
 */
function waitForTextEnhanced(timeout = window.config.waitTime) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const check = () => {
            // 检查 Light DOM 选区
            const selectionResult = extractFromSelection();
            if (selectionResult) {
                resolve(selectionResult);
                return;
            }

            // 检查所有 Shadow DOM
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                if (el.shadowRoot) {
                    const result = extractAllTextFromElement(el);
                    if (result) {
                        resolve(result);
                        return;
                    }
                }
            }

            if (Date.now() - startTime < timeout) {
                setTimeout(check, 50);
            } else {
                resolve(null);
            }
        };

        check();
    });
}

// ==================== UI 交互 ====================

// 防止重复声明的全局变量（使用 window 属性避免重复加载时的语法错误）
if (typeof window.aiSelectorState === 'undefined') {
    window.aiSelectorState = {
        isSelecting: false,
        highlight: null,
        toolbar: null,
        fixedIndicator: null,
        modal: null
    };
}

/**
 * 创建高亮框 - 改进版：支持透明度调整，能看到原内容
 */
function createHighlight() {
    if (window.aiSelectorState.highlight) return;
    
    window.aiSelectorState.highlight = document.createElement('div');
    const highlight = window.aiSelectorState.highlight;
    highlight.id = 'ai-selector-highlight';
    
    // 使用配置中的透明度，确保能看到原内容
    const opacity = window.config.highlightOpacity || 0.6;
    let baseColor = window.config.highlightColor;
    
    // 如果是十六进制颜色，转换为rgba
    if (baseColor.startsWith('#')) {
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);
        baseColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    } else if (baseColor.startsWith('rgba')) {
        // 替换透明度
        baseColor = baseColor.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, `rgba($1, $2, $3, ${opacity})`);
    } else if (baseColor.startsWith('rgb')) {
        // 添加透明度
        baseColor = baseColor.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
    }
    
    highlight.style.cssText = `
        position: fixed; 
        pointer-events: none; 
        z-index: 999998;
        border: 2px solid #007bff; 
        background: ${baseColor};
        transition: opacity 0.1s ease, background-color 0.2s ease; 
        opacity: 0; 
        box-shadow: 0 0 15px rgba(0, 123, 255, 0.7);
        backdrop-filter: blur(1px);
    `;
    document.body.appendChild(highlight);
}

/**
 * 创建工具栏
 */
function createToolbar() {
    if (window.aiSelectorState.toolbar) return;

    window.aiSelectorState.toolbar = document.createElement('div');
    const toolbar = window.aiSelectorState.toolbar;
    toolbar.id = 'ai-selector-toolbar';
    toolbar.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        z-index: 999999;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px; 
        padding: 12px 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        cursor: move; 
        user-select: none; 
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex; 
        align-items: center; 
        gap: 10px;
    `;

    toolbar.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; margin-right: 6px;"></span>
        <span>🎯 AI Selector</span>
        <span style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">修复版</span>
        <div style="display: flex; gap: 8px; margin-left: 12px;">
            <button id="ai-btn-select" style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;">选择元素</button>
            <button id="ai-btn-config" style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;">配置</button>
            <button id="ai-btn-close" style="background: rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 16px; border: none; color: white;">×</button>
        </div>
    `;

    document.body.appendChild(toolbar);

    // 拖拽功能
    let isDragging = false, startX, startY, startLeft, startTop;
    toolbar.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true; 
        startX = e.clientX; 
        startY = e.clientY;
        const rect = toolbar.getBoundingClientRect(); 
        startLeft = rect.left; 
        startTop = rect.top;
        toolbar.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        toolbar.style.left = `${startLeft + e.clientX - startX}px`;
        toolbar.style.top = `${startTop + e.clientY - startY}px`;
        toolbar.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => { 
        isDragging = false; 
        toolbar.style.cursor = 'move'; 
    });

    // 按钮事件
    document.getElementById('ai-btn-select').addEventListener('click', toggleSelectMode);
    document.getElementById('ai-btn-config').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openOptions' });
    });
    document.getElementById('ai-btn-close').addEventListener('click', () => {
        window.aiSelectorState.toolbar.remove();
        window.aiSelectorState.toolbar = null;
        if (window.aiSelectorState.highlight) {
            window.aiSelectorState.highlight.remove();
            window.aiSelectorState.highlight = null;
        }
        window.aiSelectorState.isSelecting = false;
    });
}

/**
 * 切换选择模式 - 改进版：直接进入选择，不显示浮窗
 */
function toggleSelectMode() {
    window.aiSelectorState.isSelecting = !window.aiSelectorState.isSelecting;
    
    if (window.aiSelectorState.isSelecting) {
        document.body.style.cursor = 'crosshair';
        createHighlight();
        // 显示简化的状态指示器
        showQuickStatusIndicator('选择模式已开启 - 点击元素进行AI总结');
        log('进入选择模式');
    } else {
        document.body.style.cursor = '';
        if (window.aiSelectorState.highlight) {
            window.aiSelectorState.highlight.style.opacity = '0';
        }
        if (window.aiSelectorState.fixedIndicator) {
            window.aiSelectorState.fixedIndicator.remove();
            window.aiSelectorState.fixedIndicator = null;
        }
        hideQuickStatusIndicator();
        log('退出选择模式');
    }
}

/**
 * 显示快速状态指示器（替代浮窗）
 */
function showQuickStatusIndicator(message) {
    if (window.aiSelectorState.fixedIndicator) {
        window.aiSelectorState.fixedIndicator.remove();
    }
    
    window.aiSelectorState.fixedIndicator = document.createElement('div');
    const fixedIndicator = window.aiSelectorState.fixedIndicator;
    fixedIndicator.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        z-index: 999999;
        pointer-events: none;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;
    fixedIndicator.textContent = message;
    document.body.appendChild(fixedIndicator);
}

/**
 * 隐藏快速状态指示器
 */
function hideQuickStatusIndicator() {
    if (window.aiSelectorState.fixedIndicator && window.aiSelectorState.fixedIndicator.parentNode) {
        window.aiSelectorState.fixedIndicator.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            if (window.aiSelectorState.fixedIndicator && window.aiSelectorState.fixedIndicator.parentNode) {
                window.aiSelectorState.fixedIndicator.remove();
                window.aiSelectorState.fixedIndicator = null;
            }
        }, 300);
    }
}

/**
 * 显示修复指示器 - 改进版：显示在悬停元素右上角
 */
function showFixedIndicator(element, rect) {
    // 只在选择模式下显示
    if (!window.aiSelectorState.isSelecting) return;
    
    if (!window.aiSelectorState.fixedIndicator) {
        window.aiSelectorState.fixedIndicator = document.createElement('div');
        const fixedIndicator = window.aiSelectorState.fixedIndicator;
        fixedIndicator.style.cssText = `
            position: fixed;
            background: #10b981;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            z-index: 999999;
            pointer-events: none;
            animation: fadeIn 0.3s ease;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(fixedIndicator);
    }
    
    window.aiSelectorState.fixedIndicator.textContent = '✓ 可点击';
    window.aiSelectorState.fixedIndicator.style.left = `${rect.right - 60}px`;
    window.aiSelectorState.fixedIndicator.style.top = `${rect.top + 4}px`;
}

/**
 * 检查元素是否有 Shadow DOM
 */
function checkForShadowChildren(element) {
    if (!element) return false;
    if (element.shadowRoot) return true;
    
    const children = element.children || element.childNodes;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
            if (child.shadowRoot) return true;
            if (checkForShadowChildren(child)) return true;
        }
    }
    return false;
}

// ==================== 事件监听 ====================

// 鼠标悬停 - 高亮和指示器
document.addEventListener('mouseover', (e) => {
    if (!window.aiSelectorState.isSelecting) return;
    if (e.target.closest('#ai-selector-toolbar')) return;
    
    const rect = e.target.getBoundingClientRect();
    
    if (window.aiSelectorState.highlight) {
        window.aiSelectorState.highlight.style.left = `${rect.left}px`;
        window.aiSelectorState.highlight.style.top = `${rect.top}px`;
        window.aiSelectorState.highlight.style.width = `${rect.width}px`;
        window.aiSelectorState.highlight.style.height = `${rect.height}px`;
        window.aiSelectorState.highlight.style.opacity = '1';
    }

    // 检测 Shadow DOM
    const hasShadow = e.target.shadowRoot || checkForShadowChildren(e.target);
    if (hasShadow) {
        showFixedIndicator(e.target, rect);
    } else if (window.aiSelectorState.fixedIndicator) {
        window.aiSelectorState.fixedIndicator.remove();
        window.aiSelectorState.fixedIndicator = null;
    }
});

// 鼠标移出
document.addEventListener('mouseout', (e) => {
    if (!window.aiSelectorState.isSelecting) return;
    if (e.target.closest('#ai-selector-toolbar')) return;
    if (window.aiSelectorState.highlight) {
        window.aiSelectorState.highlight.style.opacity = '0';
    }
});

// 点击选择 - 改进版：选择后弹出 AI 总结窗口
document.addEventListener('click', async (e) => {
    if (!window.aiSelectorState.isSelecting) return;
    if (e.target.closest('#ai-selector-toolbar')) return;
    if (e.target === window.aiSelectorState.highlight) return;
    
    e.preventDefault();
    
    // 显示等待提示
    showWaitIndicator();
    
    // 使用修复的提取逻辑
    const result = await waitForTextEnhanced(window.config.waitTime);
    
    hideWaitIndicator();
    
    if (result && result.text) {
        log('✅ 修复版提取成功:', {
            text: result.text.substring(0, 100),
            source: result.source,
            duration: result.duration + 'ms'
        });
        
        // 退出选择模式
        toggleSelectMode();
        
        // 显示 AI 总结窗口（async 调用，不等待完成）
        showAISummaryModal(result.text, result.source).catch(err => {
            error('[AI Selector] 显示模态窗口失败:', err);
        });
        
        // 同时发送到背景脚本处理（可选，用于保存历史）
        chrome.runtime.sendMessage({
            action: 'processText',
            text: result.text,
            source: result.source
        }).catch(() => {}); // 忽略错误，主要使用模态窗口
    } else {
        // 后备方案
        const directResult = extractAllTextEnhanced(e);
        if (directResult && directResult.text) {
            log('⚠️ 后备方案提取:', directResult.text.substring(0, 100));
            toggleSelectMode();
            showAISummaryModal(directResult.text, directResult.source).catch(err => {
                error('[AI Selector] 显示模态窗口失败:', err);
            });
            
            chrome.runtime.sendMessage({
                action: 'processText',
                text: directResult.text,
                source: directResult.source
            }).catch(() => {});
        } else {
            // 显示错误提示
            showNotification('无法获取文本。请选中具体元素并确保有内容。', 'error');
            
            log('❌ 提取失败:', {
                eventTarget: e.target.tagName,
                hasShadow: e.target.shadowRoot ? 'yes' : 'no',
                childCount: e.target.children?.length,
                textLength: e.target.textContent?.length
            });
        }
    }
});

// ==================== 等待指示器 ====================

function showWaitIndicator() {
    let indicator = document.getElementById('ai-wait-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'ai-wait-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 999999;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        indicator.innerHTML = `
            <div style="width: 16px; height: 16px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>递归检测中...</span>
        `;
        document.body.appendChild(indicator);
    }
    indicator.style.display = 'flex';
}

function hideWaitIndicator() {
    const indicator = document.getElementById('ai-wait-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// ==================== HTML 转义 ====================

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== Markdown 解析器 ====================

/**
 * Markdown 解析器 - 使用 marked.js
 */
async function parseMarkdown(text) {
    log('[AI Selector] parseMarkdown 被调用，文本长度:', text?.length);
    
    if (!text) return '';
    
    log('[AI Selector] 开始 ensureMarkedLoaded...');
    
    // 确保 marked 已加载
    await ensureMarkedLoaded();
    
    log('[AI Selector] ensureMarkedLoaded 完成');
    
    // 获取 marked 实例
    const markedObj = getMarked();
    
    log('[AI Selector] markedObj:', typeof markedObj, markedObj);
    
    // 如果 marked 不可用，返回纯文本转义
    if (!markedObj || typeof markedObj.parse !== 'function') {
        log('[AI Selector] marked 不可用，使用纯文本转义');
        return escapeHtml(text);
    }
    
    // 使用 marked 渲染
    try {
        log('[AI Selector] 使用 marked 渲染:', text.substring(0, 50) + '...');
        const html = markedObj.parse(text);
        log('[AI Selector] 渲染结果:', html.substring(0, 100) + '...');
        log('[AI Selector] 包含表格:', html.includes('<table>'));
        return html;
    } catch (error) {
        error('[AI Selector] Markdown 渲染失败:', error);
        // 降级到纯文本
        return escapeHtml(text);
    }
}


// ==================== AI 总结窗口 ====================

/**
 * 显示 AI 总结悬浮窗口 - 改进版：无蒙版、可拖拽、可调整大小
 * 支持 async/await 用于预加载 marked.js
 */
async function showAISummaryModal(text, source) {
    // 如果已存在，先移除
    const existing = document.getElementById('ai-summary-modal');
    if (existing) {
        existing.remove();
    }

    // 创建悬浮窗口
    const modal = document.createElement('div');
    modal.id = 'ai-summary-modal';
    
    // 初始位置（页面居中偏上）和大小（80%高度）
    const initialLeft = Math.max(20, (window.innerWidth - 500) / 2);
    const initialTop = Math.max(20, (window.innerHeight - 400) / 2);
    const initialHeight = Math.min(window.innerHeight * 0.8, 600);
    
    modal.style.cssText = `
        position: fixed;
        left: ${initialLeft}px;
        top: ${initialTop}px;
        width: 500px;
        height: ${initialHeight}px;
        max-width: calc(100vw - 40px);
        min-width: 300px;
        min-height: 250px;
        max-height: calc(100vh - 40px);
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.1);
        z-index: 1000000;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: aiModalIn 0.3s ease;
        overflow: hidden;
    `;
    
    modal.innerHTML = `
        <!-- 标题栏（可拖拽） -->
        <div id="ai-modal-header" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
            flex-shrink: 0;
        ">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🤖</span>
                <div>
                    <div style="font-size: 14px; font-weight: 700;">AI 总结</div>
                    <div style="font-size: 11px; opacity: 0.9;">${source}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <button id="ai-modal-pin" style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    width: 26px;
                    height: 26px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                " title="固定位置">
                    <svg id="pin-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: var(--pin-color, white);">
                        <path d="M16 9V4l1 0c0.55 0 1 -0.45 1 -1s-0.45 -1 -1 -1H7C6.45 2 6 2.45 6 3s0.45 1 1 1l1 0v5c0 1.66 -1.34 3 -3 3v2h5.97v7l1 1l1 -1v-7H19v-2c-1.66 0 -3 -1.34 -3 -3z"/>
                    </svg>
                </button>
                <button id="ai-modal-close" style="
                    background: rgba(239,68,68,0.3);
                    border: 1px solid rgba(239,68,68,0.5);
                    color: white;
                    font-size: 18px;
                    width: 26px;
                    height: 26px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                ">×</button>
            </div>
        </div>
        
        <!-- 内容区域（可滚动） -->
        <div id="ai-modal-scroll" style="padding: 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; min-height: 0;">
            <!-- 原文预览 -->
            <div style="margin-bottom: 12px;">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 6px;">📌 原文预览</div>
                <div style="
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 10px;
                    font-size: 12px;
                    color: #475569;
                    max-height: 80px;
                    overflow-y: auto;
                    line-height: 1.5;
                ">${text.substring(0, 300)}${text.length > 300 ? '...' : ''}</div>
            </div>
            
            <!-- AI 总结结果 -->
            <div style="flex: 1; margin-bottom: 12px; min-height: 60px;">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 6px;">💡 AI 总结</div>
                <div id="ai-summary-content" style="
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    border-radius: 6px;
                    padding: 12px;
                    font-size: 13px;
                    line-height: 1.6;
                    color: #0c4a6e;
                    min-height: 60px;
                    overflow-y: auto;
                ">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 14px; height: 14px; border: 2px solid #0ea5e9; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <span style="color: #64748b;">正在生成总结...</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 固定底部操作按钮 -->
        <div style="
            padding: 12px 16px;
            background: white;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 8px;
            flex-shrink: 0;
        ">
            <button id="ai-modal-stop" style="
                flex: 0.6;
                background: #ef4444;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                display: none;
            ">⏹️ 停止</button>
            <button id="ai-modal-copy" style="
                flex: 1;
                background: #10b981;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            ">📋 复制</button>
            <!--button id="ai-modal-save" style="
                flex: 1;
                background: #3b82f6;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            ">💾 保存</button-->
        </div>
        
        <!-- 调整大小手柄 -->
        <div id="ai-modal-resize" style="
            position: absolute;
            bottom: 0;
            right: 0;
            width: 16px;
            height: 16px;
            cursor: se-resize;
            background: linear-gradient(135deg, transparent 50%, #667eea 50%);
            border-bottom-right-radius: 6px;
        "></div>
    `;

    document.body.appendChild(modal);

    // ===== 拖拽功能 =====
    const header = document.getElementById('ai-modal-header');
    let isDragging = false;
    let dragStartX, dragStartY, dragStartLeft, dragStartTop;

    header.addEventListener('mousedown', (e) => {
        // 如果点击了按钮，不触发拖拽
        if (e.target.tagName === 'BUTTON') return;
        
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = modal.getBoundingClientRect();
        dragStartLeft = rect.left;
        dragStartTop = rect.top;
        modal.style.transition = 'none';
        modal.style.zIndex = 1000001;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        modal.style.left = `${dragStartLeft + dx}px`;
        modal.style.top = `${dragStartTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            modal.style.transition = '';
        }
    });

    // ===== 调整大小功能 =====
    const resizeHandle = document.getElementById('ai-modal-resize');
    let isResizing = false;
    let resizeStartX, resizeStartY, resizeStartWidth, resizeStartHeight;

    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartWidth = modal.offsetWidth;
        resizeStartHeight = modal.offsetHeight;
        modal.style.transition = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const dx = e.clientX - resizeStartX;
        const dy = e.clientY - resizeStartY;
        const newWidth = Math.max(300, resizeStartWidth + dx);
        const newHeight = Math.max(250, resizeStartHeight + dy);
        modal.style.width = `${newWidth}px`;
        modal.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            modal.style.transition = '';
        }
    });

    // ===== 固定位置功能 =====
    let isPinned = false;
    const pinBtn = document.getElementById('ai-modal-pin');
    pinBtn.addEventListener('click', () => {
        isPinned = !isPinned;
        // 更新按钮样式
        pinBtn.style.background = isPinned ? 'rgba(37, 99, 235, 0.95)' : 'rgba(255, 255, 255, 0.2)';
        pinBtn.style.borderColor = isPinned ? 'rgba(37, 99, 235, 1)' : 'rgba(255, 255, 255, 0.3)';
        pinBtn.title = isPinned ? '取消固定' : '固定位置';
    });

    // ===== 关闭功能 =====
    // 清理防抖计时器
    const cleanupStreaming = () => {
        if (window.aiStreamingRaf) {
            cancelAnimationFrame(window.aiStreamingRaf);
            window.aiStreamingRaf = null;
        }
    };

    document.getElementById('ai-modal-close').addEventListener('click', () => {
        cleanupStreaming();
        modal.style.animation = 'aiModalOut 0.2s ease';
        setTimeout(() => {
            modal.remove();
        }, 200);
    });

    // 双击标题栏最大化
    header.addEventListener('dblclick', () => {
        if (modal.style.width === '100%') {
            // 恢复原始大小
            modal.style.width = '500px';
            modal.style.height = initialHeight + 'px';
            modal.style.left = `${initialLeft}px`;
            modal.style.top = `${initialTop}px`;
        } else {
            // 最大化
            modal.style.width = 'calc(100vw - 40px)';
            modal.style.height = 'calc(100vh - 40px)';
            modal.style.left = '20px';
            modal.style.top = '20px';
        }
    });

    // ===== 防止滚动传播 =====
    const scrollArea = document.getElementById('ai-modal-scroll');
    scrollArea.addEventListener('wheel', (e) => {
        const isAtTop = scrollArea.scrollTop === 0;
        const isAtBottom = scrollArea.scrollHeight - scrollArea.scrollTop === scrollArea.clientHeight;
        
        // 如果在顶部且向上滚动，或者在底部且向下滚动，才允许传播
        if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
            return;
        }
        
        // 否则阻止传播
        e.stopPropagation();
    });

    // 调用 API 获取总结并渲染 Markdown（支持流式）
    const contentDiv = document.getElementById('ai-summary-content');
    const stopBtn = document.getElementById('ai-modal-stop');
    const copyBtn = document.getElementById('ai-modal-copy');
    const saveBtn = document.getElementById('ai-modal-save');
    
    // 预加载 marked.js（确保流式更新时可用）
    await ensureMarkedLoaded();
    
    // 显示加载状态和停止按钮
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; color: #64748b;">
                <div style="width: 16px; height: 16px; border: 2px solid #64748b; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span id="loading-text">AI 正在思考中...</span>
            </div>
            <!-- 思考过程区域（默认收起） -->
            <div id="thinking-section" style="display: none; margin-top: 10px;">
                <details style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px;">
                    <summary style="cursor: pointer; font-weight: 600; color: #475569; font-size: 12px;">
                        💭 思考过程 <span id="thinking-status"></span>
                    </summary>
                    <div id="thinking-content" style="margin-top: 8px; font-size: 12px; color: #64748b; line-height: 1.5; white-space: pre-wrap;"></div>
                </details>
            </div>
            <!-- 流式内容区域（实时 Markdown 渲染） -->
            <div id="streaming-content" style="margin-top: 15px; line-height: 1.6; min-height: 20px;"></div>
        `;
    }
    
    if (stopBtn) {
        stopBtn.style.display = 'block';
        stopBtn.textContent = '⏹️ 停止';
        stopBtn.disabled = false;
    }
    
    // 流式更新回调（支持实时 Markdown 渲染）
    let fullText = '';
    let thinkingText = '';
    let isThinking = false;
    let isStreaming = true;
    let hasThinkingTag = false;
    
    const onStreamUpdate = async (delta, full) => {
        if (!isStreaming) return;
        
        fullText = full;
        
        // 检查是否包含 <thinking> 标签
        if (delta.includes('<thinking>') || fullText.includes('<thinking>')) {
            hasThinkingTag = true;
        }
        
        // 使用 requestAnimationFrame 批量更新，避免频繁重排
        if (window.aiStreamingRaf) {
            return; // 已经有更新的请求在进行中
        }
        
        window.aiStreamingRaf = requestAnimationFrame(async () => {
            window.aiStreamingRaf = null;
            
            // 如果有 thinking 标签，分离思考和结果
            if (hasThinkingTag) {
                // 提取思考内容和最终结果
                const thinkingMatch = fullText.match(/<thinking>([\s\S]*?)<\/thinking>/);
                if (thinkingMatch) {
                    thinkingText = thinkingMatch[1].trim();
                    const resultText = fullText.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
                    
                    // 更新思考区域
                    const thinkingSection = document.getElementById('thinking-section');
                    const thinkingContent = document.getElementById('thinking-content');
                    const thinkingStatus = document.getElementById('thinking-status');
                    
                    if (thinkingSection && thinkingContent) {
                        thinkingSection.style.display = 'block';
                        thinkingContent.textContent = thinkingText;
                        if (thinkingStatus) {
                            thinkingStatus.textContent = `(已收集 ${thinkingText.length} 字)`;
                        }
                    }
                    
                    // 更新结果区域（实时 Markdown 渲染）
                    const streamingDiv = document.getElementById('streaming-content');
                    if (streamingDiv && resultText) {
                        const markdownHtml = await parseMarkdown(resultText);
                        streamingDiv.innerHTML = markdownHtml;
                    }
                } else {
                    // 还在收集 thinking 内容
                    const thinkingSection = document.getElementById('thinking-section');
                    if (thinkingSection) {
                        thinkingSection.style.display = 'block';
                    }
                }
            } else {
                // 没有 thinking 标签，正常流式显示并渲染 Markdown
                const streamingDiv = document.getElementById('streaming-content');
                if (streamingDiv) {
                    const markdownHtml = await parseMarkdown(fullText);
                    streamingDiv.innerHTML = markdownHtml;
                }
            }
            
            // 自动滚动到底部（在 DOM 更新后）
            const scrollArea = document.getElementById('ai-modal-scroll');
            if (scrollArea) {
                scrollArea.scrollTop = scrollArea.scrollHeight;
            }
        });
    };    
    const onThinking = (content) => {
        if (!isStreaming) return;
        
        isThinking = true;
        
        // 显示思考区域
        const thinkingSection = document.getElementById('thinking-section');
        const thinkingContent = document.getElementById('thinking-content');
        const thinkingStatus = document.getElementById('thinking-status');
        
        if (thinkingSection && thinkingContent) {
            thinkingSection.style.display = 'block';
            thinkingContent.textContent += content + ' ';
            if (thinkingStatus) {
                thinkingStatus.textContent = '(思考中...)';
            }
        }
    };
    
    // 停止按钮事件
    const stopHandler = () => {
        // 清理防抖计时器
        if (window.aiStreamingRaf) {
            cancelAnimationFrame(window.aiStreamingRaf);
            window.aiStreamingRaf = null;
        }
        if (!isStreaming) return;
        
        isStreaming = false;
        stopBtn.textContent = '⏹️ 已停止';
        stopBtn.disabled = true;
        
        // 发送停止请求
        chrome.runtime.sendMessage({
            action: 'stopStreaming'
        });
        
        // 如果已经有部分文本，显示结果
        if (fullText && contentDiv) {
            showFinalResult(fullText, isThinking);
        } else {
            contentDiv.innerHTML = '<div style="color: #ef4444;">❌ 已停止生成</div>';
        }
    };
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopHandler);
    }
    
    // 显示最终结果的函数
    const showFinalResult = async (text, thinking) => {
        if (!contentDiv) return;
        
        // 隐藏加载状态
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.style.display = 'none';
        }
        
        // 分离思考和结果
        let thinkingContent = '';
        let resultContent = text;
        
        // 检查是否有 <thinking> 标签
        const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/);
        if (thinkingMatch) {
            thinkingContent = thinkingMatch[1].trim();
            resultContent = text.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
            
            // 更新思考区域（保持收起状态）
            const thinkingSection = document.getElementById('thinking-section');
            const thinkingDiv = document.getElementById('thinking-content');
            const thinkingStatus = document.getElementById('thinking-status');
            
            if (thinkingSection && thinkingDiv) {
                thinkingSection.style.display = 'block';
                thinkingDiv.textContent = thinkingContent;
                if (thinkingStatus) {
                    thinkingStatus.textContent = `(共 ${thinkingContent.length} 字)`;
                }
            }
        } else if (thinking) {
            // 有思考过程但没有标签
            thinkingContent = fullText; // 使用完整文本
            resultContent = '';
        }
        
        // 渲染最终结果（Markdown）
        const markdownHtml = await parseMarkdown(resultContent || text);
        
        // 更新内容区域
        contentDiv.innerHTML = `
            ${resultContent ? `
                <div class="ai-markdown-content">${markdownHtml}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 8px; padding-top: 8px; border-top: 1px solid #bae6fd;">
                    字数: ${resultContent.length} ${thinkingContent ? ' | 包含思考过程' : ''}
                </div>
            ` : `
                <div style="color: #64748b; font-style: italic;">
                    思考过程已显示在上方，无最终结果
                </div>
            `}
        `;
        
        // 隐藏停止按钮
        if (stopBtn) {
            stopBtn.style.display = 'none';
        }
        
        // 绑定复制按钮（复制完整文本，包含思考）
        if (copyBtn) {
            copyBtn.onclick = () => {
                const copyText = thinkingContent ? 
                    `思考过程:\n${thinkingContent}\n\n最终结果:\n${resultContent}` : 
                    text;
                navigator.clipboard.writeText(copyText).then(() => {
                    showNotificationInModal('✅ 已复制到剪贴板', 'success');
                }).catch(() => {
                    showNotificationInModal('❌ 复制失败', 'error');
                });
            };
        }
        
        // 绑定保存按钮
        if (saveBtn) {
            saveBtn.onclick = () => {
                chrome.runtime.sendMessage({
                    action: 'processText',
                    text: text,
                    source: source
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        showNotificationInModal('⚠️ 保存失败：连接异常', 'error');
                        return;
                    }
                    showNotificationInModal('✅ 已保存到历史记录', 'success');
                });
            };
        }
    };
    
    // 主逻辑
    (async () => {
        try {
            const summary = await callAISummary(text, onStreamUpdate, onThinking);
            
            // 流式正常结束
            if (isStreaming) {
                await showFinalResult(fullText, isThinking);
            }
            
        } catch (error) {
            if (contentDiv) {
                contentDiv.style.background = '#fee2e2';
                contentDiv.style.borderColor = '#fecaca';
                contentDiv.style.color = '#991b1b';
                contentDiv.innerHTML = `❌ 生成失败: ${error.message}`;
            }
            
            if (stopBtn) {
                stopBtn.style.display = 'none';
            }
        }
    })();
}

/**
 * 调用 AI API 获取总结（支持流式）
 * 通过 background.js 处理，支持实时更新
 */
async function callAISummary(text, onStreamUpdate, onThinking) {
    return new Promise((resolve, reject) => {
        // 发送请求到 background.js
        chrome.runtime.sendMessage({
            action: 'processText',
            text: text,
            source: 'selection'
        }, (response) => {
            // 这个回调只在非流式或错误时调用
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            if (response && response.success) {
                resolve(response.result);
            } else if (response && response.error) {
                reject(new Error(response.error));
            }
        });
        
        // 监听流式消息（使用 onMessage 监听器）
        const listener = (message) => {
            // 处理流式数据
            if (message.type === 'stream_delta') {
                if (onStreamUpdate) {
                    onStreamUpdate(message.delta, message.fullText);
                }
            } else if (message.type === 'thinking') {
                if (onThinking) {
                    onThinking(message.content);
                }
            } else if (message.type === 'stream_end') {
                // 流式结束
                chrome.runtime.onMessage.removeListener(listener);
                resolve(message.fullText);
            } else if (message.type === 'complete') {
                // 非流式完成
                chrome.runtime.onMessage.removeListener(listener);
                resolve(message.text);
            } else if (message.type === 'error') {
                // 错误
                chrome.runtime.onMessage.removeListener(listener);
                reject(new Error(message.error));
            }
        };
        
        chrome.runtime.onMessage.addListener(listener);
    });
}

/**
 * 在模态窗口内显示通知
 */
function showNotificationInModal(message, type = 'info') {
    const modal = document.getElementById('ai-summary-modal');
    if (!modal) return;
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
        color: white;
        padding: 10px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        z-index: 1000001;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    modal.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// ==================== 通知 ====================

function showNotification(message, type = 'info') {
    chrome.runtime.sendMessage({
        action: 'showNotification',
        message: message,
        type: type
    }).catch((error) => {
        // 如果背景脚本不可用，降级到 console
        console.log(`[AI Selector ${type.toUpperCase()}] ${message}`);
    });
}

// ==================== 快捷键 ====================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // 优先关闭模态窗口
        const modal = document.getElementById('ai-summary-modal');
        if (modal) {
            // 清理防抖计时器
            if (window.aiStreamingRaf) {
                cancelAnimationFrame(window.aiStreamingRaf);
                window.aiStreamingRaf = null;
            }
            
            modal.style.animation = 'aiModalOut 0.2s ease';
            setTimeout(() => {
                modal.remove();
            }, 200);
        }
        // 然后关闭选择模式
        else if (window.aiSelectorState.isSelecting) {
            toggleSelectMode();
        }
    }
});



// ==================== 初始化 ====================

log('内容脚本已加载，等待用户操作...');

// 添加动画样式和 Markdown 样式
const style = document.createElement('style');
style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideDown { from { transform: translateX(-50%) translateY(-20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
    @keyframes slideUp { from { transform: translateX(-50%) translateY(0); opacity: 1; } to { transform: translateX(-50%) translateY(-20px); opacity: 0; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    
    /* Markdown 内容样式 */
    .ai-markdown-content {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #1e293b;
        line-height: 1.7;
    }
    
    .ai-markdown-content h1,
    .ai-markdown-content h2,
    .ai-markdown-content h3,
    .ai-markdown-content h4,
    .ai-markdown-content h5,
    .ai-markdown-content h6 {
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        font-weight: 600;
        color: #0f172a;
    }
    
    .ai-markdown-content h1 { font-size: 1.5em; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.3em; }
    .ai-markdown-content h2 { font-size: 1.3em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.2em; }
    .ai-markdown-content h3 { font-size: 1.15em; }
    .ai-markdown-content h4 { font-size: 1.05em; }
    
    .ai-markdown-content p {
        margin: 0.75em 0;
    }
    
    .ai-markdown-content ul,
    .ai-markdown-content ol {
        margin: 0.75em 0;
        padding-left: 1.5em;
    }
    
    .ai-markdown-content li {
        margin: 0.25em 0;
    }
    
    .ai-markdown-content code {
        background: #f1f5f9;
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 0.9em;
        color: #dc2626;
    }
    
    .ai-markdown-content pre {
        background: #1e293b;
        color: #f1f5f9;
        padding: 1em;
        border-radius: 6px;
        overflow-x: auto;
        margin: 0.75em 0;
    }
    
    .ai-markdown-content pre code {
        background: transparent;
        color: inherit;
        padding: 0;
        font-size: 0.85em;
    }
    
    .ai-markdown-content blockquote {
        border-left: 4px solid #64748b;
        padding-left: 1em;
        margin: 0.75em 0;
        color: #64748b;
        font-style: italic;
    }
    
    .ai-markdown-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.75em 0;
        font-size: 0.9em;
    }
    
    .ai-markdown-content th,
    .ai-markdown-content td {
        border: 1px solid #e2e8f0;
        padding: 0.5em 0.75em;
        text-align: left;
    }
    
    .ai-markdown-content th {
        background: #f8fafc;
        font-weight: 600;
    }
    
    .ai-markdown-content a {
        color: #2563eb;
        text-decoration: underline;
    }
    
    .ai-markdown-content a:hover {
        color: #1d4ed8;
    }
    
    .ai-markdown-content strong {
        font-weight: 600;
    }
    
    .ai-markdown-content em {
        font-style: italic;
    }
`;
document.head.appendChild(style);

// 监听来自背景脚本的快捷键消息 - 改进版：直接进入选择模式
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleSelection') {
        // 直接切换选择模式，不创建浮窗
        if (!window.aiSelectorState.isSelecting) {
            toggleSelectMode();
        } else {
            toggleSelectMode();
        }
        sendResponse({ success: true });
    } else if (request.action === 'showResult') {
        // 如果有结果，显示在模态窗口中
        if (request.result && request.result.text) {
            showAISummaryModal(request.result.text, request.result.source || 'background')
                .catch(err => {
                    error('[AI Selector] 显示模态窗口失败:', err);
                });
        }
        sendResponse({ success: true });
    } else if (request.action === 'configUpdated') {
        // 配置更新，重新加载
        chrome.storage.sync.get(['config'], (result) => {
            if (result.config) {
                config = { ...config, ...result.config };
                log('配置已更新:', config);
            }
        });
        sendResponse({ success: true });
    }
    return true;
});