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
        window.UIUtils.loadHistoryRecords();
    });

    document.getElementById('hideHistoryBtn').addEventListener('click', function () {
        document.getElementById('historyTable').classList.add('hidden');
        document.getElementById('showHistoryBtn').classList.remove('hidden');
        document.getElementById('hideHistoryBtn').classList.add('hidden');
    });
};

// 组合生成代理函数
function generateCombinations() {
    if (window.CombinationGenerator && window.CombinationGenerator.generateCombinations) {
        window.CombinationGenerator.generateCombinations();
    } else {
        alert("组合生成功能未加载");
    }
}

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

