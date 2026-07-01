(async function () {
  const LOCAL_KEY = "komorebi-vocabulary-local-v1";
  const cfg = window.KOMOREBI_CONFIG || {};
  const configured = cfg.supabaseUrl && !cfg.supabaseUrl.startsWith("YOUR_") && cfg.supabasePublishableKey && !cfg.supabasePublishableKey.startsWith("YOUR_");
  let words = [];
  if (configured) {
    try {
      const library = window.supabase || await (window.KOMOREBI_SUPABASE_READY || Promise.resolve(null));
      if (!library) throw new Error("Supabase library unavailable");
      const db = library.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
      const sessionResult = await db.auth.getSession();
      const session = sessionResult.data.session;
      if (session) {
        const result = await db.from("vocabulary").select("*").order("date_added", { ascending: true });
        if (!result.error && result.data && result.data.length) words = result.data;
      }
    } catch (error) {
      console.info("Cloud vocabulary unavailable; checking this device.", error);
    }
  }
  if (!words.length) {
    try { words = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch (error) { words = []; }
  }
  if (!words.length) return;
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const entry = words[day % words.length];
  const pick = id => document.querySelector(id);
  if (!pick("#dailyWord")) return;
  pick("#dailyWord").textContent = entry.word;
  pick("#dailyReading").textContent = entry.reading;
  pick("#dailyMeaning").textContent = entry.meaning;
  pick("#dailySentence").textContent = entry.example_japanese || entry.word + "を覚えています。";
  pick("#dailyTranslation").textContent = entry.example_english || "I am learning “" + entry.word + ".”";
  pick("#dailySource").textContent = (entry.category || entry.source || "My vocabulary") + " · saved word";
  const label = document.querySelector(".word-day-label small");
  if (label) label.textContent = "WORD OF THE DAY · YOUR WORDBOOK";
})();
