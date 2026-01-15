/**
 * 概率对抗计算器模块
 * 功能：计算正方和反方成功率组合后的四种结果概率
 */

function calculateProbability() {
    const positive = parseFloat(document.getElementById('positiveProb').value) || 0;
    const negative = parseFloat(document.getElementById('negativeProb').value) || 0;
    
    const bothSuccess = (positive * negative / 100).toFixed(2);
    const positiveSuccess = (positive * (100 - negative) / 100).toFixed(2);
    const negativeSuccess = ((100 - positive) * negative / 100).toFixed(2);
    const bothFail = ((100 - positive) * (100 - negative) / 100).toFixed(2);
    
    document.getElementById('bothSuccess').textContent = bothSuccess + '%';
    document.getElementById('positiveSuccess').textContent = positiveSuccess + '%';
    document.getElementById('negativeSuccess').textContent = negativeSuccess + '%';
    document.getElementById('bothFail').textContent = bothFail + '%';
}

// 绑定事件监听器
document.addEventListener('DOMContentLoaded', function() {
    const positiveInput = document.getElementById('positiveProb');
    const negativeInput = document.getElementById('negativeProb');
    
    if (positiveInput && negativeInput) {
        positiveInput.addEventListener('input', calculateProbability);
        negativeInput.addEventListener('input', calculateProbability);
    }
});