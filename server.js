import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

// URLs
const liveUrl = "https://www.cricbuzz.com/cricket-match/live-scores";
const upcomingUrl = "https://www.cricbuzz.com/cricket-schedule/upcoming-series/international";

// Middleware
app.use(cors());

const axiosOptions = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Referer": "https://www.google.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
  },
};

// 📌 Fetch Live Matches
const fetchLiveMatches = async () => {
  try {
    const { data } = await axios.get(liveUrl, axiosOptions);
    const $ = cheerio.load(data);
    let matches = [];

    $("div[class*='cb-mtch-lst']").each((index, element) => {
      const matchDetails = $(element);
      const title = matchDetails.find("h3.cb-lv-scr-mtch-hdr").text().trim();
      const fullScoreText = matchDetails.find(".cb-scr-wll-chvrn").text().trim();
      const scoreParts = fullScoreText.split(/\s+(?=\w+\d)/);

      const team1 = scoreParts[0]?.match(/^[A-Z]+/)?.[0] || "N/A";
      const score1 = scoreParts[0]?.replace(/^[A-Z]+/, "").trim() || "N/A";
      const team2 = scoreParts[1]?.match(/^[A-Z]+/)?.[0] || "N/A";
      const score2 = scoreParts[1]?.replace(/^[A-Z]+/, "").trim() || "N/A";

      const status =
        matchDetails.find(".cb-text-complete").text().trim() ||
        matchDetails.find(".cb-text-live").text().trim() ||
        matchDetails.find(".cb-text-preview").text().trim() ||
        "Upcoming";

      if (title) {
        matches.push({ title, team1, score1, team2, score2, status });
      }
    });

    return matches;
  } catch (error) {
    console.error("❌ Error fetching live matches:", error.message);
    return [];
  }
};

// 📌 Fetch Upcoming Matches using Puppeteer
const fetchUpcomingMatches = async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(upcomingUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".cb-col-100.cb-col");

    let matches = await page.evaluate(() => {
      let matchList = [];
      document.querySelectorAll(".cb-col-100.cb-col").forEach((matchBlock) => {
        let seriesName =
          matchBlock.querySelector(".cb-col-33.cb-col.cb-mtchs-dy.text-bold")?.innerText.trim() || "Unknown Series";

        matchBlock.querySelectorAll(".cb-col-67.cb-col").forEach((match) => {
          let matchTitle = match.querySelector("a")?.innerText.trim() || "Unknown Match";
          let matchLink = match.querySelector("a")?.getAttribute("href") || "#";
          let fullMatchLink = `https://www.cricbuzz.com${matchLink}`;

          let date =
            match.querySelector(".cb-font-12.text-gray")?.innerText.trim() || "Date Not Available";

          let venue =
            match.querySelector(".cb-ovr-flo.cb-col-50.cb-col.cb-mtchs-dy-vnu")?.innerText.trim() ||
            "Venue Not Available";

          let teams =
            match.querySelector(".cb-col-50.cb-col.cb-mtchs-dy-tm")?.innerText.trim() || "Teams Not Available";

          matchList.push({
            series: seriesName,
            match: matchTitle,
            date,
            venue,
            teams,
            link: fullMatchLink,
          });
        });
      });

      return matchList;
    });

    await browser.close();

    // ✅ Remove duplicates using match links as unique identifiers
    const uniqueMatches = Array.from(new Map(matches.map((m) => [m.link, m])).values());

    return uniqueMatches;
  } catch (error) {
    console.error("❌ Error fetching upcoming matches:", error.message);
    return [];
  }
};

// 📌 API Routes
app.get("/", (req, res) => {
  res.send("Welcome to CricBuddy API! Use /live-matches or /upcoming-matches to get data.");
});

app.get("/live-matches", async (req, res) => {
  const matches = await fetchLiveMatches();
  res.json(matches);
});

app.get("/upcoming-matches", async (req, res) => {
  const matches = await fetchUpcomingMatches();
  res.json(matches);
});

// Start Server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
