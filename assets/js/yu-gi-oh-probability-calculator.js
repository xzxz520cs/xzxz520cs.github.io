// 变量
let calculationWorker = null;
let isCalculating = false;
let lastUpdateTime = 0;
let lastRealProgress = 0;
let animationFrameId = null;

// 生成卡牌标签（A-Z, AA-AD）
function getCardLabel(index) {
    if (index < 26) return String.fromCharCode(65 + index);
    return `A${String.fromCharCode(65 + index - 26)}`;
}

// 创建30个卡牌输入框
function createCardInputs() {
    const container = document.getElementById('cardInputs');
    for (let i = 0; i < 30; i++) {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
                    <label>${getCardLabel(i)}类卡</label>
                    <input type="number" id="card${i}" value="0" min="0" class="form-control card-count" onchange="updateTotalDeck()">
                    <input type="text" id="cardName${i}" class="form-control mt-1" placeholder="卡名">
                `;
        container.appendChild(div);
    }
}

// 保存卡组
function saveDeck() {
    const deckName = document.getElementById('deckName').value.trim();
    if (!deckName) {
        alert("请输入卡组名称");
        return;
    }

    const deck = {
        id: Date.now(),
        name: deckName,
        cards: [],
        condition: document.getElementById('condition').value
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

// 加载卡组
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
    document.getElementById('condition').value = deck.condition;
    updateTotalDeck();
    alert("卡组加载成功！");
}

// 删除卡组
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

// 更新卡组列表
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

// 计算卡组总数
function updateTotalDeck() {
    let total = 0;
    document.querySelectorAll('.card-count').forEach(input => {
        total += parseInt(input.value) || 0;
    });
    document.getElementById('total').value = total;
    updatePieChart();
}

// 更新饼图
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

// 生成颜色
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

// 平滑更新进度条
function smoothUpdateProgress(targetProgress) {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    const progressBar = document.getElementById('calculationProgress');
    const progressText = document.getElementById('progressText');
    const startTime = Date.now();
    const duration = 300; // 动画持续时间(ms)
    const startProgress = parseFloat(progressBar.value);

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = startProgress + (targetProgress - startProgress) * progress;

        progressBar.value = currentValue;
        progressText.textContent = `计算中: ${Math.round(currentValue)}%`;

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            animationFrameId = null;
        }
    }

    animate();
}

// 开始计算
function calculate() {
    if (isCalculating) {
        alert("计算正在进行中，请稍后...");
        return;
    }

    try {
        // 初始化进度状态
        lastUpdateTime = 0;
        lastRealProgress = 0;

        // 显示进度条
        document.getElementById('calculationProgress').value = 0;
        document.getElementById('progressText').textContent = '计算中: 0%';
        document.getElementById('progressContainer').classList.remove('hidden');

        // 重置结果
        document.getElementById('probability').value = '计算中...';
        document.getElementById('validCombinations').value = '计算中...';
        document.getElementById('totalCombinations').value = '计算中...';

        // 读取输入数据
        const cardCounts = [];
        for (let i = 0; i < 30; i++) {
            cardCounts.push(parseInt(document.getElementById(`card${i}`).value) || 0);
        }
        const draws = parseInt(document.getElementById('draws').value);
        const deckSize = parseInt(document.getElementById('total').value);

        // 输入验证
        if (draws <= 0) throw new Error("抽卡数必须大于0");
        if (deckSize <= 0) throw new Error("卡组中至少要有1张卡");
        if (draws > deckSize) throw new Error("抽卡数不能超过卡组总数");

        // 转换条件表达式
        const condition = document.getElementById('condition').value;
        if (!condition.trim()) throw new Error("请输入逻辑判断条件");

        // 提示用户关于使用 '==' 的建议
        if (condition.includes('=') && !condition.includes('==')) {
            alert("提示：在条件表达式中，'=' 是赋值运算符。如果您要判断相等，请使用 '==' 或 '==='。例如：a == 1");
        }

        // 创建Web Worker
        calculationWorker = new Worker(URL.createObjectURL(new Blob([`
                    // 带缓存的组合数计算
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

                    // 变量名转换
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

                    // 主计算函数
                    function calculateProbability(cardCounts, draws, condition) {
                        const totalCards = cardCounts.reduce((a, b) => a + b, 0);
                        let valid = 0n, total = 0n;
                        let lastReportedProgress = 0;
                        let lastReportTime = 0;

                        // 解析条件表达式
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

                            // 计算进度 - 基于递归深度
                            const progress = Math.min(100, Math.floor((index / cardCounts.length) * 100));
                            const now = Date.now();
                            
                            // 控制进度更新频率，至少间隔100ms或进度变化超过5%
                            if ((now - lastReportTime > 100 || progress - lastReportedProgress > 5 || progress >= 100) && 
                                progress > lastReportedProgress) {
                                lastReportedProgress = progress;
                                lastReportTime = now;
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

        // 设置Worker事件监听
        calculationWorker.onmessage = function (e) {
            if (e.data.type === 'progress') {
                const now = Date.now();
                const targetProgress = e.data.progress;

                // 使用平滑动画更新进度
                smoothUpdateProgress(targetProgress);

                // 记录最后真实的进度和时间
                lastRealProgress = targetProgress;
                lastUpdateTime = now;

                // 如果是最终进度，立即更新
                if (targetProgress >= 100) {
                    document.getElementById('calculationProgress').value = 100;
                    document.getElementById('progressText').textContent = '计算完成: 100%';
                }
            } else if (e.data.type === 'result') {
                finalizeCalculation(e.data);
            } else if (e.data.type === 'error') {
                showError(e.data.message);
            }
        };

        // 发送计算任务
        calculationWorker.postMessage({
            cardCounts,
            draws,
            condition
        });

        // 更新UI状态
        isCalculating = true;
        document.getElementById('cancelBtn').classList.remove('hidden');
    } catch (error) {
        showError(error.message);
    }
}

// 完成计算
function finalizeCalculation(result) {
    const probability = (Number(result.valid) / Number(result.total)) * 100;

    document.getElementById('probability').value = `${probability.toFixed(20)}%`;
    document.getElementById('validCombinations').value = result.valid.toString();
    document.getElementById('totalCombinations').value = result.total.toString();

    // 确保最终进度显示100%
    document.getElementById('calculationProgress').value = 100;
    document.getElementById('progressText').textContent = '计算完成: 100%';

    cleanupCalculation();
}

// 显示错误
function showError(message) {
    alert(`计算错误: ${message}`);
    cleanupCalculation();
}

// 取消计算
function cancelCalculation() {
    if (calculationWorker) {
        calculationWorker.terminate();
        calculationWorker = null;
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // 显示取消状态
    document.getElementById('calculationProgress').value = 0;
    document.getElementById('progressText').textContent = '计算已取消';

    cleanupCalculation();
    alert("计算已取消");
}

// 清理计算状态
function cleanupCalculation() {
    isCalculating = false;
    document.getElementById('cancelBtn').classList.add('hidden');
    calculationWorker = null;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// 初始化页面
window.onload = function () {
    createCardInputs();
    updateDeckList();
    updateTotalDeck();

    // 为所有输入框添加事件监听
    document.querySelectorAll('.card-count').forEach(input => {
        input.addEventListener('change', updateTotalDeck);
    });
};
