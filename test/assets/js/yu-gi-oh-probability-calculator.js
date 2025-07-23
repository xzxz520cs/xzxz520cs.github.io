/**
 * 游戏王概率计算器主模块
 * 功能：整合所有模块功能，提供全局接口
 * 核心方法：各按钮点击事件处理函数
 * 依赖：所有其他功能模块
 */
// 工具常量：localStorage最大存储空间（字节）
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB

// 调用 DataManager 保存当前卡组到本地存储
function saveDeck() {
    window.DataManager.saveDeck();
}

// 调用 DataManager 从本地存储加载卡组
function loadDeck() {
    window.DataManager.loadDeck();
}

// 调用 DataManager 删除当前选中的卡组
function deleteDeck() {
    window.DataManager.deleteDeck();
}

// 调用 DataManager 刷新卡组下拉列表
function updateDeckList() {
    window.DataManager.updateDeckList();
}

// 保存一次概率计算记录，包含结果、条件和可选错误信息
function saveCalculationRecord(result, condition, errorMessage = null) {
    window.DataManager.saveCalculationRecord(result, condition, errorMessage);
}
// 导出所有概率计算记录
function exportCalculationRecords() {
    window.DataManager.exportCalculationRecords();
}
// 清空所有概率计算记录
function clearCalculationRecords() {
    window.DataManager.clearCalculationRecords();
}

// 刷新卡组总数显示
function updateTotalDeck() {
    window.UIUtils.updateTotalDeck();
}

// 刷新概率分布饼图
function updatePieChart() {
    window.UIUtils.updatePieChart();
}

// 获取当前计算已用秒数（由 CalculationEngine 维护）
function getElapsedSeconds() {
    return window.CalculationEngine.getElapsedSeconds();
}

// 精确概率计算入口，调用 CalculationEngine
function calculate() {
    window.CalculationEngine.clearMonteCarloCache();
    window.CalculationEngine.calculate();
}

// 蒙特卡洛模拟入口，调用 CalculationEngine
function monteCarloCalculate() {
    window.CalculationEngine.monteCarloCalculate();
}

// 取消当前概率计算
function cancelCalculation() {
    window.CalculationEngine.cancelCalculation();
}

// 字符串换行工具函数(确保返回数组)
function wrapText(text, maxLength = 50) {
    if (!text || typeof text !== 'string') return [''];
    
    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if (currentLine.length + word.length + 1 <= maxLength) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

// 页面加载时初始化：刷新卡组、绑定输入事件、初始化条件构建器
window.onload = function () {
    updateDeckList();
    window.UIUtils.updateTotalDeck();
    document.querySelectorAll('.card-count').forEach(input => {
        input.addEventListener('change', window.UIUtils.updateTotalDeck);
    });
    if (window.ConditionBuilder && window.ConditionBuilder.init) {
        window.ConditionBuilder.init();
    }

    // 初始化卡片显示控制功能
    window.UIUtils.initCardVisibilityControls();

    // 初始化历史记录显示控制功能
    document.getElementById('showHistoryBtn').addEventListener('click', function () {
        document.getElementById('historyTable').classList.remove('hidden');
        document.getElementById('showHistoryBtn').classList.add('hidden');
        document.getElementById('hideHistoryBtn').classList.remove('hidden');
        window.HistoryManager.loadHistoryRecords();
    });

    document.getElementById('hideHistoryBtn').addEventListener('click', function () {
        document.getElementById('historyTable').classList.add('hidden');
        document.getElementById('showHistoryBtn').classList.remove('hidden');
        document.getElementById('hideHistoryBtn').classList.add('hidden');
    });

    // 初始化历史记录管理器
    window.HistoryManager = {
        /**
         * 从localStorage加载最近25条计算记录
         * 并渲染图表
         */
        loadHistoryRecords: function () {
            const records = JSON.parse(localStorage.getItem('calculationRecords') || '[]');
            const recentRecords = records.slice(-25); // 获取最近25条

            this.renderHistoryChart(recentRecords);
        },

        /**
         * 渲染历史概率折线图
         * @param {Array} records - 计算记录数组
         */
        renderHistoryChart: function (records) {
            const ctx = document.getElementById('historyLineChart').getContext('2d');
            // 显示时间+抽卡数
            const labels = records.map(r => `${r.date.split(' ')[1]}\n抽${r.draws}张`).reverse();
            const data = records.map(r => parseFloat(r.probability.replace('%', '')) || 0).reverse();

            // 计算动态y轴范围
            const minValue = Math.max(0, Math.min(...data) * 0.98); // 最小值留2%空间
            const maxValue = Math.min(100, Math.max(...data) * 1.02); // 最大值留2%空间

            if (window.historyChart) {
                window.historyChart.destroy();
            }

            window.historyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '概率(%)',
                        data: data,
                        tension: 0.1,
                        fill: true,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointHitRadius: 10
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            suggestedMin: minValue,
                            suggestedMax: maxValue
                        },
                        x: {
                            reverse: true, // x轴反向显示
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            enabled: true,
                            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg-alt').trim() || '#f3f5f7',
                            borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#94a3b8',
                            borderWidth: 1,
                            borderRadius: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--radius-md').trim().replace('px', '')) || 8,
                            titleColor: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#1e293b',
                            bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#1e293b',
                            padding: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--space-sm').trim().replace('rem', '')) * 16 || 12,
                            boxShadow: getComputedStyle(document.documentElement).getPropertyValue('--shadow-md').trim() || '0 4px 6px rgba(15, 23, 42, 0.1)',
                            callbacks: {
                                label: function (context) {
                                    const reversedIndex = records.length - 1 - context.dataIndex;
                                    const record = records[reversedIndex];
                                    const condition = record.condition || '';
                                    const conditionLines = wrapText(condition);
                                    const result = [`概率: ${record.probability}`];
                                    
                                    if (conditionLines.length === 1) {
                                        result.push(`条件: ${conditionLines[0]}`);
                                    } else {
                                        result.push('条件:');
                                        result.push(...conditionLines);
                                    }
                                    
                                    result.push(`计算方式: ${record.calculationMethod}`);
                                    return result;
                                }
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
        },

    };
};

// 条件构建器相关接口代理，便于外部调用
window.getConditionInputMode = function () {
    return window.ConditionBuilder.getConditionInputMode();
};
window.getBuilderConditionData = function () {
    return window.ConditionBuilder.getBuilderConditionData();
};
window.setBuilderConditionData = function (json) {
    window.ConditionBuilder.setBuilderConditionData(json);
};

