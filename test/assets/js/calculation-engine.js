// 精确概率与蒙特卡洛模拟计算引擎
(function (global) {
    // 计算相关状态变量
    let calculationWorker = null; // 当前精确计算的Web Worker实例
    let isCalculating = false;    // 是否正在计算
    let calculationStartTime = 0; // 计算开始时间戳
    let progressUpdateInterval = null; // 进度刷新定时器

    // 获取当前计算已用秒数
    function getElapsedSeconds() {
        return Math.floor((Date.now() - calculationStartTime) / 1000);
    }

    // 精确组合概率计算主入口，负责参数校验、进度显示、worker启动
    function calculate() {
        if (isCalculating) {
            alert("计算正在进行中，请稍后...");
            return;
        }
        try {
            calculationStartTime = Date.now();
            // 检查卡名是否有重复
            let cardNames = [];
            let duplicateNames = new Set();
            for (let i = 0; i < 52; i++) {
                const name = document.getElementById(`cardName${i}`).value.trim();
                if (name) { if (cardNames.includes(name)) { duplicateNames.add(name); } cardNames.push(name); }
            }
            if (duplicateNames.size > 0) {
                throw new Error(`卡名重复：${Array.from(duplicateNames).join(', ')}`);
            }
            // 构建器模式下同步条件表达式（如有）
            if (global.getConditionInputMode && global.getConditionInputMode() === 'builder') {
                if (global.getBuilderConditionData && global.setBuilderConditionData) {
                    // builderUpdateOutput 自动同步 #condition
                }
            }
            // 启动进度刷新定时器
            progressUpdateInterval = setInterval(() => {
                const elapsedSeconds = getElapsedSeconds();
                const progress = document.getElementById('calculationProgress').value;
                document.getElementById('progressText').textContent =
                    `计算中: ${progress}%  计算用时: ${elapsedSeconds}秒`;
            }, 1000);
            // 重置进度条和结果显示
            document.getElementById('calculationProgress').value = 0;
            document.getElementById('progressText').textContent = '计算中: 0%  计算用时: 0秒';
            document.getElementById('probability').value = '计算中...';
            document.getElementById('validCombinations').value = '计算中...';
            document.getElementById('totalCombinations').value = '计算中...';
            // 读取卡牌数量
            const cardCounts = [];
            for (let i = 0; i < 52; i++) {
                cardCounts.push(parseInt(document.getElementById(`card${i}`).value) || 0);
            }
            const draws = parseInt(document.getElementById('draws').value);
            const deckSize = parseInt(document.getElementById('total').value);
            // 输入有效性检查
            if (draws <= 0) throw new Error("抽卡数必须大于0");
            if (deckSize <= 0) throw new Error("卡组中至少要有1张卡");
            if (draws > deckSize) throw new Error("抽卡数不能超过卡组总数");
            // 获取并转换条件表达式
            let condition = document.getElementById('condition').value.trim();
            if (!condition) throw new Error("请输入逻辑判断条件");
            // 卡名映射为变量名
            const cardNameMap = {};
            const sortedNames = [];
            for (let i = 0; i < 52; i++) {
                const name = document.getElementById(`cardName${i}`).value.trim();
                if (name) { cardNameMap[name] = global.UIUtils.getVarName(i); sortedNames.push(name); }
            }
            sortedNames.sort((a, b) => b.length - a.length);
            for (const name of sortedNames) {
                const regex = new RegExp(global.UIUtils.escapeRegExp(name), 'g');
                condition = condition.replace(regex, cardNameMap[name]);
            }
            // 检查条件表达式是否误用赋值运算符
            const conditionWithoutOperators = condition.replace(/==|<=|>=|!=/g, '');
            if (conditionWithoutOperators.includes('=')) {
                alert("提示：条件表达式中建议使用 '==' 或 '===' 判断相等，请检查是否正确。");
            }
            // 创建Web Worker执行精确组合枚举计算
            calculationWorker = new Worker(URL.createObjectURL(new Blob([`
                // Worker内部：组合数计算（带缓存）与条件判定
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
                function varToIndex(varName) {
                    const lc = varName.toLowerCase();
                    if (lc === 'true' || lc === 'false') return lc;
                    if (lc.length === 1) { let code = lc.charCodeAt(0) - 97; if (code >= 0 && code < 26) return code; }
                    if (lc.length === 2 && lc[0] === 'a') { let code = lc.charCodeAt(1) - 97; if (code >= 0 && code < 26) return 26 + code; }
                    throw new Error(\`无效的卡名称: \${varName}\`);
                }
                function gcd(a, b) { return b ? gcd(b, a % b) : a; }
                function processCondition(cond) {
                    let probMappings = [];
                    let probIndex = 0;
                    let processed = cond.replace(/PROB\\((\\d+(?:\\.\\d+)?)\\)/g, function(match, nStr) {
                        let n = Math.round(parseFloat(nStr) * 100);
                        if (n <= 0) return '(false)';
                        if (n >= 10000) return '(true)';
                        let d = gcd(n, 10000);
                        let num = n / d;
                        let denom = 10000 / d;
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
            calculationWorker.onmessage = function (e) {
                if (e.data.type === 'progress') {
                    updateProgress(e.data.progress);
                } else if (e.data.type === 'result') {
                    finalizeCalculation(e.data);
                } else if (e.data.type === 'error') {
                    showError(e.data.message);
                }
            };
            calculationWorker.postMessage({
                cardCounts,
                draws,
                condition
            });
            isCalculating = true;
            document.getElementById('cancelBtn').classList.remove('hidden');
        } catch (error) {
            showError(error.message);
        }
    }

    // 刷新进度条和用时显示
    function updateProgress(progress) {
        document.getElementById('calculationProgress').value = progress;
        const elapsedSeconds = getElapsedSeconds();
        document.getElementById('progressText').textContent =
            `计算中: ${progress}%  计算用时: ${elapsedSeconds}秒`;
    }

    // 精确计算完成后处理结果，显示概率、组合数等
    function finalizeCalculation(result) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
        cleanupCalculation();
        // 使用BigInt进行精确百分比计算
        const probability = Number(BigInt(result.valid) * (10n ** 20n) / BigInt(result.total)) / (10 ** 20);
        const elapsedSeconds = getElapsedSeconds();
        document.getElementById('probability').value = `${probability.toFixed(15)}%`;
        document.getElementById('validCombinations').value = result.valid.toString();
        document.getElementById('totalCombinations').value = result.total.toString();
        document.getElementById('calculationProgress').value = 100;
        document.getElementById('progressText').textContent =
            `计算完成: 100%  计算用时: ${elapsedSeconds}秒`;
        global.DataManager.saveCalculationRecord(result, document.getElementById('condition').value);
        if (document.getElementById('autoIncrementDraws')?.checked) {
            const drawsInput = document.getElementById('draws');
            drawsInput.value = parseInt(drawsInput.value) + 1;
        }
    }

    // 显示错误信息并重置界面
    function showError(message) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
        cleanupCalculation();
        document.getElementById('probability').value = '计算错误';
        document.getElementById('validCombinations').value = '计算错误';
        document.getElementById('totalCombinations').value = '计算错误';
        const elapsedSeconds = getElapsedSeconds();
        document.getElementById('calculationProgress').value = 0;
        document.getElementById('progressText').textContent =
            `计算错误  计算用时: ${elapsedSeconds}秒`;
        alert(`计算错误: ${message}`);
        global.DataManager.saveCalculationRecord({}, document.getElementById('condition').value, message);
    }

    // 取消当前计算，终止worker并重置界面
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

    // 清理计算相关状态
    function cleanupCalculation() {
        isCalculating = false;
        document.getElementById('cancelBtn').classList.add('hidden');
        calculationWorker = null;
    }

    // 蒙特卡洛模拟主入口，负责参数校验、进度显示、worker启动
    function monteCarloCalculate() {
        if (isCalculating) {
            if (!confirm("当前计算正在进行，是否取消并使用蒙特卡洛模拟计算？")) return;
            cancelCalculation();
        }
        try {
            calculationStartTime = Date.now();
            // 检查卡名重复
            let cardNames = [];
            let duplicateNames = new Set();
            for (let i = 0; i < 52; i++) {
                const name = document.getElementById(`cardName${i}`).value.trim();
                if (name) { if (cardNames.includes(name)) { duplicateNames.add(name); } cardNames.push(name); }
            }
            if (duplicateNames.size > 0) {
                throw new Error(`卡名重复：${Array.from(duplicateNames).join(', ')}`);
            }
            // 读取卡牌数量
            const cardCounts = [];
            for (let i = 0; i < 52; i++) {
                cardCounts.push(parseInt(document.getElementById(`card${i}`).value) || 0);
            }
            const draws = parseInt(document.getElementById('draws').value);
            const deckSize = parseInt(document.getElementById('total').value);
            if (draws <= 0) throw new Error("抽卡数必须大于0");
            if (deckSize <= 0) throw new Error("卡组中至少要有1张卡");
            if (draws > deckSize) throw new Error("抽卡数不能超过卡组总数");
            let condition = document.getElementById('condition').value.trim();
            if (!condition) throw new Error("请输入逻辑判断条件");
            // 卡名映射为变量名
            const cardNameMap = {};
            const sortedNames = [];
            for (let i = 0; i < 52; i++) {
                const name = document.getElementById(`cardName${i}`).value.trim();
                if (name) { cardNameMap[name] = global.UIUtils.getVarName(i); sortedNames.push(name); }
            }
            sortedNames.sort((a, b) => b.length - a.length);
            for (const name of sortedNames) {
                const regex = new RegExp(global.UIUtils.escapeRegExp(name), 'g');
                condition = condition.replace(regex, cardNameMap[name]);
            }
            isCalculating = true;
            document.getElementById('cancelBtn').classList.remove('hidden');
            document.getElementById('calculationProgress').value = 0;
            document.getElementById('progressText').textContent = '蒙特卡洛模拟计算中: 0%  用时: 0秒';
            // 创建Web Worker执行蒙特卡洛模拟
            const simulationWorker = new Worker(URL.createObjectURL(new Blob([`
                // Worker内部：蒙特卡洛抽卡模拟与条件判定
                function varToIndex(varName) {
                    const lc = varName.toLowerCase();
                    if (lc === 'true' || lc === 'false') return lc;
                    if (lc.length === 1) { let code = lc.charCodeAt(0) - 97; if (code >= 0 && code < 26) return code; }
                    if (lc.length === 2 && lc[0] === 'a') { let code = lc.charCodeAt(1) - 97; if (code >= 0 && code < 26) return 26 + code; }
                    throw new Error("无效的卡名称: " + varName);
                }
                function drawCards(shuffledDeck, draws) {
                    let counts = Array(52).fill(0);
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
                        .replace(/PROB\\((\\d+(?:\\.\\d+)?)\\)/g, "(Math.random() < ($1/10000))")
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
                    // 使用BigInt进行精确百分比计算
                    const probability = Number(BigInt(e.data.valid) * (10n ** 20n) / BigInt(e.data.total)) / (10 ** 20);
                    const elapsedSeconds = getElapsedSeconds();
                    document.getElementById('probability').value = `${probability.toFixed(15)}%`;
                    document.getElementById('validCombinations').value = e.data.valid.toString();
                    document.getElementById('totalCombinations').value = e.data.total.toString();
                    document.getElementById('calculationProgress').value = 100;
                    document.getElementById('progressText').textContent =
                        `蒙特卡洛模拟完成: 100% 用时: ${elapsedSeconds}秒`;
                    global.DataManager.saveCalculationRecord(e.data, document.getElementById('condition').value);
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

    // 导出接口
    global.CalculationEngine = {
        calculate,              // 精确组合概率计算
        monteCarloCalculate,    // 蒙特卡洛模拟计算
        cancelCalculation,      // 取消计算
        getElapsedSeconds       // 获取已用秒数
    };
})(window);
