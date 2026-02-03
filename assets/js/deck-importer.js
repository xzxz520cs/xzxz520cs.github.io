/**
 * 卡组导入模块
 * 功能：处理.ydk文件导入，解析卡组，查询卡片信息并填充到卡牌输入框
 */

(function (global) {
    // 卡片数据缓存
    let cardDataCache = null;
    let cardDataLoading = false;
    let unknownCardCounter = 1;

    /**
     * 初始化导入功能
     */
    function initDeckImporter() {
        const importDeckBtn = document.getElementById('importDeckBtn');
        const closeImportModalBtn = document.getElementById('closeImportModalBtn');
        const cancelImportBtn = document.getElementById('cancelImportBtn');
        const importBtn = document.getElementById('importBtn');
        const ydkFileInput = document.getElementById('ydkFile');
        const importModal = document.getElementById('importDeckModal');

        if (!importDeckBtn) return;

        // 打开模态窗口
        importDeckBtn.addEventListener('click', function () {
            importModal.classList.remove('hidden');
            resetImportForm();
        });

        // 关闭模态窗口
        closeImportModalBtn.addEventListener('click', closeModal);
        cancelImportBtn.addEventListener('click', closeModal);

        // 点击模态窗口背景关闭
        importModal.addEventListener('click', function (e) {
            if (e.target === importModal) {
                closeModal();
            }
        });

        // 切换导入方式
        const importMethodRadios = document.querySelectorAll('input[name="importMethod"]');
        importMethodRadios.forEach(radio => {
            radio.addEventListener('change', function () {
                const method = this.value;
                document.getElementById('fileImportSection').classList.toggle('hidden', method !== 'file');
                document.getElementById('textImportSection').classList.toggle('hidden', method !== 'text');
            });
        });

        // 文件选择变化时预览
        ydkFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById('filePreview').value = e.target.result;
            };
            reader.readAsText(file);
        });

        // 导入按钮点击事件
        importBtn.addEventListener('click', handleImport);
    }

    /**
     * 关闭模态窗口
     */
    function closeModal() {
        document.getElementById('importDeckModal').classList.add('hidden');
    }

    /**
     * 重置导入表单
     */
    function resetImportForm() {
        document.getElementById('ydkFile').value = '';
        document.getElementById('filePreview').value = '';
        document.getElementById('ydkText').value = '';
        document.getElementById('importStatus').value = '等待导入...';
        unknownCardCounter = 1;
    }

    /**
     * 动态加载JSZip库
     */
    async function loadJSZip() {
        if (typeof JSZip !== 'undefined') {
            return JSZip;
        }

        updateStatus('正在加载JSZip库...');

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
            script.onload = () => {
                updateStatus('JSZip库加载完成');
                resolve(window.JSZip);
            };
            script.onerror = () => {
                updateStatus('JSZip库加载失败，将使用API查询');
                reject(new Error('JSZip加载失败'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * 处理导入操作
     */
    async function handleImport() {
        const method = document.querySelector('input[name="importMethod"]:checked').value;
        let ydkContent = '';

        if (method === 'file') {
            const filePreview = document.getElementById('filePreview').value;
            if (!filePreview.trim()) {
                updateStatus('请先选择.ydk文件');
                return;
            }
            ydkContent = filePreview;
        } else {
            const ydkText = document.getElementById('ydkText').value;
            if (!ydkText.trim()) {
                updateStatus('请输入.ydk格式文本');
                return;
            }
            ydkContent = ydkText;
        }

        updateStatus('正在解析.ydk文件...');

        try {
            const deckData = parseYdkContent(ydkContent);
            updateStatus(`解析完成：主卡组 ${deckData.main.length} 张卡`);

            // 加载卡片数据
            updateStatus('正在加载卡片数据...');
            await loadCardData();

            // 处理卡片信息
            updateStatus('正在查询卡片信息...');
            const cardInfo = await processCardIds(deckData.main);

            // 填充到卡牌输入框
            updateStatus('正在填充卡牌输入...');
            fillCardInputs(cardInfo);

            updateStatus('导入完成！');

            // 3秒后自动关闭模态窗口
            setTimeout(() => {
                closeModal();
                // 更新饼图和总数
                if (window.UIUtils && window.UIUtils.updateTotalDeck) {
                    window.UIUtils.updateTotalDeck();
                }
                if (window.UIUtils && window.UIUtils.updatePieChart) {
                    window.UIUtils.updatePieChart();
                }
            }, 3000);

        } catch (error) {
            updateStatus(`导入失败：${error.message}`);
            console.error('导入失败:', error);
        }
    }

    /**
     * 解析.ydk文件内容
     * @param {string} content - .ydk文件内容
     * @returns {Object} 解析后的卡组数据
     */
    function parseYdkContent(content) {
        const lines = content.split('\n');
        const result = {
            main: [],
            extra: [],
            side: []
        };

        let currentSection = null;

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('#')) {
                if (trimmedLine === '#main') {
                    currentSection = 'main';
                } else if (trimmedLine === '#extra') {
                    currentSection = 'extra';
                } else if (trimmedLine === '!side') {
                    currentSection = 'side';
                } else {
                    // 其他标记，忽略
                }
                continue;
            }

            // 忽略空行和注释
            if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
                continue;
            }

            // 只处理数字行（卡片ID）
            if (/^\d+$/.test(trimmedLine)) {
                if (currentSection && result[currentSection]) {
                    result[currentSection].push(trimmedLine);
                }
            }
        }

        return result;
    }

    /**
     * 加载卡片数据（从本地zip或API）
     */
    async function loadCardData() {
        if (cardDataCache) {
            return cardDataCache;
        }

        if (cardDataLoading) {
            // 等待其他加载完成
            await new Promise(resolve => setTimeout(resolve, 100));
            return loadCardData();
        }

        cardDataLoading = true;
        updateStatus('正在下载卡片数据...');

        try {
            // 尝试加载JSZip库
            let JSZipInstance;
            try {
                JSZipInstance = await loadJSZip();
            } catch (error) {
                updateStatus('JSZip库加载失败，将直接使用API查询');
                throw new Error('JSZip加载失败');
            }

            // 尝试从本地zip文件加载
            updateStatus('正在下载ygocdb.com.cards.zip...');
            const response = await fetch('../../assets/card_data/ygocdb.com.cards.zip');
            if (!response.ok) {
                throw new Error(`无法加载本地卡片数据: HTTP ${response.status}`);
            }

            updateStatus('正在解压卡片数据...');
            const zipData = await response.arrayBuffer();
            const zip = new JSZipInstance();
            const zipContents = await zip.loadAsync(zipData);

            const cardsJsonFile = zipContents.file('cards.json');
            if (!cardsJsonFile) {
                throw new Error('cards.json 不在zip文件中');
            }

            updateStatus('正在解析卡片数据...');
            const cardsJsonText = await cardsJsonFile.async('text');
            cardDataCache = JSON.parse(cardsJsonText);
            updateStatus(`卡片数据加载完成，共 ${Object.keys(cardDataCache).length} 张卡片`);

        } catch (error) {
            console.warn('无法从本地加载卡片数据，将使用API查询:', error);
            updateStatus(`本地数据加载失败: ${error.message}，将使用在线API查询`);
            cardDataCache = {}; // 使用空缓存，后续通过API查询
        } finally {
            cardDataLoading = false;
        }

        return cardDataCache;
    }

    /**
     * 处理卡片ID，获取卡片信息
     * @param {Array} cardIds - 卡片ID数组
     * @returns {Array} 卡片信息数组，包含id, name, count
     */
    async function processCardIds(cardIds) {
        const cardCounts = {};

        // 统计每种卡的数量
        for (const cardId of cardIds) {
            cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
        }

        const result = [];

        for (const [cardId, count] of Object.entries(cardCounts)) {
            let cardName = await getCardNameById(cardId);
            result.push({
                id: cardId,
                name: cardName,
                count: count
            });
        }

        return result;
    }

    /**
     * 根据卡片ID获取卡片名称
     * @param {string} cardId - 卡片ID
     * @returns {Promise<string>} 卡片名称
     */
    async function getCardNameById(cardId) {
        // 首先尝试从缓存中查找
        if (cardDataCache && cardDataCache[cardId]) {
            const card = cardDataCache[cardId];
            return card.cn_name || card.sc_name || card.md_name || card.jp_name || card.en_name || `未知-${unknownCardCounter++}`;
        }

        // 如果缓存中没有，尝试使用API查询
        try {
            updateStatus(`正在查询卡片 ${cardId}...`);
            const response = await fetch(`https://ygocdb.com/api/v0/card/${cardId}`);
            if (!response.ok) {
                throw new Error(`API返回错误: ${response.status}`);
            }

            const cardData = await response.json();
            if (cardData && cardData.text && cardData.text.name) {
                return cardData.text.name;
            }
        } catch (error) {
            console.warn(`无法查询卡片 ${cardId}:`, error);
        }

        // 如果API也失败，返回未知卡片名称
        return `未知-${unknownCardCounter++}`;
    }

    /**
     * 将卡片信息填充到卡牌输入框
     * @param {Array} cardInfo - 卡片信息数组
     */
    function fillCardInputs(cardInfo) {
        // 首先清空所有现有的卡牌输入
        for (let i = 0; i < 52; i++) {
            document.getElementById(`card${i}`).value = '';
            document.getElementById(`cardName${i}`).value = '';
        }

        // 填充新的卡片信息
        let cardIndex = 0;
        for (const card of cardInfo) {
            if (cardIndex >= 52) {
                updateStatus(`警告：卡组超过52种卡，只显示前52种`);
                break;
            }

            document.getElementById(`card${cardIndex}`).value = card.count;
            document.getElementById(`cardName${cardIndex}`).value = card.name;
            cardIndex++;
        }

        updateStatus(`已填充 ${Math.min(cardInfo.length, 52)} 种卡片到输入框`);
    }

    /**
     * 更新导入状态
     * @param {string} message - 状态消息
     */
    function updateStatus(message) {
        const statusTextarea = document.getElementById('importStatus');
        const timestamp = new Date().toLocaleTimeString();
        statusTextarea.value = `[${timestamp}] ${message}\n${statusTextarea.value}`;
    }

    // 对外暴露接口
    global.DeckImporter = {
        init: initDeckImporter,
        parseYdkContent: parseYdkContent,
        loadCardData: loadCardData,
        processCardIds: processCardIds,
        getCardNameById: getCardNameById,
        fillCardInputs: fillCardInputs
    };

})(window);