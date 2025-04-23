// 定义全局变量
let calculationWorker = null;
let isCalculating = false;
let calculationStartTime = 0;
let progressUpdateInterval = null;

// 定义全局常量，浏览器 localStorage 限制为 5MB
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB

// 辅助函数：转义正则表达式中需要转义的特殊字符
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 辅助函数：生成变量名（例如 a, b, …, aa, ab）
function getVarName(index) {
    if (index < 26) return String.fromCharCode(97 + index);
    return 'a' + String.fromCharCode(97 + index - 26);
}

// 辅助函数：生成卡牌标签（例如 A, B, …, AA, AB）
function getCardLabel(index) {
    if (index < 26) return String.fromCharCode(65 + index);
    return `A${String.fromCharCode(65 + index - 26)}`;
}

// 初始化生成30个卡牌输入组件
function createCardInputs() {
    const container = document.getElementById('cardInputs');
    for (let i = 0; i < 30; i++) {
        // 创建单个卡牌输入区域
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label>${getCardLabel(i)}类卡</label>
            <input type="number" id="card${i}" value="0" min="0" class="form-control card-count" onchange="updateTotalDeck()">
            <input type="text" id="cardName${i}" class="form-control mt-1" placeholder="卡名">
        `;
        const cardNameInput = div.querySelector(`#cardName${i}`);
        cardNameInput.addEventListener('change', updatePieChart);
        container.appendChild(div);
    }
}

// 保存卡组数据到 localStorage
function saveDeck() {
    const deckName = document.getElementById('deckName').value.trim();
    if (!deckName) {
        alert("请输入卡组名称");
        return;
    }

    // 检测重复卡名并提示重复项
    let cardNames = [];
    let duplicateNames = new Set();
    for (let i = 0; i < 30; i++) {
        const name = document.getElementById(`cardName${i}`).value.trim();
        if (name) {
            if (cardNames.includes(name)) {
                duplicateNames.add(name);
            }
            cardNames.push(name);
        }
    }
    if (duplicateNames.size > 0) {
        alert(`保存失败: 卡名重复：${Array.from(duplicateNames).join(', ')}`);
        return;
    }

    // 新增：保存条件输入模式和构建器数据
    let conditionInputMode = window.getConditionInputMode ? window.getConditionInputMode() : 'manual';
    let builderConditionData = '';
    if (conditionInputMode === 'builder' && window.getBuilderConditionData) {
        builderConditionData = window.getBuilderConditionData();
    }

    const deck = {
        id: Date.now(),
        name: deckName,
        cards: [],
        condition: document.getElementById('condition').value,
        conditionInputMode,
        builderConditionData
    };

    for (let i = 0; i < 30; i++) {
        deck.cards.push({
            count: document.getElementById(`card${i}`).value,
            name: document.getElementById(`cardName${i}`).value
        });
    }

    const decks = JSON.parse(localStorage.getItem('decks') || '[]');
    const existingIndex = decks.findIndex(d => d.name === deckName);

    if (existingIndex !== -1) {
        if (!confirm(`已存在同名卡组，确认覆盖 "${deckName}" 吗？`)) return;
        decks[existingIndex] = deck;
    } else {
        decks.push(deck);
    }

    localStorage.setItem('decks', JSON.stringify(decks));
    updateDeckList();
    document.getElementById('deckName').value = '';
    alert("卡组保存成功！");
}

// 从 localStorage 加载卡组数据
function loadDeck() {
    const deckId = parseInt(document.getElementById('deckList').value);
    if (!deckId) return;

    const decks = JSON.parse(localStorage.getItem('decks') || '[]');
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;

    deck.cards.forEach((card, i) => {
        document.getElementById(`card${i}`).value = card.count;
        document.getElementById(`cardName${i}`).value = card.name;
    });
    document.getElementById('condition').value = deck.condition || '';

    // 新增：恢复条件输入模式和构建器数据
    if (deck.conditionInputMode === 'builder') {
        document.querySelector('input[name="conditionInputMode"][value="builder"]').checked = true;
        if (window.setBuilderConditionData && deck.builderConditionData) {
            window.setBuilderConditionData(deck.builderConditionData);
        }
        const manualDiv = document.getElementById('manualConditionInput');
        const builderDiv = document.getElementById('builderConditionInput');
        manualDiv.classList.add('hidden');
        builderDiv.classList.remove('hidden');
        currentConditionInputMode = 'builder';  // 更新为构建器模式
    } else {
        document.querySelector('input[name="conditionInputMode"][value="manual"]').checked = true;
        const manualDiv = document.getElementById('manualConditionInput');
        const builderDiv = document.getElementById('builderConditionInput');
        manualDiv.classList.remove('hidden');
        builderDiv.classList.add('hidden');
        currentConditionInputMode = 'manual';  // 更新为手动模式
    }

    updateTotalDeck();
    alert("卡组加载成功！");
}

// 删除选定卡组
function deleteDeck() {
    const deckId = parseInt(document.getElementById('deckList').value);
    if (!deckId) return;

    if (!confirm("确认删除选中的卡组吗？")) return;

    const decks = JSON.parse(localStorage.getItem('decks') || '[]');
    const newDecks = decks.filter(d => d.id !== deckId);
    localStorage.setItem('decks', JSON.stringify(newDecks));
    updateDeckList();
    alert("卡组删除成功！");
}

