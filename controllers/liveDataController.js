// Live Weather & News Data Fetcher (Zero API Key, 100% Free & Reliable)

export async function getLiveWeather(cityName = "Delhi") {
  try {
    const cleanCity = (cityName || "Delhi").trim();
    const url = `https://wttr.in/${encodeURIComponent(cleanCity)}?format=j1`;
    const res = await fetch(url, { headers: { "User-Agent": "curl/7.68.0" } });
    if (!res.ok) throw new Error("Weather fetch failed");

    const data = await res.json();
    const cur = data.current_condition?.[0] || {};
    const area = data.nearest_area?.[0]?.areaName?.[0]?.value || cleanCity;
    const region = data.nearest_area?.[0]?.region?.[0]?.value || "";

    const temp = cur.temp_C || "N/A";
    const feelsLike = cur.FeelsLikeC || temp;
    const condition = cur.weatherDesc?.[0]?.value || "Clear";
    const humidity = cur.humidity || "N/A";
    const wind = cur.windspeedKmph || "N/A";

    const text_response = `### 🌤️ Live Weather: ${area}, ${region}
* **Temperature:** ${temp}°C (Feels like ${feelsLike}°C)
* **Condition:** ${condition}
* **Humidity:** ${humidity}%
* **Wind Speed:** ${wind} km/h`;

    const speech_response = `Yes boss! ${area} mein abhi temperature ${temp} degree Celsius hai, aur mausam ${condition} hai.`;

    return {
      success: true,
      data: { area, temp, feelsLike, condition, humidity, wind },
      text_response,
      speech_response,
    };
  } catch (err) {
    console.warn("Weather fetch error:", err.message);
    return {
      success: false,
      text_response: `Yes boss, ${cityName} ka weather fetch karne mein dikkat aayi. Kripya internet connection check karein.`,
      speech_response: `Yes boss, weather update laane mein dikkat aayi.`,
    };
  }
}

export async function getLiveNews(category = "top") {
  try {
    const rssUrl = "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en";
    const res = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error("News fetch failed");

    const xml = await res.text();
    const matches = [...xml.matchAll(/<title>(.*?)<\/title>/g)]
      .map((m) => m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim())
      .filter((t) => t && !t.includes("Google News"))
      .slice(0, 5);

    if (matches.length === 0) throw new Error("No news headlines found");

    const formattedList = matches
      .map((item, idx) => `${idx + 1}. **${item}**`)
      .join("\n\n");

    const text_response = `### 📰 Live Top News Headlines (India & World)\n\n${formattedList}`;
    const speech_response = `Yes boss! Aaj ki top news mein: ${matches[0].split("-")[0].trim()}. Poori headlines maine screen par show kar di hain.`;

    return {
      success: true,
      headlines: matches,
      text_response,
      speech_response,
    };
  } catch (err) {
    console.warn("News fetch error:", err.message);
    return {
      success: false,
      text_response:
        "Yes boss, live news headlines fetch karne mein issue aaya. Kripya kuch samay baad try karein.",
      speech_response:
        "Yes boss, live news headlines fetch karne mein dikkat aayi.",
    };
  }
}
