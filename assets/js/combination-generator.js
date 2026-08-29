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
                let deck = [];
                let conditionFunc;
                let combinationType;
                let maxCombinations;
                let draws;
                // 已发现（并已发送给主线程）的组合去重集合；续算时保留并跳过，避免重复输出
                let sentKeys = new Set();
                let sentCount = 0;
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

                function initialize(cardCountsArr, condition, type, count, drawCount) {
                    // 构建牌组数组
                    deck = [];
                    for (let i = 0; i < cardCountsArr.length; i++) {
                        for (let j = 0; j < cardCountsArr[i]; j++) {
                            deck.push(i);
                        }
                    }
                    draws = drawCount;
                    // 处理PROB函数
                    const probMatches = condition.match(/PROB\((\\d+(?:\.\d+)?)\)/g) || [];
                    const probValues = probMatches.map(m => parseFloat(m.match(/PROB\((\\d+(?:\.\d+)?)\)/)[1]));
                    
                    // 构建基础条件表达式
                    const baseCondition = condition
                        .replace(/PROB\((\\d+(?:\.\d+)?)\)/g, "__PROB__")
                        .replace(/\\b([a-z]{1,2})\\b/g, function(m) {
                            return (m === 'true' || m === 'false') ? m : "counts[" + varToIndex(m) + "]";
                        });

                    // 优化：把 eval 改为一次编译的 new Function
                    // 每个 __PROB__ 占位符展开为真/假两种分支的表达式（存在任一分支满足即视为满足）
                    function expandProbs(expr, index) {
                        if (index >= probValues.length) return expr;
                        const branchFalse = expandProbs(expr.replace('__PROB__', 'false'), index + 1);
                        const branchTrue = expandProbs(expr.replace('__PROB__', 'true'), index + 1);
                        return '(' + branchFalse + ') || (' + branchTrue + ')';
                    }
                    const expanded = expandProbs(baseCondition, 0);
                    conditionFunc = new Function("counts", "return " + expanded);

                    combinationType = type;
                    maxCombinations = count;
                }

                // 递归组合枚举：从 deck 中选 draws 个位置（索引严格递增），计数去重，按条件过滤
                // 续算（reset=false）时保留 sentKeys，重扫时跳过已发送组合，不重复输出
                function generateUniqueCombinations() {
                    const result = [];
                    const currentCounts = Array(52).fill(0);

                    function backtrack(start, remaining) {
                        if (shouldStop) return;
                        if (remaining === 0) {
                            const key = currentCounts.join(',');
                            if (!sentKeys.has(key)) {
                                sentKeys.add(key);
                                const isValid = conditionFunc(currentCounts);
                                if ((combinationType === 'valid' && isValid) ||
                                    (combinationType === 'invalid' && !isValid)) {
                                    result.push(currentCounts.slice());
                                    sentCount++;
                                    postMessage({
                                        type: 'combination',
                                        counts: currentCounts.slice(),
                                        totalFound: sentCount
                                    });
                                }
                            }
                            return;
                        }
                        for (let i = start; i < deck.length; i++) {
                            currentCounts[deck[i]]++;
                            backtrack(i + 1, remaining - 1);
                            currentCounts[deck[i]]--;
                            if (sentCount >= maxCombinations) { shouldStop = true; return; }
                            if (shouldStop) return;
                        }
                    }

                    backtrack(0, draws);
                    return result;
                }

                onmessage = function(e) {
                    if (e.data.type === 'start') {
                        if (e.data.reset) {
                            // 全新开始：清空已发送记录
                            sentKeys = new Set();
                            sentCount = 0;
                            shouldStop = false;
                            initialize(
                                e.data.cardCounts,
                                e.data.condition,
                                e.data.combinationType,
                                e.data.combinationCount,
                                e.data.draws
                            );
                        } else {
                            // 续算：保留 sentKeys/sentCount，重置停止标志，重扫跳过已发送组合
                            shouldStop = false;
                        }
                        // 若已达到目标数量，无需继续枚举，直接完成
                        if (sentCount >= maxCombinations) {
                            postMessage({ type: 'complete', totalFound: sentCount });
                            return;
                        }
                        const result = generateUniqueCombinations();
                        if (!shouldStop) {
                            postMessage({ type: 'complete', totalFound: sentCount });
                        }
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
                reset: true,   // 全新开始：清空 Worker 内已发送组合记录
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
            // 续算：保留 Worker 内已发送组合记录，跳过已生成组合，继续枚举
            progressUpdateInterval = setInterval(updateGenerationProgress, 1000);
            generatorWorker.postMessage({ type: 'start', reset: false });
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