// 更新卡组下拉列表显示
function updateDeckList() {
    const select = document.getElementById('deckList');
    select.innerHTML = '<option value="">-- 选择卡组 --</option>';
    const decks = JSON.parse(localStorage.getItem('decks') || '[]');

    decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck.id;
        option.textContent = deck.name;
        select.appendChild(option);
    });
}

// 计算卡组中所有卡牌的总数
function updateTotalDeck() {
    let total = 0;
    document.querySelectorAll('.card-count').forEach(input => {
        total += parseInt(input.value) || 0;
    });
    document.getElementById('total').value = total;
    updatePieChart();
}

// 更新卡牌分布饼图显示
let chart = null;
function updatePieChart() {
    const labels = [];
    const data = [];
    const backgroundColors = [];

    for (let i = 0; i < 30; i++) {
        const count = parseInt(document.getElementById(`card${i}`).value) || 0;
        const name = document.getElementById(`cardName${i}`).value.trim() || getCardLabel(i);
        if (count > 0) {
            labels.push(name);
            data.push(count);
            backgroundColors.push(getColor(i));
        }
    }

    const ctx = document.getElementById('deckPieChart').getContext('2d');
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

// 根据索引返回循环使用的颜色值
function getColor(index) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FFCD56', '#C9CBCF', '#4D5360', '#D6A2E8',
        '#FF7F50', '#87CEEB', '#FFD700', '#7B68EE', '#FF69B4',
        '#00CED1', '#FF4500', '#8A2BE2', '#20B2AA', '#FF6347',
        '#7FFF00', '#DC143C', '#00BFFF', '#FF8C00', '#9932CC',
        '#FFA07A', '#00FA9A', '#8B008B', '#FF1493', '#1E90FF'
    ];
    return colors[index % colors.length];
}

// 获取当前计算时间（秒）
function getElapsedSeconds() {
    return Math.floor((Date.now() - calculationStartTime) / 1000);
}

// 保存计算结果记录到 localStorage
function saveCalculationRecord(result, condition, errorMessage = null) {
    const records = JSON.parse(localStorage.getItem('calculationRecords') || '[]');

    // 构建新的计算记录对象
    const record = {
        date: new Date().toLocaleString(),
        probability: errorMessage ? '计算错误' : `${((Number(result.valid) / Number(result.total)) * 100).toFixed(20)}%`,
        total: document.getElementById('total').value,
        draws: document.getElementById('draws').value,
        validCombinations: errorMessage ? '计算错误' : (result.valid !== undefined ? result.valid.toString() : '0'),
        totalCombinations: errorMessage ? '计算错误' : (result.total !== undefined ? result.total.toString() : '0'),
        condition,
        calculationMethod: result.calculationMethod || "精确计算",
        cards: Array.from({ length: 30 }).map((_, i) => {
            const inputName = document.getElementById(`cardName${i}`).value.trim();
            return {
                name: inputName || (getCardLabel(i) + '类卡'),
                count: document.getElementById(`card${i}`).value
            };
        })
    };

    // 判断存储空间是否超限
    const newSize = JSON.stringify([...records, record]).length * 2;
    if (newSize > MAX_STORAGE_SIZE) {
        alert('存储空间不足，无法保存计算记录。请考虑导出并删除部分记录后重试。');
        return;
    }

    records.push(record);
    localStorage.setItem('calculationRecords', JSON.stringify(records));
}

