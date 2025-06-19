// 全局变量初始化
let calculationWorker = null;
let isCalculating = false;
let calculationStartTime = 0;
let progressUpdateInterval = null;

// 工具常量：localStorage存储上限设置为5MB
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB

// 数据管理相关函数已迁移到 data-manager.js
// 通过 window.DataManager 提供接口

// 保存卡组数据至localStorage中
function saveDeck() {
    window.DataManager.saveDeck();
}

// 从localStorage中加载指定卡组数据
function loadDeck() {
    window.DataManager.loadDeck();
}

// 删除选定的卡组
function deleteDeck() {
    window.DataManager.deleteDeck();
}

// 更新下拉列表中的卡组信息
function updateDeckList() {
    window.DataManager.updateDeckList();
}

// 计算记录相关
function saveCalculationRecord(result, condition, errorMessage = null) {
    window.DataManager.saveCalculationRecord(result, condition, errorMessage);
}
function exportCalculationRecords() {
    window.DataManager.exportCalculationRecords();
}
function clearCalculationRecords() {
    window.DataManager.clearCalculationRecords();
}

// 计算卡组内所有卡牌总数，更新显示
function updateTotalDeck() {
    window.UIUtils.updateTotalDeck();
}

// 更新饼状图显示卡牌分布
function updatePieChart() {
    window.UIUtils.updatePieChart();
}

// 计算已用秒数
function getElapsedSeconds() {
    return Math.floor((Date.now() - calculationStartTime) / 1000);
}

