(function(global) {
    // 工具常量：localStorage存储上限设置为5MB
    const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB

    function saveDeck() {
        const deckName = document.getElementById('deckName').value.trim();
        if (!deckName) {
            alert("请输入卡组名称");
            return;
        }
        let cardNames = [];
        let duplicateNames = new Set();
        for (let i = 0; i < 30; i++) {
            const name = document.getElementById(`cardName${i}`).value.trim();
            if (name) {
                if (cardNames.includes(name)) { duplicateNames.add(name); }
                cardNames.push(name);
            }
        }
        if (duplicateNames.size > 0) {
            alert(`保存失败: 卡名重复：${Array.from(duplicateNames).join(', ')}`);
            return;
        }
        let conditionInputMode = window.getConditionInputMode ? window.getConditionInputMode() : 'manual';
        let builderConditionData = '';
        if (conditionInputMode === 'builder' && window.getBuilderConditionData) {
            builderConditionData = window.getBuilderConditionData();
        }
        const deck = {
            id: Date.now(),
            name: deckName,
            cards: [],
            condition: document.getElementById('condition').value,
            conditionInputMode,
            builderConditionData
        };
        for (let i = 0; i < 30; i++) {
            deck.cards.push({
                count: document.getElementById(`card${i}`).value,
                name: document.getElementById(`cardName${i}`).value
            });
        }
        const decks = JSON.parse(localStorage.getItem('decks') || '[]');
        const existingIndex = decks.findIndex(d => d.name === deckName);
        if (existingIndex !== -1) {
            if (!confirm(`已存在同名卡组，确认覆盖 "${deckName}" 吗？`)) return;
            decks[existingIndex] = deck;
        } else {
            decks.push(deck);
        }
        localStorage.setItem('decks', JSON.stringify(decks));
        updateDeckList();
        document.getElementById('deckName').value = '';
        alert("卡组保存成功！");
    }

    function loadDeck() {
        const deckId = parseInt(document.getElementById('deckList').value);
        if (!deckId) return;

        const decks = JSON.parse(localStorage.getItem('decks') || '[]');
        const deck = decks.find(d => d.id === deckId);
        if (!deck) return;

        deck.cards.forEach((card, i) => {
            document.getElementById(`card${i}`).value = card.count;
            document.getElementById(`cardName${i}`).value = card.name;
        });
        document.getElementById('condition').value = deck.condition || '';

        if (deck.conditionInputMode === 'builder') {
            document.querySelector('input[name="conditionInputMode"][value="builder"]').checked = true;
            if (window.setBuilderConditionData && deck.builderConditionData) {
                window.setBuilderConditionData(deck.builderConditionData);
            }
            const manualDiv = document.getElementById('manualConditionInput');
            const builderDiv = document.getElementById('builderConditionInput');
            manualDiv.classList.add('hidden');
            builderDiv.classList.remove('hidden');
            window.currentConditionInputMode = 'builder';
        } else {
            document.querySelector('input[name="conditionInputMode"][value="manual"]').checked = true;
            const manualDiv = document.getElementById('manualConditionInput');
            const builderDiv = document.getElementById('builderConditionInput');
            manualDiv.classList.remove('hidden');
            builderDiv.classList.add('hidden');
            window.currentConditionInputMode = 'manual';
        }

        if (window.UIUtils && window.UIUtils.updateTotalDeck) window.UIUtils.updateTotalDeck();
        alert("卡组加载成功！");
    }

    function deleteDeck() {
        const deckId = parseInt(document.getElementById('deckList').value);
        if (!deckId) return;

        if (!confirm("确认删除选中的卡组吗？")) return;

        const decks = JSON.parse(localStorage.getItem('decks') || '[]');
        const newDecks = decks.filter(d => d.id !== deckId);
        localStorage.setItem('decks', JSON.stringify(newDecks));
        updateDeckList();
        alert("卡组删除成功！");
    }

    function updateDeckList() {
        const select = document.getElementById('deckList');
        if (!select) return;
        select.innerHTML = '<option value="">-- 选择卡组 --</option>';
        const decks = JSON.parse(localStorage.getItem('decks') || '[]');
        decks.forEach(deck => {
            const option = document.createElement('option');
            option.value = deck.id;
            option.textContent = deck.name;
            select.appendChild(option);
        });
    }

    function saveCalculationRecord(result, condition, errorMessage = null) {
        const records = JSON.parse(localStorage.getItem('calculationRecords') || '[]');
        const record = {
            date: new Date().toLocaleString(),
            probability: errorMessage ? '计算错误' : `${((Number(result.valid) / Number(result.total)) * 100).toFixed(20)}%`,
            total: document.getElementById('total').value,
            draws: document.getElementById('draws').value,
            validCombinations: errorMessage ? '计算错误' : (result.valid !== undefined ? result.valid.toString() : '0'),
            totalCombinations: errorMessage ? '计算错误' : (result.total !== undefined ? result.total.toString() : '0'),
            condition,
            calculationMethod: result.calculationMethod || "精确计算",
            cards: Array.from({ length: 30 }).map((_, i) => {
                const inputName = document.getElementById(`cardName${i}`).value.trim();
                return {
                    name: inputName || (window.UIUtils.getCardLabel(i) + '类卡'),
                    count: document.getElementById(`card${i}`).value
                };
            })
        };
        const newSize = JSON.stringify([...records, record]).length * 2;
        if (newSize > MAX_STORAGE_SIZE) {
            alert('存储空间不足，无法保存计算记录。请考虑导出并删除部分记录后重试。');
            return;
        }
        records.push(record);
        localStorage.setItem('calculationRecords', JSON.stringify(records));
    }

    function exportCalculationRecords() {
        const records = JSON.parse(localStorage.getItem('calculationRecords') || '[]');
        if (records.length === 0) {
            alert('没有可导出的计算记录。');
            return;
        }
        function getExportCardLabel(index) {
            if (index < 26) return String.fromCharCode(65 + index);
            return 'A' + String.fromCharCode(65 + index - 26);
        }
        const headers = [
            '日期', '概率', '卡组总数', '抽卡数', '满足条件的组合数', '总组合数', '逻辑判断条件', '计算方式',
            ...Array.from({ length: 30 }).flatMap((_, i) => [
                `${getExportCardLabel(i)}卡名`,
                `${getExportCardLabel(i)}数量`
            ])
        ];
        function csvEscape(str) {
            if (str == null) return '';
            str = String(str);
            str = str.replace(/"/g, '""');
            if (/[",\r\n]/.test(str)) {
                str = `"${str}"`;
            }
            return str;
        }
        const rows = records.map(record => [
            csvEscape(record.date),
            csvEscape(record.probability),
            csvEscape(record.total),
            csvEscape(record.draws),
            csvEscape(record.validCombinations),
            csvEscape(record.totalCombinations),
            csvEscape(record.condition),
            csvEscape(record.calculationMethod),
            ...Array.from({ length: 30 }).flatMap((_, i) => {
                const card = record.cards && record.cards[i] ? record.cards[i] : { name: '', count: '' };
                return [csvEscape(card.name), csvEscape(card.count)];
            })
        ]);
        const BOM = '\uFEFF';
        const csvContent = BOM + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', '计算记录.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function clearCalculationRecords() {
        if (confirm('确定删除所有计算记录吗？')) {
            localStorage.removeItem('calculationRecords');
            alert('计算记录已删除。');
        }
    }

    global.DataManager = {
        saveDeck,
        loadDeck,
        deleteDeck,
        updateDeckList,
        saveCalculationRecord,
        exportCalculationRecords,
        clearCalculationRecords
    };
})(window);
