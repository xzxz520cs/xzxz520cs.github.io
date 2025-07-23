/**
 * UI工具模块
 * 功能：提供变量名转换、颜色生成、饼图更新等辅助功能
 * 核心方法：getVarName(), getColor(), updatePieChart()
 * 被所有其他模块调用，是基础工具模块
 */
(function (global) {
    /**
     * 字符串换行工具函数(确保返回数组)
     */
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

    /**
     * 对字符串进行正则转义，防止特殊字符影响正则表达式
     */
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 根据索引获取变量名（如a, b, ..., aa, ab）
     */
    function getVarName(index) {
        if (index < 26) return String.fromCharCode(97 + index);
        return 'a' + String.fromCharCode(97 + index - 26);
    }

    /**
     * 根据索引获取卡牌标签（如A, B, ..., AA, AB）
     */
    function getCardLabel(index) {
        if (index < 26) return String.fromCharCode(65 + index);
        return `A${String.fromCharCode(65 + index - 26)}`;
    }

    /**
     * 根据索引循环获取预设颜色
     */
    function getColor(index) {
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FFCD56', '#C9CBCF', '#4D5360', '#D6A2E8',
            '#FF7F50', '#87CEEB', '#FFD700', '#7B68EE', '#FF69B4',
            '#00CED1', '#FF4500', '#8A2BE2', '#20B2AA', '#FF6347',
            '#7FFF00', '#DC143C', '#00BFFF', '#FF8C00', '#9932CC',
            '#FFA07A', '#00FA9A', '#8B008B', '#FF1493', '#1E90FF',
            '#B22222', '#228B22', '#FFB6C1', '#00FF7F', '#4682B4',
            '#FFDAB9', '#8FBC8F', '#483D8B', '#E9967A', '#00BFFF',
            '#A0522D', '#7CFC00', '#BA55D3', '#CD5C5C', '#40E0D0',
            '#F08080', '#6A5ACD', '#BDB76B', '#00FF00', '#8B4513',
            '#E6E6FA', '#A9A9A9'
        ];
        return colors[index % colors.length];
    }

    /**
     * 计算从startTime到现在经过的秒数
     */
    function getElapsedSeconds(startTime) {
        return Math.floor((Date.now() - startTime) / 1000);
    }

    /**
     * 统计所有卡牌数量并刷新总数显示，同时刷新饼图
     */
    function updateTotalDeck() {
        let total = 0;
        document.querySelectorAll('.card-count').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        document.getElementById('total').value = total;
        updatePieChart();
    }

    /**
     * 根据当前卡牌输入刷新饼图显示卡牌分布
     * 若所有卡牌数量为0，则显示默认占位
     */
    let chart = null;
    function updatePieChart() {
        const labels = [];
        const data = [];
        const backgroundColors = [];

        for (let i = 0; i < 52; i++) {
            const count = parseInt(document.getElementById(`card${i}`).value) || 0;
            const name = document.getElementById(`cardName${i}`).value.trim() || getCardLabel(i);
            if (count > 0) {
                labels.push(name);
                data.push(count);
                backgroundColors.push(getColor(i));
            }
        }

        // 如果所有卡牌数量均为 0，则显示默认的“？？？”，数量为1
        if (labels.length === 0) {
            labels.push("？？？");
            data.push(40);
            backgroundColors.push(getColor(0));
        }

        const ctx = document.getElementById('deckPieChart').getContext('2d');
        if (chart) chart.destroy();

        chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 8
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * 监听卡名输入变化，实时刷新饼图和条件构建器
     * 支持input和blur事件
     */
    function setupCardNameInputListener() {
        const cardInputs = document.getElementById('cardInputs');
        if (!cardInputs) return;
        cardInputs.addEventListener('input', function (e) {
            if (e.target && e.target.id && e.target.id.startsWith('cardName')) {
                if (document.querySelector('input[name="conditionInputMode"]:checked')?.value === 'builder') {
                    if (window.builderRender) window.builderRender();
                }
                updatePieChart();
            }
        });
        cardInputs.addEventListener('blur', function (e) {
            if (e.target && e.target.id && e.target.id.startsWith('cardName')) {
                if (document.querySelector('input[name="conditionInputMode"]:checked')?.value === 'builder') {
                    if (window.builderRender) window.builderRender();
                }
                updatePieChart();
            }
        }, true);
    }

    /**
     * 显示一个隐藏的卡牌
     * @returns {boolean} 是否还有更多卡牌可显示
     */
    function showOneCard() {
        const hiddenCards = document.querySelectorAll('#cardInputs .form-group.hidden');
        if (hiddenCards.length === 0) return false;
        
        hiddenCards[0].classList.remove('hidden');
        return hiddenCards.length > 1;
    }

    /**
     * 隐藏一个AA-AZ卡牌
     * @returns {boolean} 是否还有更多卡牌可隐藏
     */
    function hideOneCard() {
        const allVisibleCards = Array.from(document.querySelectorAll('#cardInputs .form-group:not(.hidden)'));
        const aaAzCards = allVisibleCards.filter(el => {
            const input = el.querySelector('input[type="number"]');
            if (!input || !input.id) return false;
            const num = parseInt(input.id.replace('card',''));
            return num >= 26 && num <= 51;
        });

        if (aaAzCards.length === 0) return false;
        
        aaAzCards[aaAzCards.length - 1].classList.add('hidden');
        return aaAzCards.length > 1;
    }

    /**
     * 初始化卡片显示控制功能（显示更多/显示更少按钮）
     */
    function initCardVisibilityControls() {
        const showMoreBtn = document.getElementById('showMoreCardsBtn');
        const showLessBtn = document.getElementById('showLessCardsBtn');
        showLessBtn.disabled = true;

        // 显示更多按钮点击事件 - 执行6次"显示一个"
        showMoreBtn.addEventListener('click', function() {
            let hasMore = true;
            for (let i = 0; i < 6 && hasMore; i++) {
                hasMore = showOneCard();
            }
            showLessBtn.disabled = false;
            showMoreBtn.disabled = !hasMore;
        });

        // 显示更少按钮点击事件 - 执行6次"隐藏一个"
        showLessBtn.addEventListener('click', function() {
            let hasMore = true;
            for (let i = 0; i < 6 && hasMore; i++) {
                hasMore = hideOneCard();
            }
            showMoreBtn.disabled = false;
            showLessBtn.disabled = !hasMore;
        });
    }

    /**
     * 根据当前显示的卡类更新按钮状态
     */
    function updateCardVisibilityButtons() {
        const showMoreBtn = document.getElementById('showMoreCardsBtn');
        const showLessBtn = document.getElementById('showLessCardsBtn');
        
        // 检查是否还有隐藏的卡类
        const hasHiddenCards = document.querySelectorAll('#cardInputs .form-group.hidden').length > 0;
        showMoreBtn.disabled = !hasHiddenCards;

        // 检查AA-AZ卡类中是否有显示的
        const allVisibleCards = Array.from(document.querySelectorAll('#cardInputs .form-group:not(.hidden)'));
        const hasVisibleAaAzCards = allVisibleCards.some(el => {
            const input = el.querySelector('input[type="number"]');
            if (!input || !input.id) return false;
            const num = parseInt(input.id.replace('card',''));
            return num >= 26 && num <= 51;
        });
        showLessBtn.disabled = !hasVisibleAaAzCards;
    }

    // 对外暴露的工具方法集合
    /**
     * 从localStorage加载最近25条计算记录并渲染图表
     */
    function loadHistoryRecords() {
        const records = JSON.parse(localStorage.getItem('calculationRecords') || '[]');
        const recentRecords = records.slice(-25); // 获取最近25条
        renderHistoryChart(recentRecords);
    }

    /**
     * 渲染历史概率折线图
     * @param {Array} records - 计算记录数组
     */
    function renderHistoryChart(records) {
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
    }

    global.UIUtils = {
        escapeRegExp,
        getVarName,
        getCardLabel,
        getColor,
        getElapsedSeconds,
        updateTotalDeck,
        updatePieChart,
        setupCardNameInputListener,
        initCardVisibilityControls,
        showOneCard,
        hideOneCard,
        updateCardVisibilityButtons,
        wrapText,
        loadHistoryRecords,
        renderHistoryChart
    };
})(window);