// 开始执行精确计算任务
function calculate() {
    if (isCalculating) {
        alert("计算正在进行中，请稍后...");
        return;
    }
    try {
        // 记录计算开始时间
        calculationStartTime = Date.now();
        // 验证卡名无重复
        let cardNames = [];
        let duplicateNames = new Set();
        for (let i = 0; i < 30; i++) {
            const name = document.getElementById(`cardName${i}`).value.trim();
            if (name) { if (cardNames.includes(name)) { duplicateNames.add(name); } cardNames.push(name); }
        }
        if (duplicateNames.size > 0) {
            throw new Error(`卡名重复：${Array.from(duplicateNames).join(', ')}`);
        }
        // 新增：在构建器模式下同步条件表达式
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
        // 重置并显示进度条与结果区域
        document.getElementById('calculationProgress').value = 0;
        document.getElementById('progressText').textContent = '计算中: 0%  计算用时: 0秒';
        document.getElementById('probability').value = '计算中...';
        document.getElementById('validCombinations').value = '计算中...';
        document.getElementById('totalCombinations').value = '计算中...';
        // 读取用户输入的卡牌数量
        const cardCounts = [];
        for (let i = 0; i < 30; i++) {
            cardCounts.push(parseInt(document.getElementById(`card${i}`).value) || 0);
        }
        const draws = parseInt(document.getElementById('draws').value);
        const deckSize = parseInt(document.getElementById('total').value);
        // 验证输入数据有效性
        if (draws <= 0) throw new Error("抽卡数必须大于0");
        if (deckSize <= 0) throw new Error("卡组中至少要有1张卡");
        if (draws > deckSize) throw new Error("抽卡数不能超过卡组总数");
        // 取得并转换用户输入的条件表达式
        let condition = document.getElementById('condition').value.trim();
        if (!condition) throw new Error("请输入逻辑判断条件");
        // 将条件表达式中的用户卡名映射至变量名
        const cardNameMap = {};
        const sortedNames = [];
        for (let i = 0; i < 30; i++) {
            const name = document.getElementById(`cardName${i}`).value.trim();
            if (name) { cardNameMap[name] = window.UIUtils.getVarName(i); sortedNames.push(name); }
        }
        sortedNames.sort((a, b) => b.length - a.length);
        for (const name of sortedNames) {
            const regex = new RegExp(window.UIUtils.escapeRegExp(name), 'g');
            condition = condition.replace(regex, cardNameMap[name]);
        }
        console.log("转换后的条件表达式:", condition);
        // 检测条件中是否错误使用赋值运算符
        const conditionWithoutOperators = condition.replace(/==|<=|>=|!=/g, '');
        if (conditionWithoutOperators.includes('=')) {
            alert("提示：条件表达式中建议使用 '==' 或 '===' 判断相等，请检查是否正确。");
        }
        // 创建Web Worker来执行计算任务
        calculationWorker = new Worker(URL.createObjectURL(new Blob([`
            // Worker内部：组合数计算（带缓存）
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
            // 将变量名映射为卡牌索引
            function varToIndex(varName) {
                const lc = varName.toLowerCase();
                if (lc === 'true' || lc === 'false') return lc;
                if (lc.length === 1) { let code = lc.charCodeAt(0) - 97; if (code >= 0 && code < 26) return code; }
                if (lc.length === 2 && lc[0] === 'a') { let code = lc.charCodeAt(1) - 97; if (code >= 0 && code < 4) return 26 + code; }
                throw new Error(\`无效的卡名称: \${varName}\`);
            }
            // 工具函数：计算最大公约数
            function gcd(a, b) { return b ? gcd(b, a % b) : a; }
            // 处理PROB(n)表达式
            function processCondition(cond) {
                let probMappings = [];
                let probIndex = 0;
                let processed = cond.replace(/PROB\\((\\d+)\\)/g, function(match, nStr) {
                    let n = parseInt(nStr);
                    if (n <= 0) return '(false)';
                    if (n >= 100) return '(true)';
                    let d = gcd(n, 100);
                    let num = n / d;
                    let denom = 100 / d;
                    probMappings.push({num, denom});
                    return \`(__prob\${probIndex++}__)\`;
                });
                return {processed, probMappings};
            }
            onmessage = function(e) {
                const { cardCounts, draws, condition } = e.data;
                const { processed: condProcessed, probMappings } = processCondition(condition);
                const argNames = ['counts'];
                for (let i = 0; i < probMappings.length; i++) {
                    argNames.push(\`__prob\${i}__\`);
                }
                const conditionFunc = new Function(...argNames,
                    \`return \${condProcessed.replace(/\\b([a-zA-Z]+)\\b(?!__)/g, (m) => {
                        return (m === 'true' || m === 'false') ? m : "counts[" + varToIndex(m) + "]";
                    })}\`);
                function calculateProbability(cardCounts, draws) {
                    let valid = 0n, total = 0n, lastReportedProgress = 0;
                    function evaluateCondition(counts) {
                        if (probMappings.length === 0)
                            return { valid: (conditionFunc(counts) ? 1n : 0n), multiplier: 1n };
                        let validCount = 0n;
                        function recurseProb(i, args) {
                            if(i === probMappings.length) {
                                if (conditionFunc(counts, ...args)) validCount += 1n;
                                return;
                            }
                            let {num, denom} = probMappings[i];
                            for (let j = 0; j < denom; j++) {
                                args.push(j < num);
                                recurseProb(i+1, args);
                                args.pop();
                            }
                        }
                        recurseProb(0, []);
                        let multiplier = probMappings.reduce((acc, {denom}) => acc * BigInt(denom), 1n);
                        return { valid: validCount, multiplier };
                    }
                    function recurse(index, counts, remaining) {
                        if (index === cardCounts.length) {
                            if (remaining !== 0) return;
                            let prob = 1n;
                            for (let i = 0; i < counts.length; i++) {
                                prob *= combination(cardCounts[i], counts[i]);
                            }
                            const evalRes = evaluateCondition(counts);
                            total += prob * evalRes.multiplier;
                            valid += prob * evalRes.valid;
                            return;
                        }
                        const progress = Math.min(100, Math.floor((index / cardCounts.length) * 100));
                        if (progress > lastReportedProgress) { lastReportedProgress = progress; postMessage({ type: 'progress', progress }); }
                        const max = Math.min(cardCounts[index], remaining);
                        for (let k = 0; k <= max; k++) {
                            counts[index] = k;
                            recurse(index + 1, [...counts], remaining - k);
                        }
                    }
                    recurse(0, [], draws);
                    return { valid, total };
                }
                try {
                    const result = calculateProbability(cardCounts, draws);
                    postMessage({ type: 'result', ...result });
                } catch (error) {
                    postMessage({ type: 'error', message: error.message });
                }
            };
        `], { type: 'text/javascript' })));
        // 设置Worker的消息回调函数
        calculationWorker.onmessage = function (e) {
            if (e.data.type === 'progress') {
                updateProgress(e.data.progress);
            } else if (e.data.type === 'result') {
                finalizeCalculation(e.data);
            } else if (e.data.type === 'error') {
                showError(e.data.message);
            }
        };
        // 将计算任务数据传递给Worker
        calculationWorker.postMessage({
            cardCounts,
            draws,
            condition
        });
        // 更新界面，标记计算任务已启动
        isCalculating = true;
        document.getElementById('cancelBtn').classList.remove('hidden');
    } catch (error) {
        showError(error.message);
    }
}

// 更新进度条显示信息
function updateProgress(progress) {
    document.getElementById('calculationProgress').value = progress;
    const elapsedSeconds = getElapsedSeconds();
    document.getElementById('progressText').textContent =
        `计算中: ${progress}%  计算用时: ${elapsedSeconds}秒`;
}

// 处理计算任务结束后的界面更新和结果展示
function finalizeCalculation(result) {
    // 清除用于更新计算用时的定时器
    clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;
    // 重置计算状态并隐藏取消按钮
    cleanupCalculation();
    const probability = (Number(result.valid) / Number(result.total)) * 100;
    const elapsedSeconds = getElapsedSeconds();
    document.getElementById('probability').value = `${probability.toFixed(20)}%`;
    document.getElementById('validCombinations').value = result.valid.toString();
    document.getElementById('totalCombinations').value = result.total.toString();
    // 立即将进度更新至100%
    document.getElementById('calculationProgress').value = 100;
    document.getElementById('progressText').textContent =
        `计算完成: 100%  计算用时: ${elapsedSeconds}秒`;
    saveCalculationRecord(result, document.getElementById('condition').value);
    // 新增：若启用复选框则自动将抽卡数加1
    if (document.getElementById('autoIncrementDraws')?.checked) {
        const drawsInput = document.getElementById('draws');
        drawsInput.value = parseInt(drawsInput.value) + 1;
    }
}