// 导出计算记录为 CSV 文件
function exportCalculationRecords() {
    const records = JSON.parse(localStorage.getItem('calculationRecords') || '[]');
    if (records.length === 0) {
        alert('没有可导出的计算记录。');
        return;
    }

    // 生成有序卡牌标签（例如 A, B, …, AA, AB, AC, AD）
    function getExportCardLabel(index) {
        if (index < 26) return String.fromCharCode(65 + index);
        return 'A' + String.fromCharCode(65 + index - 26);
    }
    const headers = [
        '日期', '概率', '卡组总数', '抽卡数', '满足条件的组合数', '总组合数', '逻辑判断条件', '计算方式',
        ...Array.from({ length: 30 }).flatMap((_, i) => [
            `${getExportCardLabel(i)}卡名`,
            `${getExportCardLabel(i)}数量`
        ])
    ];

    // CSV 字符转义辅助函数
    function csvEscape(str) {
        if (str == null) return '';
        str = String(str);
        str = str.replace(/"/g, '""');
        if (/[",\r\n]/.test(str)) {
            str = `"${str}"`;
        }
        return str;
    }

    const rows = records.map(record => [
        csvEscape(record.date),
        csvEscape(record.probability),
        csvEscape(record.total),
        csvEscape(record.draws),
        csvEscape(record.validCombinations),
        csvEscape(record.totalCombinations),
        csvEscape(record.condition),
        csvEscape(record.calculationMethod),
        ...Array.from({ length: 30 }).flatMap((_, i) => {
            const card = record.cards && record.cards[i] ? record.cards[i] : { name: '', count: '' };
            return [csvEscape(card.name), csvEscape(card.count)];
        })
    ]);
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '计算记录.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// 删除所有已保存的计算记录
function clearCalculationRecords() {
    if (confirm('确定删除所有计算记录吗？')) {
        localStorage.removeItem('calculationRecords');
        alert('计算记录已删除。');
    }
}

// 启动计算任务
function calculate() {
    if (isCalculating) {
        alert("计算正在进行中，请稍后...");
        return;
    }

    try {
        // 记录计算开始时间
        calculationStartTime = Date.now();

        // 检查重复卡名并报错
        let cardNames = [];
        let duplicateNames = new Set();
        for (let i = 0; i < 30; i++) {
            const name = document.getElementById(`cardName${i}`).value.trim();
            if (name) {
                if (cardNames.includes(name)) {
                    duplicateNames.add(name);
                }
                cardNames.push(name);
            }
        }
        if (duplicateNames.size > 0) {
            throw new Error(`卡名重复：${Array.from(duplicateNames).join(', ')}`);
        }

        // 新增：如果处于构建器模式，同步条件表达式
        if (window.getConditionInputMode && window.getConditionInputMode() === 'builder') {
            if (window.getBuilderConditionData && window.setBuilderConditionData) {
                // builderUpdateOutput 自动同步 #condition
            }
        }

        // 启动定时器更新计算用时显示
        progressUpdateInterval = setInterval(() => {
            const elapsedSeconds = getElapsedSeconds();
            const progress = document.getElementById('calculationProgress').value;
            document.getElementById('progressText').textContent =
                `计算中: ${progress}%  计算用时: ${elapsedSeconds}秒`;
        }, 1000);

        // 显示进度条和重置结果区域
        document.getElementById('calculationProgress').value = 0;
        document.getElementById('progressText').textContent = '计算中: 0%  计算用时: 0秒';
        document.getElementById('progressContainer').classList.remove('hidden');

        document.getElementById('probability').value = '计算中...';
        document.getElementById('validCombinations').value = '计算中...';
        document.getElementById('totalCombinations').value = '计算中...';

        // 读取用户输入的卡牌数量数据
        const cardCounts = [];
        for (let i = 0; i < 30; i++) {
            cardCounts.push(parseInt(document.getElementById(`card${i}`).value) || 0);
        }
        const draws = parseInt(document.getElementById('draws').value);
        const deckSize = parseInt(document.getElementById('total').value);

        // 校验输入数据合法性
        if (draws <= 0) throw new Error("抽卡数必须大于0");
        if (deckSize <= 0) throw new Error("卡组中至少要有1张卡");
        if (draws > deckSize) throw new Error("抽卡数不能超过卡组总数");

        // 转换用户输入的条件表达式
        let condition = document.getElementById('condition').value.trim();
        if (!condition) throw new Error("请输入逻辑判断条件");

        // 将条件表达式中的卡名替换为对应的变量名
        const cardNameMap = {};
        const sortedNames = [];
        for (let i = 0; i < 30; i++) {
            const name = document.getElementById(`cardName${i}`).value.trim();
            if (name) {
                cardNameMap[name] = getVarName(i);
                sortedNames.push(name);
            }
        }
        sortedNames.sort((a, b) => b.length - a.length);
        for (const name of sortedNames) {
            const regex = new RegExp(escapeRegExp(name), 'g');
            condition = condition.replace(regex, cardNameMap[name]);
        }
        console.log("转换后的条件表达式:", condition);

        // 提醒用户检查是否正确使用比较运算符
        const conditionWithoutOperators = condition.replace(/==|<=|>=|!=/g, '');
        if (conditionWithoutOperators.includes('=')) {
            alert("提示：条件表达式中建议使用 '==' 或 '===' 判断相等，请检查是否正确。");
        }

        // 创建 Web Worker 执行计算
        calculationWorker = new Worker(URL.createObjectURL(new Blob([`
            // 组合数计算函数（带缓存机制）
            const combinationCache = new Map();
            function combination(n, k) {
                if (k < 0 || k > n) return 0n;
                if (k === 0n || k === n) return 1n;
                
                const key = \`\${n},\${k}\`;
                if (combinationCache.has(key)) return combinationCache.get(key);
                
                let result = 1n;
                for (let i = 1n; i <= BigInt(k); i++) {
                    result = result * (BigInt(n) - BigInt(k) + i) / i;
                }
                
                combinationCache.set(key, result);
                return result;
            }

            // 辅助函数：将变量名转换为卡牌索引
            function varToIndex(varName) {
                const lc = varName.toLowerCase();
                if (lc.length === 1) {
                    const code = lc.charCodeAt(0) - 97;
                    if (code >= 0 && code < 26) return code;
                }
                if (lc.length === 2 && lc[0] === 'a') {
                    const code = lc.charCodeAt(1) - 97;
                    if (code >= 0 && code < 4) return 26 + code;
                }
                throw new Error(\`无效的卡名称: \${varName}\`);
            }

            // 主计算函数：递归计算满足条件的排列组合数
            function calculateProbability(cardCounts, draws, condition) {
                const totalCards = cardCounts.reduce((a, b) => a + b, 0);
                let valid = 0n, total = 0n;
                let lastReportedProgress = 0;

                // 将条件表达式编译为函数
                const conditionFunc = new Function('counts', \`return \${condition.replace(/([a-zA-Z]+)/g, (m) => \`counts[\${varToIndex(m)}]\`)}\`);

                function recurse(index, counts, remaining) {
                    if (index === cardCounts.length) {
                        if (remaining !== 0) return;
                        
                        let prob = 1n;
                        for (let i = 0; i < counts.length; i++) {
                            prob *= combination(cardCounts[i], counts[i]);
                        }
                        
                        total += prob;
                        if (conditionFunc(counts)) valid += prob;
                        return;
                    }

                    // 根据当前递归深度更新计算进度
                    const progress = Math.min(100, Math.floor((index / cardCounts.length) * 100));
                    if (progress > lastReportedProgress) {
                        lastReportedProgress = progress;
                        postMessage({ type: 'progress', progress });
                    }

                    const max = Math.min(cardCounts[index], remaining);
                    for (let k = 0; k <= max; k++) {
                        counts[index] = k;
                        recurse(index + 1, [...counts], remaining - k);
                    }
                }

                recurse(0, [], draws);
                return { valid, total };
            }

            onmessage = function(e) {
                const { cardCounts, draws, condition } = e.data;
                try {
                    const result = calculateProbability(cardCounts, draws, condition);
                    postMessage({ type: 'result', ...result });
                } catch (error) {
                    postMessage({ type: 'error', message: error.message });
                }
            };
        `], { type: 'text/javascript' })));

        // 设置 Worker 消息处理
        calculationWorker.onmessage = function (e) {
            if (e.data.type === 'progress') {
                updateProgress(e.data.progress);
            } else if (e.data.type === 'result') {
                finalizeCalculation(e.data);
            } else if (e.data.type === 'error') {
                showError(e.data.message);
            }
        };

        // 传递计算任务数据到 Worker
        calculationWorker.postMessage({
            cardCounts,
            draws,
            condition
        });

        // 更新 UI 标识计算已经开始
        isCalculating = true;
        document.getElementById('cancelBtn').classList.remove('hidden');
    } catch (error) {
        showError(error.message);
    }
}

// 更新进度条显示
function updateProgress(progress) {
    document.getElementById('calculationProgress').value = progress;
    const elapsedSeconds = getElapsedSeconds();
    document.getElementById('progressText').textContent =
        `计算中: ${progress}%  计算用时: ${elapsedSeconds}秒`;
}

// 计算结束后的处理
function finalizeCalculation(result) {
    // 清除定时器
    clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;

    // 清理计算状态以隐藏取消按钮
    cleanupCalculation();

    const probability = (Number(result.valid) / Number(result.total)) * 100;
    const elapsedSeconds = getElapsedSeconds();

    document.getElementById('probability').value = `${probability.toFixed(20)}%`;
    document.getElementById('validCombinations').value = result.valid.toString();
    document.getElementById('totalCombinations').value = result.total.toString();

    // 立即更新为 100% 进度显示
    document.getElementById('calculationProgress').value = 100;
    document.getElementById('progressText').textContent =
        `计算完成: 100%  计算用时: ${elapsedSeconds}秒`;

    saveCalculationRecord(result, document.getElementById('condition').value);
}

// 显示错误信息并处理异常
function showError(message) {
    clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;

    // 清理计算状态，隐藏取消按钮
    cleanupCalculation();

    // 将结果区域更新为错误提示
    document.getElementById('probability').value = '计算错误';
    document.getElementById('validCombinations').value = '计算错误';
    document.getElementById('totalCombinations').value = '计算错误';

    const elapsedSeconds = getElapsedSeconds();
    document.getElementById('calculationProgress').value = 0;
    document.getElementById('progressText').textContent =
        `计算错误  计算用时: ${elapsedSeconds}秒`;

    alert(`计算错误: ${message}`);
    saveCalculationRecord({}, document.getElementById('condition').value, message);
}

// 取消当前计算任务
function cancelCalculation() {
    clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;

    const elapsedSeconds = getElapsedSeconds();

    if (calculationWorker) {
        calculationWorker.terminate();
        calculationWorker = null;
    }

    document.getElementById('calculationProgress').value = 0;
    document.getElementById('progressText').textContent =
        `计算已取消  计算用时: ${elapsedSeconds}秒`;

    cleanupCalculation();
    alert("计算已取消");
}

// 清除计算状态标识
function cleanupCalculation() {
    isCalculating = false;
    document.getElementById('cancelBtn').classList.add('hidden');
    calculationWorker = null;
}

// 新增：利用蒙特卡洛方法进行计算
function monteCarloCalculate() {
    if (isCalculating) {
        if (!confirm("当前计算正在进行，是否取消并使用蒙特卡洛模拟计算？")) return;
        cancelCalculation();
    }
    try {
        calculationStartTime = Date.now();

        // 检查重复卡名
        let cardNames = [];
        let duplicateNames = new Set();
        for (let i = 0; i < 30; i++) {
            const name = document.getElementById(`cardName${i}`).value.trim();
            if (name) {
                if (cardNames.includes(name)) {
                    duplicateNames.add(name);
                }
                cardNames.push(name);
            }
        }
        if (duplicateNames.size > 0) {
            throw new Error(`卡名重复：${Array.from(duplicateNames).join(', ')}`);
        }

        // 读取输入数据
        const cardCounts = [];
        for (let i = 0; i < 30; i++) {
            cardCounts.push(parseInt(document.getElementById(`card${i}`).value) || 0);
        }
        const draws = parseInt(document.getElementById('draws').value);
        const deckSize = parseInt(document.getElementById('total').value);
        if (draws <= 0) throw new Error("抽卡数必须大于0");
        if (deckSize <= 0) throw new Error("卡组中至少要有1张卡");
        if (draws > deckSize) throw new Error("抽卡数不能超过卡组总数");

        let condition = document.getElementById('condition').value.trim();
        if (!condition) throw new Error("请输入逻辑判断条件");

        // 将条件表达式中的卡名替换为对应的变量名（与 calculate() 保持一致）
        const cardNameMap = {};
        const sortedNames = [];
        for (let i = 0; i < 30; i++) {
            const name = document.getElementById(`cardName${i}`).value.trim();
            if (name) {
                cardNameMap[name] = getVarName(i);
                sortedNames.push(name);
            }
        }
        sortedNames.sort((a, b) => b.length - a.length);
        for (const name of sortedNames) {
            const regex = new RegExp(escapeRegExp(name), 'g');
            condition = condition.replace(regex, cardNameMap[name]);
        }
        console.log("转换后的条件表达式（蒙特卡洛）:", condition);

        // 更新 UI，开始蒙特卡洛计算
        isCalculating = true;
        document.getElementById('cancelBtn').classList.remove('hidden');
        document.getElementById('calculationProgress').value = 0;
        document.getElementById('progressText').textContent = '蒙特卡洛模拟计算中: 0%  用时: 0秒';
        document.getElementById('progressContainer').classList.remove('hidden');

        // 创建用于蒙特卡洛模拟计算的 Worker
        const simulationWorker = new Worker(URL.createObjectURL(new Blob([`
            // 蒙特卡洛模拟 Worker：采用分块和优化的抽牌算法
            function varToIndex(varName) {
                const lc = varName.toLowerCase();
                if (lc.length === 1) {
                    const code = lc.charCodeAt(0) - 97;
                    if (code >= 0 && code < 26) return code;
                }
                if (lc.length === 2 && lc[0] === 'a') {
                    const code = lc.charCodeAt(1) - 97;
                    if (code >= 0 && code < 4) return 26 + code;
                }
                throw new Error("无效的卡名称: " + varName);
            }
            // 优化抽牌函数：通过不修改原数组统计抽牌分布
            function drawCards(shuffledDeck, draws) {
                let counts = Array(30).fill(0);
                const drawn = shuffledDeck.slice(0, draws);
                drawn.forEach(idx => { counts[idx]++; });
                return counts;
            }
            // 使用 Fisher–Yates 算法进行数组洗牌
            function shuffleArray(arr) {
                let array = arr.slice();
                for (let i = array.length - 1; i > 0; i--) {
                    let j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            }
            onmessage = function(e) {
                const { cardCounts, draws, condition } = e.data;
                // 生成牌堆数组
                let deck = [];
                for (let i = 0; i < cardCounts.length; i++) {
                    for (let j = 0; j < cardCounts[i]; j++) {
                        deck.push(i);
                    }
                }
                if (deck.length === 0) {
                    postMessage({ type: 'result', valid: 0, total: 500000, calculationMethod: "蒙特卡洛模拟" });
                    return;
                }
                const totalSimulations = 500000;
                let valid = 0;
                // 将条件表达式中卡名转换为 counts 数组索引
                const replacedCondition = condition.replace(/([a-zA-Z]+)/g, function(m) {
                    return "counts[" + varToIndex(m) + "]";
                });
                const conditionFunc = new Function("counts", "return " + replacedCondition);
                let iter = 0;
                let lastReported = 0;
                function runChunk() {
                    const chunkSize = 5000;
                    for (let i = 0; i < chunkSize && iter < totalSimulations; i++, iter++) {
                        const shuffled = shuffleArray(deck);
                        const result = drawCards(shuffled, draws);
                        if (conditionFunc(result)) valid++;
                    }
                    const progress = Math.floor((iter / totalSimulations) * 100);
                    if (progress > lastReported) {
                        lastReported = progress;
                        postMessage({ type: 'progress', progress });
                    }
                    if (iter < totalSimulations) {
                        setTimeout(runChunk, 0);
                    } else {
                        postMessage({ type: 'result', valid, total: totalSimulations, calculationMethod: "蒙特卡洛模拟" });
                    }
                }
                runChunk();
            };
        `], { type: 'text/javascript' })));

        simulationWorker.onmessage = function (e) {
            if (e.data.type === 'progress') {
                updateProgress(e.data.progress);
            } else if (e.data.type === 'result') {
                clearInterval(progressUpdateInterval);
                progressUpdateInterval = null;
                cleanupCalculation();
                const probability = (Number(e.data.valid) / Number(e.data.total)) * 100;
                const elapsedSeconds = getElapsedSeconds();
                document.getElementById('probability').value = `${probability.toFixed(20)}%`;
                document.getElementById('validCombinations').value = e.data.valid.toString();
                document.getElementById('totalCombinations').value = e.data.total.toString();
                document.getElementById('calculationProgress').value = 100;
                document.getElementById('progressText').textContent =
                    `蒙特卡洛模拟完成: 100% 用时: ${elapsedSeconds}秒`;
                saveCalculationRecord(e.data, document.getElementById('condition').value);
            }
        };

        simulationWorker.postMessage({ cardCounts, draws, condition });
        progressUpdateInterval = setInterval(() => {
            const elapsedSeconds = getElapsedSeconds();
            const progress = document.getElementById('calculationProgress').value;
            document.getElementById('progressText').textContent =
                `蒙特卡洛模拟计算中: ${progress}% 用时: ${elapsedSeconds}秒`;
        }, 1000);

    } catch (error) {
        showError(error.message);
    }
}

// 页面初始化：创建卡牌输入组件并绑定相关事件
window.onload = function () {
    // createCardInputs(); // 已移至HTML中直接静态写入
    updateDeckList();
    updateTotalDeck();

    // 为所有卡牌数量输入框绑定变更事件
    document.querySelectorAll('.card-count').forEach(input => {
        input.addEventListener('change', updateTotalDeck);
    });
};

// 条件构建器核心逻辑：获取所有可用卡牌变量名
function getAllCardNames() {
    // 生成默认变量名（最多30个，如 a, b, ..., aa, ab, …）
    const varNames = [];
    for (let i = 0; i < 30; i++) {
        if (i < 26) {
            varNames.push(String.fromCharCode(97 + i));
        } else {
            varNames.push('a' + String.fromCharCode(97 + i - 26));
        }
    }
    // 收集用户自定义卡牌名称
    const customNames = [];
    for (let i = 0; i < 30; i++) {
        const name = document.getElementById(`cardName${i}`)?.value.trim();
        if (name && !varNames.includes(name) && !customNames.includes(name)) customNames.push(name);
    }
    return [...varNames, ...customNames];
}
// 映射运算符符号
const builderOperators = {
    gt: '>',
    eq: '==',
    lt: '<',
    neq: '!=',
    gte: '>=',
    lte: '<='
};
// 定义条件构建器根节点
let builderRootCondition = null;
// 缓存构建器条件文本
let builderConditionText = '';
// 初始化构建器条件
function builderCreateCondition(type, children) {
    return type === 'single' ? {
        type: 'single',
        cards: [{ name: getAllCardNames()[0] }],
        symbol: 'gt',
        num: '0'
    } : { type, children: children || [] };
}
function builderRender() {
    const builder = document.getElementById('conditionBuilder');
    builder.innerHTML = '';
    builderRootCondition && builder.appendChild(builderRenderCondition(builderRootCondition, true));
    builderUpdateOutput();
}
function builderRenderCondition(condition, isRoot = false) {
    const container = document.createElement('div');
    container.className = `condition-builder condition-${condition.type}`;
    if (condition.type === 'single') {
        builderRenderSingleCondition(condition, container, isRoot);
    } else {
        builderRenderGroupCondition(condition, container, isRoot);
    }
    return container;
}
function builderRenderSingleCondition(condition, container, isRoot) {
    container.appendChild(document.createTextNode('抽到'));
    // 为卡牌输入区域添加样式
    const cardsWrapper = document.createElement('div');
    cardsWrapper.className = 'builder-cards-wrapper';
    condition.cards.forEach((card, index) => {
        const cardRow = document.createElement('div');
        cardRow.className = 'builder-card-row';
        if (index > 0) {
            const opSelect = builderCreateSelect(['+', '-', '*', '/'], card.operator || '+',
                e => { card.operator = e.target.value; builderUpdateOutput(); });
            cardRow.appendChild(opSelect);
        }
        // 切换卡牌名称输入方式（下拉选择或手动输入）
        const cardNameContainer = document.createElement('span');
        let cardNameControl = builderCreateSelect(
            getAllCardNames().map(name => ({ display: name, value: name })),
            card.name,
            e => { card.name = e.target.value; builderUpdateOutput(); }
        );
        cardNameContainer.appendChild(cardNameControl);
        const toggleButton = builderCreateButton('✏️', () => {
            if (cardNameControl.tagName.toLowerCase() === 'select') {
                const customInput = builderCreateInput(card.name, e => { card.name = e.target.value; builderUpdateOutput(); });
                customInput.classList.add('builder-card-input');
                cardNameContainer.replaceChild(customInput, cardNameControl);
                cardNameControl = customInput;
                toggleButton.textContent = '📑';
            } else {
                const newSelect = builderCreateSelect(
                    getAllCardNames().map(name => ({ display: name, value: name })),
                    card.name,
                    e => { card.name = e.target.value; builderUpdateOutput(); }
                );
                cardNameContainer.replaceChild(newSelect, cardNameControl);
                cardNameControl = newSelect;
                toggleButton.textContent = '✏️';
            }
        });
        cardRow.appendChild(cardNameContainer);
        cardRow.appendChild(toggleButton);
        if (condition.cards.length > 1) {
            cardRow.appendChild(builderCreateButton('×', () => {
                condition.cards.splice(index, 1);
                builderRender();
            }));
        }
        cardsWrapper.appendChild(cardRow);
    });
    container.appendChild(cardsWrapper);
    container.appendChild(builderCreateButton('+', () => {
        condition.cards.push({ name: getAllCardNames()[0], operator: '+' });
        builderRender();
    }));
    container.appendChild(document.createTextNode('的数量'));
    const symbolSelect = builderCreateSelect(
        Object.entries(builderOperators).map(([value, display]) => ({ display, value })),
        condition.symbol,
        e => { condition.symbol = e.target.value; builderUpdateOutput(); }
    );
    container.appendChild(symbolSelect);
    container.appendChild(builderCreateInput(condition.num, e => { condition.num = e.target.value; builderUpdateOutput(); }, '40px'));
    !isRoot && container.appendChild(builderCreateButton('删除', () => {
        container.dispatchEvent(new CustomEvent('delete', { bubbles: true }));
    }));
}
function builderRenderGroupCondition(condition, container, isRoot) {
    const header = document.createElement('div');
    header.className = 'builder-group-header';
    header.appendChild(document.createTextNode('满足以下'));
    header.appendChild(builderCreateSelect(
        ['全部', '任一'].map((text, i) => ({ display: text, value: i === 0 ? 'and' : 'or' })),
        condition.type,
        e => { condition.type = e.target.value; builderUpdateOutput(); }
    ));
    header.appendChild(document.createTextNode('条件'));
    !isRoot && header.appendChild(builderCreateButton('删除', () => {
        container.dispatchEvent(new CustomEvent('delete', { bubbles: true }));
    }));
    container.appendChild(header);
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'builder-group-children';
    condition.children.forEach(child => {
        const childElement = builderRenderCondition(child);
        childElement.addEventListener('delete', e => {
            e.stopPropagation();
            const index = condition.children.indexOf(child);
            index !== -1 && condition.children.splice(index, 1) && builderRender();
        });
        childrenContainer.appendChild(childElement);
    });
    const buttons = document.createElement('div');
    buttons.className = 'builder-buttons';
    buttons.appendChild(builderCreateButton('添加条件组', () => {
        condition.children.push(builderCreateCondition('and', []));
        builderRender();
    }));
    buttons.appendChild(builderCreateButton('添加条件', () => {
        condition.children.push(builderCreateCondition('single'));
        builderRender();
    }));
    childrenContainer.appendChild(buttons);
    container.appendChild(childrenContainer);
}
function builderUpdateOutput() {
    builderConditionText = builderRootCondition ? builderGenerateConditionText(builderRootCondition) : '';
    // 同步条件文本到隐藏的 textarea 供计算使用
    document.getElementById('condition').value = builderConditionText;
    // 同步预览显示区域
    const preview = document.getElementById('builderConditionPreview');
    if (preview) preview.value = builderConditionText;
}
function builderGenerateConditionText(condition) {
    if (condition.type === 'single') {
        const cardsText = condition.cards.map((c, i) =>
            i === 0 ? c.name : `${c.operator || '+'} ${c.name}`).join(' ');
        const operator = builderOperators[condition.symbol] || condition.symbol || '';
        return `(${cardsText}) ${operator} ${condition.num}`;
    }
    const childrenText = condition.children.map(builderGenerateConditionText).filter(Boolean);
    return childrenText.length > 1
        ? `(${childrenText.join(condition.type === 'and' ? ' && ' : ' || ')})`
        : childrenText[0] || '';
}
function builderCreateSelect(options, value, onChange) {
    const select = document.createElement('select');
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value || opt;
        option.textContent = opt.display || opt;
        select.appendChild(option);
    });
    select.value = value;
    select.addEventListener('change', onChange);
    return select;
}
function builderCreateInput(value, onChange, width) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.setAttribute('list', 'cardNamesDatalist');
    input.addEventListener('input', onChange);
    return input;
}
function builderCreateButton(text, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    let variant = 'btn--outline';
    if (text.trim() === '×' || text.trim() === '删除') {
        variant = 'btn--danger';
    }
    button.className = `btn ${variant}`;
    if (text.trim() === '添加条件组' || text.trim() === '添加条件') {
        button.className += ' btn--auto-width';
    }
    button.addEventListener('click', onClick);
    return button;
}
// 将输入表达式拆分为标识符、数字、运算符和括号
function tokenize(expr) {
    const regex = /\s*([A-Za-z0-9\u4e00-\u9fa5]+|>=|<=|==|!=|&&|\|\||[-+*/()<>])\s*/g;
    let tokens = [];
    let m;
    while ((m = regex.exec(expr)) !== null) {
        tokens.push(m[1]);
    }
    return tokens;
}
// 解析器构造函数，负责逐步解析表达式
function Parser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
}
Parser.prototype.peek = function () {
    return this.tokens[this.pos];
};
Parser.prototype.consume = function (token) {
    if (token && this.tokens[this.pos] !== token) {
        throw new Error("预期 " + token + "，但得到 " + this.tokens[this.pos]);
    }
    return this.tokens[this.pos++];
};
Parser.prototype.eof = function () {
    return this.pos >= this.tokens.length;
};
// 解析完整表达式（支持逻辑 && 与 || 运算）
function parseExpression(parser) {
    return parseLogicalOr(parser);
}
function parseLogicalOr(parser) {
    let node = parseLogicalAnd(parser);
    while (!parser.eof() && parser.peek() === '||') {
        parser.consume('||');
        const right = parseLogicalAnd(parser);
        node = { type: "or", children: [node, right] };
    }
    return node;
}
function parseLogicalAnd(parser) {
    let node = parseRelational(parser);
    while (!parser.eof() && parser.peek() === '&&') {
        parser.consume('&&');
        const right = parseRelational(parser);
        node = { type: "and", children: [node, right] };
    }
    return node;
}
// 解析关系运算表达式，如 num > 0
function parseRelational(parser) {
    let left = parseSum(parser);
    if (!parser.eof() && /^(>=|<=|==|!=|>|<)$/.test(parser.peek())) {
        const op = parser.consume();
        const num = parser.consume();
        if (!/^\d+$/.test(num)) {
            throw new Error("预期数字，但得到 " + num);
        }
        let cards = [];
        if (Array.isArray(left)) {
            cards.push({ name: left[0] });
            for (let i = 1; i < left.length; i += 2) {
                let operator = left[i];
                let operand = left[i + 1];
                cards.push({ operator, name: operand });
            }
        } else {
            cards.push({ name: left });
        }
        return { type: "single", cards: cards, symbol: mapOperator(op), num: num };
    }
    return left;
}
// 解析加法表达式或返回基本表达式
function parseSum(parser) {
    if (parser.peek() === '(') {
        parser.consume('(');
        const node = parseExpression(parser);
        parser.consume(')');
        return node;
    }
    let items = [];
    items.push(parser.consume());
    while (!parser.eof() && (parser.peek() === '+' || parser.peek() === '-')) {
        let operator = parser.consume();
        items.push(operator);
        items.push(parser.consume());
    }
    return items.length === 1 ? items[0] : items;
}
// 将运算符转换为构建器中使用的标识
function mapOperator(op) {
    const opMap = {
        ">": "gt",
        "<": "lt",
        "==": "eq",
        "!=": "neq",
        ">=": "gte",
        "<=": "lte",
        "大于等于": "gte",
        "小于等于": "lte",
        "大于": "gt",
        "小于": "lt"
    };
    if (!opMap[op]) throw new Error("不支持的运算符：" + op);//修改这里会出错
    return opMap[op];//修改这里会出错
}
// 主解析函数，将手动输入的条件转换为构建器数据
function parseManualCondition(manualStr) {
    manualStr = manualStr.trim();
    if (!manualStr) throw new Error("空的条件");
    const tokens = tokenize(manualStr);
    const parser = new Parser(tokens);
    const tree = parseExpression(parser);
    if (!parser.eof()) {
        throw new Error("无法解析条件：" + manualStr);
    }
    if (tree && tree.type === 'single') {
        return { type: 'and', children: [tree] };
    }
    return tree;
}

