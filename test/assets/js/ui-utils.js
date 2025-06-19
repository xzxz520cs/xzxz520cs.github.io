(function(global) {
    // 工具函数：转义正则表达式中的特殊字符
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 工具函数：生成变量标识符（例如 a, b, …, aa, ab）
    function getVarName(index) {
        if (index < 26) return String.fromCharCode(97 + index);
        return 'a' + String.fromCharCode(97 + index - 26);
    }

    // 工具函数：生成卡牌标签（例如 A, B, …, AA, AB）
    function getCardLabel(index) {
        if (index < 26) return String.fromCharCode(65 + index);
        return `A${String.fromCharCode(65 + index - 26)}`;
    }

    // 根据给定的索引返回循环使用的颜色
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

    // 计算已用秒数
    function getElapsedSeconds(startTime) {
        return Math.floor((Date.now() - startTime) / 1000);
    }

    // 计算卡组内所有卡牌总数，更新显示
    function updateTotalDeck() {
        let total = 0;
        document.querySelectorAll('.card-count').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        document.getElementById('total').value = total;
        updatePieChart();
    }

    // 更新饼状图显示卡牌分布
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

    // 监听卡牌名称输入变化，并实时更新条件构建器下拉选项
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

    // 导出接口
    global.UIUtils = {
        escapeRegExp,
        getVarName,
        getCardLabel,
        getColor,
        getElapsedSeconds,
        updateTotalDeck,
        updatePieChart,
        setupCardNameInputListener
    };
})(window);
