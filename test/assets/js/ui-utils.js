(function (global) {
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

    // 对外暴露的工具方法集合
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
