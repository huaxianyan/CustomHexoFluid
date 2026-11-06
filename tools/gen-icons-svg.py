"""从图标字体生成内联 SVG mask 样式表（assets/icons.css）。

为什么不用字体：`@font-face` 的字体要等样式表解析完才开始下载/解码，图标会比文字
晚出现（即使 base64 内联，也要等文档到齐再解码）。改成 SVG mask 后图标随 DOM 一起
画出来，且路径数据可被 gzip 压缩。

为什么不能直接用 em 方框当 viewBox：这套字体的字形普遍超出 em 方框（例如
tags-fill 宽达 1.25em），按 1em × 1em 裁就会切边。

做法：每个图标用自己的字形包围盒当 viewBox（不裁），再用 margin / vertical-align
把行内尺寸补偿回字体原本的 advance，保证排版不变。代价是行盒高度与字体渲染有
约 0.4 CSS 像素/行的差别（字体内容盒 vs inline-block 盒高），导航这类横向排列
不受影响。

用法（在主题仓库根目录，两个目录都要扫，导航图标写在 Hexo 仓库的配置里）：
    python tools/gen-icons-svg.py --scan . --scan "<Hexo 仓库路径>"
    python tools/gen-icons-svg.py --list     # 只列出图标与度量，不写文件
    python tools/gen-icons-svg.py --all      # 不看用量，输出整套字库（调试用）

加图标：换掉 assets/iconfont*/ 下的 css 与 woff2，然后重跑本脚本。
新增页面用到新图标时也要重跑，否则那个图标没有样式，页面上是空白。
"""
import argparse
import io
import os
import re

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

SCAN_SUFFIXES = ('.ejs', '.yml', '.yaml', '.md', '.js', '.styl', '.css', '.json', '.html')
USE = re.compile(r'icon-([a-z0-9-]+)')

# 字形描边补偿（字库单位，upm=1024 时 32 ≈ 0.031em）。
#
# 为什么加：字体渲染会做 hinting，把细笔画对齐像素网格并略微加重；SVG 路径只是几何
# 抗锯齿，同一字形在 14–16px 下实测墨量只有字体渲染的 95%，看起来“变细”。加这层描边
# 把墨量补回 100%（实测 0.998），实心图标与斜笔基本不受影响。
# 这是排版观感的补偿，不是字形设计的一部分；想看纯字形就把它改成 0 重新生成。
WEIGHT = 32

# 静态扫描只看得到源码里写死的类名。这两个是运行时拼出来的：
# source/js/color-schema.js 的 getIconClass(scheme) 返回 'icon-' + scheme，
# scheme 取值为 dark / light。HTML 里初始只有 icon-dark，暗色模式会换成 icon-light，
# 不登记就在这里漏掉，上线后开关图标在暗色主题下变空白。
EXTRA_ICONS = {'dark', 'light'}
FONTS = {
    'iconfont': ('assets/iconfont/iconfont.css', 'assets/iconfont/iconfont.woff2'),
    'iconfont2': ('assets/iconfont2/iconfont2.css', 'assets/iconfont2/iconfont2.woff2'),
}
OUTPUT = 'assets/icons.css'
RULE = re.compile(r'\.icon-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"')


def svg_uri(path_data, view_box, stroke=0):
    attrs = f' stroke="black" stroke-width="{stroke}"' if stroke else ''
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}">'
           f'<path d="{path_data}"{attrs}/></svg>').replace('"', "'")
    return 'data:image/svg+xml,' + svg.replace('<', '%3C').replace('>', '%3E').replace('#', '%23')


def round_path(path_data, digits=1):
    def repl(match):
        value = round(float(match.group(0)), digits)
        text = f'{value:.{digits}f}'.rstrip('0').rstrip('.')
        return text or '0'
    return re.sub(r'-?\d+\.\d+', repl, path_data)


def scan_used(roots):
    """扫源码与配置里出现的 icon-xxx 类名。

    导航图标写在 Hexo 仓库的配置文件里（不在主题 layout），所以调用时要把博客
    仓库一起扫，否则会漏掉实际在用的图标。
    """
    used = set()
    for root in roots:
        for base, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs
                       if d not in {'node_modules', '.git', 'public', '.deploy_git', '.nuxt'}]
            for name in files:
                if not name.endswith(SCAN_SUFFIXES):
                    continue
                full = os.path.join(base, name)
                # 字体自带的 CSS 里列着全部图标，扫进来就永远等于没裁剪
                if 'iconfont' in full.replace('\\', '/') or name == os.path.basename(OUTPUT):
                    continue
                try:
                    text = io.open(full, encoding='utf-8', errors='ignore').read()
                except OSError:
                    continue
                used.update(USE.findall(text))
    return used


