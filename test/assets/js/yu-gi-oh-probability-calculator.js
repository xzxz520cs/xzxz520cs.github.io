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
    document.getElementById('showHistoryBtn').addEventListener('click', function() {
        document.getElementById('historyTable').classList.remove('hidden');
        document.getElementById('showHistoryBtn').classList.add('hidden');
        document.getElementById('hideHistoryBtn').classList.remove('hidden');
        window.HistoryManager.loadHistoryRecords();
    });

    document.getElementById('hideHistoryBtn').addEventListener('click', function() {
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
        loadHistoryRecords: function() {
            const records = JSON.parse(localStorage.getItem('calculationRecords') || '[]');
            const recentRecords = records.slice(-25); // 获取最近25条
            
            this.renderHistoryChart(recentRecords);
        },

        /**
         * 渲染历史概率折线图
         * @param {Array} records - 计算记录数组
         */
        renderHistoryChart: function(records) {
            const ctx = document.getElementById('historyLineChart').getContext('2d');
            // 显示时间+抽卡数
            const labels = records.map(r => `${r.date.split(' ')[1]}\n抽${r.draws}张`).reverse();
            const data = records.map(r => parseFloat(r.probability.replace('%','')) || 0).reverse();
            
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
                            enabled: false,
                            external: function(context) {
                                // Tooltip元素
                                const {chart, tooltip} = context;
                                let tooltipEl = chart.canvas.parentNode.querySelector('.chart-tooltip');
                                
                                if (!tooltipEl) {
                                    tooltipEl = document.createElement('div');
                                    tooltipEl.className = 'chart-tooltip';
                                    tooltipEl.style.background = 'var(--color-bg-alt)';
                                    tooltipEl.style.border = '1px solid var(--color-border)';
                                    tooltipEl.style.borderRadius = 'var(--radius-md)';
                                    tooltipEl.style.color = 'var(--color-text)';
                                    tooltipEl.style.padding = 'var(--space-sm)';
                                    tooltipEl.style.pointerEvents = 'none';
                                    tooltipEl.style.position = 'absolute';
                                    tooltipEl.style.maxWidth = '400px';
                                    tooltipEl.style.fontSize = '0.8rem';
                                    tooltipEl.style.lineHeight = '1.5';
                                    tooltipEl.style.boxShadow = 'var(--shadow-md)';
                                    tooltipEl.style.opacity = '0.9';
                                    tooltipEl.style.zIndex = '1000';
                                    chart.canvas.parentNode.appendChild(tooltipEl);
                                }
                                
                                // 隐藏工具提示
                                if (tooltip.opacity === 0) {
                                    tooltipEl.style.opacity = 0;
                                    return;
                                }
                                
                                // 设置内容
                                if (tooltip.dataPoints) {
                                    const reversedIndex = records.length - 1 - tooltip.dataPoints[0].dataIndex;
                                    const record = records[reversedIndex];
                                    tooltipEl.innerHTML = `
                                        <div><strong>时间:</strong> ${record.date.split(' ')[1]}</div>
                                        <div><strong>抽卡数:</strong> ${record.draws}张</div>
                                        <div><strong>计算方式:</strong> ${record.calculationMethod}</div>
                                        <div><strong>概率:</strong> ${record.probability}</div>
                                        <div><strong>条件:</strong>\n${record.condition}</div>
                                    `;
                                }
                                
                                // 定位工具提示
                                const {offsetLeft: positionX, offsetTop: positionY} = chart.canvas;
                                tooltipEl.style.left = positionX + tooltip.caretX + 'px';
                                tooltipEl.style.top = positionY + tooltip.caretY + 'px';
                                tooltipEl.style.opacity = 1;
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

