// 全局变量初始化

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
    // 由 CalculationEngine 维护
    return window.CalculationEngine.getElapsedSeconds();
}

// 精确计算入口（调用核心计算模块）
function calculate() {
    window.CalculationEngine.calculate();
}

// 蒙特卡洛模拟入口（调用核心计算模块）
function monteCarloCalculate() {
    window.CalculationEngine.monteCarloCalculate();
}

// 取消计算
function cancelCalculation() {
    window.CalculationEngine.cancelCalculation();
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
