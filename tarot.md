---
layout: default
title: Tarot Mini Game
---

# 塔罗牌小游戏（Tarot Mini Game）

一个轻量的塔罗网页：可随机抽牌、查看简要解读，并结合心理学视角做理性科普。

> 说明：以下内容用于娱乐与自我反思，不构成医疗、法律、投资或人生重大决策建议。

<style>
  .tarot-wrap {
    max-width: 900px;
    margin: 0 auto;
    padding: 12px 6px 24px;
  }
  .tarot-toolbar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 14px 0 18px;
  }
  .tarot-btn {
    border: 1px solid #6b5fd6;
    background: #6b5fd6;
    color: #fff;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
  }
  .tarot-btn.alt {
    background: #fff;
    color: #6b5fd6;
  }
  .tarot-btn:hover {
    opacity: 0.92;
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .card {
    border: 1px solid #ddd;
    border-radius: 10px;
    padding: 12px;
    background: #fff;
    min-height: 190px;
  }
  .card h3 {
    margin: 0 0 8px;
    font-size: 18px;
  }
  .meta {
    display: inline-block;
    margin-bottom: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 12px;
    border: 1px solid #bbb;
    color: #555;
  }
  .note {
    border-left: 4px solid #6b5fd6;
    padding: 10px 12px;
    background: #f7f7ff;
    margin-top: 16px;
  }
</style>

<div class="tarot-wrap">
  <div class="tarot-toolbar">
    <button class="tarot-btn" id="draw1">抽 1 张（今日提示）</button>
    <button class="tarot-btn" id="draw3">抽 3 张（过去-现在-未来）</button>
    <button class="tarot-btn alt" id="reset">重置</button>
  </div>

  <div id="result" class="card-grid"></div>

  <div class="note">
    <strong>科普小贴士：</strong>
    塔罗常被用作“叙事与反思工具”。你会觉得“很准”，部分原因可能包括：
    <ul>
      <li><strong>巴纳姆效应</strong>：人容易把泛化描述看成“只在说我”。</li>
      <li><strong>确认偏差</strong>：更容易记住应验的部分，忽略不应验的部分。</li>
      <li><strong>投射效应</strong>：人在模糊线索中会投射当下情绪与期待。</li>
    </ul>
    合理使用方式：把它当成整理思路、观察情绪的辅助，而不是替代你自己的判断。
  </div>
</div>

<script>
  const deck = [
    {
      name: "愚者 The Fool",
      upright: "新开始、勇气、冒险精神。适合迈出第一步，但要保留基本规划。",
      reversed: "冲动、逃避现实、方向松散。建议先收拢目标再行动。"
    },
    {
      name: "魔术师 The Magician",
      upright: "行动力与资源整合能力上升。你有能力把想法落地。",
      reversed: "能量分散、过度包装。注意避免只说不做。"
    },
    {
      name: "女祭司 The High Priestess",
      upright: "直觉增强、适合观察与学习。先听内心，再做决定。",
      reversed: "信息不完整、想太多。建议补充事实证据。"
    },
    {
      name: "皇后 The Empress",
      upright: "滋养、创造、关系温度。适合稳步推进长期计划。",
      reversed: "过度付出、边界模糊。先照顾好自己的节奏。"
    },
    {
      name: "皇帝 The Emperor",
      upright: "结构、纪律、执行。建立规则会让事情更稳。",
      reversed: "控制欲、僵化。适当给变化留空间。"
    },
    {
      name: "恋人 The Lovers",
      upright: "价值观选择、关系协同。关键在于真诚沟通。",
      reversed: "犹豫、关系失衡。先厘清你真正重视的东西。"
    },
    {
      name: "战车 The Chariot",
      upright: "推进、胜任、克服阻力。聚焦目标会明显提速。",
      reversed: "内耗、失控感。先统一节奏再冲刺。"
    },
    {
      name: "力量 Strength",
      upright: "温和而坚定。你能用耐心而非对抗解决问题。",
      reversed: "自我怀疑、情绪压抑。允许自己慢一点恢复状态。"
    },
    {
      name: "隐士 The Hermit",
      upright: "独处、复盘、深度思考。适合沉淀和学习。",
      reversed: "封闭、过度退缩。适度寻求外部反馈。"
    },
    {
      name: "命运之轮 Wheel of Fortune",
      upright: "阶段变化、转机出现。准备好抓住时机。",
      reversed: "节奏反复、时机未到。先增强可控部分。"
    },
    {
      name: "正义 Justice",
      upright: "公平、因果、责任。用清晰标准处理问题。",
      reversed: "偏见、失衡、拖延承担后果。回到事实本身。"
    },
    {
      name: "倒吊人 The Hanged Man",
      upright: "换位思考、暂停是为了更好前进。",
      reversed: "无谓停滞、拖延。该放手的要放手。"
    }
  ];

  const resultEl = document.getElementById("result");

  function shuffle(arr) {
    const clone = [...arr];
    for (let i = clone.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
  }

  function createCard(card, idx, label) {
    const isReversed = Math.random() < 0.5;
    const orientation = isReversed ? "逆位" : "正位";
    const text = isReversed ? card.reversed : card.upright;
    const block = document.createElement("div");
    block.className = "card";
    block.innerHTML =
      "<h3>" + (label ? label + "：" : "") + card.name + "</h3>" +
      "<div class='meta'>" + orientation + "</div>" +
      "<p>" + text + "</p>";
    return block;
  }

  function renderDraw(count) {
    resultEl.innerHTML = "";
    const labels = ["过去", "现在", "未来"];
    const cards = shuffle(deck).slice(0, count);
    cards.forEach((c, i) => {
      const label = count === 3 ? labels[i] : "";
      resultEl.appendChild(createCard(c, i, label));
    });
  }

  document.getElementById("draw1").addEventListener("click", () => renderDraw(1));
  document.getElementById("draw3").addEventListener("click", () => renderDraw(3));
  document.getElementById("reset").addEventListener("click", () => {
    resultEl.innerHTML = "";
  });
</script>