def emit(family, css_path, font_path, out, listed, only):
    font = TTFont(font_path)
    upm = font['head'].unitsPerEm
    ascent, descent = font['hhea'].ascent, font['hhea'].descent
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font['hmtx']
    rules = dict(RULE.findall(io.open(css_path, encoding='utf-8').read()))

    for name, codepoint in sorted(rules.items()):
        if only and name not in only:
            continue
        glyph = cmap.get(int(codepoint, 16))
        if not glyph:
            continue

        bounds_pen = BoundsPen(glyph_set)
        glyph_set[glyph].draw(bounds_pen)
        if not bounds_pen.bounds:
            continue
        x0, y0, x1, y1 = bounds_pen.bounds
        advance = hmtx[glyph][0]

        pen = SVGPathPen(glyph_set)
        glyph_set[glyph].draw(TransformPen(pen, Transform(1, 0, 0, -1, 0, 0)))
        path_data = round_path(pen.getCommands())

        # 盒子的垂直尺寸要用**字体自己的内容盒**（ascent..descent），而不是字形包围盒。
        # 主题里 `i.iconfont{font-size:1em;line-height:1}`：字体版的 <i> 行盒正好 1em，
        # 若 mask 盒只有字形那么高（约 0.87em），行盒会矮一截，导航这类 flex 居中的
        # 容器里文字会整体偏 1px。让盒子占满内容盒后，行盒贡献与字体一致。
        # 字形超出的少数图标把盒子往外扩，保证不裁边（宁可高 0.15px 也不切）。
        left_ref = min(0, x0)
        right_ref = max(advance, x1)
        top_ref = max(ascent, y1)
        bottom_ref = min(descent, y0)

        # 描边会把字形向外扩 WEIGHT/2，viewBox 与盒子范围都要同步放宽，否则边缘被切。
        pad = WEIGHT / 2
        gx0, gy0, gx1, gy1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
        left_ref = min(left_ref, gx0)
        right_ref = max(right_ref, gx1)
        top_ref = max(top_ref, gy1)
        bottom_ref = min(bottom_ref, gy0)

        width_em = (right_ref - left_ref) / upm
        height_em = (top_ref - bottom_ref) / upm
        margin_left = left_ref / upm
        margin_right = advance / upm - width_em - margin_left
        glyph_w_em = (gx1 - gx0) / upm
        glyph_h_em = (gy1 - gy0) / upm
        offset_x_em = (gx0 - left_ref) / upm
        offset_y_em = (top_ref - gy1) / upm

        listed.append((family, name, round((x1 - x0) / upm, 3), round((y1 - y0) / upm, 3),
                       round(advance / upm, 3)))

        view_box = f'{gx0:.0f} {-gy1:.0f} {gx1 - gx0:.0f} {gy1 - gy0:.0f}'
        mask = svg_uri(path_data, view_box, WEIGHT)
        # 同一个 data URI 要同时给 -webkit-mask 和 mask：Safari 15.4 以前只认前缀写法。
        # 直接写两遍会让每个图标的样式体积翻倍，所以存进自定义属性再引用。
        # 字形用 mask-size/position 精确定位，不能写 center/contain——那样会被缩放去填满盒子。
        out.append(
            f'.icon-{name}:before{{content:"";display:inline-block;'
            f'width:{width_em:.4f}em;height:{height_em:.4f}em;'
            f'margin-left:{margin_left:.4f}em;margin-right:{margin_right:.4f}em;'
            f'vertical-align:{bottom_ref / upm:.4f}em;background-color:currentColor;'
            f'--m:url("{mask}");'
            f'-webkit-mask-image:var(--m);-webkit-mask-size:{glyph_w_em:.4f}em {glyph_h_em:.4f}em;'
            f'-webkit-mask-position:{offset_x_em:.4f}em {offset_y_em:.4f}em;'
            f'-webkit-mask-repeat:no-repeat;'
            f'mask-image:var(--m);mask-size:{glyph_w_em:.4f}em {glyph_h_em:.4f}em;'
            f'mask-position:{offset_x_em:.4f}em {offset_y_em:.4f}em;mask-repeat:no-repeat}}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--list', action='store_true', help='只列出图标与度量')
    parser.add_argument('--scan', action='append', default=[],
                        help='扫描 icon-xxx 用量的目录，可重复；默认只扫当前目录')
    parser.add_argument('--all', action='store_true', help='输出全部图标，不看用量')
    args = parser.parse_args()

    only = None
    if not args.all:
        only = scan_used(args.scan or ['.']) | EXTRA_ICONS
        if not only:
            raise SystemExit('没扫到任何 icon-xxx 用量，检查 --scan 目录')

    out, listed = [], []
    for family, (css_path, font_path) in FONTS.items():
        emit(family, css_path, font_path, out, listed, only)

    if only:
        known = {name for _, name, _, _, _ in listed}
        missing = sorted(only - known)
        if missing:
            print('用量里有、但字库里没有的图标（多半是打错字）:', ' '.join(missing))

    if args.list:
        for row in listed:
            print('{:10s} {:22s} 宽{:.3f}em 高{:.3f}em advance{:.3f}em'.format(*row))
        return

    header = ('/* 由 tools/gen-icons-svg.py 从 assets/iconfont*/ 生成，不要手改。\n'
              '   图标用内联 SVG mask 呈现：无字体下载与解码，路径数据可 gzip。 */\n')
    io.open(OUTPUT, 'w', encoding='utf-8', newline='\n').write(header + '\n'.join(out) + '\n')
    print(f'生成 {len(out)} 个图标 → {OUTPUT}')


if __name__ == '__main__':
    main()
