# SPDX-License-Identifier: Apache-2.0
"""Render the bilingual diagrams used by the WGP-ABF whitepaper."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont

from font_paths import publication_fonts


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "diagrams"
FONT_REGULAR, FONT_BOLD, _ = publication_fonts()

NAVY = "#06172b"
PANEL = "#0d2743"
PANEL_ALT = "#123654"
CYAN = "#3bd7ff"
BLUE = "#2f7dff"
WHITE = "#f5fbff"
MUTED = "#a9bfd3"
AMBER = "#ffbf47"
RED = "#ff6b72"
GREEN = "#55e6a5"
GRID = "#173553"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size)


def canvas(title: str, subtitle: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (1600, 900), NAVY)
    draw = ImageDraw.Draw(image)
    for x in range(0, 1600, 50):
        draw.line((x, 0, x, 900), fill=GRID, width=1)
    for y in range(0, 900, 50):
        draw.line((0, y, 1600, y), fill=GRID, width=1)
    draw.rectangle((0, 0, 1600, 118), fill="#071c33")
    draw.text((70, 28), title, font=font(36, True), fill=WHITE)
    draw.text((72, 78), subtitle, font=font(20), fill=MUTED)
    return image, draw


def rounded_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    title: str,
    subtitle: str,
    *,
    accent: str = CYAN,
    fill: str = PANEL,
    title_size: int = 25,
    subtitle_size: int = 17,
) -> None:
    draw.rounded_rectangle(box, radius=22, fill=fill, outline=accent, width=3)
    x1, y1, x2, _ = box
    draw.rectangle((x1, y1, x1 + 9, box[3]), fill=accent)
    draw.text((x1 + 28, y1 + 20), title, font=font(title_size, True), fill=WHITE)
    draw.multiline_text(
        (x1 + 28, y1 + 58),
        subtitle,
        font=font(subtitle_size),
        fill=MUTED,
        spacing=7,
    )


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], color: str = CYAN, width: int = 4) -> None:
    draw.line((*start, *end), fill=color, width=width)
    x, y = end
    if abs(end[0] - start[0]) >= abs(end[1] - start[1]):
        direction = 1 if end[0] > start[0] else -1
        draw.polygon([(x, y), (x - 14 * direction, y - 9), (x - 14 * direction, y + 9)], fill=color)
    else:
        direction = 1 if end[1] > start[1] else -1
        draw.polygon([(x, y), (x - 9, y - 14 * direction), (x + 9, y - 14 * direction)], fill=color)


def save(image: Image.Image, name: str) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT / name, optimize=True)


def render_system_map() -> None:
    image, draw = canvas("WGP-ABF 系统地图 / System Map", "三份协议、一条图纸纪律；机器记录与人的编辑界面共享同一模型")
    center = (600, 330, 1000, 595)
    draw.rounded_rectangle(center, radius=36, fill="#0a3356", outline=WHITE, width=4)
    draw.text((620, 365), "WGP-ABIR + AssemblyRecipe", font=font(21, True), fill=WHITE)
    draw.text((644, 415), "规范结构记录 / Canonical Record", font=font(17, True), fill=CYAN)
    draw.line((650, 462, 950, 462), fill=GRID, width=2)
    draw.text((659, 483), "二维图纸：权威编辑投影", font=font(19, True), fill=WHITE)
    draw.text((625, 525), "2D blueprint: authoritative editing projection", font=font(15), fill=MUTED)

    boxes = [
        ((90, 180, 500, 350), "标准件与结构 / Standard Parts", "StandardPartDescriptor · ABIR\n装配面、强类型边、配方与差分", CYAN),
        ((1100, 180, 1510, 350), "运行协议 / Runtime", "存储 · 来源 · 回放角色三轴\n事件、因果顺序、回放与审计", BLUE),
        ((90, 610, 500, 780), "证据协议 / Evidence", "三级评测 · 双重评分\n样本量、方差、置信区间", GREEN),
        ((1100, 610, 1510, 780), "呈现投影 / Presentation", "机体视图 · 三维视图\n只读投影，不保存第二份结构", AMBER),
    ]
    for box, title, subtitle, accent in boxes:
        rounded_box(draw, box, title, subtitle, accent=accent)

    arrow(draw, (500, 265), (600, 390), CYAN)
    arrow(draw, (1100, 265), (1000, 390), BLUE)
    arrow(draw, (500, 695), (600, 545), GREEN)
    arrow(draw, (1000, 545), (1100, 695), AMBER)
    draw.text((640, 660), "工程纪律 / Discipline", font=font(24, True), fill=WHITE)
    draw.text((585, 705), "可差分 · 可审查 · 可回滚 · 可验证", font=font(20), fill=MUTED)
    save(image, "wgp-abf-system-map.png")


def render_nine_stage_flow() -> None:
    image, draw = canvas("九阶段工作流 / Nine-stage Workflow", "从不可见配置到有证据的升级；每一步都留下可审查产物")
    stages = [
        ("01", "导入与拆解", "Import & Decompose"),
        ("02", "模块显形", "Reveal Modules"),
        ("03", "标准件归一", "Normalize Parts"),
        ("04", "关系显形", "Type Relationships"),
        ("05", "生成图纸", "Build Blueprint"),
        ("06", "装配改装", "Assemble & Modify"),
        ("07", "差分审查", "Diff & Review"),
        ("08", "编译运行", "Compile & Run"),
        ("09", "评测进化", "Evaluate & Evolve"),
    ]
    positions = [(80 + i * 300, 190) for i in range(5)] + [(1280 - i * 300, 520) for i in range(4)]
    for index, ((num, zh, en), (x, y)) in enumerate(zip(stages, positions)):
        box = (x, y, x + 240, y + 170)
        accent = CYAN if index < 5 else GREEN
        draw.rounded_rectangle(box, radius=22, fill=PANEL, outline=accent, width=3)
        draw.ellipse((x + 18, y + 18, x + 70, y + 70), fill=accent)
        draw.text((x + 29, y + 29), num, font=font(18, True), fill=NAVY)
        draw.text((x + 22, y + 88), zh, font=font(24, True), fill=WHITE)
        draw.text((x + 22, y + 128), en, font=font(15), fill=MUTED)
        if index < 4:
            arrow(draw, (x + 240, y + 85), (positions[index + 1][0] - 18, positions[index + 1][1] + 85), CYAN)
        elif index == 4:
            arrow(draw, (x + 120, y + 170), (positions[index + 1][0] + 120, positions[index + 1][1] - 20), AMBER)
        elif index < 8:
            arrow(draw, (x, y + 85), (positions[index + 1][0] + 258, positions[index + 1][1] + 85), GREEN)
    draw.rounded_rectangle((80, 760, 1520, 835), radius=20, fill="#0a304b", outline=AMBER, width=2)
    draw.text((170, 781), "通过条件 / Gate：图纸上的一次改动真实改变运行行为，并由同条件证据证明改进或触发回滚。", font=font(20, True), fill=WHITE)
    save(image, "wgp-abf-nine-stage-flow.png")


def render_evolution_loop() -> None:
    image, draw = canvas("证据化进化闭环 / Evidence-driven Evolution Loop", "改动不是升级；只有通过受控验证的改动才进入版本历史")
    cx, cy = 800, 500
    nodes = [
        ((590, 150, 1010, 270), "1 语义差分 / RecipeDiff", "变更、风险、审批、逐操作逆向与补偿", CYAN),
        ((1110, 330, 1510, 450), "2 编译与运行 / Run", "相同任务集、环境与版本锚点", BLUE),
        ((1050, 650, 1470, 770), "3 证据 / Evidence", "样本量、方差、成本、质量、安全", GREEN),
        ((130, 650, 550, 770), "4 诊断 / Diagnose", "定位 componentId、edgeId 或子图", AMBER),
        ((90, 330, 490, 450), "5 决策 / Decide", "升级、未定论、拒绝或回滚", RED),
    ]
    for box, title, subtitle, accent in nodes:
        rounded_box(draw, box, title, subtitle, accent=accent, title_size=23, subtitle_size=16)
    arrow(draw, (1010, 230), (1110, 350), CYAN)
    arrow(draw, (1310, 450), (1280, 650), BLUE)
    arrow(draw, (1050, 710), (550, 710), GREEN)
    arrow(draw, (340, 650), (290, 450), AMBER)
    arrow(draw, (490, 350), (590, 230), RED)
    draw.ellipse((610, 350, 990, 650), fill="#092f50", outline=WHITE, width=4)
    draw.text((680, 414), "可复现升级", font=font(34, True), fill=WHITE)
    draw.text((690, 468), "REPRODUCIBLE", font=font(23, True), fill=CYAN)
    draw.text((730, 504), "EVOLUTION", font=font(23, True), fill=CYAN)
    draw.text((680, 562), "Promote or Roll Back", font=font(18), fill=MUTED)
    save(image, "wgp-abf-evolution-loop.png")


def render_fidelity_matrix() -> None:
    image, draw = canvas("结构来源与操作能力分离 / Provenance ≠ Permission", "F3–F0 只描述 claim 的结构来源；查看、编辑、编译与回写必须逐字段另行证明")
    headers = ["来源级别", "结构来源 / Source", "完整度", "运行核验", "证据与能力声明"]
    rows = [
        ("F3 原生级 / Native", "平台原生机器可读结构", "逐 claim 标注", "可选", "来源质量最高；仍不自动授予编辑或回写能力"),
        ("F2 导出级 / Exported", "官方导出或只读接口", "逐 claim 标注", "可选", "标明适配器、覆盖范围、采集时间与证据"),
        ("F1 推断级 / Inferred", "静态分析或运行观测推断", "通常不完整", "可选", "可形成假设；不可单独形成因果结论"),
        ("F0 人工级 / Manual", "人工声明或文档录入", "未知或最小", "可选", "仅作草图；必须醒目标记来源与不确定性"),
    ]
    x0, y0 = 70, 180
    widths = [200, 400, 220, 200, 390]
    heights = [84] + [130] * 4
    x_positions = [x0]
    for width in widths:
        x_positions.append(x_positions[-1] + width)
    y_positions = [y0]
    for height in heights:
        y_positions.append(y_positions[-1] + height)
    for col, header in enumerate(headers):
        draw.rectangle((x_positions[col], y_positions[0], x_positions[col + 1], y_positions[1]), fill="#0e4164", outline=GRID, width=2)
        draw.text((x_positions[col] + 16, y_positions[0] + 25), header, font=font(19, True), fill=WHITE)
    row_accents = [GREEN, CYAN, AMBER, RED]
    for row_index, row in enumerate(rows):
        y1, y2 = y_positions[row_index + 1], y_positions[row_index + 2]
        for col, value in enumerate(row):
            fill = PANEL if row_index % 2 == 0 else PANEL_ALT
            draw.rectangle((x_positions[col], y1, x_positions[col + 1], y2), fill=fill, outline=GRID, width=2)
            color = row_accents[row_index] if col == 0 else MUTED
            draw.multiline_text((x_positions[col] + 16, y1 + 42), value, font=font(18, col == 0), fill=color, spacing=6)
    draw.rounded_rectangle((100, 770, 1500, 842), radius=18, fill="#0a304b", outline=AMBER, width=2)
    draw.text((108, 791), "operationCapabilities = view / edit / compile / roundTrip / hotReload / replace；能力逐字段证明，不由 F 等级推导。", font=font(15, True), fill=WHITE)
    save(image, "wgp-abf-fidelity-matrix.png")


def render_standard_parts() -> None:
    image, draw = canvas(
        "智能体标准件生态 / Standard-part Ecosystem",
        "不统一内部实现，只标准化装配面；百花齐放负责创新，标准件负责组合",
    )

    draw.rounded_rectangle((55, 155, 445, 675), radius=28, fill="#092944", outline=BLUE, width=3)
    draw.text((85, 180), "多样实现 / Diverse Implementations", font=font(23, True), fill=WHITE)
    draw.text((86, 220), "内部自由演进，外部声明可装配事实", font=font(16), fill=MUTED)
    implementation_boxes = [
        ((85, 270, 250, 360), "模型 / Model", "ABIR: Resource", CYAN),
        ((270, 270, 415, 360), "记忆 / Memory", "ABIR: Resource", GREEN),
        ((85, 385, 250, 475), "工具 / Tool", "ABIR: Component", AMBER),
        ((270, 385, 415, 475), "技能 / Skill", "ABIR: Artifact", BLUE),
        ((85, 500, 250, 590), "工作流", "ABIR: Component", RED),
        ((270, 500, 415, 590), "界面 / UI", "ABIR: Interface", CYAN),
    ]
    for box, label, part_kind, accent in implementation_boxes:
        draw.rounded_rectangle(box, radius=18, fill=PANEL, outline=accent, width=3)
        label_box = draw.textbbox((0, 0), label, font=font(18, True))
        label_width = label_box[2] - label_box[0]
        draw.text((box[0] + (box[2] - box[0] - label_width) / 2, box[1] + 21), label, font=font(18, True), fill=WHITE)
        kind_box = draw.textbbox((0, 0), part_kind, font=font(12))
        kind_width = kind_box[2] - kind_box[0]
        draw.text((box[0] + (box[2] - box[0] - kind_width) / 2, box[1] + 57), part_kind, font=font(12), fill=MUTED)

    draw.rounded_rectangle((520, 155, 1055, 675), radius=32, fill="#0a3356", outline=CYAN, width=4)
    draw.text((560, 180), "StandardPartDescriptor", font=font(27, True), fill=WHITE)
    draw.text((560, 225), "标准化装配面 / Standardized Assembly Surface", font=font(18, True), fill=CYAN)
    descriptor_rows = [
        ("身份与版本", "Identity · Version · Kind"),
        ("端口与能力", "Typed Ports · Capabilities"),
        ("依赖与权限", "Runtime · Dependencies · Permissions"),
        ("状态与迁移", "State Schema · Migration"),
        ("兼容与生命周期", "Compatibility · Lifecycle"),
        ("证据与供应链", "Conformance · Evidence · Provenance"),
    ]
    for index, (zh, en) in enumerate(descriptor_rows):
        y1 = 275 + index * 59
        draw.rounded_rectangle((555, y1, 1020, y1 + 46), radius=12, fill=PANEL_ALT, outline=GRID, width=2)
        draw.text((575, y1 + 10), zh, font=font(17, True), fill=WHITE)
        draw.text((735, y1 + 12), en, font=font(14), fill=MUTED)

    arrow(draw, (445, 415), (520, 415), CYAN, 5)
    draw.text((451, 374), "声明", font=font(16, True), fill=CYAN)
    draw.text((448, 442), "Declare", font=font(13), fill=MUTED)

    draw.rounded_rectangle((1130, 155, 1545, 675), radius=28, fill="#092944", outline=GREEN, width=3)
    draw.text((1160, 180), "开放生态 / Open Ecosystem", font=font(23, True), fill=WHITE)
    ecosystem_rows = [
        ((1160, 245, 1515, 325), "1 发现 / Registry", "签名描述符与版本索引", CYAN),
        ((1160, 345, 1515, 425), "2 求解 / Compatibility", "端口、策略、运行时与状态约束", BLUE),
        ((1160, 445, 1515, 525), "3 验证 / Conformance", "测试向量、证据和互换等级", GREEN),
        ((1160, 545, 1515, 625), "4 替换 / Replacement", "迁移、验收、回滚与副作用补偿", AMBER),
    ]
    for box, title, subtitle, accent in ecosystem_rows:
        rounded_box(draw, box, title, subtitle, accent=accent, title_size=18, subtitle_size=14)
    arrow(draw, (1055, 415), (1130, 415), GREEN, 5)
    draw.text((1066, 374), "验证", font=font(16, True), fill=GREEN)
    draw.text((1063, 442), "Verify", font=font(13), fill=MUTED)

    ladder_x = [55, 353, 651, 949, 1247, 1545]
    ladder = [
        ("I0 封闭", "Closed", RED),
        ("I1 适配", "Adapter-wrapped", AMBER),
        ("I2 可装配", "Interface-conformant", BLUE),
        ("I3 可替换", "Behavior-verified", CYAN),
        ("I4 受控互换", "Migration + rollback evidence", GREEN),
    ]
    for index, (title, subtitle, accent) in enumerate(ladder):
        box = (ladder_x[index], 725, ladder_x[index + 1], 840)
        draw.rectangle(box, fill=PANEL if index % 2 == 0 else PANEL_ALT, outline=accent, width=3)
        draw.text((box[0] + 20, 748), title, font=font(19, True), fill=accent)
        draw.text((box[0] + 20, 790), subtitle, font=font(14), fill=MUTED)
    draw.text((60, 690), "互换成熟度 / Interchangeability maturity（独立于 F3–F0 结构来源）", font=font(18, True), fill=WHITE)
    save(image, "wgp-abf-standard-parts.png")


def main() -> None:
    render_system_map()
    render_nine_stage_flow()
    render_evolution_loop()
    render_fidelity_matrix()
    render_standard_parts()
    print(f"Rendered 5 diagrams to {OUTPUT}")


if __name__ == "__main__":
    main()
