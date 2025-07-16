// 条件构建器模块
(function (global) {
    // ====== 数据结构与工具 ======
    // 构建器的根条件对象
    let builderRootCondition = null;
    // 构建器生成的条件表达式文本
    let builderConditionText = '';
    // 当前输入模式（manual/builder）
    let currentConditionInputMode = 'manual';

    // 运算符映射表
    const builderOperators = {
        gt: '>',
        eq: '==',
        lt: '<',
        neq: '!=',
        gte: '>=',
        lte: '<='
    };

    // 获取所有卡名（变量名和自定义名）
    function getAllCardNames() {
        const varNames = [];
        for (let i = 0; i < 52; i++) {
            const count = document.getElementById(`card${i}`)?.value;
            const name = document.getElementById(`cardName${i}`)?.value.trim();
            if ((count && parseInt(count) > 0) || (name && name !== '')) {
                if (i < 26) {
                    varNames.push(String.fromCharCode(97 + i));
                } else {
                    varNames.push('a' + String.fromCharCode(97 + i - 26));
                }
            }
        }
        const customNames = [];
        for (let i = 0; i < 52; i++) {
            const name = document.getElementById(`cardName${i}`)?.value.trim();
            if (name && !varNames.includes(name) && !customNames.includes(name)) customNames.push(name);
        }
        const allNames = [...varNames, ...customNames];
        return allNames.length > 0 ? allNames : ['请先输入数量或卡名'];
    }

    // 创建条件节点对象（单条件或条件组）
    function builderCreateCondition(type, children) {
        return type === 'single' ? {
            type: 'single',
            cards: [{ name: getAllCardNames()[0] }],
            symbol: 'gt',
            num: '0'
        } : { type, children: children || [] };
    }

    // 创建概率函数节点
    function builderCreateProbCondition(value = 50) {
        // 支持小数后两位精度，四舍五入
        const roundedValue = Math.round(parseFloat(value) * 100) / 100;
        return {
            type: 'prob',
            value: roundedValue
        };
    }

    // ====== 渲染逻辑 ======
    // 渲染整个条件构建器界面
    function builderRender() {
        const builder = document.getElementById('conditionBuilder');
        if (!builder) return;
        builder.innerHTML = '';
        builderRootCondition && builder.appendChild(builderRenderCondition(builderRootCondition, true));
        builderUpdateOutput();
    }
    // 渲染单个条件节点（递归）
    function builderRenderCondition(condition, isRoot = false) {
        const container = document.createElement('div');
        // 概率函数也统一用condition-single样式
        if (condition.type === 'prob') {
            container.className = 'condition-builder condition-single';
            builderRenderProbCondition(condition, container, isRoot);
        } else {
            container.className = `condition-builder condition-${condition.type}`;
            if (condition.type === 'single') {
                builderRenderSingleCondition(condition, container, isRoot);
            } else {
                builderRenderGroupCondition(condition, container, isRoot);
            }
        }
        return container;
    }
    // 渲染单条件节点（如“抽到X的数量 > N”）
    function builderRenderSingleCondition(condition, container, isRoot) {
        container.appendChild(document.createTextNode('抽到'));
        const cardsWrapper = document.createElement('div');
        cardsWrapper.className = 'builder-cards-wrapper';
        condition.cards.forEach((card, index) => {
            const cardRow = document.createElement('div');
            cardRow.className = 'builder-card-row';
            if (index > 0) {
                const opSelect = builderCreateSelect(['+', '-', '*', '/'], card.operator || '+',
                    e => { card.operator = e.target.value; builderUpdateOutput(); });
                cardRow.appendChild(opSelect);
            }
            const cardNameContainer = document.createElement('span');
            let cardNameControl = builderCreateSelect(
                getAllCardNames().map(name => ({ display: name, value: name })),
                card.name,
                e => { card.name = e.target.value; builderUpdateOutput(); }
            );
            cardNameContainer.appendChild(cardNameControl);
            const toggleButton = builderCreateButton('✏️', () => {
                if (cardNameControl.tagName.toLowerCase() === 'select') {
                    const customInput = builderCreateInput(card.name, e => { card.name = e.target.value; builderUpdateOutput(); });
                    customInput.classList.add('builder-card-input');
                    cardNameContainer.replaceChild(customInput, cardNameControl);
                    cardNameControl = customInput;
                    toggleButton.textContent = '📑';
                } else {
                    const newSelect = builderCreateSelect(
                        getAllCardNames().map(name => ({ display: name, value: name })),
                        card.name,
                        e => { card.name = e.target.value; builderUpdateOutput(); }
                    );
                    cardNameContainer.replaceChild(newSelect, cardNameControl);
                    cardNameControl = newSelect;
                    toggleButton.textContent = '✏️';
                }
            });
            cardRow.appendChild(cardNameContainer);
            cardRow.appendChild(toggleButton);
            if (condition.cards.length > 1) {
                cardRow.appendChild(builderCreateButton('×', () => {
                    condition.cards.splice(index, 1);
                    builderRender();
                }));
            }
            cardsWrapper.appendChild(cardRow);
        });
        container.appendChild(cardsWrapper);
        container.appendChild(builderCreateButton('+', () => {
            condition.cards.push({ name: getAllCardNames()[0], operator: '+' });
            builderRender();
        }));
        container.appendChild(document.createTextNode('的数量'));
        const symbolSelect = builderCreateSelect(
            Object.entries(builderOperators).map(([value, display]) => ({ display, value })),
            condition.symbol,
            e => { condition.symbol = e.target.value; builderUpdateOutput(); }
        );
        container.appendChild(symbolSelect);
        container.appendChild(builderCreateInput(condition.num, e => { condition.num = e.target.value; builderUpdateOutput(); }, '40px'));
        !isRoot && container.appendChild(builderCreateButton('删除', () => {
            container.dispatchEvent(new CustomEvent('delete', { bubbles: true }));
        }));
    }
    // 渲染概率函数节点
    function builderRenderProbCondition(condition, container, isRoot) {
        container.appendChild(document.createTextNode('有 '));
        const valueInput = document.createElement('input');
        valueInput.type = 'number';
        valueInput.value = condition.value;
        valueInput.min = 0.01;
        valueInput.max = 100;
        valueInput.step = 0.01;
        
        // 只在失去焦点时进行完整验证
        valueInput.addEventListener('blur', e => {
            let value = parseFloat(e.target.value);
            if (isNaN(value)) value = 0.01;
            if (value < 0.01) value = 0.01;
            if (value > 100) value = 100;
            // 四舍五入到小数点后两位
            value = Math.round(value * 100) / 100;
            condition.value = value;
            e.target.value = value;
            builderUpdateOutput();
        });

        // 输入时只做基本验证，不更新condition值
        valueInput.addEventListener('input', e => {
            if (e.target.value === '' || e.target.value === '.') return;
            let value = parseFloat(e.target.value);
            if (isNaN(value)) {
                e.target.value = condition.value;
            }
        });
        container.appendChild(valueInput);
        container.appendChild(document.createTextNode('% 的概率满足此条件'));
        if (!isRoot) {
            container.appendChild(builderCreateButton('删除', () => {
                container.dispatchEvent(new CustomEvent('delete', { bubbles: true }));
            }));
        }
    }
    // 渲染条件组节点（如“全部满足/任一满足”）
    function builderRenderGroupCondition(condition, container, isRoot) {
        const header = document.createElement('div');
        header.className = 'builder-group-header';
        header.appendChild(document.createTextNode('满足以下'));
        header.appendChild(builderCreateSelect(
            ['全部', '任一'].map((text, i) => ({ display: text, value: i === 0 ? 'and' : 'or' })),
            condition.type,
            e => { condition.type = e.target.value; builderUpdateOutput(); }
        ));
        header.appendChild(document.createTextNode('条件'));
        if (!isRoot) header.appendChild(builderCreateButton('删除', () => {
            container.dispatchEvent(new CustomEvent('delete', { bubbles: true }));
        }));
        container.appendChild(header);
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'builder-group-children';
        condition.children.forEach(child => {
            const childElement = builderRenderCondition(child);
            childElement.addEventListener('delete', e => {
                e.stopPropagation();
                const index = condition.children.indexOf(child);
                index !== -1 && condition.children.splice(index, 1) && builderRender();
            });
            childrenContainer.appendChild(childElement);
        });
        const buttons = document.createElement('div');
        buttons.className = 'builder-buttons';
        buttons.appendChild(builderCreateButton('添加条件组', () => {
            condition.children.push(builderCreateCondition('and', []));
            builderRender();
        }));
        buttons.appendChild(builderCreateButton('添加条件', () => {
            condition.children.push(builderCreateCondition('single'));
            builderRender();
        }));
        const probBtn = builderCreateButton('添加概率函数', () => {
            condition.children.push(builderCreateProbCondition());
            builderRender();
        });
        probBtn.className += ' btn--auto-width';
        buttons.appendChild(probBtn);
        childrenContainer.appendChild(buttons);
        container.appendChild(childrenContainer);
    }
    // 更新条件表达式文本框和预览
    function builderUpdateOutput() {
        builderConditionText = builderRootCondition ? builderGenerateConditionText(builderRootCondition) : '';
        if (document.querySelector('input[name="conditionInputMode"]:checked')?.value === 'builder') {
            document.getElementById('condition').value = builderConditionText;
            const preview = document.getElementById('builderConditionPreview');
            if (preview) preview.value = builderConditionText;
        }
    }
    // 生成条件表达式字符串，支持prob类型
    function builderGenerateConditionText(condition) {
        if (condition.type === 'single') {
            const cardsText = condition.cards.map((c, i) =>
                i === 0 ? c.name : `${c.operator || '+'} ${c.name}`).join(' ');
            const operator = builderOperators[condition.symbol] || condition.symbol || '';
            return `(${cardsText}) ${operator} ${condition.num}`;
        } else if (condition.type === 'prob') {
            return `PROB(${condition.value})`;
        }
        const childrenText = condition.children.map(builderGenerateConditionText).filter(Boolean);
        return childrenText.length > 1
            ? `(${childrenText.join(condition.type === 'and' ? ' && ' : ' || ')})`
            : childrenText[0] || '';
    }
    // 创建下拉框控件
    function builderCreateSelect(options, value, onChange) {
        const select = document.createElement('select');
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value || opt;
            option.textContent = opt.display || opt;
            select.appendChild(option);
        });
        select.value = value;
        select.addEventListener('change', onChange);
        return select;
    }
    // 创建输入框控件
    function builderCreateInput(value, onChange, width) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.setAttribute('list', 'cardNamesDatalist');
        if (width) input.style.width = width;
        input.addEventListener('input', onChange);
        return input;
    }
    // 创建按钮控件
    function builderCreateButton(text, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        let variant = 'btn--outline';
        if (text.trim() === '×' || text.trim() === '删除') {
            variant = 'btn--danger';
        }
        button.className = `btn ${variant}`;
        if (text.trim() === '添加条件组' || text.trim() === '添加条件') {
            button.className += ' btn--auto-width';
        }
        button.addEventListener('click', onClick);
        return button;
    }

    // ====== 手动条件解析器 ======
    // 将表达式字符串分割为词法单元
    function tokenize(expr) {
        const regex = /\s*([A-Za-z0-9\u4e00-\u9fa5]+|>=|<=|==|!=|&&|\|\||[-+*/()<>])\s*/g;
        let tokens = [];
        let m;
        while ((m = regex.exec(expr)) !== null) {
            tokens.push(m[1]);
        }
        return tokens;
    }
    // 简单表达式解析器构造函数
    function Parser(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }
    // 查看下一个token
    Parser.prototype.peek = function () { return this.tokens[this.pos]; };
    // 消耗一个token
    Parser.prototype.consume = function (token) {
        if (token && this.tokens[this.pos] !== token) {
            throw new Error("预期 " + token + "，但得到 " + this.tokens[this.pos]);
        }
        return this.tokens[this.pos++];
    };
    // 判断是否到达末尾
    Parser.prototype.eof = function () { return this.pos >= this.tokens.length; };
    // 解析表达式入口
    function parseExpression(parser) {
        return parseLogicalOr(parser);
    }
    // 解析或表达式
    function parseLogicalOr(parser) {
        let node = parseLogicalAnd(parser);
        while (!parser.eof() && parser.peek() === '||') {
            parser.consume('||');
            const right = parseLogicalAnd(parser);
            node = { type: "or", children: [node, right] };
        }
        return node;
    }
    // 解析与表达式
    function parseLogicalAnd(parser) {
        let node = parseRelational(parser);
        while (!parser.eof() && parser.peek() === '&&') {
            parser.consume('&&');
            const right = parseRelational(parser);
            node = { type: "and", children: [node, right] };
        }
        return node;
    }
    // 解析关系表达式
    function parseRelational(parser) {
        let left = parseSum(parser);
        if (!parser.eof() && /^(>=|<=|==|!=|>|<)$/.test(parser.peek())) {
            const op = parser.consume();
            const num = parser.consume();
            if (!/^\d+$/.test(num)) {
                throw new Error("预期数字，但得到 " + num);
            }
            let cards = [];
            if (Array.isArray(left)) {
                cards.push({ name: left[0] });
                for (let i = 1; i < left.length; i += 2) {
                    let operator = left[i];
                    let operand = left[i + 1];
                    cards.push({ operator, name: operand });
                }
            } else {
                cards.push({ name: left });
            }
            return { type: "single", cards: cards, symbol: mapOperator(op), num: num };
        }
        return left;
    }
    // 解析加减表达式
    function parseSum(parser) {
        if (parser.peek() === '(') {
            parser.consume('(');
            const node = parseExpression(parser);
            parser.consume(')');
            return node;
        }
        // 支持PROB函数型表达式递归解析
        if (parser.peek() === 'PROB') {
            parser.consume('PROB');
            parser.consume('(');
            const value = parser.consume();
            if (!/^\d+$/.test(value) || parseInt(value) < 1 || parseInt(value) > 99) {
                throw new Error("PROB函数参数必须是1-99的整数");
            }
            parser.consume(')');
            return { type: "prob", value: parseInt(value) };
        }
        let items = [];
        items.push(parser.consume());
        while (!parser.eof() && (parser.peek() === '+' || parser.peek() === '-')) {
            let operator = parser.consume();
            items.push(operator);
            items.push(parser.consume());
        }
        return items.length === 1 ? items[0] : items;
    }
    // 运算符映射（字符串转内部标识）
    function mapOperator(op) {
        const opMap = {
            ">": "gt",
            "<": "lt",
            "==": "eq",
            "!=": "neq",
            ">=": "gte",
            "<=": "lte",
            "大于等于": "gte",
            "小于等于": "lte",
            "大于": "gt",
            "小于": "lt"
        };
        if (!opMap[op]) throw new Error("不支持的运算符：" + op);
        return opMap[op];
    }
    // 解析手动输入条件为构建器结构
    function parseManualCondition(manualStr) {
        manualStr = manualStr.trim();
        if (!manualStr) throw new Error("空的条件");
        const tokens = tokenize(manualStr);
        const parser = new Parser(tokens);
        const tree = parseExpression(parser);
        if (!parser.eof()) {
            throw new Error("无法解析条件：" + manualStr);
        }
        // 修改：无论何种类型都包裹在and条件组下，保证有母节点
        if (tree && tree.type === 'and') {
            return tree;
        } else {
            return { type: 'and', children: [tree] };
        }
    }

    // ====== 输入模式切换 ======
    // 切换条件输入模式（手动/构建器）
    function switchConditionInputMode(mode, skipConfirm = false) {
        const currentCondition = document.getElementById('condition').value.trim();
        if (!currentCondition) { skipConfirm = true; }
        if (!skipConfirm) {
            let msg = "";
            if (mode === 'builder') {
                msg = "将当前逻辑判断条件转化至条件构建器时优先级嵌套可能会混乱，不支持转化字符 */%，是否继续切换到条件构建器输入？";
            } else if (mode === 'manual') {
                msg = "是否转化至手动输入？";
            }
            if (!confirm(msg)) return false;
        }
        const manualDiv = document.getElementById('manualConditionInput');
        const builderDiv = document.getElementById('builderConditionInput');
        if (mode === 'manual') {
            if (builderRootCondition) {
                const raw = builderGenerateConditionText(builderRootCondition);
                document.getElementById('condition').value = raw;
            }
            builderDiv.classList.add('hidden');
            manualDiv.classList.remove('hidden');
        } else {
            let manualStr = document.getElementById('condition').value.trim();
            if (manualStr) {
                try {
                    builderRootCondition = parseManualCondition(manualStr);
                    builderRender();
                } catch (err) {
                    alert("手动条件转换失败：" + err.message);
                    document.querySelector('input[name="conditionInputMode"][value="manual"]').checked = true;
                    return false;
                }
            } else {
                builderRootCondition = builderCreateCondition('and', []);
                builderRender();
            }
            manualDiv.classList.add('hidden');
            builderDiv.classList.remove('hidden');
        }
        currentConditionInputMode = mode;
        return true;
    }

    // ====== 事件绑定与初始化 ======
    // 绑定输入模式切换事件
    function bindModeSwitch() {
        document.querySelectorAll('input[name="conditionInputMode"]').forEach(radio => {
            radio.addEventListener('change', function (e) {
                const newMode = e.target.value;
                if (!switchConditionInputMode(newMode)) {
                    document.querySelector(`input[name="conditionInputMode"][value="${currentConditionInputMode}"]`).checked = true;
                }
            });
        });
    }
    // 绑定卡名输入监听，卡名变化时刷新下拉
    function bindCardNameListener() {
        if (window.UIUtils && window.UIUtils.setupCardNameInputListener) {
            window.UIUtils.setupCardNameInputListener();
        }
        // 监听卡名和数量输入变化，实时刷新条件构建器下拉
        const cardInputs = document.getElementById('cardInputs');
        if (cardInputs) {
            cardInputs.addEventListener('input', function (e) {
                if (e.target && e.target.id &&
                    (e.target.id.startsWith('cardName') || e.target.id.startsWith('card'))) {
                    if (document.querySelector('input[name="conditionInputMode"]:checked')?.value === 'builder') {
                        builderRender();
                    }
                }
            });
        }
    }
    // 初始化条件构建器
    function init() {
        builderRootCondition = builderCreateCondition('and', []);
        builderRender();
        switchConditionInputMode('manual', true);
        bindModeSwitch();
        bindCardNameListener();
    }

    // ====== 对外接口 ======
    // 提供初始化、获取/设置条件等接口
    global.ConditionBuilder = {
        init,
        getConditionInputMode: function () {
            return document.querySelector('input[name="conditionInputMode"]:checked')?.value || 'manual';
        },
        getBuilderConditionData: function () {
            return builderRootCondition ? JSON.stringify(builderRootCondition) : '';
        },
        setBuilderConditionData: function (json) {
            try {
                builderRootCondition = JSON.parse(json);
                builderRender();
            } catch (e) {
                builderRootCondition = builderCreateCondition('and', []);
                builderRender();
            }
        }
    };
})(window);