// 显示错误信息，并进行错误处理
function showError(message) {
    clearInterval(progressUpdateInterval);
    progressUpdateInterval = null;
    // 重置计算状态，隐藏取消按钮
    cleanupCalculation();
    // 将结果区域显示错误提示
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

// 清除计算状态标志
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
        // 验证卡名不重复
        let cardNames = [];
        let duplicateNames = new Set();
        for (let i = 0; i < 30; i++) {
            const name = document.getElementById(`cardName${i}`).value.trim();
            if (name) { if (cardNames.includes(name)) { duplicateNames.add(name); } cardNames.push(name); }
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
        // 同calculate()，将卡名替换为对应变量名
        const cardNameMap = {};
        const sortedNames = [];
        for (let i = 0; i < 30; i++) {
            const name = document.getElementById(`cardName${i}`).value.trim();
            if (name) { cardNameMap[name] = window.UIUtils.getVarName(i); sortedNames.push(name); }
        }
        sortedNames.sort((a, b) => b.length - a.length);
        for (const name of sortedNames) {
            const regex = new RegExp(window.UIUtils.escapeRegExp(name), 'g');
            condition = condition.replace(regex, cardNameMap[name]);
        }
        console.log("转换后的条件表达式（蒙特卡洛）:", condition);
        // 更新界面，启动蒙特卡洛模拟计算
        isCalculating = true;
        document.getElementById('cancelBtn').classList.remove('hidden');
        document.getElementById('calculationProgress').value = 0;
        document.getElementById('progressText').textContent = '蒙特卡洛模拟计算中: 0%  用时: 0秒';
        // 创建用于蒙特卡洛模拟计算的Worker
        const simulationWorker = new Worker(URL.createObjectURL(new Blob([`
            function varToIndex(varName) {
                const lc = varName.toLowerCase();
                if (lc === 'true' || lc === 'false') return lc;
                if (lc.length === 1) { let code = lc.charCodeAt(0) - 97; if (code >= 0 && code < 26) return code; }
                if (lc.length === 2 && lc[0] === 'a') { let code = lc.charCodeAt(1) - 97; if (code >= 0 && code < 4) return 26 + code; }
                throw new Error("无效的卡名称: " + varName);
            }
            function drawCards(shuffledDeck, draws) {
                let counts = Array(30).fill(0);
                const drawn = shuffledDeck.slice(0, draws);
                drawn.forEach(idx => { counts[idx]++; });
                return counts;
            }
            function shuffleArray(arr) {
                let array = arr.slice();
                for (let i = array.length - 1; i > 0; i--) {
                    let j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            }
            // 直接将PROB(n)表达式替换为动态生成的随机判断
            onmessage = function(e) {
                const { cardCounts, draws, condition } = e.data;
                let deck = [];
                for (let i = 0; i < cardCounts.length; i++) {
                    for (let j = 0; j < cardCounts[i]; j++) { deck.push(i); }
                }
                if (deck.length === 0) {
                    postMessage({ type: 'result', valid: 0, total: 500000, calculationMethod: "蒙特卡洛模拟" });
                    return;
                }
                const totalSimulations = 500000;
                let valid = 0;
                const replacedCondition = condition
                    .replace(/PROB\\((\\d+)\\)/g, "(Math.random() < ($1/100))")
                    .replace(/\\b([a-z]{1,2})\\b/g, function(m) {
                        return (m === 'true' || m === 'false') ? m : "counts[" + varToIndex(m) + "]";
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
                // 新增：若启用复选框则自动将抽卡数加1
                if (document.getElementById('autoIncrementDraws')?.checked) {
                    const drawsInput = document.getElementById('draws');
                    drawsInput.value = parseInt(drawsInput.value) + 1;
                }
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
    updateDeckList();
    window.UIUtils.updateTotalDeck();
    // 为所有卡牌数量输入框绑定变更事件
    document.querySelectorAll('.card-count').forEach(input => {
        input.addEventListener('change', window.UIUtils.updateTotalDeck);
    });
    // 初始化条件构建器（调用新模块接口）
    if (window.ConditionBuilder && window.ConditionBuilder.init) {
        window.ConditionBuilder.init();
    }
};

// 计算记录相关
function saveCalculationRecord(result, condition, errorMessage = null) {
    window.DataManager.saveCalculationRecord(result, condition, errorMessage);
}
function exportCalculationRecords() {
    window.DataManager.exportCalculationRecords();
}
function clearCalculationRecords() {
    window.DataManager.clearCalculationRecords();
}

// 代理条件构建器相关接口
window.getConditionInputMode = function () {
    return window.ConditionBuilder.getConditionInputMode();
};
window.getBuilderConditionData = function () {
    return window.ConditionBuilder.getBuilderConditionData();
};
window.setBuilderConditionData = function (json) {
    window.ConditionBuilder.setBuilderConditionData(json);
};
