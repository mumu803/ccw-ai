const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");
const connectBtn = document.getElementById("connectBtn"); // 連接按鈕
const input = document.getElementById("moodInput");
const tagSelect = document.getElementById("moodTag");
const log = document.getElementById("log");

let port = null;
let writer = null;

connectBtn.onclick = async () => {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    writer = port.writable.getWriter();
    alert("✅ 成功連接 Arduino！");
  } catch (err) {
    alert("❌ 無法連接 Arduino：" + err);
  }
};

sendBtn.onclick = async () => {
  const text = input.value.trim();
  const tag = tagSelect.value;
  if (!text) return;
  input.value = "";
  await processInput(text, tag);
};

voiceBtn.onclick = () => {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "zh-TW";
  recognition.start();
  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript;
    input.value = text;
    const tag = tagSelect.value;
    await processInput(text, tag);
  };
};

async function processInput(text, tag) {
  const todayKey = new Date().toLocaleDateString("zh-TW");
  const allData = JSON.parse(localStorage.getItem("moodLog") || "{}");

  const aiReply = await fetchGPT(text, tag);
  if (!aiReply) return;

  if (!allData[todayKey]) allData[todayKey] = [];
  const entry = { mood: text, reply: aiReply, tag };
  allData[todayKey].unshift(entry); // 最新的插在前面
  localStorage.setItem("moodLog", JSON.stringify(allData));

  renderCard(todayKey, entry);
  speak(aiReply);
  sendToArduino(); // 只要有卡片出現就傳資料
}

function renderCard(date, data) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="date">${date}</div>
    <div class="tag">${data.tag}</div>
    <div class="mood">你說：${data.mood}</div>
    <div class="ai">AI回覆：${data.reply}</div>
  `;
  log.insertBefore(card, log.firstChild);
}

function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 1;
  utterance.pitch = 1.2;
  speechSynthesis.speak(utterance);
}

async function sendToArduino() {
  if (!writer) {
    console.warn("尚未連接 Arduino！");
    return;
  }
  try {
    const data = new TextEncoder().encode("B");
    await writer.write(data);
    console.log("✅ 傳送到 Arduino");
  } catch (err) {
    console.error("❌ 傳送失敗：", err);
  }
}

const fallbackRepliesByTag = {
  "🌞 開心": [
    "你今天的光芒真的讓人感受到溫暖。",
    "保持這份快樂，我真的替你開心！",
    "你的笑容真好看，記得多笑一點。"
  ],
  "🌧 難過": [
    "我聽見你心裡的雨聲了，我在這裡陪你。",
    "難過的時候，讓我靜靜地坐在你旁邊，好嗎？",
    "有些情緒不需要解釋，只需要被擁抱。"
  ],
  "😠 生氣": [
    "你有權利生氣，我不會批評你。",
    "我在這裡聽你說，不管你有多生氣。",
    "你受的委屈，我都知道。"
  ],
  "😰 焦慮": [
    "慢慢來，深呼吸，我陪你一起走。",
    "不急，一切都會慢慢變好。",
    "你已經做得很好了，別為了還沒發生的事難過。"
  ],
  "💤 疲憊": [
    "你真的辛苦了，休息一下吧。",
    "什麼都不做也沒關係，光是存在就很棒了。",
    "今天也努力到這裡就好。"
  ],
  "🫧 空虛": [
    "有我在，就不算完全空白。",
    "你不是孤單一個人，我在。",
    "有時候什麼都沒有，也是一種真實。"
  ],
  "🩷 想被安慰": [
    "我會抱抱你，直到你覺得舒服為止。",
    "你值得被好好對待，被深深擁抱。",
    "別怕，我在你身邊，不走。"
  ],
  "😵 迷茫": [
    "清醒地死去，好過行屍走肉般活著。",
    "不是所有問題都有標準答案。",
    "你有權迷失，因為你正在尋找真正的方向。"
  ]
};

async function fetchGPT(message, tag) {
  const apiKey = "你的OpenAI金鑰"; // 請填入自己的金鑰
  const endpoint = "https://api.openai.com/v1/chat/completions";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `你是一個溫柔的心靈療癒AI。使用者的心情是「${tag}」，請根據這個情緒，用對應的語氣和風格安慰、陪伴、理解他。語氣可以溫柔、感性、深沉或正向激勵，依照情緒選擇。`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.8
      })
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    return reply || getFallbackReply(tag);
  } catch (e) {
    console.error("API 錯誤：", e);
    return getFallbackReply(tag);
  }
}

function getFallbackReply(tag) {
  const list = fallbackRepliesByTag[tag] || ["我會在這裡，不管你說什麼我都願意聽。"];
  return list[Math.floor(Math.random() * list.length)];
}

window.onload = () => {
  const allData = JSON.parse(localStorage.getItem("moodLog") || "{}");
  for (const [date, entries] of Object.entries(allData)) {
    entries.forEach(entry => renderCard(date, entry));
  }
};
