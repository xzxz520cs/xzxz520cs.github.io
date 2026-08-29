// ==UserScript==
// @name         游戏王卡组导出YDK
// @namespace    https://github.com/xzxz520cs
// @version      1.0.0
// @description  在游戏王官方数据库(www.db.yugioh-card.com)卡组页面添加导出YDK按钮，自动将官方CID转换为非官方密码(passcode)
// @author       xzxz520cs
// @match        https://www.db.yugioh-card.com/yugiohdb/member_deck.action*
// @icon         https://www.db.yugioh-card.com/external/image/yugioh.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      db.ygoprodeck.com
// ==/UserScript==

(function () {
    'use strict';

    const CACHE_PREFIX = 'ygodeck_cid_';
    const API_BASE = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
    const BATCH_SIZE = 50;

    // --- DOM Helpers ---

    function extractCid(row) {
        const cidInput = row.querySelector('input.cid');
        if (cidInput && cidInput.value) return cidInput.value.trim();

        const linkInput = row.querySelector('input.link_value');
        if (linkInput && linkInput.value) {
            const m = linkInput.value.match(/cid=(\d+)/);
            if (m) return m[1];
        }
        return null;
    }

    function getCardName(row) {
        const el = row.querySelector('.card_name span, .box_card_name .card_name');
        return el ? el.textContent.trim() : null;
    }

    function getQuantity(row) {
        const el = row.querySelector('.cards_num_set span, .num span');
        if (el) {
            const n = parseInt(el.textContent.trim());
            return isNaN(n) ? 0 : n;
        }
        return 0;
    }

    function parseSection(container) {
        const result = [];
        if (!container) return result;
        const rows = container.querySelectorAll('.t_row');
        rows.forEach(row => {
            const cid = extractCid(row);
            const qty = getQuantity(row);
            if (cid && qty > 0) {
                for (let i = 0; i < qty; i++) result.push(cid);
            }
        });
        return result;
    }

    function extractDeckData() {
        const mainDeck = [];
        const extraDeck = [];
        const sideDeck = [];

        // 尝试从 detailtext 视图提取（数据最完整）
        const mainSection = document.querySelector('#detailtext_main');
        if (mainSection) {
            mainDeck.push(...parseSection(mainSection.querySelector('.mlist_m')));
            mainDeck.push(...parseSection(mainSection.querySelector('.mlist_s')));
            mainDeck.push(...parseSection(mainSection.querySelector('.mlist_t')));
        }

        const extraSection = document.querySelector('#detailtext_ext');
        if (extraSection) {
            extraDeck.push(...parseSection(extraSection));
        }

        const sideSection = document.querySelector('#detailtext_side');
        if (sideSection) {
            sideDeck.push(...parseSection(sideSection));
        }

        // 回退：从 deck_text 表格视图提取
        if (mainDeck.length === 0 && extraDeck.length === 0) {
            const monsterTable = document.querySelector('#monster_list');
            const spellTable = document.querySelector('#spell_list');
            const trapTable = document.querySelector('#trap_list');
            const extraTable = document.querySelector('#extra_list');
            const sideTable = document.querySelector('#side_list');

            [monsterTable, spellTable, trapTable].forEach(table => {
                if (!table) return;
                table.querySelectorAll('tr.row').forEach(row => {
                    const cid = extractCid(row);
                    const qty = getQuantity(row);
                    if (cid && qty > 0) {
                        for (let i = 0; i < qty; i++) mainDeck.push(cid);
                    }
                });
            });

            if (extraTable) {
                extraTable.querySelectorAll('tr.row').forEach(row => {
                    const cid = extractCid(row);
                    const qty = getQuantity(row);
                    if (cid && qty > 0) {
                        for (let i = 0; i < qty; i++) extraDeck.push(cid);
                    }
                });
            }

            if (sideTable) {
                sideTable.querySelectorAll('tr.row').forEach(row => {
                    const cid = extractCid(row);
                    const qty = getQuantity(row);
                    if (cid && qty > 0) {
                        for (let i = 0; i < qty; i++) sideDeck.push(cid);
                    }
                });
            }
        }

        return { mainDeck, extraDeck, sideDeck };
    }

    // --- Cache Helpers ---

    function getCached(cid) {
        try {
            return GM_getValue(CACHE_PREFIX + cid, null);
        } catch (e) {
            return null;
        }
    }

    function setCached(cid, passcode) {
        try {
            GM_setValue(CACHE_PREFIX + cid, passcode);
        } catch (e) {
            // storage full or unavailable
        }
    }

    // --- API: cid → passcode ---

    function fetchPasscodeBatch(cids) {
        return new Promise((resolve, reject) => {
            const param = cids.join(',');
            const url = `${API_BASE}?misc=yes&konami_id=${encodeURIComponent(param)}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 15000,
                onload: function (resp) {
                    try {
                        const data = JSON.parse(resp.responseText);
                        const mapping = {};
                        if (data.data) {
                            data.data.forEach(card => {
                                const konamiId = card.misc_info?.[0]?.konami_id;
                                if (konamiId && card.id) {
                                    mapping[String(konamiId)] = String(card.id);
                                }
                            });
                        }
                        resolve(mapping);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function (e) {
                    reject(new Error('Network error: ' + (e || 'unknown')));
                },
                ontimeout: function () {
                    reject(new Error('Request timeout'));
                }
            });
        });
    }

    async function resolvePasscodes(cidList) {
        const unique = [...new Set(cidList)];
        const mapping = {};
        const uncached = [];

        // 检查缓存
        for (const cid of unique) {
            const cached = getCached(cid);
            if (cached) {
                mapping[cid] = cached;
            } else {
                uncached.push(cid);
            }
        }

        // 分批请求 API
        for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
            const batch = uncached.slice(i, i + BATCH_SIZE);
            try {
                const result = await fetchPasscodeBatch(batch);
                for (const [konamiId, passcode] of Object.entries(result)) {
                    mapping[konamiId] = passcode;
                    setCached(konamiId, passcode);
                }
            } catch (e) {
                console.warn('[YGO Deck Export] batch fetch failed:', e);
            }
        }

        return mapping;
    }

    // --- YDK Generation ---

    function generateYDK(mainDeck, extraDeck, sideDeck, mapping) {
        const lines = [];
        lines.push('#created by 游戏王卡组导出YDK (UserScript)');
        lines.push('#main');

        for (const cid of mainDeck) {
            const pass = mapping[cid];
            if (pass) {
                lines.push(pass);
            } else {
                lines.push('# [UNKNOWN cid=' + cid + ']');
            }
        }

        lines.push('#extra');
        for (const cid of extraDeck) {
            const pass = mapping[cid];
            if (pass) {
                lines.push(pass);
            } else {
                lines.push('# [UNKNOWN cid=' + cid + ']');
            }
        }

        lines.push('!side');
        for (const cid of sideDeck) {
            const pass = mapping[cid];
            if (pass) {
                lines.push(pass);
            } else {
                lines.push('# [UNKNOWN cid=' + cid + ']');
            }
        }

        return lines.join('\n');
    }

    function downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // --- UI ---

    function getDeckName() {
        const h1 = document.querySelector('#broad_title h1');
        if (h1) {
            const text = h1.textContent.replace(/【.*?】/g, '').replace(/\s+/g, ' ').trim();
            return text || 'deck';
        }
        return 'deck';
    }

    function showToast(msg, duration = 2000) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            background: '#333',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '6px',
            fontSize: '14px',
            zIndex: '99999',
            opacity: '0',
            transition: 'opacity 0.3s',
            pointerEvents: 'none',
            maxWidth: '320px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function createExportButton() {
        const btn = document.createElement('button');
        btn.textContent = '导出 YDK';
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'linear-gradient(135deg, #e67e22, #d35400)',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: '99999',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'transform 0.15s, box-shadow 0.15s'
        });

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        });

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = '解析中...';
            btn.style.opacity = '0.7';

            try {
                const deckData = extractDeckData();
                const { mainDeck, extraDeck, sideDeck } = deckData;

                if (mainDeck.length === 0 && extraDeck.length === 0) {
                    showToast('未检测到卡组数据，请确认在卡组详情页面。');
                    return;
                }

                const totalCards = mainDeck.length + extraDeck.length + sideDeck.length;
                const uniqueCids = [...new Set([...mainDeck, ...extraDeck, ...sideDeck])];

                btn.textContent = `转换中 (${uniqueCids.length}种/${totalCards}张)...`;

                const mapping = await resolvePasscodes([...mainDeck, ...extraDeck, ...sideDeck]);

                const unknown = uniqueCids.filter(cid => !mapping[cid]);

                const ydk = generateYDK(mainDeck, extraDeck, sideDeck, mapping);
                const deckName = getDeckName();
                const filename = deckName.replace(/[\\/:*?"<>|]/g, '_') + '.ydk';

                downloadFile(ydk, filename);

                if (unknown.length > 0) {
                    showToast(
                        `已导出 ${filename}（${uniqueCids.length - unknown.length}/${uniqueCids.length} 种卡片转换成功，${unknown.length} 种未能识别）`,
                        4000
                    );
                } else {
                    showToast(`已导出 ${filename}（${totalCards}张卡片）`);
                }
            } catch (e) {
                console.error('[YGO Deck Export] error:', e);
                showToast('导出失败: ' + e.message, 3000);
            } finally {
                btn.disabled = false;
                btn.textContent = '导出 YDK';
                btn.style.opacity = '1';
            }
        });

        return btn;
    }

    // --- Init ---

    function init() {
        // 确保在卡组详情页面（有 deck_detailtext 或 deck_text）
        const hasDeckData =
            document.querySelector('#detailtext_main') ||
            document.querySelector('#monster_list') ||
            document.querySelector('#extra_list');

        if (!hasDeckData) return;

        const btn = createExportButton();
        document.body.appendChild(btn);
    }

    // 等待页面加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
