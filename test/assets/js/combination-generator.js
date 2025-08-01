/**
 * 游戏王实际组合生成器模块
 * 功能：根据卡组信息和条件生成符合条件的实际组合
 * 核心方法：generateCombinations() - 暴力枚举组合
 * 依赖：ui-utils.js 提供的变量名转换功能
 */
(function (global) {
    // 生成器状态变量
    let generatorWorker = null;
    let isGenerating = false;
    let generationStartTime = 0;
    let progressUpdateInterval = null;
    let pauseTimes = [10, 30, 60, 90, 120, 180, 240, 300]; // 暂停时间节点(秒)
    let nextPauseIndex = 0;
    let foundCombinations = 0;

    // 获取当前生成已用秒数
    function getElapsedSeconds() {
        return Math.floor((Date.now() - generationStartTime) / 1000);
    }

    // 生成组合主入口
    function generateCombinations() {
        if (isGenerating) {
            alert("组合生成正在进行中，请稍后...");
            return;
        }
        try {
            generationStartTime = Date.now();
            nextPauseIndex = 0;
            foundCombinations = 0;

            // 检查卡名重复
            let cardNames = [];
            let duplicateNames = new Set();
            for (let i = 0; i < 52; i++) {
                const name = document.getElementById(`cardName${i}`).value.trim();
                if (name) { 
                    if (cardNames.includes(name)) duplicateNames.add(name); 
                    cardNames.push(name); 
                }
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

            // 获取条件表达式
            let condition = document.getElementById('condition').value.trim();
            if (!condition) throw new Error("请输入逻辑判断条件");

            // 卡名映射为变量名
            const cardNameMap = {};
            const sortedNames = [];
            for (let i = 0; i < 52; i++) {
                const name = document.getElementById(`cardName${i}`).value.trim();
                if (name) { 
                    cardNameMap[name] = global.UIUtils.getVarName(i); 
                    sortedNames.push(name); 
                }
            }
            sortedNames.sort((a, b) => b.length - a.length);
            for (const name of sortedNames) {
                const regex = new RegExp(global.UIUtils.escapeRegExp(name), 'g');
                condition = condition.replace(regex, cardNameMap[name]);
            }

            // 获取生成选项
            const combinationType = document.querySelector('input[name="combinationType"]:checked').value;
            const combinationCount = parseInt(document.getElementById('combinationCount').value) || 10;

            // 创建Web Worker执行组合生成
            generatorWorker = new Worker(URL.createObjectURL(new Blob([`
                // Worker内部：组合生成与条件验证
                let combinations = [];
                let deck = [];
                let cardNames = [];
                let conditionFunc;
                let combinationType;
                let maxCombinations;
                let shouldStop = false;

                function varToIndex(varName) {
                    const lc = varName.toLowerCase();
                    if (lc === 'true' || lc === 'false') return lc;
                    if (lc.length === 1) { 
                        let code = lc.charCodeAt(0) - 97; 
                        if (code >= 0 && code < 26) return code; 
                    }
                    if (lc.length === 2 && lc[0] === 'a') { 
                        let code = lc.charCodeAt(1) - 97; 
                        if (code >= 0 && code < 26) return 26 + code; 
                    }
                    throw new Error("无效的卡名称: " + varName);
                }

                function initialize(cardCounts, cardNames, condition, type, count) {
                    // 构建牌组数组
                    deck = [];
                    for (let i = 0; i < cardCounts.length; i++) {
                        for (let j = 0; j < cardCounts[i]; j++) {
                            deck.push(i);
                        }
                    }
                    // 构建卡名数组
                    this.cardNames = cardNames;
                    // 处理PROB函数
                    const probMatches = condition.match(/PROB\\((\\d+(?:\\.\\d+)?)\\)/g) || [];
                    const probValues = probMatches.map(m => parseFloat(m.match(/PROB\\((\\d+(?:\\.\\d+)?)\\)/)[1]));
                    
                    // 构建基础条件函数
                    const baseCondition = condition
                        .replace(/PROB\\((\\d+(?:\\.\\d+)?)\\)/g, "__PROB__")
                        .replace(/\\b([a-z]{1,2})\\b/g, function(m) {
                            return (m === 'true' || m === 'false') ? m : "counts[" + varToIndex(m) + "]";
                        });

                    // 创建条件验证函数
                    conditionFunc = function(counts) {
                        // 递归处理所有PROB组合
                        function evaluate(index, currentCondition) {
                            if (index >= probValues.length) {
                                return eval(currentCondition);
                            }
                            // 计算PROB(0)和PROB(100)两种情况
                            const prob0 = currentCondition.replace('__PROB__', 'false');
                            const prob100 = currentCondition.replace('__PROB__', 'true');
                            return evaluate(index + 1, prob0) || evaluate(index + 1, prob100);
                        }
                        return evaluate(0, baseCondition);
                    };
                    
                    combinationType = type;
                    maxCombinations = count;
                }

                function generateUniqueCombinations(draws) {
                    const seen = new Set();
                    const result = [];
                    const counts = Array(52).fill(0);

                    function backtrack(start, remaining, currentCounts) {
                        if (shouldStop) return;
                        if (remaining === 0) {
                            const key = currentCounts.join(',');
                            if (!seen.has(key)) {
                                seen.add(key);
                                const isValid = conditionFunc(currentCounts);
                                if ((combinationType === 'valid' && isValid) || 
                                    (combinationType === 'invalid' && !isValid)) {
                                    result.push([...currentCounts]);
                                    postMessage({ 
                                        type: 'combination', 
                                        counts: [...currentCounts],
                                        totalFound: result.length
                                    });
                                }
                            }
                            return;
                        }
                        for (let i = start; i < deck.length; i++) {
                            const cardIndex = deck[i];
                            currentCounts[cardIndex]++;
                            backtrack(i + 1, remaining - 1, currentCounts);
                            currentCounts[cardIndex]--;
                            if (result.length >= maxCombinations) {
                                shouldStop = true;
                                return;
                            }
                        }
                    }

                    backtrack(0, draws, counts);
                    return result;
                }

                onmessage = function(e) {
                    if (e.data.type === 'start') {
                        initialize(
                            e.data.cardCounts,
                            e.data.cardNames,
                            e.data.condition,
                            e.data.combinationType,
                            e.data.combinationCount
                        );
                        generateUniqueCombinations(e.data.draws);
                        postMessage({ type: 'complete', totalFound: combinations.length });
                    } else if (e.data.type === 'stop') {
                        shouldStop = true;
                    }
                };
            `], { type: 'text/javascript' })));

            generatorWorker.onmessage = function (e) {
                if (e.data.type === 'combination') {
                    foundCombinations = e.data.totalFound;
                    // 将组合转换为可读格式并追加到结果文本框
                    const combinationText = formatCombination(e.data.counts, cardNames);
                    const resultsTextarea = document.getElementById('combinationResults');
                    resultsTextarea.value += combinationText + '\n';
                    resultsTextarea.scrollTop = resultsTextarea.scrollHeight;
                } else if (e.data.type === 'complete') {
                    finalizeGeneration();
                }
            };

            // 启动进度更新定时器
            progressUpdateInterval = setInterval(updateGenerationProgress, 1000);

            // 启动生成器
            generatorWorker.postMessage({
                type: 'start',
                cardCounts,
                cardNames,
                draws,
                condition,
                combinationType,
                combinationCount
            });

            isGenerating = true;
            document.getElementById('combinationResults').value = '';
        } catch (error) {
            showGenerationError(error.message);
        }
    }

    // 格式化组合为可读文本
    function formatCombination(counts, cardNames) {
        let result = [];
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] > 0) {
                const name = cardNames[i] || global.UIUtils.getVarName(i).toUpperCase() + '类卡';
                result.push(`${name}×${counts[i]}`);
            }
        }
        return result.join(' + ') || '空组合';
    }

    // 更新生成进度
    function updateGenerationProgress() {
        const elapsedSeconds = getElapsedSeconds();
        document.getElementById('progressText').textContent =
            `生成中: 已找到 ${foundCombinations} 组合  用时: ${elapsedSeconds}秒`;

        // 检查是否需要暂停
        if (nextPauseIndex < pauseTimes.length && elapsedSeconds >= pauseTimes[nextPauseIndex]) {
            pauseGeneration();
            nextPauseIndex++;
        }
    }

    // 暂停生成并询问用户
    function pauseGeneration() {
        if (!isGenerating) return;
        
        generatorWorker.postMessage({ type: 'stop' });
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;

        const elapsedSeconds = getElapsedSeconds();
        const shouldContinue = confirm(
            `已生成 ${foundCombinations} 个组合，用时 ${elapsedSeconds} 秒。\n` +
            `可能已无更多有效组合，是否继续生成？`
        );

        if (shouldContinue) {
            progressUpdateInterval = setInterval(updateGenerationProgress, 1000);
            generatorWorker.postMessage({ type: 'start' });
        } else {
            finalizeGeneration();
        }
    }

    // 生成完成后清理
    function finalizeGeneration() {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
        cleanupGeneration();

        const elapsedSeconds = getElapsedSeconds();
        const resultsTextarea = document.getElementById('combinationResults');
        resultsTextarea.value += `\n生成完成: 共找到 ${foundCombinations} 组合  用时: ${elapsedSeconds}秒\n`;
        document.getElementById('progressText').textContent = '生成完成';
    }

    // 显示生成错误
    function showGenerationError(message) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
        cleanupGeneration();

        document.getElementById('combinationResults').value = '生成错误: ' + message;
        document.getElementById('progressText').textContent = '生成错误';
        alert('生成错误: ' + message);
    }

    // 清理生成状态
    function cleanupGeneration() {
        isGenerating = false;
        if (generatorWorker) {
            generatorWorker.terminate();
            generatorWorker = null;
        }
    }

    // 取消生成
    function cancelGeneration() {
        if (!isGenerating) return;
        
        generatorWorker.postMessage({ type: 'stop' });
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
        cleanupGeneration();

        const elapsedSeconds = getElapsedSeconds();
        document.getElementById('progressText').textContent =
            `生成已取消  用时: ${elapsedSeconds}秒`;
        alert("生成已取消");
    }

    // 导出接口
    global.CombinationGenerator = {
        generateCombinations,
        cancelGeneration
    };
})(window);