// 全局记录当前条件输入模式（手动或构建器）
let currentConditionInputMode = 'manual';

// 切换条件输入模式，并根据当前条件状态提示确认
function switchConditionInputMode(mode, skipConfirm = false) {
    const currentCondition = document.getElementById('condition').value.trim();
    if (!currentCondition) {
        skipConfirm = true;
    }
    if (!skipConfirm) {
        let msg = "";
        if (mode === 'builder') {
            msg = "切换到条件构建器后，不支持字符 */%，是否继续？";
        } else if (mode === 'manual') {
            msg = "是否切换至手动输入？";
        }
        if (!confirm(msg)) return false;
    }
    const manualDiv = document.getElementById('manualConditionInput');
    const builderDiv = document.getElementById('builderConditionInput');
    if (mode === 'manual') {
        if (builderRootCondition) {
            const raw = builderGenerateConditionText(builderRootCondition);
            document.getElementById('condition').value = raw;
        }
        builderDiv.classList.add('hidden');
        manualDiv.classList.remove('hidden');
    } else {
        let manualStr = document.getElementById('condition').value.trim();
        if (manualStr) {
            try {
                builderRootCondition = parseManualCondition(manualStr);
                builderRender();
            } catch (err) {
                alert("手动条件转换失败：" + err.message);
                document.querySelector('input[name="conditionInputMode"][value="manual"]').checked = true;
                return false;
            }
        } else {
            builderRootCondition = builderCreateCondition('and', []);
            builderRender();
        }
        manualDiv.classList.add('hidden');
        builderDiv.classList.remove('hidden');
    }
    currentConditionInputMode = mode;
    return true;
}

