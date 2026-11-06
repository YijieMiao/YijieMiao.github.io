(async () => {
  const quotes = [
    ["行到水穷处，坐看云起时。", "王维《终南别业》", "zh"],
    ["山光悦鸟性，潭影空人心。", "常建《题破山寺后禅院》", "zh"],
    ["疏影横斜水清浅，暗香浮动月黄昏。", "林逋《山园小梅》", "zh"],
    ["落花人独立，微雨燕双飞。", "晏几道《临江仙》", "zh"],
    ["野旷天低树，江清月近人。", "孟浩然《宿建德江》", "zh"],
    ["星垂平野阔，月涌大江流。", "杜甫《旅夜书怀》", "zh"],
    ["明月松间照，清泉石上流。", "王维《山居秋暝》", "zh"],
    ["浮云游子意，落日故人情。", "李白《送友人》", "zh"],
    ["小舟从此逝，江海寄余生。", "苏轼《临江仙·夜归临皋》", "zh"],
    ["Hope is the thing with feathers", "Emily Dickinson", "en"],
    ["I wandered lonely as a cloud", "William Wordsworth", "en"],
    ["Season of mists and mellow fruitfulness", "John Keats, To Autumn", "en"],
    ["Here’s looking at you, kid.", "Casablanca", "en"],
    ["Nobody’s perfect.", "Some Like It Hot", "en"],
    ["The game is on.", "Sherlock", "en"],
    ["See you, space cowboy…", "Cowboy Bebop", "en"],
    ["海上生明月，天涯共此时。", "张九龄《望月怀远》", "zh"],
    ["掬水月在手，弄花香满衣。", "于良史《春山夜月》", "zh"],
    ["竹杖芒鞋轻胜马，谁怕？", "苏轼《定风波》", "zh"],
    ["The poetry of earth is never dead.", "John Keats, On the Grasshopper and Cricket", "en"],
    ["I contain multitudes.", "Walt Whitman, Song of Myself", "en"],
    ["After all, tomorrow is another day!", "Gone with the Wind", "en"],
    ["There’s no place like home.", "The Wizard of Oz", "en"],
    ["I’m ready for my close-up.", "Sunset Boulevard", "en"],
    ["Just keep swimming.", "Finding Nemo", "en"],
    ["I am serious. And don’t call me Shirley.", "Airplane!", "en"],
    ["Life finds a way.", "Jurassic Park", "en"],
    ["I’m having an old friend for dinner.", "The Silence of the Lambs", "en"],
    ["Allons-y!", "Doctor Who", "en"],
    ["Lovely jubbly!", "Only Fools and Horses", "en"],
    ["I have a cunning plan.", "Blackadder", "en"],
    ["The greater good.", "Hot Fuzz", "en"],
    ["We were on a break!", "Friends", "en"],
    ["Treat yo’ self.", "Parks and Recreation", "en"],
    ["I am the one who knocks.", "Breaking Bad", "en"],
    ["Live long and prosper.", "Star Trek", "en"],
    ["Plus Ultra!", "My Hero Academia", "en"],
    ["Believe it!", "Naruto · English dub", "en"],
    ["I’m going to be King of the Pirates!", "One Piece · English translation", "en"],
    ["Get in the robot, Shinji.", "Neon Genesis Evangelion · popular paraphrase", "en"],
  ];

  const storageKey = "homepage-previous-quote";
  let previous = null;
  try {
    previous = localStorage.getItem(storageKey);
  } catch {
    // The quote still works if browser storage is unavailable.
  }

  const choices = quotes.filter(([line]) => line !== previous);
  let [line, source, lang] = choices[Math.floor(Math.random() * choices.length)];
  try {
    const categories = ["a", "d", "h", "i"];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const useOnlinePool = Math.random() < 0.5;
    for (let attempt = 0; useOnlinePool && attempt < 2; attempt++) {
      const response = await fetch(
        "https://v1.hitokoto.cn/?c=" + category + "&min_length=5&max_length=45",
        { cache: "no-store", signal: AbortSignal.timeout(1800) }
      );
      if (!response.ok) break;
      const quote = await response.json();
      if (typeof quote.hitokoto !== "string" || typeof quote.from !== "string") break;
      if (quote.hitokoto === previous) continue;
      line = quote.hitokoto;
      source = [quote.from_who, quote.from, "一言"].filter(Boolean).join(" · ");
      lang = /[\u3400-\u9fff]/.test(line) ? "zh" : "en";
      break;
    }
  } catch {
    // Use the local collection when the service is unavailable.
  }
  const quoteElement = document.getElementById("opening-line");
  const sourceElement = document.getElementById("opening-source");
  quoteElement.textContent = line;
  sourceElement.textContent = source;
  quoteElement.lang = sourceElement.lang = lang;

  try {
    localStorage.setItem(storageKey, line);
  } catch {
    // The next visit can still draw from the full collection.
  }
})();
