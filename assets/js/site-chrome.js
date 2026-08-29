/**
 * 站点共享页头/页脚注入模块
 * 功能：为所有页面统一注入页头（导航/下拉菜单/抽屉菜单）与页脚，消除多页面复制粘贴维护
 * 用法：页面中将原 <header class="site-header">...</header> 替换为 <site-header></site-header>，
 *       将原 <footer class="site-footer">...</footer> 替换为 <site-footer></site-footer>，
 *       并在 </body> 前引入本脚本。
 * 说明：纯静态零构建方案，注入的 HTML 与原来逐字节一致，样式类名不变，无需改动 CSS。
 */
(function () {
    'use strict';

    // 页头 HTML（与各页面原 <header class="site-header"> 内容一致）
    var SITE_HEADER_HTML = '\n' +
        '    <header class="site-header">\n' +
        '        <div class="container">\n' +
        '            <div class="site-title">\n' +
        '                <a href="/" class="site-title-link">\n' +
        '                    <span class="site-title">天天发蛋糕的工具箱</span>\n' +
        '                </a>\n' +
        '            </div>\n' +
        '            <label for="menu-toggle-checkbox" class="menu-toggle" aria-label="打开菜单">☰</label>\n' +
        '            <nav class="nav-menu">\n' +
        '                <ul class="nav-list">\n' +
        '                    <li class="nav-item dropdown">\n' +
        '                        <a href="#" class="nav-link dropdown-toggle" aria-haspopup="true" aria-expanded="false">工具</a>\n' +
        '                        <ul class="dropdown-menu">\n' +
        '                            <li><a href="/tools/yu-gi-oh-probability-calculator/" class="dropdown-item">游戏王概率计算器</a></li>\n' +
        '                            <li><a href="/tools/card-translate/" class="dropdown-item">游戏王卡牌日中对照文本生成器</a></li>\n' +
        '                            <li><a href="/tools/webp-avif-2-jpg-png/" class="dropdown-item">AVIF/WebP转JPG/PNG</a></li>\n' +
        '                            <li><a href="/tools/cable-management-tool/" class="dropdown-item">力导向图理线工具</a></li>\n' +
        '                            <li><a href="https://chromewebstore.google.com/detail/kmnmkpgmneeokldcmfcgjppgpcfecoed" class="dropdown-item">恢复关闭的标签页</a></li>\n' +
        '                            <li><a href="https://greasyfork.org/zh-CN/scripts/593417-%E6%B8%B8%E6%88%8F%E7%8E%8B%E5%8D%A1%E7%BB%84%E5%AF%BC%E5%87%BAydk" class="dropdown-item">官方数据库导出YDK</a></li>\n' +
        '                        </ul>\n' +
        '                    </li>\n' +
        '                </ul>\n' +
        '            </nav>\n' +
        '        </div>\n' +
        '        <input type="checkbox" id="menu-toggle-checkbox" hidden>\n' +
        '        <div class="drawer">\n' +
        '            <div class="container">\n' +
        '                <label for="menu-toggle-checkbox" class="menu-toggle close-menu" aria-label="关闭菜单">×</label>\n' +
        '            </div>\n' +
        '            <nav class="drawer-menu">\n' +
        '                <ul class="drawer-list">\n' +
        '                    <li class="drawer-item">\n' +
        '                        <a href="#" class="drawer-link">工具</a>\n' +
        '                        <ul class="drawer-submenu">\n' +
        '                            <li><a href="/tools/yu-gi-oh-probability-calculator/" class="drawer-subitem">游戏王概率计算器</a></li>\n' +
        '                            <li><a href="/tools/card-translate/" class="drawer-subitem">游戏王卡牌日中对照文本生成器</a></li>\n' +
        '                            <li><a href="/tools/webp-avif-2-jpg-png/" class="drawer-subitem">AVIF/WebP转JPG/PNG</a></li>\n' +
        '                            <li><a href="/tools/cable-management-tool/" class="drawer-subitem">力导向图理线工具</a></li>\n' +
        '                            <li><a href="https://chromewebstore.google.com/detail/kmnmkpgmneeokldcmfcgjppgpcfecoed" class="drawer-subitem">恢复关闭的标签页</a></li>\n' +
        '                            <li><a href="https://greasyfork.org/zh-CN/scripts/593417-%E6%B8%B8%E6%88%8F%E7%8E%8B%E5%8D%A1%E7%BB%84%E5%AF%BC%E5%87%BAydk" class="drawer-subitem">官方数据库导出YDK</a></li>\n' +
        '                        </ul>\n' +
        '                    </li>\n' +
        '                </ul>\n' +
        '            </nav>\n' +
        '        </div>\n' +
        '        <label for="menu-toggle-checkbox" class="drawer-overlay"></label>\n' +
        '    </header>';

    // 页脚 HTML（与各页面原 <footer class="site-footer"> 内容一致）
    var SITE_FOOTER_HTML = '\n' +
        '    <footer class="site-footer">\n' +
        '        <div class="container">\n' +
        '            <div class="footer-grid">\n' +
        '                <div>\n' +
        '                    <h3 class="footer-title">关于作者</h3>\n' +
        '                    <ul class="footer-links">\n' +
        '                        <li><a href="mailto:ttfdg520cs@gmail.com">ttfdg520cs@gmail.com</a></li>\n' +
        '                        <li><a href="https://space.bilibili.com/1446349" target="_blank">Bilibili主页</a></li>\n' +
        '                        <li><a href="https://github.com/xzxz520cs" target="_blank">GitHub</a></li>\n' +
        '                    </ul>\n' +
        '                </div>\n' +
        '            </div>\n' +
        '            <div class="footer-bottom">\n' +
        '                <p class="text-muted">© 2025 天天发蛋糕的工具箱</p>\n' +
        '            </div>\n' +
        '        </div>\n' +
        '    </footer>';

    function inject() {
        var hosts = document.querySelectorAll('site-header, site-footer');
        if (!hosts.length) return;
        hosts.forEach(function (el) {
            var html = el.tagName.toLowerCase() === 'site-header' ? SITE_HEADER_HTML : SITE_FOOTER_HTML;
            var template = document.createElement('template');
            template.innerHTML = html.trim();
            var fragment = template.content;
            el.replaceWith(fragment);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }

    // 暴露注入函数，便于调试/重新注入
    window.SiteChrome = { inject: inject };
})();