// 单选按钮切换条件模式时，如取消则恢复原状态
document.querySelectorAll('input[name="conditionInputMode"]').forEach(radio => {
    radio.addEventListener('change', function (e) {
        const newMode = e.target.value;
        if (!switchConditionInputMode(newMode)) {
            document.querySelector(`input[name="conditionInputMode"][value="${currentConditionInputMode}"]`).checked = true;
        }
    });
});

// 初始加载时跳过确认提示，初始化构建器
document.addEventListener('DOMContentLoaded', function () {
    builderRootCondition = builderCreateCondition('and', []);
    builderRender();
    switchConditionInputMode('manual', true);
    // 监听卡牌名称输入变化
    setupCardNameInputListener();
});

// 对外接口：获取和设置条件输入模式及构建器数据
window.getConditionInputMode = function () {
    return document.querySelector('input[name="conditionInputMode"]:checked')?.value || 'manual';
};
window.getBuilderConditionData = function () {
    return builderRootCondition ? JSON.stringify(builderRootCondition) : '';
};
window.setBuilderConditionData = function (json) {
    try {
        builderRootCondition = JSON.parse(json);
        builderRender();
    } catch (e) {
        builderRootCondition = builderCreateCondition('and', []);
        builderRender();
    }
};

// 监听卡牌名称输入变化，并实时更新条件构建器下拉选项
function setupCardNameInputListener() {
    const cardInputs = document.getElementById('cardInputs');
    if (!cardInputs) return;
    cardInputs.addEventListener('input', function (e) {
        if (e.target && e.target.id && e.target.id.startsWith('cardName')) {
            if (document.querySelector('input[name="conditionInputMode"]:checked')?.value === 'builder') {
                builderRender();
            }
        }
    });
    cardInputs.addEventListener('blur', function (e) {
        if (e.target && e.target.id && e.target.id.startsWith('cardName')) {
            if (document.querySelector('input[name="conditionInputMode"]:checked')?.value === 'builder') {
                builderRender();
            }
        }
    }, true);
}
